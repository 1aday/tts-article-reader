// Simple in-memory rate limiting using LRU cache
// For production, replace with @upstash/ratelimit + Vercel KV

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class InMemoryRateLimit {
  private cache = new Map<string, RateLimitEntry>();
  private maxRequests: number;
  private windowMs: number;
  private prefix: string;

  constructor(maxRequests: number, windowMs: number, prefix: string) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.prefix = prefix;

    // Clean up old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  async limit(identifier: string): Promise<{
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
  }> {
    const key = `${this.prefix}:${identifier}`;
    const now = Date.now();
    const entry = this.cache.get(key);

    // If no entry or window expired, create new
    if (!entry || now >= entry.resetAt) {
      const resetAt = now + this.windowMs;
      this.cache.set(key, { count: 1, resetAt });
      return {
        success: true,
        limit: this.maxRequests,
        remaining: this.maxRequests - 1,
        reset: resetAt,
      };
    }

    // Check if limit exceeded
    if (entry.count >= this.maxRequests) {
      return {
        success: false,
        limit: this.maxRequests,
        remaining: 0,
        reset: entry.resetAt,
      };
    }

    // Increment count
    entry.count++;
    this.cache.set(key, entry);
    return {
      success: true,
      limit: this.maxRequests,
      remaining: this.maxRequests - entry.count,
      reset: entry.resetAt,
    };
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now >= entry.resetAt) {
        this.cache.delete(key);
      }
    }
  }
}

// Rate limit instances
export const rateLimits = {
  scrape: new InMemoryRateLimit(10, 60 * 60 * 1000, "ratelimit:scrape"), // 10 per hour
  generate: new InMemoryRateLimit(5, 60 * 60 * 1000, "ratelimit:generate"), // 5 per hour
  preview: new InMemoryRateLimit(20, 60 * 60 * 1000, "ratelimit:preview"), // 20 per hour
};

// Helper to get client IP
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") || "unknown";
}

// Helper to format rate limit error message
export function formatRateLimitError(reset: number): string {
  const minutesRemaining = Math.ceil((reset - Date.now()) / 60000);
  return `Rate limit exceeded. Try again in ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}.`;
}
