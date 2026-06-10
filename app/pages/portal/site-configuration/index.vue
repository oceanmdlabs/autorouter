<script setup lang="ts">
import { AlertTriangle } from "lucide-vue-next";

const {
  errors,
  formValues,
  isNewConfig,
  showEmptyState,
  lastSuccessfulConnection,
  hadPreviousConfig,
  savingPanels,
  status,
  canManageTenant,
  oceanServerUrl,
  tokenEndpoint,
  apiEndpoint,
  cdsHookEndpoint,
  isRecentSuccessfulInboundConnection,
  user,
  panelHasChanges,
  savePanel,
  handleCreateConfig,
  copyToClipboard,
  isMaskedSecretValue,
} = useSiteConfigurationForm();

// Connection panel slice
const connectionSlice = computed(() => ({
  name: formValues.value?.name ?? "",
  oceanServer: formValues.value?.oceanServer ?? "ocean",
  oceanSiteNum: formValues.value?.oceanSiteNum ?? "",
  oceanClientId: formValues.value?.oceanClientId ?? "",
  oceanClientSecret: formValues.value?.oceanClientSecret ?? "",
}));
function updateConnectionSlice(v: { name: string; oceanServer: string; oceanSiteNum: string; oceanClientId: string; oceanClientSecret: string }) {
  if (formValues.value) Object.assign(formValues.value, v);
}

// Inbound panel slice
const inboundSlice = computed(() => ({
  clientId: formValues.value?.clientId ?? "",
  clientSecret: formValues.value?.clientSecret ?? "",
}));
function updateInboundSlice(v: typeof inboundSlice.value) {
  if (formValues.value) Object.assign(formValues.value, v);
}

// SMS panel slice
const smsSlice = computed(() => ({
  smsProvider: formValues.value?.smsProvider ?? null,
  twilioAccountSid: formValues.value?.twilioAccountSid ?? "",
  twilioAuthToken: formValues.value?.twilioAuthToken ?? "",
  twilioPhoneNumber: formValues.value?.twilioPhoneNumber ?? "",
  smsSendAllowlist: formValues.value?.smsSendAllowlist ?? [],
}));
function updateSmsSlice(v: Omit<typeof smsSlice.value, "smsSendAllowlist"> & { smsSendAllowlist: { phoneNumber: string; label?: string }[] | null }) {
  if (formValues.value) Object.assign(formValues.value, v);
}

// AI panel slice
const aiSlice = computed(() => ({
  aiProvider: formValues.value?.aiProvider ?? null,
  aiApiKey: formValues.value?.aiApiKey ?? null,
  aiModel: formValues.value?.aiModel ?? null,
}));
function updateAiSlice(v: { aiProvider: string | null; aiApiKey: string | null; aiModel: string | null }) {
  if (formValues.value) Object.assign(formValues.value, v);
}

// Email panel slice
const emailSlice = computed(() => ({
  emailProvider: formValues.value?.emailProvider ?? null,
  emailFromAddress: formValues.value?.emailFromAddress ?? null,
  emailApiKey: formValues.value?.emailApiKey ?? null,
  emailFromName: formValues.value?.emailFromName ?? null,
  emailSendAllowlist: formValues.value?.emailSendAllowlist ?? null,
}));
function updateEmailSlice(v: { emailProvider: string | null; emailFromAddress: string | null; emailApiKey: string | null; emailFromName: string | null; emailSendAllowlist: string[] | null }) {
  if (formValues.value) Object.assign(formValues.value, v);
}

// OpenAPI panel slice
const openApiSlice = computed(() => ({
  siteKey: formValues.value?.siteKey ?? null,
  siteCredential: formValues.value?.siteCredential ?? null,
  sharedEncryptionKey: formValues.value?.sharedEncryptionKey ?? null,
}));
function updateOpenApiSlice(v: typeof openApiSlice.value) {
  if (formValues.value) Object.assign(formValues.value, v);
}

// eRequest archival panel slice
const erequestSlice = computed(() => ({
  erequestArchivalEnabled: formValues.value?.erequestArchivalEnabled ?? false,
}));
function updateErequestSlice(v: typeof erequestSlice.value) {
  if (formValues.value) Object.assign(formValues.value, v);
}
</script>

