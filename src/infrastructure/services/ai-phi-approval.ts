export const AI_PHI_DISABLED_MESSAGE =
  "AI processing is disabled because the deployment is not approved for PHI.";

type AiConfiguration = {
  provider: string;
  model: string;
};

type ApprovalEnvironment = Record<string, string | undefined>;

/**
 * Production PHI processing fails closed unless deployment evidence pins every
 * controlled AI setting. Bedrock is the only current conditional candidate;
 * the other configured providers do not have an approved provider review.
 */
export function assertAiPhiDeploymentApproved(
  configuration: AiConfiguration,
  env: ApprovalEnvironment = process.env
): void {
  const approved =
    env.AI_PHI_PROCESSING_ENABLED === "true" &&
    env.AI_PHI_DEPLOYMENT_APPROVAL_ID?.trim() &&
    env.AI_PHI_APPROVED_PROVIDER === "bedrock" &&
    configuration.provider === env.AI_PHI_APPROVED_PROVIDER &&
    env.AI_PHI_APPROVED_MODEL?.trim() &&
    configuration.model === env.AI_PHI_APPROVED_MODEL &&
    env.AI_PHI_APPROVED_REGION === "ca-central-1" &&
    (env.AWS_REGION ?? env.AWS_DEFAULT_REGION) === "ca-central-1" &&
    env.AI_PHI_RETENTION_MODE === "none";

  if (!approved) {
    throw new Error(AI_PHI_DISABLED_MESSAGE);
  }
}
