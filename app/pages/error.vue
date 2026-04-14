<script setup lang="ts">
import {
  PENDING_INVITE_CODE_COOKIE,
  PENDING_INVITE_CODE_STORAGE_KEY,
  isInviteAuthFailureReason,
} from "@/shared/invite-access"

const route = useRoute();
const pendingInviteCookie = useCookie<string | null>(PENDING_INVITE_CODE_COOKIE);

const reason = computed(() =>
  typeof route.query.reason === "string" ? route.query.reason : "oauth-failed"
);
const provider = computed(() =>
  typeof route.query.provider === "string" ? route.query.provider : "sign-in"
);

const pageCopy = computed(() => {
  if (reason.value === "database-resuming") {
    return {
      title: "Database Waking Up",
      body:
        "The database is resuming from auto-pause. Return to the login page and wait for the readiness check to finish before starting sign-in again.",
      actionLabel: "Back to login",
    };
  }

  if (reason.value === "oauth-code-expired") {
    return {
      title: "Login Link Expired",
      body:
        "The OAuth callback code is no longer valid. This usually happens after a failed first attempt or if the provider callback was reused. Start sign-in again to generate a fresh code.",
      actionLabel: "Try sign-in again",
    };
  }

  if (reason.value === "invite-required") {
    return {
      title: "Invite Required",
      body:
        "This app only allows users with an active site membership or a valid invite. Enter an invite code on the login page or use a redeemable invite link before signing in.",
      actionLabel: "Back to login",
    };
  }

  if (reason.value === "invite-not-found") {
    return {
      title: "Invite Not Found",
      body:
        "The invite attached to this sign-in could not be found. Ask a site admin for a new invite code or link, then try again.",
      actionLabel: "Back to login",
    };
  }

  if (reason.value === "invite-redeemed") {
    return {
      title: "Invite Already Used",
      body:
        "That invite has already been redeemed. Ask a site admin for a new invite if this account still needs access.",
      actionLabel: "Back to login",
    };
  }

  if (reason.value === "invite-revoked") {
    return {
      title: "Invite Revoked",
      body:
        "That invite is no longer active. Ask a site admin for a replacement invite before trying again.",
      actionLabel: "Back to login",
    };
  }

  if (reason.value === "invite-expired") {
    return {
      title: "Invite Expired",
      body:
        "That invite has expired. Ask a site admin to issue a new invite code or redeemable link before signing in again.",
      actionLabel: "Back to login",
    };
  }

  return {
    title: "Sign-In Failed",
    body:
      "The sign-in flow did not complete. Try again, and if the problem persists check the server logs for the auth callback.",
    actionLabel: "Back to login",
  };
});

onMounted(() => {
  if (!isInviteAuthFailureReason(reason.value)) {
    return;
  }

  pendingInviteCookie.value = null;
  localStorage.removeItem(PENDING_INVITE_CODE_STORAGE_KEY);
});
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 px-6">
    <div class="max-w-lg w-full rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
      <div class="mb-6 text-center">
        <img
          src="/ocean-labs-logo.svg"
          alt="Ocean Labs Logo"
          class="mx-auto mb-4 h-12 w-auto"
        />
        <p class="text-sm font-medium uppercase tracking-[0.18em] text-gray-500">
          {{ provider }}
        </p>
        <h1 class="mt-2 text-3xl font-bold text-gray-900">
          {{ pageCopy.title }}
        </h1>
      </div>

      <p class="text-base leading-7 text-gray-700">
        {{ pageCopy.body }}
      </p>

      <div class="mt-8 flex justify-center">
        <NuxtLink
          to="/login"
          class="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          {{ pageCopy.actionLabel }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
