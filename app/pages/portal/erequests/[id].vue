<script setup lang="ts">
import { handleMissingActiveTenantError } from "@/app/lib/active-tenant";
import { getOceanServerUrl } from "@/src/application/services/ocean-server.utils";
import type { Erequest } from "@/src/entities/models/erequest";
import type { ErequestBlob } from "@/src/entities/models/erequest-blob";
import type { SiteConfiguration } from "@/src/entities/models/site-configuration";
import { formatTimestampWithMinutePrecision } from "@/shared/lib/utils";

const route = useRoute();
const requestFetch = useRequestFetch();

const { data } = useAsyncData(`erequest-${route.params.id}`, async () => {
  try {
    return await requestFetch<Erequest & { blobs: ErequestBlob[] }>(
      `/api/erequests/${route.params.id}`
    );
  } catch (error) {
    if (await handleMissingActiveTenantError(error, { notify: false })) {
      return null;
    }
    throw error;
  }
});

const { data: siteConfig } = useAsyncData(`site-config-${route.params.id}`, async () => {
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

const oceanReferralUrl = computed(() => {
  if (!data.value?.referralRef) {
    return undefined;
  }
  const oceanHostUrl = getOceanServerUrl(siteConfig.value?.siteConfig?.oceanServer ?? "ocean");
  return `${oceanHostUrl}/ocean/portal.html#/referrals/${data.value.referralRef}/edit`;
});
</script>

<template>
  <div class="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
    <div class="space-y-6" v-if="data">
      <div class="space-y-2">
        <NuxtLink to="/portal/erequests" class="text-sm font-medium text-blue-600 hover:underline">
          Back to eRequests
        </NuxtLink>
        <h1 class="text-2xl font-semibold text-gray-900">
          {{ data.patientName || data.referralRef || "eRequest" }}
        </h1>
        <p class="text-sm text-gray-600">
          Received {{ formatTimestampWithMinutePrecision(data.receivedAt) }}
        </p>
      </div>

      <Card>
        <CardContent class="grid gap-4 py-6 md:grid-cols-2">
          <div>
            <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Ocean Referral Reference</div>
            <div class="mt-1 space-y-1 text-sm text-slate-900">
              <div>{{ data.referralRef || "-" }}</div>
              <a
                v-if="oceanReferralUrl"
                :href="oceanReferralUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex text-blue-600 hover:underline"
              >
                View eReferral in Ocean
              </a>
            </div>
          </div>
          <div>
            <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Patient identifiers</div>
            <div class="mt-1 text-sm text-slate-900">
              {{ [data.patientHealthNumber, data.patientMedicalRecordNumber].filter(Boolean).join(" / ") || "-" }}
            </div>
          </div>
          <div>
            <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Providers</div>
            <div class="mt-1 text-sm text-slate-900">
              {{ [data.referringProvider, data.receivingProvider].filter(Boolean).join(" → ") || "-" }}
            </div>
          </div>
          <div class="md:col-span-2">
            <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Requested service</div>
            <div class="mt-1 text-sm text-slate-900">{{ data.requestedServiceDescription || "-" }}</div>
          </div>
          <div class="md:col-span-2" v-if="data.ingestionError">
            <div class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 whitespace-pre-wrap">
              {{ data.ingestionError }}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent class="py-6">
          <div class="mb-4 text-sm font-medium text-slate-900">Documents</div>
          <div class="space-y-3" v-if="data.blobs.length">
            <div v-for="blob in data.blobs" :key="blob.id" class="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div class="font-medium text-slate-900">{{ blob.filename }}</div>
                <div class="text-xs text-slate-500">
                  {{ [blob.kind, blob.contentType, `${blob.byteSize} bytes`].filter(Boolean).join(" · ") }}
                </div>
              </div>
              <div class="flex gap-2">
                <a :href="`/api/erequests/${data.id}/blobs/${blob.id}`" target="_blank">
                  <Button variant="outline" size="sm">View</Button>
                </a>
                <a :href="`/api/erequests/${data.id}/blobs/${blob.id}?download=1`">
                  <Button size="sm">Download</Button>
                </a>
              </div>
            </div>
          </div>
          <div v-else class="text-sm text-slate-500">No archived documents were stored for this eRequest.</div>
        </CardContent>
      </Card>

      <Card>
        <CardContent class="py-6">
          <Accordion type="single" collapsible class="w-full" default-value="">
            <AccordionItem value="raw-bundle">
              <AccordionTrigger type="button" class="py-0 text-sm font-medium text-slate-900 hover:no-underline">
                Raw bundle
              </AccordionTrigger>
              <AccordionContent class="pt-4">
                <pre
                  v-if="data.rawBundle"
                  class="overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100"
                >{{ JSON.stringify(data.rawBundle, null, 2) }}</pre>
                <div v-else class="text-sm text-slate-500">
                  No raw bundle was stored for this eRequest.
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
