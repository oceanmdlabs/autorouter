<template>
	<div class="container mx-auto p-4 max-w-4xl">
		<div class="space-y-6">
			<div>
				<h1 class="text-2xl font-semibold text-gray-900">System Administration</h1>
				<p class="mt-2 text-sm text-gray-600 leading-relaxed max-w-3xl">
					Manage site configurations and encryption provisioning for all tenants.
				</p>
			</div>

			<!-- Tab navigation -->
			<div class="border-b border-gray-200">
				<nav class="-mb-px flex space-x-8">
					<NuxtLink to="/admin" class="border-primary text-primary whitespace-nowrap border-b-2 py-2 px-1 text-sm font-medium">
						Site Configurations
					</NuxtLink>
					<NuxtLink to="/admin/encryption" class="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 whitespace-nowrap border-b-2 py-2 px-1 text-sm font-medium">
						Encryption Provisioning
					</NuxtLink>
				</nav>
			</div>

			<p class="text-gray-600">Current Tenant ID: {{ currentTenantId || 'None' }}</p>

			<div v-if="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
				{{ error }}
			</div>

			<div v-else class="grid gap-4">
				<div v-for="config in siteConfigurations" :key="config.id"
					class="bg-white shadow rounded-lg p-4 hover:shadow-md transition-shadow">
					<div class="flex justify-between items-center">
						<div>
							<h2 class="text-lg font-semibold">{{ config.name }}</h2>
							<p class="text-gray-600">Tenant ID: {{ config.tenantId }}</p>
						</div>
						<button @click="selectConfiguration(config)"
							class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
							Select
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { SiteConfigurationReference } from "@/src/entities/models/site-configuration";

const router = useRouter()
const { fetch: fetchSession } = useUserSession()
const status = ref<'pending' | 'error' | 'success'>('pending')
const error = ref<string | null>(null)

const { data: userData } = useFetch('/api/auth/tenant')
const currentTenantId = computed(() => userData.value?.tenantId)


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

const selectConfiguration = async (config: SiteConfigurationReference) => {
	try {
		status.value = 'pending'
		await useRequestFetch()('/api/auth/update-tenant', {
			method: 'POST',
			body: { tenantId: config.tenantId }
		})
		// Refresh the user session so the layout picks up the new tenantId
		await fetchSession()
		router.push('/portal/site-configuration')
	} catch (e) {
		status.value = 'error'
		error.value = e instanceof Error ? e.message : 'Failed to switch tenant'
	}
}
</script>
