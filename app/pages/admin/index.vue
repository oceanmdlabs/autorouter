<template>
	<div class="container mx-auto p-4">
		<div class="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
			<h2 class="text-lg font-semibold mb-2">Deployment Info</h2>
			<div class="grid sm:grid-cols-2 gap-2 text-sm">
				<div v-for="item in deploymentInfoItems" :key="item.label" class="flex justify-between gap-3">
					<span class="text-slate-600">{{ item.label }}</span>
					<span class="font-mono text-slate-900 text-right break-all">{{ item.value }}</span>
				</div>
			</div>
		</div>

		<div class="bg-white border border-slate-200 rounded-lg p-4 mb-6">
			<div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
				<div>
					<h1 class="text-2xl font-bold">Site Configurations</h1>
					<p class="text-sm text-slate-600">Create a new site, then finish its setup in the site configuration page.</p>
				</div>
				<form class="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end" @submit.prevent="createSite">
					<div>
						<label class="mb-1 block text-sm font-medium text-slate-700">Site Name</label>
						<input
							v-model="newSite.name"
							type="text"
							placeholder="Downtown Clinic"
							class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
						/>
					</div>
					<div>
						<label class="mb-1 block text-sm font-medium text-slate-700">Tenant ID</label>
						<input
							v-model="newSite.tenantId"
							type="text"
							placeholder="downtown-clinic"
							class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
						/>
					</div>
					<button
						type="submit"
						:disabled="isCreating"
						class="self-end bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white px-4 py-2 rounded-md text-sm font-medium"
					>
						{{ isCreating ? 'Creating…' : 'Create Site' }}
					</button>
				</form>
			</div>
		</div>

		<div v-if="siteError" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
			{{ siteError }}
		</div>

		<div class="grid gap-4 mb-6">
			<div v-for="config in siteConfigurations" :key="config.id"
				class="bg-white shadow rounded-lg p-4 hover:shadow-md transition-shadow">
				<div class="flex justify-between items-center">
					<div>
						<h2 class="text-lg font-semibold">{{ config.name }}</h2>
						<p class="text-gray-600">Site ID: {{ config.tenantId }}</p>
					</div>
					<button @click="selectConfiguration(config)"
						class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
						Select
					</button>
				</div>
			</div>
		</div>

		<div class="bg-white border border-slate-200 rounded-lg p-4">
			<div class="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
				<div>
					<h2 class="text-2xl font-bold">Authenticated users</h2>
					<p class="text-sm text-slate-600">Browse all users who have successfully authenticated and add them to sites.</p>
				</div>
				<div class="w-full lg:max-w-sm">
					<label class="mb-1 block text-sm font-medium text-slate-700">Search users</label>
					<input
						v-model="userSearch"
						type="text"
						placeholder="Search by name, provider, subject, or site"
						class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
					/>
				</div>
			</div>

			<div v-if="accessError" class="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
				{{ accessError }}
			</div>

			<div class="mt-4 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
				<div class="space-y-3">
					<div class="flex items-center justify-between text-sm text-slate-600">
						<span>{{ filteredUsers.length }} user{{ filteredUsers.length === 1 ? '' : 's' }}</span>
						<button
							type="button"
							class="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
							@click="() => refreshUsers()"
						>
							Refresh
						</button>
					</div>

					<div v-if="filteredUsers.length === 0" class="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
						No authenticated users matched the current search.
					</div>

					<button
						v-for="adminUser in filteredUsers"
						:key="adminUser.id"
						type="button"
						class="w-full rounded-lg border p-4 text-left transition-colors"
						:class="selectedUser?.id === adminUser.id ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'"
						@click="selectedUserId = adminUser.id"
					>
						<div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
							<div class="min-w-0">
								<h3 class="truncate text-base font-semibold text-slate-900">{{ adminUser.name }}</h3>
								<p class="text-sm text-slate-600">{{ adminUser.provider }} · {{ adminUser.subject }}</p>
								<p class="mt-1 text-xs text-slate-500">Last login {{ formatDateTime(adminUser.lastLoginAt) }}</p>
							</div>
							<div class="flex flex-wrap gap-2">
								<span
									v-for="membership in adminUser.memberships"
									:key="membership.id"
									class="rounded-full px-2.5 py-1 text-xs font-medium"
									:class="membership.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'"
								>
									{{ siteNameByTenantId[membership.tenantId] ?? membership.tenantId }} · {{ membership.role }} · {{ membership.status }}
								</span>
								<span
									v-if="adminUser.memberships.length === 0"
									class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
								>
									No site memberships
								</span>
							</div>
						</div>
					</button>
				</div>

				<div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
					<div v-if="selectedUser">
						<p class="text-sm uppercase tracking-wide text-slate-500">Selected user</p>
						<h3 class="mt-1 text-xl font-semibold text-slate-900">{{ selectedUser.name }}</h3>
						<p class="mt-1 text-sm text-slate-600">{{ selectedUser.provider }} · {{ selectedUser.subject }}</p>
						<p class="mt-1 text-xs text-slate-500">Last login {{ formatDateTime(selectedUser.lastLoginAt) }}</p>

						<div class="mt-5">
							<h4 class="text-sm font-semibold text-slate-900">Current memberships</h4>
							<div class="mt-3 space-y-2">
								<div
									v-for="membership in selectedUser.memberships"
									:key="membership.id"
									class="rounded-md border border-slate-200 bg-white px-3 py-2"
								>
									<div class="flex items-center justify-between gap-3">
										<div>
											<p class="text-sm font-medium text-slate-900">
												{{ siteNameByTenantId[membership.tenantId] ?? membership.tenantId }}
											</p>
											<p class="text-xs text-slate-500">{{ membership.tenantId }}</p>
										</div>
										<p class="text-xs font-medium uppercase tracking-wide text-slate-600">
											{{ membership.role }} · {{ membership.status }}
										</p>
									</div>
								</div>
								<p v-if="selectedUser.memberships.length === 0" class="text-sm text-slate-500">This user is not assigned to any sites yet.</p>
							</div>
						</div>

						<form class="mt-6 space-y-4" @submit.prevent="assignSelectedUser">
							<div>
								<label class="mb-1 block text-sm font-medium text-slate-700">Site</label>
								<select
									v-model="assignmentForm.tenantId"
									class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
								>
									<option value="" disabled>Select a site</option>
									<option
										v-for="config in assignableSites"
										:key="config.id"
										:value="config.tenantId"
									>
										{{ config.name }} ({{ config.tenantId }})
									</option>
								</select>
							</div>
							<div>
								<label class="mb-1 block text-sm font-medium text-slate-700">Role</label>
								<select
									v-model="assignmentForm.role"
									class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
								>
									<option value="member">member</option>
									<option value="admin">admin</option>
								</select>
							</div>
							<p
								v-if="selectedTenantAlreadyActive"
								class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
							>
								This user already has an active membership for the selected site.
							</p>
							<button
								type="submit"
								:disabled="isAssigning || !assignmentForm.tenantId || selectedTenantAlreadyActive"
								class="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
							>
								{{ isAssigning ? 'Saving…' : 'Add to site' }}
							</button>
						</form>
					</div>

					<div v-else class="flex h-full min-h-64 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-6 text-center text-sm text-slate-500">
						Select an authenticated user to review memberships and assign a site.
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { SiteConfigurationReference } from '@/src/entities/models/site-configuration';

