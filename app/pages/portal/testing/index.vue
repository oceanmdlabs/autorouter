<script setup lang="ts">
import { handleMissingActiveTenantError } from '@/app/lib/active-tenant';
import type { TestServiceRequest } from '@/src/entities/models/test-service-request';
import { routingEventTypeSchema, getRoutingEventTypeDescription } from '@/src/entities/models/routing-event-type';
import type { Bundle } from 'fhir/r4';
import type { RuleEvaluationResult } from '@/src/entities/models/routing-evaluation';
import type { DryRunPayload } from '@/src/entities/models/routing-tool';
import { clientRoutingToolRegistry } from '@/src/entities/models/routing-tool-client';
import type { RoutingToolName } from '@/src/infrastructure/services/routing-tools/routing-tool-registry';

function describeAction(action: { tool: string; input: Record<string, any> }): { type: string; taken: string } {
	const tool = clientRoutingToolRegistry[action.tool as RoutingToolName];
	if (tool?.actionType && tool?.getActionTaken) {
		return { type: tool.actionType, taken: tool.getActionTaken(action.input) };
	}
	return { type: action.tool, taken: 'Action taken' };
}

const EVENT_TYPES = routingEventTypeSchema.options.map((event) => ({
	label: getRoutingEventTypeDescription(event),
	value: event,
}));

// State
const selectedRequest = ref('')
const selectedEvent = ref('')
const mode = ref<'evaluate' | 'dry-run'>('evaluate')
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
				mode: mode.value,
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

