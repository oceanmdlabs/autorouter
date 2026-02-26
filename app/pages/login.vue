<script setup lang="ts">
definePageMeta({
  layout: false
})

const lastProvider = ref('')

onMounted(() => {
  lastProvider.value = localStorage.getItem('lastAuthProvider') || ''
})

const setLastProvider = (provider: string) => {
  localStorage.setItem('lastAuthProvider', provider)
}
</script>
<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
      <div class="text-center">
        <img src="/autorouter-logo.png" alt="AutoRouter Logo" class="h-12 mx-auto mb-4" />
        <h2 class="mt-6 text-3xl font-extrabold text-gray-900">Sign in to your account</h2>
      </div>
      <div class="mt-8 space-y-4">
        <a href="/auth/google" @click="setLastProvider('google')"
          class="relative w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
          <Icon name="mdi:google" class="h-5 w-5 mr-2" />
          Sign in with Google
          <span v-if="lastProvider === 'google'"
            class="absolute right-2 bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded">LAST</span>
        </a>
        <a href="/auth/github"
          class="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
          <Icon name="mdi:github" class="h-5 w-5 mr-2" />
          Sign in with GitHub
        </a>
      </div>
    </div>
  </div>
</template>