/**
 * certExpiry.ts
 *
 * Utility to fetch the TLS certificate expiry date for a given hostname using
 * Node's built-in `tls` module.  Results are cached for 1 hour so the check
 * does not hammer DNS / TLS on every request.
 */

import * as tls from "tls";

export interface CertExpiryResult {
  domain: string;
  expiresAt: string;          // ISO-8601 date string
  daysRemaining: number;
  status: "ok" | "warning" | "critical";
}

interface CacheEntry {
  result: CertExpiryResult;
  cachedAt: number;           // Date.now() ms
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const cache = new Map<string, CacheEntry>();

/**
 * Return the number of whole days between now and the given date.
 * Negative values mean the date is in the past.
 */
function daysUntil(date: Date): number {
  const msRemaining = date.getTime() - Date.now();
  return Math.floor(msRemaining / (1000 * 60 * 60 * 24));
}

/**
 * Classify the remaining days into a status label.
 *  >= 30 days → ok
 *  < 30 days  → warning
 *  <= 0 days  → critical
 */
function classify(days: number): CertExpiryResult["status"] {
  if (days <= 0) return "critical";
  if (days < 30) return "warning";
  return "ok";
}

/**
 * Connect to `hostname` on port 443 and extract the peer certificate's
 * `valid_to` field.  Rejects if the connection fails or no certificate is
 * returned.
 */
function fetchCertExpiry(hostname: string): Promise<Date> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      { host: hostname, port: 443, servername: hostname },
      () => {
        const cert = socket.getPeerCertificate();
        socket.destroy();

        if (!cert || !cert.valid_to) {
          return reject(new Error(`No certificate returned for ${hostname}`));
        }

        const expiryDate = new Date(cert.valid_to);
        if (isNaN(expiryDate.getTime())) {
          return reject(
            new Error(`Unparseable valid_to field: ${cert.valid_to}`)
          );
        }

        resolve(expiryDate);
      }
    );

    socket.on("error", (err) => {
      socket.destroy();
      reject(err);
    });

    // Safety timeout so we never hang indefinitely
    socket.setTimeout(10_000, () => {
      socket.destroy();
      reject(new Error(`TLS connection to ${hostname} timed out`));
    });
  });
}

/**
 * Public API.  Returns a `CertExpiryResult` for the given hostname, using a
 * 1-hour in-memory cache to avoid excessive TLS handshakes.
 */
export async function getCertExpiry(hostname: string): Promise<CertExpiryResult> {
  const now = Date.now();
  const cached = cache.get(hostname);

  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return cached.result;
  }

  const expiryDate = await fetchCertExpiry(hostname);
  const daysRemaining = daysUntil(expiryDate);

  const result: CertExpiryResult = {
    domain: hostname,
    expiresAt: expiryDate.toISOString(),
    daysRemaining,
    status: classify(daysRemaining),
  };

  cache.set(hostname, { result, cachedAt: now });
  return result;
}
