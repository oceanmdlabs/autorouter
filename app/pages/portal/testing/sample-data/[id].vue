<script setup lang="ts">
import { handleMissingActiveTenantError } from '@/app/lib/active-tenant';
import type { Bundle, Patient, Practitioner, PractitionerRole, QuestionnaireResponse, ServiceRequest, ContactPoint } from 'fhir/r4';
import { z } from 'zod';
import type { TestServiceRequest } from '@/src/entities/models/test-service-request';

// Form schema for the UI fields
const formSchema = z.object({
	id: z.string().optional(),
	name: z.string().min(1, "Name is required"),
	patientGivenName: z.string().min(1, "Given name is required"),
	patientFamilyName: z.string().min(1, "Family name is required"),
	patientBirthDate: z.string().min(1, "Birth date is required"),
	patientGender: z.enum(["male", "female", "other", "unknown"]),
	patientEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
	patientPhone: z.string().optional(),
	referralFormSummary: z.string().min(1, "Referral form summary is required"),
	healthServiceCategory: z.string().min(1, "Health service category is required"),
	referrerGivenName: z.string().min(1, "Referrer given name is required"),
	referrerFamilyName: z.string().min(1, "Referrer family name is required"),
});

const router = useRouter()
const route = useRoute()
const id = route.params.id as string
const isNew = id === 'new'
const requestFetch = useRequestFetch()

// State
const errors = ref<Record<string, string>>({})
const isLoading = ref(false)
const isJsonView = ref(false)
const jsonError = ref<string>('')
const rawJson = ref('')

const formValues = ref<z.infer<typeof formSchema>>({
	id: '',
	name: '',
	patientGivenName: '',
	patientFamilyName: '',
	patientBirthDate: '',
	patientGender: 'unknown',
	patientEmail: '',
	patientPhone: '',
	referralFormSummary: '',
	healthServiceCategory: '',
	referrerGivenName: '',
	referrerFamilyName: '',
})

// Get test service request
const { data: loadedData, pending } = useAsyncData('testServiceRequest', async () => {
	if (isNew) {
		return null;
	}

	try {
		const response = await requestFetch<TestServiceRequest>(`/api/test-service-requests/${id}`);
		if (!response) return null;

		// Set raw JSON for JSON mode
		const bundle = response.content as unknown as Bundle;
		return JSON.stringify(bundle, null, 2);
	} catch (error) {
		if (await handleMissingActiveTenantError(error, { notify: false })) {
			return null
		}
		throw error
	}
});

watch(() => loadedData.value, (data) => {
	if (!isNew && data) {
		rawJson.value = data;
		// Extract form fields from the FHIR Bundle
		const bundle = JSON.parse(data) as Bundle;
		const patient = bundle.entry?.find(
			(e) => e.resource?.resourceType === "Patient"
		)?.resource as Patient;
		const serviceRequest = bundle.entry?.find(
			(e) => e.resource?.resourceType === "ServiceRequest"
		)?.resource as ServiceRequest;
		const practitioner = bundle.entry?.find(
			(e) => e.resource?.resourceType === "Practitioner"
		)?.resource as Practitioner;

		// Extract email and phone from telecom array
		const email = patient?.telecom?.find(t => t.system === 'email')?.value;
		const phone = patient?.telecom?.find(t => t.system === 'phone')?.value;

		formValues.value = {
			id: id,
			name: bundle.identifier?.value ?? "",
			patientGivenName: patient?.name?.[0]?.given?.[0] ?? "",
			patientFamilyName: patient?.name?.[0]?.family ?? "",
			patientBirthDate: patient?.birthDate ?? "",
			patientGender: patient?.gender ?? "unknown",
			patientEmail: email ?? "",
			patientPhone: phone ?? "",
			referralFormSummary: serviceRequest?.text?.div ?? "",
			healthServiceCategory: serviceRequest?.orderDetail?.[0]?.text ?? "",
			referrerGivenName: practitioner?.name?.[0]?.given?.[0] ?? "",
			referrerFamilyName: practitioner?.name?.[0]?.family ?? "",
		};
	}
}, { immediate: true })

