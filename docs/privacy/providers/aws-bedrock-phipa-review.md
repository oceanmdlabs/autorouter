# Amazon Bedrock PHIPA Provider Review

**Reviewed:** 2026-09-11

**Proposed service:** Amazon Bedrock direct in-region inference in AWS Canada (Central), `ca-central-1`

**Status:** **Conditional candidate — not approved for production PHI.**

This is a product, engineering, and due-diligence assessment, not legal advice. Provider and third-party model terms change; re-check them for the exact account, region, model, and invocation API before approval.

## Executive Finding

Bedrock appears more contractually viable than Google Gemini for the proposed CDS use, but it is not automatically PHIPA compatible. AWS Service Terms say AI Services may support healthcare services, while also saying they are not medical devices and are not intended to be used **by themselves** for clinical decision-making or other clinical use. That supports an advisory, human-reviewed design, not autonomous triage or routing.

AWS's statements that prompts are not used to improve base models and are not shared with model providers do not establish zero retention. Bedrock now has explicit retention modes. Only `data_retention_mode: none` guarantees that AWS does not write request/response data to durable storage or share it with the model provider. `store=false` by itself is insufficient, and some models require up to 30-day AWS retention/human review.

Bedrock should remain disabled for PHI until the exact model supports all of the following simultaneously: direct in-region processing in `ca-central-1`, an effective retention mode of `none`, no provider/human review, approved third-party model terms, and acceptable measured clinical performance with human oversight.

## Contract Requirements

Before approval, retain evidence for all of the following:

- The exact OceanMD legal entity, AWS contracting party, enterprise organization/account owner, AWS Customer Agreement, Service Terms, Data Processing Addendum (DPA), and order/support terms.
- The clinic/HIC-to-OceanMD and OceanMD-to-AWS roles and obligations, including purpose limitation, confidentiality, security, deletion, incident notice and assistance, subprocessors, audit/assurance, government requests, support access, material changes, suspension, and termination.
- Legal/privacy confirmation that the precise advisory CDS workflow is consistent with the AWS healthcare-use term and that no model output is used by itself for a clinical decision.
- The exact third-party model terms/EULA and model-provider relationship. Bedrock documentation says providers do not receive prompts or completions in the assessed path, but AWS may share non-content usage information and model-specific terms still apply.
- No training, fine-tuning, secondary use, human review, or retained abuse-monitoring copy of PHI.
- Written confirmation of processing/storage locations for prompts, outputs, caches, abuse monitoring, support, metadata, and subprocessors.

AWS's Canada privacy and healthcare pages are useful due-diligence evidence but state that customers remain responsible for compliance. An AWS HIPAA BAA, if independently relevant, is not a substitute for the Ontario PHIPA role, contract, and PIA analysis.

## Required AWS Configuration

- Use a dedicated OceanMD-controlled AWS Organizations production account in the approved Canadian organizational unit. Use IAM roles/workload identity; do not use long-lived access keys or Bedrock API keys.
- Pin the Bedrock runtime endpoint to `ca-central-1` and an allowlisted direct model ID that is documented as **In-Region** there. Do not use geographic or global inference-profile IDs, application inference profiles that include other regions, or automatic cross-region fallback.
- Set account- and project-level Bedrock data retention to `none`; do not leave either level at `inherit` or `default`. Verify the model's current `allowed_modes` includes `none`. Invocation must fail closed if it does not.
- Enforce the allowed region, direct model ARN/ID, invocation actions, and absence of inference profiles with IAM and AWS Organizations service control policies. Alert on policy or model-access changes.
- Keep Bedrock model invocation logging disabled. Deny or tightly restrict `PutModelInvocationLoggingConfiguration`; continuously verify the setting in `ca-central-1`. Ordinary application logs must not contain prompts, completions, attachments, or model error bodies.
- Disable or prohibit prompt caching, Responses API storage/background mode, agents, knowledge bases/RAG, flows, prompt management storage, batch inference, model customization, evaluation jobs, and any feature not separately assessed.
- Use VPC endpoints/PrivateLink where supported, restrictive endpoint policies, private application networking, least-privilege security groups, and controlled egress.
- Use Canadian-region KMS keys for all application data, queues, logs, traces, secrets, temporary storage, backups, and dead-letter paths. Keep PHI out of ARNs, resource names, tags, request metadata, user-agent fields, and support cases.
- Separate development, test, and production accounts. Prevent production PHI from entering playgrounds, test events, evaluation datasets, or developer tooling.
- Record CloudTrail metadata needed to prove the invoked region and model without enabling prompt/response capture. Alert on cross-region invocation, unapproved models, retention-mode changes, logging enablement, or policy drift.

## Model Selection Gate

Model availability is dynamic and differs between direct, geographic, and global invocation. Do not approve a family name such as “Claude Haiku” or “Nova.” For the exact model ID and version, record:

- general availability and lifecycle dates;
- `ca-central-1` **In-Region** support using a direct model ID;
- effective retention mode and the model's `allowed_modes` response showing `none`;
- provider/model terms and whether any abuse review or human review is required;
- structured-output reliability, latency, capacity, quota, and safe failure behaviour;
- evaluation results against clinician-reviewed synthetic or privacy-approved cases.

If no suitable model meets every item, the correct decision is no Bedrock PHI processing—not a geographic/global profile or US-region fallback.

## Required Verification Evidence

- Executed agreement/DPA/order documents and the reviewed third-party model terms.
- Current AWS Artifact security and assurance reports plus the subprocessor review.
- Machine-readable evidence of account, region, direct model ID, retention mode, `allowed_modes`, IAM/SCPs, VPC endpoints, KMS, and invocation-logging configuration.
- Negative tests proving inference profiles, non-Canadian endpoints, unapproved models, retained modes, and disabled features are denied.
- Sanitized application logs demonstrating that prompts and completions are absent.
- Approved PIA, TRA, AI/clinical safety assessment, deployment record, incident response, and rollback procedure.

## Sources Reviewed

- [AWS Service Terms](https://aws.amazon.com/service-terms/)
- [AWS Data Processing Addendum](https://d1.awsstatic.com/legal/aws-dpa/aws-dpa.pdf)
- [Amazon Bedrock data retention](https://docs.aws.amazon.com/bedrock/latest/userguide/data-retention.html)
- [Amazon Bedrock data protection](https://docs.aws.amazon.com/bedrock/latest/userguide/data-protection.html)
- [Amazon Bedrock model regional availability](https://docs.aws.amazon.com/bedrock/latest/userguide/models-region-compatibility.html)
- [Amazon Bedrock cross-region inference](https://docs.aws.amazon.com/bedrock/latest/userguide/cross-region-inference.html)
- [Amazon Bedrock model invocation logging](https://docs.aws.amazon.com/bedrock/latest/userguide/model-invocation-logging.html)
- [AWS Canada data privacy](https://aws.amazon.com/compliance/canada-data-privacy/)
- [AWS healthcare compliance](https://aws.amazon.com/health/healthcare-compliance/)
- [AWS Shared Responsibility Model](https://aws.amazon.com/compliance/shared-responsibility-model/)
