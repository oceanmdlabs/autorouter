import { processPatientEngagementEventUseCase } from "@/src/application/use-cases/process-patient-engagement-event.use-case";
import { isError } from "@/src/entities/errors/common";
import {
  type PatientEngagementEventContext,
  type PatientEngagementEventType,
} from "@/src/entities/models/patient-engagement-event-context";
import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import { z } from "zod";
import { getPatient, getPatientNote } from "../open-api-client";

const OceanPatientEngagementWebhookEventSchema = z.object({
  type: z.enum([
    "notify-patient-message-forms-completion",
    "notify-patient-note-added",
  ]),
  ref: z.string(),
  siteNum: z.string(),
  customProperties: z.object({
    oceanSessionId: z.string().optional(),
    noteCompletionSource: z.enum(["PORTAL", "PATIENT", "TABLET"]).optional(),
  }),
});
export type OceanPatientEngagementWebhookEvent = z.infer<
  typeof OceanPatientEngagementWebhookEventSchema
>;

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const cxt = await toApplicationContext(event);

  const clientId = event.context.params?.clientId;
  if (!clientId) {
    cxt.logger.error("No clientId in the PE webhook request");
    return;
  }
  const siteConfig = await cxt
    .getSiteConfigurationRepository()
    .findByClientId(clientId);
  if (!siteConfig) {
    cxt.logger.error(`No site configuration found with clientId ${clientId}`);
    return;
  }
  const openApiCreds = {
    oceanHost: siteConfig.oceanServer,
    siteNum: siteConfig.oceanSiteNum,
    siteKey: siteConfig.siteKey || "",
    siteCredential: siteConfig.siteCredential || "",
    sharedEncryptionKey: siteConfig.sharedEncryptionKey || "",
  };
  if (
    !openApiCreds.siteKey ||
    !openApiCreds.siteCredential ||
    !openApiCreds.sharedEncryptionKey
  ) {
    cxt.logger.error(
      `No open API credentials found for site ${siteConfig.oceanSiteNum}`
    );
    return;
  }

  const { challenge } = body;
  if (challenge) {
    return {
      challenge,
    };
  } else {
    cxt.logger.info("Received patient engagement webhook event");

    const peEvent = OceanPatientEngagementWebhookEventSchema.parse(body);
    const patient = await getPatient({
      creds: openApiCreds,
      ptRef: peEvent.ref,
    });
    if (isError(patient) || !patient) {
      cxt.logger.error(
        `Error getting patient for event ${peEvent.type} ${peEvent.ref}: ${patient}`
      );
      return;
    }

    const oceanSessionId = peEvent.customProperties?.oceanSessionId;
    if (!oceanSessionId) {
      cxt.logger.error(
        `No oceanSessionId found for event ${peEvent.type} ${peEvent.ref}`
      );
      return;
    }
    const note = await getPatientNote({
      creds: openApiCreds,
      oceanSessionId: oceanSessionId,
      ptRef: peEvent.ref,
    });
    if (isError(note)) {
      cxt.logger.error(
        `Error getting note for event ${peEvent.type} ${peEvent.ref}: ${note}`
      );
      return;
    }
    if (!note) {
      cxt.logger.warn(`No note found for event ${peEvent.type} ${peEvent.ref}`);
      return;
    }
    cxt.logger.info(
      `Found note ${note.noteId} for event ${peEvent.type} ${peEvent.ref}`
    );

    const triggeringEvent = mapOceanWebhookEventToLocalPeEventType(peEvent);

    const peEventContext: PatientEngagementEventContext = {
      triggeringEvent,
      message: {
        patient,
        note,
        oceanSessionId,
      },
    };
    cxt.setSession({
      user: {
        id: "api-client-" + siteConfig.clientId,
        name: "Ocean Open API WebhookClient",
        roles: { admin: "" },
        tenantId: siteConfig.tenantId,
      },
    });
    await processPatientEngagementEventUseCase(peEventContext, cxt);
  }
});
function mapOceanWebhookEventToLocalPeEventType(
  peEvent: OceanPatientEngagementWebhookEvent
): PatientEngagementEventType {
  if (peEvent.type == "notify-patient-message-forms-completion") {
    return "patient_message_forms_completion";
  } else if (peEvent.type == "notify-patient-note-added") {
    return "patient_note_added";
  } else {
    // zod should have caught this
    throw new Error(`Unknown PE event type: ${peEvent.type}`);
  }
}
