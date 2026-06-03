<script setup lang="ts">
import { toast } from "vue-sonner";
import { handleMissingActiveTenantError } from "@/app/lib/active-tenant";

const props = defineProps<{
  modelValue: {
    emailProvider: string | null;
    emailFromAddress: string | null;
    emailApiKey: string | null;
    emailFromName: string | null;
    emailSendAllowlist: string[] | null;
  };
  errors: Record<string, string>;
  canManageTenant: boolean;
  saving: boolean;
  hasChanges: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [
    value: {
      emailProvider: string | null;
      emailFromAddress: string | null;
      emailApiKey: string | null;
      emailFromName: string | null;
      emailSendAllowlist: string[] | null;
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

// Email allowlist management
const newAllowlistEmail = ref("");
const allowlistEmailError = ref("");

function addAllowlistEmail() {
  const email = newAllowlistEmail.value.trim().toLowerCase();
  if (!email) return;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    allowlistEmailError.value = "Enter a valid email address";
    return;
  }
  const current = local.emailSendAllowlist ?? [];
  if (current.map((e) => e.toLowerCase()).includes(email)) {
    allowlistEmailError.value = "Address is already in the allowlist";
    return;
  }
  local.emailSendAllowlist = [...current, email];
  newAllowlistEmail.value = "";
  allowlistEmailError.value = "";
}

function removeAllowlistEmail(email: string) {
  local.emailSendAllowlist = (local.emailSendAllowlist ?? []).filter(
    (e) => e !== email,
  );
}

// Test email state
const requestFetch = useRequestFetch();
const isTestingEmail = ref(false);
const testEmailResult = ref<{ success: boolean; error?: string } | null>(null);
const testEmailTo = ref("");
const testEmailSubject = ref("Test Email from Ocean Autorouter");
const testEmailMessage = ref(
  "This is a test email to verify your email configuration is working correctly.",
);

async function handleTestEmail() {
  if (!testEmailTo.value.trim()) {
    toast.error("Email address required", {
      description: "Please enter an email address to send the test email to.",
    });
    return;
  }

  isTestingEmail.value = true;
  testEmailResult.value = null;

  try {
    const response = await requestFetch<{ success: boolean; error?: string }>(
      "/api/site-configuration/test-email",
      {
        method: "POST",
        body: {
          to: testEmailTo.value,
          subject: testEmailSubject.value,
          message: testEmailMessage.value,
        },
      },
    );
    testEmailResult.value = response;
    if (response.success) {
      toast.success("Test email sent successfully", {
        description: `Email sent to ${testEmailTo.value}`,
      });
    }
  } catch (error: any) {
    if (await handleMissingActiveTenantError(error)) {
      return;
    }
    testEmailResult.value = {
      success: false,
      error: error.data?.error || "Failed to send test email",
    };
    toast.error("Failed to send test email", {
      description: error.data?.error || "Failed to send test email",
    });
  } finally {
    isTestingEmail.value = false;
  }
}
</script>

<template>
  <AccordionItem
    value="email-configuration"
    class="rounded-lg border bg-white px-6 shadow-sm last:border-b"
  >
    <AccordionTrigger type="button" class="py-5 hover:no-underline">
      <span class="flex flex-col gap-1 text-left">
        <span class="text-base font-semibold text-gray-900">
          Email Configuration
        </span>
        <span class="text-sm font-normal text-gray-600">
          SMTP2GO credentials and outbound email testing
        </span>
      </span>
    </AccordionTrigger>
    <AccordionContent class="pb-6">
      <p class="text-sm text-gray-600 mt-2 leading-relaxed">
        Configure your email settings for sending notifications.
      </p>
      <div class="space-y-4 bg-gray-50 p-4 rounded-lg">
        <div class="space-y-2">
          <Label for="emailProvider">Email Provider</Label>
          <Select
            id="emailProvider"
            v-model="local.emailProvider"
            :aria-invalid="errors.emailProvider ? 'true' : undefined"
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an email provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ses">Amazon SES</SelectItem>
              <SelectItem value="smtp2go">SMTP2GO</SelectItem>
            </SelectContent>
          </Select>
          <p
            v-if="errors.emailProvider"
            class="text-sm text-destructive"
          >
            {{ errors.emailProvider }}
          </p>
        </div>
        <div class="space-y-2">
          <Label for="emailFromAddress">From Email Address</Label>
          <Input
            id="emailFromAddress"
            v-model="local.emailFromAddress"
            :aria-invalid="errors.emailFromAddress ? 'true' : undefined"
          />
          <p
            v-if="errors.emailFromAddress"
            class="text-sm text-destructive"
          >
            {{ errors.emailFromAddress }}
          </p>
        </div>
        <div v-if="local.emailProvider === 'ses'" class="space-y-2">
          <p class="text-sm text-gray-600">
            Amazon SES uses the IAM role attached to the service. No API key is required.
          </p>
        </div>
        <div v-if="local.emailProvider !== 'ses'" class="space-y-2">
          <Label for="emailApiKey">SMTP2GO API Key</Label>
          <div class="flex items-center gap-2">
            <Input
              id="emailApiKey"
              v-model="local.emailApiKey"
              type="password"
              :aria-invalid="errors.emailApiKey ? 'true' : undefined"
              class="flex-1"
            />
          </div>
          <p class="text-sm text-gray-600">
            Get your API key from the
            <a
              href="https://app.smtp2go.com/settings/api_keys"
              target="_blank"
              class="text-blue-600 hover:underline"
              >SMTP2GO dashboard</a
            >
          </p>
          <p v-if="errors.emailApiKey" class="text-sm text-destructive">
            {{ errors.emailApiKey }}
          </p>
        </div>
        <div class="space-y-2">
          <Label for="emailFromName">From Name</Label>
          <Input
            id="emailFromName"
            v-model="local.emailFromName"
            :aria-invalid="errors.emailFromName ? 'true' : undefined"
            placeholder="(leave blank to use email address)"
          />
          <p
            v-if="errors.emailFromName"
            class="text-sm text-destructive"
          >
            {{ errors.emailFromName }}
          </p>
        </div>

        <!-- Email Send Allowlist -->
        <div class="space-y-2">
          <Label>Approved Send-to Addresses</Label>
          <p class="text-sm text-gray-600">
            Agent email sends are blocked unless every To and CC recipient is in this list.
            An empty list blocks all agent email sends.
          </p>
          <div
            v-if="(local.emailSendAllowlist ?? []).length === 0"
            class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
          >
            No approved addresses — all agent email sends are currently blocked.
          </div>
          <div v-else class="space-y-1">
            <div
              v-for="email in local.emailSendAllowlist"
              :key="email"
              class="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <span class="font-mono text-slate-800">{{ email }}</span>
              <button
                type="button"
                class="ml-2 text-slate-400 hover:text-red-600"
                @click="removeAllowlistEmail(email)"
                aria-label="Remove"
              >✕</button>
            </div>
          </div>
          <div class="flex gap-2">
            <Input
              v-model="newAllowlistEmail"
              placeholder="doctor@example.com"
              class="flex-1"
              @keydown.enter.prevent="addAllowlistEmail"
            />
            <Button type="button" variant="outline" @click="addAllowlistEmail">Add</Button>
          </div>
          <p v-if="allowlistEmailError" class="text-sm text-destructive">{{ allowlistEmailError }}</p>
        </div>
      </div>

      <!-- Test Email Section -->
      <div class="mt-6 space-y-4">
        <h4 class="text-sm font-medium text-gray-900">
          Test Email Configuration
        </h4>
        <div class="space-y-4 bg-blue-50 p-4 rounded-lg">
          <div class="space-y-2">
            <Label for="testEmailTo">Email Address to Test *</Label>
            <Input
              id="testEmailTo"
              v-model="testEmailTo"
              placeholder="test@example.com"
            />
            <p class="text-xs text-gray-600">
              Enter a valid email address to test email delivery
            </p>
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
            <Button
              type="button"
              variant="outline"
              @click="handleTestEmail"
              :disabled="
                isTestingEmail ||
                !local.emailProvider ||
                !local.emailFromAddress ||
                (local.emailProvider !== 'ses' && !local.emailApiKey) ||
                !testEmailTo.trim()
              "
            >
              <template v-if="isTestingEmail"
                >Sending Test Email...</template
              >
              <template v-else>Send Test Email</template>
            </Button>
          </div>

          <Alert
            v-if="testEmailResult"
            :variant="
              testEmailResult.success ? 'success' : 'destructive'
            "
            class="mt-2"
          >
            <AlertTitle
              >{{
                testEmailResult.success
                  ? "Email sent successfully"
                  : "Email delivery failed"
              }}
            </AlertTitle>
            <p v-if="testEmailResult.error" class="mt-2 text-sm">
              {{ testEmailResult.error }}
            </p>
          </Alert>
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
              saving ? "Saving..." : "Save Email Settings"
            }}
          </Button>
        </div>
      </div>
    </AccordionContent>
  </AccordionItem>
</template>
