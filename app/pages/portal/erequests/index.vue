<script setup lang="ts">
import { handleMissingActiveTenantError } from "@/app/lib/active-tenant";
import type { PaginatedResult } from "@/src/entities/models/paginated-result";
import type { Erequest } from "@/src/entities/models/erequest";
import type { SiteConfiguration } from "@/src/entities/models/site-configuration";
import { formatTimestampWithMinutePrecision } from "@/shared/lib/utils";
import { computed, ref, watch } from "vue";

const page = ref(1);
const pageSize = ref(20);
const requestFetch = useRequestFetch();
const hasSearched = ref(false);

type SearchFilterType =
  | "search"
  | "healthNumber"
  | "medicalRecordNumber"
  | "patientName"
  | "referringProvider"
  | "receivingProvider"
  | "healthServiceType"
  | "referralRef"
  | "requestedListing"
  | "receivedFrom"
  | "receivedTo";

type SearchFilter = {
  id: string;
  type: SearchFilterType;
  value: string;
};

const SEARCH_FILTER_OPTIONS: Array<{
  value: SearchFilterType;
  label: string;
  inputType?: "text" | "date";
}> = [
  { value: "search", label: "Keyword" },
  { value: "healthNumber", label: "Health number" },
  { value: "medicalRecordNumber", label: "EMR ID" },
  { value: "patientName", label: "Patient name" },
  { value: "referringProvider", label: "Referring provider" },
  { value: "receivingProvider", label: "Receiving provider" },
  { value: "healthServiceType", label: "Health service type" },
  { value: "referralRef", label: "Ocean referral reference" },
  { value: "requestedListing", label: "Requested listing" },
  { value: "receivedFrom", label: "Received from", inputType: "date" },
  { value: "receivedTo", label: "Received to", inputType: "date" },
];
const DEFAULT_SEARCH_FILTER_OPTION = SEARCH_FILTER_OPTIONS[0]!;

const searchFilters = ref<SearchFilter[]>([
  { id: crypto.randomUUID(), type: "search", value: "" },
]);

const activeSearchParams = computed(() =>
  searchFilters.value.reduce<Record<string, string | undefined>>((params, filter) => {
    const trimmedValue = filter.value.trim();
    params[filter.type] = trimmedValue || undefined;
    return params;
  }, {})
);
const submittedSearchParams = ref<Record<string, string | undefined>>({});

const { data: siteConfig } = useAsyncData("erequest-site-config", async () => {
  try {
    return await requestFetch<{
      siteConfig: SiteConfiguration | null;
    }>("/api/site-configuration");
  } catch (error) {
    if (await handleMissingActiveTenantError(error, { notify: false })) {
      return { siteConfig: null };
    }
    throw error;
  }
});

const { data: totalCount } = useAsyncData("erequest-total-count", async () => {
  try {
    return await requestFetch<{ total: number }>("/api/erequests/count");
  } catch (error) {
    if (await handleMissingActiveTenantError(error, { notify: false })) {
      return { total: 0 };
    }
    throw error;
  }
});

const { data, refresh, status } = useAsyncData(
  "erequests",
  async () => {
    try {
      return await requestFetch<PaginatedResult<Erequest>>("/api/erequests", {
        params: {
          page: page.value,
          pageSize: pageSize.value,
          ...submittedSearchParams.value,
        },
      });
    } catch (error) {
      if (await handleMissingActiveTenantError(error, { notify: false })) {
        return { items: [], page: 1, pageSize: pageSize.value, total: 0, totalPages: 0 };
      }
      throw error;
    }
  },
  {
    immediate: false,
    default: () => ({ items: [], page: 1, pageSize: pageSize.value, total: 0, totalPages: 0 }),
  }
);

watch([page, pageSize], () => {
  if (!hasSearched.value) {
    return;
  }
  refresh();
});

const archivalEnabled = computed(
  () => siteConfig.value?.siteConfig?.erequestArchivalEnabled ?? false
);

const getFilterOption = (type: SearchFilterType) =>
  SEARCH_FILTER_OPTIONS.find((option) => option.value === type) ?? DEFAULT_SEARCH_FILTER_OPTION;

const getAvailableFilterOptions = (currentFilterId: string) => {
  const usedTypes = new Set(
    searchFilters.value
      .filter((filter) => filter.id !== currentFilterId)
      .map((filter) => filter.type)
  );

  return SEARCH_FILTER_OPTIONS.filter((option) => !usedTypes.has(option.value));
};

const canAddFilter = computed(
  () => searchFilters.value.length < SEARCH_FILTER_OPTIONS.length
);
const hasActiveFilters = computed(() =>
  Object.values(activeSearchParams.value).some((value) => Boolean(value))
);

const submitSearch = async () => {
  submittedSearchParams.value = { ...activeSearchParams.value };
  hasSearched.value = true;
  if (page.value !== 1) {
    page.value = 1;
    return;
  }
  await refresh();
};

