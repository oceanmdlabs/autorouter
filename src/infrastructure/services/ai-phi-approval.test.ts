import { describe, expect, it } from "vitest";
import {
  AI_PHI_DISABLED_MESSAGE,
  assertAiPhiDeploymentApproved,
} from "./ai-phi-approval";

const approvedEnvironment = {
  AI_PHI_PROCESSING_ENABLED: "true",
  AI_PHI_DEPLOYMENT_APPROVAL_ID: "approval-2026-09-16",
  AI_PHI_APPROVED_PROVIDER: "bedrock",
  AI_PHI_APPROVED_MODEL: "anthropic.approved-model-v1:0",
  AI_PHI_APPROVED_REGION: "ca-central-1",
  AI_PHI_RETENTION_MODE: "none",
  AWS_REGION: "ca-central-1",
};

describe("assertAiPhiDeploymentApproved", () => {
  it("fails closed when approval configuration is absent", () => {
    expect(() =>
      assertAiPhiDeploymentApproved(
        { provider: "bedrock", model: "anthropic.approved-model-v1:0" },
        {}
      )
    ).toThrow(AI_PHI_DISABLED_MESSAGE);
  });

  it("rejects providers without a current PHI provider review", () => {
    expect(() =>
      assertAiPhiDeploymentApproved(
        { provider: "google", model: "gemini" },
        {
          ...approvedEnvironment,
          AI_PHI_APPROVED_PROVIDER: "google",
          AI_PHI_APPROVED_MODEL: "gemini",
        }
      )
    ).toThrow(AI_PHI_DISABLED_MESSAGE);
  });

  it("rejects model, region, and retention drift", () => {
    expect(() =>
      assertAiPhiDeploymentApproved(
        { provider: "bedrock", model: "different-model" },
        approvedEnvironment
      )
    ).toThrow(AI_PHI_DISABLED_MESSAGE);

    expect(() =>
      assertAiPhiDeploymentApproved(
        { provider: "bedrock", model: "anthropic.approved-model-v1:0" },
        { ...approvedEnvironment, AWS_REGION: "us-east-1" }
      )
    ).toThrow(AI_PHI_DISABLED_MESSAGE);

    expect(() =>
      assertAiPhiDeploymentApproved(
        { provider: "bedrock", model: "anthropic.approved-model-v1:0" },
        { ...approvedEnvironment, AI_PHI_RETENTION_MODE: "default" }
      )
    ).toThrow(AI_PHI_DISABLED_MESSAGE);
  });

  it("allows only the exact approved Bedrock deployment", () => {
    expect(() =>
      assertAiPhiDeploymentApproved(
        { provider: "bedrock", model: "anthropic.approved-model-v1:0" },
        approvedEnvironment
      )
    ).not.toThrow();
  });
});