type AdminUserMembership = {
	id: string
	tenantId: string
	role: 'admin' | 'member'
	status: 'active' | 'revoked'
	createdAt: string
}

type AdminUser = {
	id: string
	name: string
	provider: 'google' | 'github'
	subject: string
	lastLoginAt: string
	memberships: AdminUserMembership[]
}

const router = useRouter()
const { fetch: refreshSession } = useUserSession()
const requestFetch = useRequestFetch()
const status = ref<'pending' | 'error' | 'success'>('pending')
const siteError = ref<string | null>(null)
const accessError = ref<string | null>(null)
const isCreating = ref(false)
const isAssigning = ref(false)
const userSearch = ref('')
const selectedUserId = ref<string | null>(null)
const assignmentForm = ref<{
	tenantId: string
	role: 'admin' | 'member'
}>({
	tenantId: '',
	role: 'member'
})
const newSite = ref({
	name: '',
	tenantId: ''
})
const deploymentInfo = useRuntimeConfig().public.deploymentInfo as {
	appVersion?: string
	buildTime?: string
	commitSha?: string
	branchName?: string
	deployEnvironment?: string
	deployUrl?: string
	region?: string
	nodeVersion?: string
}


const formatBuildDate = (value?: string): string => {
	if (!value) return 'Unavailable'
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return 'Unavailable'
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	const hours = date.getHours()
	const minutes = String(date.getMinutes()).padStart(2, '0')
	const ampm = hours >= 12 ? 'PM' : 'AM'
	const h = hours % 12 || 12
	return `${year}-${month}-${day} ${h}:${minutes} ${ampm}`
}

const deploymentInfoItems = computed(() => [
	{ label: 'Application Build Date', value: formatBuildDate(deploymentInfo.buildTime) },
	{ label: 'Version', value: deploymentInfo.appVersion ?? 'unknown' },
	{ label: 'Commit', value: deploymentInfo.commitSha ?? 'unknown' },
	{ label: 'Branch', value: deploymentInfo.branchName ?? 'unknown' },
	{ label: 'Environment', value: deploymentInfo.deployEnvironment ?? 'unknown' },
	{ label: 'Deploy URL', value: deploymentInfo.deployUrl ?? 'unknown' },
	{ label: 'Region', value: deploymentInfo.region ?? 'unknown' },
	{ label: 'Node', value: deploymentInfo.nodeVersion ?? 'unknown' }
])

