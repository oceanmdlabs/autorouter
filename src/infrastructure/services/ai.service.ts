import { ApplicationContext } from "@/src/entities/models/application-context";
import { createCohere } from "@ai-sdk/cohere";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, generateText, type LanguageModel } from "ai";
import type { z } from "zod";
import type {
  IAiService,
  ToolCall,
  ToolSet,
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
        getDefaultModel(provider)) as LanguageModel,
    };
  }

  async function getAiModel() {
    const aiInfo = await getAiInfo();
    switch (aiInfo.provider) {
      case "openai":
        return createOpenAI({
          apiKey: aiInfo.apiKey,
        }).languageModel(aiInfo.model as OpenAIResponsesModelId);
      case "cohere":
        return createCohere({
          apiKey: aiInfo.apiKey,
        }).languageModel(aiInfo.model as CohereChatModelId);
      case "google":
        return createGoogleGenerativeAI({
          apiKey: aiInfo.apiKey,
        }).languageModel(aiInfo.model as GoogleGenerativeAIModelId);
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
      toolChoice: "required",
    });
    return response.toolCalls.map((toolCall) => {
      return {
        tool: toolCall.toolName,
        input: toolCall.input as z.infer<
          RoutingToolRegistry[RoutingToolName]["input"]
        >,
      };
    });
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
                  filename: attachment.title,
                } as Attachment)
            ),
          ],
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
    default:
      throw new InvalidArgumentsError(`Unsupported AI provider: ${provider}`);
  }
}
