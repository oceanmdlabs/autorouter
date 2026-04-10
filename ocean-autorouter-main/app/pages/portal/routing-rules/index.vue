<script setup lang="ts">
import type { RoutingRule } from '@/src/entities/models/routing-rule';
import {
	getRoutingEventTypeDescription
} from "@/src/entities/models/routing-event-type";
const router = useRouter()
const { data: rules } = useAsyncData('rules', async () => {
	return await useRequestFetch()<RoutingRule[]>('/api/routing-rules');
});
const navigateToRule = (ruleId: string) => {
	router.push(`/portal/routing-rules/${ruleId}`);
}

// Track which rules are expanded
const expandedRules = ref<Set<string>>(new Set())

const toggleExpand = (ruleId: string) => {
	if (expandedRules.value.has(ruleId)) {
		expandedRules.value.delete(ruleId)
	} else {
		expandedRules.value.add(ruleId)
	}
}

const isExpanded = (ruleId: string) => expandedRules.value.has(ruleId)
</script>

<template>
	<div class="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
		<div class="space-y-6">
			<div>
				<h1 class="text-2xl font-semibold text-gray-900">Routing Rules</h1>
				<p class="mt-2 text-sm text-gray-600 leading-relaxed max-w-3xl">
					The directives below determine how the Autorouter handles incoming events.
				</p>
			</div>

			<div class="flex justify-end">
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
								<TableHead class="w-10"></TableHead>
								<TableHead>Name</TableHead>
								<TableHead>Triggering Event</TableHead>
								<TableHead>Est. Time Saved</TableHead>
								<TableHead>Status</TableHead>
								<TableHead class="w-20"></TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							<TableRow v-if="rules?.length === 0">
								<TableCell :colspan="6" class="text-center text-muted-foreground">
									No routes configured
								</TableCell>
							</TableRow>
							<template v-else v-for="rule in rules" :key="rule.id">
								<TableRow class="hover:bg-muted/50">
									<TableCell class="w-10" :class="[!rule.active && 'opacity-50']">
										<Button
											variant="ghost"
											size="sm"
											class="h-6 w-6 p-0"
											@click="toggleExpand(rule.id)"
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												class="h-4 w-4 transition-transform"
												:class="{ 'rotate-90': isExpanded(rule.id) }"
											>
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
											</svg>
										</Button>
									</TableCell>
									<TableCell :class="[!rule.active && 'opacity-50']">
										{{ rule.name }}
									</TableCell>
									<TableCell :class="[!rule.active && 'opacity-50']">{{ getRoutingEventTypeDescription(rule.triggeringEvent) }}</TableCell>
									<TableCell :class="[!rule.active && 'opacity-50']">
										<span v-if="rule.minutesSavedEstimate" class="text-green-600 font-medium">
											{{ rule.minutesSavedEstimate }} min
										</span>
										<span v-else class="text-muted-foreground text-sm">
											No estimate
										</span>
									</TableCell>
									<TableCell>
										<span :class="rule.active ? 'text-green-600 font-medium' : 'text-muted-foreground'">
											{{ rule.active ? 'Active' : 'Inactive' }}
										</span>
									</TableCell>
									<TableCell>
										<Button
											variant="outline"
											size="sm"
											@click="navigateToRule(rule.id)"
										>
											Edit
										</Button>
									</TableCell>
								</TableRow>
								<!-- Expanded row for instructions -->
								<TableRow v-if="isExpanded(rule.id)">
									<TableCell :colspan="6" class="bg-muted/30 border-t-0" :class="[!rule.active && 'opacity-50']">
										<div class="py-2 px-4">
											<div class="text-sm font-medium text-muted-foreground mb-1">Instructions:</div>
											<div class="whitespace-pre-wrap text-sm">{{ rule.prompt }}</div>
										</div>
									</TableCell>
								</TableRow>
							</template>
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</div>
	</div>
</template>
