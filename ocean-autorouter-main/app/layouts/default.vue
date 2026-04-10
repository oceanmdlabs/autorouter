<script setup lang="ts">
import type { SiteConfiguration } from '@/src/entities/models/site-configuration';

const { user, clear, fetch: fetchSession } = useUserSession();
if (!user.value) {
  goToLogin();
}

// Fetch site configuration to get site name
const { data: siteConfig, refresh: refreshSiteConfig } = useAsyncData('site-config', async () => {
  return await useRequestFetch()<{
    siteConfig: SiteConfiguration | null;
  }>('/api/site-configuration');
});

// Check if user is viewing as admin (different tenant than their original)
const isViewingAsAdmin = computed(() => {
  if (!user.value) return false;
  const originalTenantId = (user.value as any).originalTenantId;
  return originalTenantId && originalTenantId !== user.value.tenantId;
});

// Watch for tenant changes and refresh site config
watch(() => user.value?.tenantId, async (newTenantId, oldTenantId) => {
  if (newTenantId && newTenantId !== oldTenantId) {
    await refreshSiteConfig();
  }
});

const isMenuOpen = ref(false)
const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
}

const handleLogout = async () => {
  await clear()
  goToLogin();
}
function goToLogin() {
  navigateTo('/login')
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white shadow">
      <div class="mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex h-16 justify-between items-center">
          <!-- Mobile menu button -->
          <button @click="toggleMenu" class="md:hidden p-2 rounded-md hover:bg-gray-100">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path v-if="!isMenuOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 6h16M4 12h16M4 18h16" />
              <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <!-- Logo and Site Name -->
          <div class="flex items-center space-x-3 flex-1 min-w-0">
            <div class="flex-shrink-0">
              <img src="/symbol.png" alt="SnowDog Logo" class="h-8" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-lg font-semibold text-gray-900 truncate">SnowDog AutoRouter</div>
              <div v-if="siteConfig?.siteConfig?.name" class="text-sm truncate" :class="isViewingAsAdmin ? 'text-orange-600 font-medium' : 'text-gray-600'">
                <template v-if="isViewingAsAdmin">
                  View as Admin: {{ siteConfig.siteConfig.name }}
                </template>
                <template v-else>
                  {{ siteConfig.siteConfig.name }}
                </template>
              </div>
            </div>
          </div>

          <!-- Desktop navigation -->
          <nav class="hidden md:flex items-center space-x-6 px-4">
            <NavLink to="/portal/site-configuration">
              Site Settings
            </NavLink>
            <NavLink to="/portal/vault">
              Vault
            </NavLink>
            <NavLink to="/portal/routing-rules">
              Routing Rules
            </NavLink>
            <NavLink to="/portal/listings">
              Listings
            </NavLink>
            <NavLink to="/portal/testing">
              Testing
            </NavLink>
            <NavLink to="/portal/activity">
              Activity
            </NavLink>
            <NavLink v-if="user?.roles?.admin === 'system'" to="/admin">
              Admin
            </NavLink>
          </nav>

          <div class="flex items-center space-x-4 ml-4 flex-shrink-0">
            <div class="hidden sm:block text-sm text-muted-foreground max-w-[180px]">
              Signed in as <span class="font-medium text-foreground truncate">{{ user?.name }}</span>
            </div>
            <Button variant="outline" size="sm" @click="handleLogout">
              Logout
            </Button>
          </div>
        </div>

        <!-- Mobile navigation menu -->
        <div v-show="isMenuOpen" class="md:hidden py-2 space-y-1">
          <NavLink to="/portal/site-configuration" class="block px-3 py-2 rounded-md hover:bg-gray-100">
            Site Settings
          </NavLink>
          <NavLink to="/portal/vault" class="block px-3 py-2 rounded-md hover:bg-gray-100">
            Vault
          </NavLink>
          <NavLink to="/portal/routing-rules" class="block px-3 py-2 rounded-md hover:bg-gray-100">
            Routing Rules
          </NavLink>
          <NavLink to="/portal/listings" class="block px-3 py-2 rounded-md hover:bg-gray-100">
            Listings
          </NavLink>
          <NavLink to="/portal/testing" class="block px-3 py-2 rounded-md hover:bg-gray-100">
            Testing
          </NavLink>
          <NavLink to="/portal/activity" class="block px-3 py-2 rounded-md hover:bg-gray-100">
            Activity
          </NavLink>
          <NavLink v-if="user?.roles?.admin === 'system'" to="/admin"
            class="block px-3 py-2 rounded-md hover:bg-gray-100">
            Admin
          </NavLink>
          <div class="sm:hidden px-3 py-2 text-sm text-muted-foreground">
            Signed in as <span class="font-medium text-foreground">{{ user?.name }}</span>
          </div>
        </div>
      </div>
    </header>
    <main>
      <slot />
    </main>
  </div>
</template>