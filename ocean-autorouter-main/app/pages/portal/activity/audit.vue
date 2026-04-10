<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { Lock, Unlock } from 'lucide-vue-next';
import { formatTimestampWithMinutePrecision } from '@/shared/lib/utils';
import type { PaginatedResult } from "@/src/entities/models/paginated-result";
import type { DecisionAuditItem, RuleOption } from "@/src/entities/models/llm-audit-explorer";

interface VaultStatusResponse {
  isProvisioned: boolean;
  isUnlocked: boolean;
  unlockedAt: string | null;
}

// Vault status for showing lock/unlock indicator
const { data: vaultStatus, refresh: refreshVaultStatus } = useAsyncData<VaultStatusResponse>(
  'audit-vault-status',
  async () => {
    try {
      return await $fetch<VaultStatusResponse>('/api/clinic/vault-status');
    } catch (e) {
      return { isProvisioned: false, isUnlocked: false, unlockedAt: null };
    }
  }
);

// Filters
const referralIdFilter = ref('');
const ruleIdFilter = ref('all');
const dateFromFilter = ref('');
const dateToFilter = ref('');
const decisionFilter = ref('all');
const errorsOnlyFilter = ref(false);

// Pagination
const currentPage = ref(1);
const itemsPerPage = ref(20);

// Expanded rows state
const expandedRows = ref<Set<string>>(new Set());
const expandedReasons = ref<Set<string>>(new Set());

// Fetch rules for dropdown
const { data: rules } = useAsyncData('audit-rules', async () => {
  return useRequestFetch()<RuleOption[]>('/api/llm-audit/rules');
});

// Fetch decisions
const { data: decisions, refresh, status } = useAsyncData('audit-decisions', async () => {
  const params: Record<string, string | number> = {
    page: currentPage.value,
    pageSize: itemsPerPage.value,
  };

  if (referralIdFilter.value) params.referralId = referralIdFilter.value;
  if (ruleIdFilter.value && ruleIdFilter.value !== 'all') params.ruleId = ruleIdFilter.value;
  if (dateFromFilter.value) params.from = new Date(dateFromFilter.value).toISOString();
  if (dateToFilter.value) params.to = new Date(dateToFilter.value).toISOString();
  if (decisionFilter.value && decisionFilter.value !== 'all') params.decision = decisionFilter.value;
  if (errorsOnlyFilter.value) params.toolStatus = 'FAILED';

  return useRequestFetch()<PaginatedResult<DecisionAuditItem>>('/api/llm-audit/decisions', {
    params,
  });
});

// Watch for filter changes
watch([referralIdFilter, ruleIdFilter, dateFromFilter, dateToFilter, decisionFilter, errorsOnlyFilter], () => {
  currentPage.value = 1;
  refresh();
});

watch([currentPage, itemsPerPage], () => {
  refresh();
});

// Auto-expand rows with errors
const autoExpandedRows = computed(() => {
  const autoExpand = new Set<string>();
  if (decisions.value?.items) {
    for (const item of decisions.value.items) {
      if (item.hasErrors) {
        autoExpand.add(item.decisionAuditId);
      }
    }
  }
  return autoExpand;
});

// Check if row is expanded (manual or auto)
function isRowExpanded(id: string): boolean {
  return expandedRows.value.has(id) || autoExpandedRows.value.has(id);
}

// Toggle row expansion
function toggleRow(id: string) {
  if (expandedRows.value.has(id)) {
    expandedRows.value.delete(id);
  } else {
    expandedRows.value.add(id);
  }
}

// Toggle reason visibility
function toggleReason(id: string) {
  if (expandedReasons.value.has(id)) {
    expandedReasons.value.delete(id);
  } else {
    expandedReasons.value.add(id);
  }
}

function isReasonExpanded(id: string): boolean {
  return expandedReasons.value.has(id);
}

// Copy referral ID to clipboard
async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}