const clearSearch = () => {
  searchFilters.value = [{ id: crypto.randomUUID(), type: "search", value: "" }];
  submittedSearchParams.value = {};
  hasSearched.value = false;
  page.value = 1;
};

const addFilter = () => {
  const usedTypes = new Set(searchFilters.value.map((filter) => filter.type));
  const nextOption = SEARCH_FILTER_OPTIONS.find((option) => !usedTypes.has(option.value));
  if (!nextOption) {
    return;
  }

  searchFilters.value.push({
    id: crypto.randomUUID(),
    type: nextOption.value,
    value: "",
  });
};

const removeFilter = (filterId: string) => {
  if (searchFilters.value.length === 1) {
    const firstFilter = searchFilters.value[0];
    if (firstFilter) {
      firstFilter.value = "";
    }
    return;
  }
  searchFilters.value = searchFilters.value.filter((filter) => filter.id !== filterId);
};
</script>

<template>
  <div class="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900">eRequests</h1>
        <p class="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
          Browse retained inbound eRequests and download the archived documents.
        </p>
      </div>

      <Card v-if="!archivalEnabled">
        <CardContent class="space-y-3 py-6">
          <p class="text-sm text-gray-700">
            eRequest archival is currently disabled for this tenant.
          </p>
          <NuxtLink to="/portal/site-configuration" class="text-sm font-medium text-blue-600 hover:underline">
            Open site settings
          </NuxtLink>
        </CardContent>
      </Card>

      <template v-else>
        <Card>
          <CardHeader>
            <CardTitle>Search</CardTitle>
            <CardDescription>Add one or more filters. Results match every filter shown.</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4 py-6">
            <div
              v-for="(filter, index) in searchFilters"
              :key="filter.id"
              class="space-y-4 rounded-lg border border-slate-200 p-4"
            >
              <div
                v-if="index > 0"
                class="text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                AND
              </div>
              <div class="grid gap-4 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto] md:items-end">
                <div class="space-y-2">
                  <Label :for="`search-type-${filter.id}`">Search type</Label>
                  <Select v-model="filter.type">
                    <SelectTrigger :id="`search-type-${filter.id}`">
                      <SelectValue placeholder="Select a search type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="option in getAvailableFilterOptions(filter.id)"
                        :key="option.value"
                        :value="option.value"
                      >
                        {{ option.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div class="space-y-2">
                  <Label :for="`search-value-${filter.id}`">
                    {{ getFilterOption(filter.type).label }}
                  </Label>
                  <Input
                    :id="`search-value-${filter.id}`"
                    v-model="filter.value"
                    :type="getFilterOption(filter.type).inputType ?? 'text'"
                    :placeholder="getFilterOption(filter.type).label"
                  />
                </div>

                <Button
                  variant="outline"
                  type="button"
                  :disabled="searchFilters.length === 1"
                  @click="removeFilter(filter.id)"
                >
                  Remove
                </Button>
              </div>
            </div>

            <div class="flex justify-start">
              <Button variant="outline" type="button" :disabled="!canAddFilter" @click="addFilter">
                Add filter
              </Button>
            </div>

            <div class="flex flex-wrap items-center gap-3">
              <Button type="button" :disabled="!hasActiveFilters" @click="submitSearch">
                Search
              </Button>
              <Button variant="ghost" type="button" :disabled="!hasActiveFilters && !hasSearched" @click="clearSearch">
                Clear
              </Button>
              <span class="text-sm text-slate-500">
                Total retained eRequests: {{ totalCount?.total ?? 0 }}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent class="py-6">
            <div v-if="hasSearched" class="mb-4 text-sm text-slate-500">
              {{ data?.total ?? 0 }} matching eRequests
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Received</TableHead>
                  <TableHead>Ocean Reference</TableHead>
                  <TableHead>Providers</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-if="!hasSearched">
                  <TableCell :colspan="3" class="text-center text-muted-foreground">
                    Enter one or more filters, then run a search.
                  </TableCell>
                </TableRow>
                <TableRow v-else-if="status === 'success' && !(data?.items?.length)">
                  <TableCell :colspan="3" class="text-center text-muted-foreground">
                    No retained eRequests found.
                  </TableCell>
                </TableRow>
                <TableRow
                  v-for="erequest in hasSearched ? data?.items ?? [] : []"
                  :key="erequest.id"
                  class="cursor-pointer"
                  @click="navigateTo(`/portal/erequests/${erequest.id}`)"
                >
                  <TableCell>{{ formatTimestampWithMinutePrecision(erequest.receivedAt) }}</TableCell>
                  <TableCell>{{ erequest.referralRef || "-" }}</TableCell>
                  <TableCell class="text-sm">
                    {{ [erequest.referringProvider, erequest.receivingProvider].filter(Boolean).join(" → ") || "-" }}
                  </TableCell>
                </TableRow>
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
