import { z } from "zod";
import type { Attachment } from "@/src/entities/models/attachment";
import type {
  RoutingToolName,
  RoutingToolRegistry,
} from "../../infrastructure/services/routing-tools/routing-tool-registry";

export type Tool = {
  inputSchema: z.ZodSchema;
  execute: (args: any) => Promise<any>;
};
export type ToolSet = Record<string, Tool>;
export type ToolCall = {
  tool: string;
  input: z.infer<RoutingToolRegistry[RoutingToolName]["input"]>;
};

export interface IAiService {
  /**
   * Sends a prompt to the AI service and returns a parsed response according to the provided schema
   * @param prompt The prompt to send to the AI service
   * @param schema The Zod schema to validate and parse the response
   * @returns A promise that resolves to the parsed response object
   */
  getToolCalls(prompt: string, tools: ToolSet): Promise<ToolCall[]>;
  prompt(prompt: string, schema?: z.ZodSchema): Promise<object>;

  /**
   * Analyzes an attachment using AI and returns a summary
   * @param instructions Instructions for what to look for in the attachment
   * @param attachment The attachment to analyze
   * @returns A promise that resolves to a summary of the attachment
   */
  summarizeAttachments(
    instructions: string,
    attachments: Attachment[]
  ): Promise<string>;
}
