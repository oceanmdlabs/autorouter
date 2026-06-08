# AWS-Hosted Clinic Onboarding Response Template

Use this when replying to a clinic contact who wants to try Ocean Autorouter without operating the software themselves.

## Email Template

Subject: Ocean Autorouter pilot for referral triage

Hi Althea,

Thanks for reaching out. Yes, this sounds like a good fit for the Autorouter project.

The short version is that we can run an AWS-hosted version of the Autorouter and connect it to a defined subset of your Ocean referrals. Instead of you having to manually review every incoming referral first, the Autorouter can apply clinic-specific instructions to the referrals you choose and then take limited actions in Ocean, such as:

- adding booking instructions for straightforward referrals,
- adding an internal triage summary to the Autorouter activity log,
- marking a referral as needing manual review when it is unclear, urgent, missing information, or outside the agreed criteria,
- optionally notifying a clinic email address when a referral matches a higher-priority rule.

For your use case, I would start conservatively. We would not ask the system to make final clinical decisions at first. A useful first pilot would be:

1. Choose one subset of referrals, such as one Ocean source, one referral form, one health service category, or one common referral reason.
2. Write a clear triage instruction for that subset.
3. Have the Autorouter produce a short triage note and suggested booking instructions.
4. Leave anything uncertain in the manual review queue.
5. Compare the Autorouter output against your normal manual review before enabling any stronger automation.

Here is an example of the kind of instruction we can configure:

```text
For incoming referrals from [selected Ocean source/category], review the referral reason, form answers, and attached documentation if attachment review is enabled.

If the referral clearly meets the clinic's routine booking criteria, add booking instructions in Ocean:
"Autorouter triage: appears appropriate for routine booking. Suggested booking type: [visit type]. Suggested timeframe: [timeframe]. Reason: [one-sentence rationale]."

Also add an Autorouter activity log comment with a concise triage summary, including the referral reason, key positives, key negatives, and any missing information.

If the referral is urgent, unclear, outside clinic criteria, missing required information, or contains red flags, do not add booking instructions. Mark it as needing manual review and explain why in one sentence.

Do not accept, decline, forward, or complete the referral unless that action has been separately approved for this rule.
```

I have attached the current Autorouter instructions and overview materials:

- `docs/autorouter-rule-examples.md` - example rule instructions and supported actions.
- `docs/autorouter-overview/AutoRouter Overview.docx` - non-technical overview and setup notes.
- `docs/privacy/privacy-considerations.md` - privacy and safety considerations before processing real referral content with AI.

For onboarding to the AWS-hosted version, the next steps are:

1. Confirm the exact referral subset you want to pilot.
2. Confirm who should have access to the Autorouter portal.
3. Confirm who at the clinic can approve the rule instructions.
4. Configure the Ocean connection for your clinic tenant.
5. Configure the AI provider for the tenant. We can discuss whether that should be our hosted model setup or a clinic-controlled model. A local Ollama setup may be possible, but it would need a secure integration path from the AWS-hosted app to that model, so I would treat that as a separate technical discussion rather than the default first pilot.
6. Run test referrals first, then review real cases in a monitored pilot.

If helpful, send me two or three examples of referrals you review often, plus what you would normally decide or write as booking instructions. I can turn those into an initial Autorouter rule for you to review.

Thanks,

[Your name]

## Internal Onboarding Checklist

- Create or confirm the clinic tenant in the AWS-hosted Autorouter.
- Invite the clinic users and assign appropriate tenant roles.
- Configure Ocean credentials in Site Settings.
- Configure AI provider settings in Site Settings.
- Confirm whether attachment analysis is enabled. Keep it disabled until privacy review is complete.
- Add one narrow routing rule for the pilot subset.
- Enable only low-risk tools at first:
  - `comment`
  - `setBookingInstructions`
  - `markAsNeedsReview`
  - optional `sendEmail`
- Avoid `changeStatus`, `forward`, `assign`, or `toggleEConsult` until the clinic has reviewed pilot results.
- Test with sample referrals in the Testing UI.
- Review LLM decision audit output and Activity Log entries.
- Document clinical owner approval before production use.

## Suggested First Rule

Rule name: `Pilot triage summary and booking instructions`

Trigger: inbound eReferral for `[clinic subset]`

Allowed tools:

- `comment`
- `setBookingInstructions`
- `markAsNeedsReview`

Instructions:

```text
Apply this rule only to referrals in [clinic subset].

Summarize the referral in two or three short sentences for clinic triage. Include the reason for referral, the key clinical facts supporting the triage suggestion, relevant negatives if present, and missing information that affects booking.

If the referral is clearly appropriate for routine booking under the clinic's criteria, use setBookingInstructions with this format:
"Autorouter triage: [routine/priority label]. Suggested booking: [visit type or appointment type]. Suggested timeframe: [timeframe]. Rationale: [brief reason]. Missing information: [none or list]."

Use comment to record the same concise triage summary in the Autorouter Activity Log.

If there are red flags, urgent symptoms, conflicting information, missing required information, an unsupported referral type, or insufficient confidence, use markAsNeedsReview with a one-sentence reason. Do not set booking instructions in those cases.

Do not accept, decline, forward, assign, complete, or convert the referral.
```

## References

- [README.md](../../README.md)
- [HOSTING.md](../../HOSTING.md)
- [AWS CDK deployment guide](../../infrastructure/cdk/README.md)
- [Autorouter rule examples](../autorouter-rule-examples.md)
- [Privacy considerations](../privacy/privacy-considerations.md)
