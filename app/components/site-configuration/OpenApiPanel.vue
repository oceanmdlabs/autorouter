<script setup lang="ts">
import { Copy } from "lucide-vue-next";
const props = defineProps<{
  modelValue: {
    siteKey: string | null;
    siteCredential: string | null;
    sharedEncryptionKey: string | null;
  };
  errors: Record<string, string>;
  canManageTenant: boolean;
  saving: boolean;
  hasChanges: boolean;
  webhookEndpoint: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [
    value: {
      siteKey: string | null;
      siteCredential: string | null;
      sharedEncryptionKey: string | null;
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
    value="ocean-open-api"
    class="rounded-lg border bg-white px-6 shadow-sm last:border-b"
  >
    <AccordionTrigger type="button" class="py-5 hover:no-underline">
      <span class="flex flex-col gap-1 text-left">
        <span class="text-base font-semibold text-gray-900">
          Ocean Patient Engagement Credentials
        </span>
        <span class="text-sm font-normal text-gray-600">
          Optional patient engagement credentials and encryption
          settings
        </span>
      </span>
    </AccordionTrigger>
    <AccordionContent class="pb-6">
      <p class="text-sm text-gray-600 mt-2 leading-relaxed">
        Configure your Ocean Open API credentials for patient engagement
        use cases, such as patient messaging and forms completion. This
        is an optional connection that enables advanced patient
        interaction features.
      </p>
      <div class="space-y-4 bg-gray-50 p-4 rounded-lg">
        <div class="space-y-2">
          <Label class="text-sm font-medium">Patient Engagement Webhook URL</Label>
          <div class="flex items-center gap-2">
            <Input :model-value="webhookEndpoint" readonly class="bg-white" />
            <Button variant="outline" size="icon" @click="emit('copy', webhookEndpoint)">
              <Copy class="h-4 w-4" />
            </Button>
          </div>
          <p class="text-xs text-gray-600">
            Use this URL when configuring the Patient Engagement integration in Ocean.
          </p>
        </div>
      </div>

      <div class="space-y-4 bg-gray-50 p-4 rounded-lg">
        <div class="space-y-2">
          <Label for="siteKey">Site Key</Label>
          <div class="flex items-center gap-2">
            <Input
              id="siteKey"
              v-model="local.siteKey"
              type="password"
              :aria-invalid="errors.siteKey ? 'true' : undefined"
              class="flex-1"
            />
          </div>
          <p v-if="errors.siteKey" class="text-sm text-destructive">
            {{ errors.siteKey }}
          </p>
        </div>
        <div class="space-y-2">
          <Label for="siteCredential">Site Credential</Label>
          <div class="flex items-center gap-2">
            <Input
              id="siteCredential"
              v-model="local.siteCredential"
              type="password"
              :aria-invalid="errors.siteCredential ? 'true' : undefined"
              class="flex-1"
            />
          </div>
          <p
            v-if="errors.siteCredential"
            class="text-sm text-destructive"
          >
            {{ errors.siteCredential }}
          </p>
        </div>
        <div class="space-y-2">
          <Label for="sharedEncryptionKey">Shared Encryption Key</Label>
          <div class="flex items-center gap-2">
            <Input
              id="sharedEncryptionKey"
              v-model="local.sharedEncryptionKey"
              type="password"
              :aria-invalid="
                errors.sharedEncryptionKey ? 'true' : undefined
              "
              class="flex-1"
            />
          </div>
          <p
            v-if="errors.sharedEncryptionKey"
            class="text-sm text-destructive"
          >
            {{ errors.sharedEncryptionKey }}
          </p>
        </div>
        <p class="text-sm text-gray-600 mt-4">
          These credentials are used for secure communication with
          Ocean's Open API for patient engagement features.
        </p>
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
            saving
              ? "Saving..."
              : "Save Open API Settings"
          }}
        </Button>
      </div>
    </AccordionContent>
  </AccordionItem>
</template>
