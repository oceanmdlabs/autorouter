<script setup lang="ts">
import {
  AlertCircle,
  CheckCircle,
  Copy,
} from "lucide-vue-next";
import { formatTimestampWithMinutePrecision } from "@/shared/lib/utils";

const props = defineProps<{
  modelValue: {
    clientId: string;
    clientSecret: string;
  };
  errors: Record<string, string>;
  canManageTenant: boolean;
  saving: boolean;
  hasChanges: boolean;
  tokenEndpoint: string;
  apiEndpoint: string;
  cdsHookEndpoint: string;
  lastSuccessfulConnection: Date | null;
  isRecentSuccessfulInboundConnection: boolean;
  isMaskedSecretValue: (v: string | null | undefined) => boolean;
  oceanServerUrl: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [
    value: {
      clientId: string;
      clientSecret: string;
    },
  ];
  save: [];
  copy: [text: string];
}>();

const local = reactive({ ...props.modelValue });

watch(
  () => props.modelValue,
  (v) => Object.assign(local, v),
  { deep: true },
);

watch(
  local,
  (v) => emit("update:modelValue", { ...v }),
  { deep: true },
);
</script>

<template>
  <AccordionItem
    value="ocean-to-autorouter"
    class="rounded-lg border bg-white px-6 shadow-sm last:border-b"
  >
    <AccordionTrigger type="button" class="py-5 hover:no-underline">
      <span class="flex flex-col gap-1 text-left">
        <span class="text-base font-semibold text-gray-900">
          Connecting Ocean to the Autorouter
        </span>
        <span class="text-sm font-normal text-gray-600">
          Inbound integration URLs, OAuth2 credentials, and connection
          status
        </span>
      </span>
    </AccordionTrigger>
    <AccordionContent class="pb-6">
      <div class="space-y-6">
        <p class="text-sm text-gray-600 mt-2 leading-relaxed">
          Use the provided credentials when setting up a new integration
          in the
          <a
            :href="`${oceanServerUrl}/ocean/portal.html#/admin/integrations/`"
            target="_blank"
            class="text-primary hover:underline"
            >Ocean Site Admin → Integrations</a
          >.
        </p>

        <Tabs default-value="fhir" class="w-full">
          <TabsList class="grid w-full grid-cols-2">
            <TabsTrigger value="fhir"
              >eReferral-eConsult FHIR Integration</TabsTrigger
            >
            <TabsTrigger value="cds">CDS Hook Integration</TabsTrigger>
          </TabsList>

          <TabsContent value="fhir" class="space-y-4">
            <div class="space-y-4 bg-gray-50 p-4 rounded-lg">
              <div class="space-y-2">
                <Label class="text-sm font-medium"
                  >Referral Integration Webhook Endpoint Request
                  URL</Label
                >
                <div class="flex items-center gap-2">
                  <Input
                    :model-value="apiEndpoint"
                    readonly
                    class="bg-gray-50"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    @click="emit('copy', apiEndpoint)"
                  >
                    <Copy class="h-4 w-4" />
                  </Button>
                </div>
                <p class="text-xs text-gray-600">
                  Use this URL for an Ocean
                  <strong>eReferrals</strong>
                  integration (<strong>FHIR v0.11</strong>).
                </p>
                <p class="text-xs text-gray-600 mt-2">
                  This integration is required to receive and respond to
                  inbound eReferrals and eConsults.
                </p>
                <p class="text-xs text-gray-600 mt-2">
                  <strong>Important:</strong> You must configure
                  <strong>each directory listing</strong>
                  to point to this integration in the "Enablement" tab
                  in the
                  <a
                    :href="`${oceanServerUrl}/ocean/portal.html#/admin/directory-listings/`"
                    target="_blank"
                    class="text-blue-600 hover:underline"
                    >Directory Listings</a
                  >
                  section.
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="cds" class="space-y-4">
            <div class="space-y-4 bg-gray-50 p-4 rounded-lg">
              <div class="space-y-2">
                <Label class="text-sm font-medium"
                  >CDS Hook Base URL</Label
                >
                <div class="flex items-center gap-2">
                  <Input
                    :model-value="cdsHookEndpoint"
                    readonly
                    class="bg-gray-50"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    @click="emit('copy', cdsHookEndpoint)"
                  >
                    <Copy class="h-4 w-4" />
                  </Button>
                </div>
                <p class="text-xs text-gray-600">
                  Use this URL for an Ocean
                  <strong>External CDS Hook</strong>
                  integration.
                </p>
                <p class="text-xs text-gray-600 mt-2">
                  This integration is required to provide advice,
                  warnings or errors to the sender at the time of
                  submission.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div class="space-y-4 bg-blue-50 p-4 rounded-lg">
          <h4 class="text-sm font-medium text-gray-900 mb-3">
            OAuth2 Authentication
          </h4>
          <div class="space-y-4">
            <div class="space-y-2">
              <Label class="text-sm font-medium">Token Endpoint</Label>
              <div class="flex items-center gap-2">
                <Input
                  :model-value="tokenEndpoint"
                  readonly
                  class="bg-gray-50"
                />
                <Button
                  variant="outline"
                  size="icon"
                  @click="emit('copy', tokenEndpoint)"
                >
                  <Copy class="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div class="space-y-2">
              <Label for="clientId">Your Autorouter Client ID</Label>
              <div class="flex items-center gap-2">
                <Input
                  id="clientId"
                  :model-value="local.clientId"
                  readonly
                  class="bg-gray-50"
                />
                <Button
                  variant="outline"
                  size="icon"
                  @click="emit('copy', local.clientId)"
                >
                  <Copy class="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div class="space-y-2">
              <Label for="clientSecret"
                >Your Autorouter Client Secret</Label
              >
              <div class="flex items-center gap-2">
                <Input
                  id="clientSecret"
                  v-model="local.clientSecret"
                  type="password"
                  :aria-invalid="
                    errors.clientSecret ? 'true' : undefined
                  "
                  class="flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  @click="emit('copy', local.clientSecret)"
                  :disabled="isMaskedSecretValue(local.clientSecret)"
                >
                  <Copy class="h-4 w-4" />
                </Button>
              </div>
              <p
                v-if="errors.clientSecret"
                class="text-sm text-destructive"
              >
                {{ errors.clientSecret }}
              </p>
            </div>

            <p class="text-sm text-gray-600 mt-2 leading-relaxed">
              You can leave the "Scope" blank.
            </p>
          </div>
        </div>

        <div class="space-y-2">
          <div
            v-if="lastSuccessfulConnection"
            :class="[
              'inline-flex items-center gap-2 px-3 py-1.5 rounded-md',
              isRecentSuccessfulInboundConnection
                ? 'bg-green-50 text-green-700'
                : 'bg-gray-50 text-gray-700',
            ]"
          >
            <CheckCircle
              v-if="isRecentSuccessfulInboundConnection"
              class="h-4 w-4"
            />
            <span class="text-sm"
              >Last successful connection:
              {{
                formatTimestampWithMinutePrecision(
                  lastSuccessfulConnection,
                )
              }}</span
            >
          </div>
          <div
            v-else
            class="inline-flex items-center gap-2 px-3 py-1.5 bg-yellow-50 text-yellow-700 rounded-md"
          >
            <AlertCircle class="h-4 w-4" />
            <span class="text-sm"
              >No successful connection has yet been made.</span
            >
          </div>
        </div>

        <div class="flex justify-end pt-2">
          <Button
            type="button"
            @click="emit('save')"
            :disabled="
              !canManageTenant ||
              saving ||
              !hasChanges
            "
          >
            {{
              saving ? "Saving..." : "Save OAuth Settings"
            }}
          </Button>
        </div>
      </div>
    </AccordionContent>
  </AccordionItem>
</template>
