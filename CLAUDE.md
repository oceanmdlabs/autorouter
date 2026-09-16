# Ocean Autorouter — Architecture Reference

## What the Autorouter Is

Ocean Autorouter is an intelligent routing automation system for **Ocean eReferral and eConsult workflows** — a Canadian health care referral platform. It watches for FHIR messaging events (new referrals, status changes, patient form completions) from Ocean, uses an LLM to evaluate configurable rules against each event, and executes "routing actions" automatically (accept/decline, forward, SMS, email, comment, etc.).

The product goal: reduce manual intake work for specialist clinics by automating common triage and routing decisions.

**Every feature either adds an event type, adds a tool, improves evaluation logic, or improves auditability.**

---

## Architecture Pattern: Clean Architecture

```
src/entities/          — domain models + application context (DI container)
src/application/       — use cases + repository/service interfaces
src/infrastructure/    — concrete implementations (DB, AI, Ocean, email, SMS)
server/                — Nuxt/Nitro API routes + auth middleware
app/                   — Vue admin UI (pages, components)
drizzle/               — DB schema + SQL migrations
infrastructure/cdk/    — AWS CDK deployment
```

---

## How Events Enter the System

### 1. FHIR Service Request Events (eReferrals/eConsults)
- **Entry:** Ocean pushes FHIR R4 Bundle to `POST /fhir/messaging` → `server/api/fhir/[...fhirPath].ts`
- **Controller:** `src/infrastructure/adapters/controllers/process-message.controller.ts`
- **Flow:**
  1. Parse FHIR Bundle → extract `ServiceRequestEventContext` (event type, referral ref, provider names)
  2. Archive eRequest if `erequestArchivalEnabled` (for cross-event matching)
  3. Load attachments if an active rule needs `summarizeAttachments`
  4. `processServiceRequestEventUseCase` → evaluate rules → execute actions → write audit

### 2. Patient Engagement Events (Patient Portal Webhooks)
- **Entry:** Ocean Open API sends webhook to `POST /api/openapi/webhook/[clientId]`
- **Entry file:** `server/api/openapi/webhook/[clientId].ts`
- **Flow:**
  1. Validate webhook + rate-limit + replay protection
  2. Fetch patient + note from Ocean Open API
  3. `processPatientEngagementEventUseCase` → evaluate rules → execute actions → write audit
  4. Additionally fires `intake_questionnaire_completed` if archival is enabled and a matching archived referral is found

### 3. CDS Hooks (Pre-submission)
- **Entry:** `server/api/cds/cds-services/order-sign-cds.ts`
- Uses `request_pre_submission` event type; only `showCdsCard` tool is available

---

## Core Processing Pipeline

| Step | File |
|------|------|
| FHIR inbound controller | `src/infrastructure/adapters/controllers/process-message.controller.ts` |
| Service request use case | `src/application/use-cases/process-service-request-event.use-case.ts` |
| Patient engagement use case | `src/application/use-cases/process-patient-engagement-event.use-case.ts` |
| Intake questionnaire use case | `src/application/use-cases/process-intake-questionnaire-completed.use-case.ts` |
| Rule evaluation loop | `src/application/use-cases/evaluate-rules-in-order.ts` |
| Per-rule AI evaluation | `src/infrastructure/services/evaluate-rule.service.ts` |
| AI service (LLM calls) | `src/infrastructure/services/ai.service.ts` |
| Tool execution | `src/infrastructure/services/routing-tool-action.service.ts` |
| Tool registry | `src/infrastructure/services/routing-tools/routing-tool-registry.ts` |
| Ocean FHIR client | `src/infrastructure/services/ocean-client.service.ts` |
| Ocean message builders | `src/infrastructure/services/ocean-message.service.ts` |
| LLM audit writer | `src/application/use-cases/write-decision-audits.ts` |
| Archive eRequest | `src/application/use-cases/archive-erequest.use-case.ts` |
| Match archived eRequest | `src/application/use-cases/match-archived-erequest.ts` |

---

## Key Domain Models

| Model | File |
|-------|------|
| RoutingRule | `src/entities/models/routing-rule.ts` |
| RoutingEventType | `src/entities/models/routing-event-type.ts` |
| RuleEvaluationResult | `src/entities/models/routing-evaluation.ts` |
| SiteConfiguration | `src/entities/models/site-configuration.ts` |
| ApplicationContext (DI container) | `src/entities/models/application-context.ts` |
| ServiceRequestEventContext | `src/entities/models/service-request-event-context.ts` |
| PatientEngagementEventContext | `src/entities/models/patient-engagement-event-context.ts` |
| RoutingTool definition type | `src/entities/models/routing-tool.ts` |
| Attachment | `src/entities/models/attachment.ts` |

---

## RoutingRule Fields

