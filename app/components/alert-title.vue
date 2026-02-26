<template>
	<h5 :class="['flex items-center gap-2 font-medium leading-none tracking-tight', className]">
		<slot />
	</h5>
</template>

<script setup lang="ts">
interface Props {
	className?: string
}

withDefaults(defineProps<Props>(), {
	className: ''
})
</script>