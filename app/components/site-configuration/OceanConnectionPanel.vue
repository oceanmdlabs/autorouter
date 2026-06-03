<script setup lang="ts">
import { handleMissingActiveTenantError } from "@/app/lib/active-tenant";

const props = defineProps<{
  modelValue: {
    name: string;
    oceanServer: string;
    oceanSiteNum: string;
    oceanClientId: string;
    oceanClientSecret: string;
  };
  errors: Record<string, string>;
  canManageTenant: boolean;
  saving: boolean;
  hasChanges: boolean;
  oceanServerUrl: string;
  isNewConfig: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [
    value: {
      name: string;
      oceanServer: string;
      oceanSiteNum: string;
      oceanClientId: string;
      oceanClientSecret: string;
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
const isTestingConnection = ref(false);
const testConnectionResult = ref<{ success: boolean; error?: string } | null>(null);

async function handleTestConnection() {
  isTestingConnection.value = true;
  testConnectionResult.value = null;

  try {
    const response = await requestFetch<{ success: boolean; error?: string }>(
      "/api/site-configuration/test-connection",
      {
        method: "POST",
        body: {
          oceanServer: local.oceanServer.trim(),
          oceanClientId: local.oceanClientId.trim(),
          oceanClientSecret: local.oceanClientSecret.trim(),
        },
      },
    );
    testConnectionResult.value = response;
  } catch (error: any) {
    if (await handleMissingActiveTenantError(error)) {
      return;
    }
    testConnectionResult.value = {
      success: false,
      error: error.data?.error || "Failed to test connection",
    };
  } finally {
    isTestingConnection.value = false;
  }
}
</script>

<template>
  <AccordionItem
    value="autorouter-to-ocean"
    class="rounded-lg border bg-white px-6 shadow-sm last:border-b"
  >
    <AccordionTrigger type="button" class="py-5 hover:no-underline">
      <span class="flex flex-col gap-1 text-left">
        <span class="text-base font-semibold text-gray-900">
          Connecting the Autorouter to Ocean
        </span>
        <span class="text-sm font-normal text-gray-600">
          Ocean site settings, OAuth credentials, and connection test
        </span>
      </span>
    </AccordionTrigger>
    <AccordionContent class="pb-6">
      <div class="space-y-4">
        <div class="space-y-2">
          <Label for="oceanServer">Server</Label>
          <Select
            id="oceanServer"
            v-model="local.oceanServer"
            :aria-invalid="errors.oceanServer ? 'true' : undefined"
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a server" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ocean"
                >Ocean Production (ocean.cognisantmd.com)
              </SelectItem>
              <SelectItem value="test"
                >Test (test.cognisantmd.com)</SelectItem
              >
              <SelectItem value="staging"
                >Staging (staging.cognisantmd.com)</SelectItem
              >
              <SelectItem value="local"
                >Local (localhost:8080)</SelectItem
              >
            </SelectContent>
          </Select>
        </div>
        <div class="space-y-2">
          <Label for="oceanSiteNum">Ocean Site Number</Label>
          <Input
            id="oceanSiteNum"
            v-model="local.oceanSiteNum"
            :aria-invalid="errors.oceanSiteNum ? 'true' : undefined"
          />
          <p
            v-if="errors.oceanSiteNum"
            class="text-sm text-destructive"
          >
            {{ errors.oceanSiteNum }}
          </p>
        </div>
        <p class="text-sm text-gray-600 mb-6 leading-relaxed">
          Obtain the following credentials in the
          <a
            :href="`${oceanServerUrl}/ocean/portal.html${local.oceanSiteNum ? `?siteNum=${local.oceanSiteNum}` : ''}#/admin/credentials/`"
            target="_blank"
            class="text-blue-600 font-medium hover:underline"
            >Ocean Site Admin → Manage Credentials</a
          >:
        </p>
        <div class="space-y-2">
          <Label for="oceanClientId">Ocean's OAuth Client ID</Label>
          <Input
            id="oceanClientId"
            v-model="local.oceanClientId"
            :aria-invalid="errors.oceanClientId ? 'true' : undefined"
          />
          <p
            v-if="errors.oceanClientId"
            class="text-sm text-destructive"
          >
            {{ errors.oceanClientId }}
          </p>
        </div>
        <div class="space-y-2">
          <Label for="oceanClientSecret"
            >Ocean's OAuth Client Secret</Label
          >
          <div class="flex items-center gap-2">
            <Input
              id="oceanClientSecret"
              v-model="local.oceanClientSecret"
              type="password"
              :aria-invalid="
                errors.oceanClientSecret ? 'true' : undefined
              "
              class="flex-1"
            />
          </div>
          <p
            v-if="errors.oceanClientSecret"
            class="text-sm text-destructive"
          >
            {{ errors.oceanClientSecret }}
          </p>
        </div>

        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              @click="handleTestConnection"
              :disabled="
                isTestingConnection ||
                !local.oceanClientId ||
                !local.oceanClientSecret
              "
            >
              <template v-if="isTestingConnection"
                >Testing Connection...</template
              >
              <template v-else>Test Connection to Ocean</template>
            </Button>
          </div>

          <Alert
            v-if="testConnectionResult"
            :variant="
              testConnectionResult.success ? 'success' : 'destructive'
            "
            class="mt-2"
          >
            <AlertTitle
              >{{
                testConnectionResult.success
                  ? "Successfully connected to Ocean"
                  : "Connection to Ocean Failed"
              }}
            </AlertTitle>
            <p v-if="testConnectionResult.error" class="mt-2 text-sm">
              {{ testConnectionResult.error }}
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
              (!isNewConfig && !hasChanges)
            "
          >
            {{
              saving
                ? "Saving..."
                : "Save Connection Settings"
            }}
          </Button>
        </div>
      </div>
    </AccordionContent>
  </AccordionItem>
</template>
