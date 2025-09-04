import { createAiService } from "../infrastructure/services/ai.service";
import { z } from "zod";
import dotenv from "dotenv";
import { ApplicationContext } from "@/src/entities/models/application-context";

const logger = {
  info: console.info,
  error: console.error,
  warn: console.warn,
  debug: console.debug,
  log: console.log,
};

async function main() {
  dotenv.config();
  const context = new ApplicationContext(logger);
  const aiService = createAiService({
    cxt: context,
  });

  // Define a simple schema for testing
  const personSchema = z.object({
    name: z.string(),
    age: z.number(),
    occupation: z.string(),
  });

  try {
    console.log("Testing OpenAI AI Service...");
    const result = await aiService.prompt(
      "Generate details for a fictional person who works in technology",
      personSchema
    );
    console.log("Result:", result);
  } catch (error) {
    console.error("Error:", error);
  }
}

// Run the test
main();
