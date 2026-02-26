import { cdsServices } from "@/src/application/use-cases/cds-services.use-case";
import type { CDSServiceDiscovery } from "@/src/entities/models/cds-hooks";
import { toApplicationContext } from "@/src/infrastructure/adapters/h3.adapter";

export default defineEventHandler(async (event) => {
  const response: CDSServiceDiscovery = await cdsServices({
    deps: { cxt: await toApplicationContext(event) },
  });
  return response;
});
