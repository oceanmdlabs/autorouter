<script setup lang="ts">
definePageMeta({
  layout: false
})

type Provider = 'google' | 'github'

const route = useRoute()
const lastProvider = ref<'google' | 'github' | ''>('')
const warmupState = ref<'warming' | 'ready' | 'error'>('warming')
const warmupError = ref('')
const providerFromQuery = computed(() =>
  typeof route.query.provider === 'string' ? route.query.provider : 'sign-in'
)
const showResumeNotice = computed(() => route.query.reason === 'database-resuming')

let warmupPromise: Promise<void> | null = null
let warmupRetryTimer: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  const provider = localStorage.getItem('lastAuthProvider')
  lastProvider.value = provider === 'google' || provider === 'github' ? provider : ''
  void ensureDatabaseReady()
})

const setLastProvider = (provider: 'google' | 'github') => {
  localStorage.setItem('lastAuthProvider', provider)
}

const warmupCopy = computed(() => {
  if (warmupState.value === 'ready') {
    return {
      title: showResumeNotice.value ? 'Database ready again' : 'Ready to sign in',
      body: showResumeNotice.value
        ? `The database has resumed after inactivity. You can sign in with ${providerFromQuery.value} again now.`
        : 'The database is awake. Sign-in should complete normally.',
      tone: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    }
  }

  if (warmupState.value === 'error') {
    return {
      title: 'Unable to confirm database readiness',
      body:
        warmupError.value ||
        'The readiness check failed. Try again in a few seconds, then start sign-in once the database is available.',
      tone: 'border-amber-200 bg-amber-50 text-amber-900',
    }
  }

  return {
    title: showResumeNotice.value ? 'Database starting up' : 'Checking database status',
    body: showResumeNotice.value
      ? `This environment was idle, so the database is starting up now. Sign-in will unlock once it finishes resuming, which usually takes around 15 to 30 seconds.`
      : 'This page is waking the database in the background before sign-in starts. If it was auto-paused, this usually takes around 15 to 30 seconds.',
    tone: 'border-blue-200 bg-blue-50 text-blue-900',
  }
})

async function ensureDatabaseReady() {
  if (warmupPromise) {
    return warmupPromise
  }

  if (warmupRetryTimer) {
    clearTimeout(warmupRetryTimer)
    warmupRetryTimer = null
  }

  warmupPromise = (async () => {
    warmupState.value = 'warming'
    warmupError.value = ''

    try {
      const response = await $fetch<{
        ready: boolean
        status?: 'resuming'
        retryAfterSeconds?: number
      }>('/api/auth/prewarm', {
        method: 'POST',
      })

      if (response.ready) {
        warmupState.value = 'ready'
        return
      }

      warmupState.value = 'warming'
      warmupRetryTimer = setTimeout(() => {
        void ensureDatabaseReady()
      }, (response.retryAfterSeconds ?? 5) * 1000)
    } catch (error) {
      warmupState.value = 'error'
      warmupError.value =
        error instanceof Error ? error.message : 'The database check failed unexpectedly.'
    } finally {
      warmupPromise = null
    }
  })()

  return warmupPromise
}

async function handleSignIn(provider: Provider) {
  setLastProvider(provider)

  if (warmupState.value !== 'ready') {
    await ensureDatabaseReady()
  }

  if (warmupState.value !== 'ready') {
    return
  }

  window.location.assign(`/auth/${provider}`)
}

onBeforeUnmount(() => {
  if (warmupRetryTimer) {
    clearTimeout(warmupRetryTimer)
  }
})
</script>
<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
      <div class="text-center">
        <img src="/ocean-labs-logo.svg" alt="Ocean Labs Logo" class="h-12 w-auto mx-auto mb-4" />
        <h2 class="mt-6 text-3xl font-extrabold text-gray-900">Autorouter</h2>
      </div>
      <div class="rounded-lg border px-4 py-3" :class="warmupCopy.tone">
        <p class="text-sm font-semibold">{{ warmupCopy.title }}</p>
        <p class="mt-1 text-sm leading-6">{{ warmupCopy.body }}</p>
      </div>
      <div class="mt-8 space-y-4">
        <button
          type="button"
          :disabled="warmupState !== 'ready'"
          @click="handleSignIn('google')"
          class="relative w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium bg-white"
          :class="warmupState === 'ready' ? 'text-gray-700 hover:bg-gray-50' : 'cursor-not-allowed text-gray-400'"
        >
          <Icon name="mdi:google" class="h-5 w-5 mr-2" />
          {{ warmupState === 'ready' ? 'Sign in with Google' : 'Starting database...' }}
          <span v-if="lastProvider === 'google'"
            class="absolute right-2 bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded">LAST</span>
        </button>
        <button
          type="button"
          :disabled="warmupState !== 'ready'"
          @click="handleSignIn('github')"
          class="relative w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium bg-white"
          :class="warmupState === 'ready' ? 'text-gray-700 hover:bg-gray-50' : 'cursor-not-allowed text-gray-400'"
        >
          <Icon name="mdi:github" class="h-5 w-5 mr-2" />
          {{ warmupState === 'ready' ? 'Sign in with GitHub' : 'Starting database...' }}
          <span v-if="lastProvider === 'github'"
            class="absolute right-2 bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded">LAST</span>
        </button>
      </div>
      <div v-if="warmupState === 'error'" class="text-center">
        <button
          type="button"
          class="text-sm font-medium text-gray-700 underline underline-offset-4"
          @click="ensureDatabaseReady"
        >
          Retry database check
        </button>
      </div>
    </div>
  </div>
</template>
