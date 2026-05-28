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
    return {
      toolCalls: response.toolCalls.map((toolCall) => ({
        tool: toolCall.toolName,
        input: toolCall.args as z.infer<
          RoutingToolRegistry[RoutingToolName]["input"]
        >,
      })),
      reasoning: response.text || undefined,
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
