export interface SessionUser {
  id: string;
  name: string;
  roles: {
    admin?: "" | "tenant" | "system";
  };
  tenantId: string;
  /** The user's original tenant ID - set when admin switches to view another site */
  originalTenantId?: string;
}

export interface Session {
  user: SessionUser | null;
  /** The decrypted RSA private key in PEM format (only present when vault is unlocked) */
  tenantPrivateKey?: string;
  /** Timestamp when the vault was unlocked */
  dekUnlockedAt?: string;
}
