<script setup lang="ts">
import { handleMissingActiveTenantError } from '@/app/lib/active-tenant';
import type { RoutingRule } from '@/src/entities/models/routing-rule';
import {
	getRoutingEventTypeDescription
} from "@/src/entities/models/routing-event-type";
const router = useRouter()
const requestFetch = useRequestFetch()
const { data: rules } = useAsyncData('rules', async () => {
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
}
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
								<TableHead>Name</TableHead>
								<TableHead>Triggering Event</TableHead>
								<TableHead>Instructions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							<TableRow v-if="rules?.length === 0">
								<TableCell :colspan="3" class="text-center text-muted-foreground">
									No routes configured
								</TableCell>
							</TableRow>
							<TableRow v-else v-for="rule in rules" :key="rule.id" :class="[
								'cursor-pointer hover:bg-muted/50',
								!rule.active && 'opacity-50'
							]" @click="navigateToRule(rule.id)">
								<TableCell>
									<div class="flex items-center gap-2">
										{{ rule.name }}
										<span v-if="!rule.active"
											class="text-xs text-muted-foreground">(Inactive)</span>
									</div>
								</TableCell>
								<TableCell>{{ getRoutingEventTypeDescription(rule.triggeringEvent) }}
								</TableCell>
								<TableCell class="whitespace-pre-wrap">{{ rule.prompt }}</TableCell>
							</TableRow>
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</div>
	</div>
</template>
