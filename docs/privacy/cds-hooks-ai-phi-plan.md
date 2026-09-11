# CDS Hooks AI/PHI Architecture Plan

**Last reviewed:** 2026-09-11

**Decision:** The architecture is sound. PHI-enabled implementation is gated by the [AI and PHI policy](ai-phi-policy.md).

## Recommended Shape

Build a thin CDS Hooks profile within the Autorouter codebase rather than a separate bespoke service. Reuse its authentication, tenant configuration, deployment, audit, and Ocean integration boundaries while omitting unrelated routing actions and user-interface baggage from the request path.

The rule owner should write a concise, versioned instruction set, but the system should not be an unrestricted “custom prompt” endpoint. Convert the instruction set into a bounded policy with enumerated outcomes, structured inputs, a fixed output schema, deterministic post-processing, and reviewed card templates.

## Responsibility Split

| Layer                           | Responsibility                                                                                                                                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ocean configuration             | Health service categories, listing descriptions, explicit form questions, provider availability, stated wait times, and “first available” preferences.                                                                 |
| Deterministic Autorouter policy | Age, geography/catchment, explicit exclusions, urgency flags, provider availability, wait-time comparison, and any rule that can be reliably evaluated from structured data.                                           |
| LLM classifier                  | Only semantic classification that genuinely requires interpreting free-text referral content. Return a bounded enum plus limited evidence references; do not generate executable actions or free-form clinical advice. |
| CDS Hooks response builder      | Combine deterministic facts and the validated classification into pre-approved cards and suggestions.                                                                                                                  |
| Clinician/referrer              | Review the recommendation and remain responsible for the referral decision.                                                                                                                                            |

Examples from the pediatric pilot that should be handled without AI include configuring Ocean health service categories such as eating disorders or diabetes, publishing different wait times, adding explicit referral-form questions, and placing acceptance/catchment constraints in listing descriptions. AI is reserved for concepts that cannot be reliably represented as structured answers, such as detecting a likely mental-health referral in free text.

## Request Path

1. Validate the CDS Hooks request, tenant, listing, hook, and authorized configuration version.
2. Apply the tenant AI opt-in and global/provider kill switches before reading or assembling PHI for AI.
3. Extract only the structured facts and minimum free-text fields needed by the rule.
4. Evaluate all deterministic conditions first. If they fully determine the result, do not call a model.
5. If semantic classification is necessary, make one regional, bounded model call for the request. Do not make a separate call for every rule.
6. Validate the response against a strict schema and allowlisted enum. Reject malformed, ungrounded, or out-of-policy output.
7. Apply deterministic policy to the combined facts. The model does not choose the destination or action directly.
8. Return standards-conformant CDS Hooks cards with clear source, indicator, rationale, and actionable suggestions where appropriate.
9. Record a sanitized audit event without prompt, completion, clinical text, or attachment content.

The safe failure mode is no AI-derived card plus a sanitized operational event. It must not delay or block the referral workflow.

## Delivery Sequence

### Phase 0: privacy and vendor gate

- Approve the exact purpose, data inventory, authority, HIC/vendor roles, and minimum necessary prompt.
- Complete the provider review, contracts, PIA, TRA, and AI/clinical safety assessment.
- Select and pin an exact Canadian in-region model that meets the retention requirements.
- Remediate the implementation gaps below and produce deployment evidence.

### Phase 1: deterministic pilot with synthetic data

- Configure Ocean categories, wait times, listing descriptions, and form fields.
- Implement deterministic age, catchment, urgency, and availability checks.
- Validate CDS Hooks interoperability and card wording without any live PHI or model call.

### Phase 2: semantic evaluation

- Build a representative synthetic or privacy-approved de-identified test set.
- Compare a single bounded classifier against clinician-reviewed labels.
- Define acceptance thresholds, abstention behaviour, error analysis, and known limitations.

### Phase 3: controlled live shadowing

- Begin only after every production gate in the AI/PHI policy is approved.
- Run the classifier without influencing referral disposition.
- Review sampled outcomes under an approved access and retention protocol.

### Phase 4: advisory CDS pilot

- Show recommendations to authorized users with an explanation and explicit human choice.
- Monitor misclassification, override, misroute, delay, provider drift, and false reassurance.
- Expand to more rules or listings only through change control.

## Current Repository Gaps to Resolve Before Live PHI

These observations describe the repository as reviewed on 2026-09-11 and must be revalidated before implementation:

- `src/infrastructure/services/ai.service.ts` uses the API-key-based `@ai-sdk/google` provider rather than an enterprise Vertex/Agent Platform workload identity and pinned regional project configuration.
- `src/entities/models/site-configuration.ts` stores an AI API key and model but does not make the approved provider project/account, region, endpoint, retention posture, or fallback policy first-class controlled configuration.
- `src/infrastructure/services/evaluate-rule.service.ts` logs the full prompt. This is prohibited for PHI.
- `src/infrastructure/services/prompts/service-request-summarizer.ts` describes its input as excluding PII while including provider names, identifiers, and addresses; free text can also contain patient identifiers. The workflow must assume PHI unless proven otherwise.
- The CDS endpoint must enforce tenant AI opt-in and provider readiness before assembling or transmitting model input.
- The current evaluation loop can call the model once per rule. The CDS profile should classify once and apply deterministic policy locally.
- CDS cards and suggestions require a standards/interoperability review, including suggestion action semantics and `selectionBehavior` where applicable.

## Explicit Non-Goals for the First Pilot

- autonomous clinical triage or diagnosis;
- automatic rejection, redirection, urgency assignment, or deprioritization based only on an LLM;
- attachment summarization;
- web/search/maps grounding, agents, RAG, long-lived memory, or conversational history;
- cross-region or global model fallback;
- storing prompts, completions, or full referral payloads for analytics.
