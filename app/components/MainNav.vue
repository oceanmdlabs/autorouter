<template>
	<nav class="flex items-center space-x-4 lg:space-x-6">
		<NuxtLink v-for="item in items" :key="item.href" :to="item.href"
			class="text-sm font-medium transition-colors hover:text-primary">
			{{ item.title }}
		</NuxtLink>
	</nav>
</template>

<script setup lang="ts">
const items = [
	{
		title: "Overview",
		href: "/",
	},
	{
		title: "Patients",
		href: "/patients",
	},
	{
		title: "Services",
		href: "/services",
	},
	{
		title: "Settings",
		href: "/settings",
	},
]
</script>