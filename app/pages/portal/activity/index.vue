<script setup lang="ts">
import { ref, watch } from 'vue';
import { handleMissingActiveTenantError } from '@/app/lib/active-tenant';
import type { ActivityLogEntry } from '@/src/entities/models/activity-log-entry';
import { getRoutingEventTypeTitle } from '@/src/entities/models/routing-event-type';
import { formatTimestampWithMinutePrecision } from '@/shared/lib/utils';
import type { PaginatedResult } from "@/src/entities/models/paginated-result";
import { getOceanServerUrl } from '@/src/application/services/ocean-server.utils';
import type { SiteConfiguration } from '@/src/entities/models/site-configuration';
import { clientRoutingToolRegistry } from '@/src/entities/models/routing-tool-client';
import type { RoutingToolName } from '@/src/infrastructure/services/routing-tools/routing-tool-registry';

// Fetch activity logs
const currentPage = ref(1);
const itemsPerPage = ref(10);
const filterText = ref('');
const requestFetch = useRequestFetch();

const { data: logs, refresh } = useAsyncData('logs', async () => {
  try {
    return await requestFetch<PaginatedResult<ActivityLogEntry>>('/api/activity-logs', {
      params: {
        page: currentPage.value,
        pageSize: itemsPerPage.value,
        search: filterText.value || undefined,
      },
    });
  } catch (error) {
    if (await handleMissingActiveTenantError(error, { notify: false })) {
      return { items: [], page: 1, pageSize: itemsPerPage.value, total: 0, totalPages: 0 };
    }
    throw error;
  }
});

// Fetch site configuration
const { data: siteConfig } = useAsyncData('site-config', async () => {
  try {
    return await requestFetch<{
      siteConfig: SiteConfiguration | null;
    }>(`/api/site-configuration`);
  } catch (error) {
    if (await handleMissingActiveTenantError(error, { notify: false })) {
      return { siteConfig: null };
    }
    throw error;
  }
});

const getOceanHost = () => {
  return getOceanServerUrl(siteConfig.value?.siteConfig?.oceanServer ?? 'ocean');
};

type RuleAction = { tool: string; input: Record<string, any>; result?: string } | string;

type StructuredDetails = {
  rules: {
    ruleName: string;
    triggered: boolean;
    comment?: string;
    reasoning?: string;
    actions?: RuleAction[];
  }[];
  archival?: string;
  match?: string;
};

function describeAction(action: RuleAction): { type: string; taken: string } {
  if (typeof action === 'string') {
    return { type: '', taken: action };
  }
  const tool = clientRoutingToolRegistry[action.tool as RoutingToolName];
  if (tool?.actionType && tool?.getActionTaken) {
    return { type: tool.actionType, taken: tool.getActionTaken(action.input, action.result) };
  }
  return { type: action.tool, taken: action.result ?? 'Action taken' };
}

function parseStructuredDetails(details: string | null | undefined): StructuredDetails | null {
  if (!details) return null;
  try {
    const parsed = JSON.parse(details);
    if (parsed && Array.isArray(parsed.rules)) return parsed as StructuredDetails;
  } catch {}
  return null;
}

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
    try {
      await requestFetch('/api/activity-logs/remove-all', {
        method: 'POST'
      });
    } catch (error) {
      if (await handleMissingActiveTenantError(error)) {
        return;
      }
      throw error;
    }
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
                <TableCell class="whitespace-pre-wrap text-xs">
                  <template v-if="parseStructuredDetails(log.details)">
                    <div class="space-y-2">
                      <div v-if="parseStructuredDetails(log.details)!.match" class="text-foreground font-medium">
                        {{ parseStructuredDetails(log.details)!.match }}
                      </div>
                      <div
                        v-for="rule in parseStructuredDetails(log.details)!.rules"
                        :key="rule.ruleName"
                        class="space-y-0.5"
                      >
                        <div class="font-medium">{{ rule.ruleName }}</div>
                        <div :class="rule.triggered ? 'text-green-600' : 'text-red-500'">
                          {{ rule.triggered ? 'Triggered' : 'Not triggered' }}
                          <span v-if="rule.comment" class="text-muted-foreground"> — {{ rule.comment }}</span>
                        </div>
                        <div v-if="rule.reasoning" class="text-muted-foreground italic mt-0.5">{{ rule.reasoning }}</div>
                        <div v-if="rule.triggered && rule.actions?.length" class="pl-2 space-y-1 mt-0.5">
                          <div v-for="(action, i) in rule.actions" :key="i" class="text-muted-foreground whitespace-pre-wrap">
                            <template v-if="describeAction(action).type">
                              <span class="font-medium text-foreground">Action Type:</span> {{ describeAction(action).type }}<br/>
                            </template>
                            <span class="font-medium text-foreground">Action Taken:</span> {{ describeAction(action).taken }}
                          </div>
                        </div>
                      </div>
                      <div v-if="parseStructuredDetails(log.details)!.archival" class="text-muted-foreground">
                        {{ parseStructuredDetails(log.details)!.archival }}
                      </div>
                    </div>
                    <div v-if="log.error" class="text-red-500 mt-1">{{ log.error }}</div>
                  </template>
                  <template v-else>
                    <template v-if="log.error">
                      <span class="text-red-500">{{ log.error }}</span>
                      <span class="text-muted-foreground">{{ log.details }}</span>
                    </template>
                    <template v-else>{{ log.details }}</template>
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
