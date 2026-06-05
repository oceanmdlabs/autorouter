import { ApplicationContext } from "@/src/entities/models/application-context";
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { createCohere } from "@ai-sdk/cohere";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, generateText, tool, type LanguageModel } from "ai";
import type { z } from "zod";
import type {
  IAiService,
  ToolCall,
  ToolCallResult,
  ToolSet,
} from "@/src/application/services/ai.service.interface";
import { InvalidArgumentsError } from "@/src/entities/errors/common";
import type { Attachment } from "@/src/entities/models/attachment";
import type { RoutingToolRegistry } from "../services/routing-tools/routing-tool-registry";
import type { RoutingToolName } from "../services/routing-tools/routing-tool-registry";

type BedrockModelId =
  | "mistral.mistral-large-2402-v1:0"
  | "anthropic.claude-3-haiku-20240307-v1:0"
  | "anthropic.claude-3-sonnet-20240229-v1:0";

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
      model: (siteConfig?.aiModel || getDefaultModel(provider)) as string,
    };
  }

  async function getAiModel() {
    const aiInfo = await getAiInfo();
    switch (aiInfo.provider) {
      case "openai":
        return createOpenAI({
          apiKey: aiInfo.apiKey,
        }).languageModel(aiInfo.model as unknown as OpenAIResponsesModelId);
      case "cohere":
        return createCohere({
          apiKey: aiInfo.apiKey,
        }).languageModel(aiInfo.model as unknown as CohereChatModelId);
      case "google":
        return createGoogleGenerativeAI({
          apiKey: aiInfo.apiKey,
        }).languageModel(aiInfo.model as unknown as GoogleGenerativeAIModelId);
      case "bedrock":
        return createAmazonBedrock({
          region: "ca-central-1",
          bedrockOptions: { region: "ca-central-1", credentials: fromNodeProviderChain() },
        }).languageModel(aiInfo.model as unknown as BedrockModelId) as unknown as LanguageModel;
      default:
        throw new Error(`Unsupported AI provider: ${aiInfo.provider}`);
    }
  }

  async function getToolCalls<TOOLS extends ToolSet>(
    prompt: string,
    tools: TOOLS
  ): Promise<ToolCallResult> {
    const model = await getAiModel();

    const sdkTools = Object.fromEntries(
      Object.entries(tools).map(([name, t]) => [
        name,
        tool({ parameters: t.inputSchema, execute: t.execute }),
      ])
    );

    const response = await generateText({
      model,
      prompt,
      tools: sdkTools,
      toolChoice: "auto",
    });
    cxt.logger.info("AI raw response", {
      toolCallCount: response.toolCalls.length,
      toolCalls: response.toolCalls.map((tc) => ({ name: tc.toolName, args: tc.args })),
      textLength: response.text?.length ?? 0,
      text: response.text?.slice(0, 500),
    });

    // Some models (e.g. Mistral on Bedrock) write multiple tool calls as JSON text
    // rather than returning them as structured tool calls. Parse them as a fallback.
    const structuredToolCalls: ToolCall[] = response.toolCalls.length > 0
      ? response.toolCalls.map((toolCall) => ({
          tool: toolCall.toolName,
          input: toolCall.args as z.infer<RoutingToolRegistry[RoutingToolName]["input"]>,
        }))
      : parseTextToolCalls(response.text ?? "", Object.keys(tools)) as ToolCall[];

    if (response.toolCalls.length === 0 && structuredToolCalls.length > 0) {
      cxt.logger.info("Parsed tool calls from text response", {
        toolCalls: structuredToolCalls.map((tc) => tc.tool),
      });
    }

    const reasoning = extractReasoning(response.text ?? "", structuredToolCalls.length > 0 && response.toolCalls.length === 0);

    return {
      toolCalls: structuredToolCalls,
      reasoning: reasoning || undefined,
    };
  }

  async function prompt(prompt: string, schema: z.ZodSchema): Promise<object> {
    const response = await generateObject({
      model: await getAiModel(),
      prompt,
      schema,
    });
    return response.object;
  }

  async function summarizeAttachments(
    instructions: string,
    attachments: Attachment[]
  ): Promise<string> {
    const model = await getAiModel();
    const result = await generateText({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: instructions },
            ...attachments.map((attachment) => ({
              type: "file" as const,
              mimeType: attachment.contentType,
              data: attachment.data,
            })),
          ] as any,
        },
      ],
    });

    return result.text;
  }

  return {
    getToolCalls,
    prompt,
    summarizeAttachments,
  };
};

// Parses tool calls written as JSON text by models that don't support structured
// tool calling for multiple simultaneous calls (e.g. Mistral on Bedrock).
// Format: [{"name": "toolName", "arguments": {...}}] — one per line.
function parseTextToolCalls(
  text: string,
  availableTools: string[]
): Array<{ tool: string; input: Record<string, unknown> }> {
  const results: Array<{ tool: string; input: Record<string, unknown> }> = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("[{")) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (!Array.isArray(parsed)) continue;
      for (const item of parsed) {
        if (
          typeof item.name === "string" &&
          item.arguments !== null &&
          typeof item.arguments === "object" &&
          availableTools.includes(item.name)
        ) {
          results.push({ tool: item.name, input: item.arguments });
        }
      }
    } catch {}
  }
  return results;
}

// When tool calls are parsed from text, strip the JSON lines from the reasoning
// so only the human-readable explanation is shown.
function extractReasoning(text: string, toolCallsFromText: boolean): string {
  if (!toolCallsFromText) return text;
  return text
    .split("\n")
    .filter((line) => !line.trim().startsWith("[{"))
    .join("\n")
    .trim();
}

function getDefaultModel(provider: string): string | null | undefined {
  switch (provider) {
    case "openai":
      return "gpt-4.1-mini";
    case "cohere":
      return "command-a";
    case "google":
      return "gemini-2.5-flash-preview-05-20";
    case "bedrock":
      return "anthropic.claude-3-sonnet-20240229-v1:0";
    default:
      throw new InvalidArgumentsError(`Unsupported AI provider: ${provider}`);
  }
}
