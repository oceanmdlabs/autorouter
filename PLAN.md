# erequest Long-Term Storage Module Plan

## Objective

Add an optional tenant-scoped `erequest` retention module that stores inbound Ocean erequests and associated binary documents for long-term access. When enabled in site settings, the app should retain the inbound metadata, raw FHIR payload, and downloaded PDF plus optional attachments instead of discarding them after processing. Users should then be able to browse prior `erequests` from the portal with search, filters, and document download/view support.

This plan is implementation-oriented so work can continue after context reset without revisiting key design decisions.

## Locked Decisions

- Naming uses `erequest` and `erequests`, never `e-request` or `e-requests`.
- The blob metadata table is named `erequest_blobs`.
- `health_service_types` is stored as a PostgreSQL text array, not a scalar field.
- The module is opt-in per tenant through site settings and is disabled by default.
- Turning the module off stops retention of future inbound `erequests`; it does not delete already retained data.
- Binary content is stored through a provider-neutral blob storage abstraction, with AWS S3 as the first production implementation.
- We will not add a redundant `search_text` text column for this module.
- Search will use a PostgreSQL full-text expression index over selected columns plus targeted B-tree and GIN indexes for precise filters.
- Add an index for patient medical record number to support matching against a parallel EMR.

## Why No `search_text` Column

For this module, a materialized `search_text` field is unnecessary duplication. The searchable fields are already structured, and the record is PHI-heavy. A redundant text column increases write-path complexity and makes future schema changes easier to get wrong.

Recommended search strategy:

- Use a GIN full-text expression index over a concatenation of relevant columns, for example patient name, health number, medical record number, referring provider, receiving provider, referral reference, requested listing title, and requested service description.
- Use direct filters for exact or prefix-style matches where appropriate.
- Use a GIN index on `health_service_types` for array membership filtering.
- Use dedicated B-tree indexes on `patient_health_number` and `patient_medical_record_number`.

This gives good search performance without maintaining a shadow text field in application code.

## Existing Integration Points

- Inbound message handling currently starts at `src/infrastructure/adapters/controllers/process-message.controller.ts`.
- Routing execution currently happens in `src/application/use-cases/process-service-request-event.use-case.ts`.
- Site settings already live in `src/entities/models/site-configuration.ts`, `src/infrastructure/repositories/site-configuration.repository.ts`, `server/api/site-configuration/index.get.ts`, `server/api/site-configuration/index.post.ts`, and `app/pages/portal/site-configuration/index.vue`.
- Tenant-scoped repository wiring is centralized in `src/entities/models/application-context.ts`.
- Tenant filtering and CRUD helpers are centralized in `src/infrastructure/services/db.service.ts`.
- Portal navigation is defined in `app/layouts/default.vue`.
- Activity log pagination/search patterns already exist in `app/pages/portal/activity/index.vue` and `src/infrastructure/repositories/activity-log-entries.repository.ts`.

## Data Model

### Table: `erequests`

Purpose: store one retained inbound request record per received Ocean message that qualifies for retention.

Suggested columns:

- `id`
- base metadata columns
- `tenant_id`
- `referral_ref`
- `triggering_event`
- `received_at`
- `patient_health_number`
- `patient_medical_record_number`
- `patient_name`
- `patient_family_name`
- `patient_given_names`
- `patient_date_of_birth`
- `referring_provider`
- `receiving_provider`
- `requested_listing_ref`
- `requested_listing_title`
- `health_service_types` as `text[]`
- `requested_service_description`
- `raw_bundle` as `jsonb`
- `primary_blob_id` nullable FK to `erequest_blobs.id`
- `storage_status`
- `ingestion_error`

Recommended indexes:

- tenant + received_at desc
- tenant + referral_ref
- tenant + patient_health_number
- tenant + patient_medical_record_number
- tenant + referring_provider
- tenant + receiving_provider
- tenant + requested_listing_ref
- GIN on `health_service_types`
- GIN full-text expression index over key text fields

Notes:

- Keep `raw_bundle` so future reprocessing or troubleshooting does not depend on Ocean re-delivery.
- `patient_medical_record_number` should be nullable because it may not always be present in inbound payloads.
- `received_at` should reflect inbound processing time unless a better source timestamp is reliably present in the message payload.

### Table: `erequest_blobs`

Purpose: store provider-neutral metadata for binary objects related to an `erequest`.

Suggested columns:

