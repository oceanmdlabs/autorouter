<script setup lang="ts">
import { handleMissingActiveTenantError } from '@/app/lib/active-tenant';
import type { RoutingRule } from '@/src/entities/models/routing-rule';
import { getRoutingEventTypeDescription } from "@/src/entities/models/routing-event-type";
import { ref, computed } from 'vue';
import { toast } from 'vue-sonner';
import { clientRoutingToolRegistry } from '@/src/entities/models/routing-tool-client';

const router = useRouter();
const requestFetch = useRequestFetch();

const { data: rules, refresh } = useAsyncData('rules', async () => {
	try {
		return await requestFetch<RoutingRule[]>('/api/routing-rules');
	} catch (error) {
		if (await handleMissingActiveTenantError(error, { notify: false })) {
			return [];
		}
		throw error;
	}
});

const navigateToRule = (ruleId: string) => {
	router.push(`/portal/routing-rules/${ruleId}`);
};

// Reorder state
const isReordering = ref(false);
const reorderList = ref<RoutingRule[]>([]);
const isSaving = ref(false);

const startReordering = () => {
	reorderList.value = [...(rules.value ?? [])];
	isReordering.value = true;
};

const cancelReordering = () => {
	isReordering.value = false;
	reorderList.value = [];
};

// Drag-and-drop
const dragIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);

const onDragStart = (index: number) => {
	dragIndex.value = index;
};

const onDragOver = (index: number) => {
	if (dragIndex.value === null || dragIndex.value === index) return;
	dragOverIndex.value = index;
};

const onDrop = (index: number) => {
	if (dragIndex.value === null || dragIndex.value === index) return;
	const items = [...reorderList.value];
	const [moved] = items.splice(dragIndex.value, 1);
	items.splice(index, 0, moved!);
	reorderList.value = items;
	dragIndex.value = null;
	dragOverIndex.value = null;
};

const onDragEnd = () => {
	dragIndex.value = null;
	dragOverIndex.value = null;
};

const saveOrder = async () => {
	isSaving.value = true;
	try {
		await requestFetch('/api/routing-rules/reorder', {
			method: 'PUT',
			body: { orderedIds: reorderList.value.map(r => r.id) },
		});
		await refresh();
		isReordering.value = false;
		reorderList.value = [];
		toast.success('Rule order saved');
	} catch {
		toast.error('Failed to save rule order');
	} finally {
		isSaving.value = false;
	}
};

// Static conflict hint: active rules sharing tools from the same blocking conflict group
// for the same event type. This is a coarse signal — use Testing to see actual conflicts.
const BLOCKING_CONFLICT_GROUPS = new Set(['referral-status', 'referral-destination']);

type StaticConflictHint = {
	eventTypeLabel: string;
	groupLabel: string;
	ruleNames: string[];
};

const staticConflictHints = computed<StaticConflictHint[]>(() => {
	const activeRules = (rules.value ?? []).filter((r) => r.active);
	const hints: StaticConflictHint[] = [];

	// Group active rules by event type
	const byEvent = new Map<string, RoutingRule[]>();
	for (const rule of activeRules) {
		const list = byEvent.get(rule.triggeringEvent) ?? [];
		list.push(rule);
		byEvent.set(rule.triggeringEvent, list);
	}

	for (const [event, eventRules] of byEvent.entries()) {
		if (eventRules.length < 2) continue;

		// Find which blocking conflict groups have more than one rule with that tool enabled
		const groupToRules = new Map<string, RoutingRule[]>();
		for (const rule of eventRules) {
			for (const toolName of rule.enabledTools) {
				const toolDef = clientRoutingToolRegistry[toolName];
				if (!toolDef?.conflictGroup || !BLOCKING_CONFLICT_GROUPS.has(toolDef.conflictGroup)) continue;
				const list = groupToRules.get(toolDef.conflictGroup) ?? [];
				if (!list.includes(rule)) list.push(rule);
				groupToRules.set(toolDef.conflictGroup, list);
			}
		}

		const groupLabels: Record<string, string> = {
			'referral-status': 'change referral status',
			'referral-destination': 'route the referral to a destination',
		};

		for (const [group, matchedRules] of groupToRules.entries()) {
			if (matchedRules.length < 2) continue;
			hints.push({
				eventTypeLabel: getRoutingEventTypeDescription(event as any),
				groupLabel: groupLabels[group] ?? group,
				ruleNames: matchedRules.map((r) => r.name),
			});
		}
	}

	return hints;
});
</script>

