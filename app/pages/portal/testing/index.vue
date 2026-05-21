<script setup lang="ts">
import { handleMissingActiveTenantError } from '@/app/lib/active-tenant';
import type { TestServiceRequest } from '@/src/entities/models/test-service-request';
import { routingEventTypeSchema, getRoutingEventTypeDescription } from '@/src/entities/models/routing-event-type';
import type { Bundle } from 'fhir/r4';
import type { RuleEvaluationResult } from '@/src/entities/models/routing-evaluation';
import { getRoutingToolActionDescription } from '@/src/entities/models/routing-tool';
const EVENT_TYPES = routingEventTypeSchema.options.map((event) => ({
	label: getRoutingEventTypeDescription(event),
	value: event,
}));

// State
const selectedRequest = ref('')
const selectedEvent = ref('')
const isLoading = ref(false)
const results = ref<RuleEvaluationResult[] | null>(null)
const requestFetch = useRequestFetch()

// Get test service requests
const { data: testServiceRequests } = useAsyncData('testServiceRequests', async () => {
	try {
		return await requestFetch<TestServiceRequest[]>('/api/test-service-requests');
	} catch (error) {
		if (await handleMissingActiveTenantError(error, { notify: false })) {
			return [];
		}
		throw error;
	}
});

// Form submission
async function handleSubmit(event: Event) {
	isLoading.value = true
	results.value = null

	try {
		results.value = await requestFetch<RuleEvaluationResult[]>('/api/test-service-requests/simulate', {
			method: 'POST',
			body: {
				testServiceRequestId: selectedRequest.value,
				eventType: selectedEvent.value,
			}
		});
	} catch (error: any) {
		if (await handleMissingActiveTenantError(error)) {
			return
		}
		console.error('Failed to simulate event:', error)
	} finally {
		isLoading.value = false;
	}
}
</script>

<template>
	<div class="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
		<div class="space-y-6">
			<div>
				<h1 class="text-2xl font-semibold text-gray-900">Testing</h1>
				<p class="mt-2 text-sm text-gray-600 leading-relaxed max-w-3xl">
					You can simulate events here to test your routing rules using the <NuxtLink
						to="/portal/testing/sample-data" class="text-blue-800 hover:text-blue-600">
						sample
						data</NuxtLink>.
				</p>
			</div>

			<div class="flex justify-end">
				<Button asChild>
					<NuxtLink to="/portal/testing/sample-data" class="flex items-center gap-2">
						<Icon name="heroicons:cog-6-tooth" class="w-4 h-4" />
						Configure Sample Data
					</NuxtLink>
				</Button>
			</div>

			<Card>
				<CardContent>
					<form @submit.prevent="handleSubmit" class="space-y-6">
						<div v-if="testServiceRequests && !testServiceRequests?.length"
							class="rounded-lg border p-4 bg-yellow-50 text-yellow-800 mb-4">
							<p>No sample service requests are available. Please visit the <NuxtLink
									to="/portal/testing/sample-data" class="underline hover:text-yellow-600">sample data
									section
								</NuxtLink> to create some test
								data first.</p>
						</div>
						<template v-else>
							<div class="space-y-2">
								<Label for="request">Sample Service Request:</Label>
								<Select v-model="selectedRequest" name="testServiceRequestId">
									<SelectTrigger>
										<SelectValue placeholder="Select a sample service request" />
									</SelectTrigger>
									<SelectContent>
										<SelectGroup>
											<SelectItem v-for="request in testServiceRequests" :key="request.id"
												:value="request.id">
												{{ (request.content as unknown as Bundle)?.identifier?.value ??
													request.id }}
											</SelectItem>
										</SelectGroup>
									</SelectContent>
								</Select>
							</div>

							<div class="space-y-2">
								<Label for="event">Event</Label>
								<Select v-model="selectedEvent" name="eventType">
									<SelectTrigger>
										<SelectValue placeholder="Select an event type" />
									</SelectTrigger>
									<SelectContent>
										<SelectGroup>
											<SelectItem v-for="event in EVENT_TYPES" :key="event.value"
												:value="event.value">
												{{ event.label }}
											</SelectItem>
										</SelectGroup>
									</SelectContent>
								</Select>
							</div>

							<Button type="submit" :disabled="!selectedRequest || !selectedEvent || isLoading"
								:loading="isLoading">
								Simulate Event
							</Button>
						</template>
					</form>
					<div v-if="results" class="mt-8 space-y-6">
						<h2 class="text-lg font-semibold mb-2">Rule Evaluations</h2>
						<div v-if="results.length === 0" class="text-sm text-gray-500 italic">
							No rules found.
						</div>
						<div v-else>
							<p>The following rules were evaluated. For each rule, the actions that would be triggered
								are
								listed.</p>
							<div class="py-2 space-y-2">
								<div v-for="result in results" :key="result.ruleId"
									class="rounded-lg border space-y-2 p-4 shadow-sm">
									<!-- List each rule's evaluation result -->
									<h3 class="text-lg font-semibold mb-2">{{ result.ruleName }}</h3>
									<div class="space-y-2">
										<template v-if="result.evaluation.actions.length > 0" class="space-y-2">
											<div v-for="(action, index) in result.evaluation.actions" :key="index"
												class="flex items-center gap-2 text-sm">
												<Icon name="lucide:check" class="h-4 w-4 text-green-500" />
												<span>{{ getRoutingToolActionDescription(action) }}</span>
											</div>
										</template>
										<template v-else-if="result.evaluation.error">
											<span class="text-sm text-red-500 italic">{{ result.evaluation.error
											}}</span>
										</template>
										<span v-else class="text-sm text-gray-500 italic">
											No action.
											<span v-if="result.evaluation.comment" class="text-sm text-gray-500 italic">
												({{ result.evaluation.comment }})</span>
										</span>
									</div>
									<template v-if="result.evaluation.reasoning">
										<div class="mt-3 rounded-md bg-gray-50 border p-3">
											<p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">AI Reasoning</p>
											<p class="text-sm text-gray-700 whitespace-pre-wrap">{{ result.evaluation.reasoning }}</p>
										</div>
									</template>
									<template v-if="result.evaluation.prompt">
										<Collapsible class="mt-2">
											<CollapsibleTrigger
												class="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
												<Icon name="lucide:chevron-down"
													class="h-4 w-4 transition-transform duration-200" />
												Show Prompt
											</CollapsibleTrigger>
											<CollapsibleContent>
												<div class="text-sm text-gray-500 italic mt-2">
													<pre
														class="whitespace-pre-wrap">{{ result.evaluation.prompt }}</pre>
												</div>
											</CollapsibleContent>
										</Collapsible>
									</template>
								</div>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	</div>
</template>
