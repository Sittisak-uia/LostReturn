import { NextResponse } from 'next/server';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

// Global in-memory storage for rate limits
const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup stale entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      if (now > record.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

/**
 * Extract client IP from standard Next.js / Cloudflare / Proxy headers
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const ip = forwarded.split(',')[0].trim();
    if (ip) return ip;
  }

  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  return '127.0.0.1';
}

export interface RateLimitOptions {
  limit: number;     // Maximum allowed requests
  windowMs: number;  // Time window in milliseconds (e.g. 60,000 for 1 minute)
  prefix?: string;   // Scope/route identifier
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Check if the current request is within rate limits.
 */
export function checkRateLimit(req: Request, options: RateLimitOptions): RateLimitResult {
  const ip = getClientIp(req);
  const prefix = options.prefix || 'global';
  const key = `${prefix}:${ip}`;
  const now = Date.now();

  let record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    record = {
      count: 1,
      resetTime: now + options.windowMs,
    };
    rateLimitStore.set(key, record);
    return {
      allowed: true,
      limit: options.limit,
      remaining: options.limit - 1,
      reset: Math.ceil((record.resetTime - now) / 1000),
    };
  }

  record.count += 1;

  if (record.count > options.limit) {
    return {
      allowed: false,
      limit: options.limit,
      remaining: 0,
      reset: Math.ceil((record.resetTime - now) / 1000),
    };
  }

  return {
    allowed: true,
    limit: options.limit,
    remaining: options.limit - record.count,
    reset: Math.ceil((record.resetTime - now) / 1000),
  };
}

/**
 * Convenience helper to return a standard 429 Too Many Requests response
 */
export function rateLimitExceededResponse(resetSeconds: number, customMessage?: string) {
  return NextResponse.json(
    {
      error: 'Too Many Requests',
      message: customMessage || `คำขอมากเกินไป กรุณารอ ${resetSeconds} วินาทีก่อนลองใหม่`,
      retryAfter: resetSeconds,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(resetSeconds),
      },
    }
  );
}
