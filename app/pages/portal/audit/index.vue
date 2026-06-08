<script setup lang="ts">
import { ref, watch } from 'vue';
import { handleMissingActiveTenantError } from '@/app/lib/active-tenant';
import type { DecisionAuditItem, ToolExecutionItem } from '@/src/entities/models/llm-audit-explorer';
import type { PaginatedResult } from '@/src/entities/models/paginated-result';
import { formatTimestampWithMinutePrecision } from '@/shared/lib/utils';

const currentPage = ref(1);
const itemsPerPage = ref(20);
const filterReferralId = ref('');
const requestFetch = useRequestFetch();

const { data: audits, refresh } = useAsyncData('llm-audits', async () => {
  try {
    return await requestFetch<PaginatedResult<DecisionAuditItem>>('/api/llm-audit', {
      params: {
        page: currentPage.value,
        pageSize: itemsPerPage.value,
        referralId: filterReferralId.value || undefined,
        sort: 'createdAt_desc',
      },
    });
  } catch (error) {
    if (await handleMissingActiveTenantError(error, { notify: false })) {
      return { items: [], page: 1, pageSize: itemsPerPage.value, total: 0, totalPages: 0 };
    }
    throw error;
  }
});

watch([currentPage, itemsPerPage, filterReferralId], ([, , newFilter], [, , oldFilter]) => {
  if (newFilter !== oldFilter) currentPage.value = 1;
  refresh();
});

function describeAction(tool: ToolExecutionItem): { type: string; taken: string } {
  const type = tool.actionType ?? tool.toolDisplayName ?? tool.toolName;
  const taken = tool.toolResult ?? 'Action taken';
  return { type, taken };
}
</script>

<template>
  <div class="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900">Decision Audit</h1>
        <p class="mt-2 text-sm text-gray-600 leading-relaxed max-w-3xl">
          Rule evaluation decisions and tool executions recorded for each processed event.
        </p>
      </div>

      <Card>
        <CardContent>
          <div class="mb-4">
            <Input v-model="filterReferralId" placeholder="Filter by referral ID..." class="max-w-sm" />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Referral ID</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-if="!audits?.items || audits.items.length === 0">
                <TableCell :colspan="3" class="text-center text-muted-foreground">
                  No audit records found.
                </TableCell>
              </TableRow>
              <TableRow v-else v-for="item in audits.items" :key="item.decisionAuditId">
                <TableCell class="text-xs whitespace-nowrap align-top">
                  {{ formatTimestampWithMinutePrecision(item.createdAt) }}
                </TableCell>
                <TableCell class="text-xs font-mono align-top">{{ item.referralId }}</TableCell>
                <TableCell class="whitespace-pre-wrap text-xs align-top">
                  <div class="space-y-0.5">
                    <div class="font-medium">{{ item.ruleName }}</div>
                    <div :class="item.triggered ? 'text-green-600' : 'text-red-500'">
                      {{ item.triggered ? 'Triggered' : 'Not triggered' }}
                      <span v-if="item.reasonSummary" class="text-muted-foreground"> — {{ item.reasonSummary }}</span>
                    </div>
                    <div v-if="item.reasoning" class="text-muted-foreground italic mt-0.5">{{ item.reasoning }}</div>
                    <div v-if="item.triggered && item.toolExecutions.length" class="pl-2 space-y-1 mt-0.5">
                      <div v-for="tool in item.toolExecutions" :key="tool.toolExecutionId" class="text-muted-foreground whitespace-pre-wrap">
                        <template v-if="describeAction(tool).type">
                          <span class="font-medium text-foreground">Action Type:</span> {{ describeAction(tool).type }}<br/>
                        </template>
                        <span class="font-medium text-foreground">Action Taken:</span> {{ describeAction(tool).taken }}
                      </div>
                    </div>
                    <div v-if="item.validationError" class="text-red-500 mt-1">{{ item.validationError }}</div>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <div v-if="(audits?.totalPages ?? 0) > 1" class="flex justify-center items-center space-x-4 mt-4 px-4">
            <Button variant="outline" size="sm" :disabled="currentPage === 1" @click="currentPage--">
              Previous
            </Button>
            <span class="text-sm text-muted-foreground mx-2">
              Page {{ currentPage }} of {{ audits?.totalPages || 0 }}
            </span>
            <Button variant="outline" size="sm" :disabled="currentPage === audits?.totalPages" @click="currentPage++">
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
