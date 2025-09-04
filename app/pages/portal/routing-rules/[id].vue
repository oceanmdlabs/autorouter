<script setup lang="ts">
import { getRoutingEventTypeDescription, routingEventTypeEnum } from "@/src/entities/models/routing-event-type";
import type { NewRoutingRule, RoutingRule } from '@/src/entities/models/routing-rule';
import { clientRoutingToolRegistry, routingToolNames } from '@/src/entities/models/routing-tool-client';
import type { RoutingToolName } from '@/src/infrastructure/services/routing-tools/routing-tool-registry';

const router = useRouter()
const route = useRoute()
const id = route.params.id as string
const isNew = id === 'new'
// State
const errors = ref<Record<string, string>>({})
const isLoading = ref(false)
const formValues = ref<NewRoutingRule>({
	name: '',
	triggeringEvent: "request_received",
	prompt: '',
	active: true,
	enabledTools: []
})

// Reactive object to track tool enabled states for v-model
const toolStates = reactive<Record<RoutingToolName, boolean>>({} as Record<RoutingToolName, boolean>)

// Get application context
const { data: loadedData, status } = useAsyncData<RoutingRule | null>('rule', async () => {
	if (isNew) {
		return null;
	}
	return await useRequestFetch()<RoutingRule>(`/api/routing-rules/${id}`)
});

watch(() => loadedData.value, (newData) => {
	if (status.value === 'pending') return;
	if (!isNew && newData) {
		formValues.value = {
			name: newData.name,
			triggeringEvent: newData.triggeringEvent,
			prompt: newData.prompt,
			active: newData.active,
			enabledTools: newData.enabledTools || []
		};
		// Initialize toolStates from loaded data
		routingToolNames.forEach(toolName => {
			toolStates[toolName] = formValues.value.enabledTools.includes(toolName)
		})
		// Auto-resize textarea after data is loaded
		nextTick(() => {
			resizeTextareaOnLoad()
		})
	}
}, { immediate: true })

// Watch for changes in toolStates and sync with formValues
watch(toolStates, (newToolStates) => {
	// Update formValues.enabledTools based on toolStates
	formValues.value.enabledTools = Object.entries(newToolStates)
		.filter(([_, enabled]) => enabled)
		.map(([toolName, _]) => toolName as RoutingToolName)
}, { deep: true })

// Form submission
async function handleSubmit() {
	isLoading.value = true
	errors.value = {}

	// Validate that at least one tool is enabled
	if (formValues.value.enabledTools.length === 0) {
		errors.value = { enabledTools: 'At least one tool must be enabled.' }
		isLoading.value = false
		return
	}

	// Debug: Log the form values being submitted
	console.log('Submitting form values:', formValues.value)
	console.log('Enabled tools:', formValues.value.enabledTools)

	try {
		if (isNew) {
			await $fetch<RoutingRule>('/api/routing-rules', {
				method: 'POST',
				body: formValues.value
			})
		} else {
			await $fetch<RoutingRule>(`/api/routing-rules/${id}`, {
				method: 'PUT',
				body: formValues.value
			})
		}
		router.push('/portal/routing-rules')
	} catch (error: any) {
		console.error('Failed to save rule:', error)
		errors.value = { error: 'Failed to save rule' }
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
		const { error } = await useFetch(`/api/routing-rules/${id}`, {
			method: 'DELETE'
		})

		if (error.value) {
			errors.value = { error: error.value.message }
			return
		}

		router.push('/portal/routing-rules')
	} catch (error) {
		console.error('Failed to delete rule:', error)
		errors.value = { error: 'Failed to delete rule' }
	}
}

// Filter tools based on event type
const availableTools = computed(() => {
	if (formValues.value.triggeringEvent === "request_pre_submission") {
		return routingToolNames.filter(name => clientRoutingToolRegistry[name].supportsCdsHook)
	}
	return routingToolNames.filter(name => !clientRoutingToolRegistry[name].supportsCdsHook)
})

// Check if forward or assign tools are enabled
const showListingNote = computed(() => {
	return formValues.value.enabledTools.some(tool => tool === 'forward' || tool === 'assign')
})

// Auto-resize textarea function
function autoResizeTextarea(event: Event) {
	const target = event.target as HTMLTextAreaElement
	target.style.height = 'auto'
	target.style.height = target.scrollHeight + 'px'
}

// Initial resize function for when data is loaded
function resizeTextareaOnLoad() {
	const textarea = document.getElementById('prompt') as HTMLTextAreaElement
	if (textarea) {
		textarea.style.height = 'auto'
		textarea.style.height = textarea.scrollHeight + 'px'
	}
}

// Handle initial resize on mount
onMounted(() => {
	nextTick(() => {
		resizeTextareaOnLoad()
	})
})
</script>

