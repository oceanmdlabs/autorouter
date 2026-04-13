<script setup lang="ts">
import { onClickOutside, useEventListener } from '@vueuse/core'
import { handleMissingActiveTenantError } from '@/app/lib/active-tenant'
import type { SiteConfiguration } from '@/src/entities/models/site-configuration';

const { user, clear } = useUserSession();
if (!user.value) {
  goToLogin();
}

const memberships = computed(() => user.value?.memberships ?? [])
const activeTenantId = computed(() => user.value?.activeTenantId ?? user.value?.tenantId ?? null)
const hasActiveTenant = computed(() => Boolean(activeTenantId.value))
const isSystemAdmin = computed(() => user.value?.roles?.admin === 'system')
const activeMembership = computed(() =>
  memberships.value.find((membership) => membership.tenantId === activeTenantId.value)
)
const canManageTenant = computed(() =>
  isSystemAdmin.value || activeMembership.value?.role === 'admin'
)
const requestFetch = useRequestFetch()

// Fetch site configuration to get site name
const { data: siteConfig } = useAsyncData('site-config', async () => {
  if (!activeTenantId.value) {
    return {
      siteConfig: null,
    };
  }
  try {
    return await requestFetch<{
      siteConfig: SiteConfiguration | null;
    }>('/api/site-configuration');
  } catch (error) {
    if (await handleMissingActiveTenantError(error, { notify: false })) {
      return {
        siteConfig: null,
      };
    }
    throw error;
  }
});

const isMenuOpen = ref(false)
const isUserMenuOpen = ref(false)
const userMenuRef = ref<HTMLElement | null>(null)
const route = useRoute()
const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
}
const toggleUserMenu = () => {
  isUserMenuOpen.value = !isUserMenuOpen.value
}
const selectedSiteName = computed(() => siteConfig.value?.siteConfig?.name ?? activeTenantId.value ?? null)
const hasAccessibleSites = computed(() => memberships.value.length > 0)
const siteStatusMessage = computed(() => {
  if (selectedSiteName.value) {
    return selectedSiteName.value
  }

  return hasAccessibleSites.value
    ? 'No site selected yet'
    : 'No sites are accessible with this account.'
})
const siteActionLabel = computed(() => {
  if (hasActiveTenant.value) {
    return 'Manage'
  }

  return hasAccessibleSites.value ? 'Select' : 'None'
})
type NavItem = {
  to: string
  label: string
}

type NavGroup = {
  id: string
  label: string
  items: NavItem[]
}

const isNavItemEnabled = (to: string) =>
  hasActiveTenant.value || (isSystemAdmin.value && to === '/admin')

const navGroups = computed<NavGroup[]>(() => {
  const groups: NavGroup[] = [
    {
      id: 'operations',
      label: 'Operations',
      items: [
        { to: '/portal/erequests', label: 'eRequests' },
        { to: '/portal/activity', label: 'Activity' },
      ],
    },
    {
      id: 'configuration',
      label: 'Configuration',
      items: [
        { to: '/portal/routing-rules', label: 'Routing Rules' },
        { to: '/portal/listings', label: 'Listings' },
      ],
    },
    {
      id: 'validation',
      label: 'Validation',
      items: [
        { to: '/portal/testing', label: 'Test Routing' },
        { to: '/portal/testing/sample-data', label: 'Sample Data' },
      ],
    },
  ]

  if (canManageTenant.value) {
    groups[1]?.items.push({ to: '/portal/site-configuration', label: 'Site Settings' })
    groups.push({
      id: 'administration',
      label: 'Administration',
      items: [
        { to: '/portal/members', label: 'Members & Invites' },
        { to: '/portal/privacy-audit', label: 'Privacy Audit' },
      ],
    })
  } else if (isSystemAdmin.value) {
    groups.push({
      id: 'administration',
      label: 'Administration',
      items: [],
    })
  }

  if (isSystemAdmin.value) {
    const adminGroup = groups.find(group => group.id === 'administration')
    adminGroup?.items.push({ to: '/admin', label: 'Admin' })
  }

  return groups.filter(group => group.items.length > 0)
})

const currentNavGroup = computed(() => {
  let bestMatch: { group: NavGroup; to: string } | null = null

  for (const group of navGroups.value) {
    for (const item of group.items) {
      if (route.path.startsWith(item.to) && (!bestMatch || item.to.length > bestMatch.to.length)) {
        bestMatch = { group, to: item.to }
      }
    }
  }

  return bestMatch?.group ?? navGroups.value[0] ?? null
})

