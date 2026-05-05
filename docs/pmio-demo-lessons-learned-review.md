# PMIO Demo Lessons Learned Review

This note reviews the feedback captured in `PHSA Autorouter PoC #1 - PMIO Demo - Lessons Learned.pdf` dated April 20, 2026 and maps it to the current codebase.

Important context:

- The PDF was written against an older UI and deployment experience.
- Some observations are still accurate product constraints.
- Some are now partially outdated because the app UI and infra have changed.
- This document treats the repo as an open-source reference implementation and identifies good next steps for making those constraints clearer and more extensible.

## What Still Holds

### 1. The model only reasons over data it is given

This is still the core constraint.

- Service-request rule evaluation is built from the referral event payload plus the rule prompt in [src/infrastructure/services/prompts/evaluate-service-request-rule-prompt.ts](../src/infrastructure/services/prompts/evaluate-service-request-rule-prompt.ts).
- Rules do not currently fetch live EMR data, scheduling data, or Ocean wait-time data during evaluation.
- If a rule depends on data that is not present in the referral or prompt, users currently have to encode that information manually in the prompt or avoid automating that decision.

Implication for docs:

- We should state plainly that prompt quality matters because the model has no hidden access to local operational context.
- We should also state that hardcoding dynamic operational facts such as wait times into prompts is acceptable for demos but weak for production.

### 2. Rule overlap and collisions are a real operational risk

This remains accurate.

- All tenant rules are loaded and evaluated for each event in [src/application/use-cases/process-service-request-event.use-case.ts](../src/application/use-cases/process-service-request-event.use-case.ts).
- Returned actions are then executed sequentially by [src/infrastructure/services/routing-tool-action.service.ts](../src/infrastructure/services/routing-tool-action.service.ts).
- There is no explicit rule priority, stop-processing flag, mutual exclusion group, or conflict-resolution layer in the current rule model.

One subtle but important detail:

- The current repository model has no explicit ordering field for rules in [src/entities/models/routing-rule.ts](../src/entities/models/routing-rule.ts) and [drizzle/schema.ts](../drizzle/schema.ts).
- The implementation behaves sequentially today, but it does not expose a first-class, deterministic priority system that administrators can reason about.

### 3. The Testing section is evaluation-only

This is still true.

- The Testing UI in [app/pages/portal/testing/index.vue](../app/pages/portal/testing/index.vue) calls `/api/test-service-requests/simulate`.
- The simulate endpoint and use case return `RuleEvaluationResult[]` and show planned actions only.
- No action handlers are executed in the testing flow.

This means the PDF's request for safer end-to-end testing remains valid.

### 4. Forwarding is still a single-target action

This is still true.

- `forward` and `assign` resolve one listing by name/reference and then execute one Ocean action.
- There is no built-in ranked fallback list, retry strategy, or capacity-based alternative selection.

### 5. Some clinical workflow gaps remain product gaps, not just doc gaps

The PDF called out several areas where the system can reason about something but cannot yet write the resulting classification back into a first-class Ocean field.

Examples that still look valid as reference-implementation gaps:

- No dedicated "update referral priority" tool surfaced in the current tool registry.
- No native live data lookup step for wait times, lab results, or external operational context.
- No explicit safety layer for detecting that two rules will both send overlapping communications for the same event.

## What Is Outdated or Needs Clarification

### 1. Twilio and SMTP are optional, and the newer UI reflects that better

The older feedback said the UI made SMTP and Twilio keys look required even though they were optional.

Current state:

- The site configuration schema keeps Twilio and email settings optional in [src/entities/models/site-configuration.ts](../src/entities/models/site-configuration.ts).
- Hosting docs already describe SMS and email services as optional in [HOSTING.md](../HOSTING.md).
- The redesigned settings UI separates SMS and email into their own configuration panels in [app/pages/portal/site-configuration/index.vue](../app/pages/portal/site-configuration/index.vue).

What still deserves clarification:

- The built-in "test SMS" and "test email" buttons intentionally require the corresponding credentials because those test actions actually send messages.
- That is different from saying the overall feature is mandatory for every deployment.

### 2. "Put wait times in Listings" is not a current feature

The feedback note suggested the user may not have realized that the Listings section could hold wait times. That would be a good future direction, but it is not how this repository works today.

Current state:

- Listing records currently contain `name`, `description`, and `oceanReference` in [src/entities/models/healthcare-service.ts](../src/entities/models/healthcare-service.ts).
- The LLM prompt does not inject listing metadata into the rule evaluation prompt.
- Listing data is used for validating routing targets at execution time, not as a knowledge base for the model.

So the right documentation update is:

- Do not imply that listing descriptions are already used as live rule context.
- Call out structured listing metadata as a good roadmap item instead.

### 3. The repo has moved past some PoC deployment pain points

The PDF captured real PoC friction around Windows shell scripts, Aurora assumptions, migrations, and tenant handling.

Current repo state has already improved in several places:

- The README now documents both direct Postgres and Aurora Data API modes.
- Database migration guardrails are documented in [README.md](../README.md) and [DATABASE_MIGRATION_POLICY.md](../DATABASE_MIGRATION_POLICY.md).
- AWS deployment guidance is now consolidated under [infrastructure/cdk/README.md](../infrastructure/cdk/README.md).

That said, cross-platform deploy ergonomics are still worth treating as a reference-implementation quality goal.

## Documentation Changes This Review Implies

These are the messages the docs should communicate clearly:

