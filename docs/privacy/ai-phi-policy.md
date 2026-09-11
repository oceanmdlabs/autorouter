# AI and Personal Health Information Policy

**Policy owner:** OceanMD privacy, security, and clinical governance

**Last reviewed:** 2026-09-11

**Status:** Required project policy; production AI processing of PHI is disabled until the approval gates below are complete.

This policy governs every Ocean Autorouter feature that may disclose personal health information (PHI) to an artificial intelligence service. It applies to prompts, model inputs and outputs, attachments, tool calls, caches, logs, traces, evaluations, support material, and derived data.

This is an engineering and governance policy, not legal advice. The responsible health information custodian (HIC), privacy officer, legal counsel, security owner, and clinical owner must approve the actual deployment.

## Decision

The CDS Hooks architecture is a reasonable technical direction, but detailed PHI-enabled solutioning must not proceed until the provider and deployment have passed the gates in this policy. Work may continue with deterministic rules and synthetic data.

No provider, product, compliance page, certification, or Canadian region is inherently “PHIPA compliant.” PHIPA compatibility is a property of the complete arrangement: authority and purpose, contracts, configuration, data flows, safeguards, human oversight, operations, and the HIC's documented decision.

## Non-Negotiable Rules

- Use synthetic or privacy-approved de-identified data until the production approval record is complete.
- Keep structured, deterministic decisions in code. Use an LLM only when semantic interpretation of unstructured text is necessary.
- Send the minimum necessary fields for one bounded task. Do not send full referral payloads or attachments by convenience.
- Do not log or trace prompts, completions, referral text, form answers, attachments, or model error bodies that may reproduce them.
- Do not use customer data for model training, fine-tuning, product improvement, human review, or evaluation unless separately authorized in writing and approved.
- Require a provider/model retention posture of zero durable prompt and response retention for production PHI, unless a documented exception is approved by privacy, legal, and the HIC.
- Keep PHI processing, storage, backups, keys, and operational logs in approved Canadian locations. Fail closed rather than fall back to an unapproved region, model, provider, or consumer API.
- Disable grounding, web search, maps, agents, RAG, prompt/session storage, explicit caches, batch jobs, and other data-expanding features unless each feature is separately assessed and approved.
- Treat model, model version, provider, endpoint, region, routing profile, retention mode, logging, grounding, and subprocessors as controlled configuration. A change is a new review trigger.
- LLM-derived clinical or routing recommendations are advisory by default. A qualified human remains responsible for the decision. Only deterministic rules based on reliable structured facts may create a hard stop unless clinical governance explicitly approves otherwise.
- Provide tenant-level enablement, an immediate kill switch, auditable configuration changes, bounded timeouts, and a safe failure path that does not delay care.

## Production Approval Gates

All gates require recorded evidence; an unchecked gate means PHI processing remains off.

### 1. Purpose, authority, and roles

- Define the exact administrative or clinical purpose and why AI is necessary and proportionate.
- Identify the HIC and document whether OceanMD and each provider act as agents, electronic service providers, subprocessors, or another legal role.
- Confirm the authority for collection, use, and disclosure, including any notice or consent requirements.
- Define the minimum necessary input and output data and exclude direct identifiers that are not required.

### 2. Contract and vendor due diligence

- Confirm the proposed use is permitted by the provider's current service-specific terms, acceptable-use policy, model terms, and any third-party model terms.
- Put an enforceable customer-to-OceanMD and OceanMD-to-provider contract chain in place.
- Ensure the applicable data processing addendum covers PHI processing and documents confidentiality, security, permitted purposes, deletion, incident notification and assistance, subprocessors, audit/assurance evidence, support access, termination, and material changes.
- Prohibit secondary use, training, human review, and disclosure except as explicitly approved.
- Record the governing contracting entity, account ownership, order form, support arrangement, and any reseller implications.
- Do not treat a PHIPA, HIPAA, ISO, SOC, or residency marketing page as contractual approval.

### 3. Provider, model, and location

- Approve an exact generally available model ID and version, not a model family or alias.
- Verify the model supports direct processing in the approved Canadian region and that the chosen consumption mode does not silently route elsewhere.
- Confirm where prompts, outputs, abuse-monitoring copies, caches, metadata, support data, and subprocessors are processed and stored.
- Block global, multi-region, geographic cross-region, and automatic fallback paths unless the approved data-flow record expressly permits them.
- Confirm the provider/model can meet the required retention mode and that incompatible models fail closed.

### 4. Privacy, security, and clinical assessments

- Complete and approve a PIA, threat risk assessment (TRA), and AI/algorithmic impact assessment appropriate to the use.
- Document threat modelling, tenant isolation, least privilege, private connectivity, encryption, key location, secrets, monitoring, incident response, retention, and secure disposal.
- Validate clinical safety, accuracy, bias, false-positive/false-negative risks, escalation paths, downtime behaviour, and the effect of a misroute or delay.
- Define who reviews model output and ensure the UI clearly distinguishes a recommendation from a fact or final decision.

### 5. Implementation evidence

- Use enterprise workload identity or an application role; do not use personal accounts or long-lived static API/access keys.
- Enforce the approved project/account, provider, model, region, retention mode, and feature set in code and infrastructure policy.
- Verify prompt/response logging is off and application observability contains only an opaque event reference, tenant/rule/model identifiers, timings, status, and sanitized error codes.
- Test data minimization, schema validation, prompt injection handling, timeouts, failure behaviour, kill switches, and non-PHI auditability.
- Run synthetic and privacy-approved evaluation cases before any live PHI, then use a controlled shadow phase before clinical influence.

### 6. Approval and operations

- Obtain recorded approval from privacy, legal, security, product, clinical governance, and the accountable customer/HIC.
- Publish a deployment configuration record and go-live/rollback runbook.
- Monitor provider terms, model availability, retention behaviour, subprocessors, security advisories, and model quality.
- Re-review at least annually and whenever a controlled configuration item or data flow changes.

## Current Provider Status

| Provider                      | Status for production PHI                          | Reason                                                                                                                                                                                                                                                                                                        |
| ----------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google Gemini on Google Cloud | **Blocked pending written contractual resolution** | Current Google Cloud service-specific terms prohibit use of Generative AI Services for clinical purposes. Referral appropriateness, urgency, and routing CDS may fall within that restriction. See [Google Gemini PHIPA review](providers/google-gemini-phipa-review.md).                                     |
| Amazon Bedrock                | **Conditional candidate; not approved**            | AWS permits support for healthcare services but says AI Services are not intended to be used by themselves for clinical decision-making. The exact model must support direct Canadian in-region inference and enforced zero retention. See [AWS Bedrock PHIPA review](providers/aws-bedrock-phipa-review.md). |

## Related Documents

- [CDS Hooks AI/PHI architecture plan](cds-hooks-ai-phi-plan.md)
- [Privacy considerations](privacy-considerations.md)
- [Privacy impact assessment templates](privacy-impact-assessment-templates.md)
- [Ontario PHIPA](https://www.ontario.ca/laws/statute/04p03)
- [Ontario IPC guidance for AI scribes in the health sector](https://www.ipc.on.ca/en/media/6177/download), whose accountability, assessment, contract, safeguards, transparency, and human-review principles are also useful for other health AI uses.
