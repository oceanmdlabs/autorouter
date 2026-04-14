import {
  getInviteAuthReasonFromMessage,
  type InviteAuthFailureReason,
} from "@/shared/invite-access";

type RetryOptions = {
  maxAttempts?: number;
  delayMs?: number;
};

function getErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return "";
  }

  const maybeError = error as {
    message?: unknown;
    statusMessage?: unknown;
    error_description?: unknown;
  };

  if (typeof maybeError.message === "string") {
    return maybeError.message;
  }

  if (typeof maybeError.statusMessage === "string") {
    return maybeError.statusMessage;
  }

  if (typeof maybeError.error_description === "string") {
    return maybeError.error_description;
  }

  return "";
}

function getErrorName(error: unknown) {
  if (!error || typeof error !== "object") {
    return "";
  }

  const maybeError = error as { name?: unknown };
  return typeof maybeError.name === "string" ? maybeError.name : "";
}

function getErrorCause(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const maybeError = error as { cause?: unknown; data?: unknown };
  return maybeError.cause ?? maybeError.data ?? null;
}

export function isDatabaseResumingError(error: unknown): boolean {
  let current: unknown = error;

  for (let depth = 0; depth < 5 && current; depth += 1) {
    const name = getErrorName(current);
    const message = getErrorMessage(current);

    if (
      name === "DatabaseResumingException" ||
      message.includes("DatabaseResumingException") ||
      message.includes("is resuming after being auto-paused")
    ) {
      return true;
    }

    current = getErrorCause(current);
  }

  return false;
}

export function isExpiredOAuthCodeError(error: unknown): boolean {
  let current: unknown = error;

  for (let depth = 0; depth < 5 && current; depth += 1) {
    const message = getErrorMessage(current);

    if (
      message.includes("invalid_grant") ||
      message.includes("bad_verification_code") ||
      message.includes("incorrect or expired")
    ) {
      return true;
    }

    current = getErrorCause(current);
  }

  return false;
}

export function getInviteAuthFailureReason(
  error: unknown
): InviteAuthFailureReason | null {
  let current: unknown = error;

  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (current && typeof current === "object") {
      const maybeError = current as {
        message?: unknown;
        statusMessage?: unknown;
      };

      for (const candidate of [maybeError.statusMessage, maybeError.message]) {
        if (typeof candidate === "string") {
          const reason = getInviteAuthReasonFromMessage(candidate);
          if (reason) {
            return reason;
          }
        }
      }
    }

    current = getErrorCause(current);
  }

  return null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withDatabaseResumeRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
) {
  // Aurora resume typically takes around 15 seconds, so auth should wait long
  // enough for the common case instead of immediately bouncing the user back
  // into another OAuth round-trip.
  const maxAttempts = options.maxAttempts ?? 5;
  const delayMs = options.delayMs ?? 2000;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isDatabaseResumingError(error) || attempt === maxAttempts) {
        throw error;
      }

      console.warn(
        `Database is resuming from auto-pause during auth flow; retrying (${attempt}/${maxAttempts})`
      );
      await sleep(delayMs * attempt);
    }
  }

  throw new Error("Database resume retry exhausted");
}

export function buildAuthErrorRedirect(args: {
  provider: "google" | "github";
  error: unknown;
}) {
  const params = new URLSearchParams({
    provider: args.provider,
  });

  if (isDatabaseResumingError(args.error)) {
    params.set("reason", "database-resuming");
    return `/login?${params.toString()}`;
  }

  if (isExpiredOAuthCodeError(args.error)) {
    params.set("reason", "oauth-code-expired");
    return `/error?${params.toString()}`;
  }

  const inviteAuthFailureReason = getInviteAuthFailureReason(args.error);
  if (inviteAuthFailureReason) {
    params.set("reason", inviteAuthFailureReason);
    return `/error?${params.toString()}`;
  }

  params.set("reason", "oauth-failed");
  return `/error?${params.toString()}`;
}