function createFhirBundle(formData: z.infer<typeof formSchema>): Bundle {
	const now = new Date().toISOString();
	const patient: Patient = {
		resourceType: "Patient",
		name: [
			{
				given: [formData.patientGivenName],
				family: formData.patientFamilyName,
			},
		],
		birthDate: formData.patientBirthDate,
		gender: formData.patientGender,
		telecom: [
			...(formData.patientEmail ? [{ system: "email" as const, value: formData.patientEmail } as ContactPoint] : []),
			...(formData.patientPhone ? [{ system: "phone" as const, value: formData.patientPhone } as ContactPoint] : []),
		],
	};

	const practitioner: Practitioner = {
		resourceType: "Practitioner",
		name: [
			{
				given: [formData.referrerGivenName],
				family: formData.referrerFamilyName,
			},
		],
	};

	const practitionerRole: PractitionerRole = {
		resourceType: "PractitionerRole",
		practitioner: {
			reference: "Practitioner/1",
		},
	};

	const serviceRequest: ServiceRequest = {
		resourceType: "ServiceRequest",
		status: "active",
		intent: "order",
		subject: {
			reference: "Patient/1",
		},
		requester: {
			reference: "PractitionerRole/1",
		},
		text: { div: formData.referralFormSummary, status: "generated" },
		orderDetail: [{ text: formData.healthServiceCategory }],
	};

	return {
		resourceType: "Bundle",
		type: "collection",
		timestamp: now,
		identifier: { value: formData.name },
		entry: [
			{ resource: patient, fullUrl: "Patient/1" },
			{ resource: practitioner, fullUrl: "Practitioner/1" },
			{ resource: practitionerRole, fullUrl: "PractitionerRole/1" },
			{ resource: serviceRequest, fullUrl: "ServiceRequest/1" },
		],
	};
}

function validateAndParseJson(json: string): Bundle | null {
	try {
		const parsed = JSON.parse(json);
		// Basic validation that it's a FHIR Bundle
		if (parsed.resourceType !== 'Bundle' || !Array.isArray(parsed.entry)) {
			jsonError.value = 'Invalid FHIR Bundle structure';
			return null;
		}
		jsonError.value = '';
		return parsed;
	} catch (e) {
		jsonError.value = 'Invalid JSON';
		return null;
	}
}

// Form submission
async function handleSubmit() {
	isLoading.value = true
	errors.value = {}

	try {
		let bundle: Bundle;

		if (isJsonView.value) {
			const parsed = validateAndParseJson(rawJson.value);
			if (!parsed) {
				return;
			}
			bundle = parsed;
		} else {
			// Validate form data
			const result = formSchema.safeParse(formValues.value)
			if (!result.success) {
				errors.value = Object.fromEntries(
					Object.entries(result.error.formErrors.fieldErrors).map(([k, v]) => [k, v?.[0] ?? ''])
				)
				return
			}
			bundle = createFhirBundle(result.data)
		}

		if (isNew) {
			await requestFetch<TestServiceRequest>('/api/test-service-requests', {
				method: 'POST',
				body: { content: bundle }
			})
		} else {
			await requestFetch<TestServiceRequest>(`/api/test-service-requests/${id}`, {
				method: 'PUT',
				body: { id, content: bundle }
			})
		}

		// Navigate back to list on success
		router.push('/portal/testing/sample-data')
	} catch (error: any) {
		if (await handleMissingActiveTenantError(error)) {
			return
		}
		console.error('Failed to save test service request:', error)
		errors.value = { error: 'Failed to save test service request' }
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
		await requestFetch(`/api/test-service-requests/${id}`, {
			method: 'DELETE'
		})
		router.push('/portal/testing/sample-data')
	} catch (error) {
		if (await handleMissingActiveTenantError(error)) {
			return
		}
		console.error('Failed to delete test service request:', error)
		errors.value = { error: 'Failed to delete test service request' }
	}
}

