import { processPatientEngagementEventUseCase } from "@/src/application/use-cases/process-patient-engagement-event.use-case";
import { isError } from "@/src/entities/errors/common";
import type { ApplicationContext } from "@/src/entities/models/application-context";
import {
  type PatientEngagementEventContext,
  type PatientEngagementEventType,
} from "@/src/entities/models/patient-engagement-event-context";
import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import { createHash, timingSafeEqual } from "node:crypto";
import type { H3Event } from "h3";
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

const WEBHOOK_RATE_WINDOW_MS = 60 * 1000;
const WEBHOOK_RATE_MAX = 60;
const WEBHOOK_REPLAY_WINDOW_MS = 10 * 60 * 1000;
const AUTH_FAILURE_ALERT_THRESHOLD = 10;

const webhookRateByClientIp = new Map<
  string,
  { count: number; resetAt: number }
>();
const processedWebhookEvents = new Map<string, number>();
const webhookAuthFailures = new Map<string, { count: number; resetAt: number }>();

export default defineEventHandler(async (event) => {
  const cxt = await toApplicationContext(event);
  const body = await readBody(event);

  const clientId = event.context.params?.clientId;
  if (!clientId) {
    cxt.logger.error("No clientId in the PE webhook request");
    throw createError({
      statusCode: 400,
      statusMessage: "Missing clientId",
    });
  }
  enforceWebhookRateLimit(event, clientId);

  const siteConfig = await cxt
    .getSiteConfigurationRepository()
    .findByClientId(clientId);
  if (!siteConfig) {
    cxt.logger.error(`No site configuration found with clientId ${clientId}`);
    throw createError({
      statusCode: 404,
      statusMessage: "Unknown clientId",
    });
  }

  if (!verifyWebhookKey(siteConfig.webhookKey || "", getWebhookKey(event))) {
    registerWebhookAuthFailure(cxt, clientId, getWebhookIp(event));
    throw createError({
      statusCode: 401,
      statusMessage: "Invalid webhook key",
    });
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
    throw createError({
      statusCode: 503,
      statusMessage: "Open API credentials not configured",
    });
  }

  const challenge = body?.challenge;
  if (typeof challenge === "string" && challenge.length > 0) {
    if (!isUnsignedChallengeAllowed(siteConfig.webhookUnsignedChallengeUntil)) {
      cxt.logger.warn(
        `Rejected unsigned challenge for clientId ${clientId}: onboarding window closed`
      );
      throw createError({
        statusCode: 403,
        statusMessage: "Unsigned challenge not allowed",
      });
    }
    setResponseStatus(event, 200);
    return {
      challenge,
    };
  } else {
    cxt.logger.info("Received patient engagement webhook event");

    const parseResult = OceanPatientEngagementWebhookEventSchema.safeParse(body);
    if (!parseResult.success) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid webhook payload",
      });
    }
    const peEvent = parseResult.data;
    if (peEvent.siteNum !== siteConfig.oceanSiteNum) {
      cxt.logger.warn(
        `Rejected webhook for clientId ${clientId}: payload siteNum ${peEvent.siteNum} does not match configured site ${siteConfig.oceanSiteNum}`
      );
      throw createError({
        statusCode: 403,
        statusMessage: "siteNum mismatch",
      });
    }

    const oceanSessionId = peEvent.customProperties?.oceanSessionId;
    if (!oceanSessionId) {
      throw createError({
        statusCode: 400,
        statusMessage: "Missing oceanSessionId",
      });
    }

    const replayKey = getReplayKey(clientId, peEvent, oceanSessionId);
    if (wasRecentlyProcessed(replayKey)) {
      cxt.logger.warn(
        `Ignoring replayed webhook event for clientId ${clientId}: ${peEvent.type} ${peEvent.ref}`
      );
      setResponseStatus(event, 202);
      return {
        status: "duplicate_ignored",
      };
    }

    const patient = await getPatient({
      creds: openApiCreds,
      ptRef: peEvent.ref,
    });
    if (isError(patient) || !patient) {
      cxt.logger.error(
        `Error getting patient for event ${peEvent.type} ${peEvent.ref}: ${patient}`
      );
      throw createError({
        statusCode: 502,
        statusMessage: "Failed to fetch patient",
      });
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
      throw createError({
        statusCode: 502,
        statusMessage: "Failed to fetch note",
      });
    }
    if (!note) {
      cxt.logger.warn(`No note found for event ${peEvent.type} ${peEvent.ref}`);
      rememberProcessedEvent(replayKey);
      setResponseStatus(event, 202);
      return {
        status: "accepted_no_note",
      };
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
        activeTenantId: siteConfig.tenantId,
        tenantId: siteConfig.tenantId,
        memberships: [],
      },
    });
    await processPatientEngagementEventUseCase(peEventContext, cxt);
    rememberProcessedEvent(replayKey);
    setResponseStatus(event, 202);
    return {
      status: "accepted",
    };
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

