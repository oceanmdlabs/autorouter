import { isDatabaseResumingError, withDatabaseResumeRetry } from "@/server/utils/auth-flow-errors";
import { createDbClient } from "@/src/infrastructure/services/db/create-db-client";
import { sql } from "drizzle-orm";

export default defineEventHandler(async () => {
  try {
    await withDatabaseResumeRetry(
      async () => {
        const db = createDbClient();
        await db.execute(sql`select 1`);
      },
      {
        maxAttempts: 5,
        delayMs: 2000,
      }
    );

    return {
      ready: true,
    };
  } catch (error) {
    if (isDatabaseResumingError(error)) {
      return {
        ready: false,
        status: "resuming",
        retryAfterSeconds: 5,
      };
    }

    throw error;
  }
});
