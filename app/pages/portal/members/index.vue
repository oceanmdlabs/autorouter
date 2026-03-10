<script setup lang="ts">
type TenantMember = {
  id: string
  userId: string
  name: string
  tenantId: string
  role: 'admin' | 'member'
  status: 'active' | 'revoked'
  createdAt: string
}

type TenantInvite = {
  id: string
  code: string
  tenantId: string
  role: 'admin' | 'member'
  status: 'pending' | 'redeemed' | 'revoked' | 'expired'
  expiresAt: string
  createdAt: string
  redeemedAt: string | null
}

const { user } = useUserSession()
const requestFetch = useRequestFetch()
const createRole = ref<'admin' | 'member'>('member')
const createDaysUntilExpiry = ref(7)
const createResult = ref<{ code: string; redeemUrl: string } | null>(null)
const error = ref('')
const activeMembership = computed(() =>
  user.value?.memberships?.find((membership) => membership.tenantId === (user.value?.activeTenantId ?? user.value?.tenantId))
)
const canManageTenant = computed(() =>
  user.value?.roles?.admin === 'system' || activeMembership.value?.role === 'admin'
)

const { data: membersData, refresh: refreshMembers } = useAsyncData('tenant-members', async () => {
  return await requestFetch<{ members: TenantMember[] }>('/api/tenant-members')
})

const { data: invitesData, refresh: refreshInvites } = useAsyncData('tenant-invites', async () => {
  return await requestFetch<{ invites: TenantInvite[] }>('/api/tenant-invites')
})

const refreshAll = async () => {
  await Promise.all([refreshMembers(), refreshInvites()])
}

const updateRole = async (membershipId: string, role: 'admin' | 'member') => {
  error.value = ''
  try {
    await requestFetch(`/api/tenant-members/${membershipId}/role`, {
      method: 'POST',
      body: { role }
    })
    await refreshMembers()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Unable to update member role.'
  }
}

const revokeMember = async (membershipId: string) => {
  error.value = ''
  try {
    await requestFetch(`/api/tenant-members/${membershipId}/revoke`, {
      method: 'POST'
    })
    await refreshMembers()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Unable to revoke membership.'
  }
}

const createInvite = async () => {
  error.value = ''
  createResult.value = null
  try {
    const result = await requestFetch<{ invite: TenantInvite & { redeemUrl: string } }>('/api/tenant-invites', {
      method: 'POST',
      body: {
        role: createRole.value,
        daysUntilExpiry: createDaysUntilExpiry.value
      }
    })
    createResult.value = {
      code: result.invite.code,
      redeemUrl: result.invite.redeemUrl
    }
    await refreshInvites()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Unable to create invite.'
  }
}

const revokeInvite = async (inviteId: string) => {
  error.value = ''
  try {
    await requestFetch(`/api/tenant-invites/${inviteId}/revoke`, {
      method: 'POST'
    })
    await refreshInvites()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Unable to revoke invite.'
  }
}
</script>

<template>
  <div class="mx-auto max-w-6xl p-6 space-y-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <p class="text-sm uppercase tracking-[0.2em] text-slate-500">Tenant Admin</p>
        <h1 class="mt-2 text-3xl font-semibold text-slate-900">Members and invites</h1>
        <p class="mt-2 text-sm text-slate-600">
          Manage access for <span class="font-medium text-slate-900">{{ user?.activeTenantId ?? user?.tenantId ?? 'no active tenant' }}</span>.
        </p>
      </div>
      <Button variant="outline" @click="refreshAll">Refresh</Button>
    </div>

    <div v-if="!canManageTenant" class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
      Tenant admin access is required to manage members or invites.
    </div>
    <div v-if="error" class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {{ error }}
    </div>

    <div v-if="canManageTenant" class="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>Active and revoked memberships for the current tenant.</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead class="text-left text-slate-500">
                <tr>
                  <th class="pb-3">Name</th>
                  <th class="pb-3">Role</th>
                  <th class="pb-3">Status</th>
                  <th class="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="member in membersData?.members ?? []" :key="member.id" class="border-t border-slate-100">
                  <td class="py-3">
                    <p class="font-medium text-slate-900">{{ member.name }}</p>
                    <p class="text-xs text-slate-500">{{ member.userId }}</p>
                  </td>
                  <td class="py-3">
                    <select
                      class="rounded-md border border-slate-300 bg-white px-2 py-1"
                      :value="member.role"
                      @change="updateRole(member.id, ($event.target as HTMLSelectElement).value as 'admin' | 'member')"
                    >
                      <option value="admin">admin</option>
                      <option value="member">member</option>
                    </select>
                  </td>
                  <td class="py-3 capitalize">{{ member.status }}</td>
                  <td class="py-3 text-right">
                    <Button variant="outline" size="sm" :disabled="member.status === 'revoked'" @click="revokeMember(member.id)">
                      Revoke
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div class="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Create invite</CardTitle>
            <CardDescription>Generate a code or redeemable URL to send out-of-band.</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="space-y-2">
              <Label for="invite-role">Role</Label>
              <select id="invite-role" v-model="createRole" class="w-full rounded-md border border-slate-300 bg-white px-3 py-2">
                <option value="member">member</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <div class="space-y-2">
              <Label for="invite-expiry">Expiry (days)</Label>
              <Input id="invite-expiry" v-model="createDaysUntilExpiry" type="number" min="1" max="30" />
            </div>
            <Button class="w-full" @click="createInvite">Create invite</Button>
            <div v-if="createResult" class="rounded-xl bg-slate-50 p-4 text-sm">
              <p class="font-medium text-slate-900">Invite code</p>
              <p class="mt-1 font-mono text-xs text-slate-600 break-all">{{ createResult.code }}</p>
              <p class="mt-3 font-medium text-slate-900">Redeem URL</p>
              <a :href="createResult.redeemUrl" class="mt-1 block break-all text-xs text-blue-700 underline">
                {{ createResult.redeemUrl }}
              </a>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invites</CardTitle>
            <CardDescription>Pending and historical tenant invites.</CardDescription>
          </CardHeader>
          <CardContent class="space-y-3">
            <div
              v-for="invite in invitesData?.invites ?? []"
              :key="invite.id"
              class="rounded-xl border border-slate-200 p-4"
            >
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="font-mono text-xs text-slate-600 break-all">{{ invite.code }}</p>
                  <p class="mt-2 text-sm text-slate-900">
                    {{ invite.role }} · {{ invite.status }} · expires {{ new Date(invite.expiresAt).toLocaleString() }}
                  </p>
                </div>
                <Button variant="outline" size="sm" :disabled="invite.status !== 'pending'" @click="revokeInvite(invite.id)">
                  Revoke
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>
