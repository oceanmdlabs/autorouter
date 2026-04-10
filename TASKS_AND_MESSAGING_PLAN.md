# Task Management and Messaging Plan

## Objective

Add a tenant-scoped internal task management module that supports:

- user-to-user messaging inside a site
- automated task creation by the routing engine
- ad hoc task creation for referral operations
- task assignment to one or more site users, with a primary assignee
- filtering, triage, and completion workflows in the portal
- future browser-extension support inside the Ocean portal

This plan is implementation-oriented and tied to the current codebase so work can continue without rediscovering the architecture.

## Product Shape

The simplest durable model is:

- a `task` is the system of record
- a "message" is a task plus one or more task-thread entries
- assignment is optional
- Ocean-linked work and purely internal work use the same task model

This avoids building a separate messaging subsystem and a separate task subsystem that later need to be reconciled.

## Locked Decisions

- Internal messaging is implemented as task creation plus threaded task comments/messages.
- Task status values should roughly align with FHIR R4 `Task.status`, but UI buckets may collapse several statuses into simpler operator views.
- "Needs review" remains in the workflow, but it is not the primary task status. It should be modeled as a dedicated flag or business marker on the task so it can coexist with `requested`, `in-progress`, or `completed`.
- Assignment is tenant-scoped and can only target active tenant members.
- Messages and tasks must support Ocean-linked context such as referral reference, eRequest id, or Ocean message id, but must also support non-referral operational tasks.
- Visibility defaults are site-configurable. Each outbound message/task note can be marked `private` or `public`.
- `private` means internal to the autorouter task system only.
- `public` means safe to surface into Ocean-facing workflow later if we choose to mirror it there; phase 1 does not require automatic Ocean write-back.
- Because Ocean does not offer OIDC/SSO today, the autorouter remains a separately authenticated app.
- The Chromium extension is complementary and should consume the autorouter APIs rather than implement task logic locally.

## Why Use Tasks As The Core Object

The use cases all reduce cleanly to one abstraction:

- "Clerk A messages Clerk B" becomes a task assigned to Clerk B with an initial thread message.
- "Routing engine raises an exception or follow-up" becomes an auto-created task with machine-authored provenance.
- "Someone notices a referral issue that is not part of Ocean state" becomes an ad hoc task.

This means:

- one permissions model
- one search model
- one audit model
- one assignment model
- one UI list/detail pattern

## Existing Integration Points

- Tenant-scoped repository wiring is centralized in [src/entities/models/application-context.ts](/Users/dougkavanagh/workspace/oceanmd-autorouter/src/entities/models/application-context.ts).
- Routing-tool registration lives in [src/infrastructure/services/routing-tools/routing-tool-registry.ts](/Users/dougkavanagh/workspace/oceanmd-autorouter/src/infrastructure/services/routing-tools/routing-tool-registry.ts).
- Routing-tool execution lives in [src/infrastructure/services/routing-tool-action.service.ts](/Users/dougkavanagh/workspace/oceanmd-autorouter/src/infrastructure/services/routing-tool-action.service.ts).
- Tenant membership lookup already exists in [server/utils/tenant-access.ts](/Users/dougkavanagh/workspace/oceanmd-autorouter/server/utils/tenant-access.ts) and [server/api/tenant-members/index.get.ts](/Users/dougkavanagh/workspace/oceanmd-autorouter/server/api/tenant-members/index.get.ts).
- Portal navigation is defined in [app/layouts/default.vue](/Users/dougkavanagh/workspace/oceanmd-autorouter/app/layouts/default.vue).
- Portal list/search patterns already exist in [app/pages/portal/erequests/index.vue](/Users/dougkavanagh/workspace/oceanmd-autorouter/app/pages/portal/erequests/index.vue).
- Site defaults already live in [src/entities/models/site-configuration.ts](/Users/dougkavanagh/workspace/oceanmd-autorouter/src/entities/models/site-configuration.ts) plus the related site-configuration repository and API routes.

## Domain Model

### Table: `tasks`

Purpose: store one operational task per piece of work.

Suggested columns:

- `id`
- base metadata columns
- `tenant_id`
- `site_id` nullable for future multi-site grouping if needed
- `title`
- `description`
- `status`
- `intent` such as `order`, `proposal`, `plan`
- `priority` such as `routine`, `urgent`, `asap`, `stat`
- `business_state` nullable, for local workflow markers such as `needs_review`
- `visibility_default` with values `private`, `public`
- `source_type` with values like `manual`, `message`, `routing_rule`, `system`
- `source_rule_id` nullable
- `source_rule_name` nullable
- `source_event_type` nullable
- `source_message_id` nullable
- `source_referral_id` nullable
- `source_referral_ref` nullable
- `erequest_id` nullable FK to archived `erequests`
- `requester_user_id` nullable
- `owner_user_id` nullable
- `assignee_user_id` nullable
- `assigned_at` nullable
- `accepted_at` nullable
- `started_at` nullable
- `completed_at` nullable
- `cancelled_at` nullable
- `due_at` nullable
- `last_message_at`
- `last_activity_at`