const { data: siteConfigurations, refresh: refreshSiteConfigurations } = useAsyncData('site-configurations', async () => {
	try {
		status.value = 'pending'
		const result = await requestFetch<SiteConfigurationReference[]>('/api/site-configuration/all');
		status.value = 'success'
		return result
	} catch (e) {
		status.value = 'error'
		siteError.value = e instanceof Error ? e.message : 'Failed to load site configurations'
		return []
	}
});

const { data: usersData, refresh: refreshUsers } = useAsyncData('admin-users', async () => {
	try {
		accessError.value = null
		const result = await requestFetch<{ users: AdminUser[] }>('/api/admin/users')
		return result.users
	} catch (e) {
		accessError.value = e instanceof Error ? e.message : 'Failed to load authenticated users'
		return []
	}
})

const siteNameByTenantId = computed<Record<string, string>>(() =>
	Object.fromEntries((siteConfigurations.value ?? []).map((config) => [config.tenantId, config.name]))
)

const filteredUsers = computed(() => {
	const search = userSearch.value.trim().toLowerCase()
	if (!search) {
		return usersData.value ?? []
	}

	return (usersData.value ?? []).filter((user) => {
		const haystacks = [
			user.name,
			user.provider,
			user.subject,
			...user.memberships.map((membership) => membership.tenantId),
			...user.memberships.map((membership) => siteNameByTenantId.value[membership.tenantId] ?? '')
		]

		return haystacks.some((value) => value.toLowerCase().includes(search))
	})
})

const selectedUser = computed(() =>
	filteredUsers.value.find((user) => user.id === selectedUserId.value)
		?? (usersData.value ?? []).find((user) => user.id === selectedUserId.value)
		?? null
)

const assignableSites = computed(() => siteConfigurations.value ?? [])

const selectedTenantAlreadyActive = computed(() =>
	Boolean(
		selectedUser.value?.memberships.some((membership) =>
			membership.tenantId === assignmentForm.value.tenantId && membership.status === 'active'
		)
	)
)

const normalizeTenantId = (value: string) =>
	value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.replace(/-{2,}/g, '-')

watch(() => newSite.value.name, (value) => {
	if (!newSite.value.tenantId.trim()) {
		newSite.value.tenantId = normalizeTenantId(value)
	}
})

const selectConfiguration = async (config: SiteConfigurationReference) => {
	try {
		status.value = 'pending'
		siteError.value = null
		await requestFetch('/api/auth/update-tenant', {
			method: 'POST',
			body: { tenantId: config.tenantId }
		})
		router.push('/portal/site-configuration')
	} catch (e) {
		status.value = 'error'
		siteError.value = e instanceof Error ? e.message : 'Failed to switch site'
	}
}

const createSite = async () => {
	try {
		status.value = 'pending'
		isCreating.value = true
		siteError.value = null

		const tenantId = normalizeTenantId(newSite.value.tenantId)
		if (!newSite.value.name.trim() || !tenantId) {
			siteError.value = 'Site name and tenant ID are required'
			status.value = 'error'
			return
		}

		await requestFetch('/api/site-configuration/all', {
			method: 'POST',
			body: {
				name: newSite.value.name.trim(),
				tenantId
			}
		})

		await refreshSiteConfigurations()
		assignmentForm.value.tenantId = tenantId
		await refreshCookie('nuxt-session')
		await refreshSession()
		await router.push('/portal/site-configuration')
	} catch (e) {
		status.value = 'error'
		siteError.value = e instanceof Error ? e.message : 'Failed to create site'
	} finally {
		isCreating.value = false
	}
}

const formatDateTime = (value: string) => {
	const date = new Date(value)
	return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

watch(
	() => filteredUsers.value,
	(users) => {
		if (!users.length) {
			selectedUserId.value = null
			return
		}

		if (!selectedUserId.value || !users.some((user) => user.id === selectedUserId.value)) {
			selectedUserId.value = users[0]?.id ?? null
		}
	},
	{ immediate: true }
)

watch(
	() => selectedUser.value?.id,
	() => {
		assignmentForm.value = {
			tenantId: '',
			role: 'member'
		}
	}
)

const assignSelectedUser = async () => {
	if (!selectedUser.value || !assignmentForm.value.tenantId || selectedTenantAlreadyActive.value) {
		return
	}

	try {
		accessError.value = null
		isAssigning.value = true

		await requestFetch('/api/admin/tenant-memberships', {
			method: 'POST',
			body: {
				userId: selectedUser.value.id,
				tenantId: assignmentForm.value.tenantId,
				role: assignmentForm.value.role
			}
		})

		await refreshUsers()
		assignmentForm.value.tenantId = ''
	} catch (e) {
		accessError.value = e instanceof Error ? e.message : 'Failed to update site membership'
	} finally {
		isAssigning.value = false
	}
}
</script>
