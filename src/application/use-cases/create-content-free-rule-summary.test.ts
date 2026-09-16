import { describe, expect, it } from "vitest";
import { createContentFreeRuleSummary } from "./create-content-free-rule-summary";

describe("createContentFreeRuleSummary", () => {
  it("omits prompts, reasoning, tool arguments, results, and model errors", () => {
    const summary = createContentFreeRuleSummary([
      {
        ruleId: "rule-1",
        ruleName: "Referral routing",
        evaluation: {
          triggered: true,
          prompt: "patient clinical text",
          reasoning: "model completion",
          comment: "recipient@example.com was blocked",
          error: "provider response containing patient text",
          actions: [
            {
              id: "action-1",
              tool: "sendEmail",
              input: {
                to: "recipient@example.com",
                message: "generated clinical content",
              },
            },
          ],
        },
      },
    ]);

    expect(summary).toEqual([
      {
        ruleId: "rule-1",
        ruleName: "Referral routing",
        triggered: true,
        actions: [{ tool: "sendEmail" }],
        errorCode: "RULE_EVALUATION_FAILED",
      },
    ]);
    expect(JSON.stringify(summary)).not.toContain("clinical");
    expect(JSON.stringify(summary)).not.toContain("recipient@example.com");
    expect(JSON.stringify(summary)).not.toContain("model completion");
  });
});
