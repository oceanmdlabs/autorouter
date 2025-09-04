import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";

export default defineEventHandler(async (event) => {
  // must be called with useRequestFetch to have the headers -> https://nuxt.com/modules/auth-utils
  const cxt = await toApplicationContext(event);
  const rules = await cxt.getRoutingRulesRepository().getAllAtTenant();
  return rules;
});
