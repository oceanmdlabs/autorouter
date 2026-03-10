export type TenantMembershipRole = "admin" | "member";
export type TenantMembershipStatus = "active" | "revoked";

export interface TenantMembershipSummary {
  id: string;
  tenantId: string;
  role: TenantMembershipRole;
  status: TenantMembershipStatus;
}

export interface SessionUser {
  id: string;
  name: string;
  provider?: "google" | "github";
  subject?: string;
  roles: {
    admin?: "" | "tenant" | "system";
  };
  activeTenantId: string | null;
  tenantId: string | null;
  memberships: TenantMembershipSummary[];
}

export interface Session {
  user: SessionUser | null;
}