function payloadTypeLabel(payloadType: DryRunPayload['payloadType']): string {
	const labels: Record<DryRunPayload['payloadType'], string> = {
		'ocean-fhir-message': 'Ocean API (FHIR)',
		'email': 'Email',
		'sms': 'SMS',
		'internal': 'Internal',
		'cds-card': 'CDS Card',
	};
	return labels[payloadType] ?? payloadType;
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

							<div class="flex items-center gap-4">
								<div class="flex rounded-md border overflow-hidden text-sm">
									<button
										type="button"
										class="px-3 py-1.5 transition-colors"
										:class="mode === 'evaluate' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'"
										@click="mode = 'evaluate'"
									>
										Evaluate
									</button>
									<button
										type="button"
										class="px-3 py-1.5 border-l transition-colors"
										:class="mode === 'dry-run' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'"
										@click="mode = 'dry-run'"
									>
										Dry Run
									</button>
								</div>
								<Button type="submit" :disabled="!selectedRequest || !selectedEvent || isLoading"
									:loading="isLoading">
									{{ mode === 'dry-run' ? 'Preview Payloads' : 'Simulate Event' }}
								</Button>
							</div>
							<p v-if="mode === 'dry-run'" class="text-xs text-muted-foreground">
								Dry run renders the exact outbound payloads that would be sent — no actions are executed.
							</p>
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
									class="rounded-lg border space-y-2 p-4 shadow-sm"
									:class="result.stoppedByRuleId ? 'opacity-50 bg-gray-50' : ''">
									<!-- List each rule's evaluation result -->
									<div class="flex items-center gap-2">
										<h3 class="text-lg font-semibold">{{ result.ruleName }}</h3>
										<span v-if="result.stoppedByRuleId"
											class="text-xs font-medium text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
											Skipped
										</span>
									</div>
									<p v-if="result.stoppedByRuleId" class="text-sm text-muted-foreground italic">
										Not evaluated — "{{ result.stoppedByRuleName }}" stopped processing.
									</p>
									<div v-else class="space-y-2">
										<template v-if="result.evaluation.actions.length > 0" class="space-y-2">
											<div v-for="(action, index) in result.evaluation.actions" :key="index"
												class="space-y-2">
												<div class="flex items-start gap-2 text-sm">
													<Icon name="lucide:check" class="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
													<div class="text-muted-foreground whitespace-pre-wrap">
														<template v-if="describeAction(action).type">
															<span class="font-medium text-foreground">Action Type:</span> {{ describeAction(action).type }}<br/>
														</template>
														<span class="font-medium text-foreground">Action Taken:</span> {{ describeAction(action).taken }}
													</div>
												</div>
												<!-- Dry run payload -->
												<div v-if="(action as any).dryRunPayload" class="ml-6">
													<div v-if="(action as any).dryRunPayload.error" class="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
														<span class="font-medium">Payload error:</span> {{ (action as any).dryRunPayload.error }}
													</div>
													<template v-else>
														<Collapsible>
															<CollapsibleTrigger class="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800">
																<Icon name="lucide:chevron-down" class="h-3 w-3 transition-transform duration-200" />
																View {{ payloadTypeLabel((action as any).dryRunPayload.payloadType) }} payload
															</CollapsibleTrigger>
															<CollapsibleContent>
																<div class="mt-2 rounded-md border bg-gray-50 p-3 text-xs">
																	<!-- Email payload -->
																	<template v-if="(action as any).dryRunPayload.payloadType === 'email'">
																		<div class="space-y-1 font-mono">
																			<div><span class="font-semibold text-gray-600">To:</span> {{ (action as any).dryRunPayload.payload.to }}</div>
																			<div v-if="(action as any).dryRunPayload.payload.cc"><span class="font-semibold text-gray-600">CC:</span> {{ (action as any).dryRunPayload.payload.cc }}</div>
																			<div v-if="(action as any).dryRunPayload.payload.bcc"><span class="font-semibold text-gray-600">BCC:</span> {{ (action as any).dryRunPayload.payload.bcc }}</div>
																			<div><span class="font-semibold text-gray-600">Subject:</span> {{ (action as any).dryRunPayload.payload.subject }}</div>
																			<hr class="my-2 border-gray-200" />
																			<div class="whitespace-pre-wrap text-gray-700">{{ (action as any).dryRunPayload.payload.message }}</div>
																		</div>
																	</template>
																	<!-- SMS payload -->
																	<template v-else-if="(action as any).dryRunPayload.payloadType === 'sms'">
																		<div class="space-y-1 font-mono">
																			<div><span class="font-semibold text-gray-600">To:</span> {{ (action as any).dryRunPayload.payload.to }}</div>
																			<div><span class="font-semibold text-gray-600">Message:</span> {{ (action as any).dryRunPayload.payload.message }}</div>
																		</div>
																	</template>
																	<!-- CDS card payload -->
																	<template v-else-if="(action as any).dryRunPayload.payloadType === 'cds-card'">
																		<div class="space-y-1">
																			<div><span class="font-semibold text-gray-600">Severity:</span> {{ (action as any).dryRunPayload.payload.severity }}</div>
																			<div><span class="font-semibold text-gray-600">Title:</span> {{ (action as any).dryRunPayload.payload.title }}</div>
																			<div><span class="font-semibold text-gray-600">Message:</span> {{ (action as any).dryRunPayload.payload.message }}</div>
																		</div>
																	</template>
																	<!-- Internal payload -->
																	<template v-else-if="(action as any).dryRunPayload.payloadType === 'internal'">
																		<pre class="whitespace-pre-wrap text-gray-700">{{ JSON.stringify((action as any).dryRunPayload.payload, null, 2) }}</pre>
																	</template>
																	<!-- FHIR payload -->
																	<template v-else>
																		<pre class="whitespace-pre-wrap text-gray-700 max-h-96 overflow-y-auto">{{ JSON.stringify((action as any).dryRunPayload.payload, null, 2) }}</pre>
																	</template>
																</div>
															</CollapsibleContent>
														</Collapsible>
													</template>
												</div>
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
									<template v-if="!result.stoppedByRuleId && result.evaluation.reasoning">
										<div class="mt-3 rounded-md bg-gray-50 border p-3">
											<p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">AI Reasoning</p>
											<p class="text-sm text-gray-700 whitespace-pre-wrap">{{ result.evaluation.reasoning }}</p>
										</div>
									</template>
									<template v-if="!result.stoppedByRuleId && result.evaluation.prompt">
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
