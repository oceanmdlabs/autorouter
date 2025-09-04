import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";
dotenv.config();
// console.info("** DB_URL: " + process.env.DB_URL);
export default defineConfig({
  dialect: "postgresql",
  schema: "./drizzle/schema.ts",
  dbCredentials: {
    url: process.env.DB_URL!,
  },
});
// https://orm.drizzle.team/kit-docs/quick
