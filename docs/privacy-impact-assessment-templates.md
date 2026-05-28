# Privacy Impact Assessment Templates

Ocean Autorouter can process personal health information (PHI) and personal information when routing eReferrals and eConsults. These templates help privacy, legal, product, security, and implementation teams prepare a Privacy Impact Assessment (PIA) or equivalent privacy review before using the Autorouter with real patient or provider data.

This document is implementation guidance and a drafting aid. It is not legal advice and should be reviewed by the responsible privacy officer, legal counsel, and health information custodian or equivalent accountable organization before production use.

## Source Guidance

Use the current versions of these sources when completing a PIA:

- [Ontario IPC PHIPA PIA Guidelines](https://www.ipc.on.ca/en/resources-and-decisions/privacy-impact-assessment-guidelines-ontario-personal-health-information-protection-act) for Ontario health-sector PHIPA reviews.
- [Ontario IPC Planning for Success PIA Guide](https://www.ipc.on.ca/en/resources/planning-success-privacy-impact-assessment-guide-ontarios-public-institutions) when Ontario public-sector FIPPA or MFIPPA considerations are relevant.
- [Office of the Privacy Commissioner of Canada PIA Process Guide](https://www.priv.gc.ca/en/privacy-topics/federal-government-privacy/privacy-impact-assessments/gd_exp_202003/) for Canadian PIA process structure, risk analysis, and mitigation planning.
- [OPC PIPEDA Fair Information Principles](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/) for private-sector PIPEDA framing.
- [Canada Digital Privacy Playbook: Privacy Impact Assessments](https://www.canada.ca/en/government/system/digital-government/digital-privacy-playbook/privacy-impact-assessments.html) for a concise public-sector PIA trigger and deliverables model.
- [Amazon Bedrock regional availability](https://docs.aws.amazon.com/bedrock/latest/userguide/models-region-compatibility.html) and relevant model cards before approving any AI model or inference routing.

## Template Set

Use these templates as a package:

1. **Deployment Assumption Record**: documents the hosting and processing facts that the PIA depends on.
2. **Common PIA Workbook**: captures the system description, data inventory, flows, safeguards, risks, and approvals.
3. **Ontario PHIPA Addendum**: adds Ontario health-sector questions and PHIPA-specific accountability checks.
4. **PIPEDA and Provincial Adaptation Addendum**: maps the common workbook to PIPEDA and province-specific private-sector reviews.
5. **AI Processing Addendum**: captures model, prompt, output, and human oversight controls.
6. **Risk Register and Action Plan**: tracks privacy risks, mitigations, accountable owners, and residual risk.

## Template 1: Deployment Assumption Record

Complete this before the PIA. If any critical assumption is false, update the PIA scope and re-assess residency, vendor, security, and transparency risks.

| Field                  | Baseline assumption                                                                                                                                                | Evidence required                                                                                                                                                                            | Status |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Hosting operator       | OceanMD operates the Autorouter in Ocean Labs AWS infrastructure.                                                                                                  | Architecture diagram, AWS account ownership, support model, service agreement.                                                                                                               | TBD    |
| Primary AWS region     | Application services run in AWS Canada (Central), `ca-central-1`, commonly treated as Toronto for project purposes.                                                | AWS deployment configuration and production environment variables.                                                                                                                           | TBD    |
| AI inference           | AI inference runs through Amazon Bedrock in `ca-central-1` using an Anthropic Claude 3 Haiku or Claude Sonnet-family model where in-region inference is available. | Bedrock model ID, inference profile or direct model ID, AWS regional availability evidence, CloudTrail or configuration proof that cross-region/global inference is disabled where required. | TBD    |
| Model fallback         | No automatic fallback sends PHI to a non-Canadian region unless explicitly approved in the PIA and contract.                                                       | Application configuration, Bedrock client configuration, operational runbook.                                                                                                                | TBD    |
| Database               | PostgreSQL database runs in the same AWS Canada (Central) region as the application.                                                                               | RDS/Aurora/Postgres configuration, backups, read replicas, snapshots, KMS key region.                                                                                                        | TBD    |
| Object and log storage | Any referral payloads, attachments, audit logs, traces, backups, and operational logs stay in Canadian AWS regions unless separately approved.                     | S3, CloudWatch, OpenTelemetry, error monitoring, backup, and export configuration.                                                                                                           | TBD    |
| Optional email         | Email tooling, if enabled, uses AWS Canada-region services or another approved Canadian-residency service path.                                                    | SES or vendor configuration, data elements sent, retention and bounce/complaint handling.                                                                                                    | TBD    |
| Optional SMS           | SMS tooling, if enabled, uses AWS Canada-region services or another approved Canadian-residency service path.                                                      | SNS/Pinpoint or vendor configuration, telecom routing limits, message payload minimization.                                                                                                  | TBD    |
| Transient processing   | Any transient processing outside Canada is prohibited by default unless documented as legally permissible, contractually covered, minimized, and privacy-approved. | Exception record and legal/privacy approval.                                                                                                                                                 | TBD    |
| Production data        | Real patient/provider data is used only after PIA approval and tenant-specific configuration review.                                                               | Go-live checklist and approval record.                                                                                                                                                       | TBD    |

### Required Clarifications

Answer these before treating the baseline assumption as approved:

- Which legal entity is the service provider for each deployment: OceanMD, Ocean Labs, customer tenant, or another operator?
- Is OceanMD acting as an agent/electronic service provider for an Ontario health information custodian, a service provider to a non-Ontario organization, or another role?
- Which exact Bedrock model IDs are permitted for PHI, and are they direct in-region IDs rather than geo/global inference profiles?
- Are attachments in scope, or only structured referral and eConsult fields?
- Are AI prompts, completions, tool inputs, traces, or evaluation datasets retained? If yes, where, for how long, and who can access them?
- Are email or SMS messages allowed to contain PHI, or only minimal notification metadata?
- What tenant-facing transparency, notices, and configuration warnings are required before a customer enables AI routing?

## Template 2: Common PIA Workbook

### 1. Administrative Details

| Item                       | Response                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| Project name               | Ocean Autorouter                                                                                  |
| Assessment version         | TBD                                                                                               |
| Assessment date            | TBD                                                                                               |
| Deployment tenant/customer | TBD                                                                                               |
| Accountable executive      | TBD                                                                                               |
| Privacy officer            | TBD                                                                                               |
| Security owner             | TBD                                                                                               |
| Product owner              | TBD                                                                                               |
| Legal reviewer             | TBD                                                                                               |
| Clinical/business owner    | TBD                                                                                               |
| Review trigger             | New production deployment / material change / new data source / new AI model / new routing action |

### 2. Project Description

Describe:

- referral, eConsult, and routing workflows in scope;
- user groups and administrative roles;
- AI-assisted routing rules, recommended actions, and human review points;
- whether routing decisions are advisory, automated, or require manual confirmation;
- optional tools enabled, including email, SMS, forwarding, tagging, audit reporting, and attachment summarization.

### 3. Authority, Purpose, and Necessity

Document:

- the clinical, administrative, or operational purpose of the workflow;
- the legal and contractual authority relied on by the responsible organization;
- why the processing is necessary to meet that purpose;
- whether each category of PHI or personal information is necessary;
- whether less intrusive alternatives were considered;
- expected benefits, affected individuals, and privacy impacts.

For higher-risk deployments, explicitly assess necessity, effectiveness, proportionality, and minimal intrusiveness before go-live.

### 4. Data Inventory

| Data category             | Examples                                                 | Source                             | Required? | Used by AI? | Stored? | Retention | Notes                                   |
| ------------------------- | -------------------------------------------------------- | ---------------------------------- | --------- | ----------- | ------- | --------- | --------------------------------------- |
| Patient identifiers       | Name, health card number, date of birth, contact details | Ocean referral payload             | TBD       | TBD         | TBD     | TBD       | TBD                                     |
| Clinical referral content | Reason for referral, history, medications, form answers  | Ocean referral/eConsult            | TBD       | TBD         | TBD     | TBD       | TBD                                     |
| Attachments               | PDFs, scanned reports, EMR exports, images               | Ocean documents                    | TBD       | TBD         | TBD     | TBD       | Higher risk; assume PHI may be present. |
| Provider and site data    | Referring clinician, recipient listing, site metadata    | Ocean directories/referral payload | TBD       | TBD         | TBD     | TBD       | TBD                                     |
| Rule configuration        | Prompts, criteria, enabled actions                       | Autorouter tenant config           | TBD       | TBD         | TBD     | TBD       | May reveal operational practices.       |
| AI inputs and outputs     | Prompts, model responses, explanations, classifications  | Autorouter / Bedrock               | TBD       | Yes         | TBD     | TBD       | Confirm logging and retention.          |
| Audit logs                | User actions, system actions, referral event IDs         | Autorouter                         | TBD       | No          | TBD     | TBD       | Required for accountability.            |
| Email/SMS payloads        | Notifications, routing status, recipient contact info    | Optional tools                     | TBD       | No          | TBD     | TBD       | Minimize PHI by default.                |
| Operational telemetry     | Logs, metrics, traces, errors                            | Infrastructure                     | TBD       | No          | TBD     | TBD       | Redact PHI where feasible.              |

### 5. Data Flow Map

Document each flow with a diagram and the table below.

| Step | Sender         | Receiver          | Data elements                          | Purpose                           | Region                                                            | Security control                  | Contract/control evidence |
| ---- | -------------- | ----------------- | -------------------------------------- | --------------------------------- | ----------------------------------------------------------------- | --------------------------------- | ------------------------- |
| 1    | Ocean platform | Autorouter        | Referral/eConsult event payload        | Trigger rule evaluation           | Canada / TBD                                                      | TLS, API auth                     | TBD                       |
| 2    | Autorouter     | PostgreSQL        | Tenant config, audit, processing state | Persistence and audit             | AWS Canada Central                                                | Encryption, IAM, network controls | TBD                       |
| 3    | Autorouter     | Bedrock           | Prompt and scoped referral content     | AI classification/routing support | AWS Canada Central if approved model supports in-region inference | TLS, IAM, Bedrock data controls   | TBD                       |
| 4    | Autorouter     | Ocean platform    | Routing action or update               | Execute approved routing workflow | Canada / TBD                                                      | API auth, least privilege         | TBD                       |
| 5    | Autorouter     | Email/SMS service | Minimal notification content           | Optional notifications            | AWS Canada Central or approved exception                          | Payload minimization, opt-in      | TBD                       |
| 6    | Autorouter     | Logs/monitoring   | Operational events                     | Security, reliability, audit      | Canada / TBD                                                      | PHI redaction, access controls    | TBD                       |

### 6. Safeguards

Address at least:

- authentication, authorization, tenant isolation, and administrator access;
- encryption in transit and at rest, including KMS key location and key access;
- network isolation and private connectivity where applicable;
- least-privilege IAM for application, database, Bedrock, email, SMS, logging, and deployment roles;
- audit logging for configuration changes, rule evaluations, AI actions, and access to sensitive records;
- monitoring, alerting, incident response, and breach notification procedures;
- secure SDLC, code review, dependency scanning, secret management, and deployment controls;
- retention and secure disposal for application data, AI artifacts, logs, backups, and exports;
- vendor, subcontractor, and support access controls;
- tenant configuration review before real PHI processing.

### 7. Individual Rights and Transparency

Document:

- patient/provider-facing notices, where applicable;
- customer-facing admin notices before enabling AI processing;
- whether consent, implied consent, notice, opt-out, or another authority applies;
- access, correction, challenge, and complaint handling;
- explanation of AI-assisted routing and limits of automation;
- how affected individuals can reach the accountable privacy contact.

### 8. Accuracy, Human Oversight, and Error Handling

Document:

- expected model task, confidence limits, and known failure modes;
- whether model output is advisory or directly triggers actions;
- human review requirements for high-impact routing actions;
- testing and validation before enabling a rule in production;
- monitoring for misroutes, bias, prompt drift, and configuration errors;
- rollback, disablement, and correction workflow.

### 9. Privacy Risk Register

Use Template 6 below. Include pre-mitigation and residual risk ratings, action owners, target dates, and approval of any accepted residual risk.

### 10. Approvals

| Role                           | Name | Decision                                           | Date | Conditions |
| ------------------------------ | ---- | -------------------------------------------------- | ---- | ---------- |
| Privacy officer                | TBD  | Approved / Approved with conditions / Not approved | TBD  | TBD        |
| Legal counsel                  | TBD  | Approved / Approved with conditions / Not approved | TBD  | TBD        |
| Security owner                 | TBD  | Approved / Approved with conditions / Not approved | TBD  | TBD        |
| Product owner                  | TBD  | Approved / Approved with conditions / Not approved | TBD  | TBD        |
| Accountable customer/HIC owner | TBD  | Approved / Approved with conditions / Not approved | TBD  | TBD        |

## Template 3: Ontario PHIPA Addendum

Use this addendum when the deployment processes personal health information for Ontario health-sector workflows.

### PHIPA Role Analysis

| Question                                                                                                                         | Response |
| -------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Who is the health information custodian (HIC)?                                                                                   | TBD      |
| Is OceanMD acting as an agent, electronic service provider, health information network provider, or another role?                | TBD      |
| Does the Autorouter enable one or more HICs to disclose PHI to each other?                                                       | TBD      |
| Does the workflow require patient consent, assumed implied consent in the circle of care, express consent, or another authority? | TBD      |
| Does any use go beyond providing or assisting with health care?                                                                  | TBD      |
| Are any secondary uses, analytics, training, product improvement, or evaluation datasets in scope?                               | TBD      |
| Are any disclosures made to non-Canadian service providers or support personnel?                                                 | TBD      |

### PHIPA Control Checklist

| Area                   | PIA question                                                                                                                                                  | Evidence |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Accountability         | Has the HIC/service provider relationship been documented with privacy obligations, permitted uses, safeguards, breach reporting, and subcontractor controls? | TBD      |
| Limiting collection    | Is AI sent only the minimum referral content necessary for the routing rule?                                                                                  | TBD      |
| Limiting use           | Is PHI used only for configured routing, audit, support, and approved operational purposes?                                                                   | TBD      |
| Limiting disclosure    | Are disclosures to Bedrock, database, email, SMS, support, and logs documented and approved?                                                                  | TBD      |
| Safeguards             | Are technical, administrative, and physical safeguards appropriate to PHI sensitivity?                                                                        | TBD      |
| Openness               | Are customer administrators warned when enabling AI or attachment processing?                                                                                 | TBD      |
| Access and correction  | Can the HIC respond to patient access/correction requests using source systems and Autorouter audit records?                                                  | TBD      |
| Retention and disposal | Are retention periods defined for PHI, AI prompts/responses, logs, backups, and exports?                                                                      | TBD      |
| Audit                  | Are AI-related accesses, evaluations, and triggered actions logged in a privacy-auditable form?                                                               | TBD      |
| Breach management      | Is there a documented incident response path for unauthorized access, misrouting, or vendor-region misconfiguration?                                          | TBD      |

### Ontario-Specific Deployment Position

The preferred Ontario deployment position is:

- PHI remains in Canada for application hosting, database, logs, backups, and AI inference.
- Amazon Bedrock inference uses direct in-region processing in `ca-central-1`; geo or global cross-region inference is disabled unless separately approved.
- PostgreSQL, snapshots, replicas, and KMS keys remain in `ca-central-1` unless an approved disaster-recovery design documents the privacy implications.
- Email and SMS notifications contain the minimum necessary content and do not include clinical detail unless specifically approved.
- Attachment processing is treated as high risk because reliable de-identification cannot be guaranteed for free text, scans, reports, and metadata.

### PHIPA Residual Risk Decision

| Risk                                       | Residual rating | Accepted by | Conditions                                                               |
| ------------------------------------------ | --------------- | ----------- | ------------------------------------------------------------------------ |
| AI provider receives PHI in prompts        | TBD             | TBD         | Canadian in-region inference, contract controls, minimal prompt content. |
| Misrouting or erroneous AI recommendation  | TBD             | TBD         | Rule testing, human oversight, audit, rollback.                          |
| Attachment PHI cannot be reliably redacted | TBD             | TBD         | Explicit opt-in, warning, minimum necessary attachment scope.            |
| Operational logs accidentally contain PHI  | TBD             | TBD         | Redaction, retention limits, restricted access.                          |
| Email/SMS notification over-discloses PHI  | TBD             | TBD         | Minimal payload policy, template review, opt-in.                         |

## Template 4: PIPEDA and Provincial Adaptation Addendum

Use this addendum for Canadian private-sector deployments outside the Ontario PHIPA scenario, and adapt it for provinces with substantially similar private-sector privacy laws or health-sector statutes. This template is a starting point; the responsible organization must confirm local legal requirements.

### PIPEDA Principle Mapping

| Principle                               | Autorouter PIA response                                                                                                                       |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Accountability                          | Identify accountable organization, service providers, contracts, subcontractors, privacy management program, and audit rights.                |
| Identifying purposes                    | State the specific routing, triage, notification, audit, and support purposes before collection/use.                                          |
| Consent                                 | Document consent or other authority for personal information and sensitive health information processing.                                     |
| Limiting collection                     | Minimize referral fields, attachments, prompt content, email/SMS payloads, and telemetry.                                                     |
| Limiting use, disclosure, and retention | Restrict use to configured routing workflows; prohibit training/product improvement without separate approval; define retention and disposal. |
| Accuracy                                | Validate AI outputs, maintain source-of-truth records in Ocean/customer systems, and correct routing errors.                                  |
| Safeguards                              | Use administrative, technical, and contractual safeguards appropriate to health data sensitivity.                                             |
| Openness                                | Provide notices describing AI-assisted processing, vendors, residency posture, and contact points.                                            |
| Individual access                       | Support access and correction through the accountable organization and relevant source systems.                                               |
| Challenging compliance                  | Provide complaint intake, escalation, investigation, and remediation procedures.                                                              |

### Provincial Adaptation Notes

| Jurisdiction                                            | Adaptation prompt                                                                                                                                                                 |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| British Columbia                                        | Confirm whether BC private-sector law or public-sector residency requirements apply; document any public-body restrictions before using non-BC/non-Canadian services.             |
| Alberta                                                 | Confirm Alberta private-sector and health information requirements, including breach reporting, consent, and service-provider obligations.                                        |
| Quebec                                                  | Confirm Quebec private-sector privacy law requirements, including privacy-by-design, cross-border assessment, transparency, and automated decision requirements where applicable. |
| Saskatchewan, Manitoba, Atlantic provinces, territories | Confirm whether provincial health information statutes, public-sector privacy statutes, and PIPEDA apply to the specific customer and workflow.                                   |
| Federally regulated or interprovincial activity         | Confirm PIPEDA coverage and any sector-specific regulatory expectations.                                                                                                          |

### Cross-Border and Residency Position

The baseline deployment keeps PHI and sensitive personal information in Canada, including AI inference, database, logs, backups, and optional messaging services where feasible. If any transient processing outside Canada is proposed, document:

- what data leaves Canada and why;
- whether the transfer is transient or retained;
- countries and service providers involved;
- contractual, security, and audit safeguards;
- notice and consent/authority implications;
- alternatives considered;
- residual risk accepted by the accountable organization.

## Template 5: AI Processing Addendum

### Model and Inference Configuration

| Field                               | Response                                          |
| ----------------------------------- | ------------------------------------------------- |
| AI provider                         | Amazon Bedrock                                    |
| Foundation model                    | Claude 3 Haiku / Claude Sonnet-family model / TBD |
| Exact model ID                      | TBD                                               |
| Endpoint region                     | `ca-central-1` / TBD                              |
| Inference routing                   | Direct in-region only / Geo / Global / TBD        |
| Prompt data categories              | TBD                                               |
| Output data categories              | TBD                                               |
| Prompt/completion retention         | TBD                                               |
| Bedrock logging enabled?            | TBD                                               |
| Model training on customer prompts? | TBD                                               |
| Human review required?              | TBD                                               |
| Customer-specific opt-in required?  | TBD                                               |

### AI-Specific Risk Questions

- Could model output cause a referral to be sent to the wrong listing, delayed, escalated, or deprioritized?
- Can the user understand why a rule fired and which source fields influenced the result?
- Are prompts constrained to minimum necessary PHI?
- Are attachments excluded by default, and is attachment processing separately approved?
- Are prompts and completions excluded from general-purpose logs, analytics, and training datasets?
- Is there a way to disable AI processing immediately per tenant?
- Is there a monitored error path for failed model calls, hallucinated outputs, malformed JSON, or policy refusals?
- Are model upgrades treated as material changes requiring privacy/security review?
- Are evaluation cases synthetic or privacy-approved?

### AI Controls

| Control                   | Required baseline                                                                                                           |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Tenant opt-in             | AI routing and attachment processing require explicit tenant-level enablement.                                              |
| Minimum necessary prompts | Prompts include only the fields needed by the configured rule.                                                              |
| Structured outputs        | Model outputs should be parsed against expected schemas where practical.                                                    |
| Human oversight           | High-impact or ambiguous routing outcomes should remain reviewable by authorized users.                                     |
| Auditability              | Log rule ID, model ID, action, timestamp, referral event reference, and outcome without storing unnecessary prompt content. |
| Model change control      | Model ID, region, and inference routing changes require review before PHI processing.                                       |
| Disablement               | Operators can disable AI processing or affected rules quickly during incidents.                                             |

## Template 6: Risk Register and Action Plan

| ID      | Risk                                                                                            | Impact      | Likelihood | Pre-mitigation rating | Mitigation                                                                                                 | Owner | Due date | Residual rating | Decision |
| ------- | ----------------------------------------------------------------------------------------------- | ----------- | ---------- | --------------------- | ---------------------------------------------------------------------------------------------------------- | ----- | -------- | --------------- | -------- |
| PIA-001 | Bedrock model or inference profile routes PHI outside Canada contrary to deployment assumption. | High        | TBD        | TBD                   | Allow only approved direct in-region model IDs; monitor config; block geo/global profiles unless approved. | TBD   | TBD      | TBD             | TBD      |
| PIA-002 | Clinical attachments contain PHI that cannot be reliably redacted before AI processing.         | High        | TBD        | TBD                   | Disable by default; explicit opt-in; warning; minimum necessary attachment scope; audit.                   | TBD   | TBD      | TBD             | TBD      |
| PIA-003 | AI output causes incorrect routing or delayed care.                                             | High        | TBD        | TBD                   | Rule testing, human review for high-risk workflows, action audit, rollback path, incident review.          | TBD   | TBD      | TBD             | TBD      |
| PIA-004 | Logs, traces, or error monitoring capture PHI.                                                  | High        | TBD        | TBD                   | Redaction, restricted access, retention limits, secure log storage in Canada, sampling controls.           | TBD   | TBD      | TBD             | TBD      |
| PIA-005 | Email or SMS notification includes excessive PHI.                                               | Medium/High | TBD        | TBD                   | Use minimal templates, avoid clinical detail by default, approve exceptions, audit templates.              | TBD   | TBD      | TBD             | TBD      |
| PIA-006 | Support or administrator access exceeds least privilege.                                        | High        | TBD        | TBD                   | RBAC, just-in-time access, audit logs, support procedures, periodic access review.                         | TBD   | TBD      | TBD             | TBD      |
| PIA-007 | Prompt/completion retention exceeds approved retention.                                         | Medium/High | TBD        | TBD                   | Define retention; avoid storing prompts where possible; disposal job; backup retention review.             | TBD   | TBD      | TBD             | TBD      |
| PIA-008 | Model upgrade changes privacy or accuracy characteristics.                                      | Medium/High | TBD        | TBD                   | Treat model changes as material changes; re-test; update PIA; approval gate.                               | TBD   | TBD      | TBD             | TBD      |

## Decision Log

| Date | Decision                                                    | Rationale                                                                              | Approver | Follow-up                                  |
| ---- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------- | ------------------------------------------ |
| TBD  | Use AWS Canada Central as baseline residency posture.       | Reduces privacy and trust risk for Canadian health data; supports PHIPA/PIPEDA review. | TBD      | Confirm all services and backups.          |
| TBD  | Use Bedrock only with approved in-region model IDs for PHI. | Prevents accidental cross-region inference.                                            | TBD      | Validate model availability and lifecycle. |
| TBD  | Treat attachment processing as high risk and opt-in.        | Attachments may contain unstructured PHI that cannot be reliably redacted.             | TBD      | Add/admin warning and review workflow.     |

## Go-Live Checklist

- PIA workbook and relevant addenda completed.
- Deployment Assumption Record has evidence for every critical assumption.
- Bedrock model ID, region, and inference routing verified.
- PostgreSQL, backups, logs, traces, and object storage region verified.
- Contracts and service-provider obligations reviewed.
- Tenant AI configuration and attachment-processing settings reviewed.
- Email/SMS payload templates reviewed and minimized.
- Retention and disposal jobs documented.
- Incident and breach response path documented.
- Privacy, legal, security, product, and accountable customer/HIC approvals captured.