<template>
	<div class="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
		<div class="space-y-6">
			<div>
				<h1 class="text-2xl font-semibold text-gray-900">Routing Rules</h1>
				<p class="mt-2 text-sm text-gray-600 leading-relaxed max-w-3xl">
					The directives below determine how the Autorouter handles incoming events.
					Rules are evaluated in the order shown.
				</p>
			</div>

			<!-- Static conflict hints -->
			<div v-if="staticConflictHints.length > 0 && !isReordering" class="space-y-2">
				<div
					v-for="(hint, i) in staticConflictHints"
					:key="i"
					class="flex gap-3 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3"
				>
					<Icon name="lucide:triangle-alert" class="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
					<p class="text-sm text-yellow-800">
						<span class="font-medium">Potential conflict:</span>
						{{ hint.ruleNames.map(n => `"${n}"`).join(' and ') }} both have tools that can {{ hint.groupLabel }} for the <span class="font-medium">{{ hint.eventTypeLabel }}</span> event. Use the <NuxtLink to="/portal/testing" class="underline hover:text-yellow-600">Testing page</NuxtLink> to simulate these rules together and see the conflict analysis.
					</p>
				</div>
			</div>

			<!-- Normal view -->
			<template v-if="!isReordering">
				<div class="flex justify-end gap-2">
					<Button variant="outline" :disabled="!rules?.length" @click="startReordering">
						<IconGripVertical class="mr-2 h-4 w-4" />
						Reorder Rules
					</Button>
					<NuxtLink to="/portal/routing-rules/new">
						<Button>
							<IconPlusCircle class="mr-2 h-4 w-4" />
							Add Rule
						</Button>
					</NuxtLink>
				</div>

				<Card>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead class="w-8 text-center">#</TableHead>
									<TableHead>Name</TableHead>
									<TableHead>Triggering Event</TableHead>
									<TableHead>Instructions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								<TableRow v-if="rules?.length === 0">
									<TableCell :colspan="4" class="text-center text-muted-foreground">
										No routes configured
									</TableCell>
								</TableRow>
								<TableRow v-else v-for="(rule, index) in rules" :key="rule.id" :class="[
									'cursor-pointer hover:bg-muted/50',
									!rule.active && 'opacity-50'
								]" @click="navigateToRule(rule.id)">
									<TableCell class="text-center text-muted-foreground text-sm">
										{{ index + 1 }}
									</TableCell>
									<TableCell>
										<div class="flex items-center gap-2">
											{{ rule.name }}
											<span v-if="!rule.active"
												class="text-xs text-muted-foreground">(Inactive)</span>
										</div>
									</TableCell>
									<TableCell>{{ getRoutingEventTypeDescription(rule.triggeringEvent) }}</TableCell>
									<TableCell class="whitespace-pre-wrap">{{ rule.prompt }}</TableCell>
								</TableRow>
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			</template>

			<!-- Reorder view -->
			<template v-else>
				<div class="flex items-center justify-between">
					<p class="text-sm text-muted-foreground">
						Drag rules into execution order. The topmost rule runs first.
					</p>
					<div class="flex gap-2">
						<Button variant="outline" :disabled="isSaving" @click="cancelReordering">
							Cancel
						</Button>
						<Button :disabled="isSaving" @click="saveOrder">
							{{ isSaving ? 'Saving…' : 'Save Order' }}
						</Button>
					</div>
				</div>

				<Card>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead class="w-8" />
									<TableHead class="w-8 text-center">#</TableHead>
									<TableHead>Name</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								<TableRow
									v-for="(rule, index) in reorderList"
									:key="rule.id"
									draggable="true"
									class="cursor-grab select-none"
									:class="{
										'opacity-40': dragIndex === index,
										'border-t-2 border-primary': dragOverIndex === index && dragIndex !== index,
									}"
									@dragstart="onDragStart(index)"
									@dragover.prevent="onDragOver(index)"
									@drop.prevent="onDrop(index)"
									@dragend="onDragEnd"
								>
									<TableCell>
										<IconGripVertical class="h-4 w-4 text-muted-foreground" />
									</TableCell>
									<TableCell class="text-center text-muted-foreground text-sm">
										{{ index + 1 }}
									</TableCell>
									<TableCell>
										<div class="flex items-center gap-2">
											{{ rule.name }}
											<span v-if="!rule.active" class="text-xs text-muted-foreground">(Inactive)</span>
										</div>
									</TableCell>
								</TableRow>
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			</template>
		</div>
	</div>
</template>
