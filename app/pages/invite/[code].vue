<script setup lang="ts">
definePageMeta({
  layout: false
})

const route = useRoute()
const { loggedIn } = useUserSession()
const code = route.params.code?.toString() ?? ''

onMounted(() => {
  if (code) {
    localStorage.setItem('pendingInviteCode', code)
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