// Format duration
function formatDuration(ms: number | null): string {
  if (ms === null) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// Decision pill class
function getDecisionClass(decision: string): string {
  switch (decision) {
    case 'EXECUTE':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'SKIP':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    case 'ERROR':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

// Validation status pill class
function getValidationClass(status: string, hasError: boolean): string {
  if (hasError || status !== 'VALID') {
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  }
  return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
}

// Tool status pill class
function getToolStatusClass(status: string): string {
  switch (status) {
    case 'SUCCESS':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'FAILED':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'PLANNED':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'SKIPPED':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

// Clear all filters
function clearFilters() {
  referralIdFilter.value = '';
  ruleIdFilter.value = 'all';
  dateFromFilter.value = '';
  dateToFilter.value = '';
  decisionFilter.value = 'all';
  errorsOnlyFilter.value = false;
}
</script>

<template>
  <div class="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
    <div class="space-y-6">
      <!-- Header with Vault Status -->
      <div class="flex items-start justify-between">
        <div>
          <h1 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">Activity</h1>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed max-w-3xl">
            Investigate what AutoRouter did for each referral. View LLM decisions, tool executions, and validation results.
          </p>
        </div>

        <!-- Vault Status Indicator -->
        <div v-if="vaultStatus?.isProvisioned" class="flex-shrink-0">
          <NuxtLink
            to="/portal/vault"
            :class="[
              'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              vaultStatus.isUnlocked
                ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50'
                : 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50'
            ]"
            :title="vaultStatus.isUnlocked ? 'Vault is unlocked - click to manage' : 'Vault is locked - click to unlock'"
          >
            <Unlock v-if="vaultStatus.isUnlocked" class="h-4 w-4" />
            <Lock v-else class="h-4 w-4" />
            <span>{{ vaultStatus.isUnlocked ? 'Vault Unlocked' : 'Vault Locked' }}</span>
          </NuxtLink>
        </div>
      </div>

      <!-- Tab navigation -->
      <div class="border-b border-gray-200 dark:border-gray-700">
        <nav class="-mb-px flex space-x-8">
          <NuxtLink to="/portal/activity" class="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 whitespace-nowrap border-b-2 py-2 px-1 text-sm font-medium">
            Activity Log
          </NuxtLink>
          <NuxtLink to="/portal/activity/audit" class="border-primary text-primary whitespace-nowrap border-b-2 py-2 px-1 text-sm font-medium">
            LLM Audit Explorer
          </NuxtLink>
        </nav>
      </div>

      <!-- Filters -->
      <Card>
        <CardContent class="pt-6">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <!-- Referral ID -->
            <div>
              <Label for="referralId" class="text-sm font-medium">Referral ID</Label>
              <Input
                id="referralId"
                v-model="referralIdFilter"
                placeholder="Enter referral ID..."
                class="mt-1"
              />
            </div>

            <!-- Rule dropdown -->
            <div>
              <Label for="rule" class="text-sm font-medium">Rule</Label>
              <Select v-model="ruleIdFilter">
                <SelectTrigger class="mt-1">
                  <SelectValue placeholder="All rules" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All rules</SelectItem>
                  <SelectItem v-for="rule in rules" :key="rule.ruleId" :value="rule.ruleId">
                    {{ rule.ruleName }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <!-- Date from -->
            <div>
              <Label for="dateFrom" class="text-sm font-medium">From</Label>
              <Input
                id="dateFrom"
                type="datetime-local"
                v-model="dateFromFilter"
                class="mt-1"
              />
            </div>

            <!-- Date to -->
            <div>
              <Label for="dateTo" class="text-sm font-medium">To</Label>
              <Input
                id="dateTo"
                type="datetime-local"
                v-model="dateToFilter"
                class="mt-1"
              />
            </div>
          </div>

          <!-- Second row of filters -->
          <div class="mt-4 flex flex-wrap items-center gap-4">
            <!-- Decision filter -->
            <div class="flex items-center gap-2">
              <Label for="decision" class="text-sm font-medium whitespace-nowrap">Decision:</Label>
              <Select v-model="decisionFilter">
                <SelectTrigger class="w-32">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="EXECUTE">Execute</SelectItem>
                  <SelectItem value="SKIP">Skip</SelectItem>
                  <SelectItem value="ERROR">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <!-- Errors only toggle -->
            <div class="flex items-center gap-2">
              <Switch id="errorsOnly" v-model:checked="errorsOnlyFilter" />
              <Label for="errorsOnly" class="text-sm font-medium cursor-pointer">Errors only</Label>
            </div>

            <!-- Clear filters -->
            <Button variant="outline" size="sm" @click="clearFilters">
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <!-- Results Table -->
      <Card>
        <CardContent class="pt-6">
          <div v-if="status === 'pending'" class="flex justify-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>

          <Table v-else>
            <TableHeader>
              <TableRow>
                <TableHead class="w-10"></TableHead>
                <TableHead>Created At</TableHead>
                <TableHead>Referral ID</TableHead>
                <TableHead>Rule</TableHead>
                <TableHead>Decision</TableHead>
                <TableHead>Validation</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Tools</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <template v-if="!decisions?.items || decisions.items.length === 0">
                <TableRow>
                  <TableCell :colspan="8" class="text-center text-muted-foreground py-8">
                    No audit records found.
                  </TableCell>
                </TableRow>
              </template>
              <template v-else v-for="item in decisions.items" :key="item.decisionAuditId">
                <!-- Main row -->
                <TableRow
                  class="cursor-pointer hover:bg-muted/50"
                  @click="toggleRow(item.decisionAuditId)"
                >
                  <!-- Expand chevron -->
                  <TableCell class="w-10">
                    <button class="p-1 hover:bg-muted rounded transition-transform" :class="{ 'rotate-90': isRowExpanded(item.decisionAuditId) }">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                    </button>
                  </TableCell>

                  <!-- Created At -->
                  <TableCell class="whitespace-nowrap text-sm">
                    {{ formatTimestampWithMinutePrecision(item.createdAt) }}
                  </TableCell>

                  <!-- Referral ID with copy -->
                  <TableCell>
                    <div class="flex items-center gap-1">
                      <span class="font-mono text-xs">{{ item.referralId }}</span>
                      <button
                        class="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                        @click.stop="copyToClipboard(item.referralId)"
                        title="Copy referral ID"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                      </button>
                    </div>
                  </TableCell>

                  <!-- Rule Name (with version) -->
                  <TableCell>
                    <div>
                      <span>{{ item.ruleName }}</span>
                      <span class="text-xs text-muted-foreground ml-1">(v{{ item.ruleVersion }})</span>
                    </div>
                  </TableCell>

                  <!-- Decision pill with view reason -->
                  <TableCell>
                    <div class="flex items-center gap-2">
                      <span :class="['px-2 py-0.5 rounded-full text-xs font-medium', getDecisionClass(item.decision)]">
                        {{ item.decision }}
                      </span>
                      <!-- Show "View reason" if we have a decrypted reason -->
                      <button
                        v-if="item.reason"
                        class="text-xs text-blue-600 hover:underline dark:text-blue-400"
                        @click.stop="toggleReason(item.decisionAuditId)"
                      >
                        {{ isReasonExpanded(item.decisionAuditId) ? 'Hide' : 'View' }} reason
                      </button>
                      <!-- Show encrypted indicator if reason is encrypted but not decrypted -->
                      <span
                        v-else-if="item.reasonEncrypted && !item.reason"
                        class="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1"
                        :title="item.basicReason || 'Encrypted'"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                        Encrypted
                      </span>
                      <!-- Show basic reason if available and not encrypted -->
                      <span
                        v-else-if="item.basicReason && !item.reasonEncrypted"
                        class="text-xs text-muted-foreground"
                        :title="item.basicReason"
                      >
                        {{ item.basicReason }}
                      </span>
                    </div>
                  </TableCell>

                  <!-- Validation status -->
                  <TableCell>
                    <div class="flex items-center gap-1">
                      <span :class="['px-2 py-0.5 rounded-full text-xs font-medium', getValidationClass(item.validationStatus, !!item.validationError)]">
                        {{ item.validationStatus }}
                      </span>
                      <svg v-if="item.validationError" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-500">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                    </div>
                  </TableCell>

                  <!-- Confidence -->
                  <TableCell>
                    <span v-if="item.confidence !== null" class="text-sm">
                      {{ (item.confidence * 100).toFixed(0) }}%
                    </span>
                    <span v-else class="text-muted-foreground">-</span>
                  </TableCell>

                  <!-- Tools count with failed badge -->
                  <TableCell>
                    <div class="flex items-center gap-1">
                      <span>{{ item.toolCount }}</span>
                      <span v-if="item.toolFailedCount > 0" class="px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                        {{ item.toolFailedCount }} failed
                      </span>
                    </div>
                  </TableCell>
                </TableRow>

                <!-- Reason expansion row -->
                <TableRow v-if="isReasonExpanded(item.decisionAuditId) && item.reason">
                  <TableCell :colspan="8" class="bg-muted/30 px-8 py-3">
                    <div class="text-sm">
                      <span class="font-medium text-muted-foreground">Reason: </span>
                      <span>{{ item.reason }}</span>
                    </div>
                  </TableCell>
                </TableRow>

                <!-- Encrypted reason indicator row (shown when expanded but vault locked) -->
                <TableRow v-if="isReasonExpanded(item.decisionAuditId) && item.reasonEncrypted && !item.reason">
                  <TableCell :colspan="8" class="bg-amber-50 dark:bg-amber-900/20 px-8 py-3">
                    <div class="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                      <div>
                        <span class="font-medium">Reason is encrypted. </span>
                        <NuxtLink to="/portal/vault" class="underline hover:no-underline">
                          Unlock your vault
                        </NuxtLink>
                        <span> to view the full reason.</span>
                        <span v-if="item.basicReason" class="block mt-1 text-muted-foreground">
                          Summary: {{ item.basicReason }}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>

                <!-- Validation error expansion row -->
                <TableRow v-if="isRowExpanded(item.decisionAuditId) && item.validationError">
                  <TableCell :colspan="8" class="bg-red-50 dark:bg-red-900/20 px-8 py-3">
                    <div class="text-sm text-red-800 dark:text-red-200">
                      <span class="font-medium">Validation Error: </span>
                      <span>{{ item.validationError }}</span>
                    </div>
                  </TableCell>
                </TableRow>

                <!-- Tool executions expansion -->
                <TableRow v-if="isRowExpanded(item.decisionAuditId)">
                  <TableCell :colspan="8" class="bg-muted/20 px-8 py-4">
                    <div v-if="item.toolExecutions.length === 0" class="text-sm text-muted-foreground italic">
                      No tools executed.
                    </div>
                    <div v-else>
                      <h4 class="text-sm font-medium mb-2">Tool Executions</h4>
                      <Table class="border rounded-md">
                        <TableHeader>
                          <TableRow>
                            <TableHead class="w-16">Index</TableHead>
                            <TableHead>Tool Name</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Error</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow v-for="tool in item.toolExecutions" :key="tool.toolExecutionId">
                            <TableCell class="font-mono text-sm">{{ tool.toolIndex }}</TableCell>
                            <TableCell class="font-medium">{{ tool.toolDisplayName }}</TableCell>
                            <TableCell>
                              <span :class="['px-2 py-0.5 rounded-full text-xs font-medium', getToolStatusClass(tool.status)]">
                                {{ tool.status }}
                              </span>
                            </TableCell>
                            <TableCell class="text-sm">{{ formatDuration(tool.durationMs) }}</TableCell>
                            <TableCell class="text-sm text-red-600 dark:text-red-400">
                              <template v-if="tool.errorCode || tool.errorSummary">
                                <span v-if="tool.errorCode" class="font-mono">[{{ tool.errorCode }}]</span>
                                {{ tool.errorSummary }}
                              </template>
                              <span v-else class="text-muted-foreground">-</span>
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </TableCell>
                </TableRow>
              </template>
            </TableBody>
          </Table>

          <!-- Pagination -->
          <div v-if="(decisions?.totalPages ?? 0) > 1" class="flex justify-between items-center mt-4 px-4">
            <div class="flex items-center gap-2">
              <Label class="text-sm text-muted-foreground">Items per page:</Label>
              <Select v-model="itemsPerPage">
                <SelectTrigger class="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem :value="20">20</SelectItem>
                  <SelectItem :value="50">50</SelectItem>
                  <SelectItem :value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="flex items-center gap-4">
              <span class="text-sm text-muted-foreground">
                Showing {{ ((currentPage - 1) * itemsPerPage) + 1 }} - {{ Math.min(currentPage * itemsPerPage, decisions?.total || 0) }} of {{ decisions?.total || 0 }}
              </span>
              <div class="flex items-center gap-2">
                <Button variant="outline" size="sm" :disabled="currentPage === 1" @click="currentPage--">
                  Previous
                </Button>
                <span class="text-sm text-muted-foreground mx-2">
                  Page {{ currentPage }} of {{ decisions?.totalPages || 0 }}
                </span>
                <Button variant="outline" size="sm" :disabled="currentPage >= (decisions?.totalPages || 0)" @click="currentPage++">
                  Next
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

