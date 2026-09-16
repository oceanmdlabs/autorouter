import { describe, expect, it, vi } from "vitest";
import { writeDecisionAudits } from "./write-decision-audits";

describe("writeDecisionAudits", () => {
  it("writes content-free decision and tool records", async () => {
    const createDecision = vi.fn().mockResolvedValue("decision-1");
    const createTools = vi.fn().mockResolvedValue(["tool-1"]);
    const cxt = {
      getLlmRuleDecisionAuditRepository: () => ({ create: createDecision }),
      getLlmRuleToolExecutionAuditRepository: () => ({ createMany: createTools }),
    } as any;

    await writeDecisionAudits(
      [
        {
          ruleId: "rule-1",
          ruleName: "Referral routing",
          evaluation: {
            triggered: true,
            reasoning: "model completion with clinical content",
            comment: "recipient@example.com was selected",
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
      ],
      [{ id: "rule-1", updatedAt: new Date("2026-09-16T00:00:00Z") } as any],
      {
        tenantId: "tenant-1",
        siteId: "site-1",
        referralId: "opaque-event-1",
        cxt,
      }
    );

    expect(createDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        reasonSummary: null,
        reasoning: null,
        validationError: null,
      })
    );
    expect(createTools).toHaveBeenCalledWith([
      expect.objectContaining({
        toolName: "sendEmail",
        argsHash: null,
        toolInput: null,
        toolResult: null,
        errorSummary: null,
      }),
    ]);
    expect(JSON.stringify(createDecision.mock.calls)).not.toContain("clinical");
    expect(JSON.stringify(createTools.mock.calls)).not.toContain(
      "recipient@example.com"
    );
  });
});
