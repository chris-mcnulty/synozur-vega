/**
 * Server-side Google Ads tracking: click-ID cookie + conversion upload
 *
 * Resolves CWE-1004 (missing HttpOnly flag on the GAESA / _gcl_aw cookie) by:
 *   1. Writing the cookie server-side with HttpOnly+Secure before the page loads
 *      (gclidCookieMiddleware — applied globally in routes.ts).
 *   2. Uploading conversion events to the Google Ads API from the trusted
 *      server-side signup handler using the HttpOnly cookie's gclid value
 *      (sendGoogleAdsConversion — called from /api/auth/signup in routes.ts).
 *
 * Credentials required (set as environment variables / Replit Secrets):
 *   GOOGLE_ADS_DEVELOPER_TOKEN    — Google Ads API developer token
 *   GOOGLE_ADS_CUSTOMER_ID        — Google Ads customer/account ID (digits or dashes)
 *   GOOGLE_ADS_CONVERSION_ACTION_ID — Numeric conversion action ID from your Ads account
 *   GOOGLE_ADS_OAUTH_CLIENT_ID    — OAuth2 client ID (from Google Cloud Console)
 *   GOOGLE_ADS_OAUTH_CLIENT_SECRET — OAuth2 client secret
 *   GOOGLE_ADS_OAUTH_REFRESH_TOKEN — Long-lived refresh token for the Ads account
 *
 * When credentials are absent the function logs a single warning and returns
 * { sent: false, reason: 'credentials_not_configured' } without throwing, so
 * the signup flow is never disrupted by missing tracking configuration.
 *
 * Cookie parsing: the `cookie` package (a transitive Express dependency) is used
 * to parse req.headers.cookie so the HttpOnly _gcl_aw value is readable on the
 * server without a global cookie-parser middleware.
 */

import { Router, Request, Response, NextFunction } from "express";
import { parse as parseCookies } from "cookie";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const GAESA_COOKIE_NAME = "_gcl_aw";
const GAESA_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

// Google Ads REST API — uploadClickConversions
// Version is read from GOOGLE_ADS_API_VERSION env var so it can be updated
// without a code change as Google releases new versions (quarterly cadence,
// 12-month support window). Defaults to v20 (released Q1 2025; supported
// through Q1 2026 minimum). Update to the latest supported version when
// provisioning credentials — see https://developers.google.com/google-ads/api/docs/sunset-dates
// https://developers.google.com/google-ads/api/rest/reference/rest/v20/customers.conversions/uploadClickConversions
const GOOGLE_ADS_API_VERSION = process.env.GOOGLE_ADS_API_VERSION || "v20";
const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

/** Build the _gcl_aw cookie value Google expects: GCL.<epoch-secs>.<gclid> */
export function buildGclidCookieValue(gclid: string): string {
  return `GCL.${Math.floor(Date.now() / 1000)}.${gclid}`;
}

/** Set _gcl_aw on the response with HttpOnly + Secure so CWE-1004 is resolved. */
function setGclidCookie(res: Response, gclid: string): void {
  res.cookie(GAESA_COOKIE_NAME, buildGclidCookieValue(gclid), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: GAESA_MAX_AGE_MS,
    path: "/",
  });
}

/**
 * Extract the gclid from the HttpOnly _gcl_aw cookie on an incoming request.
 * Parses the raw Cookie header directly (req.cookies is not pre-populated here).
 * Returns undefined when the cookie is absent or malformed.
 */
export function extractGclidFromRequest(req: Request): string | undefined {
  try {
    const cookies = parseCookies(req.headers.cookie || "");
    const raw = cookies[GAESA_COOKIE_NAME];
    if (!raw) return undefined;
    // Format: GCL.<epoch-secs>.<gclid>  (gclid may itself contain dots)
    const firstDot = raw.indexOf(".");
    const secondDot = raw.indexOf(".", firstDot + 1);
    if (firstDot === -1 || secondDot === -1) return undefined;
    return raw.slice(secondDot + 1) || undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * Global Express middleware (registered in routes.ts).
 *
 * When a request carries ?gclid= in the URL (user clicked a Google Ad), the
 * server writes _gcl_aw with HttpOnly+Secure+SameSite=Lax before any page
 * JavaScript runs.  Because the browser treats an existing HttpOnly cookie as
 * write-protected from JavaScript, subsequent document.cookie assignments for
 * _gcl_aw by gtag.js are silently ignored — the server-set HttpOnly copy
 * persists for the full 90-day window.
 */
export function gclidCookieMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const gclid = req.query.gclid as string | undefined;
  if (gclid && typeof gclid === "string" && gclid.length > 0) {
    setGclidCookie(res, gclid);
  }
  next();
}

// ---------------------------------------------------------------------------
// Google Ads API: OAuth2 token exchange
// ---------------------------------------------------------------------------

async function getGoogleOAuthAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<string> {
  const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `[gtag] OAuth2 token exchange failed (${res.status}): ${body}`
    );
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("[gtag] OAuth2 response missing access_token");
  return json.access_token;
}

// ---------------------------------------------------------------------------
// Google Ads API: uploadClickConversions
// ---------------------------------------------------------------------------

