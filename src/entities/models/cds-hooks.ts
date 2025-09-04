export interface CDSService {
  id: string;
  hook: string;
  title: string;
  description: string;
  prefetch?: {
    [key: string]: string;
  };
}

export interface CDSServiceDiscovery {
  services: CDSService[];
}

export interface CDSHookRequest {
  hook: string;
  hookInstance: string;
  context: Record<string, unknown>;
  prefetch?: Record<string, unknown>;
}

export interface Coding {
  system: string;
  code: string;
  display?: string;
}

export interface CDSSource {
  label: string;
  url?: string;
  icon?: string;
  topic?: Coding;
}

export interface CDSAction {
  type: string;
  description: string;
  resource: unknown;
}

export interface CDSSuggestion {
  label: string;
  uuid: string;
  actions: Array<CDSAction>;
}

export interface CDSCard {
  uuid: string;
  summary: string;
  detail?: string;
  indicator: "info" | "warning" | "critical";
  source: CDSSource;
  suggestions?: Array<CDSSuggestion>;
}

export interface CDSHookResponse {
  cards: Array<CDSCard>;
}
