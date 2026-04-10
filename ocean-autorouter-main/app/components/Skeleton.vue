<script setup lang="ts">
import { cn } from '@/app/lib/utils'

interface Props {
	className?: string
}

const props = withDefaults(defineProps<Props>(), {
	className: ''
})
</script>

<template>
	<div :class="cn('bg-muted animate-pulse rounded', className)" />
</template>