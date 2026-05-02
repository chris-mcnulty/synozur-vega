// Validates a JWKS URI submitted by a tenant admin (galaxySettings.jwksUri)
// to prevent SSRF: must be https, hostname must not resolve to a loopback,
// link-local, or private IP range. An optional allowlist of hostnames may
// be supplied via GALAXY_JWKS_ALLOWED_HOSTS (comma-separated).

import { lookup } from 'dns/promises';
import { isIP } from 'net';

const ALLOWED_HOSTS = (process.env.GALAXY_JWKS_ALLOWED_HOSTS || '')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

function isPrivateIp(ip: string): boolean {
  if (ip === '::1' || ip === '0.0.0.0') return true;
  if (ip.startsWith('127.') || ip.startsWith('10.') || ip.startsWith('169.254.')) return true;
  if (ip.startsWith('192.168.')) return true;
  // 172.16.0.0 – 172.31.255.255
  const m = ip.match(/^172\.(\d+)\./);
  if (m) {
    const second = Number(m[1]);
    if (second >= 16 && second <= 31) return true;
  }
  // IPv6 unique-local + link-local
  const lower = ip.toLowerCase();
  if (lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:')) return true;
  return false;
}

export async function assertSafeJwksUri(raw: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('galaxySettings.jwksUri must be a valid URL');
  }
  if (url.protocol !== 'https:') {
    throw new Error('galaxySettings.jwksUri must use https');
  }
  const host = url.hostname.toLowerCase();
  if (!host || host === 'localhost') {
    throw new Error('galaxySettings.jwksUri host is not allowed');
  }
  if (ALLOWED_HOSTS.length > 0 && !ALLOWED_HOSTS.includes(host)) {
    throw new Error(`galaxySettings.jwksUri host '${host}' is not in GALAXY_JWKS_ALLOWED_HOSTS`);
  }

  const ipsToCheck: string[] = [];
  if (isIP(host)) {
    ipsToCheck.push(host);
  } else {
    const resolved = await lookup(host, { all: true });
    for (const r of resolved) ipsToCheck.push(r.address);
  }
  for (const ip of ipsToCheck) {
    if (isPrivateIp(ip)) {
      throw new Error(`galaxySettings.jwksUri resolves to a non-public address (${ip})`);
    }
  }
}
