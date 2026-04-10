# 🧭 AutoRouter Routing Tools Architecture Analysis

This document provides a comprehensive overview of the architecture and implementation of routing tools within the AutoRouter project.

## 1. Global Summary

### How Routing Tools are Registered, Discovered, and Executed

1.  **Registration**: All routing tools are registered in a central registry located at `src/infrastructure/services/routing-tools/routing-tool-registry.ts`. This file exports a `routingToolRegistry` object that maps tool names to their definitions.

2.  **Discovery**: The `routingToolRegistry` serves as the single source of truth for all available routing tools. The application can dynamically discover tools by importing this registry.

3.  **Execution**:
    *   Each tool definition includes an optional `handler` function.
    *   The logic for each tool is encapsulated within its handler.
    *   To optimize performance and avoid loading server-side dependencies on the client, handlers are dynamically imported using `await import(...)` only when the tool is executed.
    *   The `showCdsCardTool` is a special case; it does not have a handler and is instead used to generate a CDS Hooks card, as indicated by its `supportsCdsHook: true` property.

### Common Design Patterns, Base Abstractions, or Shared Logic

*   **`RoutingToolDefinition`**: All tools adhere to the `RoutingToolDefinition` interface defined in `src/entities/models/routing-tool.ts`. This interface standardizes the structure of a tool, requiring a `name`, `input` schema, and `description`.
*   **Zod for Input Validation**: The `input` for each tool is defined using a `zod` schema, ensuring that all inputs are strongly typed and validated before execution.
*   **Handler Abstraction**: The core logic is abstracted into `handler` functions with a consistent signature: `(action, eventContext, cxt) => Promise<void>`.
*   **`ApplicationContext`**: Handlers receive an `ApplicationContext` (`cxt`) object, which provides access to shared services like logging (`cxt.logger`), database repositories (`cxt.getActivityLogEntriesRepository()`), and external API clients (`cxt.getOceanClientService()`).
*   **Activity Logging**: Every handler concludes by calling `cxt.getActivityLogEntriesRepository().create(...)` to record the outcome of the operation (success or failure) in the activity log.
*   **Ocean Message Service**: Many tools rely on helper functions from `src/infrastructure/services/ocean-message.service.ts` (e.g., `createAssignMessage`, `createForwardMessage`) to construct the message payloads sent to the Ocean API.
*   **API Endpoint**: All tools that interact with the Ocean API do so through a single endpoint: `POST /svc/fhir/v1/$process-messages`. The specific action is determined by the `MessageHeader.eventCoding.code` within the FHIR Bundle request body.

---

## 2. Tool-Specific Analysis

### Tool: `assign`

*   **Purpose:** Assigns a service request to a specific provider listing.
*   **Key Files:**
    *   `src/infrastructure/services/routing-tools/assign.ts`
    *   `src/infrastructure/services/routing-tools/handlers/assign-handler.ts`
*   **Primary Entry Point:** `assignHandler()`
*   **Implements / Extends:** `RoutingToolDefinition`
*   **API Interaction:**
    *   **Endpoint:** `POST /svc/fhir/v1/$process-messages`
    *   **Request Body Construction:** The `createAssignMessage` function (which internally calls `createForwardMessage`) creates a FHIR Bundle. The `MessageHeader` has an `eventCoding.code` of `notify-update-process-request`. The bundle includes an updated `ServiceRequest` resource pointing to the new performer.
*   **Key Steps:**
    1.  **Initialization**: Receives `targetListingName` as input.
    2.  **Core Logic**:
        *   Searches for the target listing by name using `cxt.getHealthcareServicesRepository()`.
        *   Constructs a FHIR Bundle message using `createAssignMessage`.
        *   Sends the message to the Ocean API via `cxt.getOceanClientService().sendMessage()`.
    3.  **Output / Side Effects**:
        *   Makes an API call to the Ocean service.
        *   Creates an entry in the activity log.

### Tool: `changeStatus`

*   **Purpose:** Changes the status of a service request (e.g., "accepted", "rejected").
*   **Key Files:**
    *   `src/infrastructure/services/routing-tools/change-status.ts`
    *   `src/infrastructure/services/routing-tools/handlers/change-status-handler.ts`
