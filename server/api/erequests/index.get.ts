import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import { logPrivacyAuditEvent } from "@/server/utils/privacy-audit";

const filterLabels = {
  search: "keyword",
  healthNumber: "health number",
  medicalRecordNumber: "EMR ID",
  patientName: "patient name",
  referringProvider: "referring provider",
  receivingProvider: "receiving provider",
  referralRef: "Ocean referral reference",
  requestedListing: "requested listing",
  healthServiceType: "health service type",
  receivedFrom: "received date",
} as const;

export default defineEventHandler(async (event) => {
  const cxt = await toApplicationContext(event);
  const query = getQuery(event);
  const searchOptions = {
    page: Number(query.page) || 1,
    pageSize: Number(query.pageSize) || 20,
    search: (query.search as string) || undefined,
    healthNumber: (query.healthNumber as string) || undefined,
    medicalRecordNumber: (query.medicalRecordNumber as string) || undefined,
    patientName: (query.patientName as string) || undefined,
    referringProvider: (query.referringProvider as string) || undefined,
    receivingProvider: (query.receivingProvider as string) || undefined,
    referralRef: (query.referralRef as string) || undefined,
    requestedListing: (query.requestedListing as string) || undefined,
    healthServiceType: (query.healthServiceType as string) || undefined,
    receivedFrom: query.receivedFrom ? new Date(query.receivedFrom as string) : undefined,
  };

  const response = await cxt.getErequestsRepository().search(searchOptions);
  const activeFilters = Object.entries(filterLabels)
    .filter(([key]) => Boolean(searchOptions[key as keyof typeof searchOptions]))
    .map(([, label]) => label);

  if (activeFilters.length > 0) {
    await logPrivacyAuditEvent(cxt, {
      eventType: "erequest_search",
      subjectType: "erequest_collection",
      summary: `Searched retained eRequests using ${activeFilters.join(", ")}.`,
      sensitiveData: {
        filters: searchOptions,
      },
    });
  }

  return response;
});
