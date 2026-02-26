import { AppInitializationError } from "@/src/entities/errors/common";
import { createAwsDataApiDb } from "./create-aws-data-api-db";
import { createPgDb } from "./create-pg-db";

export const createDbClient = () => {
  const dbDriver = process.env.DB_DRIVER ?? "pg";

  if (dbDriver === "aws-data-api-pg") {
    return createAwsDataApiDb();
  }

  if (dbDriver === "pg") {
    return createPgDb();
  }

  throw new AppInitializationError(`Unsupported DB_DRIVER: ${dbDriver}`);
};
