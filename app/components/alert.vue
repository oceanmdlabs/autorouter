<template>
	<div :class="[
		'relative w-full rounded-lg border p-4',
		variantStyles[variant],
		className
	]" role="alert">
		<slot />
	</div>
</template>

<script setup lang="ts">
interface Props {
	variant?: 'default' | 'destructive' | 'warning' | 'success'
	className?: string
}

withDefaults(defineProps<Props>(), {
	variant: 'default',
	className: ''
})

const variantStyles = {
	default: 'bg-background text-foreground',
	destructive: 'border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive',
	warning: 'border-yellow-200 text-yellow-800 bg-yellow-50 dark:bg-yellow-900/10 dark:text-yellow-500 dark:border-yellow-500/20',
	success: 'border-green-200 text-green-800 bg-green-50 dark:bg-green-900/10 dark:text-green-500 dark:border-green-500/20'
}
</script>