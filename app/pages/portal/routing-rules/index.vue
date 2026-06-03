<script setup lang="ts">
import { handleMissingActiveTenantError } from '@/app/lib/active-tenant';
import type { RoutingRule } from '@/src/entities/models/routing-rule';
import { getRoutingEventTypeDescription } from "@/src/entities/models/routing-event-type";
import { ref, computed } from 'vue';
import { toast } from 'vue-sonner';

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