/** Format a Date as the string Google Ads requires: "YYYY-MM-DD HH:MM:SS+00:00" */
function toGoogleAdsDateTime(d: Date): string {
  return d.toISOString().replace("T", " ").replace(/\.\d+Z$/, "+00:00");
}

export interface ConversionResult {
  sent: boolean;
  reason?: string;
  partialFailures?: unknown[];
}

/**
 * Upload a click conversion to the Google Ads API using the gclid recovered
 * from the HttpOnly _gcl_aw cookie on the provided request.
 *
 * This is called from the trusted /api/auth/signup handler immediately after
 * successful user creation, ensuring conversions are tied to a verified
 * server-side event rather than an unauthenticated browser POST.
 *
 * Returns { sent: false, reason } without throwing when:
 *   - Required credentials are missing (logs a config warning).
 *   - No gclid is present in the cookie (no ad click to attribute).
 * Throws on network / API errors so the caller can log them as non-fatal.
 *
 * Required environment variables:
 *   GOOGLE_ADS_DEVELOPER_TOKEN
 *   GOOGLE_ADS_CUSTOMER_ID
 *   GOOGLE_ADS_CONVERSION_ACTION_ID
 *   GOOGLE_ADS_OAUTH_CLIENT_ID
 *   GOOGLE_ADS_OAUTH_CLIENT_SECRET
 *   GOOGLE_ADS_OAUTH_REFRESH_TOKEN
 */
export async function sendGoogleAdsConversion(
  req: Request
): Promise<ConversionResult> {
  // -- 1. Read credentials from environment ----------------------------------
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const rawCustomerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
  const conversionActionId = process.env.GOOGLE_ADS_CONVERSION_ACTION_ID;
  const oauthClientId = process.env.GOOGLE_ADS_OAUTH_CLIENT_ID;
  const oauthClientSecret = process.env.GOOGLE_ADS_OAUTH_CLIENT_SECRET;
  const oauthRefreshToken = process.env.GOOGLE_ADS_OAUTH_REFRESH_TOKEN;

  const credentialsMissing = [
    developerToken,
    rawCustomerId,
    conversionActionId,
    oauthClientId,
    oauthClientSecret,
    oauthRefreshToken,
  ].some((v) => !v);

  if (credentialsMissing) {
    console.warn(
      "[gtag] Google Ads API credentials not fully configured — " +
        "server-side conversion upload skipped. " +
        "Set GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CUSTOMER_ID, " +
        "GOOGLE_ADS_CONVERSION_ACTION_ID, GOOGLE_ADS_OAUTH_CLIENT_ID, " +
        "GOOGLE_ADS_OAUTH_CLIENT_SECRET, GOOGLE_ADS_OAUTH_REFRESH_TOKEN " +
        "to activate server-side conversion tracking."
    );
    return { sent: false, reason: "credentials_not_configured" };
  }

  // -- 2. Recover gclid from the HttpOnly cookie ----------------------------
  const gclid = extractGclidFromRequest(req);
  if (!gclid) {
    // Visitor did not arrive via a tracked Google Ad click — no conversion to upload.
    return { sent: false, reason: "no_gclid_in_cookie" };
  }

  // Normalise customer ID (strip dashes/spaces; Google Ads API expects digits)
  const customerId = rawCustomerId!.replace(/[\s-]/g, "");

  // -- 3. Exchange refresh token for an access token ------------------------
  const accessToken = await getGoogleOAuthAccessToken(
    oauthClientId!,
    oauthClientSecret!,
    oauthRefreshToken!
  );

  // -- 4. Upload click conversion -------------------------------------------
  const conversionDateTime = toGoogleAdsDateTime(new Date());
  const conversionAction = `customers/${customerId}/conversionActions/${conversionActionId}`;

  const apiUrl =
    `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}` +
    `/customers/${customerId}/conversions:uploadClickConversions`;

  const apiRes = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": developerToken!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      conversions: [
        {
          gclid,
          conversionAction,
          conversionDateTime,
        },
      ],
      partialFailure: true,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!apiRes.ok) {
    const errBody = await apiRes.text().catch(() => "");
    throw new Error(
      `[gtag] Google Ads uploadClickConversions failed (${apiRes.status}): ${errBody}`
    );
  }

  const apiJson = (await apiRes.json()) as {
    partialFailureError?: unknown;
    results?: unknown[];
  };

  if (apiJson.partialFailureError) {
    // partialFailureError means the single conversion entry was rejected by Google.
    // Return sent:false so the caller does NOT retain the idempotency marker and
    // the upload can be retried (e.g. when a future verification attempt is made
    // or credentials are corrected).
    console.warn(
      "[gtag] Google Ads uploadClickConversions returned partialFailureError " +
      "(conversion not accepted — idempotency marker not retained for retry):",
      JSON.stringify(apiJson.partialFailureError)
    );
    return {
      sent: false,
      reason: "partial_failure",
      partialFailures: [apiJson.partialFailureError],
    };
  }

  return { sent: true };
}

// ---------------------------------------------------------------------------
// Router export (no public HTTP endpoints — all conversion work is done via
// sendGoogleAdsConversion() called directly from the signup handler)
// ---------------------------------------------------------------------------
const router = Router();
export { router as gtagRouter };