Recommended indexes:

- tenant + status + last_activity_at desc
- tenant + assignee_user_id + status + last_activity_at desc
- tenant + owner_user_id + status + last_activity_at desc
- tenant + source_referral_ref
- tenant + erequest_id
- tenant + business_state
- tenant + due_at
- tenant + created_at
- full-text search index over `title`, `description`, and referral-linked fields

Notes:

- `owner_user_id` is the person accountable for the task queue outcome.
- `assignee_user_id` is the current person expected to act next.
- For phase 1, one assignee is enough. If shared assignment becomes necessary, add a join table later without changing the core API shape.

### Table: `task_messages`

Purpose: store the threaded conversation and task activity log.

Suggested columns:

- `id`
- base metadata columns
- `tenant_id`
- `task_id`
- `author_user_id` nullable for system-generated messages
- `message_type` with values such as `comment`, `status_change`, `assignment`, `system`
- `visibility` with values `private`, `public`
- `body`
- `metadata` as `jsonb` for structured system payloads

Recommended indexes:

- tenant + task_id + created_at
- tenant + author_user_id + created_at
- tenant + visibility + created_at

Notes:

- Thread entries should capture both human messages and system events.
- A task detail page can render these uniformly with different visual treatments.

### Optional Table: `task_watchers`

Purpose: support inbox visibility beyond creator and assignee.

Suggested columns:

- `id`
- base metadata columns
- `tenant_id`
- `task_id`
- `user_id`

This can be deferred to phase 2 if the first rollout only needs creator, assignee, and admins.

## Task Status Model

Use a status enum that broadly mirrors FHIR R4 `Task.status`:

- `draft`
- `requested`
- `received`
- `accepted`
- `rejected`
- `ready`
- `in-progress`
- `on-hold`
- `cancelled`
- `failed`
- `completed`
- `entered-in-error`

Recommended operational rules:

- User-authored ad hoc tasks start as `requested`.
- Direct user-to-user messages start as `requested`.
- Routing-engine-created tasks start as `requested` unless the tool explicitly sets `ready`.
- Opening a task does not change state.
- Explicit accept action moves `requested` or `received` to `accepted`.
- Starting work moves `accepted` or `ready` to `in-progress`.
- "Needs review" is represented separately in `business_state`, not by changing the FHIR-like status.

Recommended UI buckets:

- `Open`: `requested`, `received`, `accepted`, `ready`, `in-progress`, `on-hold`
- `Closed`: `completed`, `cancelled`, `failed`
- `Exceptions`: `rejected`, `entered-in-error`

This preserves interoperability with FHIR concepts without forcing the UI to expose every nuance.

## Visibility Model

WELL called out public vs private visibility. The clean implementation is:

- task-level default visibility comes from site configuration
- each new message inherits the task default unless the sender overrides it
- visibility applies at the message level, not just the task level

Recommended site configuration additions:

- `taskMessagingEnabled: boolean`
- `taskDefaultVisibility: 'private' | 'public'`
- `taskAllowVisibilityOverride: boolean`
- `taskRoutingEngineDefaultVisibility: 'private' | 'public'`
- `taskExtensionEnabled: boolean`

Recommended first-release behavior:

- default to `private`
- allow override per message
- reserve automatic Ocean mirroring for a later phase

That gives the product room to honor the public/private request without overcommitting to immediate cross-system synchronization.

## Permissions

Phase 1 should stay simple:

- any active tenant member can create tasks
- any active tenant member can message within a task they created, are assigned to, or can otherwise view
- tenant admins can view all tasks
- non-admin members can view:
  - tasks they created
  - tasks assigned to them
  - tasks where they have posted
  - tasks explicitly linked to them through future watcher support

Open policy question:

- whether all site members should see all private internal tasks by default

Recommendation:

- do not default to fully site-public private tasks
- start with creator plus assignee plus admin visibility
- add broader team-visibility rules only if operations demand it

## Clean Architecture Placement

### Entities

Add domain models under `src/entities/models/`:

- `task.ts`
- `task-message.ts`
- optionally `task-watcher.ts`

These should define:

- zod schemas
- enum unions
- search/filter option types
- DTOs for create and update flows

### Application Layer

Add repository interfaces:

- `src/application/repositories/tasks.repository.interface.ts`

Add use cases:

- `create-task.use-case.ts`
- `list-tasks.use-case.ts`
- `get-task.use-case.ts`
- `add-task-message.use-case.ts`
- `update-task-status.use-case.ts`
- `assign-task.use-case.ts`

