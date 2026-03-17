import { z } from "zod";
import {
  baseResourceSchema,
  newBaseResourceSchema,
  tenantConfinedSchema,
} from "./base";

export const privacyAuditEventTypeSchema = z.enum([
  "login_succeeded",
  "privacy_audit_logs_viewed",
  "privacy_audit_logs_filtered",
  "site_configuration_changed",
  "site_configuration_created",
  "routing_rule_created",
  "routing_rule_updated",
  "routing_rule_deleted",
  "erequest_search",
  "erequest_viewed",
  "activity_logs_viewed",
  "activity_logs_filtered",
  "tenant_member_assigned",
  "tenant_member_role_changed",
  "tenant_member_revoked",
  "tenant_invite_created",
  "tenant_invite_redeemed",
  "tenant_invite_revoked",
]);

export const privacyAuditEventTypes = privacyAuditEventTypeSchema.options;

export const privacyAuditLogSchema = baseResourceSchema
  .merge(tenantConfinedSchema)
  .extend({
    actorUserId: z.string().nullable().optional(),
    actorName: z.string().nullable().optional(),
    actorProvider: z.string().nullable().optional(),
    eventType: privacyAuditEventTypeSchema,
    subjectType: z.string().nullable().optional(),
    subjectId: z.string().nullable().optional(),
    summary: z.string(),
    sensitiveData: z.unknown().nullable().optional(),
  });

export const newPrivacyAuditLogSchema = privacyAuditLogSchema
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdBy: true,
    updatedBy: true,
  })
  .merge(newBaseResourceSchema)
  .merge(tenantConfinedSchema.partial());

export type PrivacyAuditEventType = z.infer<typeof privacyAuditEventTypeSchema>;
export type PrivacyAuditLog = z.infer<typeof privacyAuditLogSchema>;
export type NewPrivacyAuditLog = z.infer<typeof newPrivacyAuditLogSchema>;