<template>
	<Card>
		<form @submit.prevent="handleSubmit">
			<CardHeader class="flex flex-row items-center justify-between">
				<CardTitle>{{ isNew ? 'New Rule' : 'Edit Rule' }}</CardTitle>
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

				<div v-if="Object.keys(errors).filter(key => key !== 'enabledTools').length > 0" class="mb-4">
					<p class="text-destructive">
						{{Object.entries(errors).filter(([key]) => key !== 'enabledTools').map(([k, v]) => `${k}:
						${v}`).join('; ')}}
					</p>
				</div>

				<div class="space-y-6">
					<div class="space-y-2">
						<Label for="name">Rule Name</Label>
						<Input id="name" v-model="formValues.name" :aria-invalid="errors.name ? 'true' : undefined" />
						<p v-if="errors.name" class="text-sm text-destructive">
							{{ errors.name }}
						</p>
					</div>

					<div class="space-y-2">
						<div class="flex items-center space-x-2">
							<Switch id="active" v-model="formValues.active" />
							<Label for="active"
								:class="formValues.active ? 'text-green-600' : 'text-gray-600'">Active</Label>
						</div>
					</div>

					<div class="space-y-2">
						<SelectGroup>
							<SelectLabel>This rule triggers whenever:</SelectLabel>
							<Select v-model="formValues.triggeringEvent" :disabled="!formValues.active">
								<SelectTrigger>
									<SelectValue placeholder="Select a trigger" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem
										v-for="event in routingEventTypeEnum.filter(e => e !== 'request_updated')"
										:value="event">
										{{ getRoutingEventTypeDescription(event) }}
									</SelectItem>
								</SelectContent>
							</Select>
						</SelectGroup>
						<p v-if="errors.triggeringEvent" class="text-sm text-destructive">
							{{ errors.triggeringEvent }}
						</p>
					</div>

					<div class="space-y-2">
						<div class="flex flex-col space-y-1.5">
							<Label for="prompt" class="flex items-center gap-2">
								Instructions
								<span class="inline-flex items-center justify-center rounded-full bg-purple-100 p-1">
									<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
										stroke="currentColor" class="w-4 h-4 text-purple-600">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
											d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
									</svg>
								</span>
							</Label>
							<p class="text-sm text-muted-foreground">Write instructions for the Autorouter to handle
								this event.</p>
						</div>
						<Textarea id="prompt" v-model="formValues.prompt" :disabled="!formValues.active"
							placeholder="Enter instructions for handling this event..."
							:aria-invalid="errors.prompt ? 'true' : undefined" rows="3"
							class="min-h-[100px] resize-y border-purple-200 focus-visible:ring-purple-400 focus-visible:border-purple-300"
							@input="autoResizeTextarea" />
						<p class="text-sm text-muted-foreground">Make sure you are specific about which actions should
							be taken, when they should be taken,
							<strong>and</strong>
							when it should do nothing.
						</p>
						<p v-if="errors.prompt" class="text-sm text-destructive">
							{{ errors.prompt }}
						</p>
					</div>

					<div class="space-y-2">
						<Label class="flex items-center gap-2">
							Enabled Tools
							<span class="inline-flex items-center justify-center rounded-full bg-blue-100 p-1">
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
									stroke="currentColor" class="w-4 h-4 text-blue-600">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
										d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
										d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
								</svg>
							</span>
						</Label>
						<p class="text-sm text-muted-foreground">Select which tools this rule is allowed to use.</p>
						<div class="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
							<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
								<div v-for="toolName in availableTools" :key="toolName"
									class="flex items-center space-x-3 p-3 rounded-md border bg-white hover:bg-gray-50 transition-colors">
									<Switch :id="`tool-${toolName}`" v-model="toolStates[toolName]"
										:disabled="!formValues.active" />
									<div class="flex-1 min-w-0">
										<Label :for="`tool-${toolName}`" class="text-sm font-medium cursor-pointer">
											{{ clientRoutingToolRegistry[toolName].description }}
										</Label>
									</div>
								</div>
							</div>
							<div v-if="availableTools.length === 0" class="text-center py-4 text-gray-500">
								No tools available for this event type.
							</div>
						</div>
						<p v-if="errors.enabledTools" class="text-sm text-destructive mt-2">
							{{ errors.enabledTools }}
						</p>
						<p v-if="showListingNote" class="text-xs text-muted-foreground mt-2">* Make sure you have
							declared the listing
							in the <NuxtLink to="/portal/listings" class="underline hover:text-purple-600">
								listings section</NuxtLink>.</p>
					</div>
				</div>
			</CardContent>
			<CardContent v-else>
				<FormSkeleton />
			</CardContent>
		</form>
	</Card>
</template>
