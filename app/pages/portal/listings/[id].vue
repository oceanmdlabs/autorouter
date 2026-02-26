<script setup lang="ts">
import type { HealthcareService, NewHealthcareService } from '@/src/entities/models/healthcare-service'

const router = useRouter()
const route = useRoute()
const id = route.params.id as string
const isNew = id === 'new'
const errors = ref<Record<string, string>>({})
const isLoading = ref(false)
const formValues = ref<NewHealthcareService>({
	name: '',
	oceanReference: '',
	description: '',
});
const { data: loadedData, status } = useAsyncData<HealthcareService | null>('healthcareService', async () => {
	if (isNew) {
		return null;
	}
	return await useRequestFetch()<HealthcareService>(`/api/healthcare-services/${id}`)
});
watch(() => loadedData.value, (data) => {
	if (status.value === 'pending') return;
	if (!isNew && data) {
		formValues.value = {
			name: data.name,
			oceanReference: data.oceanReference,
			description: data.description,
		}
	}
}, { immediate: true })

// Form submission
async function handleSubmit() {
	isLoading.value = true
	errors.value = {}
	try {
		if (isNew) {
			await $fetch<HealthcareService>('/api/healthcare-services', {
				method: 'POST',
				body: formValues.value
			})
		} else {
			await $fetch<HealthcareService>(`/api/healthcare-services/${id}`, {
				method: 'PUT',
				body: formValues.value
			})
		}
		router.push('/portal/listings')
	} catch (error: any) {
		console.error('Failed to save healthcare service:', error)
		if (error.name === 'FetchError' && Array.isArray(error.data.data)) {
			// Map Zod validation errors to form fields
			error.data.data.forEach((issue: { path: string[], message: string }) => {
				const fieldName = issue.path[issue.path.length - 1]
				if (fieldName) {
					errors.value[fieldName] = issue.message
				}
			})
		} else {
			errors.value = { message: 'Failed to save healthcare service' }
		}
	} finally {
		isLoading.value = false
	}
}

// Delete handler
async function handleDelete() {
	if (!confirm('Please confirm you want to delete this record.')) {
		return
	}

	try {
		const { error } = await useFetch(`/api/healthcare-services/${id}`, {
			method: 'DELETE'
		})

		if (error.value) {
			errors.value = { error: error.value.message }
			return
		}

		router.push('/portal/listings')
	} catch (error) {
		console.error('Failed to delete healthcare service:', error)
		errors.value = { error: 'Failed to delete healthcare service' }
	}
}
</script>

<template>
	<Card>
		<form @submit.prevent="handleSubmit">
			<CardHeader class="flex flex-row items-center justify-between">
				<CardTitle>{{ isNew ? 'New Listing' : 'Edit Listing' }}</CardTitle>
				<div class="flex gap-2">
					<Button variant="outline" type="button" @click="router.back()">
						Cancel
					</Button>
					<Button v-if="!isNew" variant="destructive" type="button" @click="handleDelete">
						Delete
					</Button>
					<Button type="submit" :disabled="isLoading">
						Save
					</Button>
				</div>
			</CardHeader>

			<CardContent v-if="status !== 'pending'">
				<div v-if="errors.message" class="mb-4">
					<p class="text-destructive">
						{{ errors.message }}
					</p>
				</div>

				<div class="space-y-6" v-if="formValues">
					<div class="space-y-2">
						<Label for="name">Listing Name</Label>
						<Input id="name" v-model="formValues.name" :aria-invalid="errors.name ? 'true' : undefined" />
						<p v-if="errors.name" class="text-sm text-destructive">
							{{ errors.name }}
						</p>
					</div>

					<div class="space-y-2">
						<Label for="oceanReference">Ocean Listing Reference</Label>
						<Input id="oceanReference" v-model="formValues.oceanReference"
							:aria-invalid="errors.oceanReference ? 'true' : undefined" />
						<p class="text-sm text-muted-foreground">
							To find the listing reference, click "View Listing" in the Ocean Healthmap and look at the
							URL. The reference is the "rtRef" parameter.
						</p>
						<p v-if="errors.oceanReference" class="text-sm text-destructive">
							{{ errors.oceanReference }}
						</p>
					</div>

					<div class="space-y-2">
						<Label for="description">Listing Description</Label>
						<Textarea id="description" v-model="formValues.description"
							:aria-invalid="errors.description ? 'true' : undefined" rows="3"
							class="min-h-[100px] resize-y" />
						<p v-if="errors.description" class="text-sm text-destructive">
							{{ errors.description }}
						</p>
					</div>
				</div>
				<div v-else class="space-y-6">
					<!-- Loading state -->
					<div class="space-y-2">
						<div class="h-5 w-24 bg-muted animate-pulse rounded"></div>
						<div class="h-10 bg-muted animate-pulse rounded"></div>
					</div>

					<div class="space-y-2">
						<div class="h-5 w-32 bg-muted animate-pulse rounded"></div>
						<div class="h-10 bg-muted animate-pulse rounded"></div>
					</div>

					<div class="space-y-2">
						<div class="h-5 w-36 bg-muted animate-pulse rounded"></div>
						<div class="h-[100px] bg-muted animate-pulse rounded"></div>
					</div>
				</div>
			</CardContent>
			<CardContent v-else>
				<FormSkeleton />
			</CardContent>
		</form>
	</Card>
</template>