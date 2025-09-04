<template>
	<div class="container mx-auto p-4">
		<h1 class="text-2xl font-bold mb-4">Site Configurations</h1>

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
</template>

<script setup lang="ts">
import type { SiteConfigurationReference } from '@/src/entities/models/site-configuration';
const router = useRouter()
const status = ref<'pending' | 'error' | 'success'>('pending')
const error = ref<string | null>(null)

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
		router.push('/portal/site-configuration')
	} catch (e) {
		status.value = 'error'
		error.value = e instanceof Error ? e.message : 'Failed to switch tenant'
	}
}
</script>