*   **Primary Entry Point:** `changeStatusHandler()`
*   **Implements / Extends:** `RoutingToolDefinition`
*   **API Interaction:**
    *   **Endpoint:** `POST /svc/fhir/v1/$process-messages`
    *   **Request Body Construction:** The `createStatusChangeMessage` function creates a FHIR Bundle. The `MessageHeader` has an `eventCoding.code` of `notify-update-process-request`. A `Task` resource is included with the new `status`.
*   **Key Steps:**
    1.  **Initialization**: Receives `status` and an optional `reason`.
    2.  **Core Logic**:
        *   Constructs a status change message using `createStatusChangeMessage`.
        *   Sends the message to the Ocean API.
    3.  **Output / Side Effects**:
        *   Updates the status of the service request in Ocean.
        *   Logs the action to the activity log.

### Tool: `comment`

*   **Purpose:** Adds a comment to the AutoRouter's internal activity log.
*   **Key Files:**
    *   `src/infrastructure/services/routing-tools/comment.ts`
    *   `src/infrastructure/services/routing-tools/handlers/comment-handler.ts`
*   **Primary Entry Point:** `commentHandler()`
*   **Implements / Extends:** `RoutingToolDefinition`
*   **API Interaction:** None. This tool only interacts with the local database.
*   **Key Steps:**
    1.  **Initialization**: Receives a `comment` string.
    2.  **Core Logic**: Creates a new entry in the activity log with the provided comment.
    3.  **Output / Side Effects**: Writes to the `ActivityLogEntries` database table.

### Tool: `forward`

*   **Purpose:** Forwards a service request to a different Ocean listing.
*   **Key Files:**
    *   `src/infrastructure/services/routing-tools/forward.ts`
    *   `src/infrastructure/services/routing-tools/handlers/forward-handler.ts`
*   **Primary Entry Point:** `forwardHandler()`
*   **Implements / Extends:** `RoutingToolDefinition`
*   **API Interaction:**
    *   **Endpoint:** `POST /svc/fhir/v1/$process-messages`
    *   **Request Body Construction:** The `createForwardMessage` function creates a FHIR Bundle. The `MessageHeader` has an `eventCoding.code` of `notify-update-process-request`. The bundle includes an updated `ServiceRequest` resource pointing to the new performer.
*   **Key Steps:**
    1.  **Initialization**: Receives `targetListingName`.
    2.  **Core Logic**:
        *   Finds the target listing's Ocean reference.
        *   Constructs a forward message using `createForwardMessage`.
        *   Sends the message via the Ocean API.
    3.  **Output / Side Effects**:
        *   Initiates a referral forward in Ocean.
        *   Logs the result.

### Tool: `markAsNeedsReview`

*   **Purpose:** Marks a service request as needing manual review.
*   **Key Files:**
    *   `src/infrastructure/services/routing-tools/mark-as-needs-review.ts`
    *   `src/infrastructure/services/routing-tools/handlers/mark-as-needs-review-handler.ts`
*   **Primary Entry Point:** `markAsNeedsReviewHandler()`
*   **Implements / Extends:** `RoutingToolDefinition`
*   **API Interaction:**
    *   **Endpoint:** `POST /svc/fhir/v1/$process-messages`
    *   **Request Body Construction:** The `createSendCommunicationFromRequesterMessage` function creates a FHIR Bundle. The `MessageHeader` has an `eventCoding.code` of `send-communication-from-requester`. A `Communication` resource is included with the message payload.
*   **Key Steps:**
    1.  **Initialization**: Receives a `message` string.
    2.  **Core Logic**:
        *   Constructs a message using `createSendCommunicationFromRequesterMessage`. The message is prefixed with "Autorouter marked as needing review:".
        *   Sends this message to the provider via the Ocean API.
    3.  **Output / Side Effects**:
        *   Sends a communication message that appears in the Ocean portal.
        *   Logs the action.

### Tool: `sendCommunicationToRequester`

*   **Purpose:** Sends a message to the original requester (referrer).
*   **Key Files:**
    *   `src/infrastructure/services/routing-tools/send-communication-to-requester.ts`
    *   `src/infrastructure/services/routing-tools/handlers/send-communication-handler.ts`
