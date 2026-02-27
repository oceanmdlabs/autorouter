import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import { createHash, timingSafeEqual } from "node:crypto";
import type { H3Event } from "h3";

const TOKEN_ATTEMPTS_WINDOW_MS = 5 * 60 * 1000;
const TOKEN_ATTEMPTS_MAX = 30;
const failedAttemptsByIp = new Map<string, { count: number; resetAt: number }>();

export default defineEventHandler(async (event) => {
  enforceTokenRateLimit(event);
  const body = await readBody(event);
  const cxt = await toApplicationContext(event);
  if (!body?.client_id || !body?.client_secret) {
    registerFailedTokenAttempt(event);
    throwInvalidClientError();
  }
  const siteConfig = await cxt
    .getSiteConfigurationRepository()
    .findByClientId(body.client_id);
  const cryptoService = cxt.getCryptoService();
  const isValid = secureSecretMatch(
    siteConfig?.clientSecret ?? "",
    body.client_secret
  );
  if (!isValid) {
    registerFailedTokenAttempt(event);
    throwInvalidClientError();
  }

  const accessToken = cryptoService.generateJWT({
    sub: siteConfig!.id,
    clientId: siteConfig!.clientId,
    tenantId: siteConfig!.tenantId,
    iat: Math.floor(Date.now() / 1000),
  });

  clearTokenRateLimit(event);
  await cxt.getSiteConfigurationRepository().update({
    id: siteConfig!.id,
    lastSuccessfulConnection: new Date(),
  });
  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 3600,
  };
});

function secureSecretMatch(expected: string, provided: string): boolean {
  const expectedHash = createHash("sha256").update(expected).digest();
  const providedHash = createHash("sha256").update(provided).digest();
  return timingSafeEqual(expectedHash, providedHash);
}

function getTokenAttemptKey(event: H3Event): string {
  return getRequestIP(event, { xForwardedFor: true }) ?? "unknown";
}

function enforceTokenRateLimit(event: H3Event): void {
  const key = getTokenAttemptKey(event);
  const now = Date.now();
  const attempt = failedAttemptsByIp.get(key);
  if (!attempt || now > attempt.resetAt) {
    failedAttemptsByIp.set(key, { count: 0, resetAt: now + TOKEN_ATTEMPTS_WINDOW_MS });
    return;
  }
  if (attempt.count >= TOKEN_ATTEMPTS_MAX) {
    throw createError({
      statusCode: 429,
      statusMessage: "Too many token requests",
    });
  }
}

function registerFailedTokenAttempt(event: H3Event): void {
  const key = getTokenAttemptKey(event);
  const now = Date.now();
  const existing = failedAttemptsByIp.get(key);
  if (!existing || now > existing.resetAt) {
    failedAttemptsByIp.set(key, { count: 1, resetAt: now + TOKEN_ATTEMPTS_WINDOW_MS });
    return;
  }
  existing.count += 1;
  failedAttemptsByIp.set(key, existing);
}

function clearTokenRateLimit(event: H3Event): void {
  const key = getTokenAttemptKey(event);
  failedAttemptsByIp.delete(key);
}

function throwInvalidClientError(): never {
  throw createError({
    statusCode: 401,
    statusMessage: "Invalid client credentials",
  });
}
