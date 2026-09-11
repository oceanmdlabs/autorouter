# Privacy Considerations

Ocean Autorouter is an Ocean Labs innovation project for AI-assisted eReferral and eConsult routing. It can process clinical referral content and, depending on tenant and rule configuration, may send referral information to an AI provider.

This document is implementation guidance for project maintainers and configuring organizations. It is not legal advice.

The [AI and Personal Health Information Policy](ai-phi-policy.md) is the controlling project policy for any AI feature that may process PHI. Production PHI processing remains disabled until its contract, provider/model, privacy, security, clinical-safety, implementation, and approval gates have recorded evidence. Deterministic development and synthetic-data evaluation may continue while those gates are open.

## Default Demo Posture

Hosted demo and proof-of-concept environments should use synthetic or non-PHI data unless there has been an explicit privacy and product review for real patient data.

Demo rules that summarize or analyze referral attachments should be treated as higher-risk examples. They should not be assumed to be suitable for live clinical use without additional review.

## PHI and AI Processing

If a real referral workflow is connected to the Autorouter, some PHI exposure to the configured AI provider may be inherent to the feature. The application can reduce obvious identifiers from structured referral fields, but it cannot guarantee that all clinical free text, referral form answers, or uploaded documents are de-identified.

Before using the Autorouter with real patient data, the organization must complete the AI/PHI policy gates and document:

- intended use case and clinical/administrative benefit;
- AI provider and model choice;
- hosting location and data residency;
- data minimization, especially whether patient identifiers are stored or only processed transiently;
- contractual and vendor obligations;
- retention, logging, and audit behavior;
- patient transparency and opt-out approach, where appropriate;
- whether a Privacy Impact Assessment or equivalent review is needed.

Use [privacy-impact-assessment-templates.md](privacy-impact-assessment-templates.md) as the starting point for PHIPA, PIPEDA, and province-specific PIA reviews.

The health information custodian or responsible organization should decide whether the use fits its privacy posture. Project maintainers should make sure the software does not silently enable higher-risk AI behavior just because code has been deployed.

## Data Retention and PHI Minimization

The default Autorouter posture should avoid storing patient identifiers and clinical content unless storage is required for a specific approved workflow. In particular, health card number, health number, MRN, date of birth, contact details, and full referral payloads should not be stored by default for AI routing or safety-monitoring workflows. Prefer storing tenant ID, rule ID, model ID, timestamps, action outcome, and Ocean referral or event references that let authorized users return to Ocean as the system of record.

The eRequests module is a higher-retention pathway because it can archive referral payloads and related blobs. It must remain explicitly opt-in and should be enabled only after a tenant-specific review of purpose, minimum necessary fields, retention period, disposal process, access controls, and storage encryption.

Postal-code based routing should use the minimum location detail required for the rule. The preferred pattern is to expose only the first three characters of the postal code, such as `M2L`, and only when the tenant has authorized postal-code prefix use for a specific workflow such as catchment routing or central intake assignment.

For AWS-hosted deployments, encryption at rest should be treated as a required control and verified during go-live. Amazon Aurora encrypts new clusters at rest by default for clusters created on or after February 18, 2026, but the deployment should still record the database type, encryption status, KMS key type, key region, backups, snapshots, replicas, and log storage controls.

## Attachment Summarization

Attachment summarization is a higher-risk feature because referral attachments can contain PHI in places that are difficult or impractical to redact reliably, including:

- standardized EMR headers and footers;
- scanned pages;
- embedded metadata;
- free text clinical notes;
- copied reports and forms.

The Autorouter should not represent attachment analysis as de-identified processing. If attachment contents are summarized by AI, the configuring organization should assume that PHI may be sent to the configured AI provider.

Implementation expectations:

- attachment fetching should require explicit server-side opt-in;
- attachment binaries should be sent to the AI provider only when an enabled attachment-analysis action actually runs;
- users should receive a clear warning before enabling attachment summarization;
- the warning should state that PHI in attachments cannot be effectively or reliably redacted before AI processing.

Related tracking issues:

- [Build reusable PIA templates for PHIPA and PIPEDA deployments](https://github.com/oceanmdlabs/autorouter/issues/30)
- [Enforce explicit opt-in before fetching or sending referral attachments to AI](https://github.com/oceanmdlabs/autorouter/issues/24)
- [Warn users when enabling attachment summarization that PHI cannot be reliably redacted](https://github.com/oceanmdlabs/autorouter/issues/23)

## AI Hosting Preference

When practical, organizations should prefer AI hosting options that reduce privacy and residency risk:

1. locally hosted models controlled by the organization;
2. Canadian providers;
3. Canadian-hosted models from broader cloud or AI providers;
4. other external models only after the organization accepts the privacy, contractual, and operational tradeoffs.

The Autorouter supports tenant-level AI configuration so organizations can choose the provider/model that fits their requirements.

## PHIPA and PIPEDA Framing

Current project understanding is that PHIPA and PIPEDA do not impose a blanket prohibition on AI processing or out-of-Canada processing. They do require accountability, appropriate safeguards, contractual controls, and transparency.

Any production use should be reviewed against the organization's own privacy, legal, procurement, and clinical governance requirements.
