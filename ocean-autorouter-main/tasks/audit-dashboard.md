# V1 LLM Audit Explorer UI and API Design

## Goal

Implement a V1 “LLM Audit Explorer” page that lets users investigate what AutoRouter did for a referral. Data comes
from:

- `llm_rule_decision_audit` (one row per referral + rule decision)
- `llm_rule_tool_execution_audit` (tool executions linked to a decision)

All data must be scoped to the current user’s `site_id` (multi-tenant).

---

## V1 UI

### Page: Audit Explorer (Activity Log style)

#### A) Filters row (top)

Filters apply within the current `siteId`.

- **Referral ID** (text input)
- **Rule** (dropdown, includes “All rules”) display the name but we need to the rule_id in the filter
- **Date range** (from/to)

Optional V1 toggles (cheap wins):

- Executed only
- Errors only (validation error or tool failure)

#### B) Table of decisions (main list)

A paginated list (default 20) where each row is one `llm_rule_decision_audit` record.

Recommended columns:

- Created At
- Referral ID (copy icon)
- Rule Name (Rule Version in smaller text)
- Decision (EXECUTE/SKIP pill) (with view reason button/icon)
- Validation (status pill, show error icon if `validation_error` is present)
- Confidence (blank if null)
- Tools (count, with red badge if any failed)
- Model (compact: `model_name`)

Row action:

- Expand chevron (inline) or “View” button to reveal tool executions.
- also if the user presses view reason, show a inline expansion with the `reason` text.

#### C) Row expansion: Tool executions

Nested mini table showing `llm_rule_tool_execution_audit` rows for the selected decision, ordered by `tool_index`.

Tool columns:

- Index (`tool_index`)
- Tool name (`tool_name`)
- Status pill (`status`)
- Duration (`finished_at - started_at`)
- Error summary (only if failed)

Expand behavior:

- Auto-expand rows where:
    - `validation_error` exists, or `validation_status` is not OK
    - any tool status is FAILED
- If decision is SKIP and there are no tools, show “No tools executed.”

---

## Pagination guidance

- Default page size: 20
- Optional selector: 20 / 50 / 100
- Use DB-level pagination, and avoid N+1 queries:
    - Query decisions page first
    - Fetch tools for decision IDs in one query

---

## V1 API

### 1) Decisions list endpoint

`GET /api/llm-audit/decisions`

Query params:

- `referralId` (optional)
- `ruleId` (optional)
- `from` (optional timestamp)
- `to` (optional timestamp)
- `decision` (optional: EXECUTE/SKIP)
- `validationStatus` (optional)
- `toolStatus` (optional: FAILED to return rows that have failed tools)
- `page` (default 1)
- `pageSize` (default 20, max 100)
- `sort` (default createdAt desc)

Response:

- Paginated list of decision rows with embedded tool executions
- Server-derived fields to simplify UI:
    - `toolCount`
    - `toolFailedCount`
    - `hasErrors` (validation error or tool failure)

### 2) Rules dropdown endpoint

`GET /api/llm-audit/rules`

Return distinct:

- `ruleId`
- `ruleName`
- optionally `ruleVersion` (if helpful)

This populates the rule filter dropdown.

---

## DTO proposal

### Paginated response

- `items`: `DecisionAuditItem[]`
- `page`: number
- `pageSize`: number
- `total`: number

### DecisionAuditItem

- `decisionAuditId`
- `siteId`
- `referralId`
- `ruleId`
- `ruleName`
- `decision`
- `confidence`
- `reason`
- `modelRequestId`
- `validationStatus`
- `validationError`
- `createdAt`
- `toolExecutions`: `ToolExecutionItem[]`

Derived fields (computed server-side):

- `toolCount`
- `toolFailedCount`
- `hasErrors`

### ToolExecutionItem

- `toolExecutionId`
- `toolIndex`
- `toolName`
- `status`
- `errorCode`
- `errorSummary`
- `startedAt`
- `finishedAt`
- `createdAt`

---

## Query strategy (avoid N+1)

1) Query decisions (with filters, pagination, total count)
2) Fetch tools in one query:
    - `WHERE decision_audit_id IN (:decisionIds)`
3) Group tools by `decision_audit_id` in service layer and attach to decision DTOs

---

## Deliverables

- Updated activity/index.vue page with new Audit Explorer UI below the existing Activity Log
- New API endpoints as specified
- Unit and integration tests for new functionality
- suggest any improvements or changes based on implementation experience