1. This repo is a strong reference implementation for event-driven AI routing, but not a complete operational knowledge platform.
2. Dynamic clinic facts such as wait times should not be hardcoded into prompts for production use unless the organization owns the update process.
3. The current Testing page is a simulator, not a safe execution sandbox.
4. SMS and email are optional capabilities, not baseline setup requirements.
5. Rule ordering and conflict management need stronger first-class support if clinics will run overlapping automations at scale.

## Good Open-Source Improvement Directions

### 1. Add a structured knowledge source layer

Best near-term direction:

- Add optional tenant-level or rule-level knowledge sources that can be injected into prompts in a controlled way.

Practical shapes:

- Hosted JSON document referenced by URL and cached server-side.
- Tenant-managed structured records stored in the app database.
- A per-rule "knowledge attachments" feature for local policies, thresholds, or catchment rules.

Suggested first scope:

- Start with read-only JSON knowledge sources with a strict schema and explicit allowlist fields.
- Use them for high-value operational data such as wait times, accepted modalities, clinic-specific exclusions, or catchment areas.

Why this is better than free-form prompt text:

- Easier to update centrally.
- Easier to validate.
- Easier to audit.
- Easier to reuse across rules.

### 2. Extend Listings into structured routing targets

A good reference-implementation upgrade would be to evolve listings from simple routing targets into structured operational records.

Potential fields:

- `displayName`
- `oceanReference`
- `description`
- `currentWaitTime`
- `acceptedPriorities`
- `catchmentAreas`
- `temporarilyUnavailable`
- `metadataLastUpdatedAt`
- `metadataSource`

This could support:

- Better human administration.
- Better prompt grounding.
- Better validation before a forward happens.
- Future ranked routing or recommendation flows.

### 3. Add an external update API for listing metadata

The PDF suggestion about an external client updating listing wait times is strong.

Reference-implementation shape:

- Add a narrow authenticated API that updates only specific operational metadata fields.
- Keep Ocean references immutable unless explicitly changed by admins.
- Record provenance and update timestamps for each external update.

This would let external systems push operational state without giving them full admin access to rule authoring.

### 4. Make rule order explicit

This should move from implicit behavior to an explicit model.

Recommended additions:

- `priority` integer field.
- Stable `order by priority desc, createdAt asc`.
- Optional "stop processing after execute" flag.
- Optional mutual exclusion groups such as `capacity-routing`, `deficiency-check`, or `referrer-messaging`.

This is one of the highest-value improvements because it reduces surprising multi-rule behavior and makes clinic governance much easier.

### 5. Add a safe execution sandbox to Testing

The current simulator is useful but incomplete.

A better open-source reference flow would have three modes:

- `Evaluate only`: current behavior.
- `Dry run with rendered outbound payloads`: show exactly what Ocean, email, or SMS payloads would be sent.
- `Manual approval execution`: let an authorized admin click to execute a selected simulated action in a sandbox tenant.

The PDF's "send the draft SMS manually after simulation" idea fits here. It is useful if implemented as a controlled admin-only sandbox feature, not as a shortcut around auditability.

### 6. Add agentic data retrieval carefully, not by default

The idea of fetching live wait times on demand is good, but the reference implementation should stay disciplined.

Recommended pattern:

- Keep the default rule evaluator deterministic and bounded.
- Add optional tool-style data fetchers with strict schemas, timeouts, and allowlisted domains.
- Audit every fetch and every fetched field that influenced a decision.

This avoids turning rule evaluation into an opaque, unconstrained agent loop.

### 7. Improve observability for latency, reasoning, and safety

The PDF called for more analytics and traceability. That remains the right direction.

Current repo already has the start of a stronger audit model in [drizzle/schema.ts](../drizzle/schema.ts) with `llm_rule_decision_audit` and `llm_rule_tool_execution_audit`.

Good next steps:

- Surface those audits in the UI.
- Track total evaluation latency per rule and per event.
- Track duplicate or conflicting communication attempts.
- Show which structured knowledge sources influenced a decision.
- Add alerting when a rule flips from mostly `SKIP` to mostly `EXECUTE` unexpectedly.

### 8. Package governance guidance with the product

This is important for an open-source reference implementation because technical teams often underestimate the clinical governance side.

The repo should eventually ship example artifacts for:

- rule authoring checklist
- clinical review checklist
- sandbox sign-off checklist
- incident triage guide
- rule retirement/pause criteria
- sample disclosure and consent language where appropriate

## Suggested GitHub Issue Backlog

Point 7 in the PDF referenced CDS Hook issues that had to be fixed during the PoC. Even when an issue is already fixed, the open-source repo benefits from preserving that learning as issues or postmortems.

High-value backlog items:

1. Add explicit rule priority and stop-processing controls.
2. Add dry-run payload preview and optional sandbox execution from the Testing page.
3. Add tenant-managed structured knowledge sources for rules.
4. Add structured listing metadata and external listing metadata update API.
5. Add duplicate/conflict detection for messaging tools.
6. Add performance instrumentation for pre-submit rule latency.
7. Add UI surfacing for LLM decision and tool execution audit tables.
8. Add a dedicated "update priority" routing tool if Ocean supports the required field update.
9. Add documentation and templates for clinical governance and safety review.
10. Backfill notable historical bugs and fixes as GitHub issues or ADR-style notes so PoC learning is not lost.

## Recommended Positioning for This Repository

The strongest way to present this project publicly is:

- It is a transparent, auditable, event-driven AI routing reference implementation.
- It demonstrates how to connect an LLM safely to bounded healthcare workflow tools.
- It intentionally does not pretend to solve live operational knowledge, governance, or end-to-end clinical safety by prompt text alone.

That framing makes the current implementation easier to trust and gives contributors a clearer roadmap for what to improve next.
