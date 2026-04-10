- The routing_rules table has been updated to include a new nullable field: minutes_saved_estimate (integer, nullable)

## Please implement the following changes to support this new field:

- Update backend APIs (CRUD for routing rules):
    - Create rule: accept minutes_saved_estimate if explicitly provided; do not set a default value server-side
    - Get rule: return minutes_saved_estimate as null if not set
    - Update rule: allow minutes_saved_estimate to be set, changed, or cleared (set to null)

- Business logic constraints:
    - Valid values are integers from 1 to 100
    - Field must remain null unless the user explicitly provides a value
    - Do not auto-persist a default (e.g., 5 minutes) unless explicitly set by the user

- UI changes (New Rule and Edit Rule cards):
    - Display this field at the bottom of the card
    - UI hint, "Please provide an estimate of how many minutes of time would be saved if this rules executes
      successfully"
    - Read-only view:
        - If value is null: display “No estimate currently provided”
        - If value is set: display “Estimated X minutes saved per execution of this rile”
    - Edit mode:
        - Show an optional integer input (1–100) or unset
        - Allow clearing the value to return it to null
        - Optionally suggest “5 minutes” as a UI hint or placeholder only (not auto-saved)

- Ensure consistency:
    - UI, API contracts, and database schema all treat this field as optional
    - No implicit defaults applied at any layer

