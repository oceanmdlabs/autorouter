import * as schema from "@/drizzle/schema";
import { AppInitializationError } from "@/src/entities/errors/common";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

const { Pool } = pg;

export const createPgDb = () => {
  const dbUrl = process.env.DB_URL;
  if (!dbUrl) {
    throw new AppInitializationError("Missing DB_URL");
  }

  const pool = new Pool({
    connectionString: dbUrl,
  });

  return drizzle(pool, { schema });
};