// Update raw JSON when form fields change (not on initial load)
watch(() => ({ ...formValues.value }), (newVal, oldVal) => {
	if (!isJsonView.value && rawJson.value && oldVal) {  // oldVal check ensures this doesn't run on initial load
		try {
			const bundle = JSON.parse(rawJson.value) as Bundle;

			// Find existing resources
			const patientEntry = bundle.entry?.find(e => e.resource?.resourceType === "Patient");
			const serviceRequestEntry = bundle.entry?.find(e => e.resource?.resourceType === "ServiceRequest");
			const practitionerEntry = bundle.entry?.find(e => e.resource?.resourceType === "Practitioner");

			// Update bundle identifier
			bundle.identifier = { value: newVal.name };

			// Update existing resources with form values
			if (patientEntry?.resource) {
				const patient = patientEntry.resource as Patient;
				// Preserve existing name array and only update the first given name and family name
				const existingName = patient.name?.[0] ?? {};
				patient.name = [{
					...existingName,
					given: [
						newVal.patientGivenName,
						...(existingName.given?.slice(1) ?? [])  // preserve other given names
					],
					family: newVal.patientFamilyName
				}];
				patient.birthDate = newVal.patientBirthDate;
				patient.gender = newVal.patientGender;
				patient.telecom = [
					...(newVal.patientEmail ? [{ system: "email" as const, value: newVal.patientEmail } as ContactPoint] : []),
					...(newVal.patientPhone ? [{ system: "phone" as const, value: newVal.patientPhone } as ContactPoint] : []),
				];
			}

			if (practitionerEntry?.resource) {
				const practitioner = practitionerEntry.resource as Practitioner;
				// Preserve existing name array and only update the first given name and family name
				const existingName = practitioner.name?.[0] ?? {};
				practitioner.name = [{
					...existingName,
					given: [
						newVal.referrerGivenName,
						...(existingName.given?.slice(1) ?? [])  // preserve other given names
					],
					family: newVal.referrerFamilyName
				}];
			}

			if (serviceRequestEntry?.resource) {
				const serviceRequest = serviceRequestEntry.resource as ServiceRequest;
				serviceRequest.text = { div: newVal.referralFormSummary, status: "generated" };
				serviceRequest.orderDetail = [{ text: newVal.healthServiceCategory }];
			}

			// Only update rawJson if we successfully modified the bundle
			rawJson.value = JSON.stringify(bundle, null, 2);
		} catch (e) {
			console.error('Failed to update JSON from form:', e);
		}
	}
}, { deep: true });

// Update form when valid JSON changes
watchEffect(() => {
	if (isJsonView.value && rawJson.value) {
		const bundle = validateAndParseJson(rawJson.value);
		if (bundle) {
			const serviceRequest = bundle.entry?.find(
				(e) => e.resource?.resourceType === "ServiceRequest"
			)?.resource as ServiceRequest;
			const patient = bundle.entry?.find(
				(e) => e.resource?.resourceType === "Patient"
			)?.resource as Patient;
			const practitioner = bundle.entry?.find(
				(e) => e.resource?.resourceType === "Practitioner"
			)?.resource as Practitioner;

			// Extract email and phone from telecom array
			const email = patient?.telecom?.find(t => t.system === 'email')?.value;
			const phone = patient?.telecom?.find(t => t.system === 'phone')?.value;

			formValues.value = {
				name: bundle.identifier?.value ?? "",
				patientGivenName: patient?.name?.[0]?.given?.[0] ?? "",
				patientFamilyName: patient?.name?.[0]?.family ?? "",
				patientBirthDate: patient?.birthDate ?? "",
				patientGender: patient?.gender ?? "unknown",
				patientEmail: email ?? "",
				patientPhone: phone ?? "",
				referralFormSummary: serviceRequest?.text?.div ?? "",
				healthServiceCategory: serviceRequest?.orderDetail?.[0]?.text ?? "",
				referrerGivenName: practitioner?.name?.[0]?.given?.[0] ?? "",
				referrerFamilyName: practitioner?.name?.[0]?.family ?? "",
			};
		}
	}
});
</script>

