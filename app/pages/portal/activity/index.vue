<script setup lang="ts">
import { ref, watch } from 'vue';
import type { ActivityLogEntry } from '@/src/entities/models/activity-log-entry';
import { getRoutingEventTypeTitle } from '@/src/entities/models/routing-event-type';
import { formatTimestampWithMinutePrecision } from '@/shared/lib/utils';
import type { PaginatedResult } from "@/src/entities/models/paginated-result";
import { getOceanServerUrl } from '@/src/application/services/ocean-server.utils';
import type { SiteConfiguration } from '@/src/entities/models/site-configuration';

// Fetch activity logs
const currentPage = ref(1);
const itemsPerPage = ref(10);
const filterText = ref('');

const { data: logs, refresh } = useAsyncData('logs', async () => {
  return useRequestFetch()<PaginatedResult<ActivityLogEntry>>('/api/activity-logs', {
    params: {
      page: currentPage.value,
      pageSize: itemsPerPage.value,
      search: filterText.value || undefined,
    },
  });
});

// Fetch site configuration
const { data: siteConfig } = useAsyncData('site-config', async () => {
  return useRequestFetch()<{
    siteConfig: SiteConfiguration | null;
  }>(`/api/site-configuration`);
});

// Function to get the Ocean host URL
const getOceanHost = () => {
  return getOceanServerUrl('ocean');
};

// Function to generate the referral URL
const getReferralUrl = (referralRef: string): string | undefined => {
  if (!referralRef || !siteConfig.value?.siteConfig?.oceanSiteNum) return undefined;
  return `${getOceanHost()}/ocean/portal.html?siteNum=${siteConfig.value.siteConfig.oceanSiteNum}#/referrals/${referralRef}/edit`;
};

// Watch for changes in pagination or filter
watch([currentPage, itemsPerPage, filterText], ([newPage, newItemsPerPage, newFilterText], [oldPage, oldItemsPerPage, oldFilterText]) => {
  // Reset to page 1 if filter text changes
  if (newFilterText !== oldFilterText) {
    currentPage.value = 1;
  }
  refresh();
});

// Clear logs function
async function clearLogs() {
  if (confirm('Are you sure you want to clear all activity logs? This action cannot be undone.')) {
    await useRequestFetch()('/api/activity-logs/remove-all', {
      method: 'POST'
    });
    await refresh();
  }
}

</script>

<template>
  <div class="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900">Activity Logs</h1>
        <p class="mt-2 text-sm text-gray-600 leading-relaxed max-w-3xl">
          This area will show any messages received from Ocean and the related routing actions.
        </p>
      </div>

      <div class="flex justify-end">
        <Button variant="destructive" @click="clearLogs">Clear Logs</Button>
      </div>

      <Card>
        <CardContent>
          <div class="mb-4">
            <Input v-model="filterText" placeholder="Filter activity..." class="max-w-sm" />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Referrer</TableHead>
                <TableHead>Requested Service</TableHead>
                <TableHead>eRequest Reference</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-if="!logs?.items || logs.items.length === 0">
                <TableCell :colspan="6" class="text-center text-muted-foreground">
                  No activity logs found.
                </TableCell>
              </TableRow>
              <TableRow v-else v-for="log in logs.items" :key="log.id">
                <TableCell>{{ formatTimestampWithMinutePrecision(log.createdAt) }}</TableCell>
                <TableCell>{{ getRoutingEventTypeTitle(log.triggeringEvent) }}</TableCell>
                <TableCell>{{ log.requestingProvider || '-' }}</TableCell>
                <TableCell>{{ [log.requestedListingTitle, log.requestedServiceDescription].filter(Boolean).join(' - ')
                  ||
                  '-' }}
                </TableCell>
                <TableCell class="text-xs">
                  <template v-if="log.referralRef">
                    <a v-if="getReferralUrl(log.referralRef)" :href="getReferralUrl(log.referralRef)" target="_blank"
                      class="text-blue-600 hover:underline">
                      {{ log.referralRef }}
                    </a>
                    <span v-else>{{ log.referralRef }}</span>
                  </template>
                  <template v-else>-</template>
                </TableCell>
                <TableCell class="whitespace-pre-wrap"><template v-if="log.error">
                    <span class="text-red-500">{{ log.error }}</span>
                    <span class="text-muted-foreground">{{ log.details }}</span>
                  </template>
                  <template v-else>
                    {{ log.details }}
                  </template>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <div v-if="logs?.totalPages ?? 0 > 1" class="flex justify-center items-center space-x-4 mt-4 px-4">
            <Button variant="outline" size="sm" :disabled="currentPage === 1" @click="currentPage--">
              Previous
            </Button>
            <span class="text-sm text-muted-foreground mx-2">
              Page {{ currentPage }} of {{ logs?.totalPages || 0 }}
            </span>
            <Button variant="outline" size="sm" :disabled="currentPage === logs?.totalPages" @click="currentPage++">
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>