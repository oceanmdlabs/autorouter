<script setup lang="ts">
const { user } = useUserSession()
const activeTenantId = user.value?.activeTenantId ?? user.value?.tenantId
navigateTo(activeTenantId ? "/portal/routing-rules" : "/portal/sites");
</script>
<template>
  <div>
    <h1>Portal</h1>
  </div>
</template>
