import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";
import { updateRoutingRuleSchema } from "@/src/entities/models/routing-rule";
import { logPrivacyAuditEvent } from "@/server/utils/privacy-audit";
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const body = await readBody(event);
  if (!id) {
    throw createError({
      statusCode: 400,
      message: "Missing routing rule id",
    });
  }
  const cxt = await toApplicationContext(event);

  try {
    const existingRule = await cxt.getRoutingRulesRepository().get(id);
    const parsedBody = updateRoutingRuleSchema.parse({ ...body, id });
    await cxt.getRoutingRulesRepository().update(parsedBody);
    await logPrivacyAuditEvent(cxt, {
      eventType: "routing_rule_updated",
      subjectType: "routing_rule",
      subjectId: id,
      summary: `Updated routing rule "${parsedBody.name}".`,
      sensitiveData: {
        before: existingRule,
        after: parsedBody,
      },
    });
    return { success: true };
  } catch (error: any) {
    throw createError({
      statusCode: 400,
      message: error.message,

      data: error.errors,
    });
  }
});
