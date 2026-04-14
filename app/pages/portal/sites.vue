<script setup lang="ts">
import {
  PENDING_INVITE_CODE_COOKIE,
  PENDING_INVITE_CODE_STORAGE_KEY,
} from "@/shared/invite-access"

const route = useRoute()
const router = useRouter()
const { user, fetch } = useUserSession()
const pendingInviteCookie = useCookie<string | null>(PENDING_INVITE_CODE_COOKIE)

const memberships = computed(() => user.value?.memberships ?? [])
const activeTenantId = computed(() => user.value?.activeTenantId ?? user.value?.tenantId ?? null)
const inviteCode = ref(typeof route.query.code === 'string' ? route.query.code : '')
const status = ref('')
const error = ref('')
const isRedeeming = ref(false)

const clearPendingInvite = () => {
  pendingInviteCookie.value = null
  localStorage.removeItem(PENDING_INVITE_CODE_STORAGE_KEY)
}

const getErrorStatusCode = (cause: unknown) => {
  if (!cause || typeof cause !== 'object') {
    return null
  }

  const maybeError = cause as {
    statusCode?: unknown
    status?: unknown
    data?: { statusCode?: unknown }
  }

  const statusCode =
    maybeError.statusCode ??
    maybeError.status ??
    maybeError.data?.statusCode

  return typeof statusCode === 'number' ? statusCode : null
}

const getInviteRedemptionErrorMessage = (cause: unknown) => {
  const statusCode = getErrorStatusCode(cause)

  switch (statusCode) {
    case 404:
      return 'That invite code was not found. Check the code or ask a site admin for a new invite.'
    case 409:
      return 'That invite has already been redeemed. Ask a site admin for a new invite if you still need access.'
    case 410:
      return 'That invite is no longer valid because it was revoked or expired. Ask a site admin for a new invite.'
    default:
      return cause instanceof Error ? cause.message : 'Unable to redeem invite.'
  }
}

const switchTenant = async (tenantId: string) => {
  error.value = ''
  await useRequestFetch()('/api/auth/update-tenant', {
    method: 'POST',
    body: { tenantId }
  })
  await fetch()
  await router.push('/portal/routing-rules')
}

const redeemInvite = async (code = inviteCode.value) => {
  if (!code) {
    error.value = 'Enter an invite code to join a site.'
    return
  }

  isRedeeming.value = true
  error.value = ''
  status.value = ''

  try {
    await useRequestFetch()('/api/tenant-invites/redeem', {
      method: 'POST',
      body: { code }
    })
    clearPendingInvite()
    await fetch()
    status.value = 'Invite redeemed. Your active site has been updated.'
    await router.push('/portal/routing-rules')
  } catch (cause) {
    if ([404, 409, 410].includes(getErrorStatusCode(cause) ?? -1)) {
      clearPendingInvite()
    }
    error.value = getInviteRedemptionErrorMessage(cause)
  } finally {
    isRedeeming.value = false
  }
}

onMounted(async () => {
  const pendingInviteCode = localStorage.getItem(PENDING_INVITE_CODE_STORAGE_KEY) || pendingInviteCookie.value
  if (!inviteCode.value && pendingInviteCode) {
    inviteCode.value = pendingInviteCode
  }

  if (inviteCode.value) {
    await redeemInvite(inviteCode.value)
  }
})
</script>

<template>
  <div class="mx-auto max-w-4xl p-6 space-y-6">
    <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p class="text-sm uppercase tracking-[0.2em] text-slate-500">Sites</p>
      <h1 class="mt-2 text-3xl font-semibold text-slate-900">Manage your site access</h1>
      <p class="mt-2 text-sm text-slate-600">
        Choose an active site, or redeem an invite to join a new one.
      </p>
      <p v-if="status" class="mt-4 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        {{ status }}
      </p>
      <p v-if="error" class="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
        {{ error }}
      </p>
    </div>

    <div class="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <CardHeader>
          <CardTitle>Your sites</CardTitle>
          <CardDescription>
            Active site: <span class="font-medium text-slate-900">{{ activeTenantId ?? 'none selected' }}</span>
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-3">
          <div v-if="memberships.length === 0" class="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">
            No site access was found for this account. Redeem an invite code below, or ask a site admin to create one for you.
          </div>
          <div
            v-for="membership in memberships"
            :key="membership.id"
            class="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
          >
            <div>
              <p class="font-medium text-slate-900">{{ membership.tenantId }}</p>
              <p class="text-sm text-slate-600">
                {{ membership.role }} · {{ membership.status }}
              </p>
            </div>
            <Button
              variant="outline"
              :disabled="membership.tenantId === activeTenantId || membership.status !== 'active'"
              @click="switchTenant(membership.tenantId)"
            >
              {{ membership.tenantId === activeTenantId ? 'Active' : 'Switch' }}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle>Redeem invite</CardTitle>
          <CardDescription>Paste an invite code or use a redeemable link.</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="space-y-2">
            <Label for="invite-code">Invite code</Label>
            <Input id="invite-code" v-model="inviteCode" placeholder="Paste invite code" />
          </div>
          <Button class="w-full" :disabled="isRedeeming" @click="redeemInvite()">
            {{ isRedeeming ? 'Redeeming...' : 'Redeem invite' }}
          </Button>
          <p class="text-xs text-slate-500">
            Redeem links store the code locally until you finish signing in.
          </p>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
