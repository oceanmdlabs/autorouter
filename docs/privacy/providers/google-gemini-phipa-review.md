# Google Gemini PHIPA Provider Review

**Reviewed:** 2026-09-11

**Proposed service:** Google Gemini 3.5 Flash through Google Cloud's enterprise Agent Platform/Vertex service

**Status:** **STOP — do not send production PHI unless the contractual blocker is resolved in writing and every project gate is approved.**

This is a product, engineering, and due-diligence assessment, not legal advice. Provider terms and documentation change; re-check the current agreement and the exact order form before relying on this review.

## Executive Finding

The technical controls can be configured toward a strong Canadian, low-retention posture, but the current contract is the decisive blocker. Section 20(e) of Google's Service Specific Terms states that customers may not use Generative AI Services “for clinical purposes,” while clarifying that scheduling and other administrative tasks are not restricted.

The proposed CDS Hook would interpret referral content and may flag referral appropriateness, urgency, or routing. That is close enough to clinical decision support that OceanMD should not classify it unilaterally as a permitted administrative use. A public Google PHIPA page does not override the service restriction.

Proceed only if Google provides a binding amendment/exception or written contractual confirmation, accepted by OceanMD legal/privacy and the HIC, that the exact workflow is permitted. If Google will not do that, do not use a managed Google generative model for the workflow.

## Contract Requirements

Before approval, retain evidence for all of the following:

- The exact OceanMD legal entity, Google contracting entity, enterprise account/project owner, order form, and applicable Google Cloud agreement.
- Google's Cloud Data Processing Addendum applies to all prompt, output, cache, logging, support, and metadata processing in scope.
- A binding answer on whether this clinician-facing referral CDS workflow is a permitted administrative use rather than a prohibited clinical purpose.
- Confirmation that the age restriction for an application directed toward or likely to be accessed by people under 18 is not triggered merely because the data subjects are pediatric patients; the application itself must remain clinician-facing.
- The clinic/HIC-to-OceanMD and OceanMD-to-Google roles and obligations, including permitted purpose, confidentiality, security, deletion, incidents, subprocessors, audit/assurance, support access, material changes, suspension, and termination.
- No training, fine-tuning, secondary use, product improvement, or human review of PHI without explicit approval.
- Written data-location treatment for the exact model, endpoint, consumption mode, abuse monitoring, support path, metadata, and subprocessors.

Google's PHIPA page says that customers remain responsible for due diligence and offers assessments and security material. It is supporting evidence, not certification or a commitment that this use is lawful or contractually permitted.

## Required Google Cloud Configuration If the Contract Blocker Is Cleared

- Use an OceanMD-controlled enterprise Google Cloud organization, billing account, project, and Agent Platform/Vertex endpoint—not the consumer Gemini service, a personal account, or an API-key-only integration.
- Pin the exact approved model ID and the `northamerica-northeast1` regional endpoint. Google lists Gemini 3.5 Flash model availability and ML processing in that region. Do not use `global`, `us`, another multi-region, or an automatic regional fallback.
- Use workload identity and a dedicated service account with least privilege. Do not store long-lived API keys in tenant configuration.
- Put the project inside the approved VPC Service Controls perimeter and use approved private access/connectivity where supported.
- Use Canadian-region CMEK, log buckets, storage, secrets, backups, and monitoring paths. Keep PHI out of project names, labels, resource identifiers, support cases, and diagnostic metadata.
- Request and obtain the abuse-monitoring exception if the applicable agreement otherwise permits prompt logging. Confirm that the selected model is not subject to an Advanced AI Safety Addendum that makes zero retention impossible.
- Leave request-response logging disabled. If using the Interactions API, set `store=false` on every request; its default is `true`.
- Do not enable Google Search or Maps grounding, session resumption, RAG, agent memory/snapshots, batch storage, or explicit context caching. Disable the default project-level in-memory cache as a conservative project policy even though Google describes it as in-memory, project-isolated, residency-aligned, and compatible with its ZDR definition.
- Enforce allowed project, location, endpoint, model, and features in organization policy/deployment checks. Fail closed if configuration drifts.
- Separate development, test, and production. Production PHI must never be copied into prompt experimentation, eval datasets, or debugging tools.

## Required Verification Evidence

- Executed agreement, CDPA, order form, and written clinical-purpose determination.
- Current provider subprocessor and security/assurance review.
- Screenshot or machine-readable evidence of project, location, model, VPC-SC, IAM, logging, cache, retention, and organization-policy settings.
- A test showing that global/non-Canadian endpoints, unapproved models, and disabled features are denied.
- Sanitized application logs demonstrating that prompts and completions are absent.
- Approved PIA, TRA, AI/clinical safety assessment, deployment record, and rollback procedure.

## Sources Reviewed

- [Google Cloud Service Specific Terms](https://cloud.google.com/terms/service-terms)
- [Google Cloud Data Processing Addendum](https://cloud.google.com/terms/data-processing-addendum/)
- [Google Cloud data residency terms](https://cloud.google.com/terms/data-residency)
- [Gemini 3.5 Flash model and regional availability](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-5-flash)
- [Gemini Enterprise Agent Platform zero data retention](https://docs.cloud.google.com/gemini-enterprise-agent-platform/resources/zero-data-retention)
- [Google Cloud PHIPA page](https://cloud.google.com/security/compliance/phipa-canada)
- [Google IAM service-account best practices](https://docs.cloud.google.com/iam/docs/best-practices-service-accounts)
- [VPC Service Controls overview](https://docs.cloud.google.com/vpc-service-controls/docs/overview)
- [Regionalized Cloud Logging](https://docs.cloud.google.com/logging/docs/regionalized-logs)