These use cases should enforce:

- tenant membership checks
- assignment target validation
- status transition rules
- audit/event creation

### Infrastructure Layer

Add repository implementations:

- `src/infrastructure/repositories/tasks.repository.ts`

Extend `ApplicationContext` in [src/entities/models/application-context.ts](/Users/dougkavanagh/workspace/oceanmd-autorouter/src/entities/models/application-context.ts) with:

- `getTasksRepository()`

## Database Plan

Add new enums and tables to [drizzle/schema.ts](/Users/dougkavanagh/workspace/oceanmd-autorouter/drizzle/schema.ts):

- `task_status`
- `task_intent`
- `task_priority`
- `task_visibility`
- `task_source_type`
- `task_message_type`
- `tasks`
- `task_messages`
- optionally `task_watchers`

Foreign-key guidance:

- `assignee_user_id`, `owner_user_id`, and `requester_user_id` should reference `users.id`
- `erequest_id` should reference `erequests.id`
- `task_id` in `task_messages` should reference `tasks.id`

Migration notes:

- this is a schema change, so follow [DATABASE_MIGRATION_POLICY.md](/Users/dougkavanagh/workspace/oceanmd-autorouter/DATABASE_MIGRATION_POLICY.md)
- do not generate a migration against a non-local database
- include snapshot metadata and SQL migration together

## API Plan

Suggested server routes:

- `server/api/tasks/index.get.ts`
- `server/api/tasks/index.post.ts`
- `server/api/tasks/[id].get.ts`
- `server/api/tasks/[id].patch.ts`
- `server/api/tasks/[id]/messages/index.post.ts`
- `server/api/tasks/[id]/assign.post.ts`
- `server/api/tasks/[id]/status.post.ts`
- `server/api/tasks/summary.get.ts`

Recommended list filters:

- `status`
- `statusBucket`
- `assigneeUserId`
- `ownerUserId`
- `requesterUserId`
- `businessState`
- `sourceType`
- `visibility`
- `referralRef`
- `erequestId`
- `search`
- `createdFrom`
- `createdTo`
- `updatedFrom`
- `updatedTo`
- `includeClosed`

Response shape should follow existing paginated patterns used by `erequests`.

## Routing Engine Tool

Add a first-class routing tool named `createTask`.

Suggested location:

- `src/infrastructure/services/routing-tools/create-task.ts`
- `src/infrastructure/services/routing-tools/handlers/create-task-handler.ts`

Register it in [src/infrastructure/services/routing-tools/routing-tool-registry.ts](/Users/dougkavanagh/workspace/oceanmd-autorouter/src/infrastructure/services/routing-tools/routing-tool-registry.ts).

Suggested tool input:

- `title: string`
- `description: string`
- `assigneeUserId?: string`
- `priority?: 'routine' | 'urgent' | 'asap' | 'stat'`
- `visibility?: 'private' | 'public'`
- `businessState?: 'needs_review' | null`
- `dueAt?: string`

Handler behavior:

1. Resolve tenant from the current application context.
2. Validate that `assigneeUserId` belongs to an active tenant member.
3. Create the task with `source_type = 'routing_rule'`.
4. Link task metadata to the routing event context:
   - referral reference
   - source message id if present
   - eRequest id if available
   - rule id and rule name
5. Add an initial `task_messages` entry with `message_type = 'system'`.
6. Record activity log text describing the created task.

Important:

- this tool should not depend on the Chromium extension
- it should work anywhere the routing engine already executes tools

## Portal UX Plan

### Navigation

Add `Tasks` to the portal nav in [app/layouts/default.vue](/Users/dougkavanagh/workspace/oceanmd-autorouter/app/layouts/default.vue).

### Pages

Add:

- `app/pages/portal/tasks/index.vue`
- `app/pages/portal/tasks/[id].vue`

Reuse the search/filter/table style already established by [app/pages/portal/erequests/index.vue](/Users/dougkavanagh/workspace/oceanmd-autorouter/app/pages/portal/erequests/index.vue).

### Task List Requirements

- default to open tasks
- filter by state bucket and exact status
- filter by assignee user
- filter by creator/requester user
- filter by source type
- filter by referral reference
- text search across title, description, and linked referral data
- quick actions for assign, accept, start, hold, complete, cancel
- show unread-or-updated indicators in a future phase if needed

Recommended columns:

- status
- business marker such as `Needs review`
- title
- assignee
- source
- referral reference
- last activity
- created by
- due date

### Task Detail Requirements

- header with title, status, assignee, priority, visibility default, linked referral context
- threaded messages in chronological order
- composer for new message with public/private toggle
- assignment control
- status transition controls
- history entries for system actions

### Member Filter Source

Use the existing tenant-members API as the assignee picker source rather than inventing a parallel user directory.

## Site Configuration UX

