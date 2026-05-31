# Refactor And Performance Opportunities

This note captures code-health and perceived-performance opportunities identified on 2026-05-31. It is intended as a backlog seed, not a committed implementation plan.

## High-Value Refactors

### Site Configuration Page

- File: `app/pages/portal/site-configuration/index.vue`
- Current shape: approximately 1,500 lines in one SFC.
- Issue: page state, tenant permissions, form normalization, validation mapping, panel save behavior, connection tests, email/SMS tests, and seven settings panels all live together.
- Opportunity:
  - Extract a `useSiteConfigurationForm()` composable for data loading, dirty checks, validation errors, saves, and test actions.
  - Split panel templates into focused components such as `OceanConnectionPanel`, `InboundApiPanel`, `SmsSettingsPanel`, `AiSettingsPanel`, `EmailSettingsPanel`, `OpenApiPanel`, and `ErequestArchivalPanel`.
  - Replace repeated test handlers with one small helper for "run test endpoint, update result, toast success/error".
- Expected benefit: easier changes to settings, smaller route component, smaller route chunk if heavy panels are lazily loaded.

### LLM Rule Decision Audit Repository

- File: `src/infrastructure/repositories/llm-rule-decision-audit.repository.ts`
- Current shape: `getPaginatedDecisions` builds filters, runs queries, loads child tool executions, applies optional tool-status filtering in memory, maps display fields, and derives error flags in one method.
- Issue: `toolStatus` filtering happens after a page of decisions is loaded, so totals and pagination can be misleading.
- Opportunity:
  - Extract decision filter construction and audit item mapping.
  - Push `toolStatus` filtering into SQL using a join or `exists` condition.
  - Consider separate repository methods for summary lists versus detail views so list queries do not always hydrate every tool execution field.
- Expected benefit: correct pagination, lower query/mapping cost, easier audit-explorer changes.

### Patient Engagement Webhook Handler

- File: `server/api/openapi/webhook/[clientId].ts`
- Current shape: one route handler covers request parsing, rate limiting, site lookup, webhook authentication, unsigned challenge handling, OpenAPI credential validation, replay prevention, patient/note loading, context mapping, session setup, and use-case invocation.
- Opportunity:
  - Extract `authenticateWebhook`, `handleUnsignedChallenge`, `loadPatientEngagementContext`, and replay-guard helpers.
  - Move reusable webhook security state into a dedicated server utility so the route reads as a request pipeline.
- Expected benefit: safer webhook changes, simpler testing, clearer failure modes.

### Tenant Access Utility

- File: `server/utils/tenant-access.ts`
- Current shape: approximately 850 lines covering identity, users, system admins, memberships, invites, tenant provisioning, and site creation.
- Issue: this is now a mixed service layer outside the clean architecture boundaries.
- Opportunity:
  - Split by responsibility: identity access, tenant memberships, tenant invites, tenant provisioning, and system-admin allowlist.
  - Preserve existing exported functions initially and delegate internally to reduce route churn.
- Expected benefit: lower merge conflict risk and clearer ownership of tenant/security behavior.

### Ocean FHIR Message Builder

- File: `src/infrastructure/services/ocean-message.service.ts`
- Current shape: approximately 650 lines of FHIR message builders and shared helper functions.
- Opportunity:
  - Keep primitives like `createMessageHeader`, `createMessageBundle`, `createTask`, and shared resource extractors in one small module.
  - Move each message family into focused files: forward/assign, status changes, booking instructions, communications, eConsult toggles, data corrections.
- Expected benefit: easier validation of FHIR changes and more focused tests.

## Load-Time And Runtime Opportunities

### Deduplicate Site Configuration Fetches

- Files:
  - `app/layouts/default.vue`
  - `app/pages/portal/activity/index.vue`
  - `app/pages/portal/erequests/index.vue`
  - `app/pages/portal/site-configuration/index.vue`
