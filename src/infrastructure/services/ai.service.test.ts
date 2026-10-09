import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { ApplicationContext } from "@/src/entities/models/application-context";
import { createAiService } from "./ai.service";
import { AI_PHI_DISABLED_MESSAGE } from "./ai-phi-approval";

const model = "anthropic.claude-3-haiku-20240307-v1:0";
const credentials = vi.hoisted(() =>
  vi.fn(async () => ({
    accessKeyId: "SYNTHETIC_ACCESS_KEY",
    secretAccessKey: "synthetic-secret-for-offline-tests",
    sessionToken: "synthetic-session",
  })),
);

vi.mock("@aws-sdk/credential-providers", () => ({
  fromNodeProviderChain: () => credentials,
}));

function response(content: object[], stopReason = "end_turn") {
  return new Response(
    JSON.stringify({
      output: { message: { role: "assistant", content } },
      stopReason,
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      metrics: { latencyMs: 1 },
    }),
    { headers: { "content-type": "application/json" } },
  );
}

describe("AI SDK security upgrade", () => {
  let requests: Array<{ url: string; headers: Headers; body: any }>;
  let fetchMock: ReturnType<typeof vi.fn>;
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const service = createAiService({
    cxt: {
      logger,
      getSiteConfigurationRepository: () => ({
        getForTenant: async () => ({ aiProvider: "bedrock", aiModel: model }),
      }),
    } as unknown as ApplicationContext,
  });

  beforeEach(() => {
    requests = [];
    vi.clearAllMocks();
    for (const [name, value] of Object.entries({
      AI_PHI_PROCESSING_ENABLED: "true",
      AI_PHI_DEPLOYMENT_APPROVAL_ID: "synthetic-offline-test",
      AI_PHI_APPROVED_PROVIDER: "bedrock",
      AI_PHI_APPROVED_MODEL: model,
      AI_PHI_APPROVED_REGION: "ca-central-1",
      AI_PHI_RETENTION_MODE: "none",
      AWS_REGION: "ca-central-1",
      BEDROCK_GUARDRAIL_IDENTIFIER: "synthetic-guardrail",
      BEDROCK_GUARDRAIL_VERSION: "1",
      AWS_BEARER_TOKEN_BEDROCK: "must-not-replace-role-credentials",
      AWS_BEDROCK_BASE_URL: "https://unapproved.example.com",
    }))
      vi.stubEnv(name, value);

    fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      requests.push({
        url: String(url),
        headers: new Headers(init.headers),
        body: JSON.parse(String(init.body)),
      });
      return response([{ text: "Synthetic response" }]);
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function expectGuardedRequests(count: number) {
    expect(requests).toHaveLength(count);
    for (const request of requests) {
      expect(request.url).toBe(
        `https://bedrock-runtime.ca-central-1.amazonaws.com/model/${encodeURIComponent(model)}/converse`,
      );
      expect(request.body.guardrailConfig).toEqual({
        guardrailIdentifier: "synthetic-guardrail",
        guardrailVersion: "1",
      });
      expect(request.headers.get("authorization")).toContain(
        "AWS4-HMAC-SHA256",
      );
      expect(request.headers.get("authorization")).toContain(
        "/ca-central-1/bedrock/aws4_request",
      );
      expect(request.headers.get("x-amz-security-token")).toBe(
        "synthetic-session",
      );
    }
  }

  it("fails closed before any credentials or network access without PHI approval", async () => {
    vi.stubEnv("AI_PHI_PROCESSING_ENABLED", "false");
    await expect(service.getToolCalls("Synthetic prompt", {})).rejects.toThrow(
      AI_PHI_DISABLED_MESSAGE,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(credentials).not.toHaveBeenCalled();
  });

  it.each(["", "DRAFT", "0"])(
    "rejects an unpinned guardrail version %s before network access",
    async (version) => {
      vi.stubEnv("BEDROCK_GUARDRAIL_VERSION", version);
      await expect(
        service.getToolCalls("Synthetic prompt", {}),
      ).rejects.toThrow("version-pinned guardrail");
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("keeps Canadian SigV4 authentication and guardrails despite conflicting SDK environment defaults", async () => {
    expect(await service.getToolCalls("Synthetic prompt", {})).toEqual({
      toolCalls: [],
      reasoning: "Synthetic response",
    });
    expectGuardedRequests(1);
    expect(logger.info).not.toHaveBeenCalled();
  });

  it("collects tool inputs from every step without executing routing actions", async () => {
    const execute = vi.fn();
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      requests.push({
        url: String(url),
        headers: new Headers(init.headers),
        body: JSON.parse(String(init.body)),
      });
      return requests.length <= 2
        ? response(
            [
              {
                toolUse: {
                  toolUseId: `call-${requests.length}`,
                  name: "comment",
                  input: { comment: `Synthetic ${requests.length}` },
                },
              },
            ],
            "tool_use",
          )
        : response([{ text: "Synthetic reasoning" }]);
    });
    const result = await service.getToolCalls("Synthetic prompt", {
      comment: { inputSchema: z.object({ comment: z.string() }), execute },
    });
    expect(result.toolCalls).toEqual([
      { tool: "comment", input: { comment: "Synthetic 1" } },
      { tool: "comment", input: { comment: "Synthetic 2" } },
    ]);
    expect(result.reasoning).toBe("Synthetic reasoning");
    expect(execute).not.toHaveBeenCalled();
    expectGuardedRequests(3);
  });

  it("stops tool generation after ten steps", async () => {
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      requests.push({
        url: String(url),
        headers: new Headers(init.headers),
        body: JSON.parse(String(init.body)),
      });
      return response(
        [
          {
            toolUse: {
              toolUseId: `call-${requests.length}`,
              name: "comment",
              input: { comment: "Synthetic" },
            },
          },
        ],
        "tool_use",
      );
    });
    const result = await service.getToolCalls("Synthetic prompt", {
      comment: {
        inputSchema: z.object({ comment: z.string() }),
        execute: vi.fn(),
      },
    });
    expect(result.toolCalls).toHaveLength(10);
    expectGuardedRequests(10);
  });

  it("validates structured output through the upgraded SDK", async () => {
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      requests.push({
        url: String(url),
        headers: new Headers(init.headers),
        body: JSON.parse(String(init.body)),
      });
      return response(
        [
          {
            toolUse: {
              toolUseId: "json-result",
              name: "json",
              input: { accepted: true },
            },
          },
        ],
        "tool_use",
      );
    });
    expect(
      await service.prompt(
        "Synthetic prompt",
        z.object({ accepted: z.boolean() }),
      ),
    ).toEqual({ accepted: true });
    expectGuardedRequests(1);
  });

  it("preserves PDF and image parts with guardrails when summarizing attachments", async () => {
    expect(
      await service.summarizeAttachments("Synthetic instructions", [
        {
          title: "synthetic.pdf",
          contentType: "application/pdf",
          data: Buffer.from("%PDF-synthetic"),
        },
        {
          title: "synthetic.png",
          contentType: "image/png",
          data: Buffer.from("synthetic-image"),
        },
      ]),
    ).toBe("Synthetic response");
    expectGuardedRequests(1);
    const content = requests[0].body.messages[0].content;
    expect(content.some((part: any) => part.document?.format === "pdf")).toBe(
      true,
    );
    expect(content.some((part: any) => part.image?.format === "png")).toBe(
      true,
    );
  });
});
