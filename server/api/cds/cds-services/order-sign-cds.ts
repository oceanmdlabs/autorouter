import { orderSignCds } from "@/src/application/use-cases/order-sign-cds.use-case";
import type { CDSHookRequest } from "@/src/entities/models/cds-hooks";
import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";

export default defineEventHandler(async (event) => {
  const request = await readBody<CDSHookRequest>(event);
  const response = await orderSignCds({
    deps: { cxt: await toApplicationContext(event) },
    input: { request },
  });
  return response;
});
