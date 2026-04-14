<script setup lang="ts">
import {
  PENDING_INVITE_CODE_COOKIE,
  PENDING_INVITE_CODE_STORAGE_KEY,
} from "@/shared/invite-access"

definePageMeta({
  layout: false
})

const route = useRoute()
const { loggedIn } = useUserSession()
const code = route.params.code?.toString() ?? ''
const pendingInviteCookie = useCookie<string | null>(PENDING_INVITE_CODE_COOKIE, {
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 7,
})

onMounted(() => {
  if (code) {
    pendingInviteCookie.value = code
    localStorage.setItem(PENDING_INVITE_CODE_STORAGE_KEY, code)
  }

  if (loggedIn.value) {
    navigateTo(`/portal/sites?code=${encodeURIComponent(code)}`)
    return
  }

  navigateTo('/login')
})
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-sm text-slate-600">
    Redirecting to redeem invite...
  </div>
</template>
