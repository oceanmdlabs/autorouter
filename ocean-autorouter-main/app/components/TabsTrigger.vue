<template>
	<button :class="[
		'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
		isActive
			? 'bg-background text-foreground shadow-sm'
			: 'hover:bg-background/50 hover:text-foreground'
	]" :aria-selected="isActive" role="tab" @click="handleClick">
		<slot />
	</button>
</template>

<script setup lang="ts">
import { computed, inject, onMounted } from 'vue'

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
	throw new Error('TabsTrigger must be used within a Tabs component')
}

const { activeTab, registerTab, setActiveTab } = tabsContext

const isActive = computed(() => activeTab.value === props.value)

const handleClick = () => {
	setActiveTab(props.value)
}

onMounted(() => {
	registerTab(props.value)
})
</script>