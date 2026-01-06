/**
 * STABILITY & PERFORMANCE: Rate limiter and request deduplication utilities
 * 
 * Provides:
 * - Token bucket rate limiting per user/tenant
 * - Request deduplication to prevent concurrent identical requests
 * - Configurable limits for different operation types
 */

interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
}

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

// Rate limit configuration per feature
export const RATE_LIMITS = {
  // AI Chat: 30 requests per minute per user
  AI_CHAT: { maxTokens: 30, refillRate: 30, windowMs: 60 * 1000 },
  // AI Suggestions: 10 requests per minute per user
  AI_SUGGESTION: { maxTokens: 10, refillRate: 10, windowMs: 60 * 1000 },
  // AI Heavy operations (meeting recap, quality scoring): 5 per minute
  AI_HEAVY: { maxTokens: 5, refillRate: 5, windowMs: 60 * 1000 },
  // General API: 100 requests per minute per user
  API_GENERAL: { maxTokens: 100, refillRate: 100, windowMs: 60 * 1000 },
} as const;

export type RateLimitType = keyof typeof RATE_LIMITS;

/**
 * Token bucket rate limiter with configurable limits per user/tenant
 */
export class RateLimiter {
  private buckets = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up stale entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    this.cleanupInterval.unref();
  }

  /**
   * Check if a request is allowed and consume a token if so
   * @returns true if request is allowed, false if rate limited
   */
  checkLimit(key: string, limitType: RateLimitType): boolean {
    const config = RATE_LIMITS[limitType];
    const now = Date.now();
    const bucketKey = `${limitType}:${key}`;
    
    let entry = this.buckets.get(bucketKey);
    
    if (!entry) {
      // New bucket - start with full tokens
      entry = { tokens: config.maxTokens, lastRefill: now };
      this.buckets.set(bucketKey, entry);
    } else {
      // Refill tokens based on elapsed time
      const elapsed = now - entry.lastRefill;
      const tokensToAdd = (elapsed / config.windowMs) * config.refillRate;
      entry.tokens = Math.min(config.maxTokens, entry.tokens + tokensToAdd);
      entry.lastRefill = now;
    }
    
    if (entry.tokens >= 1) {
      entry.tokens -= 1;
      return true;
    }
    
    return false;
  }

  /**
   * Get remaining tokens for a key
   */
  getRemainingTokens(key: string, limitType: RateLimitType): number {
    const config = RATE_LIMITS[limitType];
    const bucketKey = `${limitType}:${key}`;
    const entry = this.buckets.get(bucketKey);
    
    if (!entry) return config.maxTokens;
    
    // Calculate current tokens with refill
    const elapsed = Date.now() - entry.lastRefill;
    const tokensToAdd = (elapsed / config.windowMs) * config.refillRate;
    return Math.min(config.maxTokens, Math.floor(entry.tokens + tokensToAdd));
  }

  /**
   * Get time until rate limit resets (in ms)
   */
  getResetTime(key: string, limitType: RateLimitType): number {
    const config = RATE_LIMITS[limitType];
    const remaining = this.getRemainingTokens(key, limitType);
    
    if (remaining >= 1) return 0;
    
    // Calculate time to get 1 token back
    return Math.ceil(config.windowMs / config.refillRate);
  }

  private cleanup(): void {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes
    
    // Use Array.from for ES5 compatibility
    const entries = Array.from(this.buckets.entries());
    for (const [key, entry] of entries) {
      if (now - entry.lastRefill > maxAge) {
        this.buckets.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.buckets.clear();
  }
}

/**
 * Request deduplicator to prevent concurrent identical requests
 * Useful for expensive operations like AI calls
 */
export class RequestDeduplicator {
  private pending = new Map<string, PendingRequest<any>>();
  private maxAge = 30 * 1000; // 30 seconds max for pending requests
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up stale requests every 30 seconds
    this.cleanupInterval = setInterval(() => this.cleanup(), 30 * 1000);
    this.cleanupInterval.unref();
  }

  /**
   * Execute a function with deduplication
   * If an identical request is already in flight, return its promise instead of executing again
   * 
   * @param key Unique key for this request (e.g., hash of parameters)
   * @param fn Function to execute if not already in flight
   */
  async dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const existing = this.pending.get(key);
    
    // If there's an existing request that's not too old, return its promise
    if (existing && now - existing.timestamp < this.maxAge) {
      return existing.promise;
    }
    
    // Execute the function and store the promise
    const promise = fn().finally(() => {
      // Clean up after completion (with small delay to handle rapid re-requests)
      setTimeout(() => {
        const current = this.pending.get(key);
        if (current && current.promise === promise) {
          this.pending.delete(key);
        }
      }, 100);
    });
    
    this.pending.set(key, { promise, timestamp: now });
    return promise;
  }

  /**
   * Create a cache key from request parameters
   */
  static createKey(...parts: (string | number | object | undefined)[]): string {
    return parts
      .map(p => {
        if (p === undefined) return '';
        if (typeof p === 'object') return JSON.stringify(p);
        return String(p);
      })
      .join(':');
  }

  private cleanup(): void {
    const now = Date.now();
    
    // Use Array.from for ES5 compatibility
    const entries = Array.from(this.pending.entries());
    for (const [key, entry] of entries) {
      if (now - entry.timestamp > this.maxAge) {
        this.pending.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.pending.clear();
  }
}

// Global instances
export const rateLimiter = new RateLimiter();
export const requestDeduplicator = new RequestDeduplicator();

/**
 * Express middleware factory for rate limiting
 */
export function rateLimitMiddleware(limitType: RateLimitType) {
  return (req: any, res: any, next: any) => {
    const userId = req.user?.id || req.session?.userId || req.ip || 'anonymous';
    
    if (!rateLimiter.checkLimit(userId, limitType)) {
      const resetMs = rateLimiter.getResetTime(userId, limitType);
      res.setHeader('Retry-After', Math.ceil(resetMs / 1000));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', Date.now() + resetMs);
      
      return res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded. Please try again in ${Math.ceil(resetMs / 1000)} seconds.`,
        retryAfter: Math.ceil(resetMs / 1000),
      });
    }
    
    // Add rate limit headers
    const remaining = rateLimiter.getRemainingTokens(userId, limitType);
    res.setHeader('X-RateLimit-Remaining', remaining);
    
    next();
  };
}
