import type { RoutingToolAction } from "@/src/entities/models/routing-tool";
import type { Bundle } from "fhir/r4";
import type { CDSHookRequest } from "@/src/entities/models/cds-hooks";
import type { RoutingToolName } from "@/src/infrastructure/services/routing-tools/routing-tool-registry";

export type RuleEvaluation = {
  actions: RoutingToolAction<RoutingToolName>[];
  prompt?: string;
  triggered?: boolean;
  error?: string;
  comment?: string;
};

export type RuleEvaluationResult = {
  ruleId: string;
  ruleName: string;
  evaluation: RuleEvaluation;
};

export type ServiceRequestMessage = Bundle | CDSHookRequest;