<template>
  <div class="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
    <div class="space-y-6">
      <FormSkeleton v-if="status === 'pending' || !formValues" />

      <!-- Empty state when no configuration exists -->
      <div v-else-if="showEmptyState">
        <div class="text-center py-12 bg-gray-50 rounded-lg">
          <h3 class="text-lg font-medium text-gray-900 mb-2">
            Welcome to Ocean Autorouter!
          </h3>
          <p class="text-sm text-gray-600 mb-6 max-w-md mx-auto">
            Get started by creating your site configuration. This will connect
            your Autorouter site to your Ocean site.
          </p>
          <Button @click="handleCreateConfig">Create Configuration</Button>
        </div>
        <Alert v-if="hadPreviousConfig" variant="warning" class="mt-10">
          <AlertTitle class="mb-2">
            <AlertTriangle class="h-4 w-4" />
            Important Note
          </AlertTitle>
          If you're seeing this screen unexpectedly after setting up a
          configuration, it may be because you signed in with a different
          authentication provider or different user account.
        </Alert>
      </div>

      <form v-else-if="formValues" class="space-y-8" @submit.prevent>
        <div>
          <h1 class="text-2xl font-semibold text-gray-900">Settings</h1>
          <p
            class="mt-2 text-sm text-gray-600 leading-relaxed max-w-3xl"
            v-if="formValues.id"
          >
            Connecting the Autorouter to your Ocean site requires two sets of
            OAuth credentials: one for securing outbound requests to Ocean, and
            another for securing inbound requests from Ocean.
          </p>
        </div>

        <div class="space-y-2">
          <Label for="name">Site Name</Label>
          <Input
            id="name"
            :autofocus="!showEmptyState"
            v-model="formValues.name"
            :aria-invalid="errors.name ? 'true' : undefined"
          />
          <p v-if="errors.name" class="text-sm text-destructive">
            {{ errors.name }}
          </p>
        </div>

        <Accordion type="multiple" class="space-y-4">
          <SiteConfigurationOceanConnectionPanel
            :model-value="connectionSlice"
            @update:model-value="updateConnectionSlice"
            :errors="errors"
            :can-manage-tenant="canManageTenant"
            :saving="savingPanels.connection"
            :has-changes="panelHasChanges('connection')"
            :ocean-server-url="oceanServerUrl"
            :is-new-config="isNewConfig"
            @save="savePanel('connection')"
          />

          <SiteConfigurationInboundApiPanel
            v-if="!isNewConfig"
            :model-value="inboundSlice"
            @update:model-value="updateInboundSlice"
            :errors="errors"
            :can-manage-tenant="canManageTenant"
            :saving="savingPanels.inbound"
            :has-changes="panelHasChanges('inbound')"
            :token-endpoint="tokenEndpoint"
            :api-endpoint="apiEndpoint"
            :cds-hook-endpoint="cdsHookEndpoint"
            :last-successful-connection="lastSuccessfulConnection"
            :is-recent-successful-inbound-connection="isRecentSuccessfulInboundConnection"
            :is-masked-secret-value="isMaskedSecretValue"
            :ocean-server-url="oceanServerUrl"
            @save="savePanel('inbound')"
            @copy="copyToClipboard"
          />

          <SiteConfigurationSmsSettingsPanel
            v-if="!isNewConfig"
            :model-value="smsSlice"
            @update:model-value="updateSmsSlice"
            :errors="errors"
            :can-manage-tenant="canManageTenant"
            :saving="savingPanels.sms"
            :has-changes="panelHasChanges('sms')"
            @save="savePanel('sms')"
          />

          <SiteConfigurationAiSettingsPanel
            v-if="!isNewConfig"
            :model-value="aiSlice"
            @update:model-value="updateAiSlice"
            :errors="errors"
            :can-manage-tenant="canManageTenant"
            :saving="savingPanels.ai"
            :has-changes="panelHasChanges('ai')"
            @save="savePanel('ai')"
          />

          <SiteConfigurationEmailSettingsPanel
            v-if="!isNewConfig"
            :model-value="emailSlice"
            @update:model-value="updateEmailSlice"
            :errors="errors"
            :can-manage-tenant="canManageTenant"
            :saving="savingPanels.email"
            :has-changes="panelHasChanges('email')"
            @save="savePanel('email')"
          />

          <SiteConfigurationOpenApiPanel
            v-if="!isNewConfig"
            :model-value="openApiSlice"
            @update:model-value="updateOpenApiSlice"
            :errors="errors"
            :can-manage-tenant="canManageTenant"
            :saving="savingPanels.openApi"
            :has-changes="panelHasChanges('openApi')"
            @save="savePanel('openApi')"
          />

          <SiteConfigurationErequestArchivalPanel
            v-if="!isNewConfig"
            :model-value="erequestSlice"
            @update:model-value="updateErequestSlice"
            :errors="errors"
            :can-manage-tenant="canManageTenant"
            :saving="savingPanels.erequests"
            :has-changes="panelHasChanges('erequests')"
            @save="savePanel('erequests')"
          />
        </Accordion>

        <div
          v-if="Object.keys(errors).length > 0"
          class="p-4 mb-4 text-sm text-red-800 bg-red-50 rounded-lg"
          role="alert"
        >
          <Accordion type="single" collapsible>
            <AccordionItem value="errors">
              <AccordionTrigger type="button"
                >Please fix the highlighted errors before
                saving.</AccordionTrigger
              >
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

        <div class="space-y-2">
          <Label for="name" class="text-xs text-gray-500"
            >Your Autorouter Site ID</Label
          >
          <p class="text-xs text-gray-400 font-mono">
            {{ user?.activeTenantId ?? user?.tenantId }}
          </p>
        </div>
      </form>
    </div>
  </div>
</template>