- `id`
- base metadata columns
- `tenant_id`
- `erequest_id`
- `kind` with values like `primary_pdf`, `attachment`, `other`
- `filename`
- `content_type`
- `byte_size`
- `checksum_sha256`
- `storage_provider`
- `storage_bucket` or generic container field
- `storage_key`
- `source_url`
- `download_status`
- `download_error`

Recommended indexes:

- tenant + erequest_id
- tenant + storage_provider + storage_key unique if desired
- tenant + kind

Notes:

- Do not store blob bytes in Postgres.
- The `primary_blob_id` pointer on `erequests` is useful for fast primary-document retrieval without scanning all related blobs.

## Site Configuration Changes

Add retention-specific settings to the site configuration model and persistence layer.

Suggested fields:

- `erequestArchivalEnabled: boolean`
- `erequestStorageProvider: 's3' | 'filesystem'`
- `erequestStoreAttachments: boolean`
- `erequestStoreRawBundle: boolean`
- `erequestStorageBucket`
- `erequestStorageRegion`
- `erequestStoragePrefix`
- provider credentials or secrets as needed, encrypted if stored in DB
- `erequestEnabledConfirmedAt`
- `erequestDisabledConfirmedAt`

UI requirements for `app/pages/portal/site-configuration/index.vue`:

- Add a dedicated `erequests` settings panel.
- Default to off.
- On enable, present a privacy warning describing retained PHI and operational responsibility.
- Require explicit confirmation before save.
- Prefer a storage connection test before allowing enable in production-oriented providers.
- On disable, warn that future inbound `erequests` will no longer be retained and this can create gaps in the historical record.
- State clearly that existing retained data remains until separately deleted.

Permission requirements:

- Only tenant admins should be able to change archival settings.

## Blob Storage Abstraction

Add a new application service interface, for example `src/application/services/blob-storage.service.interface.ts`.

Suggested interface:

- `putObject`
- `getObjectStream`
- `headObject`
- `deleteObject`
- `buildStorageKey`

Implementations:

- `src/infrastructure/services/blob-storage/s3-blob-storage.service.ts`
- `src/infrastructure/services/blob-storage/filesystem-blob-storage.service.ts`

Wiring:

- Register the service in `src/entities/models/application-context.ts`.
- Keep provider-specific details in the infrastructure layer only.

Design requirements:

- Storage keys should be deterministic and tenant-scoped.
- Do not expose raw S3 object URLs directly in the portal.
- Downloads should be authorized through server routes and streamed from storage.
- Preserve enough metadata to support integrity checks and future migrations between providers.

## Ingestion Flow Changes

Current inbound flow:

- parse bundle
- derive event context
- optionally download attachments for AI use
- execute routing logic
- write activity log

New flow when archival is enabled:

1. Parse the inbound bundle.
2. Extract normalized `erequest` metadata from `MessageHeader`, `ServiceRequest`, `Patient`, `Practitioner`, `PractitionerRole`, and `DocumentReference`.
3. Check site configuration for `erequestArchivalEnabled`.
4. If disabled, continue current behavior unchanged.
5. If enabled, create an `erequests` record before binary download starts.
6. Download the primary PDF and optional attachments.
7. Store each object through blob storage.
8. Create `erequest_blobs` rows and link the primary blob.
9. Continue existing routing behavior.
10. Write activity log entries as today.

Important separation:

- Do not tie archival to the current `FETCH_ATTACHMENTS` behavior.
- Archival must have its own decision path so the system can retain documents even if AI attachment summarization is disabled.

Recommended follow-up code shape:

- Add a dedicated archival use case, for example `archive-erequest.use-case.ts`.
- Keep bundle parsing/extraction logic in reusable helpers or application-layer services so it is not spread across the controller.

Failure handling:

- If metadata insert succeeds and blob upload fails, keep the `erequests` row and mark `storage_status` and `ingestion_error`.
- Do not silently drop retention failures.
- Ensure activity logging captures archival failures.

Idempotency:

- Ocean retries or duplicate messages should not create duplicate retained rows.
- Use a stable dedupe strategy such as referral reference plus triggering event plus message checksum, or a source message identifier if reliably available.

## Search and Filtering

Portal users need to search and filter prior retained `erequests` by:

- health number
- medical record number
- patient name
- referring provider
- receiving provider
- health service types
- referral reference
- requested listing
- date range

Recommended query behavior:

