<template>
	<div v-show="isActive" :class="[
		'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
	]" role="tabpanel" :aria-labelledby="`tab-${value}`">
		<slot />
	</div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'

interface TabsContext {
	activeTab: Ref<string>
	tabs: Ref<string[]>
	registerTab: (id: string) => void
	setActiveTab: (id: string) => void
}

const props = defineProps<{
	value: string
}>()

const tabsContext = inject<TabsContext>('tabs')

if (!tabsContext) {
	throw new Error('TabsContent must be used within a Tabs component')
}

const { activeTab } = tabsContext

const isActive = computed(() => activeTab.value === props.value)
</script>