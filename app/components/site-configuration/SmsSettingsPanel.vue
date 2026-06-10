<script setup lang="ts">
import { toast } from "vue-sonner";
import { handleMissingActiveTenantError } from "@/app/lib/active-tenant";

type SmsAllowlistEntry = { phoneNumber: string; label?: string };

const props = defineProps<{
  modelValue: {
    smsProvider: "twilio" | "aws" | null;
    twilioAccountSid: string;
    twilioAuthToken: string;
    twilioPhoneNumber: string;
    smsSendAllowlist: SmsAllowlistEntry[] | null;
  };
  errors: Record<string, string>;
  canManageTenant: boolean;
  saving: boolean;
  hasChanges: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [
    value: {
      smsProvider: "twilio" | "aws" | null;
      twilioAccountSid: string;
      twilioAuthToken: string;
      twilioPhoneNumber: string;
      smsSendAllowlist: SmsAllowlistEntry[] | null;
    },
  ];
  save: [];
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

const requestFetch = useRequestFetch();
const isTestingSms = ref(false);
const testSmsResult = ref<{ success: boolean; error?: string } | null>(null);
const testSmsTo = ref("");
const testSmsMessage = ref(
  "This is a test SMS to verify your SMS configuration is working correctly.",
);

const isTwilioConfigured = computed(
  () =>
    local.smsProvider === "twilio" &&
    !!local.twilioAccountSid &&
    !!local.twilioAuthToken &&
    !!local.twilioPhoneNumber,
);

const isAwsConfigured = computed(() => local.smsProvider === "aws");

const canSendTest = computed(
  () => (isTwilioConfigured.value || isAwsConfigured.value) && !!testSmsTo.value.trim(),
);

// Allowlist management
const newAllowlistPhone = ref("");
const newAllowlistLabel = ref("");
const allowlistError = ref("");

function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return null;
}

function addAllowlistEntry() {
  const normalized = normalizePhone(newAllowlistPhone.value.trim());
  if (!normalized) {
    allowlistError.value = "Enter a valid 10-digit or E.164 Canadian phone number";
    return;
  }
  const current = local.smsSendAllowlist ?? [];
  if (current.some((e) => normalizePhone(e.phoneNumber) === normalized)) {
    allowlistError.value = "This number is already in the allowlist";
    return;
  }
  const entry: SmsAllowlistEntry = { phoneNumber: normalized };
  if (newAllowlistLabel.value.trim()) entry.label = newAllowlistLabel.value.trim();
  local.smsSendAllowlist = [...current, entry];
  newAllowlistPhone.value = "";
  newAllowlistLabel.value = "";
  allowlistError.value = "";
}

function removeAllowlistEntry(phoneNumber: string) {
  local.smsSendAllowlist = (local.smsSendAllowlist ?? []).filter(
    (e) => e.phoneNumber !== phoneNumber,
  );
}

async function handleTestSms() {
  if (!testSmsTo.value.trim()) {
    toast.error("Phone number required", {
      description: "Please enter a phone number to send the test SMS to.",
    });
    return;
  }

  isTestingSms.value = true;
  testSmsResult.value = null;

  try {
    const response = await requestFetch<{ success: boolean; error?: string }>(
      "/api/site-configuration/test-sms",
      {
        method: "POST",
        body: {
          to: testSmsTo.value,
          message: testSmsMessage.value,
        },
      },
    );
    testSmsResult.value = response;
    if (response.success) {
      toast.success("Test SMS sent successfully", {
        description: `SMS sent to ${testSmsTo.value}`,
      });
    }
  } catch (error: any) {
    if (await handleMissingActiveTenantError(error)) {
      return;
    }
    testSmsResult.value = {
      success: false,
      error: error.data?.error || "Failed to send test SMS",
    };
    toast.error("Failed to send test SMS", {
      description: error.data?.error || "Failed to send test SMS",
    });
  } finally {
    isTestingSms.value = false;
  }
}
</script>

