<script setup lang="ts">
interface Props {
	to: string
	active?: boolean
}

const props = defineProps<Props>()
const isActive = computed(() => {
	return useRoute().path.startsWith(props.to)
})
</script>

<template>
	<NuxtLink :to="to"
		class="inline-flex items-center justify-center text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:text-primary"
		:class="{
			'text-primary font-semibold': isActive,
			'text-muted-foreground': !isActive
		}">
		<slot />
	</NuxtLink>
</template>