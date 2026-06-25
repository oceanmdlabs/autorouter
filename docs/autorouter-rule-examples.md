# Autorouter Rule Examples

This document captures example routing rules and AI-driven actions for Ocean Autorouter. The examples are written as product and implementation references, not as validated clinical policy.

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

Analyze information in the eReferral, including the referring provider, patient information, referral form entries, and referrer. This is typically the first step in a rule. It helps determine context and guide downstream actions such as accepting, forwarding, or sending follow-up communications.

### Attachment Analysis

Analyze and summarize information in attachment files sent with an eReferral. Attachment analysis is typically used early in a rule to inform downstream actions based on content in the attachments.

Attachment analysis should be treated as higher-risk because attachments can contain PHI that cannot be reliably redacted before AI processing. See [Privacy Considerations](privacy/privacy-considerations.md) before enabling this capability for real patient data.

### Triage and Assignment

Automatically assign a referral to the most appropriate provider based on information within the eReferral, or forward the referral to a specific directory listing such as a central intake, regional hub, or provider group.

### Request Management

Accept, decline, or complete a referral automatically when configured conditions are met.

### Messaging

Send an Ocean message to the referrer for clarifications, requests for information, or instructions. Rules can also send email or SMS messages to specific recipients. Based on the contents of an eRequest, a rule can mark it as needing review with a message.

### Decision Support

Warn or block users before submission of a referral based on form inputs. This can provide context-sensitive guidance through Clinical Decision Support integrations, such as warning that a test may not be appropriate for the indicated condition.

### eRequest Type Conversion

Convert an eReferral to an eConsult, or an eConsult to an eReferral, when the configured conditions suggest another request type is more appropriate.

### Metadata Updates

Change the referral health service category, add booking instructions, add comments to the activity log, add AI-generated comments, or flag edge cases for manual review.

---

## KW Pediatric Central Intake Example

This rule implements a Central Intake triage for a pediatric program in Kitchener-Waterloo. When a new referral arrives, the AI categorizes it, applies specialty routing criteria, and sends an email to the central intake coordinator with a list of eligible providers drawn from the directory.

### Rule Configuration

| Field | Value |
|-------|-------|
| **Triggering Event** | `request_received` |
| **Enabled Tools** | `sendEmail` |
| **Allowed Context Fields** | `age`, `directoryListings` |
| **Stop Processing on Match** | Yes |
| **Priority** | (set higher than any other `request_received` rule) |

### Rule Prompt

Paste the following text verbatim into the rule's **Prompt** field. Replace `[INTAKE_EMAIL]` with the actual central intake coordinator email address.

```
You are a central intake coordinator for a pediatric program in Kitchener-Waterloo.

A new referral has arrived. Your job is to:
1. Categorize the referral using the taxonomy below.
2. Identify which providers from the Provider Directory are eligible for this referral using the specialty routing criteria below.
3. Send an email to the intake coordinator with the categorization and a ranked list of eligible providers.

---

## Step 1 — Categorize the Referral

Assign exactly one primary category and one subcategory:

**Medical**
- Medical — Neonate (patient is < 30 days old)
- Medical — Infant (patient is 1 month to 12 months old)
- Medical — Child (patient is > 12 months old)

**Development**
- Development (includes Autism Spectrum Disorder / ASD referrals)

**Behaviour**
- Behaviour — Young Child (patient is < 4 years old)
- Behaviour — School Age+ (patient is ≥ 4 years old)

**Mental Health**
- Mental Health

---

## Step 2 — Identify Eligible Providers Using Specialty Routing Criteria

The Provider Directory is appended below. Each entry includes a provider name and description.

Apply the following specialty rules FIRST before considering general pediatric providers:

### Specialty Criteria

**Eating Disorders**
If the referral concern involves an eating disorder (anorexia, bulimia, ARFID, restrictive eating, weight loss due to disordered eating, etc.):
→ Eligible providers: Jodi Rosner, Jessica Norris ONLY. Do not suggest general pediatric clinics.

**Gender-Affirming Care**
If the referral involves gender-affirming care, gender dysphoria, or gender identity support:
→ Eligible provider: Martha Linkletter ONLY. Do not suggest general pediatric clinics.

**Diabetes — Already Diagnosed**
If the patient already has a confirmed diagnosis of Type 1 or Type 2 diabetes:
→ Eligible provider: Diabetes Central Referral. Do not suggest other providers.

**Diabetes — Not Yet Diagnosed / Screening**
If the referral concern is for possible diabetes, glucose abnormalities, or screening (not a confirmed diagnosis):
→ Eligible providers: Jodi Rosner, Tasha Stoltz, Ian Wilson.

**Cystic Fibrosis**
If the referral involves cystic fibrosis or CF-related concerns:
→ Eligible provider: Jason McConnery ONLY. Do not suggest general pediatric clinics.

### General Pediatric Routing (No Specialty Match)

If none of the specialty criteria above apply, the eligible providers are the general pediatric clinics and individual pediatricians listed in the Provider Directory (anyone not exclusively reserved for a specialty above).

---

## Step 3 — Send the Email

Send an email with the following details:

- **To:** [INTAKE_EMAIL]
- **Subject:** `[Central Intake] New Pediatric Referral — {category} — {patient age if available}`
- **Message body:**

```
New pediatric referral received.

Category: {primary category} — {subcategory}
{If age is known: Patient Age: {age}}

Reason for categorization: {1–2 sentence explanation citing the referral details that led to this category}

---

Eligible Providers:

{Numbered list of eligible providers from the directory, including their Ocean reference and a one-line note on why they are eligible}

---

Note: This suggestion was generated automatically by the Autorouter based on the referral details. Please verify eligibility before contacting providers.
```

Only call sendEmail once. If no providers are eligible based on the criteria above, send the email with "No eligible providers identified — please review manually."
```

### Directory Setup

For this rule to work, add each provider as a Healthcare Service listing in the admin UI (**Listings** page). The description field is what the AI reads — be specific. Example entries:

| Name | Ocean Reference | Description |
|------|----------------|-------------|
| KW Peds Care | `kwpedscare` | General pediatric clinic accepting Medical, Development, Behaviour, and Mental Health referrals for all pediatric age groups. |
| Kid Crew | `kidcrew` | General pediatric clinic accepting Medical, Development, Behaviour, and Mental Health referrals for all pediatric age groups. |
| Andrew St Pediatrics | `andrewstpeds` | General pediatric clinic accepting Medical, Development, Behaviour, and Mental Health referrals for all pediatric age groups. |
| Jodi Rosner | `jodirosner` | Pediatric specialist. Accepts: Eating Disorders; Diabetes (not yet diagnosed / screening); general pediatric referrals. |
| Jessica Norris | `jessicanorris` | Pediatric specialist. Accepts: Eating Disorders only. |
| Martha Linkletter | `marthalinkletter` | Pediatric specialist. Accepts: Gender-Affirming Care only. |
| Diabetes Central Referral | `diabetescentral` | Centralized referral pathway for pediatric patients with a confirmed diabetes diagnosis. |
| Tasha Stoltz | `tashastoltz` | Pediatric specialist. Accepts: Diabetes (not yet diagnosed / screening); general pediatric referrals. |
| Ian Wilson | `ianwilson` | Pediatric specialist. Accepts: Diabetes (not yet diagnosed / screening); general pediatric referrals. |
| Jason McConnery | `jasonmcconnery` | Pediatric specialist. Accepts: Cystic Fibrosis only. |
