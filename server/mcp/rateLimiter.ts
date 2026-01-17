interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimiterConfig {
  windowMs: number;
  maxRequests: number;
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  windowMs: 60 * 1000, // 1 minute window
  maxRequests: 60, // 60 requests per minute per tenant
};

const tokenExchangeConfig: RateLimiterConfig = {
  windowMs: 60 * 1000, // 1 minute window
  maxRequests: 10, // 10 token exchanges per minute per IP
};

const rateLimitStore = new Map<string, RateLimitEntry>();

function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

setInterval(cleanupExpiredEntries, 60 * 1000);

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

export function checkRateLimit(
  identifier: string,
  config: RateLimiterConfig = DEFAULT_CONFIG
): RateLimitResult {
  const now = Date.now();
  const key = identifier;
  
  let entry = rateLimitStore.get(key);
  
  if (!entry || entry.resetAt <= now) {
    entry = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    rateLimitStore.set(key, entry);
    
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: entry.resetAt,
      limit: config.maxRequests,
    };
  }
  
  entry.count += 1;
  
  if (entry.count > config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      limit: config.maxRequests,
    };
  }
  
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
    limit: config.maxRequests,
  };
}

export function checkMcpRateLimit(tenantId: string): RateLimitResult {
  return checkRateLimit(`mcp:tenant:${tenantId}`, DEFAULT_CONFIG);
}

export function checkTokenExchangeRateLimit(ipAddress: string): RateLimitResult {
  return checkRateLimit(`mcp:token:${ipAddress}`, tokenExchangeConfig);
}

export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetAt / 1000).toString(),
  };
}
