import { ApplicationContext } from "@/src/entities/models/application-context";
import { eq } from "drizzle-orm";
import type { IHealthcareServicesRepository } from "@/src/application/repositories/healthcare-services.repository.interface";
import { healthcareServices as table } from "@/drizzle/schema";

type Dependencies = {
  cxt: ApplicationContext;
};

export const createHealthcareServicesRepository = ({
  cxt,
}: Dependencies): IHealthcareServicesRepository => {
  const db = cxt.getDbService().getDb();
  return {
    async getAllAtTenant() {
      return await db.query.healthcareServices.findMany({
        where: eq(table.tenantId, cxt.getNonEmptyTenantId()),
      });
    },

    async get(id: string) {
      return (
        (await db.query.healthcareServices.findFirst({
          where: eq(table.id, id),
        })) ?? null
      );
    },

    async create(record) {
      await db
        .insert(table)
        .values(cxt.getDbService().initMetadataAndTenant(record));
    },

    async update(record) {
      cxt.getDbService().updateMetadata(record);
      await db.update(table).set(record).where(eq(table.id, record.id));
    },

    async remove(id) {
      await db.delete(table).where(eq(table.id, id));
    },

    async searchByName(name: string) {
      const listings = await cxt
        .getHealthcareServicesRepository()
        .getAllAtTenant();
      const targetListing = listings.find(
        (listing) =>
          listing.name.toLowerCase() === name.toLowerCase() ||
          listing.oceanReference.toLowerCase() === name.toLowerCase()
      );
      return targetListing ?? null;
    },
  };
};
