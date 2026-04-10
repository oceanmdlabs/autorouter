import type { ApplicationContext } from "@/src/entities/models/application-context";
import { eq } from "drizzle-orm";
import type { IHealthcareServicesRepository } from "@/src/application/repositories/healthcare-services.repository.interface";
import { healthcareServices as table } from "@/drizzle/schema";

type Dependencies = {
  cxt: ApplicationContext;
};

export const createHealthcareServicesRepository = ({
  cxt,
}: Dependencies): IHealthcareServicesRepository => {
  const dbService = cxt.getDbService();
  return {
    async getAllAtTenant() {
      return await dbService.findMany(table);
    },

    async get(id: string) {
      return await dbService.findFirst(table, {
        where: eq(table.id, id),
      });
    },

    async create(record) {
      await dbService.insert(table, dbService.initMetadataAndTenant(record));
    },

    async update(record) {
      dbService.updateMetadata(record);
      await dbService.update(table, record, eq(table.id, record.id));
    },

    async remove(id) {
      await dbService.delete(table, eq(table.id, id));
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
