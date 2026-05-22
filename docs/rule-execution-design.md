# Rule Execution Design

This note covers the design direction for:

- [#7](https://github.com/oceanmdlabs/autorouter/issues/7): rule priority and stop-processing controls
- [#8](https://github.com/oceanmdlabs/autorouter/issues/8): dry-run payload preview and optional sandbox execution
- [#12](https://github.com/oceanmdlabs/autorouter/issues/12): duplicate and conflict detection for messaging tools
- [#14](https://github.com/oceanmdlabs/autorouter/issues/14): LLM decision and tool execution audit UI

The current system evaluates all tenant rules in repository order, then executes every returned tool action. That is simple, but it gives administrators no first-class way to reason about order, intentional short-circuiting, skipped rules, or conflicting actions.

## Design Goals

1. Make rule execution order explicit and deterministic.
2. Keep the administrator mental model simple: top rules run before lower rules.
3. Preserve current behavior by default when existing rules are migrated.
4. Let admins intentionally stop later rules after a high-confidence rule fires.
5. Show the same ordered execution plan in production audit records and Testing.
6. Warn about materially risky conflicts without over-indexing on harmless duplicate notifications.

## Priority Model

Each routing rule should have a persisted numeric `priority`.

The admin UI should present rule order as a sortable list. Dragging or moving rules in the list updates the numeric priority. Users should not need to hand-edit priority numbers during normal use.

Recommended semantics:

- Higher priority runs first.
- Existing rules receive priorities inferred from their current visible sort order during migration.
- New rules default to the lowest priority unless inserted at a specific position.
- Ties are resolved deterministically by `createdAt asc`, then `id asc`.
- The repository should always return rules in execution order unless a caller explicitly asks for another order.

This gives us an explicit implementation model while keeping the product behavior close to "rules run in the order shown on screen."

## Stop-Processing Model

Rules should get an optional `stopProcessingOnMatch` flag.

When a rule evaluates to triggered and has at least one valid planned action, later rules are skipped if `stopProcessingOnMatch` is enabled. The skip should happen after the matched rule's actions are planned, not before validation. If the matched rule errors or produces no valid actions, processing should continue unless a future design introduces a stricter failure policy.

Recommended first version:

- Default: off.
- Applies to all later rules for the same event.
- Skipped rules are recorded as skipped because an earlier rule stopped processing.
- Testing shows skipped rules in the ordered plan.
- Audit records preserve which rule stopped processing and which rules were skipped.

Do not add conflict groups in the first version unless design review finds a concrete need. A global stop flag is easier to explain and enough for common cases like "auto-reject vasectomy, then stop."

### Stop Subsequent Rule Evaluations

"Stop subsequent rule evaluations" should be treated as an execution-control outcome, not as a normal routing tool.

Routing tools produce operational side effects such as changing status, forwarding, sending a message, or adding a comment. Stopping later rules changes the evaluator's control flow. Keeping that as first-class rule metadata makes the behavior easier to reason about, test, and audit:

- The system can stop before spending model calls on later rules.
- Testing can show skipped rules without pretending a user-facing tool executed.
- Audit records can distinguish "rule executed a tool" from "rule controlled the evaluation plan."
- The behavior remains deterministic and does not depend on the model remembering to call a special tool.

The UI label can still be direct: `Stop subsequent rule evaluations after this rule matches`.

## Evaluation Context Between Rules

The current system does not feed previous rule outcomes into subsequent rule evaluations. Each rule is evaluated independently against the original event payload and its own rule instructions.

There are two viable designs:

1. Stop evaluation when an earlier rule reaches a terminal outcome.
2. Continue evaluation, but include prior rule decisions and planned actions in the prompt context for later rules.

The first design should be the default for terminal outcomes such as auto-decline, auto-complete, or other actions that intentionally resolve the referral workflow. It is cheaper, more deterministic, and avoids asking later rules to reason around an already-terminal state.

The second design is useful when later rules should enrich or notify based on earlier decisions. For example, one rule may classify the referral as urgent, and a later rule may send different internal notifications based on that classification. If this design is added, the context should be structured and bounded rather than a free-form transcript.

Recommended first version:

- Add an internal `RuleExecutionPlan` model that accumulates evaluated rules, planned actions, skips, conflicts, and terminal outcomes.
- Do not feed prior outcomes into LLM prompts by default.
- Stop later evaluations when a matched rule has `stopProcessingOnMatch`.
- Consider prior-outcome prompt context later, after there is a concrete use case that cannot be solved with rule order plus stop-processing.

## Conflict Detection

Generic duplicate messages are not the highest concern. Clinics may intentionally send similar internal notifications to multiple teams or send a requester-facing message plus an internal notification for the same event.

The more important conflicts are cases where the system plans actions that would leave the referral in an incoherent operational state.

Examples worth detecting:

- `change-status` conflict: one rule accepts a referral while another declines or completes it.
- Destination conflict: one rule forwards to Listing A while another forwards or assigns to Listing B.
- Review conflict: one rule marks a referral as needing review while another rule completes, declines, or otherwise removes it from normal review flow.
- Requester communication conflict: one rule sends the requester a rejection/decline explanation while another sends an acceptance or booking-instructions message.
- Priority or category conflict, if those tools are added later: separate rules set incompatible urgency/category values.
- Sandbox safety conflict: a dry run plans both state-changing Ocean actions and outbound SMS/email execution in the same manual sandbox execution request.

Examples that should usually be warnings at most:

- Two internal emails to different operational recipients.
- An internal email plus an audit comment.
- A requester message plus an internal notification when the content is consistent.
- Multiple comments that document different parts of the same decision.

Recommended first version:

- Add a conflict-analysis step after all rule evaluations and before action execution.
- Classify conflicts as `warning` or `blocking`.
- Start with blocking only for incompatible state-changing Ocean actions.
- Treat message-content conflicts as warnings unless they include clearly incompatible requester-facing outcomes.
- Always show conflicts in Testing and audit views.

This avoids turning conflict detection into a broad content-similarity project before the execution model is stable.

## Testing Modes

Testing should grow from a pure evaluator into three explicit modes.

### Evaluate Only

This is the current behavior.

- Evaluate rules in execution order.
- Show each rule's decision, planned actions, and comments.
- Show stop-processing skips.
- Show conflict warnings and blocking conflicts.
- Do not render final outbound provider payloads unless already available from action plans.
- Never execute tools.

### Dry Run

Dry run should render exact outbound payloads without sending them.

- Evaluate rules in execution order.
- Render Ocean, email, and SMS payloads as they would be submitted.
- Include validation status for every planned tool.
- Show whether each action would execute, be skipped by stop-processing, or be blocked by conflict detection.
- Persist no production side effects.

### Sandbox Execution

Sandbox execution should be an explicit admin-only action, not the default test path.

- Require a configured sandbox tenant or sandbox endpoint.
- Require manual selection of the planned actions to execute.
- Block execution when blocking conflicts remain.
- Record the initiating user, source test request, rule decisions, rendered payloads, and execution results.
- Make outbound SMS/email opt-in per execution, even in sandbox mode.

The first implementation can ship Evaluate Only plus Dry Run. Sandbox Execution can follow after the dry-run payload model is reliable.

## Audit UI

The audit UI should explain an event as an ordered execution timeline.

Recommended timeline shape:

1. Event received.
2. Rules evaluated in priority order.
3. Each rule shows decision, confidence where available, reason, planned tools, and validation status.
4. Stop-processing decision shown inline.
5. Skipped rules shown with the reason they were skipped.
6. Conflict analysis shown before execution results.
7. Tool execution results shown with status, duration, and concise error summaries.

The UI should support two primary questions:

- Why did this referral move or not move?
- Which rule or tool created the operational outcome?

Analytics can come later. The first audit pass should optimize for traceability and support/debug workflows.

## Implementation Slices

### Slice 1: Ordered Rules

- Add `priority` to routing rules.
- Backfill existing rules from current sort order.
- Return rules in priority order from the repository.
- Update routing-rule list UI to support reordering.
- Show priority/order in read views.

### Slice 2: Stop Processing

- Add `stopProcessingOnMatch`.
- Update production and Testing evaluation loops to produce an ordered execution plan.
- Include skipped-rule results in the returned model.
- Record stop-processing as execution-control metadata rather than a routing tool action.
- Add tests for triggered, non-triggered, errored, and skipped rules.

### Slice 3: Conflict Analysis

- Add a deterministic action-plan conflict analyzer.
- Start with state-changing Ocean actions.
- Return warnings and blocking conflicts in Testing.
- Block production execution only for conflicts explicitly classified as blocking.

### Slice 4: Dry Run Payloads

- Add tool-level payload renderers that do not execute side effects.
- Return rendered payloads from Testing.
- Keep payload rendering close to the existing tool handlers so dry-run and execution do not drift.

### Slice 5: Audit Timeline

- Extend audit records to capture execution order, stop-processing skips, and conflict results.
- Present rule decisions and tool executions as a single ordered timeline.
- Add filtering by referral, rule, decision, validation status, and tool status.

## Open Design Questions

1. Should `stopProcessingOnMatch` require at least one successfully executed action, or is a valid planned action enough?
2. Should admins be allowed to reorder inactive rules, or should inactive rules stay pinned below active rules?
3. Should blocking conflicts prevent production execution by default, or should the first release be warning-only in production?
4. How much rendered payload detail can be safely shown to each role when PHI may be present?
5. Should sandbox execution live in the Testing page only, or should it also be available from audit records for replay/debug workflows?
6. Are there concrete workflows where later rules need structured prior-outcome context, or can the first release rely on priority plus stop-processing?