- Full-text search for a general search box using the expression index.
- Exact or partial filters on specific fields using dedicated query parameters.
- `health_service_types` filter should use array membership semantics.

Recommended repository/API contract:

- paginated list endpoint
- detail endpoint
- download endpoint for blobs

Possible server routes:

- `server/api/erequests/index.get.ts`
- `server/api/erequests/[id].get.ts`
- `server/api/erequests/[id]/blobs/[blobId].get.ts`

Repository files:

- `src/application/repositories/erequests.repository.interface.ts`
- `src/infrastructure/repositories/erequests.repository.ts`

## Portal UI

Add a new portal section and route:

- `app/pages/portal/erequests/index.vue`
- `app/pages/portal/erequests/[id].vue`

Navigation:

- Add `Erequests` to the main portal nav in `app/layouts/default.vue`.

List page requirements:

- paginated table
- free-text search input
- field filters for patient health number, MRN, patient name, referring provider, receiving provider, and health service types
- received date column
- referral reference column
- empty state when the module is disabled with a call-to-action to site settings
- empty state when enabled but no records exist

Detail page requirements:

- metadata summary
- document list with view/download actions
- raw bundle visibility only if needed for support or debugging
- retention or download warnings if any blob failed to archive

## Security and Privacy Controls

This module materially changes PHI retention behavior and needs stronger guardrails than typical settings.

Required controls:

- feature disabled by default
- admin-only enable/disable
- explicit enable warning and confirmation
- explicit disable warning and confirmation
- tenant authorization on all list/detail/download routes
- encrypted storage credentials where persisted
- no unauthenticated or cross-tenant blob access

Recommended wording themes:

- enable warning: retained data may include PHI and attachments; tenant assumes responsibility for retention, storage, access, and lifecycle management
- disable warning: future inbound `erequests` will no longer be retained, creating gaps in historical records and possible operational data loss

Optional but worthwhile follow-up:

- access audit log for erequest detail views and downloads
- retention policy configuration
- hard-delete workflow with explicit confirmation

## Infrastructure and Deployment

Production support should start with AWS S3 while keeping the application provider-neutral.

Environment and deployment work:

- define required S3 config and credentials
- document IAM expectations
- document bucket lifecycle and backup expectations
- add local filesystem storage for development and test environments

Documentation updates should include:

- `README.md`
- `HOSTING.md`
- any AWS deployment docs if the S3 setup belongs there

## Testing Plan

Add tests for:

- metadata extraction from inbound bundles
- idempotent archival behavior
- enabled versus disabled archival settings
- blob upload success and failure handling
- repository search and filter queries
- `health_service_types` array filtering
- health number and MRN lookup
- tenant authorization on list/detail/download routes
- portal settings warnings and guardrails where feasible

Test scenarios to cover explicitly:

- request received with primary PDF only
- request received with PDF plus attachments
- request with no downloadable document references
- duplicate delivery from Ocean
- archival enabled but storage provider misconfigured
- archival disabled while routing remains active

## Implementation Sequence

1. Add schema changes for `erequests`, `erequest_blobs`, and site configuration fields.
2. Generate and commit the migration artifacts following `DATABASE_MIGRATION_POLICY.md`.
3. Add domain types, repository interfaces, and application-context wiring.
4. Implement blob storage abstraction and local filesystem provider.
5. Implement S3 provider.
6. Add metadata extraction and archival use case.
7. Integrate archival into the inbound processing flow.
8. Add repository queries and server API routes.
9. Add portal navigation and `erequests` list/detail pages.
10. Add settings UI and warnings.
11. Add tests.
12. Update docs.

## Open Questions To Resolve During Implementation

- Which inbound FHIR field is the most reliable source for patient medical record number in Ocean payloads for this deployment?
- Should attachments be retained by default when archival is enabled, or should that be a separate opt-in inside the archival settings?
- Should raw bundle storage be mandatory for retained `erequests`, or configurable for tenants with stricter minimization requirements?
- Do we want document inline preview in v1, or only download?

## Recommended Defaults

- `erequestArchivalEnabled = false`
- `erequestStoreAttachments = true`
- `erequestStoreRawBundle = true`
- local/dev provider = filesystem
- production provider = S3

## Do Not Revisit Unless New Constraints Appear

- Use `erequests` and `erequest_blobs` naming.
- Use `health_service_types` array.
- No redundant `search_text` column.
- Include an MRN index.
- Disabling does not delete retained data.
