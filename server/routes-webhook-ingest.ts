import { Router, Request, Response } from "express";
import crypto from "crypto";
import { storage } from "./storage";
import {
  calculateKeyResultProgress,
  calculateObjectiveRollupProgress,
} from "./routes-okr";
import type { KrWebhookToken } from "@shared/schema";
import { decryptToken, isEncrypted } from "./utils/encryption";
import { calculatePaceMetrics, type PaceStatus } from "./okr-intelligence";
import { getTrendSeriesForEntity } from "./services/progress-snapshots";

// Map pace-engine output onto the KR/objective status enum used by the rest
// of the app. 'no_data' / 'completed' fall through to leave status untouched.
function paceToKrStatus(pace: PaceStatus): string | null {
  switch (pace) {
    case "ahead":
    case "on_track":
      return "on_track";
    case "behind":
      return "behind";
    case "at_risk":
      return "at_risk";
    case "completed":
      return "completed";
    default:
      return null;
  }
}

export const webhookIngestRouter = Router();

// =============================================================================
// Rate limiters (Postgres-backed token bucket)
//   - per-token:  60 requests / minute
//   - per-tenant: 1000 requests / minute
// State lives in the `webhook_rate_limits` table so buckets are shared across
// every app instance — capacity equals the per-window limit and tokens refill
// linearly at limit/window. On rate-limit-store failures we fail open (allow
// the request) so a transient DB hiccup doesn't make ingest unavailable; the
// downstream auth + signature checks still apply.
// =============================================================================
const PER_TOKEN_LIMIT = 60;
const PER_TENANT_LIMIT = 1000;
const WINDOW_MS = 60_000;

async function checkSharedRateLimit(kind: "token" | "tenant", key: string, limit: number): Promise<boolean> {
  try {
    return await storage.checkWebhookRateLimit(kind, key, limit, WINDOW_MS);
  } catch (err) {
    console.error("[webhook-ingest] rate limit store failure, failing open", err);
    return true;
  }
}

// =============================================================================
// Helpers
// =============================================================================
function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

function getRawBody(req: Request): Buffer | undefined {
  const raw = (req as any).rawBody;
  if (Buffer.isBuffer(raw)) return raw;
  if (typeof raw === "string") return Buffer.from(raw);
  return undefined;
}

async function logIngest(opts: {
  tenantId?: string | null;
  tokenId?: string | null;
  keyResultId?: string | null;
  statusCode: number;
  errorCode?: string;
  errorMessage?: string;
  payloadSize?: number;
  sourceIp?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    await storage.createWebhookIngestLog({
      tenantId: opts.tenantId ?? null,
      tokenId: opts.tokenId ?? null,
      keyResultId: opts.keyResultId ?? null,
      statusCode: opts.statusCode,
      errorCode: opts.errorCode ?? null,
      errorMessage: opts.errorMessage ?? null,
      payloadSize: opts.payloadSize ?? null,
      sourceIp: opts.sourceIp ?? null,
      userAgent: opts.userAgent ?? null,
    } as any);
  } catch (err) {
    console.error("[webhook-ingest] failed to write audit log", err);
  }
}