- Current shape: the layout fetches site configuration for navigation/site name, and several pages fetch it again for local behavior.
- Opportunity:
  - Introduce `useActiveSiteConfig()` with a stable `useAsyncData` key and shared cache behavior.
  - Or include a small active-site summary in the user/session payload if it is needed on nearly every portal route.
- Expected benefit: fewer route-to-route network requests and faster perceived navigation.

### Share Or Defer Document Downloads In Webhook Processing

- Files:
  - `src/application/use-cases/archive-erequest.use-case.ts`
  - `src/infrastructure/adapters/controllers/process-message.controller.ts`
- Current shape: archival downloads document blobs, then attachment loading can fetch document data again for routing/AI use.
- Opportunity:
  - Introduce a document download/cache service shared by archival and attachment loading within one request.
  - Use bounded concurrency for multiple document downloads.
  - Consider moving archival blob persistence to a background task if routing response latency matters more than synchronous retention confirmation.
- Expected benefit: lower webhook latency and less duplicate Ocean traffic.

### Search Query Scaling

- File: `src/infrastructure/repositories/erequests.repository.ts`
- Current shape: full-text search plus several leading-wildcard `ilike` filters.
- Issue: existing B-tree indexes help exact/ordered cases, but `%term%` filters will not use normal B-tree indexes well.
- Opportunity:
  - Prefer the existing full-text expression path for broad text search.
  - Add trigram indexes for fields that need partial matching at scale.
  - Keep exact filters exact where possible, especially health number, MRN, referral reference, and listing reference.
- Expected benefit: more predictable search latency as retained eRequest volume grows.

## SPA-Feeling Route Navigation

The app already uses Nuxt route chunks, so the biggest wins are about showing route shells immediately and avoiding blocking data work during navigation.

### Add Immediate Route Skeletons

- Use page-level skeletons that render from component state immediately, before async data resolves.
- Prefer `useAsyncData(..., { lazy: true, default: () => skeletonShape })` for routes where SSR-blocking data is not necessary.
- Keep layout/nav visible and stable while page content loads.
- Good first candidates:
  - `app/pages/portal/activity/index.vue`
  - `app/pages/portal/erequests/index.vue`
  - `app/pages/portal/members/index.vue`
  - `app/pages/admin/index.vue`

### Stop Refetching Shared Data On Every Route

- Centralize active tenant, membership, and site configuration data.
- Reuse one async-data key or Pinia store for data that drives the shell.
- Refresh it explicitly after mutations like tenant switch or settings save.

### Prefetch Likely Route Components And Data

- Ensure primary navigation links use `NuxtLink` so Nuxt can prefetch route chunks.
- For high-traffic links, prefetch route data on hover/focus with a lightweight composable.
- Avoid prefetching PHI-heavy lists; prefetch only safe metadata or route chunks unless the user has clearly navigated toward that view.

### Split Heavy Admin/Settings Pages

- Large settings/admin pages can load their route shell first, then lazy-load lower-priority panels using async components.
- This is especially useful for the site settings page: the first viewport can render connection/site identity immediately while SMS, email, OpenAPI, and archival panels load just after navigation.

### Normalize List Pages Around Cached Query State

- Keep pagination/filter state in the URL query.
- Use cached default result shapes so tables render headers and controls immediately.
- Debounce text filters instead of refreshing on every keystroke, especially in activity logs.

### Measure The Actual Navigation Bottleneck

- Add a small route-timing plugin in development that logs navigation start, page mount, async-data completion, and hydration completion.
- Use Nuxt build output and browser performance traces to identify whether delays are chunk download, JS evaluation, auth/session fetch, duplicate site-config fetches, or list API latency.

## Suggested Priority

1. Deduplicate active site configuration loading.
2. Add lazy async-data defaults and route skeletons to list pages.
3. Split `site-configuration/index.vue` into a composable plus panel components.
4. Fix SQL-level filtering and pagination in the LLM audit repository.
5. Share/defer document downloads in webhook processing.
6. Split `tenant-access.ts` and `ocean-message.service.ts` after the higher-risk behavior is covered by tests.
