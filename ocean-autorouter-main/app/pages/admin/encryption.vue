<template>
  <div class="container mx-auto p-4 max-w-4xl">
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900">System Administration</h1>
        <p class="mt-2 text-sm text-gray-600 leading-relaxed max-w-3xl">
          Manage site configurations and encryption provisioning for all tenants.
        </p>
      </div>

      <!-- Tab navigation -->
      <div class="border-b border-gray-200">
        <nav class="-mb-px flex space-x-8">
          <NuxtLink to="/admin" class="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 whitespace-nowrap border-b-2 py-2 px-1 text-sm font-medium">
            Site Configurations
          </NuxtLink>
          <NuxtLink to="/admin/encryption" class="border-primary text-primary whitespace-nowrap border-b-2 py-2 px-1 text-sm font-medium">
            Encryption Provisioning
          </NuxtLink>
        </nav>
      </div>

      <!-- Loading State -->
      <div v-if="status === 'pending'" class="flex items-center justify-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span class="ml-2 text-gray-600">Loading tenant status...</span>
      </div>

      <!-- Error State -->
      <div v-if="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        {{ error }}
      </div>

      <!-- Success Message -->
      <div v-if="successMessage" class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
        {{ successMessage }}
      </div>

      <!-- Summary Cards -->
      <div v-if="encryptionStatus" class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-gray-500">Total Tenants</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">{{ encryptionStatus.tenants.length }}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-gray-500">Provisioned</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold text-green-600">{{ encryptionStatus.totalProvisioned }}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium text-gray-500">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold text-orange-600">{{ encryptionStatus.totalPending }}</div>
          </CardContent>
        </Card>
      </div>

      <!-- Pending Tenants Section -->
      <div v-if="pendingTenants.length > 0">
        <h2 class="text-lg font-semibold mb-3">Pending Provisioning</h2>
        <div class="space-y-4">
          <Card v-for="tenant in pendingTenants" :key="tenant.id" class="border-orange-200">
            <CardHeader>
              <div class="flex justify-between items-start">
                <div>
                  <CardTitle>{{ tenant.name }}</CardTitle>
                  <CardDescription>
                    Site ID: {{ tenant.id }}<br />
                    Tenant ID: {{ tenant.tenantId }}
                  </CardDescription>
                </div>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                  Not Provisioned
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div v-if="selectedTenantId === tenant.id" class="space-y-4">
                <div>
                  <Label for="clinicSecret">Clinic Secret</Label>
                  <Input
                    id="clinicSecret"
                    v-model="clinicSecret"
                    type="password"
                    placeholder="Enter a strong clinic secret (min 12 characters)"
                    class="mt-1"
                  />
                  <p class="text-xs text-gray-500 mt-1">
                    ⚠️ This secret is required to decrypt PHI. If lost, data is unrecoverable.
                  </p>
                </div>
                <div class="flex gap-2">
                  <button
                    @click="provisionTenant(tenant.id)"
                    :disabled="isProvisioning || !isSecretValid"
                    class="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white px-4 py-2 rounded transition-colors"
                  >
                    <span v-if="isProvisioning">Provisioning...</span>
                    <span v-else>Execute Provisioning</span>
                  </button>
                  <button
                    @click="selectedTenantId = null; clinicSecret = ''"
                    class="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
              <div v-else>
                <button
                  @click="selectedTenantId = tenant.id"
                  class="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded transition-colors"
                >
                  Provision Encryption
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <!-- No Pending Tenants -->
      <div v-else-if="encryptionStatus && encryptionStatus.totalPending === 0">
        <div class="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <div class="text-green-600 text-lg font-medium mb-2">✓ All Tenants Provisioned</div>
          <p class="text-gray-600">All tenant sites have been provisioned with Zero-Knowledge encryption.</p>
        </div>
      </div>

      <!-- Provisioned Tenants Section -->
      <div v-if="provisionedTenants.length > 0">
        <h2 class="text-lg font-semibold mb-3">Provisioned Tenants</h2>
        <div class="space-y-2">
          <Card v-for="tenant in provisionedTenants" :key="tenant.id" class="border-green-200">
            <CardHeader class="py-3">
              <div class="flex justify-between items-center">
                <div>
                  <CardTitle class="text-base">{{ tenant.name }}</CardTitle>
                  <CardDescription class="text-xs">
                    {{ tenant.tenantId }}
                  </CardDescription>
                </div>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  ✓ Encrypted
                </span>
              </div>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TenantEncryptionStatus } from "@/src/application/repositories/site-configuration.repository.interface";

interface EncryptionStatusResponse {
  tenants: TenantEncryptionStatus[];
  totalProvisioned: number;
  totalPending: number;
}

interface ProvisionTenantResponse {
  success: boolean;
  siteId: string;
  message: string;
  recordsMigrated: number;
  recordsRemaining: number;
}

const status = ref<'pending' | 'error' | 'success'>('pending');
const error = ref<string | null>(null);
const successMessage = ref<string | null>(null);
const selectedTenantId = ref<string | null>(null);
const clinicSecret = ref('');
const isProvisioning = ref(false);

const isSecretValid = computed(() => clinicSecret.value.length >= 12);

const encryptionStatus = ref<EncryptionStatusResponse | null>(null);

async function loadEncryptionStatus() {
  try {
    status.value = 'pending';
    const result = await $fetch<EncryptionStatusResponse>('/api/admin/encryption-status');
    encryptionStatus.value = result;
    status.value = 'success';
  } catch (e) {
    status.value = 'error';
    error.value = e instanceof Error ? e.message : 'Failed to load encryption status';
  }
}

// Load on mount
onMounted(() => {
  loadEncryptionStatus();
});

const pendingTenants = computed(() =>
  encryptionStatus.value?.tenants.filter(t => !t.isEncryptedSetup) ?? []
);

const provisionedTenants = computed(() =>
  encryptionStatus.value?.tenants.filter(t => t.isEncryptedSetup) ?? []
);

async function provisionTenant(siteId: string) {
  if (!isSecretValid.value) {
    error.value = 'Clinic secret must be at least 12 characters';
    return;
  }

  error.value = null;
  successMessage.value = null;
  isProvisioning.value = true;

  try {
    const result = await $fetch<ProvisionTenantResponse>('/api/admin/provision-tenant', {
      method: 'POST',
      body: {
        siteConfigId: siteId,
        clinicSecret: clinicSecret.value
      }
    });

    if (result.success) {
      successMessage.value = result.message;
      clinicSecret.value = '';
      selectedTenantId.value = null;
      // Refresh the list
      await loadEncryptionStatus();
    }
  } catch (e: any) {
    error.value = e.data?.statusMessage ?? e.message ?? 'Failed to provision tenant';
  } finally {
    isProvisioning.value = false;
  }
}
</script>

