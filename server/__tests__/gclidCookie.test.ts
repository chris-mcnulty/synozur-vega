/**
 * Tests for server-side Google Ads tracking (server/routes-gtag.ts).
 *
 * Run with:
 *   npx tsx server/__tests__/gclidCookie.test.ts
 *
 * Coverage:
 *   1. gclidCookieMiddleware — Set-Cookie flags and value format on ?gclid= landing
 *   2. No cookie set when ?gclid= is absent or empty
 *   3. extractGclidFromRequest — gclid round-trip from HttpOnly cookie header
 *   4. sendGoogleAdsConversion — calls OAuth2 token endpoint then
 *      uploadClickConversions with correct payload; verifies partial-failure path
 *   5. sendGoogleAdsConversion — returns { sent:false } gracefully when
 *      credentials are missing or gclid is absent (no throw)
 */

import express from "express";
import { createServer } from "http";
import type { AddressInfo } from "net";
import {
  gclidCookieMiddleware,
  extractGclidFromRequest,
  buildGclidCookieValue,
  sendGoogleAdsConversion,
} from "../routes-gtag";
import type { Request } from "express";

// ---------------------------------------------------------------------------
// Tiny assertion helper
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;

function expect(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  PASS ${label}`);
    passed++;
  } else {
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Minimal Express app for cookie middleware tests
// ---------------------------------------------------------------------------
const app = express();
app.use(gclidCookieMiddleware);
app.get("/test/read-gclid", (req, res) => {
  res.json({ gclid: extractGclidFromRequest(req) ?? null });
});
app.get("/", (_req, res) => res.send("ok"));

const server = createServer(app);
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address() as AddressInfo;
const BASE = `http://127.0.0.1:${port}`;

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
async function get(path: string, headers?: Record<string, string>) {
  return fetch(`${BASE}${path}`, { headers });
}

function getSetCookies(res: Response): string[] {
  const hdr = res.headers as any;
  if (typeof hdr.getSetCookie === "function") return hdr.getSetCookie() as string[];
  const raw = res.headers.get("set-cookie");
  return raw ? [raw] : [];
}

function findCookie(cookies: string[], name: string): string | undefined {
  return cookies.find((c) => c.trimStart().startsWith(`${name}=`));
}

// ---------------------------------------------------------------------------
// Case 1: ?gclid= landing sets _gcl_aw with correct flags and value
// ---------------------------------------------------------------------------
console.log("\n[case 1] ?gclid= landing sets _gcl_aw with HttpOnly + Secure + SameSite=Lax");
{
  const gclid = "EAIaIQobChMI_testGclid123";
  const res = await get(`/?gclid=${encodeURIComponent(gclid)}`);
  const cookies = getSetCookies(res);
  const gclidCookie = findCookie(cookies, "_gcl_aw");

  expect("response is 200", res.status === 200, `got ${res.status}`);
  expect("_gcl_aw Set-Cookie header present", gclidCookie !== undefined);

  if (gclidCookie) {
    const lower = gclidCookie.toLowerCase();
    const valueMatch = gclidCookie.match(/_gcl_aw=GCL\.(\d+)\.(.+?)(?:;|$)/);
    expect("value format is GCL.<epoch>.<gclid>", valueMatch !== null, gclidCookie);
    if (valueMatch) {
      const epoch = parseInt(valueMatch[1], 10);
      const now = Math.floor(Date.now() / 1000);
      expect("epoch is within 5s of now", Math.abs(epoch - now) <= 5, `epoch=${epoch} now=${now}`);
      const gclidInValue = valueMatch[2].split(";")[0];
      expect("gclid matches input", gclidInValue === gclid, `got "${gclidInValue}"`);
    }
    expect("HttpOnly flag present", lower.includes("httponly"), gclidCookie);
    expect("Secure flag present", lower.includes("secure"), gclidCookie);
    expect("SameSite=Lax present", lower.includes("samesite=lax"), gclidCookie);
    const maxAgeMatch = gclidCookie.match(/max-age=(\d+)/i);
    expect("Max-Age present", maxAgeMatch !== null, gclidCookie);
    if (maxAgeMatch) {
      expect("Max-Age is 90 days (7776000s)", parseInt(maxAgeMatch[1], 10) === 7776000);
    }
  }
}

// ---------------------------------------------------------------------------
// Case 2: no ?gclid= → no Set-Cookie
// ---------------------------------------------------------------------------
console.log("\n[case 2] no ?gclid= → _gcl_aw not set");
{
  const res = await get("/");
  expect("_gcl_aw NOT set (no param)", findCookie(getSetCookies(res), "_gcl_aw") === undefined);
}

// Case 2b: empty ?gclid= → no Set-Cookie
{
  const res = await get("/?gclid=");
  expect("_gcl_aw NOT set (empty param)", findCookie(getSetCookies(res), "_gcl_aw") === undefined);
}

// ---------------------------------------------------------------------------
// Case 3: extractGclidFromRequest round-trips gclid from Cookie header
// ---------------------------------------------------------------------------
console.log("\n[case 3] extractGclidFromRequest reads gclid from Cookie header");
{
  const gclid = "EAIaIQobChMI_subsequentRequest456";
  const cookieValue = buildGclidCookieValue(gclid);
  const res = await get("/test/read-gclid", { Cookie: `_gcl_aw=${cookieValue}` });
  const body = await res.json() as { gclid: string | null };
  expect("extractGclidFromRequest returns gclid", body.gclid === gclid, `got "${body.gclid}"`);
}

// Missing cookie → null
{
  const res = await get("/test/read-gclid");
  const body = await res.json() as { gclid: string | null };
  expect("extractGclidFromRequest returns null when cookie absent", body.gclid === null);
}

// Dotted gclid preserved
{
  const gclid = "EAIaIQ.obChMI_with.dots";
  const cookieValue = buildGclidCookieValue(gclid);
  const res = await get("/test/read-gclid", { Cookie: `_gcl_aw=${cookieValue}` });
  const body = await res.json() as { gclid: string | null };
  expect("dotted gclid round-trips correctly", body.gclid === gclid, `got "${body.gclid}"`);
}

// ---------------------------------------------------------------------------
// Case 4: sendGoogleAdsConversion — credentials missing → graceful no-send
// ---------------------------------------------------------------------------
console.log("\n[case 4] sendGoogleAdsConversion: missing credentials → no throw, sent=false");
{
  // Temporarily unset any credentials that may be in the environment
  const saved: Record<string, string | undefined> = {};
  const keys = [
    "GOOGLE_ADS_DEVELOPER_TOKEN",
    "GOOGLE_ADS_CUSTOMER_ID",
    "GOOGLE_ADS_CONVERSION_ACTION_ID",
    "GOOGLE_ADS_OAUTH_CLIENT_ID",
    "GOOGLE_ADS_OAUTH_CLIENT_SECRET",
    "GOOGLE_ADS_OAUTH_REFRESH_TOKEN",
  ];
  for (const k of keys) { saved[k] = process.env[k]; delete process.env[k]; }

  const fakeReq = { headers: { cookie: "" } } as unknown as Request;
  let result: Awaited<ReturnType<typeof sendGoogleAdsConversion>> | undefined;
  let threw = false;
  try {
    result = await sendGoogleAdsConversion(fakeReq);
  } catch {
    threw = true;
  }

  expect("does not throw when credentials missing", !threw);
  expect("sent is false", result?.sent === false);
  expect("reason is credentials_not_configured", result?.reason === "credentials_not_configured");

  // Restore
  for (const k of keys) {
    if (saved[k] !== undefined) process.env[k] = saved[k];
  }
}

// ---------------------------------------------------------------------------
// Case 5: sendGoogleAdsConversion — credentials present, no gclid cookie → graceful
// ---------------------------------------------------------------------------
console.log("\n[case 5] sendGoogleAdsConversion: credentials present but no gclid → sent=false");
{
  // Set all required credentials so the credentials check passes
  const keys = [
    "GOOGLE_ADS_DEVELOPER_TOKEN",
    "GOOGLE_ADS_CUSTOMER_ID",
    "GOOGLE_ADS_CONVERSION_ACTION_ID",
    "GOOGLE_ADS_OAUTH_CLIENT_ID",
    "GOOGLE_ADS_OAUTH_CLIENT_SECRET",
    "GOOGLE_ADS_OAUTH_REFRESH_TOKEN",
  ] as const;
  const values = ["dev-token", "1234567890", "9876543", "client-id", "client-secret", "refresh-token"];
  const saved: Record<string, string | undefined> = {};
  keys.forEach((k, i) => { saved[k] = process.env[k]; process.env[k] = values[i]; });

  // Request with no _gcl_aw cookie
  const fakeReq = { headers: { cookie: "" } } as unknown as Request;
  let result: Awaited<ReturnType<typeof sendGoogleAdsConversion>> | undefined;
  let threw = false;
  try {
    result = await sendGoogleAdsConversion(fakeReq);
  } catch {
    threw = true;
  }

  expect("does not throw when gclid absent", !threw);
  expect("sent is false when no gclid", result?.sent === false);
  expect("reason is no_gclid_in_cookie", result?.reason === "no_gclid_in_cookie");

  keys.forEach((k) => {
    if (saved[k] !== undefined) process.env[k] = saved[k]; else delete process.env[k];
  });
}

// ---------------------------------------------------------------------------
// Case 6: sendGoogleAdsConversion — full happy-path with mocked fetch
// ---------------------------------------------------------------------------
console.log("\n[case 6] sendGoogleAdsConversion: mocked credentials + gclid → calls OAuth then uploadClickConversions");
{
  const testGclid = "EAIaIQobChMI_mockConversionGclid";
  const testCustomerId = "1234567890";
  const testDevToken = "test-developer-token";
  const testConversionActionId = "9876543";
  const testAccessToken = "ya29.mock-access-token";

  // Track which URLs were called and with what payloads
  const calls: { url: string; method: string; headers: Record<string, string>; body: string }[] = [];

  // Monkey-patch globalThis.fetch for this test
  const realFetch = globalThis.fetch;
  (globalThis as any).fetch = async (url: string, init: RequestInit = {}) => {
    const bodyText = typeof init.body === "string" ? init.body : "";
    calls.push({
      url: String(url),
      method: init.method || "GET",
      headers: Object.fromEntries(
        Object.entries((init.headers as Record<string, string>) || {})
      ),
      body: bodyText,
    });

    if (String(url).includes("oauth2.googleapis.com/token")) {
      return new Response(JSON.stringify({ access_token: testAccessToken }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (String(url).includes("uploadClickConversions")) {
      return new Response(JSON.stringify({ results: [{}] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return realFetch(url, init);
  };

  // Set credentials
  const keys = [
    "GOOGLE_ADS_DEVELOPER_TOKEN",
    "GOOGLE_ADS_CUSTOMER_ID",
    "GOOGLE_ADS_CONVERSION_ACTION_ID",
    "GOOGLE_ADS_OAUTH_CLIENT_ID",
    "GOOGLE_ADS_OAUTH_CLIENT_SECRET",
    "GOOGLE_ADS_OAUTH_REFRESH_TOKEN",
  ] as const;
  const values = [testDevToken, testCustomerId, testConversionActionId, "client-id", "client-secret", "refresh-token"];
  const saved: Record<string, string | undefined> = {};
  keys.forEach((k, i) => { saved[k] = process.env[k]; process.env[k] = values[i]; });

  const cookieValue = buildGclidCookieValue(testGclid);
  const fakeReq = {
    headers: { cookie: `_gcl_aw=${cookieValue}` },
  } as unknown as Request;

  let result: Awaited<ReturnType<typeof sendGoogleAdsConversion>> | undefined;
  let threw = false;
  try {
    result = await sendGoogleAdsConversion(fakeReq);
  } catch (e) {
    threw = true;
    console.error("  threw:", e);
  }

  expect("does not throw on happy path", !threw);
  expect("sent is true", result?.sent === true);

  // Verify OAuth2 token call
  const tokenCall = calls.find((c) => c.url.includes("oauth2.googleapis.com/token"));
  expect("OAuth2 token endpoint called", tokenCall !== undefined);
  if (tokenCall) {
    expect("token call is POST", tokenCall.method === "POST");
    expect("token body contains grant_type=refresh_token", tokenCall.body.includes("grant_type=refresh_token"));
    expect("token body contains client_id", tokenCall.body.includes("client-id"));
  }

  // Verify uploadClickConversions call
  const adsCall = calls.find((c) => c.url.includes("uploadClickConversions"));
  expect("uploadClickConversions endpoint called", adsCall !== undefined);
  if (adsCall) {
    expect("Ads call is POST", adsCall.method === "POST");
    expect("Authorization header uses access token", adsCall.headers["Authorization"] === `Bearer ${testAccessToken}`);
    expect("developer-token header set", adsCall.headers["developer-token"] === testDevToken);
    const bodyJson = JSON.parse(adsCall.body) as {
      conversions: { gclid: string; conversionAction: string; conversionDateTime: string }[];
    };
    expect("conversions array has one entry", bodyJson.conversions?.length === 1);
    const conv = bodyJson.conversions?.[0];
    expect("gclid matches test value", conv?.gclid === testGclid, `got "${conv?.gclid}"`);
    expect(
      "conversionAction references correct customer + action",
      conv?.conversionAction === `customers/${testCustomerId}/conversionActions/${testConversionActionId}`,
      `got "${conv?.conversionAction}"`
    );
    expect("conversionDateTime is a string", typeof conv?.conversionDateTime === "string");
    expect(
      "conversionDateTime matches expected format (YYYY-MM-DD HH:MM:SS+00:00)",
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\+00:00$/.test(conv?.conversionDateTime ?? ""),
      `got "${conv?.conversionDateTime}"`
    );
  }

  // Restore
  (globalThis as any).fetch = realFetch;
  keys.forEach((k) => {
    if (saved[k] !== undefined) process.env[k] = saved[k]; else delete process.env[k];
  });
}

// ---------------------------------------------------------------------------
// Case 7: sendGoogleAdsConversion — partialFailureError → sent=false, retryable
// ---------------------------------------------------------------------------
console.log("\n[case 7] sendGoogleAdsConversion: partialFailureError → sent=false (not retained in idempotency set)");
{
  const testGclid = "EAIaIQobChMI_partialFailureGclid";
  const realFetch = globalThis.fetch;
  (globalThis as any).fetch = async (url: string, _init: RequestInit = {}) => {
    if (String(url).includes("oauth2.googleapis.com/token")) {
      return new Response(JSON.stringify({ access_token: "ya29.mock" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    if (String(url).includes("uploadClickConversions")) {
      // Simulate Google Ads API returning a partial failure
      return new Response(JSON.stringify({
        partialFailureError: { code: 10, message: "Invalid gclid" },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return realFetch(url, _init);
  };

  const keys = [
    "GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CUSTOMER_ID",
    "GOOGLE_ADS_CONVERSION_ACTION_ID", "GOOGLE_ADS_OAUTH_CLIENT_ID",
    "GOOGLE_ADS_OAUTH_CLIENT_SECRET", "GOOGLE_ADS_OAUTH_REFRESH_TOKEN",
  ] as const;
  const saved: Record<string, string | undefined> = {};
  keys.forEach((k, i) => { saved[k] = process.env[k]; process.env[k] = ["tok","123","456","cid","csec","rtok"][i]; });

  const cookieValue = buildGclidCookieValue(testGclid);
  const fakeReq = { headers: { cookie: `_gcl_aw=${cookieValue}` } } as unknown as Request;
  let result: Awaited<ReturnType<typeof sendGoogleAdsConversion>> | undefined;
  let threw = false;
  try { result = await sendGoogleAdsConversion(fakeReq); } catch { threw = true; }

  expect("partial failure does not throw", !threw);
  expect("sent is false on partial failure", result?.sent === false);
  expect("reason is partial_failure", result?.reason === "partial_failure");
  expect("partialFailures array is returned", Array.isArray(result?.partialFailures));

  (globalThis as any).fetch = realFetch;
  keys.forEach((k) => { if (saved[k] !== undefined) process.env[k] = saved[k]; else delete process.env[k]; });
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
server.close();
const total = passed + failed;
console.log(`\n${passed}/${total} gclid/conversion tests passed.`);
if (failed > 0) {
  console.error(`\n${failed} test(s) FAILED.`);
  process.exit(1);
}
console.log("\nAll gclid/conversion tests passed.");