// =============================================================================
// POST /api/ingest/v1/kr/:token
// Body: { value: number, note?: string, asOfDate?: ISO string }
// Headers:
//   X-Vega-Signature: sha256=<hex>  -- HMAC-SHA256(secret, rawBody)
// =============================================================================
webhookIngestRouter.post("/v1/kr/:token", async (req: Request, res: Response) => {
  const sourceIp =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    undefined;
  const userAgent = req.headers["user-agent"]?.toString().slice(0, 500);
  const rawBody = getRawBody(req);
  const payloadSize = rawBody?.length;

  const sendError = async (
    status: number,
    code: string,
    message: string,
    ctx?: { token?: KrWebhookToken | null },
  ) => {
    await logIngest({
      tenantId: ctx?.token?.tenantId,
      tokenId: ctx?.token?.id,
      keyResultId: ctx?.token?.keyResultId,
      statusCode: status,
      errorCode: code,
      errorMessage: message,
      payloadSize,
      sourceIp,
      userAgent,
    });
    if (ctx?.token) {
      try {
        await storage.incrementKrWebhookTokenFailure(ctx.token.id);
      } catch {}
    }
    // Generic 4xx body to discourage probing
    return res
      .status(status)
      .json({ error: status === 401 || status === 403 ? "invalid_token" : code });
  };

  try {
    const tokenParam = req.params.token;
    if (!tokenParam || typeof tokenParam !== "string" || tokenParam.length < 16) {
      return sendError(401, "invalid_token", "Token missing or malformed");
    }

    // Look up token by sha256 hash
    const tokenHash = sha256(tokenParam);
    const token = await storage.getKrWebhookTokenByHash(tokenHash);
    if (!token) {
      return sendError(401, "invalid_token", "Token not found");
    }
    if (!token.enabled || token.revokedAt) {
      return sendError(403, "token_disabled", "Token has been revoked or disabled", { token });
    }

    // Per-token rate limit
    if (!(await checkSharedRateLimit("token", token.id, PER_TOKEN_LIMIT))) {
      return sendError(429, "rate_limit_token", "Per-token rate limit exceeded", { token });
    }
    // Per-tenant rate limit
    if (!(await checkSharedRateLimit("tenant", token.tenantId, PER_TENANT_LIMIT))) {
      return sendError(429, "rate_limit_tenant", "Per-tenant rate limit exceeded", { token });
    }

    // Verify HMAC signature
    const sigHeader = (req.headers["x-vega-signature"] || req.headers["x-vega-signature".toLowerCase()])?.toString() ?? "";
    const provided = sigHeader.startsWith("sha256=") ? sigHeader.slice(7) : sigHeader;
    if (!provided || !rawBody) {
      return sendError(401, "invalid_signature", "Missing signature or body", { token });
    }
    // The HMAC secret is stored AES-256-GCM encrypted at rest (column name is
    // historical). Decrypt before computing the expected HMAC over the raw body.
    let secretMaterial: string;
    try {
      secretMaterial = isEncrypted(token.secretHash)
        ? decryptToken(token.secretHash)
        : token.secretHash; // legacy plaintext rows from before encryption rollout
    } catch (e) {
      return sendError(500, "secret_decrypt_failed", "Could not decrypt token secret", { token });
    }
    const expected = crypto
      .createHmac("sha256", secretMaterial)
      .update(rawBody)
      .digest("hex");
    if (!timingSafeEqualHex(provided, expected)) {
      return sendError(401, "invalid_signature", "Signature mismatch", { token });
    }

    // Parse body (express.json already parsed it)
    const body = req.body ?? {};
    const valueRaw = body.value;
    const note: string | undefined = typeof body.note === "string" ? body.note : undefined;
    const asOfDateRaw = body.asOfDate;

    if (valueRaw === undefined || valueRaw === null || isNaN(Number(valueRaw))) {
      return sendError(400, "invalid_payload", "value is required and must be numeric", { token });
    }
    const value = Number(valueRaw);

    // Look up KR and validate
    const kr = await storage.getKeyResultById(token.keyResultId);
    if (!kr) {
      return sendError(410, "kr_missing", "Key result no longer exists", { token });
    }
    if ((kr as any).archived === true) {
      return sendError(410, "kr_archived", "Key result has been archived", { token });
    }
    if (kr.status === "closed") {
      return sendError(409, "kr_closed", "Key result is closed", { token });
    }
    if (kr.objectiveId) {
      const parent = await storage.getObjectiveById(kr.objectiveId);
      if (parent?.status === "closed") {
        return sendError(409, "objective_closed", "Parent objective is closed", { token });
      }
    }

    // Compute new progress
    const targetValue = kr.targetValue ?? 0;
    const initialValue = kr.initialValue ?? 0;
    const metricType = kr.metricType || "increase";
    const newProgress = calculateKeyResultProgress(value, targetValue, initialValue, metricType);
    const previousProgress = kr.progress ?? 0;
    const previousValue = kr.currentValue ?? null;
    const previousStatus = kr.status ?? null;

    // Derive pace-based status using the project-wide pace engine. We feed in
    // the existing trend series so the projection accounts for prior check-ins.
    const parentObj = kr.objectiveId ? await storage.getObjectiveById(kr.objectiveId) : null;
    let derivedStatus: string | null = null;
    try {
      const trendSeries = await getTrendSeriesForEntity("key_result", kr.id);
      const pace = calculatePaceMetrics({
        progress: newProgress,
        startDate: parentObj?.startDate ?? null,
        endDate: parentObj?.endDate ?? null,
        quarter: parentObj?.quarter ?? null,
        year: parentObj?.year ?? null,
        checkIns: trendSeries,
        targetValue: targetValue || 100,
      });
      derivedStatus = paceToKrStatus(pace.status);
      if (newProgress >= 100) derivedStatus = "completed";
    } catch (e) {
      console.error("[webhook-ingest] pace calc failed", e);
    }

    let asOfDate: Date | null = null;
    if (typeof asOfDateRaw === "string") {
      const parsed = new Date(asOfDateRaw);
      if (!isNaN(parsed.getTime())) asOfDate = parsed;
    }

    // Resolve a user to attribute the check-in to. The check_ins.user_id column
    // is NOT NULL, so we fall back to the token creator, then any tenant admin,
    // then any user in the tenant.
    let attributedUserId: string | null = token.createdByUserId ?? null;
    let attributedUserEmail: string | null = null;
    if (attributedUserId) {
      const u = await storage.getUser(attributedUserId);
      if (u && u.tenantId === token.tenantId) {
        attributedUserEmail = u.email ?? null;
      } else {
        attributedUserId = null;
      }
    }
    if (!attributedUserId) {
      const tenantUsers = await storage.getAllUsers(token.tenantId);
      const fallback =
        tenantUsers.find((u) => u.role === "tenant_admin") ??
        tenantUsers.find((u) => u.role === "admin") ??
        tenantUsers[0];
      if (!fallback) {
        return sendError(500, "no_user_available", "No user available to attribute check-in", { token });
      }
      attributedUserId = fallback.id;
      attributedUserEmail = fallback.email ?? null;
    }

    // Decide whether to auto-apply the derived status. We never override a KR
    // that's already closed/completed by hand, and we skip when pace returned
    // no_data (covered by derivedStatus === null).
    const shouldApplyStatus =
      derivedStatus !== null &&
      previousStatus !== "closed" &&
      previousStatus !== "completed" &&
      derivedStatus !== previousStatus;

    // Create check-in (source: 'webhook'). Persist new/previous status so the
    // check-in feed shows the pace-derived status transition.
    const checkIn = await storage.createCheckIn({
      tenantId: token.tenantId,
      entityType: "key_result",
      entityId: kr.id,
      previousValue: previousValue as any,
      newValue: value as any,
      previousProgress,
      newProgress,
      previousStatus,
      newStatus: shouldApplyStatus ? derivedStatus : null,
      note: note ?? null,
      source: "webhook",
      asOfDate: (asOfDate ?? new Date()) as any,
      userId: attributedUserId,
      userEmail: attributedUserEmail,
    } as any);

    // Update KR — value/progress always, status only when pace says it changed.
    const krUpdate: any = {
      currentValue: value,
      progress: newProgress,
      lastCheckInAt: checkIn.createdAt,
      lastCheckInNote: note ?? undefined,
    };
    if (shouldApplyStatus) krUpdate.status = derivedStatus;
    await storage.updateKeyResult(kr.id, krUpdate);

    // Roll up parent objective if applicable (progress + pace-derived status).
    if (kr.objectiveId && parentObj && parentObj.progressMode === "rollup") {
      const rolled = await calculateObjectiveRollupProgress(kr.objectiveId);
      const objUpdate: any = { progress: rolled };
      if (parentObj.status !== "closed" && parentObj.status !== "completed") {
        try {
          const objSeries = await getTrendSeriesForEntity("objective", kr.objectiveId);
          const objPace = calculatePaceMetrics({
            progress: rolled,
            startDate: parentObj.startDate ?? null,
            endDate: parentObj.endDate ?? null,
            quarter: parentObj.quarter ?? null,
            year: parentObj.year ?? null,
            checkIns: objSeries,
          });
          const rolledStatus = paceToKrStatus(objPace.status);
          if (rolledStatus && rolledStatus !== parentObj.status) {
            objUpdate.status = rolledStatus;
          }
        } catch {}
      }
      await storage.updateObjective(kr.objectiveId, objUpdate);
    }

    // Update token success counters
    await storage.incrementKrWebhookTokenSuccess(token.id);

    await logIngest({
      tenantId: token.tenantId,
      tokenId: token.id,
      keyResultId: kr.id,
      statusCode: 200,
      payloadSize,
      sourceIp,
      userAgent,
    });

    return res.json({
      ok: true,
      checkInId: checkIn.id,
      keyResultId: kr.id,
      value,
      progress: newProgress,
    });
  } catch (err: any) {
    console.error("[webhook-ingest] unexpected error", err);
    await logIngest({
      statusCode: 500,
      errorCode: "internal_error",
      errorMessage: err?.message?.slice(0, 500) ?? "unknown",
      payloadSize,
      sourceIp,
      userAgent,
    });
    return res.status(500).json({ error: "internal_error" });
  }
});
