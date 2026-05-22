import type { RoutingToolAction } from "@/src/entities/models/routing-tool";
import type { RoutingToolName } from "@/src/infrastructure/services/routing-tools/routing-tool-registry";
import type { Bundle } from "fhir/r4";
import type { PatientEngagementEventMessage } from "./patient-engagement-event-context";

export type RuleEvaluation = {
  actions: RoutingToolAction<RoutingToolName>[];
  prompt?: string;
  triggered?: boolean;
  error?: string;
  comment?: string;
  reasoning?: string;
};

export type RuleEvaluationResult = {
  ruleId: string;
  ruleName: string;
  evaluation: RuleEvaluation;
};

export type ServiceRequestEventMessage = Bundle;

export type RoutingEventMessage =
  | ServiceRequestEventMessage
  | PatientEngagementEventMessage;
