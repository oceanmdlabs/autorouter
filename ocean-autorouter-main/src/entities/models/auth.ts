export interface UserData {
  tenantId: string;
  roles: {
    admin?: "" | "tenant" | "system";
  };
}