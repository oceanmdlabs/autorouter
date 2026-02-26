// auth.d.ts
declare module "#auth-utils" {
  interface User {
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
    user: User;
  }
}

export {};
