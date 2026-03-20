<script setup lang="ts">
const route = useRoute();

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
        "This test environment was asleep and the database is still resuming from auto-pause. Wait a few seconds, then start sign-in again to get a fresh OAuth code.",
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

  return {
    title: "Sign-In Failed",
    body:
      "The sign-in flow did not complete. Try again, and if the problem persists check the server logs for the auth callback.",
    actionLabel: "Back to login",
  };
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
