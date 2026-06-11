import {
  aiProviderEnum,
  identityProviderEnum,
  oceanServerEnum,
  siteConfig,
  systemAdminAllowlist,
  tenantInvites,
  tenantInviteStatusEnum,
  tenantMemberships,
  tenantMembershipRoleEnum,
  tenantMembershipStatusEnum,
  users,
} from "@/drizzle/schema";
import { sql } from "drizzle-orm";

type EnumColumn =
  | typeof users.provider
  | typeof systemAdminAllowlist.provider
  | typeof tenantMemberships.role
  | typeof tenantMemberships.status
  | typeof tenantInvites.role
  | typeof tenantInvites.status
  | typeof siteConfig.oceanServer
  | typeof siteConfig.aiProvider;

type EnumName =
  | "identity_provider"
  | "tenant_membership_role"
  | "tenant_membership_status"
  | "tenant_invite_status"
  | "ocean_server"
  | "ai_provider";

export function castEnumValue<TValue extends string>(value: TValue, enumName: EnumName) {
  return sql`${value}::${sql.raw(enumName)}`;
}

export function eqEnum<TValue extends string>(column: EnumColumn, value: TValue, enumName: EnumName) {
  return sql`${column} = ${castEnumValue(value, enumName)}`;
}

export function identityProviderValue(provider: (typeof identityProviderEnum.enumValues)[number]) {
  return castEnumValue(provider, "identity_provider");
}

export function membershipRoleValue(role: (typeof tenantMembershipRoleEnum.enumValues)[number]) {
  return castEnumValue(role, "tenant_membership_role");
}

export function membershipStatusValue(
  status: (typeof tenantMembershipStatusEnum.enumValues)[number]
) {
  return castEnumValue(status, "tenant_membership_status");
}

export function inviteStatusValue(status: (typeof tenantInviteStatusEnum.enumValues)[number]) {
  return castEnumValue(status, "tenant_invite_status");
}

export function oceanServerValue(server: (typeof oceanServerEnum.enumValues)[number]) {
  return castEnumValue(server, "ocean_server");
}

export function aiProviderValue(
  provider: (typeof aiProviderEnum.enumValues)[number] | null
) {
  return provider === null ? null : castEnumValue(provider, "ai_provider");
}