- `triggeringEvent` — which event type fires this rule
- `prompt` — natural language instructions for the LLM (what to do and when)
- `enabledTools` — which tools the LLM is allowed to call (`RoutingToolName[]`)
- `allowedContextFields` — patient data fields exposed to AI: `age`, `gender`, `postalCode`, `attachments`
- `priority` — numeric, higher runs first; ties by `createdAt asc` then `id asc`
- `stopProcessingOnMatch` — if true, skips all later rules when this rule fires with valid actions
- `active` — inactive rules are skipped and logged as such
- `summarizeAttachmentsAcknowledged` — privacy gate required to enable `attachments` context field

---

## Event Types (All 10)

```
request_pre_submission           — CDS hook, before referral submitted
request_received                 — new inbound referral
request_updated                  — (avoided — noisy + causes recursive processing)
request_cancelled                — referral cancelled
request_accepted                 — referral accepted
request_declined                 — referral declined
request_message                  — new message on a referral
patient_message_forms_completion — patient completed Ocean forms
patient_note_added               — patient added a note
intake_questionnaire_completed   — cross-event: intake forms + matched archived referral
```

---

## Routing Tools (All 13)

Defined in `src/infrastructure/services/routing-tools/routing-tool-registry.ts`:

| Tool | Action | Handler |
|------|--------|---------|
| `changeStatus` | Accept/decline/complete referral | `handlers/change-status-handler.ts` |
| `forward` | Forward to another listing | `handlers/forward-handler.ts` |
| `assign` | Assign to specific provider | `handlers/assign-handler.ts` |
| `sendCommunicationToRequester` | Message to referring doctor | `handlers/send-communication-handler.ts` |
| `setBookingInstructions` | Set booking info | `handlers/set-booking-instructions-handler.ts` |
| `toggleEConsult` | Enable/disable eConsult | `handlers/toggle-econsult-handler.ts` |
| `updateCategory` | Change referral category | `handlers/update-category-handler.ts` |
| `markAsNeedsReview` | Flag for manual review | `handlers/mark-as-needs-review-handler.ts` |
| `sendSms` | SMS to phone number (Twilio or AWS) | `handlers/send-sms-handler.ts` |
| `sendEmail` | Email to address (SMTP2GO or SES) | `handlers/send-email-handler.ts` |
| `comment` | Add comment to referral | `handlers/comment-handler.ts` |
| `summarizeAttachments` | AI attachment summary (context-only) | `handlers/summarize-attachments-handler.ts` |
| `showCdsCard` | CDS card response (pre-submission only) | no handler — response only |

---

## AI Integration

- **Vercel AI SDK** (`generateText` with tool calling, `generateObject`, multimodal)
- **Providers per tenant** (configured in SiteConfiguration):
  - `openai` (default: `gpt-4.1-mini`)
  - `google` (default: `gemini-2.5-flash-preview-05-20`)
  - `cohere` (default: `command-a`)
  - `bedrock` (default: `anthropic.claude-3-sonnet-20240229-v1:0`)
- Per rule evaluation: builds prompt + filtered tool set → AI returns tool calls → those become `actions`
- Attachment summarization: multimodal `generateText` called once before the rule loop, cached on `event.attachmentSummary`
- AI opt-out: checks FHIR `QuestionnaireResponse` for `ai_opt_out` field before processing

**LLM Prompts:**
- Service request rules: `src/infrastructure/services/prompts/evaluate-service-request-rule-prompt.ts`
- Patient engagement rules: `src/infrastructure/services/prompts/evaluate-pe-rule-prompt.ts`

---

## Multi-Tenancy

- All DB tables have `tenant_id`. Every repository query is tenant-scoped.
- `ApplicationContext.getTenantId()` returns current tenant from session (`user.activeTenantId ?? user.tenantId`).
- A user can belong to multiple tenants (`tenant_memberships`) and switch with `activeTenantId`.
- Each tenant has one `SiteConfiguration` (Ocean credentials + AI/email/SMS config).
- The `clientId` in SiteConfiguration routes patient engagement webhooks to the correct tenant.

---

## Database Schema (`drizzle/schema.ts`)

| Table | Purpose |
|-------|---------|
| `routing_rules` | Core rules with priority, tools, prompt |
| `site_config` | Per-tenant credentials (all secrets encrypted) |
| `activity_log_entry` | Audit trail of every processed event |
| `llm_rule_decision_audit` | Per-rule LLM decision record (EXECUTE/SKIP/ERROR) |
| `llm_rule_tool_execution_audit` | Per-tool execution record with timing |
| `erequests` | Archived referral bundles for cross-event matching |
| `erequest_blobs` | Stored attachment binaries (filesystem or S3) |
| `healthcare_services` | Named Ocean listings for admin UI |
| `test_service_requests` | Sample FHIR bundles for testing |
| `privacy_audit_log` | PHI access audit trail |
| `users` | OAuth users (Google or GitHub) |
| `tenant_memberships` | User ↔ tenant association with role |
| `tenant_invites` | Time-limited invite links |
| `system_admin_allowlist` | Super-admins by OAuth provider+subject |