Extend the site configuration page with a dedicated task/messaging panel.

Suggested controls:

- enable internal tasks and messaging
- choose default visibility
- allow per-message visibility override
- choose whether routing-engine tasks default to `private` or `public`
- choose whether the browser extension integration is enabled

Admin-only behavior:

- only tenant admins should change task defaults

## Audit and Observability

Every state change and assignment change should create a `task_messages` system entry. Additionally:

- add privacy audit events when a user views task detail tied to PHI-rich referral context
- include task creation and state changes in the regular activity log where it improves operator traceability
- include routing-engine-created task metadata in LLM audit traces when the `createTask` tool is used

## Chromium Extension Plan

The extension should be phase 4, after the backend and portal are stable.

### Purpose

Reduce context switching by allowing users to:

- create a task from the current Ocean referral page
- view open tasks linked to the current referral reference
- assign or message without manually copying referral identifiers

### Shape

- Manifest V3 Chromium extension
- content script detects Ocean referral context
- extension extracts referral reference, listing, and key page identifiers from the DOM
- extension calls autorouter APIs using the user’s separate autorouter session

### Minimum feature set

- side panel or floating drawer
- "Create task" action from the current referral
- list linked tasks for the current referral reference
- quick assign
- quick private/public message compose
- deep link back to the full autorouter task page

### Authentication

No SSO is available, so use explicit separate login to the autorouter.

Recommended approach:

- extension opens autorouter login when session is absent
- after login, extension uses the same web session or a purpose-built extension token flow
- avoid storing Ocean credentials in the extension

### Risks

- Ocean DOM changes can break selectors
- extension login state adds support overhead
- cross-origin cookie behavior may require a dedicated extension auth flow

Recommendation:

- do not block the backend task system on the extension
- treat the extension as an accelerator once the web app workflow is proven

## Rollout Phases

### Phase 1: Core task module

Scope:

- schema and migrations
- domain models and repository
- task CRUD and list APIs
- task detail and message thread APIs
- portal task list and detail pages
- assignment to tenant members

Outcome:

- manual task creation and user-to-user messaging work end to end

Estimated elapsed time:

- 1.5 to 2 weeks

### Phase 2: Workflow hardening

Scope:

- FHIR-like status transitions
- `needs_review` business marker
- visibility defaults and overrides
- audit logging and privacy audit integration
- search and filter refinements

Outcome:

- production-capable referral operations workflow

Estimated elapsed time:

- 1 week

### Phase 3: Routing-engine automation

Scope:

- `createTask` routing tool
- handler integration
- validation of assignee membership
- activity and LLM audit trace improvements
- a few seed/demo rules that create tasks

Outcome:

- automated follow-up tasks from routing decisions

Estimated elapsed time:

- 3 to 5 days

### Phase 4: Chromium extension

Scope:

- extension shell
- referral context extraction
- quick-create and task lookup
- session/auth flow

Outcome:

- in-Ocean convenience workflow without changing backend design

Estimated elapsed time:

- 1 to 1.5 weeks

### Overall timeline

For a first useful release without the extension:

- about 3 to 4 weeks

Including the extension:

- about 4 to 5.5 weeks

This is the timeline to communicate externally unless scope expands into true Ocean-side synchronization or more complex team visibility rules.

## Recommended Build Order

1. Add schema, entities, repository interfaces, and repository implementation.
2. Add create/list/get/update task APIs plus message append API.
3. Add portal task list and detail pages.
4. Add assignment and status transition UX.
5. Add site configuration defaults and permission checks.
6. Add the `createTask` routing tool and handler.
7. Add audit improvements.
8. Build the extension against the stable APIs.

## Key Open Questions

- Should private tasks be visible only to creator plus assignee plus admin, or to all site staff?
- Do we need multi-assignee support immediately, or is one assignee enough?
- Should public task messages eventually write back into Ocean automatically, or only be marked as eligible for sharing?
- Do sending clinicians need direct access to this task system, or is that future scope?
- Do we need SLA indicators such as overdue and aging in phase 1?

## Recommended Answers For Phase 1

- visibility: creator plus assignee plus admin
- assignment: single assignee
- public/private: metadata only, no automatic Ocean mirroring yet
- external clinician access: out of scope
- SLA dashboards: out of scope, but store `due_at` now

## First Concrete Implementation Slice

If implementation starts immediately, the best first slice is:

1. add `tasks` and `task_messages` schema
2. add domain models and repository
3. add `GET /api/tasks`, `POST /api/tasks`, `GET /api/tasks/:id`, and `POST /api/tasks/:id/messages`
4. add `app/pages/portal/tasks/index.vue` and `app/pages/portal/tasks/[id].vue`
5. add nav link and assignee picker from tenant members

That delivers the WELL Clinics core blocker fastest: real internal/private operational messaging tied to referral workflow.
