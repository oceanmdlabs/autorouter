<script setup lang="ts">
import { AlertCircle, AlertTriangle, CheckCircle, Copy, Eye, EyeOff } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { formatTimestampWithMinutePrecision } from '@/shared/lib/utils';
import { getOceanServerUrl } from '@/src/application/services/ocean-server.utils';
import type { NewSiteConfiguration, SiteConfiguration } from '@/src/entities/models/site-configuration';
import { uuid } from '@/src/entities/models/uuid';
const errors = ref<Record<string, string>>({})
const isSubmitting = ref(false)
const formValues = ref<NewSiteConfiguration | null>(null)
const isNewConfig = ref(false)
const showEmptyState = ref(false)
const lastSuccessfulConnection = ref<Date | null>(null)
const { user } = useUserSession()
const hadPreviousConfig = ref(false)
const isTestingConnection = ref(false)
const testConnectionResult = ref<{ success: boolean; error?: string } | null>(null)

const showClientSecret = ref(false);
const showOceanClientSecret = ref(false);
const showTwilioAuthToken = ref(false);
const showAiApiKey = ref(false);
const showEmailApiKey = ref(false);
const showSiteKey = ref(false);
const showSiteCredential = ref(false);
const showSharedEncryptionKey = ref(false);

// Test email and SMS variables
const isTestingEmail = ref(false)
const testEmailResult = ref<{ success: boolean; error?: string } | null>(null)
const testEmailTo = ref('')
const testEmailSubject = ref('Test Email from Ocean Autorouter')
const testEmailMessage = ref('This is a test email to verify your email configuration is working correctly.')

const isTestingSms = ref(false)
const testSmsResult = ref<{ success: boolean; error?: string } | null>(null)
const testSmsTo = ref('')
const testSmsMessage = ref('This is a test SMS to verify your SMS configuration is working correctly.')

// Check localStorage on component mount
onMounted(() => {
	const hasHadConfig = localStorage.getItem('hadSiteConfiguration') === 'true'
	hadPreviousConfig.value = hasHadConfig
})
const host = useRequestURL().host;
const tokenEndpoint = computed(() => {
	return `${host}/api/oauth2/token`
})
const apiEndpoint = computed(() => {
	return `${host}/api/fhir/$process-message`
})
const cdsHookEndpoint = computed(() => {
	return `${host}/api/cds`
})
const hasChanges = computed(() => {
	const loadedSite = loadedData.value?.siteConfig;
	if (!loadedSite) return true;
	if (!formValues.value) return false;
	return loadedSite.name !== formValues.value.name ||
		loadedSite.clientId !== formValues.value.clientId ||
		loadedSite.clientSecret !== formValues.value.clientSecret ||
		loadedSite.oceanServer !== formValues.value.oceanServer ||
		loadedSite.oceanSiteNum !== formValues.value.oceanSiteNum ||
		loadedSite.oceanClientId !== formValues.value.oceanClientId ||
		loadedSite.oceanClientSecret !== formValues.value.oceanClientSecret ||
		loadedSite.twilioAccountSid !== formValues.value.twilioAccountSid ||
		loadedSite.twilioAuthToken !== formValues.value.twilioAuthToken ||
		loadedSite.twilioPhoneNumber !== formValues.value.twilioPhoneNumber ||
		loadedSite.aiProvider !== formValues.value.aiProvider ||
		loadedSite.aiApiKey !== formValues.value.aiApiKey ||
		loadedSite.aiModel !== formValues.value.aiModel ||
		loadedSite.emailProvider !== formValues.value.emailProvider ||
		loadedSite.emailFromAddress !== formValues.value.emailFromAddress ||
		loadedSite.emailApiKey !== formValues.value.emailApiKey ||
		loadedSite.emailFromName !== formValues.value.emailFromName ||
		loadedSite.siteKey !== formValues.value.siteKey ||
		loadedSite.siteCredential !== formValues.value.siteCredential ||
		loadedSite.sharedEncryptionKey !== formValues.value.sharedEncryptionKey
});
const { data: loadedData, status } = useAsyncData('site', async () => {
	return await useRequestFetch()<{
		siteConfig: SiteConfiguration | null;
	}>(`/api/site-configuration`)
});

