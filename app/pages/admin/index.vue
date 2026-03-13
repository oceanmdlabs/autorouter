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

		<div v-if="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
			{{ error }}
		</div>

		<div v-else class="grid gap-4">
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
	</div>
</template>

<script setup lang="ts">
import type { SiteConfigurationReference } from '@/src/entities/models/site-configuration';
const router = useRouter()
const { fetch: refreshSession } = useUserSession()
const status = ref<'pending' | 'error' | 'success'>('pending')
const error = ref<string | null>(null)
const isCreating = ref(false)
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

const formatBuildTime = (value?: string) => {
	if (!value) {
		return 'unknown'
	}

	const date = new Date(value)
	return Number.isNaN(date.getTime()) ? value : `${date.toLocaleString()} (${value})`
}

const deploymentInfoItems = computed(() => [
	{ label: 'Version', value: deploymentInfo.appVersion ?? 'unknown' },
	{ label: 'Build Time', value: formatBuildTime(deploymentInfo.buildTime) },
	{ label: 'Commit', value: deploymentInfo.commitSha ?? 'unknown' },
	{ label: 'Branch', value: deploymentInfo.branchName ?? 'unknown' },
	{ label: 'Environment', value: deploymentInfo.deployEnvironment ?? 'unknown' },
	{ label: 'Deploy URL', value: deploymentInfo.deployUrl ?? 'unknown' },
	{ label: 'Region', value: deploymentInfo.region ?? 'unknown' },
	{ label: 'Node', value: deploymentInfo.nodeVersion ?? 'unknown' }
])

const { data: siteConfigurations } = useAsyncData('site-configurations', async () => {
	try {
		status.value = 'pending'
		const result = await useRequestFetch()<SiteConfigurationReference[]>('/api/site-configuration/all');
		status.value = 'success'
		return result
	} catch (e) {
		status.value = 'error'
		error.value = e instanceof Error ? e.message : 'Failed to load site configurations'
		return []
	}
});

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
		await useRequestFetch()('/api/auth/update-tenant', {
			method: 'POST',
			body: { tenantId: config.tenantId }
		})
		router.push('/portal/site-configuration')
	} catch (e) {
		status.value = 'error'
		error.value = e instanceof Error ? e.message : 'Failed to switch site'
	}
}

const createSite = async () => {
	try {
		status.value = 'pending'
		isCreating.value = true
		error.value = null

		const tenantId = normalizeTenantId(newSite.value.tenantId)
		if (!newSite.value.name.trim() || !tenantId) {
			error.value = 'Site name and tenant ID are required'
			status.value = 'error'
			return
		}

		await useRequestFetch()('/api/site-configuration/all', {
			method: 'POST',
			body: {
				name: newSite.value.name.trim(),
				tenantId
			}
		})

		await refreshCookie('nuxt-session')
		await refreshSession()
		await router.push('/portal/site-configuration')
	} catch (e) {
		status.value = 'error'
		error.value = e instanceof Error ? e.message : 'Failed to create site'
	} finally {
		isCreating.value = false
	}
}
</script>
