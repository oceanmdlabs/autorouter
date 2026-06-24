import { describe, expect, it, vi } from "vitest";
import { evaluateRulesInOrder } from "./evaluate-rules-in-order";
import type { RoutingRule } from "@/src/entities/models/routing-rule";
import type { RuleEvaluationResult } from "@/src/entities/models/routing-evaluation";

function makeRule(overrides: Partial<RoutingRule> = {}): RoutingRule {
  return {
    id: "rule-1",
    name: "Test Rule",
    tenantId: "tenant-1",
    triggeringEvent: "request_received",
    prompt: "Test prompt",
    active: true,
    enabledTools: [],
    summarizeAttachmentsAcknowledged: false,
    priority: 1,
    stopProcessingOnMatch: false,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    createdBy: "user-1",
    updatedBy: "user-1",
    ...overrides,
  };
}

function triggeredResult(rule: RoutingRule): RuleEvaluationResult {
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    evaluation: {
      triggered: true,
      actions: [{ id: "action-1", tool: "addComment" as any, input: { comment: "test" } }],
    },
  };
}

function untriggeredResult(rule: RoutingRule): RuleEvaluationResult {
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    evaluation: { triggered: false, actions: [] },
  };
}

function erroredResult(rule: RoutingRule): RuleEvaluationResult {
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    evaluation: { triggered: false, actions: [], error: "AI error" },
  };
}

const eventArgs = {
  routingEventMessage: {} as any,
  eventType: "request_received" as const,
  requestDescription: "test",
};

describe("evaluateRulesInOrder", () => {
  it("evaluates all rules when no rule has stopProcessingOnMatch", async () => {
    const rule1 = makeRule({ id: "rule-1", priority: 1 });
    const rule2 = makeRule({ id: "rule-2", priority: 2 });
    const evaluateRule = vi.fn()
      .mockResolvedValueOnce(triggeredResult(rule1))
      .mockResolvedValueOnce(triggeredResult(rule2));

    const results = await evaluateRulesInOrder({ rules: [rule1, rule2], evaluateRule, ...eventArgs });

    expect(evaluateRule).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(2);
    expect(results[0]?.stoppedByRuleId).toBeUndefined();
    expect(results[1]?.stoppedByRuleId).toBeUndefined();
  });

  it("skips later rules when a triggered rule with actions has stopProcessingOnMatch", async () => {
    const rule1 = makeRule({ id: "rule-1", name: "Rule One", stopProcessingOnMatch: true, priority: 1 });
    const rule2 = makeRule({ id: "rule-2", name: "Rule Two", priority: 2 });
    const rule3 = makeRule({ id: "rule-3", name: "Rule Three", priority: 3 });
    const evaluateRule = vi.fn().mockResolvedValueOnce(triggeredResult(rule1));

    const results = await evaluateRulesInOrder({ rules: [rule1, rule2, rule3], evaluateRule, ...eventArgs });

    expect(evaluateRule).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(3);
    expect(results[1]?.stoppedByRuleId).toBe("rule-1");
    expect(results[1]?.stoppedByRuleName).toBe("Rule One");
    expect(results[1]?.evaluation.actions).toHaveLength(0);
    expect(results[2]?.stoppedByRuleId).toBe("rule-1");
  });

  it("continues processing when triggered rule has no actions even with stopProcessingOnMatch", async () => {
    const rule1 = makeRule({ id: "rule-1", stopProcessingOnMatch: true, priority: 1 });
    const rule2 = makeRule({ id: "rule-2", priority: 2 });
    const noActionResult: RuleEvaluationResult = {
      ruleId: rule1.id,
      ruleName: rule1.name,
      evaluation: { triggered: true, actions: [] },
    };
    const evaluateRule = vi.fn()
      .mockResolvedValueOnce(noActionResult)
      .mockResolvedValueOnce(triggeredResult(rule2));

    const results = await evaluateRulesInOrder({ rules: [rule1, rule2], evaluateRule, ...eventArgs });

    expect(evaluateRule).toHaveBeenCalledTimes(2);
    expect(results[1]?.stoppedByRuleId).toBeUndefined();
  });

  it("continues processing when errored rule has stopProcessingOnMatch", async () => {
    const rule1 = makeRule({ id: "rule-1", stopProcessingOnMatch: true, priority: 1 });
    const rule2 = makeRule({ id: "rule-2", priority: 2 });
    const evaluateRule = vi.fn()
      .mockResolvedValueOnce(erroredResult(rule1))
      .mockResolvedValueOnce(triggeredResult(rule2));

    const results = await evaluateRulesInOrder({ rules: [rule1, rule2], evaluateRule, ...eventArgs });

    expect(evaluateRule).toHaveBeenCalledTimes(2);
    expect(results[1]?.stoppedByRuleId).toBeUndefined();
  });

  it("continues processing when non-triggered rule has stopProcessingOnMatch", async () => {
    const rule1 = makeRule({ id: "rule-1", stopProcessingOnMatch: true, priority: 1 });
    const rule2 = makeRule({ id: "rule-2", priority: 2 });
    const evaluateRule = vi.fn()
      .mockResolvedValueOnce(untriggeredResult(rule1))
      .mockResolvedValueOnce(triggeredResult(rule2));

    const results = await evaluateRulesInOrder({ rules: [rule1, rule2], evaluateRule, ...eventArgs });

    expect(evaluateRule).toHaveBeenCalledTimes(2);
    expect(results[1]?.stoppedByRuleId).toBeUndefined();
  });

  it("returns empty array when given no rules", async () => {
    const evaluateRule = vi.fn();
    const results = await evaluateRulesInOrder({ rules: [], evaluateRule, ...eventArgs });
    expect(results).toHaveLength(0);
    expect(evaluateRule).not.toHaveBeenCalled();
  });
});
