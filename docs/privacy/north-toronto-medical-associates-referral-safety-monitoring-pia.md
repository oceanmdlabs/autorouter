# Privacy Impact Assessment: North Toronto Medical Associates Referral Safety Monitoring

This Privacy Impact Assessment (PIA) is a draft reference assessment for North Toronto Medical Associates using Ocean Autorouter to monitor outbound referrals for safety concerns caused by referral delays. It is implementation guidance and a drafting aid, not legal advice. It should be reviewed by the clinic's privacy officer, legal counsel if applicable, security owner, and accountable health information custodian (HIC) before production use.

This PIA uses the reusable [Privacy Impact Assessment templates](privacy-impact-assessment-templates.md) and should be read with the repository's [Privacy Considerations](privacy-considerations.md).

## Source Guidance

- [Ontario IPC PHIPA PIA Guidelines](https://www.ipc.on.ca/en/resources-and-decisions/privacy-impact-assessment-guidelines-ontario-personal-health-information-protection-act)
- [Office of the Privacy Commissioner of Canada PIA Process Guide](https://www.priv.gc.ca/en/privacy-topics/federal-government-privacy/privacy-impact-assessments/gd_exp_202003/)
- [Amazon Bedrock regional availability](https://docs.aws.amazon.com/bedrock/latest/userguide/models-region-compatibility.html)

## 1. Administrative Details

| Item | Response |
| ---- | -------- |
| Project name | Ocean Autorouter outbound referral safety monitoring |
| Assessment version | Draft 0.1 |
| Assessment date | 2026-05-29 |
| Deployment tenant/customer | North Toronto Medical Associates |
| Accountable HIC | North Toronto Medical Associates |
| Accountable executive | TBD: clinic physician lead or clinic administrator |
| Privacy officer | TBD: clinic privacy officer/contact |
| Security owner | Ocean Labs/OceanMD technical owner plus clinic-designated contact |
| Product owner | Ocean Labs/OceanMD Autorouter owner |
| Clinical/business owner | TBD: clinic referral operations lead |
| Legal reviewer | TBD: not required for draft, recommended before production |
| Review trigger | New production use of AI-assisted monitoring for outbound referrals |

## 2. Deployment Assumption Record

| Field | Assumption | Evidence required | Status |
| ----- | ---------- | ----------------- | ------ |
| Hosting operator | Ocean Labs/OceanMD operates the Autorouter in Ocean Labs AWS infrastructure as a service provider to North Toronto Medical Associates. | Service agreement, support model, AWS account ownership, architecture diagram. | To confirm |
| Primary AWS region | Application services run in AWS Canada (Central), `ca-central-1`. | AWS deployment configuration and environment variables. | Required before go-live |
| AI inference | AI inference uses Amazon Bedrock in `ca-central-1` with an approved Anthropic Claude model that supports in-region inference. | Exact Bedrock model ID, region configuration, model access evidence. | Required before go-live |
| Inference routing | Direct in-region inference only. Geo and global cross-region inference are not approved for PHI in this assessment. | Bedrock client configuration, CloudTrail/config review, operational runbook. | Required before go-live |
| Model fallback | No automatic fallback may send PHI outside Canada. | Application configuration and incident/runbook review. | Required before go-live |
| Database | PostgreSQL runs in AWS Canada Central with backups, snapshots, replicas, and KMS keys in Canada unless separately approved. | RDS/Aurora/Postgres configuration, backup configuration, KMS key region. | Required before go-live |
| Object and log storage | Referral payloads, audit logs, traces, backups, and operational logs remain in Canadian AWS regions unless separately approved. | S3, CloudWatch, OpenTelemetry, error monitoring, backup, and export configuration. | Required before go-live |
| Email/SMS | Escalation notifications use minimal content. Clinical detail is not included in email/SMS unless separately approved. | Notification templates, vendor/region configuration, payload review. | To confirm |
| Attachments | Attachments are excluded from AI processing for the initial deployment unless the clinic separately approves attachment analysis. | Tenant configuration and rule review. | Recommended baseline |
| Production data | Real patient/provider data is used only after PIA approval and tenant-specific configuration review. | Go-live checklist and approval record. | Required |

## 3. Project Description

North Toronto Medical Associates will use Ocean Autorouter to monitor outbound referrals initiated by the clinic through Ocean. The initial use case is to identify referrals that have been delayed for more than two weeks and assess whether the delay could create an important patient safety concern. If a referral appears safety-sensitive, the system escalates the referral for clinic review using approved internal workflows.

The intended workflow is:

1. Ocean emits or exposes referral event data for outbound referrals.
2. Autorouter evaluates configured monitoring rules for referrals with delay greater than 14 calendar days.
3. For delayed referrals, AI reviews the minimum necessary referral content to classify whether delay may create an important safety concern.
4. If the rule identifies a concern, Autorouter creates an escalation record or notification for authorized clinic staff.
5. Clinic staff review the referral in Ocean and/or the clinic workflow, then decide whether to follow up with the receiving site, update the patient, redirect the referral, or take another clinical action.

The AI output is advisory and workflow-supporting. It should not cancel, redirect, deprioritize, close, or modify a referral without human review for this deployment.

## 4. Authority, Purpose, and Necessity

North Toronto Medical Associates is the HIC and uses PHI for providing or assisting with health care, referral management, patient safety follow-up, quality of care, and related administrative purposes. Ocean Labs/OceanMD is assumed to act as a service provider or agent supporting the HIC's configured workflow.

The purpose is to reduce the risk that clinically important outbound referrals are missed or delayed without follow-up. The 14-day delay threshold is a practical initial threshold for safety monitoring; it should be adjusted by specialty, referral urgency, and clinic policy if the clinic has more specific service standards.

Processing is necessary because safety risk often depends on referral reason, urgency indicators, patient context, and free text that cannot be reliably captured by simple deterministic fields alone. Less intrusive alternatives considered include manual referral worklists, non-AI reports for referrals older than 14 days, and rules based only on urgency fields. Those alternatives should remain part of the workflow where feasible, but AI is used to prioritize review when the volume of delayed referrals makes manual review less reliable.

## 5. Data Inventory

| Data category | Examples | Source | Required? | Used by AI? | Stored? | Retention | Notes |
| ------------- | -------- | ------ | --------- | ----------- | ------- | --------- | ----- |
| Patient identifiers | Name, date of birth, Ocean referral ID, contact details, health card number if present | Ocean referral payload | Yes, minimum necessary for matching and follow-up | Avoid where practical; include only if needed to understand referral context | Yes, where needed for audit and action traceability | TBD: align to clinic/Ocean retention and minimize Autorouter retention | Use referral IDs in logs where possible. |
| Referral metadata | Referral status, created/sent date, receiving listing, sender, urgency, elapsed days | Ocean referral payload | Yes | Yes | Yes | TBD | Core trigger data. |
| Clinical referral content | Reason for referral, form answers, relevant history, symptoms, suspected diagnosis | Ocean referral payload | Yes, scoped | Yes | Limited, as needed for audit/state | TBD | Minimum necessary prompt construction required. |
| Attachments | PDFs, scanned reports, lab/imaging documents | Ocean documents | No for initial deployment | No | No | Not applicable | Exclude by default; separate approval required. |
| Provider and site data | Referring clinician, clinic site, receiving provider/listing, contact metadata | Ocean directories/referral payload | Yes | Limited | Yes | TBD | Needed for escalation and follow-up. |
| Rule configuration | Delay threshold, clinical safety criteria, escalation target | Autorouter tenant config | Yes | Yes, as instructions | Yes | Until rule replaced plus audit retention | May reveal clinic operational practices. |
| AI inputs and outputs | Prompt, classification, explanation, confidence/uncertainty | Autorouter/Bedrock | Yes for processing | Yes | Prefer not to store full prompt/completion; store structured outcome and rationale only where approved | TBD | Confirm logging and retention before go-live. |
| Audit logs | Rule ID, referral event reference, model ID, timestamp, action, actor/system | Autorouter | Yes | No | Yes | TBD | Required for accountability and incident review. |
| Escalation notifications | Minimal referral reference, queue/task message, recipient | Autorouter/Ocean/email/SMS if enabled | Yes if escalation enabled | No | Yes, in destination system and audit logs | TBD | Avoid clinical detail in email/SMS. |
| Operational telemetry | Logs, metrics, traces, errors | Infrastructure | Yes for operations | No | Yes | TBD | Redact PHI where feasible; restrict access. |

## 6. Data Flow Map

| Step | Sender | Receiver | Data elements | Purpose | Region | Security control | Evidence |
| ---- | ------ | -------- | ------------- | ------- | ------ | ---------------- | -------- |
| 1 | Ocean platform | Autorouter | Outbound referral event and status data | Trigger monitoring and rule evaluation | Canada/TBD | TLS, API authentication, least privilege | Ocean integration configuration |
| 2 | Autorouter | PostgreSQL | Tenant config, processing state, audit records | Persistence and accountability | AWS Canada Central | Encryption at rest, IAM, network controls | Database configuration |
| 3 | Autorouter | Amazon Bedrock | Minimum necessary referral content and rule prompt | Safety concern classification | `ca-central-1` only | TLS, IAM, approved model ID, no cross-region routing | Bedrock configuration |
| 4 | Autorouter | Ocean platform or clinic workflow | Escalation action, referral reference, minimal rationale | Prompt authorized human review | Canada/TBD | API auth, RBAC, audit | Action configuration |
| 5 | Autorouter | Email/SMS service, if enabled | Minimal notification metadata | Notify authorized staff | Canada or approved exception | Payload minimization, approved vendor | Template and vendor review |
| 6 | Autorouter | Logs/monitoring | Operational and audit events | Reliability, security, incident response | Canada/TBD | Redaction, restricted access, retention limits | Logging configuration |

## 7. Safeguards

- Tenant-specific enablement is required before real PHI processing.
- Access to Autorouter configuration, audit logs, and escalations is restricted to authorized Ocean Labs/OceanMD operators and clinic-designated users.
- PHI is encrypted in transit and at rest; KMS keys for production data should remain in Canada.
- Bedrock access is limited to approved direct in-region model IDs in `ca-central-1`.
- Prompts include only the fields required to assess delayed referral safety risk.
- Attachments are excluded by default.
- Audit records capture rule ID, model ID, referral reference, timestamp, classification, escalation action, and operator/system actor without unnecessary prompt content.
- Production logs and traces should avoid PHI; any unavoidable PHI in logs must have restricted access and defined retention.
- Operators can disable the tenant rule or AI processing quickly during incidents.
- Model, region, prompt, and escalation changes are treated as material changes requiring review before production use.

## 8. Individual Rights and Transparency

The clinic should maintain patient-facing privacy notices that explain use of service providers and electronic tools to manage referrals and provide care. A separate patient consent flow is not assumed for this draft because the use is framed as referral management and patient safety follow-up by the HIC within the provision of care. The clinic should confirm this authority with its privacy officer or counsel.

Authorized clinic users should receive a clear admin notice before enabling the rule that:

- AI may process referral PHI to classify delayed referral safety risk;
- processing uses Ocean Labs/OceanMD AWS infrastructure and Amazon Bedrock in Canada under the approved configuration;
- output is advisory and requires human review before clinical action;
- attachments are excluded unless separately enabled and approved;
- logs and audit records are retained for accountability.

Patient access, correction, and complaint requests should be handled by North Toronto Medical Associates using Ocean and clinic source records as the source of truth, with Autorouter audit records available to explain whether and when a rule evaluated or escalated a referral.

## 9. Accuracy, Human Oversight, and Error Handling

The AI task is classification and prioritization, not diagnosis or autonomous referral management. The rule should identify delayed referrals that may need staff attention because delay could be clinically important.

Recommended initial classification labels:

- `safety_concern_likely`: delay may pose important safety concern; escalate for review.
- `safety_concern_uncertain`: insufficient context or ambiguous concern; escalate for review.
- `routine_follow_up`: delayed but no obvious important safety concern from available data; include in standard delayed referral worklist if available.

Human review is required for `safety_concern_likely` and `safety_concern_uncertain`. The reviewer should confirm referral status and clinical context in Ocean and the clinic record before contacting the receiving site, patient, or another provider.

Before production, the clinic should test the rule against synthetic or privacy-approved historical cases, including urgent referrals, cancer suspicion, specialist access delays, ambiguous referrals, and false-positive routine referrals. The clinic should periodically review escalations and missed cases to tune prompts, thresholds, and workflow.

## 10. Ontario PHIPA Addendum

| Question | Response |
| -------- | -------- |
| Who is the HIC? | North Toronto Medical Associates. |
| What is Ocean Labs/OceanMD's role? | Assumed service provider/agent operating Autorouter for the HIC; exact contractual role to confirm. |
| Does the workflow enable disclosure between HICs? | It supports referral follow-up and escalation related to existing outbound referrals; any disclosure to receiving providers occurs through approved referral/follow-up workflows. |
| Consent or authority | Draft assumes use/disclosure within providing or assisting with health care and referral management, with implied consent/authority as applicable under clinic policy. Confirm before go-live. |
| Secondary uses | Not approved in this PIA. No model training, product improvement datasets, or analytics using identifiable PHI without separate approval. |
| Non-Canadian processing | Not approved in this PIA. |

## 11. AI Processing Addendum

| Field | Response |
| ----- | -------- |
| AI provider | Amazon Bedrock |
| Foundation model | Anthropic Claude model approved for `ca-central-1`; practical starting point: a low-latency Claude Haiku/Sonnet-family model with direct in-region support |
| Exact model ID | TBD before go-live |
| Endpoint region | `ca-central-1` |
| Inference routing | Direct in-region only |
| Prompt data categories | Referral age/status, urgency, reason for referral, relevant form answers, limited clinical context, receiving listing/specialty |
| Output data categories | Safety concern classification, short rationale, escalation recommendation, uncertainty flag |
| Prompt/completion retention | Prefer no full prompt/completion storage; retain structured outcome and minimal rationale only if approved |
| Bedrock logging enabled? | TBD; if enabled, logs must remain in Canada and be PHI-approved |
| Model training on customer prompts? | Not approved |
| Human review required? | Yes for safety concern and uncertain classifications |
| Customer-specific opt-in required? | Yes |

## 12. Privacy Risk Register and Action Plan

| ID | Risk | Impact | Likelihood | Pre-mitigation rating | Mitigation | Owner | Due date | Residual rating | Decision |
| -- | ---- | ------ | ---------- | --------------------- | ---------- | ----- | -------- | --------------- | -------- |
| NTMA-001 | Bedrock model or inference profile routes PHI outside Canada. | High | Medium until verified | High | Allow only direct in-region model IDs in `ca-central-1`; disable geo/global inference; verify configuration before go-live. | Ocean Labs/OceanMD security owner | Before go-live | Low/Medium | Not accepted until verified |
| NTMA-002 | AI misses a delayed referral that should have been escalated. | High | Medium | High | Treat AI as advisory prioritization; maintain standard delayed referral worklist; escalate uncertain cases; periodic quality review. | Clinic clinical owner | Before go-live and ongoing | Medium | Accept only with human workflow |
| NTMA-003 | AI over-escalates routine referrals, causing alert fatigue. | Medium | Medium | Medium | Tune prompt and threshold; review false positives; keep escalation queue manageable; classify uncertain separately. | Clinic referral operations lead | 30 days after go-live | Low/Medium | Monitor |
| NTMA-004 | Full prompts, completions, logs, or traces retain excessive PHI. | High | Medium | High | Avoid full prompt storage; redact operational logs; restrict access; define retention and disposal. | Ocean Labs/OceanMD technical owner | Before go-live | Medium | Conditional |
| NTMA-005 | Escalation notification includes excessive clinical detail. | Medium/High | Medium | High | Use minimal notification content; link/reference referral in approved system; avoid PHI in email/SMS. | Clinic and Ocean Labs/OceanMD owners | Before go-live | Low/Medium | Conditional |
| NTMA-006 | Attachments are processed without separate approval. | High | Low/Medium | High | Disable attachment processing; enforce tenant opt-in and warning if added later. | Ocean Labs/OceanMD technical owner | Before go-live | Low | Do not approve initially |
| NTMA-007 | Support/admin access exceeds least privilege. | High | Medium | High | RBAC, support procedures, audit logs, periodic access review, just-in-time access where available. | Ocean Labs/OceanMD security owner | Before go-live | Medium | Conditional |
| NTMA-008 | Model or prompt changes alter accuracy or privacy posture. | Medium/High | Medium | Medium/High | Treat model ID, region, prompt, and action changes as material changes requiring test and approval. | Product owner and clinic privacy officer | Ongoing | Low/Medium | Conditional |

## 13. Decision Log

| Date | Decision | Rationale | Approver | Follow-up |
| ---- | -------- | --------- | -------- | --------- |
| 2026-05-29 | Use Ocean Labs AWS infrastructure in AWS Canada Central as the baseline deployment. | Supports Canadian residency expectations for Ontario health-sector PHI. | Draft assumption | Verify service regions, backups, logs, and KMS. |
| 2026-05-29 | Use direct in-region Bedrock inference only for PHI. | Avoids cross-region processing for referral PHI. | Draft assumption | Confirm exact model ID and routing configuration. |
| 2026-05-29 | Exclude attachments from initial AI processing. | Attachments have high PHI exposure and cannot be reliably redacted. | Draft recommendation | Separate PIA update if attachment analysis is needed. |
| 2026-05-29 | Require human review before clinical action. | AI classification errors could affect patient safety and referral follow-up. | Draft recommendation | Define clinic escalation SOP. |

## 14. Go-Live Checklist

- Confirm accountable clinic executive, privacy officer, clinical owner, and escalation queue owner.
- Confirm Ocean Labs/OceanMD contractual role and service-provider obligations.
- Confirm AWS region for app, database, backups, logs, object storage, KMS keys, and monitoring.
- Confirm exact Amazon Bedrock model ID and direct in-region routing in `ca-central-1`.
- Confirm full prompt/completion logging is disabled or explicitly approved with Canadian storage and retention.
- Confirm attachment processing is disabled.
- Confirm escalation destination, notification templates, recipients, and after-hours coverage.
- Define retention for Autorouter processing state, structured AI outputs, audit logs, operational logs, and backups.
- Test the rule with synthetic or privacy-approved cases.
- Approve clinic SOP for reviewing escalations and correcting false positives/false negatives.
- Capture privacy, security, product, and HIC approval decisions.

## 15. Open Clarifications

These items should be answered before this draft is treated as complete:

1. Who should be listed as accountable executive, privacy officer, clinical owner, and escalation queue owner for North Toronto Medical Associates?
2. Should the 14-day threshold apply to all outbound referrals, or only selected specialties, urgency levels, or referral types?
3. What is the exact escalation action: Ocean task/comment, internal work queue, email, SMS, phone call workflow, or another mechanism?
4. What minimum data should escalation messages include, and are email/SMS channels allowed at all?
5. What retention periods should apply to Autorouter audit logs, structured AI outputs, operational logs, and backups?
6. Does the clinic want the rule to escalate `uncertain` cases by default? This draft recommends yes for patient safety.
7. Who approves future model, prompt, threshold, attachment, or notification changes?