const secondaryNavItems = computed(() => currentNavGroup.value?.items ?? [])
const isNavGroupActive = (group: NavGroup) => currentNavGroup.value?.id === group.id
const isAnyNavItemActive = (item: NavItem) => route.path.startsWith(item.to)
const getNavGroupTarget = (group: NavGroup) =>
  group.items.find(item => isNavItemEnabled(item.to))?.to ?? group.items[0]?.to ?? '/portal'
const userInitials = computed(() => {
  const name = user.value?.name?.trim()
  if (!name) return 'AR'

  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('')
})

const switchTenant = async (tenantId: string) => {
  try {
    await requestFetch('/api/auth/update-tenant', {
      method: 'POST',
      body: { tenantId }
    })
  } catch (error) {
    if (await handleMissingActiveTenantError(error, { notify: false })) {
      return
    }
    throw error
  }
  await refreshCookie('nuxt-session')
  await useUserSession().fetch()
  await navigateTo('/portal')
}

const handleLogout = async () => {
  await clear()
  goToLogin();
}
function goToLogin() {
  navigateTo('/login')
}

onClickOutside(userMenuRef, () => {
  isUserMenuOpen.value = false
})

useEventListener('keydown', (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    isUserMenuOpen.value = false
  }
})
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <header class="border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90">
      <div class="mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex min-h-16 items-center gap-3 py-3">
          <!-- Mobile menu button -->
          <button @click="toggleMenu" class="md:hidden rounded-md p-2 text-gray-600 hover:bg-gray-100">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path v-if="!isMenuOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 6h16M4 12h16M4 18h16" />
              <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div class="flex min-w-0 flex-1 items-center gap-3 md:flex-none">
            <img src="/ocean-labs-logo.svg" alt="Ocean Labs Logo" class="h-6 w-auto flex-shrink-0" />
            <div class="min-w-0">
              <div class="hidden text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500 xl:block">Ocean Labs</div>
              <div class="flex min-w-0 items-baseline gap-2">
                <div class="truncate text-base font-semibold text-slate-950 lg:text-lg">Autorouter</div>
                <div v-if="selectedSiteName" class="hidden max-w-[12rem] truncate text-sm text-slate-500 2xl:block">
                  {{ selectedSiteName }}
                </div>
              </div>
            </div>
          </div>

          <nav
            class="hidden md:flex items-center rounded-full border border-slate-200 bg-slate-50/80 p-1"
            :class="hasActiveTenant || isSystemAdmin ? '' : 'pointer-events-none opacity-45 saturate-0'"
          >
            <NuxtLink
              v-for="group in navGroups"
              :key="group.id"
              :to="getNavGroupTarget(group)"
              class="rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-950"
              :class="[
                isNavGroupActive(group) ? 'bg-white text-slate-950 shadow-sm ring-1 ring-slate-200' : '',
                isNavItemEnabled(getNavGroupTarget(group)) ? '' : 'pointer-events-none opacity-45 saturate-0'
              ]"
              :tabindex="isNavItemEnabled(getNavGroupTarget(group)) ? 0 : -1"
              :aria-disabled="!isNavItemEnabled(getNavGroupTarget(group))"
            >
              {{ group.label }}
            </NuxtLink>
          </nav>

          <div ref="userMenuRef" class="relative ml-auto hidden md:block">
            <button
              type="button"
              class="flex cursor-pointer items-center gap-3 rounded-full border border-slate-200 bg-white px-2 py-2 shadow-sm transition-colors hover:border-slate-300"
              :aria-expanded="isUserMenuOpen"
              aria-haspopup="menu"
              @click="toggleUserMenu"
            >
              <div class="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold tracking-wide text-white">
                {{ userInitials }}
              </div>
              <div class="min-w-0 pr-1 text-left leading-tight">
                <div class="max-w-[150px] truncate text-sm font-medium text-slate-950">{{ user?.name }}</div>
                <div class="max-w-[150px] truncate text-xs text-slate-500">
                  {{ siteStatusMessage }}
                </div>
              </div>
              <svg class="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <div
              v-if="isUserMenuOpen"
              class="absolute right-0 z-20 mt-3 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl"
              role="menu"
            >
              <div class="border-b border-slate-100 px-1 pb-3">
                <div class="text-sm font-semibold text-slate-950">{{ user?.name }}</div>
                <div class="text-xs text-slate-500">{{ siteStatusMessage }}</div>
              </div>

              <div class="border-b border-slate-100 px-1 py-3">
                <NuxtLink
                  to="/portal/sites"
                  class="flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-950"
                  @click="isUserMenuOpen = false"
                >
                  <span>Sites</span>
                  <span class="text-xs text-slate-400">{{ siteActionLabel }}</span>
                </NuxtLink>
              </div>

              <div v-if="memberships.length > 1" class="px-1 py-3">
                <Label for="tenant-select" class="text-xs text-slate-500">Active site</Label>
                <select
                  id="tenant-select"
                  class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  :value="activeTenantId ?? ''"
                  @change="switchTenant(($event.target as HTMLSelectElement).value)"
                >
                  <option v-for="membership in memberships" :key="membership.id" :value="membership.tenantId">
                    {{ membership.tenantId }} ({{ membership.role }})
                  </option>
                </select>
              </div>

              <div class="flex justify-end px-1 pt-2">
                <Button variant="outline" size="sm" @click="isUserMenuOpen = false; handleLogout()">
                  Logout
                </Button>
              </div>
            </div>
          </div>

          <Button class="ml-auto md:hidden" variant="outline" size="sm" @click="handleLogout">
            Logout
          </Button>
        </div>

        <div
          v-if="secondaryNavItems.length > 0"
          class="hidden border-t border-slate-200 py-3 md:block"
          :class="hasActiveTenant || isSystemAdmin ? '' : 'pointer-events-none opacity-45 saturate-0'"
        >
          <div class="flex items-center gap-2 overflow-x-auto pb-1">
            <NuxtLink
              v-for="item in secondaryNavItems"
              :key="item.to"
              :to="item.to"
              class="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950"
              :class="[
                isAnyNavItemActive(item) ? 'bg-slate-900 text-white hover:bg-slate-900 hover:text-white' : '',
                isNavItemEnabled(item.to) ? '' : 'pointer-events-none opacity-45 saturate-0'
              ]"
              :tabindex="isNavItemEnabled(item.to) ? 0 : -1"
              :aria-disabled="!isNavItemEnabled(item.to)"
            >
              {{ item.label }}
            </NuxtLink>
          </div>
        </div>

        <!-- Mobile navigation menu -->
        <div v-show="isMenuOpen" class="space-y-4 border-t border-slate-200 py-4 md:hidden">
          <div v-if="hasActiveTenant || isSystemAdmin" class="space-y-4">
            <div
              v-for="group in navGroups"
              :key="group.id"
              class="rounded-2xl border border-slate-200 bg-white p-3"
            >
              <div class="px-1 pb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                {{ group.label }}
              </div>
              <div class="grid grid-cols-2 gap-2">
                <NuxtLink
                  v-for="item in group.items"
                  :key="item.to"
                  :to="item.to"
                  class="rounded-2xl border border-slate-200 px-3 py-3 text-sm font-medium text-slate-700"
                  :class="[
                    isAnyNavItemActive(item) ? 'border-slate-900 bg-slate-900 text-white' : 'bg-white',
                    isNavItemEnabled(item.to) ? '' : 'pointer-events-none opacity-45 saturate-0'
                  ]"
                  :tabindex="isNavItemEnabled(item.to) ? 0 : -1"
                  :aria-disabled="!isNavItemEnabled(item.to)"
                >
                  {{ item.label }}
                </NuxtLink>
              </div>
            </div>
          </div>
          <div v-else class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Choose site access to unlock navigation.
          </div>
          <div class="rounded-2xl border border-slate-200 bg-white p-4">
            <div class="flex items-center gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold tracking-wide text-white">
                {{ userInitials }}
              </div>
              <div class="min-w-0">
                <div class="truncate text-sm font-semibold text-slate-950">{{ user?.name }}</div>
                <div class="truncate text-xs text-slate-500">{{ siteStatusMessage }}</div>
              </div>
            </div>
            <div class="pt-4">
              <NuxtLink
                to="/portal/sites"
                class="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
              >
                <span>Sites</span>
                <span class="text-xs text-slate-400">{{ siteActionLabel }}</span>
              </NuxtLink>
            </div>
            <div v-if="memberships.length > 1" class="pt-4">
              <Label for="tenant-select-mobile" class="text-xs text-slate-500">Active site</Label>
              <select
                id="tenant-select-mobile"
                class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                :value="activeTenantId ?? ''"
                @change="switchTenant(($event.target as HTMLSelectElement).value)"
              >
                <option v-for="membership in memberships" :key="membership.id" :value="membership.tenantId">
                  {{ membership.tenantId }} ({{ membership.role }})
                </option>
              </select>
            </div>
            <div class="pt-4">
              <Button variant="outline" size="sm" class="w-full" @click="handleLogout">
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
    <main>
      <slot />
    </main>
  </div>
</template>