<template>
  <AccordionItem
    value="sms-configuration"
    class="rounded-lg border bg-white px-6 shadow-sm last:border-b"
  >
    <AccordionTrigger type="button" class="py-5 hover:no-underline">
      <span class="flex flex-col gap-1 text-left">
        <span class="text-base font-semibold text-gray-900">
          SMS Configuration
        </span>
        <span class="text-sm font-normal text-gray-600">
          Outbound SMS provider and testing
        </span>
      </span>
    </AccordionTrigger>
    <AccordionContent class="pb-6">
      <p class="text-sm text-gray-600 mt-2 leading-relaxed">
        Select an SMS provider for outbound notifications. SMS is restricted to
        Canadian phone numbers only.
      </p>

      <!-- Provider selector -->
      <div class="space-y-4 bg-gray-50 p-4 rounded-lg">
        <div class="space-y-2">
          <Label for="smsProvider">SMS Provider</Label>
          <select
            id="smsProvider"
            v-model="local.smsProvider"
            class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option :value="null">— Select provider —</option>
            <option value="aws">AWS End User Messaging SMS</option>
            <option value="twilio">Twilio</option>
          </select>
          <p v-if="errors.smsProvider" class="text-sm text-destructive">
            {{ errors.smsProvider }}
          </p>
        </div>

        <!-- AWS SMS -->
        <template v-if="local.smsProvider === 'aws'">
          <div class="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800 space-y-1">
            <p class="font-medium">AWS configuration is managed via CDK</p>
            <p>
              The origination phone number and AWS region are read from
              environment variables (<code class="font-mono text-xs">SMS_ORIGINATION_NUMBER</code>,
              <code class="font-mono text-xs">AWS_REGION</code>). No credentials
              need to be entered here.
            </p>
          </div>
        </template>

        <!-- Twilio credentials -->
        <template v-if="local.smsProvider === 'twilio'">
          <div class="space-y-2">
            <Label for="twilioAccountSid">Twilio Account SID</Label>
            <Input
              id="twilioAccountSid"
              v-model="local.twilioAccountSid"
              :aria-invalid="errors.twilioAccountSid ? 'true' : undefined"
            />
            <p v-if="errors.twilioAccountSid" class="text-sm text-destructive">
              {{ errors.twilioAccountSid }}
            </p>
          </div>
          <div class="space-y-2">
            <Label for="twilioAuthToken">Twilio Auth Token</Label>
            <Input
              id="twilioAuthToken"
              v-model="local.twilioAuthToken"
              type="password"
              :aria-invalid="errors.twilioAuthToken ? 'true' : undefined"
            />
            <p v-if="errors.twilioAuthToken" class="text-sm text-destructive">
              {{ errors.twilioAuthToken }}
            </p>
          </div>
          <div class="space-y-2">
            <Label for="twilioPhoneNumber">Twilio Phone Number</Label>
            <Input
              id="twilioPhoneNumber"
              v-model="local.twilioPhoneNumber"
              :aria-invalid="errors.twilioPhoneNumber ? 'true' : undefined"
            />
            <p
              v-if="errors.twilioPhoneNumber"
              class="text-sm text-destructive"
            >
              {{ errors.twilioPhoneNumber }}
            </p>
          </div>
        </template>
      </div>

      <!-- SMS Allowlist -->
      <div class="mt-6 space-y-3">
        <div>
          <Label>Approved Send-to Numbers</Label>
          <p class="text-sm text-gray-600 mt-1">
            Agent SMS sends are blocked unless the recipient is in this list.
            An empty list blocks all agent SMS sends.
          </p>
        </div>
        <div
          v-if="(local.smsSendAllowlist ?? []).length === 0"
          class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          No approved numbers — all agent SMS sends are currently blocked.
        </div>
        <div v-else class="space-y-1">
          <div
            v-for="entry in local.smsSendAllowlist"
            :key="entry.phoneNumber"
            class="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <div>
              <span class="font-mono text-slate-800">{{ entry.phoneNumber }}</span>
              <span v-if="entry.label" class="ml-2 text-slate-500">{{ entry.label }}</span>
            </div>
            <button
              type="button"
              class="ml-2 text-slate-400 hover:text-red-600"
              aria-label="Remove"
              @click="removeAllowlistEntry(entry.phoneNumber)"
            >✕</button>
          </div>
        </div>
        <div class="flex gap-2">
          <Input
            v-model="newAllowlistPhone"
            placeholder="+16135551234"
            class="w-44 shrink-0"
            @keydown.enter.prevent="addAllowlistEntry"
          />
          <Input
            v-model="newAllowlistLabel"
            placeholder="Label (optional)"
            class="flex-1"
            @keydown.enter.prevent="addAllowlistEntry"
          />
          <Button type="button" variant="outline" @click="addAllowlistEntry">Add</Button>
        </div>
        <p v-if="allowlistError" class="text-sm text-destructive">{{ allowlistError }}</p>
      </div>

      <!-- Test SMS Section -->
      <div v-if="local.smsProvider" class="mt-6 space-y-4">
        <h4 class="text-sm font-medium text-gray-900">
          Test SMS Configuration
        </h4>
        <div class="space-y-4 bg-blue-50 p-4 rounded-lg">
          <div class="space-y-2">
            <Label for="testSmsTo">Phone Number to Test *</Label>
            <Input
              id="testSmsTo"
              v-model="testSmsTo"
              placeholder="+16135551234"
            />
            <p class="text-xs text-gray-600">
              Canadian numbers only (e.g. +1 613 555 1234)
            </p>
          </div>
          <div class="space-y-2">
            <Label for="testSmsMessage">Test Message</Label>
            <Input id="testSmsMessage" v-model="testSmsMessage" />
          </div>
          <div class="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              :disabled="isTestingSms || !canSendTest"
              @click="handleTestSms"
            >
              <template v-if="isTestingSms">Sending Test SMS...</template>
              <template v-else>Send Test SMS</template>
            </Button>
          </div>

          <Alert
            v-if="testSmsResult"
            :variant="testSmsResult.success ? 'success' : 'destructive'"
            class="mt-2"
          >
            <AlertTitle>
              {{
                testSmsResult.success
                  ? "SMS sent successfully"
                  : "SMS delivery failed"
              }}
            </AlertTitle>
            <p v-if="testSmsResult.error" class="mt-2 text-sm">
              {{ testSmsResult.error }}
            </p>
          </Alert>
        </div>

        <div class="flex justify-end pt-2">
          <Button
            type="button"
            :disabled="!canManageTenant || saving || !hasChanges"
            @click="emit('save')"
          >
            {{ saving ? "Saving..." : "Save SMS Settings" }}
          </Button>
        </div>
      </div>

      <!-- Save button when no provider selected -->
      <div v-if="local.smsProvider === null" class="flex justify-end pt-4">
        <Button
          type="button"
          :disabled="!canManageTenant || saving || !hasChanges"
          @click="emit('save')"
        >
          {{ saving ? "Saving..." : "Save SMS Settings" }}
        </Button>
      </div>
    </AccordionContent>
  </AccordionItem>
</template>
