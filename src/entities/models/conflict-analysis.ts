import type { RuleEvaluationResult } from "./routing-evaluation";
import type { RoutingToolName } from "@/src/infrastructure/services/routing-tools/routing-tool-registry";
import { clientRoutingToolRegistry } from "./routing-tool-client";

export type ConflictSeverity = "warning" | "blocking";

export type ActionConflict = {
  severity: ConflictSeverity;
  description: string;
  ruleIds: string[];
  ruleNames: string[];
};

type TrackedAction = {
  ruleId: string;
  ruleName: string;
  tool: RoutingToolName;
  conflictGroup: string;
  conflictKey: string;
};

// Groups where different outcomes are blocking (not just a warning)
const BLOCKING_GROUPS = new Set(["referral-status", "referral-destination"]);

export function analyzeActionConflicts(
  results: RuleEvaluationResult[]
): ActionConflict[] {
  const conflicts: ActionConflict[] = [];

  // Only triggered rules that produced actions and weren't stopped/skipped
  const activated = results.filter(
    (r) =>
      !r.stoppedByRuleId &&
      r.evaluation.triggered === true &&
      r.evaluation.actions.length > 0 &&
      !r.evaluation.error
  );

  const tracked: TrackedAction[] = [];
  for (const result of activated) {
    for (const action of result.evaluation.actions) {
      const toolDef = clientRoutingToolRegistry[action.tool];
      if (!toolDef?.conflictGroup) continue;
      tracked.push({
        ruleId: result.ruleId,
        ruleName: result.ruleName,
        tool: action.tool,
        conflictGroup: toolDef.conflictGroup,
        conflictKey: toolDef.getConflictKey?.(action.input as Record<string, any>) ?? action.tool,
      });
    }
  }

  // Group by conflict group
  const byGroup = new Map<string, TrackedAction[]>();
  for (const ta of tracked) {
    const list = byGroup.get(ta.conflictGroup) ?? [];
    list.push(ta);
    byGroup.set(ta.conflictGroup, list);
  }

  // Within-group conflict detection
  for (const [group, actions] of byGroup.entries()) {
    if (actions.length < 2) continue;

    const keyToActions = new Map<string, TrackedAction[]>();
    for (const action of actions) {
      const list = keyToActions.get(action.conflictKey) ?? [];
      list.push(action);
      keyToActions.set(action.conflictKey, list);
    }

    const uniqueKeys = [...keyToActions.keys()];
    const allRuleIds = uniqueRuleIds(actions);
    const allRuleNames = uniqueRuleNames(actions);

    if (uniqueKeys.length > 1) {
      // Different outcomes within the same group
      const severity: ConflictSeverity = BLOCKING_GROUPS.has(group)
        ? "blocking"
        : "warning";
      conflicts.push({
        severity,
        description: buildDifferentKeysMessage(group, uniqueKeys, allRuleNames),
        ruleIds: allRuleIds,
        ruleNames: allRuleNames,
      });
    } else {
      // Same outcome from multiple rules — redundant
      conflicts.push(...buildDuplicateConflicts(group, uniqueKeys[0]!, allRuleIds, allRuleNames));
    }
  }

  // Cross-group: review-flag + referral-status from different rules
  const reviewActions = byGroup.get("review-flag") ?? [];
  const statusActions = byGroup.get("referral-status") ?? [];
  if (reviewActions.length > 0 && statusActions.length > 0) {
    const reviewRuleIds = new Set(reviewActions.map((a) => a.ruleId));
    const statusRuleIds = new Set(statusActions.map((a) => a.ruleId));
    const fromDifferentRules = [...reviewRuleIds].some((id) => !statusRuleIds.has(id));
    if (fromDifferentRules) {
      const statusValues = [...new Set(statusActions.map((a) => a.conflictKey))];
      const allRuleIds = uniqueRuleIds([...reviewActions, ...statusActions]);
      const allRuleNames = uniqueRuleNames([...reviewActions, ...statusActions]);
      const statusStr = statusValues.map((v) => '"' + v + '"').join(" or ");
      conflicts.push({
        severity: "warning",
        description: `One rule flags the referral for review while another sets its status to ${statusStr}. The status change may resolve the referral before it can be reviewed.`,
        ruleIds: allRuleIds,
        ruleNames: allRuleNames,
      });
    }
  }

  return conflicts;
}

function quoted(s: string): string {
  return '"' + s + '"';
}

function buildDifferentKeysMessage(
  group: string,
  keys: string[],
  ruleNames: string[]
): string {
  const rulesLabel = ruleNames.map(quoted).join(" and ");
  const keysLabel = keys.map(quoted).join(" vs. ");
  switch (group) {
    case "referral-status":
      return `${rulesLabel} set conflicting referral statuses: ${keysLabel}. Only one can take effect.`;
    case "referral-destination":
      return `${rulesLabel} route the referral to different destinations: ${keysLabel}. Only one destination will be used.`;
    case "category":
      return `${rulesLabel} set different health service categories: ${keysLabel}.`;
    default:
      return `${rulesLabel} produce conflicting ${quoted(group)} actions.`;
  }
}

function buildDuplicateConflicts(
  group: string,
  key: string,
  ruleIds: string[],
  ruleNames: string[]
): ActionConflict[] {
  const rulesLabel = ruleNames.map(quoted).join(" and ");
  switch (group) {
    case "referral-status":
      return [
        {
          severity: "warning",
          description: `${rulesLabel} both set the referral status to ${quoted(key)}. Only the first matched rule's action will take effect.`,
          ruleIds,
          ruleNames,
        },
      ];
    case "referral-destination":
      return [
        {
          severity: "warning",
          description: `${rulesLabel} both route the referral to ${quoted(key)}. Only the first matched rule's action will take effect.`,
          ruleIds,
          ruleNames,
        },
      ];
    case "econsult-toggle":
      return [
        {
          severity: "warning",
          description: `${rulesLabel} both toggle eConsult. If both trigger on the same referral, the changes may cancel each other out.`,
          ruleIds,
          ruleNames,
        },
      ];
    default:
      return [];
  }
}

function uniqueRuleIds(actions: TrackedAction[]): string[] {
  return [...new Set(actions.map((a) => a.ruleId))];
}

function uniqueRuleNames(actions: TrackedAction[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const a of actions) {
    if (!seen.has(a.ruleId)) {
      seen.add(a.ruleId);
      result.push(a.ruleName);
    }
  }
  return result;
}
