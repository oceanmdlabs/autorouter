declare module "#auth-utils" {
  interface User {
    // Add your own fields
    name: string;
    tenantId: string;
    clientId?: string;
    microsoftId?: string;
    gitHubId?: string;
    googleId?: string;
    roles: {
      admin: "" | "tenant" | "system";
    };
  }

  interface UserSession {
    // Add your own fields
  }

  interface SecureSessionData {
    // Add your own fields
  }
}

export {};