**Migration policy: always use `npm run db:migrate:generate` — never write SQL migration files by hand.**

---

## SiteConfiguration Key Fields

- `clientId` / `clientSecretEncrypted` — inbound FHIR auth credentials
- `oceanServer` — `ocean | test | staging | local`
- `oceanSiteNum` — 4-7 digit Ocean site number
- `oceanClientId` / `oceanClientSecretEncrypted` — OAuth2 for Ocean outbound API
- `aiProvider` / `aiApiKeyEncrypted` / `aiModel` — LLM config
- `emailProvider` / `emailApiKeyEncrypted` + `emailSendAllowlist` — email config
- `smsProvider` + `smsSendAllowlist` — SMS config (Twilio or AWS)
- `siteKeyEncrypted` / `siteCredentialEncrypted` / `sharedEncryptionKeyEncrypted` — Ocean Open API
- `erequestArchivalEnabled` — enables archival pipeline for cross-event matching

---

## External Integrations

| System | How | Files |
|--------|-----|-------|
| Ocean FHIR inbound | Receives FHIR R4 Bundles | `server/api/fhir/[...fhirPath].ts` |
| Ocean FHIR outbound | Sends FHIR $process-message | `src/infrastructure/services/ocean-client.service.ts` |
| Ocean Open API | Fetches patients/notes | `server/api/openapi/open-api-client.ts` |
| Twilio | SMS | `src/infrastructure/services/sms/twilio-sms-service.ts` |
| AWS SNS | SMS alternative | `src/infrastructure/services/sms/aws-sms-service.ts` |
| SMTP2GO | Email | `src/infrastructure/services/email/smtp2go-email-service.ts` |
| AWS SES | Email alternative | `src/infrastructure/services/email/ses-email-service.ts` |
| S3 / Filesystem | Blob/attachment storage | `src/infrastructure/services/blob-storage/` |

---

## Admin UI Pages (`app/pages/portal/`)

| Page | Purpose |
|------|---------|
| `routing-rules/` | List, create, edit, reorder rules |
| `site-configuration/` | Ocean creds, AI/email/SMS settings |
| `testing/` | Simulate events; manage test FHIR bundles |
| `erequests/` | Browse archived referrals |
| `activity/` | Activity log of processed events |
| `audit/` | LLM decision + tool execution audit explorer |
| `listings/` | Manage named healthcare services |
| `members/` | Team management + invite links |

---

## Server API Routes (`server/api/`)

| Route | Purpose |
|-------|---------|
| `fhir/[...fhirPath].ts` | FHIR inbound + OAuth2 token exchange |
| `openapi/webhook/[clientId].ts` | Patient engagement webhook receiver |
| `openapi/open-api-client.ts` | Calls Ocean Open API |
| `routing-rules/` | CRUD + reorder |
| `erequests/` | Archive viewer |
| `healthcare-services/` | CRUD for listings |
| `site-configuration/` | Config CRUD + connection test |
| `test-service-requests/` | Sample bundles CRUD + simulate |
| `cds/cds-services/` | CDS hooks discovery + order-sign |
| `activity-logs/` | Activity log read + clear |
| `llm-audit/` | LLM decision audit read |
| `oauth2/token.post.ts` | Inbound OAuth2 token endpoint |
| `auth/` | Session management |

---

## eRequest Archival + Cross-Event Matching

When `erequestArchivalEnabled`:
1. Every `request_received` event stores a structured copy of the FHIR Bundle to the `erequests` table
2. Attachments stored to `erequest_blobs` (filesystem or S3)
3. On `patient_message_forms_completion`: attempt to match the patient to an archived referral by MRN+DOB → healthNumber+DOB → name+DOB (recency tiebreak on ties)
4. If matched, fires `intake_questionnaire_completed` so rules can act on the original referral using the patient's new intake data

Key files: `src/application/use-cases/archive-erequest.use-case.ts`, `src/application/use-cases/match-archived-erequest.ts`, `src/application/use-cases/process-intake-questionnaire-completed.use-case.ts`

---

## Rule Execution Design (Current State)

- Rules run in priority order (higher priority first)
- `stopProcessingOnMatch` skips all later rules when a rule fires with valid, error-free actions
- Conflict detection is designed but not yet implemented — see `docs/rule-execution-design.md` (Slice 3) and `src/entities/models/conflict-analysis.ts`
- Testing UI runs evaluate-only (no side effects) — sandbox execution is a future slice
