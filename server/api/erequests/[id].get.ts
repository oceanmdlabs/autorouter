import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import { logPrivacyAuditEvent } from "@/server/utils/privacy-audit";

export default defineEventHandler(async (event) => {
  const cxt = await toApplicationContext(event);
  const record = await cxt.getErequestsRepository().get(getRouterParam(event, "id")!);

  if (!record) {
    throw createError({
      statusCode: 404,
      statusMessage: "eRequest not found",
    });
  }

  await logPrivacyAuditEvent(cxt, {
    eventType: "erequest_viewed",
    subjectType: "erequest",
    subjectId: record.id,
    summary: "Viewed retained eRequest.",
    sensitiveData: {
      referralRef: record.referralRef ?? null,
      patientName: record.patientName ?? null,
      patientHealthNumber: record.patientHealthNumber ?? null,
      patientMedicalRecordNumber: record.patientMedicalRecordNumber ?? null,
    },
  });

  return record;
});
