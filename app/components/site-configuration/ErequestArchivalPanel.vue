<script setup lang="ts">
const props = defineProps<{
  modelValue: {
    erequestArchivalEnabled: boolean;
  };
  errors: Record<string, string>;
  canManageTenant: boolean;
  saving: boolean;
  hasChanges: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [
    value: {
      erequestArchivalEnabled: boolean;
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
</script>

<template>
  <AccordionItem
    value="erequest-archival"
    class="rounded-lg border bg-white px-6 shadow-sm last:border-b"
  >
    <AccordionTrigger type="button" class="py-5 hover:no-underline">
      <span class="flex flex-col gap-1 text-left">
        <span class="text-base font-semibold text-gray-900">
          eRequest Storage and Retrieval
        </span>
        <span class="text-sm font-normal text-gray-600">
          Retain inbound eRequests and archived documents for later
          access
        </span>
      </span>
    </AccordionTrigger>
    <AccordionContent class="pb-6">
      <div class="space-y-6">
        <div
          class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
        >
          Enabling this feature permits the Autorouter to store
          inbound eRequest data, documents, and PDFs that may include
          PHI. Your site is responsible for secure retention, access
          controls, and lifecycle management in accordance with PIPEDA
          and applicable provincial privacy laws.
        </div>

        <div
          class="flex items-center justify-between rounded-lg border bg-gray-50 p-4"
        >
          <div class="space-y-1 pr-4">
            <Label for="erequestArchivalEnabled"
              >Enable eRequest storage and retrieval</Label
            >
            <p class="text-sm text-gray-600">
              Turning this off stops retention of future inbound
              eRequests but does not delete previously retained records.
            </p>
          </div>
          <Switch
            id="erequestArchivalEnabled"
            v-model="local.erequestArchivalEnabled"
            :disabled="!canManageTenant"
          />
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
                : "Save eRequest Settings"
            }}
          </Button>
        </div>
      </div>
    </AccordionContent>
  </AccordionItem>
</template>
