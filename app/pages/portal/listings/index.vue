<script setup lang="ts">
import { handleMissingActiveTenantError } from '@/app/lib/active-tenant';
import type { HealthcareService } from '@/src/entities/models/healthcare-service';

const requestFetch = useRequestFetch()
const { data: services } = useAsyncData('services', async () => {
	try {
		return await requestFetch<HealthcareService[]>('/api/healthcare-services');
	} catch (error) {
		if (await handleMissingActiveTenantError(error, { notify: false })) {
			return [];
		}
		throw error;
	}
});

const router = useRouter()
const navigateToListing = (listingId: string) => {
	router.push(`/portal/listings/${listingId}`);
}
</script>

<template>
	<div class="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
		<div class="space-y-6">
			<div>
				<h1 class="text-2xl font-semibold text-gray-900">Healthcare Service Listings</h1>
				<p class="mt-2 text-sm text-gray-600 leading-relaxed max-w-3xl">
					The Ocean Directory Listings configured here are accessible to the Autorouter for assignment and
					forwarding.
					<!-- You can add information such as service constraints and wait times to each listing to help the Autorouter
					make informed decisions. (not yet supported)-->
				</p>
			</div>

			<div class="flex justify-end">
				<NuxtLink to="/portal/listings/new">
					<Button>
						<IconPlusCircle class="mr-2 h-4 w-4" />
						Add Listing
					</Button>
				</NuxtLink>
			</div>

			<Card>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Description</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							<TableRow v-if="services?.length === 0">
								<TableCell :colspan="2" class="text-center text-muted-foreground">
									No services found
								</TableCell>
							</TableRow>
							<TableRow v-else v-for="service in services" :key="service.id"
								class="cursor-pointer hover:bg-muted/50" @click="navigateToListing(service.id)">
								<TableCell>{{ service.name }}</TableCell>
								<TableCell>{{ service.description }}</TableCell>
							</TableRow>
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</div>
	</div>
</template>
