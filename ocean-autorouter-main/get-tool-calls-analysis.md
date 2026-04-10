# 🧠 IAI Service: getToolCalls Prompt and Parsing Flow Analysis

This document provides a detailed breakdown of how the `getToolCalls()` method in the `IAiService` interface is used to construct prompts, interact with the Language Model, and parse the results into executable tool calls.

## 1. Global Overview

The `IAiService` architecture is designed to abstract the complexities of interacting with different AI models. The system follows a clear, multi-step process for determining and executing tool calls based on user-defined rules and event context.

The end-to-end flow can be summarized as follows:

```
Event Trigger → Use Case → Rule Evaluator → Prompt Builder → AI Service (LLM) → Response Parser → Tool Executor
```

1.  **Event Trigger**: An event, such as a new service request, initiates the process.
2.  **Use Case**: The `processServiceRequestEventUseCase` orchestrates the overall flow.
3.  **Rule Evaluator**: The `evaluateRuleService` iterates through routing rules, constructs a `toolSet`, and builds a prompt.
4.  **Prompt Builder**: Helper functions in the `prompts` directory assemble a detailed prompt string.
5.  **AI Service (LLM)**: The `ai.service.ts` implementation sends the prompt and tools to the configured LLM.
6.  **Response Parser**: The AI service and the rule evaluator parse the LLM's response into a structured `RoutingToolAction[]`.
7.  **Tool Executor**: The `routingToolActionService` executes the final actions.

### Abstraction and Integration

*   **Prompt Generation**: Prompt construction is handled by dedicated functions within the `prompts` directory, separating the prompt logic from the AI service interaction.
*   **AI Service Abstraction**: The `IAiService` interface and its factory `createAiService` provide a single point of entry for all AI interactions. It uses the Vercel AI SDK (`ai` package) to create a unified interface over different providers (OpenAI, Cohere, Google), allowing for easy integration of new models.
*   **Execution**: The decision-making (what to do) is cleanly separated from the execution (doing it). The `evaluateRuleService` decides on the actions, and the `routingToolActionService` performs them.

---

## 2. Implementation Analysis

### Implementation: `createAiService` (Factory)

*   **File:** `src/infrastructure/services/ai.service.ts`
*   **Key Methods:** `getToolCalls()`, `getAiModel()`
*   **Dependencies:** `@ai-sdk/cohere`, `@ai-sdk/google`, `@ai-sdk/openai`, `ai` (Vercel AI SDK)

### `getToolCalls()` Method Deep Dive

#### Prompt Construction Flow

The `getToolCalls` method itself does not construct the prompt. The prompt is built by its primary caller, the `evaluateRule` service.

1.  **Caller**: `evaluateRule` in `src/infrastructure/services/evaluate-rule.service.ts`.

2.  **Inputs Collected**:
    *   `RoutingRule`: Contains the user's natural language instructions (`rule.prompt`) and a list of `enabledTools`.
    *   `RoutingEventMessage`: The full FHIR Bundle of the event.
    *   `RoutingEventType`: The type of event that was triggered.

3.  **Prompt Template Population**:
    *   `evaluateRule` calls `createEvaluationPrompt`, which in turn uses either:
        *   `createEvaluatePEEventRulePrompt` (for patient engagement events)
        *   `evaluateServiceRequestRulePrompt` (for service request events)
    *   These functions, located in `src/infrastructure/services/prompts/`, assemble a detailed text prompt containing:
        *   A system message defining the AI's role as a routing engine.
        *   The description of the event.
        *   A summary of the event message (e.g., service request details).
        *   The user's specific instructions from `rule.prompt`.

    ```typescript
    // Example from evaluateServiceRequestRulePrompt.ts
    let prompt = "You are an intelligent automated routing engine...";
    prompt += "\n\n** AN EVENT HAS OCCURRED: " + getRoutingEventTypeDescription(eventType) + " **";
    prompt += summarizeServiceRequestMessage(routingEventMessage);
    prompt += "\n\nThe user has instructed you to do the following:\n-- BEGIN USER INSTRUCTIONS --\n" + rule.prompt + "\n-- END USER INSTRUCTIONS --";
    ```

4.  **Tool List Construction**:
    *   The `evaluateRule` service dynamically builds a `toolSet` to be passed to the AI.
    *   It starts with the global `routingToolRegistry`.
    *   It filters the tools based on the `eventType` (e.g., `supportsCdsHook` for pre-submission events).
    *   It further filters the tools to only include those specified in the `rule.enabledTools` array.

5.  **LLM Request Formatting and Sending**:
    *   The `getToolCalls` method in `ai.service.ts` receives the final `prompt` string and the `toolSet`.
    *   It retrieves the configured AI model provider (OpenAI, etc.) using `getAiModel()`.
    *   It calls the `generateText` function from the Vercel AI SDK, passing the `model`, `prompt`, and `tools`. Crucially, it sets `toolChoice: "required"`, forcing the model to select a tool.

    ```typescript
    // From ai.service.ts
    const response = await generateText({
      model,
      prompt,
      tools,
      toolChoice: "required",
    });
    ```

#### Return Parsing Flow

1.  **Response Received**: The `generateText` function returns a response object containing a `toolCalls` array with the tool name and arguments chosen by the LLM.

2.  **Tools Extracted and Validated**:
    *   In `ai.service.ts`, the `toolCalls` array from the `generateText` response is mapped to an array of `ToolCall` objects (`{ tool: toolCall.toolName, input: toolCall.input }`).
    *   This `ToolCall[]` is returned to the `evaluateRule` service.

3.  **Tool Execution Triggered**:
    *   In `evaluate-rule.service.ts`, the `ToolCall[]` is mapped to an array of `RoutingToolAction` objects, each with a unique ID.
    *   This `RoutingToolAction[]` is returned to the `processServiceRequestEventUseCase`.
    *   The use case then calls `cxt.getRoutingToolActionService().executeActions(...)`.
    *   The `executeActions` method iterates through the actions and invokes the appropriate `handler` function from the `routingToolRegistry`, thus completing the cycle.

    ```typescript
    // From routing-tool-action.service.ts
    const tool = routingToolRegistry[action.tool];
    // ...
    const handler = tool.handler as (...);
    await handler(action, eventContext, cxt);
    ```
