<template>
	<div class="w-full">
		<slot />
	</div>
</template>

<script setup lang="ts">
import { provide, ref, watch } from 'vue'

interface Props {
	defaultValue?: string
}

const props = withDefaults(defineProps<Props>(), {
	defaultValue: ''
})

const activeTab = ref<string>(props.defaultValue)
const tabs = ref<string[]>([])

const registerTab = (id: string) => {
	if (!tabs.value.includes(id)) {
		tabs.value.push(id)
	}
	if (!activeTab.value) {
		activeTab.value = id
	}
}

const setActiveTab = (id: string) => {
	activeTab.value = id
}

provide('tabs', {
	activeTab,
	tabs,
	registerTab,
	setActiveTab
})

// Watch for changes to defaultValue
watch(() => props.defaultValue, (newValue) => {
	if (newValue && tabs.value.includes(newValue)) {
		activeTab.value = newValue
	}
})
</script>