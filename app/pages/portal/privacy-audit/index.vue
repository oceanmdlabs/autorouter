<script setup lang="ts">
import { handleMissingActiveTenantError } from "@/app/lib/active-tenant";
import type { PaginatedResult } from "@/src/entities/models/paginated-result";
import {
  privacyAuditEventTypes,
  type PrivacyAuditEventType,
  type PrivacyAuditLog,
} from "@/src/entities/models/privacy-audit-log";
import { formatTimestampWithMinutePrecision } from "@/shared/lib/utils";

const { user } = useUserSession();
const requestFetch = useRequestFetch();
const page = ref(1);
const pageSize = ref(25);
const eventType = ref<PrivacyAuditEventType | "">("");
const expandedIds = ref<string[]>([]);

const memberships = computed(() => user.value?.memberships ?? []);
const activeTenantId = computed(
  () => user.value?.activeTenantId ?? user.value?.tenantId ?? null
);
const activeMembership = computed(() =>
  memberships.value.find(
    (membership) => membership.tenantId === activeTenantId.value
  )
);
const canManageTenant = computed(
  () =>
    user.value?.roles?.admin === "system" ||
    activeMembership.value?.role === "admin"
);

const { data, refresh } = useAsyncData("privacy-audit-logs", async () => {
  try {
    return await requestFetch<PaginatedResult<PrivacyAuditLog>>(
      "/api/privacy-audit-logs",
      {
        params: {
          page: page.value,
          pageSize: pageSize.value,
          eventType: eventType.value || undefined,
        },
      }
    );
  } catch (error) {
    if (await handleMissingActiveTenantError(error, { notify: false })) {
      return { items: [], page: 1, pageSize: pageSize.value, total: 0, totalPages: 0 };
    }
    throw error;
  }
});

watch([page, pageSize, eventType], () => {
  refresh();
});

function toggleExpanded(id: string) {
  expandedIds.value = expandedIds.value.includes(id)
    ? expandedIds.value.filter((value) => value !== id)
    : [...expandedIds.value, id];
}

function isExpanded(id: string) {
  return expandedIds.value.includes(id);
}
</script>

<template>
  <div class="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900">Privacy Audit Log</h1>
        <p class="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
          Review tenant access and PHI-relevant actions captured for privacy audits.
        </p>
      </div>

      <Card v-if="!canManageTenant">
        <CardContent class="py-6 text-sm text-slate-600">
          Tenant admin access is required to review the privacy audit log.
        </CardContent>
      </Card>

      <template v-else>
        <Card>
          <CardContent class="flex flex-wrap items-end gap-4 py-6">
            <div class="space-y-2">
              <Label for="audit-event-type">Event type</Label>
              <select
                id="audit-event-type"
                v-model="eventType"
                class="w-72 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">All event types</option>
                <option v-for="item in privacyAuditEventTypes" :key="item" :value="item">
                  {{ item }}
                </option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent class="py-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-if="!(data?.items?.length)">
                  <TableCell :colspan="5" class="text-center text-muted-foreground">
                    No audit entries found.
                  </TableCell>
                </TableRow>
                <template v-for="entry in data?.items ?? []" :key="entry.id">
                  <TableRow>
                    <TableCell>{{ formatTimestampWithMinutePrecision(entry.createdAt) }}</TableCell>
                    <TableCell class="text-sm">
                      {{ entry.actorName || entry.actorUserId || "-" }}
                    </TableCell>
                    <TableCell class="font-mono text-xs">{{ entry.eventType }}</TableCell>
                    <TableCell>{{ entry.summary }}</TableCell>
                    <TableCell>
                      <Button
                        v-if="entry.sensitiveData"
                        variant="outline"
                        size="sm"
                        @click="toggleExpanded(entry.id)"
                      >
                        {{ isExpanded(entry.id) ? "Hide" : "Show" }}
                      </Button>
                      <span v-else class="text-sm text-slate-400">None</span>
                    </TableCell>
                  </TableRow>
                  <TableRow v-if="entry.sensitiveData && isExpanded(entry.id)">
                    <TableCell :colspan="5" class="bg-slate-50">
                      <pre class="overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{{
                        JSON.stringify(entry.sensitiveData, null, 2)
                      }}</pre>
                    </TableCell>
                  </TableRow>
                </template>
              </TableBody>
            </Table>

            <div v-if="(data?.totalPages ?? 0) > 1" class="mt-4 flex items-center justify-center gap-4">
              <Button variant="outline" size="sm" :disabled="page === 1" @click="page--">Previous</Button>
              <span class="text-sm text-slate-500">Page {{ page }} of {{ data?.totalPages }}</span>
              <Button variant="outline" size="sm" :disabled="page === data?.totalPages" @click="page++">Next</Button>
            </div>
          </CardContent>
        </Card>
      </template>
    </div>
  </div>
</template>