watch(() => loadedData.value, (data) => {
	if (status.value === 'pending') return;
	const site = data?.siteConfig;
	if (!site) {
		formValues.value = {
			id: uuid(),
			name: '',
			clientId: uuid(),
			clientSecret: uuid(),
			oceanServer: 'ocean',
			oceanSiteNum: '',
			oceanClientId: '',
			oceanClientSecret: ''
		}
		isNewConfig.value = true;
		showEmptyState.value = true;
	} else {
		// Store the fact that we've had a configuration
		localStorage.setItem('hadSiteConfiguration', 'true')
		hadPreviousConfig.value = true
		lastSuccessfulConnection.value = site.lastSuccessfulConnection ?? null
		formValues.value = {
			id: site.id,
			name: site.name,
			clientId: site.clientId,
			clientSecret: site.clientSecret,
			oceanServer: site.oceanServer,
			oceanSiteNum: site.oceanSiteNum,
			oceanClientId: site.oceanClientId,
			oceanClientSecret: site.oceanClientSecret,
			twilioAccountSid: site.twilioAccountSid ?? '',
			twilioAuthToken: site.twilioAuthToken ?? '',
			twilioPhoneNumber: site.twilioPhoneNumber ?? '',
			aiProvider: site.aiProvider ?? 'openai',
			aiApiKey: site.aiApiKey,
			aiModel: site.aiModel,
			emailProvider: site.emailProvider ?? 'smtp2go',
			emailFromAddress: site.emailFromAddress ?? '',
			emailApiKey: site.emailApiKey ?? '',
			emailFromName: site.emailFromName ?? '',
			siteKey: site.siteKey ?? '',
			siteCredential: site.siteCredential ?? '',
			sharedEncryptionKey: site.sharedEncryptionKey ?? ''
		};
		showEmptyState.value = false;
	}
}, { immediate: true });

const oceanServerUrl = computed(() => {
	return getOceanServerUrl(formValues.value?.oceanServer ?? 'ocean');
});

const isRecentSuccessfulInboundConnection = computed(() => {
	if (!lastSuccessfulConnection.value) return false;
	return new Date().getTime() - new Date(lastSuccessfulConnection.value).getTime() <= 24 * 60 * 60 * 1000;
});

async function handleSubmit() {
	isSubmitting.value = true
	errors.value = {}
	try {
		loadedData.value = {
			siteConfig: await $fetch<SiteConfiguration>('/api/site-configuration', {
				method: 'POST',
				body: formValues.value
			})
		}
		isNewConfig.value = false;
	} catch (error: any) {
		console.error('Failed to save site configuration:', error)
		if (error.data?.data?.name === 'ZodError' && Array.isArray(error.data.data.issues)) {
			// Map Zod validation errors to form fields
			error.data.data.issues.forEach((issue: { path: string[], message: string }) => {
				const fieldName = issue.path[issue.path.length - 1]
				if (fieldName) {
					errors.value[fieldName] = issue.message
				}
			})
		}
		// Add a catch-all error if there are no field-specific errors
		if (Object.keys(errors.value).length === 0) {
			errors.value.general = 'Failed to save site configuration'
		}
	} finally {
		isSubmitting.value = false
	}
}

function handleCreateConfig() {
	showEmptyState.value = false;
}

async function handleTestConnection() {
	if (!formValues.value) return;

	isTestingConnection.value = true;
	testConnectionResult.value = null;

	try {
		const response = await $fetch<{ success: boolean; error?: string }>('/api/site-configuration/test-connection', {
			method: 'POST',
			body: {
				oceanServer: formValues.value.oceanServer.trim(),
				oceanClientId: formValues.value.oceanClientId.trim(),
				oceanClientSecret: formValues.value.oceanClientSecret.trim(),
			},
		});
		testConnectionResult.value = response;
	} catch (error: any) {
		testConnectionResult.value = {
			success: false,
			error: error.data?.error || 'Failed to test connection',
		};
	} finally {
		isTestingConnection.value = false;
	}
}

async function handleTestEmail() {
	// Validate that email address is provided
	if (!testEmailTo.value.trim()) {
		toast.error("Email address required", {
			description: "Please enter an email address to send the test email to.",
		});
		return;
	}

	isTestingEmail.value = true;
	testEmailResult.value = null;

	try {
		const response = await $fetch<{ success: boolean; error?: string }>('/api/site-configuration/test-email', {
			method: 'POST',
			body: {
				to: testEmailTo.value,
				subject: testEmailSubject.value,
				message: testEmailMessage.value,
			},
		});
		testEmailResult.value = response;
		if (response.success) {
			toast.success("Test email sent successfully", {
				description: `Email sent to ${testEmailTo.value}`,
			});
		}
	} catch (error: any) {
		testEmailResult.value = {
			success: false,
			error: error.data?.error || 'Failed to send test email',
		};
		toast.error("Failed to send test email", {
			description: error.data?.error || 'Failed to send test email',
		});
	} finally {
		isTestingEmail.value = false;
	}
}

