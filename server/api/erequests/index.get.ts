import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";

export default defineEventHandler(async (event) => {
  const cxt = await toApplicationContext(event);
  const query = getQuery(event);

  return await cxt.getErequestsRepository().search({
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
    receivedTo: query.receivedTo ? new Date(query.receivedTo as string) : undefined,
  });
});
