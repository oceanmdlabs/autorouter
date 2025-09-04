export interface SessionUser {
  id: string;
  name: string;
  roles: {
    admin?: "" | "tenant" | "system";
  };
  tenantId: string;
}

export interface Session {
  user: SessionUser | null;
}