async function handleTestSms() {
	// Validate that phone number is provided
	if (!testSmsTo.value.trim()) {
		toast.error("Phone number required", {
			description: "Please enter a phone number to send the test SMS to.",
		});
		return;
	}

	isTestingSms.value = true;
	testSmsResult.value = null;

	try {
		const response = await $fetch<{ success: boolean; error?: string }>('/api/site-configuration/test-sms', {
			method: 'POST',
			body: {
				to: testSmsTo.value,
				message: testSmsMessage.value,
			},
		});
		testSmsResult.value = response;
		if (response.success) {
			toast.success("Test SMS sent successfully", {
				description: `SMS sent to ${testSmsTo.value}`,
			});
		}
	} catch (error: any) {
		testSmsResult.value = {
			success: false,
			error: error.data?.error || 'Failed to send test SMS',
		};
		toast.error("Failed to send test SMS", {
			description: error.data?.error || 'Failed to send test SMS',
		});
	} finally {
		isTestingSms.value = false;
	}
}

function copyToClipboard(text: string) {
	navigator.clipboard.writeText(text);
	toast.success("Copied to clipboard", {
		description: "The value has been copied to your clipboard",
	});
}
</script>

<template>
	<div class="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
		<div class="space-y-6">
			<FormSkeleton v-if="status === 'pending' || !formValues" />

			<!-- Empty state when no configuration exists -->
			<div v-else-if="showEmptyState">
				<div class="text-center py-12 bg-gray-50 rounded-lg">
					<h3 class="text-lg font-medium text-gray-900 mb-2">Welcome to Ocean Autorouter!</h3>
					<p class="text-sm text-gray-600 mb-6 max-w-md mx-auto">
						Get started by creating your site configuration. This will connect your Autorouter site to
						your Ocean site.
					</p>
					<Button @click="handleCreateConfig">Create Configuration</Button>
				</div>
				<Alert v-if="hadPreviousConfig" variant="warning" class="mt-10">
					<AlertTitle class="mb-2">
						<AlertTriangle class="h-4 w-4" />
						Important Note
					</AlertTitle>
					If you're seeing this screen unexpectedly after setting up a configuration, it may be because
					you signed in with a different authentication provider or different user account.
				</Alert>
			</div>

			<form v-else-if="formValues" class="space-y-8" @submit.prevent="handleSubmit">
				<div>
					<h1 class="text-2xl font-semibold text-gray-900">Settings</h1>
					<p class="mt-2 text-sm text-gray-600 leading-relaxed max-w-3xl" v-if="formValues.id">
						Connecting the Autorouter to your Ocean site requires two sets of OAuth credentials:
						one for securing outbound requests to Ocean, and another for securing inbound requests from
						Ocean.
					</p>
				</div>

				<div class="space-y-2">
					<Label for="name">Site Name</Label>
					<Input id="name" :autofocus="!showEmptyState" v-model="formValues.name"
						:aria-invalid="errors.name ? 'true' : undefined" />
					<p v-if="errors.name" class="text-sm text-destructive">
						{{ errors.name }}
					</p>
				</div>

				<div class="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>Connecting the Autorouter to Ocean</CardTitle>
						</CardHeader>
						<CardContent>
							<div class="space-y-4">
								<div class="space-y-2">
									<Label for="oceanServer">Server</Label>
									<Select id="oceanServer" v-model="formValues.oceanServer"
										:aria-invalid="errors.oceanServer ? 'true' : undefined">
										<SelectTrigger>
											<SelectValue placeholder="Select a server" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="ocean">Ocean Production (ocean.cognisantmd.com)
											</SelectItem>
											<SelectItem value="test">Test (test.cognisantmd.com)</SelectItem>
											<SelectItem value="staging">Staging (staging.cognisantmd.com)</SelectItem>
											<SelectItem value="local">Local (localhost:8080)</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div class="space-y-2">
									<Label for="oceanSiteNum">Ocean Site Number</Label>
									<Input id="oceanSiteNum" v-model="formValues.oceanSiteNum"
										:aria-invalid="errors.oceanSiteNum ? 'true' : undefined" />
									<p v-if="errors.oceanSiteNum" class="text-sm text-destructive">
										{{ errors.oceanSiteNum }}
									</p>
								</div>
								<p class="text-sm text-gray-600 mb-6 leading-relaxed">
									Obtain the following credentials in the <a
										:href="`${oceanServerUrl}/ocean/portal.html${formValues.oceanSiteNum ? `?siteNum=${formValues.oceanSiteNum}` : ''}#/admin/credentials/`"
										target="_blank" class="text-blue-600 font-medium hover:underline">Ocean Site
										Admin → Manage
										Credentials</a>:
								</p>
								<div class="space-y-2">
									<Label for="oceanClientId">Ocean's OAuth Client ID</Label>
									<Input id="oceanClientId" v-model="formValues.oceanClientId"
										:aria-invalid="errors.oceanClientId ? 'true' : undefined" />
									<p v-if="errors.oceanClientId" class="text-sm text-destructive">
										{{ errors.oceanClientId }}
									</p>
								</div>
								<div class="space-y-2">
									<Label for="oceanClientSecret">Ocean's OAuth Client Secret</Label>
									<div class="flex items-center gap-2">
										<Input id="oceanClientSecret" v-model="formValues.oceanClientSecret"
											:type="showOceanClientSecret ? 'text' : 'password'"
											:aria-invalid="errors.oceanClientSecret ? 'true' : undefined"
											class="flex-1" />
										<Button variant="outline" size="icon"
											@click="showOceanClientSecret = !showOceanClientSecret">
											<component :is="showOceanClientSecret ? EyeOff : Eye" class="h-4 w-4" />
										</Button>
									</div>
									<p v-if="errors.oceanClientSecret" class="text-sm text-destructive">
										{{ errors.oceanClientSecret }}
									</p>
								</div>

								<div v-if="formValues" class="space-y-4">
									<div class="flex items-center justify-between">
										<Button variant="outline" @click="handleTestConnection"
											:disabled="isTestingConnection || !formValues.oceanClientId || !formValues.oceanClientSecret">
											<template v-if="isTestingConnection">Testing Connection...</template>
											<template v-else>Test Connection to Ocean</template>
										</Button>
									</div>

									<Alert v-if="testConnectionResult"
										:variant="testConnectionResult.success ? 'success' : 'destructive'"
										class="mt-2">
										<AlertTitle>{{ testConnectionResult.success ? 'Successfully connected to Ocean'
											:
											'Connection to Ocean Failed' }}
										</AlertTitle>
										<p v-if="testConnectionResult.error" class="mt-2 text-sm">{{
											testConnectionResult.error }}</p>
									</Alert>
								</div>
							</div>
						</CardContent>
					</Card>
					<Card v-if="!isNewConfig">
						<CardHeader>
							<CardTitle>Connecting Ocean to the Autorouter</CardTitle>
						</CardHeader>
						<CardContent>
							<div class="space-y-6">
								<p class="text-sm text-gray-600 mt-2 leading-relaxed">
									Use the provided credentials when setting up a new
									integration in the
									<a :href="`${oceanServerUrl}/ocean/portal.html#/admin/integrations/`"
										target="_blank" class="text-primary hover:underline">Ocean Site Admin →
										Integrations</a>.
								</p>

								<Tabs default-value="fhir" class="w-full">
									<TabsList class="grid w-full grid-cols-2">
										<TabsTrigger value="fhir">eReferral-eConsult FHIR Integration</TabsTrigger>
										<TabsTrigger value="cds">CDS Hook Integration</TabsTrigger>
									</TabsList>

									<TabsContent value="fhir" class="space-y-4">
										<div class="space-y-4 bg-gray-50 p-4 rounded-lg">
											<div class="space-y-2">
												<Label class="text-sm font-medium">Referral Integration Webhook
													Endpoint
													Request URL</Label>
												<div class="flex items-center gap-2">
													<Input v-model="apiEndpoint" readonly class="bg-gray-50" />
													<Button variant="outline" size="icon"
														@click="copyToClipboard(apiEndpoint)">
														<Copy class="h-4 w-4" />
													</Button>
												</div>
												<p class="text-xs text-gray-600">Use this URL for an Ocean
													<strong>eReferrals</strong>
													integration (<strong>FHIR v0.11</strong>).
												</p>
												<p class="text-xs text-gray-600 mt-2">
													This integration is required to receive and respond to inbound
													eReferrals and eConsults.
												</p>
												<p class="text-xs text-gray-600 mt-2">
													<strong>Important:</strong> You must configure <strong>each
														directory listing</strong>
													to point to this integration in the "Enablement" tab in the
													<a :href="`${oceanServerUrl}/ocean/portal.html#/admin/directory-listings/`"
														target="_blank" class="text-blue-600 hover:underline">Directory
														Listings</a>
													section.
												</p>
											</div>
										</div>
									</TabsContent>

									<TabsContent value="cds" class="space-y-4">
										<div class="space-y-4 bg-gray-50 p-4 rounded-lg">
											<div class="space-y-2">
												<Label class="text-sm font-medium">CDS Hook Base URL</Label>
												<div class="flex items-center gap-2">
													<Input v-model="cdsHookEndpoint" readonly class="bg-gray-50" />
													<Button variant="outline" size="icon"
														@click="copyToClipboard(cdsHookEndpoint)">
														<Copy class="h-4 w-4" />
													</Button>
												</div>
												<p class="text-xs text-gray-600">Use this URL for an Ocean
													<strong>External CDS
														Hook</strong>
													integration.
												</p>
												<p class="text-xs text-gray-600 mt-2">
													This integration is required to provide advice, warnings or errors
													to the sender at the
													time of submission.
												</p>
											</div>
										</div>
									</TabsContent>
								</Tabs>

								<div class="space-y-4 bg-blue-50 p-4 rounded-lg">
									<h4 class="text-sm font-medium text-gray-900 mb-3">OAuth2 Authentication</h4>
									<div class="space-y-4">
										<div class="space-y-2">
											<Label class="text-sm font-medium">Token Endpoint</Label>
											<div class="flex items-center gap-2">
												<Input v-model="tokenEndpoint" readonly class="bg-gray-50" />
												<Button variant="outline" size="icon"
													@click="copyToClipboard(tokenEndpoint)">
													<Copy class="h-4 w-4" />
												</Button>
											</div>
										</div>

										<div class="space-y-2">
											<Label for="clientId">Your Autorouter Client ID</Label>
											<div class="flex items-center gap-2">
												<Input id="clientId" v-model="formValues.clientId" readonly
													class="bg-gray-50" />
												<Button variant="outline" size="icon"
													@click="copyToClipboard(formValues.clientId)">
													<Copy class="h-4 w-4" />
												</Button>
											</div>
										</div>

										<div class="space-y-2">
											<Label for="clientSecret">Your Autorouter Client Secret</Label>
											<div class="flex items-center gap-2">
												<Input id="clientSecret" v-model="formValues.clientSecret"
													:type="showClientSecret ? 'text' : 'password'"
													:aria-invalid="errors.clientSecret ? 'true' : undefined"
													class="flex-1" />
												<Button variant="outline" size="icon"
													@click="showClientSecret = !showClientSecret">
													<component :is="showClientSecret ? EyeOff : Eye" class="h-4 w-4" />
												</Button>
												<Button variant="outline" size="icon"
													@click="copyToClipboard(formValues.clientSecret)">
													<Copy class="h-4 w-4" />
												</Button>
											</div>
											<p v-if="errors.clientSecret" class="text-sm text-destructive">
												{{ errors.clientSecret }}
											</p>
										</div>

										<p class="text-sm text-gray-600 mt-2 leading-relaxed">
											You can leave the "Scope" blank.
										</p>
									</div>
								</div>

								<div class="space-y-2">
									<div v-if="lastSuccessfulConnection" :class="[
										'inline-flex items-center gap-2 px-3 py-1.5 rounded-md',
										isRecentSuccessfulInboundConnection
											? 'bg-green-50 text-green-700'
											: 'bg-gray-50 text-gray-700'
									]">
										<CheckCircle v-if="isRecentSuccessfulInboundConnection" class="h-4 w-4" />
										<span class="text-sm">Last successful connection: {{
											formatTimestampWithMinutePrecision(lastSuccessfulConnection) }}</span>
									</div>
									<div v-else
										class="inline-flex items-center gap-2 px-3 py-1.5 bg-yellow-50 text-yellow-700 rounded-md">
										<AlertCircle class="h-4 w-4" />
										<span class="text-sm">No successful connection has yet been made.</span>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card v-if="!isNewConfig">
						<CardHeader>
							<CardTitle>SMS Configuration</CardTitle>
						</CardHeader>
						<CardContent>
							<p class="text-sm text-gray-600 mt-2 leading-relaxed">
								Enter your Twilio account credentials to enable outbound SMS notifications.
							</p>
							<div class="space-y-4 bg-gray-50 p-4 rounded-lg">
								<div class="space-y-2">
									<Label for="twilioAccountSid">Twilio Account SID</Label>
									<Input id="twilioAccountSid" v-model="formValues.twilioAccountSid"
										:aria-invalid="errors.twilioAccountSid ? 'true' : undefined" />
									<p v-if="errors.twilioAccountSid" class="text-sm text-destructive">
										{{ errors.twilioAccountSid }}
									</p>
								</div>
								<div class="space-y-2">
									<Label for="twilioAuthToken">Twilio Auth Token</Label>
									<div class="flex items-center gap-2">
										<Input id="twilioAuthToken" v-model="formValues.twilioAuthToken"
											:type="showTwilioAuthToken ? 'text' : 'password'"
											:aria-invalid="errors.twilioAuthToken ? 'true' : undefined"
											class="flex-1" />
										<Button variant="outline" size="icon"
											@click="showTwilioAuthToken = !showTwilioAuthToken">
											<component :is="showTwilioAuthToken ? EyeOff : Eye" class="h-4 w-4" />
										</Button>
									</div>
									<p v-if="errors.twilioAuthToken" class="text-sm text-destructive">
										{{ errors.twilioAuthToken }}
									</p>
								</div>
								<div class="space-y-2">
									<Label for="twilioPhoneNumber">Twilio Phone Number</Label>
									<Input id="twilioPhoneNumber" v-model="formValues.twilioPhoneNumber"
										:aria-invalid="errors.twilioPhoneNumber ? 'true' : undefined" />
									<p v-if="errors.twilioPhoneNumber" class="text-sm text-destructive">
										{{ errors.twilioPhoneNumber }}
									</p>
								</div>
							</div>

							<!-- Test SMS Section -->
							<div class="mt-6 space-y-4">
								<h4 class="text-sm font-medium text-gray-900">Test SMS Configuration</h4>
								<div class="space-y-4 bg-blue-50 p-4 rounded-lg">
									<div class="space-y-2">
										<Label for="testSmsTo">Phone Number to Test *</Label>
										<Input id="testSmsTo" v-model="testSmsTo" placeholder="+1234567890" />
										<p class="text-xs text-gray-600">Enter a valid phone number to test SMS delivery
										</p>
									</div>
									<div class="space-y-2">
										<Label for="testSmsMessage">Test Message</Label>
										<Input id="testSmsMessage" v-model="testSmsMessage" />
									</div>
									<div class="flex items-center justify-between">
										<Button variant="outline" @click="handleTestSms"
											:disabled="isTestingSms || !formValues.twilioAccountSid || !formValues.twilioAuthToken || !formValues.twilioPhoneNumber || !testSmsTo.trim()">
											<template v-if="isTestingSms">Sending Test SMS...</template>
											<template v-else>Send Test SMS</template>
										</Button>
									</div>

									<Alert v-if="testSmsResult"
										:variant="testSmsResult.success ? 'success' : 'destructive'" class="mt-2">
										<AlertTitle>{{ testSmsResult.success ? 'SMS sent successfully'
											:
											'SMS delivery failed' }}
										</AlertTitle>
										<p v-if="testSmsResult.error" class="mt-2 text-sm">{{
											testSmsResult.error }}</p>
									</Alert>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card v-if="!isNewConfig">
						<CardHeader>
							<CardTitle>AI Configuration</CardTitle>
						</CardHeader>
						<CardContent>
							<p class="text-sm text-gray-600 mt-2 leading-relaxed">
								Configure your AI provider settings for enhanced routing capabilities.
							</p>
							<div class="space-y-2">
								<Label for="aiProvider">AI Provider</Label>
								<Select id="aiProvider" v-model="formValues.aiProvider"
									:aria-invalid="errors.aiProvider ? 'true' : undefined">
									<SelectTrigger>
										<SelectValue placeholder="Select an AI provider" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="openai">OpenAI</SelectItem>
										<SelectItem value="google">Google</SelectItem>
										<SelectItem value="cohere">Cohere</SelectItem>
									</SelectContent>
								</Select>
								<p v-if="errors.aiProvider" class="text-sm text-destructive">
									{{ errors.aiProvider }}
								</p>
							</div>
							<div class="space-y-2">
								<Label for="aiApiKey">API Key</Label>
								<div class="flex items-center gap-2">
									<Input id="aiApiKey" v-model="formValues.aiApiKey"
										:type="showAiApiKey ? 'text' : 'password'"
										:aria-invalid="errors.aiApiKey ? 'true' : undefined" class="flex-1" />
									<Button variant="outline" size="icon" @click="showAiApiKey = !showAiApiKey">
										<component :is="showAiApiKey ? EyeOff : Eye" class="h-4 w-4" />
									</Button>
								</div>
								<p v-if="errors.aiApiKey" class="text-sm text-destructive">
									{{ errors.aiApiKey }}
								</p>
							</div>
							<div class="space-y-2">
								<Label for="aiModel">Model</Label>
								<Input id="aiModel" v-model="formValues.aiModel"
									:aria-invalid="errors.aiModel ? 'true' : undefined"
									placeholder="(leave blank for default)" />
								<p v-if="errors.aiModel" class="text-sm text-destructive">
									{{ errors.aiModel }}
								</p>
							</div>
						</CardContent>
					</Card>

					<Card v-if="!isNewConfig">
						<CardHeader>
							<CardTitle>Email Configuration</CardTitle>
						</CardHeader>
						<CardContent>
							<p class="text-sm text-gray-600 mt-2 leading-relaxed">
								Configure your email settings for sending notifications using SMTP2GO.
							</p>
							<div class="space-y-4 bg-gray-50 p-4 rounded-lg">
								<div class="space-y-2">
									<Label for="emailProvider">Email Provider</Label>
									<Select id="emailProvider" v-model="formValues.emailProvider"
										:aria-invalid="errors.emailProvider ? 'true' : undefined">
										<SelectTrigger>
											<SelectValue placeholder="Select an email provider" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="smtp2go">SMTP2GO</SelectItem>
										</SelectContent>
									</Select>
									<p v-if="errors.emailProvider" class="text-sm text-destructive">
										{{ errors.emailProvider }}
									</p>
								</div>
								<div class="space-y-2">
									<Label for="emailFromAddress">From Email Address</Label>
									<Input id="emailFromAddress" v-model="formValues.emailFromAddress"
										:aria-invalid="errors.emailFromAddress ? 'true' : undefined" />
									<p v-if="errors.emailFromAddress" class="text-sm text-destructive">
										{{ errors.emailFromAddress }}
									</p>
								</div>
								<div class="space-y-2">
									<Label for="emailApiKey">SMTP2GO API Key</Label>
									<div class="flex items-center gap-2">
										<Input id="emailApiKey" v-model="formValues.emailApiKey"
											:type="showEmailApiKey ? 'text' : 'password'"
											:aria-invalid="errors.emailApiKey ? 'true' : undefined" class="flex-1" />
										<Button variant="outline" size="icon"
											@click="showEmailApiKey = !showEmailApiKey">
											<component :is="showEmailApiKey ? EyeOff : Eye" class="h-4 w-4" />
										</Button>
									</div>
									<p class="text-sm text-gray-600">
										Get your API key from the <a href="https://app.smtp2go.com/settings/api_keys"
											target="_blank" class="text-blue-600 hover:underline">SMTP2GO dashboard</a>
									</p>
									<p v-if="errors.emailApiKey" class="text-sm text-destructive">
										{{ errors.emailApiKey }}
									</p>
								</div>
								<div class="space-y-2">
									<Label for="emailFromName">From Name</Label>
									<Input id="emailFromName" v-model="formValues.emailFromName"
										:aria-invalid="errors.emailFromName ? 'true' : undefined"
										placeholder="(leave blank to use email address)" />
									<p v-if="errors.emailFromName" class="text-sm text-destructive">
										{{ errors.emailFromName }}
									</p>
								</div>
							</div>

							<!-- Test Email Section -->
							<div class="mt-6 space-y-4">
								<h4 class="text-sm font-medium text-gray-900">Test Email Configuration</h4>
								<div class="space-y-4 bg-blue-50 p-4 rounded-lg">
									<div class="space-y-2">
										<Label for="testEmailTo">Email Address to Test *</Label>
										<Input id="testEmailTo" v-model="testEmailTo" placeholder="test@example.com" />
										<p class="text-xs text-gray-600">Enter a valid email address to test email
											delivery</p>
									</div>
									<div class="space-y-2">
										<Label for="testEmailSubject">Test Subject</Label>
										<Input id="testEmailSubject" v-model="testEmailSubject" />
									</div>
									<div class="space-y-2">
										<Label for="testEmailMessage">Test Message</Label>
										<Input id="testEmailMessage" v-model="testEmailMessage" />
									</div>
									<div class="flex items-center justify-between">
										<Button variant="outline" @click="handleTestEmail"
											:disabled="isTestingEmail || !formValues.emailProvider || !formValues.emailFromAddress || !formValues.emailApiKey || !testEmailTo.trim()">
											<template v-if="isTestingEmail">Sending Test Email...</template>
											<template v-else>Send Test Email</template>
										</Button>
									</div>

									<Alert v-if="testEmailResult"
										:variant="testEmailResult.success ? 'success' : 'destructive'" class="mt-2">
										<AlertTitle>{{ testEmailResult.success ? 'Email sent successfully'
											:
											'Email delivery failed' }}
										</AlertTitle>
										<p v-if="testEmailResult.error" class="mt-2 text-sm">{{
											testEmailResult.error }}</p>
									</Alert>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card v-if="!isNewConfig">
						<CardHeader>
							<CardTitle>Ocean Open API Credentials</CardTitle>
						</CardHeader>
						<CardContent>
							<p class="text-sm text-gray-600 mt-2 leading-relaxed">
								Configure your Ocean Open API credentials for patient engagement use cases, such as
								patient messaging and
								forms completion. This is an optional connection that enables advanced patient
								interaction features.
							</p>
							<div class="space-y-4 bg-gray-50 p-4 rounded-lg">
								<div class="space-y-2">
									<Label for="siteKey">Site Key</Label>
									<div class="flex items-center gap-2">
										<Input id="siteKey" v-model="formValues.siteKey"
											:type="showSiteKey ? 'text' : 'password'"
											:aria-invalid="errors.siteKey ? 'true' : undefined" class="flex-1" />
										<Button variant="outline" size="icon" @click="showSiteKey = !showSiteKey">
											<component :is="showSiteKey ? EyeOff : Eye" class="h-4 w-4" />
										</Button>
									</div>
									<p v-if="errors.siteKey" class="text-sm text-destructive">
										{{ errors.siteKey }}
									</p>
								</div>
								<div class="space-y-2">
									<Label for="siteCredential">Site Credential</Label>
									<div class="flex items-center gap-2">
										<Input id="siteCredential" v-model="formValues.siteCredential"
											:type="showSiteCredential ? 'text' : 'password'"
											:aria-invalid="errors.siteCredential ? 'true' : undefined" class="flex-1" />
										<Button variant="outline" size="icon"
											@click="showSiteCredential = !showSiteCredential">
											<component :is="showSiteCredential ? EyeOff : Eye" class="h-4 w-4" />
										</Button>
									</div>
									<p v-if="errors.siteCredential" class="text-sm text-destructive">
										{{ errors.siteCredential }}
									</p>
								</div>
								<div class="space-y-2">
									<Label for="sharedEncryptionKey">Shared Encryption Key</Label>
									<div class="flex items-center gap-2">
										<Input id="sharedEncryptionKey" v-model="formValues.sharedEncryptionKey"
											:type="showSharedEncryptionKey ? 'text' : 'password'"
											:aria-invalid="errors.sharedEncryptionKey ? 'true' : undefined"
											class="flex-1" />
										<Button variant="outline" size="icon"
											@click="showSharedEncryptionKey = !showSharedEncryptionKey">
											<component :is="showSharedEncryptionKey ? EyeOff : Eye" class="h-4 w-4" />
										</Button>
									</div>
									<p v-if="errors.sharedEncryptionKey" class="text-sm text-destructive">
										{{ errors.sharedEncryptionKey }}
									</p>
								</div>
								<p class="text-sm text-gray-600 mt-4">
									These credentials are used for secure communication with Ocean's Open API for
									patient engagement
									features.
								</p>
							</div>
						</CardContent>
					</Card>
				</div>

				<div v-if="Object.keys(errors).length > 0" class="p-4 mb-4 text-sm text-red-800 bg-red-50 rounded-lg"
					role="alert">
					<Accordion type="single" collapsible>
						<AccordionItem value="errors">
							<AccordionTrigger>Please fix the highlighted errors before saving.</AccordionTrigger>
							<AccordionContent>
								<ul>
									<li v-for="(error, key) in errors" :key="key">
										{{ key }}: {{ error }}
									</li>
								</ul>
							</AccordionContent>
						</AccordionItem>
					</Accordion>
				</div>

				<div class="flex justify-end">
					<Button v-if="hasChanges" type="submit" :disabled="isSubmitting">
						{{ isSubmitting ? 'Saving...' : 'Save Changes' }}
					</Button>
				</div>

				<div class="space-y-2">
					<Label for="name" class="text-xs text-gray-500">Your Autorouter Site ID</Label>
					<p class="text-xs text-gray-400 font-mono">{{ user?.activeTenantId ?? user?.tenantId }}</p>
				</div>
			</form>
		</div>
	</div>
</template>
