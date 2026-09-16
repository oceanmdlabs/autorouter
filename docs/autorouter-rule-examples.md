# Autorouter Rule Examples

This document captures example routing rules and AI-driven actions for Ocean Autorouter. The examples are written as product and implementation references, not as validated clinical policy.

## Ontario eReferral Network Use Cases

These scenarios describe opportunities that may be relevant in an eReferral Ontario network context, including standardized referral forms, PCCG, central intake models, and Ocean integrations. They should be interpreted as implementation options that require local policy, privacy, and workflow review.

### Eligibility Criteria

Many clinics accept referrals only when specific eligibility criteria are met, such as age range, catchment area, OHIP eligibility, registered provider status, or other service-specific rules. In a standardized referral form model, these criteria may be described in directory listing text rather than captured through custom receiver form fields.

Autorouter can support eligibility rules when the required data is available in the referral payload or in Autorouter configuration:

- Referral form answers can be used for structured eligibility criteria.
- Age and gender can be used where present and appropriate.
- Patient postal code prefix is optionally available when authorized and configured. Only the first three characters, such as `M2L`, should be exposed to routing logic for catchment-style rules.
- Other demographic fields are intentionally excluded by default for privacy and data-minimization reasons. Selective inclusion should require a clear use case and appropriate authorization.
- Ocean directory listing descriptions are not read directly by Autorouter. If eligibility criteria are maintained only in listing text, they need to be represented separately in Autorouter's listing/routing configuration before rules can evaluate them.

Example:

- Forward referrals whose authorized postal code prefix falls within a configured catchment area.
- Add a comment or review flag when a structured form answer indicates that a clinic-specific eligibility requirement is not met.

### Attachment Completeness and Triage

Attachments are often required for clinical triage, such as imaging reports, lab results, or referral letters. Autorouter can analyze attachments after a referral has been sent, provided attachment analysis is explicitly enabled for the tenant and rule.

Attachment analysis can support rules such as:

- Verify that a required attachment appears to be present.
- Extract dates from reports, for example checking whether an x-ray report is within a six-month window.
- Summarize key findings for receiver triage.
- Flag referrals for manual review when attachments are missing, stale, unreadable, or inconclusive.

Pre-submission CDS Hooks checks cannot currently inspect attachments, so pre-send decision support should rely on structured form answers or other fields available before submission. Attachment-based checks should be treated as post-send triage, review, or follow-up workflows.

### Central Intake Routing

Central intake workflows commonly route referrals based on location, clinician, service type, availability, or wait time. Autorouter can support central intake routing when the required routing data is maintained in configuration or supplied through an integration.

Example:

- Route to a specific location, clinician, or listing based on selected service, catchment area, referral details, or configured wait-time data.
- Use manually maintained wait-time information where no dynamic integration is available.
- Prefer the shortest appropriate wait time when multiple destinations meet the clinical and operational criteria.

### Triage Priority Recommendations

Some clinical pathways include indications that map to different urgency levels. For example, a colposcopy referral indication such as `VIN 1` may be lower priority than `squamous carcinoma`.

Autorouter can read referral form answers and other referral content to infer a recommended triage priority or handling pathway. Current Ocean eReferral FHIR API limitations prevent Autorouter from setting the discrete referral `Priority` field directly. Instead, a rule can add a triage comment, activity log note, category update, or manual-review flag that makes the priority recommendation visible to the receiving team.

Example:

- Add a triage comment such as `Recommended priority: high, based on selected indication squamous carcinoma.`
- Mark the referral as needing review when form answers suggest urgent handling but required supporting information is missing.

## Active Rules Summary

### Cardiology Clinic Example

#### Rule 1: Chest Pain Clinic Review Required

Criteria:

- Trigger when the patient has one or more active issues suggesting possible cardiac chest pain, including:
  - New onset or exertional chest pain.
  - Severe chest pain at rest.
  - Chest pain associated with syncope.
  - No previous cardiologist involvement.
  - Moderate to high suspicion of a cardiac cause.

Action:

- Send an urgent alert email to `[recipient required]`.
- Use subject: `eReferral: Potential CHEST PAIN CLINIC REVIEW REQUIRED`.
- Include a message body that describes the nature of the request and why it is urgent.

Tools:

- Email

