import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import { logPrivacyAuditEvent } from "@/server/utils/privacy-audit";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({
      statusCode: 400,
      message: "Missing routing rule id",
    });
  }
  const cxt = await toApplicationContext(event);

  try {
    const existingRule = await cxt.getRoutingRulesRepository().get(id);
    await cxt.getRoutingRulesRepository().remove(id);
    await logPrivacyAuditEvent(cxt, {
      eventType: "routing_rule_deleted",
      subjectType: "routing_rule",
      subjectId: id,
      summary: existingRule
        ? `Deleted routing rule "${existingRule.name}".`
        : "Deleted routing rule.",
      sensitiveData: existingRule
        ? {
            rule: existingRule,
          }
        : null,
    });
    return { success: true };
  } catch (error: any) {
    throw createError({
      statusCode: 400,
      message: error.message,
    });
  }
});
