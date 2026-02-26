import * as schema from "@/drizzle/schema";
import { AppInitializationError } from "@/src/entities/errors/common";
import { drizzle } from "drizzle-orm/aws-data-api/pg";
import { RDSDataClient } from "@aws-sdk/client-rds-data";

export const createAwsDataApiDb = () => {
  const dbName = process.env.DB_NAME;
  const resourceArn = process.env.DB_RESOURCE_ARN;
  const secretArn = process.env.DB_SECRET_ARN;
  const region = process.env.AWS_REGION;

  if (!dbName || !resourceArn || !secretArn || !region) {
    throw new AppInitializationError(
      "Missing DB_NAME, DB_RESOURCE_ARN, DB_SECRET_ARN, or AWS_REGION for aws-data-api-pg"
    );
  }

  const dataClient = new RDSDataClient({ region });
  return drizzle(dataClient, {
    database: dbName,
    resourceArn,
    secretArn,
    schema,
  });
};