#### Rule 2: Urgent Cardiology Referrals Needing Triage

Criteria:

- Trigger when the patient has one or more active issues requiring urgent cardiology triage, including:
  - Unstable angina, such as new exertional chest pain.
  - Acute coronary syndrome.
  - Syncope with exertion.
  - Critical aortic stenosis or mitral stenosis.

Action:

- Send an urgent alert email to `[recipient required]`.
- Use subject: `eReferral: URGENT REVIEW REQUIRED`.
- Include a message body that describes the nature of the request and why it is urgent.

Tools:

- Email

### Outpatient Clinic Example

#### Rule 1: Rheumatology Clinic Injection

Criteria:

- Trigger when the referral indicates that it is for an injection in the reason for referral field or an equivalent labeled field, such as `Clinical question`, `Referral reason`, or the main referral free text.
- Use a case-insensitive contains match for `injection` or clear injection phrasing such as `inject`.

Exclusion logic:

- Skip the rule when the injection site is one of the excluded sites:
  - Spine.
  - Achilles.
  - Plantar fascia.
- Match excluded sites case-insensitively.
- If any excluded term is present, skip the rule and leave the referral in `new`.
- If the injection site cannot be determined because no anatomical site is mentioned, skip the rule and leave the referral in `new`.

Validation logic:

- Notification email recipients must be explicitly provided by site configuration or rule setup.
- The notification email subject and message body must be explicitly provided.

Actions, in order:

1. Accept the referral by calling the change status tool and setting the status to `accepted`.
2. Send a notification email:
   - To: `[configured clinic recipients]`
   - Subject: `New Rheumatology Clinic Injection Referral Accepted`
   - Message body: `A Rheumatology clinic injection met the criteria to be automatically accepted based on the rule defined in AutoRouter. This referral will now be in the 'pending booking' folder in Ocean.`

Tools:

- Email
- Accept
- Decline
- Complete

#### Rule 2: Diagnostic Imaging for Obstetrical Ultrasound

Criteria:

- Trigger when it can be reasonably inferred from the referral contents that the patient requires an obstetrical ultrasound.
- Referral contents may include clinical notes, the reason for referral, or requested exams.

Matching examples:

- Direct phrases:
  - `OB US`
  - `Pregnancy scan`
- Clinical indicators:
  - `LMP`
  - `EDC`
  - `EDD`
  - `Gestational age`
- Specific exams:
  - `Dating ultrasound`
  - `Nuchal Translucency (NT) scan`
  - `Anatomy scan`
  - `20-week screen`
  - `BPP`

Logic:

- If the criteria are false, skip the rule and leave the referral in `new`.

Actions, in order:

1. Reject the referral with this reason: `Unfortunately, we do not currently provide obstetrical ultrasound services at our site.`
2. Send a notification email:
   - To: `[recipient required]`
   - Subject: `A referral for obstetrical ultrasound has been auto rejected`
   - Message body: `A referral for an obstetrical ultrasound has been auto rejected by AutoRouter. The requester will receive an email notification of the rejection with the following reason: Unfortunately, we do not currently provide obstetrical ultrasound services at our site. This will also be present in the Ocean eReferral.`

Tools:

- Email
- Accept
- Decline
- Complete

#### Rule 3: Geriatric Referral Summaries

Criteria:

- Trigger when a geriatrics referral is received.

Action:

- Summarize all received documentation in the format of a consult note.
- Notify the configured clinic recipients.

Tools:

- Analyze and summarize attachments

### Multi-Specialty Clinic Example

#### Rule 1: Auto-Reject Vasectomy

Condition:

- Trigger when at least one of the following conditions is true:
  - Priority 1: The primary purpose is for a vasectomy, using a case-insensitive contains match for terms such as `vasectomy referral` or `booking vasectomy`. Exclude terms found only in past medical history.
  - Priority 2: The specialty is `urology` or `pediatric urology` and the referral contains explicit urgency markers such as `urgent`, `ASAP`, `stat`, or `emergent`.

Actions, in order:

1. Decline the referral with the applicable reason:
   - Vasectomy reason: `We have automatically declined this referral because this clinic no longer provides vasectomy procedures.`
   - Urgent urology reason: `This urgent urology referral has been declined. This clinic does not handle urgent urology cases. Please direct the patient to a hospital for urgent assessment.`
