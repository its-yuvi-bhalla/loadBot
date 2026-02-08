/**
 * Safety guardrails: block localhost/private IPs and rate-limit outgoing requests.
 */

/** Regex to detect localhost and loopback. */
const LOCALHOST_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i;

/** Private IP ranges (CIDR-style check via regex for common cases). */
const PRIVATE_IP_REGEX = /^https?:\/\/(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/i;

/**
 * Returns true if the URL is allowed. Blocks localhost and private IPs.
 */
export function isUrlAllowed(url: string): boolean {
  try {
    const u = url.trim();
    if (!u.startsWith("http://") && !u.startsWith("https://")) return false;
    if (LOCALHOST_REGEX.test(u)) return false;
    if (PRIVATE_IP_REGEX.test(u)) return false;
    new URL(u);
    return true;
  } catch {
    return false;
  }
}

/**
 * Human-readable reason when URL is blocked.
 */
export function getUrlBlockReason(url: string): string | null {
  if (!url.trim()) return "URL is required.";
  try {
    const u = url.trim();
    if (!u.startsWith("http://") && !u.startsWith("https://"))
      return "URL must use http:// or https://.";
    if (LOCALHOST_REGEX.test(u))
      return "Localhost and loopback addresses are not allowed.";
    if (PRIVATE_IP_REGEX.test(u))
      return "Private IP ranges are not allowed.";
    return null;
  } catch {
    return "Invalid URL.";
  }
}

/** Global rate limit: max requests per second across all running tests. */
const GLOBAL_RATE_LIMIT_RPS = 500;

/** Track recent request timestamps for rate limiting (simple in-memory sliding window). */
const recentRequestTimestamps: number[] = [];
const WINDOW_MS = 1000;

/**
 * Returns true if one more request is allowed under the global rate limit.
 */
export function checkRateLimit(): boolean {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  while (recentRequestTimestamps.length > 0 && recentRequestTimestamps[0] < cutoff) {
    recentRequestTimestamps.shift();
  }
  return recentRequestTimestamps.length < GLOBAL_RATE_LIMIT_RPS;
}

/**
 * Record that a request was sent (call from engine when firing a request).
 */
export function recordRequestSent(): void {
  recentRequestTimestamps.push(Date.now());
}
