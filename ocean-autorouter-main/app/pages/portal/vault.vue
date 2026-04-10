<script setup lang="ts">
import { Lock, Unlock, Shield, AlertTriangle, XCircle } from 'lucide-vue-next';
import { toast } from 'vue-sonner';

interface VaultStatusResponse {
  isProvisioned: boolean;
  isUnlocked: boolean;
  unlockedAt: string | null;
}

interface UnlockDekResponse {
  success: boolean;
  message: string;
  unlockedAt: string;
}

interface LockDekResponse {
  success: boolean;
  message: string;
}

const clinicSecret = ref('');
const isUnlocking = ref(false);
const isLocking = ref(false);
const error = ref<string | null>(null);

// Fetch vault status
const { data: vaultStatus, refresh: refreshStatus } = await useAsyncData<VaultStatusResponse>(
  'vault-status',
  async () => {
    try {
      return await $fetch<VaultStatusResponse>('/api/clinic/vault-status');
    } catch (e) {
      return {
        isProvisioned: false,
        isUnlocked: false,
        unlockedAt: null
      };
    }
  }
);

const isSecretValid = computed(() => clinicSecret.value.length >= 8);

const formattedUnlockedAt = computed(() => {
  if (!vaultStatus.value?.unlockedAt) return null;
  return new Date(vaultStatus.value.unlockedAt).toLocaleString();
});

async function unlockVault() {
  if (!isSecretValid.value) {
    error.value = 'Clinic secret must be at least 8 characters';
    return;
  }

  error.value = null;
  isUnlocking.value = true;

  try {
    const result = await $fetch<UnlockDekResponse>('/api/clinic/unlock-dek', {
      method: 'POST',
      body: { clinicSecret: clinicSecret.value }
    });

    if (result.success) {
      toast.success('Vault Unlocked', {
        description: 'You can now view full decision reasons.'
      });
      clinicSecret.value = '';
      await refreshStatus();
    }
  } catch (e: any) {
    error.value = e.data?.statusMessage ?? e.message ?? 'Failed to unlock vault';
    toast.error('Unlock Failed', {
      description: error.value ?? 'Invalid clinic secret'
    });
  } finally {
    isUnlocking.value = false;
  }
}

async function lockVault() {
  isLocking.value = true;

  try {
    const result = await $fetch<LockDekResponse>('/api/clinic/lock-dek', {
      method: 'POST'
    });

    if (result.success) {
      toast.success('Vault Locked', {
        description: 'Session decryption key cleared.'
      });
      await refreshStatus();
    }
  } catch (e: any) {
    toast.error('Lock Failed', {
      description: e.data?.statusMessage ?? 'Failed to lock vault'
    });
  } finally {
    isLocking.value = false;
  }
}
</script>

