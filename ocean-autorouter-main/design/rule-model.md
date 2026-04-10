# AutoRouter: What it is and how it works (MVP rule model)

## What AutoRouter does

AutoRouter is an event driven automation layer for Ocean eReferrals and related healthcare service requests. It listens
for referral lifecycle events (for example: “new referral received”, “referral updated”, “message received”) and applies
clinic defined workflow rules to reduce manual triage and follow-up work.

The goal is operational: make high volume digital referrals manageable by automatically triggering predictable actions (
notifications, routing, tagging, messaging, task creation) when specific conditions are met.

## How AutoRouter works

1. **Event ingestion**

    * Ocean emits an event (for example: new eReferral arrives).
    * AutoRouter receives the event and loads the referral payload plus rule configuration for the destination
      clinic/listing.

2. **Rule evaluation**

    * AutoRouter evaluates rules against the event + referral data.
    * Each rule produces a **single structured decision**: `EXECUTE` or `SKIP`, plus a concise non-PHI reason for
      logging/auditing.

3. **Tool execution**

    * If the decision is `EXECUTE`, AutoRouter invokes one or more tools (actions) with validated arguments.
    * If the decision is `SKIP`, no tools run.

4. **Audit logging**

    * AutoRouter writes an audit record for traceability (rule version, decision, reason, tool calls made, model
      metadata if an LLM was used).

## MVP rule model (important)

For the MVP, every rule is intentionally simple:

* **Each rule is one “if” statement.**
* **No else branches.**
* Output is always either:

    * `EXECUTE` (run the tool calls), or
    * `SKIP` (do nothing)
* A rule does not “fall through” into other actions inside the same rule. If additional behaviors are needed, they
  become additional rules.

This keeps behavior predictable, testable, and easy to audit.

## What “criteria” typically looks like

Rule criteria are usually combinations of:

* **Event type** (new referral vs update vs message)
* **Service requested / specialty** (cardiology, rheumatology, etc.)
* **Structured fields** (priority flags, attachments present, referral category codes)
* **Clinical signals in text** (when permitted and handled safely)
* **Operational constraints** (consent flags, clinic configuration, time windows)

## Tools (actions) AutoRouter may trigger

Tools represent the “do something” step after criteria are met. Examples:

* **Notify staff**: send an internal email or message to a shared inbox
* **Update referral metadata**: apply tags, status changes, routing categories
* **Forward / route**: direct a referral to the correct listing/team (where supported)
* **Patient outreach**: send patient messages or booking links (only when allowed and consented)
* **Task creation / follow-up**: create reminders or internal tasks for staff
* **External integrations**: call third-party systems (EMR add-ons, scheduling systems) via API

In MVP, the emphasis is on straightforward, high-signal automations (often internal notifications and simple routing),
not complex multi-step workflows.

## Key design constraints (why it’s built this way)

* **Deterministic outcomes**: each rule is a simple yes/no gate.
* **Safety and privacy**: decisions and logs avoid patient-identifying details; patient-directed actions require
  explicit authorization and correct arguments.
* **Auditability**: every decision can be traced back to the triggering event, the rule version, and the exact tool
  call(s) executed.
