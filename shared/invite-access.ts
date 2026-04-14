export const PENDING_INVITE_CODE_COOKIE = "pendingInviteCode";
export const PENDING_INVITE_CODE_STORAGE_KEY = "pendingInviteCode";

export const inviteAuthFailureReasons = [
  "invite-required",
  "invite-not-found",
  "invite-redeemed",
  "invite-revoked",
  "invite-expired",
] as const;

export type InviteAuthFailureReason =
  (typeof inviteAuthFailureReasons)[number];

const inviteAuthStatusMessageByReason: Record<
  InviteAuthFailureReason,
  string
> = {
  "invite-required":
    "You need an active site invite before signing in.",
  "invite-not-found":
    "The invite code linked to this sign-in was not found.",
  "invite-redeemed":
    "The invite code linked to this sign-in has already been redeemed.",
  "invite-revoked":
    "The invite code linked to this sign-in has been revoked.",
  "invite-expired":
    "The invite code linked to this sign-in has expired.",
};

export function isInviteAuthFailureReason(
  value: string | null | undefined
): value is InviteAuthFailureReason {
  return Boolean(
    value && inviteAuthFailureReasons.includes(value as InviteAuthFailureReason)
  );
}

export function getInviteAuthStatusMessage(reason: InviteAuthFailureReason) {
  return inviteAuthStatusMessageByReason[reason];
}

export function getInviteAuthReasonFromMessage(message: string) {
  return (
    inviteAuthFailureReasons.find(
      (reason) => inviteAuthStatusMessageByReason[reason] === message
    ) ?? null
  );
}