*   **Primary Entry Point:** `sendCommunicationHandler()`
*   **Implements / Extends:** `RoutingToolDefinition`
*   **API Interaction:**
    *   **Endpoint:** `POST /svc/fhir/v1/$process-messages`
    *   **Request Body Construction:** The `createSendCommunicationFromProviderMessage` function creates a FHIR Bundle. The `MessageHeader` has an `eventCoding.code` of `send-communication-from-provider`. A `Communication` resource is included with the message payload.
*   **Key Steps:**
    1.  **Initialization**: Receives a `message` string.
    2.  **Core Logic**:
        *   Constructs a message using `createSendCommunicationFromProviderMessage`.
        *   Sends the message via the Ocean API.
    3.  **Output / Side Effects**:
        *   Sends a message to the referrer in Ocean.
        *   Logs the action.

### Tool: `sendEmail`

*   **Purpose:** Sends an email to a specified recipient.
*   **Key Files:**
    *   `src/infrastructure/services/routing-tools/send-email.ts`
    *   `src/infrastructure/services/routing-tools/handlers/send-email-handler.ts`
*   **Primary Entry Point:** `sendEmailHandler()`
*   **Implements / Extends:** `RoutingToolDefinition`
*   **API Interaction:** This tool interacts with an external SMTP service (Smtp2go), not the Ocean API.
*   **Key Steps:**
    1.  **Initialization**: Receives `to`, `subject`, `message`, and optional `cc`, `bcc`.
    2.  **Core Logic**:
        *   Retrieves email provider settings from the site configuration.
        *   Instantiates an email service (`Smtp2goEmailService`).
        *   Optionally generates a referral link if context is available.
        *   Sends a templated email.
    3.  **Output / Side Effects**:
        *   Sends an email via an external SMTP service (Smtp2go).
        *   Logs the outcome.

### Tool: `sendSms`

*   **Purpose:** Sends an SMS message to a specified phone number.
*   **Key Files:**
    *   `src/infrastructure/services/routing-tools/send-sms.ts`
    *   `src/infrastructure/services/routing-tools/handlers/send-sms-handler.ts`
*   **Primary Entry Point:** `sendSmsHandler()`
*   **Implements / Extends:** `RoutingToolDefinition`
*   **API Interaction:** This tool interacts with the Twilio API, not the Ocean API.
*   **Key Steps:**
    1.  **Initialization**: Receives `phoneNumber` and `message`.
    2.  **Core Logic**:
        *   Retrieves Twilio credentials from the site configuration.
        *   Initializes the Twilio client.
        *   Sends the SMS message.
    3.  **Output / Side Effects**:
        *   Sends an SMS via the Twilio API.
        *   Logs the outcome.

### Tool: `setBookingInstructions`

*   **Purpose:** Provides booking instructions to the requester.
*   **Key Files:**
    *   `src/infrastructure/services/routing-tools/set-booking-instructions.ts`
    *   `src/infrastructure/services/routing-tools/handlers/set-booking-instructions-handler.ts`
*   **Primary Entry Point:** `setBookingInstructionsHandler()`
*   **Implements / Extends:** `RoutingToolDefinition`
*   **API Interaction:**
    *   **Endpoint:** `POST /svc/fhir/v1/$process-messages`
    *   **Request Body Construction:** The `createSetBookingInstructionsMessage` function creates a FHIR Bundle. The `MessageHeader` has an `eventCoding.code` of `notify-add-appointment`. An `Appointment` resource is included with the booking instructions in the `description` and `patientInstruction` fields.
*   **Key Steps:**
    1.  **Initialization**: Receives a `message` string.
    2.  **Core Logic**:
        *   Constructs a message using `createSetBookingInstructionsMessage`.
        *   Sends the message via the Ocean API.
    3.  **Output / Side Effects**:
        *   Adds booking instructions to the referral in Ocean.
        *   Logs the action.

### Tool: `showCdsCard`

*   **Purpose:** Displays a CDS Hooks card with information, a warning, or an error.
*   **Key Files:**
    *   `src/infrastructure/services/routing-tools/show-cds-card.ts`
