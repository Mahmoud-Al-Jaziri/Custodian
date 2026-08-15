import crypto from "node:crypto";

// Shared-secret auth for endpoints called by machines rather than users: the
// hourly reminder dispatch (GitHub Actions) and the Sentry smoke-test route.
//
// Extracted so there is exactly one implementation of this check. A second,
// subtly different copy of a security comparison is how the two drift apart.

// Constant-time comparison, so a wrong secret can't be recovered by timing the
// response one character at a time.
export function safeEqual(a, b) {
  const bufA = Buffer.from(String(a || ""));
  const bufB = Buffer.from(String(b || ""));
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

// True only when the request carries the scheduler's shared secret.
//
// The Boolean(secret) guard is load-bearing: without it, an environment that
// forgot to set CRON_SECRET would compare undefined against a missing header,
// both coerce to "", and every unauthenticated request would be accepted.
export function hasCronSecret(req) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && safeEqual(req.get("x-cron-secret"), secret);
}
