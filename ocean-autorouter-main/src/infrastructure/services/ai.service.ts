import { ApplicationContext } from "@/src/entities/models/application-context";
import { createCohere } from "@ai-sdk/cohere";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createVertex } from "@ai-sdk/google-vertex";
import { generateObject, generateText, type LanguageModel } from "ai";
import type { z } from "zod";
import type {
  IAiService,
  ToolCall,
  ToolSet
} from "@/src/application/services/ai.service.interface";
import { InvalidArgumentsError } from "@/src/entities/errors/common";
import type { Attachment } from "@/src/entities/models/attachment";
import type { RoutingToolRegistry } from "../services/routing-tools/routing-tool-registry";
import type { RoutingToolName } from "../services/routing-tools/routing-tool-registry";

type CohereChatModelId = "command-a-03-2025";

type OpenAIResponsesModelId = "gpt-5";

type GoogleGenerativeAIModelId = "gemini-2.5-flash";

type Dependencies = {
  cxt: ApplicationContext;
};

// https://sdk.vercel.ai/

export const createAiService = (deps: Dependencies): IAiService => {
  const { cxt } = deps;

  async function getAiInfo() {
    const siteConfig = await cxt
      .getSiteConfigurationRepository()
      .getForTenant();
    const provider = siteConfig?.aiProvider ?? "openai";
    return {
      provider,
      apiKey: siteConfig?.aiApiKey || "",
      model: (siteConfig?.aiModel ||
        getDefaultModel(provider)) as LanguageModel
    };
  }

  async function getAiModel() {
    const aiInfo = await getAiInfo();
    switch (aiInfo.provider) {
      case "openai":
        return createOpenAI({
          apiKey: aiInfo.apiKey
        }).languageModel(aiInfo.model as OpenAIResponsesModelId);
      case "cohere":
        return createCohere({
          apiKey: aiInfo.apiKey
        }).languageModel(aiInfo.model as CohereChatModelId);
      case "google":
        return createGoogleGenerativeAI({
          apiKey: aiInfo.apiKey
        }).languageModel(aiInfo.model as GoogleGenerativeAIModelId);
      case "vertex":
        return createVertex({
          project: process.env.GCP_PROJECT_ID,
          location: process.env.GCP_LOCATION,
          googleAuthOptions: {
            credentials: {
              client_email: process.env.GCP_CLIENT_EMAIL,
              private_key: process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, "\n")
            }
          }
        }).languageModel((process.env.GCP_DEFAULT_MODEL || "gemini-2.5-flash") as GoogleGenerativeAIModelId);
      default:
        throw new Error(`Unsupported AI provider: ${aiInfo.provider}`);
    }
  }

  async function getToolCalls<TOOLS extends ToolSet>(
    prompt: string,
    tools: TOOLS
  ): Promise<ToolCall[]> {
    const model = await getAiModel();

    const response = await generateText({
      model,
      prompt,
      tools,
      toolChoice: "auto"
    });

    return response.toolCalls.map((toolCall) => {
      return {
        tool: toolCall.toolName,
        input: toolCall.input as z.infer<
          RoutingToolRegistry[RoutingToolName]["input"]
        >
      };
    });
  }

  async function prompt(prompt: string, schema: z.ZodSchema): Promise<object> {
    const response = await generateObject({
      model: await getAiModel(),
      prompt,
      schema
    });
    return response.object;
  }

  async function promptForJson<T>(promptText: string, schema: z.ZodSchema<T>): Promise<T> {
    const model = await getAiModel();
    const response = await generateText({
      model,
      prompt: promptText
    });

    const jsonText = extractJsonFromResponse(response.text);

    // Parse the JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (e) {
      // Truncate response for error message to avoid leaking too much data
      const truncatedResponse = jsonText.length > 300
        ? jsonText.substring(0, 300) + "..."
        : jsonText;
      throw new Error(`Failed to parse LLM response as JSON: ${(e as Error).message}. Response preview: ${truncatedResponse}`);
    }

    // Validate against schema
    const result = schema.safeParse(parsed);
    if (!result.success) {
      // Format validation errors concisely
      const errorSummary = result.error.issues
        .slice(0, 5) // Limit to first 5 issues
        .map(issue => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      throw new Error(`LLM response failed schema validation: ${errorSummary}`);
    }

    return result.data;
  }

  /**
   * Extracts JSON from LLM response text, handling various formats:
   * - Pure JSON
   * - JSON wrapped in markdown code blocks
   * - JSON with leading/trailing prose
   */
  function extractJsonFromResponse(text: string): string {
    let jsonText = text.trim();

    // Pattern 1: Markdown code block (```json ... ``` or ``` ... ```)
    const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      return codeBlockMatch[1].trim();
    }

    // Pattern 2: Find JSON object by looking for first { and last }
    const firstBrace = jsonText.indexOf("{");
    const lastBrace = jsonText.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return jsonText.substring(firstBrace, lastBrace + 1);
    }

    // Pattern 3: Find JSON array by looking for first [ and last ]
    const firstBracket = jsonText.indexOf("[");
    const lastBracket = jsonText.lastIndexOf("]");
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      return jsonText.substring(firstBracket, lastBracket + 1);
    }

    // Fallback: return as-is and let JSON.parse fail with clear error
    return jsonText;
  }

  async function summarizeAttachments(
    instructions: string,
    attachments: Attachment[]
  ): Promise<string> {
    const model = await getAiModel();
    type Attachment = {
      type: "file";
      mediaType: string;
      data: Buffer<ArrayBufferLike>;
      filename: string;
    };
    const result = await generateText({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: instructions },
            ...attachments.map(
              (attachment) =>
                ({
                  type: "file",
                  mediaType: attachment.contentType,
                  data: attachment.data,
                  filename: attachment.title
                } as Attachment)
            )
          ]
        }
      ]
    });

    return result.text;
  }

  return {
    getToolCalls,
    prompt,
    promptForJson,
    summarizeAttachments
  };
};

function getDefaultModel(provider: string): string | null | undefined {
  switch (provider) {
    case "openai":
      return "gpt-4.1-mini";
    case "cohere":
      return "command-a";
    case "google":
      return "gemini-2.5-flash";
    case "vertex":
      return process.env.GCP_DEFAULT_MODEL || "gemini-2.5-flash";
    default:
      throw new InvalidArgumentsError(`Unsupported AI provider: ${provider}`);
  }
}