*   **Primary Entry Point:** None (no handler).
*   **Implements / Extends:** `RoutingToolDefinition`
*   **API Interaction:** None.
*   **Key Steps:** This tool has no handler. Its definition is used by the CDS Hooks service to generate a card to be displayed to the user during the submission process.
*   **Notes:** The `supportsCdsHook: true` flag distinguishes this tool from those that perform back-end actions.

### Tool: `summarizeAttachments`

*   **Purpose:** Uses AI to analyze and summarize the content of referral attachments.
*   **Key Files:**
    *   `src/infrastructure/services/routing-tools/summarize-attachments.ts`
    *   `src/infrastructure/services/routing-tools/handlers/summarize-attachments-handler.ts`
*   **Primary Entry Point:** `summarizeAttachmentsHandler()`
*   **Implements / Extends:** `RoutingToolDefinition`
*   **API Interaction:**
    *   **Endpoint:** `POST /svc/fhir/v1/$process-messages`
    *   **Request Body Construction:** After receiving the summary from the AI service, this tool calls `createSendCommunicationFromRequesterMessage` to create a FHIR Bundle. The `MessageHeader` has an `eventCoding.code` of `send-communication-from-requester`. A `Communication` resource is included with the summary as the message payload.
*   **Key Steps:**
    1.  **Initialization**: Receives `instructions` for the AI.
    2.  **Core Logic**:
        *   Retrieves attachments from the event context.
        *   Calls the AI service (`cxt.getAiService().summarizeAttachments`).
        *   Constructs a message containing the summary using `createSendCommunicationFromRequesterMessage`.
        *   Sends the summary as a message to the provider via the Ocean API.
    3.  **Output / Side Effects**:
        *   Makes a call to an external AI service.
        *   Sends a message via the Ocean API.
        *   Logs the action.

### Tool: `toggleEConsult`

*   **Purpose:** Changes an eReferral to an eConsult or vice versa.
*   **Key Files:**
    *   `src/infrastructure/services/routing-tools/toggle-econsult.ts`
    *   `src/infrastructure/services/routing-tools/handlers/toggle-econsult-handler.ts`
*   **Primary Entry Point:** `toggleEConsultHandler()`
*   **Implements / Extends:** `RoutingToolDefinition`
*   **API Interaction:**
    *   **Endpoint:** `POST /svc/fhir/v1/$process-messages`
    *   **Request Body Construction:** The `createToggleEConsultMessage` function creates a FHIR Bundle. The `MessageHeader` has an `eventCoding.code` of `notify-update-process-request`. A `Task` resource is included with an extension `ca-on-eConsult-ext-patient-needs-to-be-seen` set to `true` or `false`.
*   **Key Steps:**
    1.  **Initialization**: Receives a boolean `changeToEConsult`.
    2.  **Core Logic**:
        *   Constructs a message using `createToggleEConsultMessage`.
        *   Sends the message via the Ocean API.
    3.  **Output / Side Effects**:
        *   Changes the referral type in Ocean.
        *   Logs the action.

### Tool: `updateCategory`

*   **Purpose:** Updates the health service category of the request using a SNOMED code.
*   **Key Files:**
    *   `src/infrastructure/services/routing-tools/update-category.ts`
    *   `src/infrastructure/services/routing-tools/handlers/update-category-handler.ts`
*   **Primary Entry Point:** `updateCategoryHandler()`
*   **Implements / Extends:** `RoutingToolDefinition`
*   **API Interaction:**
    *   **Endpoint:** `POST /svc/fhir/v1/$process-messages`
    *   **Request Body Construction:** The `createDataCorrectionMessageWithNewCode` function creates a FHIR Bundle. The `MessageHeader` has an `eventCoding.code` of `notify-data-correction`. The `ServiceRequest` resource is updated with the new SNOMED `code`.
*   **Key Steps:**
    1.  **Initialization**: Receives a `snomedCode`.
    2.  **Core Logic**:
        *   Constructs a data correction message with the new code using `createDataCorrectionMessageWithNewCode`.
        *   Sends the message via the Ocean API.
    3.  **Output / Side Effects**:
        *   Updates the service category of the referral in Ocean.
        *   Logs the action.
