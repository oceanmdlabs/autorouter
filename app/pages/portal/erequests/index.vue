<script setup lang="ts">
import type { PaginatedResult } from "@/src/entities/models/paginated-result";
import type { Erequest } from "@/src/entities/models/erequest";
import type { SiteConfiguration } from "@/src/entities/models/site-configuration";
import { formatTimestampWithMinutePrecision } from "@/shared/lib/utils";

const page = ref(1);
const pageSize = ref(20);
const search = ref("");
const healthNumber = ref("");
const medicalRecordNumber = ref("");
const patientName = ref("");
const referringProvider = ref("");
const receivingProvider = ref("");
const healthServiceType = ref("");
const referralRef = ref("");
const requestedListing = ref("");
const receivedFrom = ref("");
const receivedTo = ref("");

const { data: siteConfig } = useAsyncData("erequest-site-config", () =>
  useRequestFetch()<{
    siteConfig: SiteConfiguration | null;
  }>("/api/site-configuration")
);

const { data, refresh, status } = useAsyncData("erequests", () =>
  useRequestFetch()<PaginatedResult<Erequest>>("/api/erequests", {
    params: {
      page: page.value,
      pageSize: pageSize.value,
      search: search.value || undefined,
      healthNumber: healthNumber.value || undefined,
      medicalRecordNumber: medicalRecordNumber.value || undefined,
      patientName: patientName.value || undefined,
      referringProvider: referringProvider.value || undefined,
      receivingProvider: receivingProvider.value || undefined,
      healthServiceType: healthServiceType.value || undefined,
      referralRef: referralRef.value || undefined,
      requestedListing: requestedListing.value || undefined,
      receivedFrom: receivedFrom.value || undefined,
      receivedTo: receivedTo.value || undefined,
    },
  })
);

watch(
  [
    page,
    pageSize,
    search,
    healthNumber,
    medicalRecordNumber,
    patientName,
    referringProvider,
    receivingProvider,
    healthServiceType,
    referralRef,
    requestedListing,
    receivedFrom,
    receivedTo,
  ],
  (_, oldValue) => {
    if (oldValue && search.value !== oldValue[2]) {
      page.value = 1;
    }
    refresh();
  }
);

const archivalEnabled = computed(
  () => siteConfig.value?.siteConfig?.erequestArchivalEnabled ?? false
);
</script>

<template>
  <div class="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900">Erequests</h1>
        <p class="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
          Browse retained inbound erequests and download the archived documents.
        </p>
      </div>

      <Card v-if="!archivalEnabled">
        <CardContent class="space-y-3 py-6">
          <p class="text-sm text-gray-700">
            Erequest archival is currently disabled for this tenant.
          </p>
          <NuxtLink to="/portal/site-configuration" class="text-sm font-medium text-blue-600 hover:underline">
            Open site settings
          </NuxtLink>
        </CardContent>
      </Card>

      <template v-else>
        <Card>
          <CardContent class="grid gap-3 py-6 md:grid-cols-3 xl:grid-cols-4">
            <Input v-model="search" placeholder="Search" />
            <Input v-model="patientName" placeholder="Patient name" />
            <Input v-model="healthNumber" placeholder="Health number" />
            <Input v-model="medicalRecordNumber" placeholder="MRN" />
            <Input v-model="referralRef" placeholder="Referral reference" />
            <Input v-model="requestedListing" placeholder="Requested listing" />
            <Input v-model="referringProvider" placeholder="Referring provider" />
            <Input v-model="receivingProvider" placeholder="Receiving provider" />
            <Input v-model="healthServiceType" placeholder="Health service type" />
            <Input v-model="receivedFrom" type="date" placeholder="Received from" />
            <Input v-model="receivedTo" type="date" placeholder="Received to" />
          </CardContent>
        </Card>

        <Card>
          <CardContent class="py-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Received</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Providers</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-if="status === 'success' && !(data?.items?.length)">
                  <TableCell :colspan="5" class="text-center text-muted-foreground">
                    No retained erequests found.
                  </TableCell>
                </TableRow>
                <TableRow v-for="erequest in data?.items ?? []" :key="erequest.id" class="cursor-pointer" @click="navigateTo(`/portal/erequests/${erequest.id}`)">
                  <TableCell>{{ formatTimestampWithMinutePrecision(erequest.receivedAt) }}</TableCell>
                  <TableCell>
                    <div class="font-medium text-slate-900">{{ erequest.patientName || "-" }}</div>
                    <div class="text-xs text-slate-500">
                      {{ [erequest.patientHealthNumber, erequest.patientMedicalRecordNumber].filter(Boolean).join(" / ") || "-" }}
                    </div>
                  </TableCell>
                  <TableCell>{{ erequest.referralRef || "-" }}</TableCell>
                  <TableCell class="text-sm">
                    {{ [erequest.referringProvider, erequest.receivingProvider].filter(Boolean).join(" → ") || "-" }}
                  </TableCell>
                  <TableCell>{{ erequest.storageStatus }}</TableCell>
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
