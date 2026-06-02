import type { RuleEvaluationResult } from "@/src/entities/models/routing-evaluation";

export function filterBlockedEmailActions(
  results: RuleEvaluationResult[],
  allowlist: string[] | null | undefined
): RuleEvaluationResult[] {
  const allowlistLower = (allowlist ?? []).map((e) => e.toLowerCase());

  return results.map((result) => {
    const filteredActions = result.evaluation.actions.filter((action) => {
      if (action.tool !== "sendEmail") return true;

      const input = action.input as { to?: string; cc?: string };
      const toAddresses = (input.to ?? "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      const ccAddresses = input.cc
        ? input.cc.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
        : [];
      const allRecipients = [...toAddresses, ...ccAddresses];

      // Empty allowlist blocks all sends; otherwise every recipient must be listed
      return (
        allowlistLower.length > 0 &&
        allRecipients.every((addr) => allowlistLower.includes(addr))
      );
    });

    if (filteredActions.length === result.evaluation.actions.length) {
      return result;
    }

    return {
      ...result,
      evaluation: {
        ...result.evaluation,
        actions: filteredActions,
        triggered: filteredActions.length > 0,
        ...(filteredActions.length === 0 && result.evaluation.triggered
          ? { comment: "Email action(s) blocked: recipient not in approved allowlist." }
          : {}),
      },
    };
  });
}
