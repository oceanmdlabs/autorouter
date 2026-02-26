<script setup lang="ts">
import type { Bundle, Patient, Practitioner, ServiceRequest } from 'fhir/r4';
import type { TestServiceRequest } from '@/src/entities/models/test-service-request';

const router = useRouter()
const { data: testServiceRequests } = useAsyncData('testServiceRequests', async () => {
	return await useRequestFetch()<TestServiceRequest[]>('/api/test-service-requests');
});

function getPatient(request: TestServiceRequest): Patient | undefined {
	const bundle = request.content as unknown as Bundle;
	return bundle.entry?.find(
		(e) => e.resource?.resourceType === "Patient"
	)?.resource as Patient;
}

function getPractitioner(request: TestServiceRequest): Practitioner | undefined {
	const bundle = request.content as unknown as Bundle;
	return bundle.entry?.find(
		(e) => e.resource?.resourceType === "Practitioner"
	)?.resource as Practitioner;
}

function formatPatientName(patient?: Patient): string {
	if (!patient?.name?.[0]) return 'Unknown';
	const name = patient.name[0];
	return `${name.given?.[0] ?? ''} ${name.family ?? ''}`.trim();
}

function formatPractitionerName(practitioner?: Practitioner): string {
	if (!practitioner?.name?.[0]) return 'Unknown';
	const name = practitioner.name[0];
	return `${name.given?.[0] ?? ''} ${name.family ?? ''}`.trim();
}

const navigateToRequest = (requestId: string) => {
	router.push(`/portal/testing/sample-data/${requestId}`);
}
</script>

<template>
	<Card>
		<CardHeader class="flex flex-row items-center justify-between">
			<div class="flex items-center gap-2">
				<NuxtLink to="/portal/testing">
					<Button variant="ghost" class="h-9 w-9 p-0">
						<IconArrowLeft class="h-4 w-4" />
						<span class="sr-only">Go back</span>
					</Button>
				</NuxtLink>
				<CardTitle>Sample eReferrals and eConsults</CardTitle>
			</div>
			<div class="flex gap-2">
				<NuxtLink to="/portal/testing/sample-data/new">
					<Button>
						<IconPlusCircle class="mr-2 h-4 w-4" />
						New Sample Service Request
					</Button>
				</NuxtLink>
			</div>
		</CardHeader>
		<CardContent>
			<p class="text-sm text-gray-600 leading-relaxed max-w-3xl">
				The sample service requests below can be used to test the Autorouter.
			</p>
			<Table class="mt-4">
				<TableHeader>
					<TableRow>
						<TableHead>Name</TableHead>
						<TableHead>Patient</TableHead>
						<TableHead>Referrer</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					<TableRow v-if="testServiceRequests?.length === 0">
						<TableCell :colspan="3" class="text-center text-muted-foreground">
							No sample eReferrals found
						</TableCell>
					</TableRow>
					<TableRow v-else v-for="request in testServiceRequests" :key="request.id"
						class="cursor-pointer hover:bg-muted/50" @click="navigateToRequest(request.id)">
						<TableCell>{{ (request.content as unknown as Bundle).identifier?.value ?? 'Unnamed' }}
						</TableCell>
						<TableCell>{{ formatPatientName(getPatient(request)) }}</TableCell>
						<TableCell>{{ formatPractitionerName(getPractitioner(request)) }}</TableCell>
					</TableRow>
				</TableBody>
			</Table>
		</CardContent>
	</Card>
</template>
