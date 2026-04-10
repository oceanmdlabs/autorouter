// auth.d.ts
declare module "#auth-utils" {
  interface User {
    name: string;
    tenantId: string;
    /** The user's original tenant ID - set when admin switches to view another site */
    originalTenantId?: string;
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
    /** The decrypted RSA private key in PEM format (only present when vault is unlocked) */
    tenantPrivateKey?: string;
    /** Timestamp when the vault was unlocked */
    dekUnlockedAt?: string;
  }
}

export {};
