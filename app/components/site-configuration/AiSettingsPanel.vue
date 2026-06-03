<script setup lang="ts">
const props = defineProps<{
  modelValue: {
    aiProvider: string | null;
    aiApiKey: string | null;
    aiModel: string | null;
  };
  errors: Record<string, string>;
  canManageTenant: boolean;
  saving: boolean;
  hasChanges: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [
    value: {
      aiProvider: string | null;
      aiApiKey: string | null;
      aiModel: string | null;
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

const BEDROCK_PRESET_MODELS = [
  "mistral.mistral-large-2402-v1:0",
  "anthropic.claude-3-haiku-20240307-v1:0",
  "anthropic.claude-3-sonnet-20240229-v1:0",
];

const bedrockModelIsPreset = computed(() => {
  const model = local.aiModel;
  return model == null || BEDROCK_PRESET_MODELS.includes(model);
});

function onBedrockModelSelect(value: unknown) {
  if (typeof value !== "string") return;
  if (value === "custom") {
    local.aiModel = "";
  } else {
    local.aiModel = value;
  }
}
</script>

<template>
  <AccordionItem
    value="ai-configuration"
    class="rounded-lg border bg-white px-6 shadow-sm last:border-b"
  >
    <AccordionTrigger type="button" class="py-5 hover:no-underline">
      <span class="flex flex-col gap-1 text-left">
        <span class="text-base font-semibold text-gray-900">
          AI Configuration
        </span>
        <span class="text-sm font-normal text-gray-600">
          Provider, API key, and model selection
        </span>
      </span>
    </AccordionTrigger>
    <AccordionContent class="pb-6">
      <p class="text-sm text-gray-600 mt-2 leading-relaxed">
        Configure your AI provider settings for enhanced routing
        capabilities.
      </p>
      <div class="space-y-2">
        <Label for="aiProvider">AI Provider</Label>
        <Select
          id="aiProvider"
          v-model="local.aiProvider"
          :aria-invalid="errors.aiProvider ? 'true' : undefined"
        >
          <SelectTrigger>
            <SelectValue placeholder="Select an AI provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="openai">OpenAI</SelectItem>
            <SelectItem value="google">Google</SelectItem>
            <SelectItem value="cohere">Cohere</SelectItem>
            <SelectItem value="bedrock">AWS Bedrock</SelectItem>
          </SelectContent>
        </Select>
        <p v-if="errors.aiProvider" class="text-sm text-destructive">
          {{ errors.aiProvider }}
        </p>
      </div>
      <div v-if="local.aiProvider !== 'bedrock'" class="space-y-2">
        <Label for="aiApiKey">API Key</Label>
        <div class="flex items-center gap-2">
          <Input
            id="aiApiKey"
            v-model="local.aiApiKey"
            type="password"
            :aria-invalid="errors.aiApiKey ? 'true' : undefined"
            class="flex-1"
          />
        </div>
        <p v-if="errors.aiApiKey" class="text-sm text-destructive">
          {{ errors.aiApiKey }}
        </p>
      </div>
      <div v-if="local.aiProvider === 'bedrock'" class="space-y-2">
        <Label for="aiModel">Model</Label>
        <Select
          id="aiModel"
          :model-value="bedrockModelIsPreset ? (local.aiModel ?? '') : 'custom'"
          @update:model-value="onBedrockModelSelect"
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a model" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mistral.mistral-large-2402-v1:0">Mistral Large</SelectItem>
            <SelectItem value="anthropic.claude-3-haiku-20240307-v1:0">Claude 3 Haiku</SelectItem>
            <SelectItem value="anthropic.claude-3-sonnet-20240229-v1:0">Claude 3 Sonnet</SelectItem>
            <SelectItem value="custom">Custom model ID...</SelectItem>
          </SelectContent>
        </Select>
        <Input
          v-if="!bedrockModelIsPreset"
          v-model="local.aiModel"
          placeholder="e.g. anthropic.claude-3-5-sonnet-20241022-v2:0"
          :aria-invalid="errors.aiModel ? 'true' : undefined"
        />
        <p class="text-xs text-muted-foreground">Uses the IAM role attached to the service. No API key required.</p>
        <p v-if="errors.aiModel" class="text-sm text-destructive">
          {{ errors.aiModel }}
        </p>
      </div>
      <div v-else class="space-y-2">
        <Label for="aiModel">Model</Label>
        <Input
          id="aiModel"
          v-model="local.aiModel"
          :aria-invalid="errors.aiModel ? 'true' : undefined"
          placeholder="(leave blank for default)"
        />
        <p v-if="errors.aiModel" class="text-sm text-destructive">
          {{ errors.aiModel }}
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
          {{ saving ? "Saving..." : "Save AI Settings" }}
        </Button>
      </div>
    </AccordionContent>
  </AccordionItem>
</template>
