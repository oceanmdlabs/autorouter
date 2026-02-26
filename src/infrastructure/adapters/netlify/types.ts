export interface RequestData {
  user?: {
    clientId: string;
    name: string;
    roles: Record<string, string>;
    tenantId: string;
  };
  path?: string;
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}
