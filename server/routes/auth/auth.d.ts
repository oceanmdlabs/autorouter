declare module "#auth-utils" {
  interface User {
    id: string;
    name: string;
    activeTenantId: string | null;
    tenantId: string | null;
    clientId?: string;
    microsoftId?: string;
    gitHubId?: string;
    googleId?: string;
    provider?: "google" | "github";
    subject?: string;
    roles: {
      admin: "" | "tenant" | "system";
    };
    memberships: Array<{
      id: string;
      tenantId: string;
      role: "admin" | "member";
      status: "active" | "revoked";
    }>;
  }

  interface UserSession {
  }

  interface SecureSessionData {
  }
}

export {};
