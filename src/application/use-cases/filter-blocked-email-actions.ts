import type { RuleEvaluationResult } from "@/src/entities/models/routing-evaluation";

export function filterBlockedEmailActions(
  results: RuleEvaluationResult[],
  allowlist: string[] | null | undefined
): RuleEvaluationResult[] {
  const allowlistLower = (allowlist ?? []).map((e) => e.toLowerCase());

  return results.map((result) => {
    const blockedNotes: string[] = [];

    const filteredActions = result.evaluation.actions.filter((action) => {
      if (action.tool !== "sendEmail") return true;

      const input = action.input as { to?: string; cc?: string; subject?: string };
      const toAddresses = (input.to ?? "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      const ccAddresses = input.cc
        ? input.cc.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
        : [];
      const allRecipients = [...toAddresses, ...ccAddresses];

      if (allowlistLower.length === 0) {
        blockedNotes.push(
          `Attempted to send email to ${input.to ?? "unknown"} but no approved recipients are configured (allowlist is empty).`
        );
        return false;
      }

      const blockedAddresses = allRecipients.filter(
        (addr) => !allowlistLower.includes(addr)
      );
      if (blockedAddresses.length > 0) {
        blockedNotes.push(
          `Attempted to send email to ${input.to ?? "unknown"} but ${blockedAddresses.join(", ")} ${blockedAddresses.length === 1 ? "is" : "are"} not on the allowlist.`
        );
        return false;
      }

      return true;
    });

    if (blockedNotes.length === 0) {
      return result;
    }

    const existingComment = result.evaluation.comment
      ? `${result.evaluation.comment} `
      : "";

    return {
      ...result,
      evaluation: {
        ...result.evaluation,
        actions: filteredActions,
        triggered: filteredActions.length > 0,
        comment: `${existingComment}${blockedNotes.join(" ")}`,
      },
    };
  });
}