<template>
  <div class="container mx-auto py-6 px-4 sm:px-6 lg:px-8 max-w-3xl">
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900">Audit Vault</h1>
        <p class="mt-2 text-sm text-gray-600 leading-relaxed">
          Manage access to encrypted audit data. Decision reasons are encrypted at rest
          as a precaution since they may reference patient information.
          Your clinic secret is required to view the full decision details.
        </p>
      </div>

      <!-- Not Provisioned State -->
      <Card v-if="vaultStatus && !vaultStatus.isProvisioned">
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <AlertTriangle class="h-5 w-5 text-orange-500" />
            Encryption Not Configured
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-sm text-gray-600 mb-4">
            This account has not been configured for audit data encryption yet.
            Contact your system administrator to enable this feature.
          </p>
          <Alert variant="warning">
            <AlertTriangle class="h-4 w-4" />
            <AlertTitle>Note</AlertTitle>
            <p class="text-sm mt-1">
              Once encryption is enabled, you will need your Clinic Secret to view
              full decision reason details in audit records.
            </p>
          </Alert>
        </CardContent>
      </Card>

      <!-- Vault Status Card -->
      <Card v-else-if="vaultStatus">
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <Shield class="h-5 w-5 text-blue-500" />
            Vault Status
          </CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
          <!-- Status indicator -->
          <div class="flex items-center justify-between p-4 rounded-lg"
               :class="vaultStatus.isUnlocked ? 'bg-green-50' : 'bg-gray-50'">
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-full"
                   :class="vaultStatus.isUnlocked ? 'bg-green-100' : 'bg-gray-200'">
                <Unlock v-if="vaultStatus.isUnlocked" class="h-6 w-6 text-green-600" />
                <Lock v-else class="h-6 w-6 text-gray-500" />
              </div>
              <div>
                <p class="font-medium" :class="vaultStatus.isUnlocked ? 'text-green-700' : 'text-gray-700'">
                  {{ vaultStatus.isUnlocked ? 'Vault Unlocked' : 'Vault Locked' }}
                </p>
                <p class="text-sm text-gray-500">
                  {{ vaultStatus.isUnlocked
                    ? 'Full decision reasons are available for this session'
                    : 'Enter your clinic secret to view full decision reasons' }}
                </p>
              </div>
            </div>
            <div v-if="vaultStatus.isUnlocked && formattedUnlockedAt" class="text-right">
              <p class="text-xs text-gray-500">Unlocked at</p>
              <p class="text-sm text-gray-700">{{ formattedUnlockedAt }}</p>
            </div>
          </div>

          <!-- Unlock Form -->
          <div v-if="!vaultStatus.isUnlocked" class="space-y-4 pt-4 border-t">
            <div class="space-y-2">
              <Label for="clinicSecret">Clinic Secret</Label>
              <Input
                id="clinicSecret"
                v-model="clinicSecret"
                type="password"
                placeholder="Enter your clinic secret"
                @keyup.enter="unlockVault"
              />
              <p class="text-xs text-gray-500">
                Your clinic secret was provided when encryption was first provisioned.
              </p>
            </div>

            <div v-if="error" class="flex items-center gap-2 text-red-600 text-sm">
              <XCircle class="h-4 w-4" />
              {{ error }}
            </div>

            <Button
              @click="unlockVault"
              :disabled="isUnlocking || !isSecretValid"
              class="w-full"
            >
              <Unlock class="h-4 w-4 mr-2" />
              <span v-if="isUnlocking">Unlocking...</span>
              <span v-else>Unlock Vault</span>
            </Button>
          </div>

          <!-- Lock Button -->
          <div v-else class="pt-4 border-t">
            <p class="text-sm text-gray-600 mb-4">
              When you're done reviewing audit details, you can lock the vault to clear the
              decryption key from your session.
            </p>
            <Button
              variant="outline"
              @click="lockVault"
              :disabled="isLocking"
              class="w-full"
            >
              <Lock class="h-4 w-4 mr-2" />
              <span v-if="isLocking">Locking...</span>
              <span v-else>Lock Vault</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <!-- Security Information -->
      <Card>
        <CardHeader>
          <CardTitle>How Encryption Works</CardTitle>
        </CardHeader>
        <CardContent class="space-y-3 text-sm text-gray-600">
          <p>
            Decision reasons from the LLM are encrypted at rest as a precaution, since they
            may include details from referral content. This helps ensure audit data remains
            protected while still allowing you to review and refine routing rules.
          </p>
          <p>
            <strong>How it works:</strong> Your clinic secret is used to derive a key
            that unwraps your tenant's Data Encryption Key (DEK). The DEK is then used
            to decrypt individual records. The clinic secret and DEK are only held in
            memory during your session.
          </p>
          <Alert>
            <Shield class="h-4 w-4" />
            <AlertTitle>Keep Your Secret Safe</AlertTitle>
            <p class="text-sm mt-1">
              If you lose your clinic secret, encrypted audit reasons cannot be recovered.
              A summary of each decision is always available without decryption.
            </p>
          </Alert>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