2. Send an email notification:
   - To: `[recipient required]`
   - Subject: `Notification: Referral Auto-Rejected`
   - Message body: `This is to inform you that a referral has been automatically rejected by the AutoRouter system based on established clinic rules.`

Tools:

- Accept
- Decline
- Complete
- Email

## Choosing Wisely CDS Hook Example

### Imaging for Lower-Back Pain

Recommendation:

- Do not order imaging for lower-back pain unless red flags are present.

Red flags include:

- Suspected epidural abscess or hematoma presenting with acute pain, even without neurological symptoms. Urgent imaging is required.
- Suspected cancer.
- Suspected infection.
- Cauda equina syndrome.
- Severe or progressive neurologic deficit.
- Suspected compression fracture.

Additional logic:

- In patients with suspected uncomplicated herniated disc or spinal stenosis, imaging is only indicated after at least a six-week trial of conservative management and when symptoms are severe enough that surgery is being considered.

Example order:

- `Lumbar spine x-ray please for mechanical low back pain with no red flags.`

Example rule:

- `Radiology Choosing Wisely`

## High-Level Applications: AI-Driven Actions

These are the main categories of automated actions the AI can take based on rule configuration.

### eReferral Analysis

Analyze information in the eReferral, including the referring provider, available patient information, referral form entries, and referrer. This is typically the first step in a rule. It helps determine context and guide downstream actions such as accepting, forwarding, or sending follow-up communications.

Patient data should remain limited to the minimum necessary fields for the configured use case. Age and gender may be available. Postal-code prefix, limited to the first three characters, is an optional newly implemented input for authorized catchment-style routing rules. Broader demographic fields are excluded by default unless there is a specific approved need.

### Attachment Analysis

Analyze and summarize information in attachment files sent with an eReferral. Attachment analysis is typically used early in a rule to inform downstream actions based on content in the attachments.

Attachment analysis is available after referral submission. Pre-submission CDS Hooks checks cannot currently read attachment contents.

Attachment analysis should be treated as higher-risk because attachments can contain PHI that cannot be reliably redacted before AI processing. See [Privacy Considerations](privacy/privacy-considerations.md) before enabling this capability for real patient data.

### Triage and Assignment

Automatically assign a referral to the most appropriate provider based on information within the eReferral, or forward the referral to a specific directory listing such as a central intake, regional hub, or provider group. Rules can use configured listing metadata, service constraints, wait-time data, and authorized referral inputs. Autorouter does not directly read Ocean directory listing descriptions; relevant eligibility or service constraints must be represented in Autorouter configuration.

### Request Management

Accept, decline, or complete a referral automatically when configured conditions are met.

### Messaging

Send an Ocean message to the referrer for clarifications, requests for information, or instructions. Rules can also send email or SMS messages to specific recipients. Based on the contents of an eRequest, a rule can mark it as needing review with a message.

### Decision Support

Warn or block users before submission of a referral based on form inputs and other fields available to the CDS Hooks workflow. This can provide context-sensitive guidance through Clinical Decision Support integrations, such as warning that a test may not be appropriate for the indicated condition. Pre-submission decision support should not depend on attachment contents because attachments are not available to the CDS Hooks check.

### eRequest Type Conversion

Convert an eReferral to an eConsult, or an eConsult to an eReferral, when the configured conditions suggest another request type is more appropriate.

### Metadata Updates

Change the referral health service category, add booking instructions, add comments to the activity log, add AI-generated comments, or flag edge cases for manual review. Autorouter can recommend triage priority in comments or review notes, but it cannot currently set Ocean's discrete referral `Priority` field through the eReferral FHIR API.

## Central Intake Safety Constraint

Central-intake workflows must not ask a model to choose an eligible provider,
rank destinations, or compose and send clinical outreach directly. Provider
eligibility, exclusions, catchment, availability, and destination selection
must be represented as structured configuration and evaluated
deterministically.

Where approved, a model may return one bounded semantic classification for
free-text content. Deterministic policy must then map that classification to
eligible providers and reviewed card or message templates. A human remains
responsible for confirming the recommendation. Until the production gates in
the AI/PHI policy are complete, develop and evaluate this workflow only with
synthetic or privacy-approved de-identified data.