function verifyWebhookKey(expected: string, provided: string): boolean {
  if (!expected || !provided) return false;
  const expectedHash = createHash("sha256").update(expected).digest();
  const providedHash = createHash("sha256").update(provided).digest();
  return timingSafeEqual(expectedHash, providedHash);
}

function getWebhookKey(event: H3Event): string {
  const headerValue = getHeader(event, "x-ocean-webhook-key");
  if (headerValue) return headerValue;
  const query = getQuery(event);
  const queryKey = query.k;
  if (typeof queryKey === "string") return queryKey;
  if (Array.isArray(queryKey) && typeof queryKey[0] === "string") {
    return queryKey[0];
  }
  return "";
}

function getWebhookIp(event: H3Event): string {
  return getRequestIP(event, { xForwardedFor: true }) ?? "unknown";
}

function getWebhookRateLimitKey(event: H3Event, clientId: string): string {
  return `${clientId}:${getWebhookIp(event)}`;
}

function enforceWebhookRateLimit(event: H3Event, clientId: string): void {
  const key = getWebhookRateLimitKey(event, clientId);
  const now = Date.now();
  const existing = webhookRateByClientIp.get(key);
  if (!existing || now > existing.resetAt) {
    webhookRateByClientIp.set(key, {
      count: 1,
      resetAt: now + WEBHOOK_RATE_WINDOW_MS,
    });
    return;
  }
  existing.count += 1;
  webhookRateByClientIp.set(key, existing);
  if (existing.count > WEBHOOK_RATE_MAX) {
    throw createError({
      statusCode: 429,
      statusMessage: "Too many webhook requests",
    });
  }
}

function registerWebhookAuthFailure(
  cxt: ApplicationContext,
  clientId: string,
  ip: string
): void {
  const key = `${clientId}:${ip}`;
  const now = Date.now();
  const existing = webhookAuthFailures.get(key);
  if (!existing || now > existing.resetAt) {
    webhookAuthFailures.set(key, {
      count: 1,
      resetAt: now + WEBHOOK_RATE_WINDOW_MS,
    });
    cxt.logger.warn(`Webhook auth failure for clientId ${clientId} from IP ${ip}`);
    return;
  }
  existing.count += 1;
  webhookAuthFailures.set(key, existing);
  cxt.logger.warn(`Webhook auth failure for clientId ${clientId} from IP ${ip}`);
  if (existing.count === AUTH_FAILURE_ALERT_THRESHOLD) {
    cxt.logger.error(
      `Repeated webhook auth failures for clientId ${clientId} from IP ${ip}`
    );
  }
}

function getReplayKey(
  clientId: string,
  event: OceanPatientEngagementWebhookEvent,
  oceanSessionId: string
): string {
  return `${clientId}:${event.type}:${event.ref}:${oceanSessionId}`;
}

function wasRecentlyProcessed(key: string): boolean {
  const now = Date.now();
  const expiresAt = processedWebhookEvents.get(key);
  if (!expiresAt) {
    return false;
  }
  if (now > expiresAt) {
    processedWebhookEvents.delete(key);
    return false;
  }
  return true;
}

function rememberProcessedEvent(key: string): void {
  cleanupExpiredReplayCache();
  processedWebhookEvents.set(key, Date.now() + WEBHOOK_REPLAY_WINDOW_MS);
}

function cleanupExpiredReplayCache(): void {
  const now = Date.now();
  for (const [key, expiresAt] of processedWebhookEvents.entries()) {
    if (now > expiresAt) {
      processedWebhookEvents.delete(key);
    }
  }
}

function isUnsignedChallengeAllowed(
  webhookUnsignedChallengeUntil?: Date | null
): boolean {
  if (!webhookUnsignedChallengeUntil) return false;
  return webhookUnsignedChallengeUntil.getTime() >= Date.now();
}