<template>
	<Card>
		<form @submit.prevent="handleSubmit">
			<CardHeader class="flex flex-row items-center justify-between">
				<div class="space-y-2">
					<CardTitle>{{ isNew ? 'New Sample Service Request' : 'Edit Sample Service Request' }}</CardTitle>
					<p class="text-sm text-muted-foreground">
						This form helps you create test service requests that mimic real-world eReferrals and eConsults.
						Use it to describe scenarios that test your routing rules. Include
						relevant clinical details, patient demographics, and referrer information to simulate realistic
						routing scenarios.
					</p>
				</div>
				<div class="flex gap-2">
					<Button variant="outline" type="button" @click="isJsonView = !isJsonView">
						{{ isJsonView ? 'Form View' : 'JSON View' }}
					</Button>
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

			<CardContent v-if="!pending">
				<div v-if="Object.keys(errors).length > 0" class="mb-4">
					<p class="text-destructive">
						{{Object.entries(errors).map(([k, v]) => `${k}: ${v}`).join('; ')}}
					</p>
				</div>

				<div v-if="jsonError" class="mb-4">
					<p class="text-destructive">{{ jsonError }}</p>
				</div>

				<div v-if="isJsonView" class="space-y-4">
					<div class="space-y-2">
						<Label for="json">FHIR Bundle JSON</Label>
						<Textarea id="json" v-model="rawJson" class="font-mono min-h-[500px]" />
					</div>
				</div>

				<div v-else class="space-y-6">
					<div class="space-y-2">
						<Label for="name">Name</Label>
						<Input id="name" v-model="formValues.name" :aria-invalid="errors.name ? 'true' : undefined" />
						<p v-if="errors.name" class="text-sm text-destructive">
							{{ errors.name }}
						</p>
					</div>

					<div class="space-y-2">
						<Label for="healthServiceCategory">Health Service Category</Label>
						<Input id="healthServiceCategory" v-model="formValues.healthServiceCategory"
							:aria-invalid="errors.healthServiceCategory ? 'true' : undefined" />
						<p v-if="errors.healthServiceCategory" class="text-sm text-destructive">
							{{ errors.healthServiceCategory }}
						</p>
					</div>

					<div class="space-y-4">
						<h3 class="font-medium">Patient Information</h3>
						<div class="grid grid-cols-2 gap-4">
							<div class="space-y-2">
								<Input v-model="formValues.patientGivenName" placeholder="Given Name"
									:aria-invalid="errors.patientGivenName ? 'true' : undefined" />
								<p v-if="errors.patientGivenName" class="text-sm text-destructive">
									{{ errors.patientGivenName }}
								</p>
							</div>
							<div class="space-y-2">
								<Input v-model="formValues.patientFamilyName" placeholder="Family Name"
									:aria-invalid="errors.patientFamilyName ? 'true' : undefined" />
								<p v-if="errors.patientFamilyName" class="text-sm text-destructive">
									{{ errors.patientFamilyName }}
								</p>
							</div>
							<div class="space-y-2">
								<Input v-model="formValues.patientBirthDate" type="date" placeholder="Birth Date"
									:aria-invalid="errors.patientBirthDate ? 'true' : undefined" />
								<p v-if="errors.patientBirthDate" class="text-sm text-destructive">
									{{ errors.patientBirthDate }}
								</p>
							</div>
							<div class="space-y-2">
								<Select v-model="formValues.patientGender">
									<SelectTrigger>
										<SelectValue placeholder="Select gender" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="male">Male</SelectItem>
										<SelectItem value="female">Female</SelectItem>
										<SelectItem value="other">Other</SelectItem>
										<SelectItem value="unknown">Unknown</SelectItem>
									</SelectContent>
								</Select>
								<p v-if="errors.patientGender" class="text-sm text-destructive">
									{{ errors.patientGender }}
								</p>
							</div>
						</div>
					</div>

					<div class="space-y-4">
						<h3 class="font-medium">Email and Phone</h3>
						<div class="grid grid-cols-2 gap-4">
							<div class="space-y-2">
								<Input v-model="formValues.patientEmail" placeholder="Email"
									:aria-invalid="errors.patientEmail ? 'true' : undefined" />
								<p v-if="errors.patientEmail" class="text-sm text-destructive">
									{{ errors.patientEmail }}
								</p>
							</div>
							<div class="space-y-2">
								<Input v-model="formValues.patientPhone" placeholder="Phone"
									:aria-invalid="errors.patientPhone ? 'true' : undefined" />
								<p v-if="errors.patientPhone" class="text-sm text-destructive">
									{{ errors.patientPhone }}
								</p>
							</div>
						</div>
					</div>

					<div class="space-y-4">
						<h3 class="font-medium">Referral Form Summary / Clinical History</h3>
						<div class="space-y-2">
							<Textarea v-model="formValues.referralFormSummary"
								placeholder="Summarize the relevant clinical history relevant to your testing. You could use a referral form summary sanitized from an existing referral form, or a clinical note summary."
								:aria-invalid="errors.referralFormSummary ? 'true' : undefined" class="min-h-[100px]" />
							<p v-if="errors.referralFormSummary" class="text-sm text-destructive">
								{{ errors.referralFormSummary }}
							</p>
						</div>
					</div>

					<div class="space-y-4">
						<h3 class="font-medium">Referrer Information</h3>
						<div class="grid grid-cols-2 gap-4">
							<div class="space-y-2">
								<Input v-model="formValues.referrerGivenName" placeholder="Given Name"
									:aria-invalid="errors.referrerGivenName ? 'true' : undefined" />
								<p v-if="errors.referrerGivenName" class="text-sm text-destructive">
									{{ errors.referrerGivenName }}
								</p>
							</div>
							<div class="space-y-2">
								<Input v-model="formValues.referrerFamilyName" placeholder="Family Name"
									:aria-invalid="errors.referrerFamilyName ? 'true' : undefined" />
								<p v-if="errors.referrerFamilyName" class="text-sm text-destructive">
									{{ errors.referrerFamilyName }}
								</p>
							</div>
						</div>
					</div>
				</div>
			</CardContent>
			<CardContent v-else>
				<FormSkeleton />
			</CardContent>
		</form>
	</Card>
</template>
