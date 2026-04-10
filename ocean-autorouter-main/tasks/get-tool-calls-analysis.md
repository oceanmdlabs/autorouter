# 🧠 Analyze IAI Service: getToolCalls Prompt and Parsing Flow

## Objective

Understand how the AutoRouter system constructs and processes prompts for the `getToolCalls()` method defined in the
`IAI` service interface, and how tool calls returned from the LLM are parsed and executed.

## Instructions

1. **Locate the Interface**
    - Find the definition of the `IAI` interface `src/application/services/ai.service.interface.ts`
    - Identify all classes that **implement** this interface (e.g., `OpenAIAIService`, `GeminiAIService`,
      `LocalAIService`, etc.).

2. **Focus on the `getToolCalls()` Method**
    - Examine how `getToolCalls()` is implemented or overridden in each class.
    - Identify what data and parameters are passed into it — especially the **prompt construction process**:
        - What inputs are used to generate the prompt?
        - How are available tools discovered or enumerated?
        - How is the final text prompt or payload formatted before being sent to the model?
    - Document any **helper functions**, **prompt builders**, or **template files** involved in assembling the request.

3. **Trace the Prompt Construction Flow**
   For each relevant implementation:
    - Follow the full call chain leading to the LLM request:
        - Where is the **prompt assembled**?
        - Where is the **model invoked**?
        - How are **tool lists** or **capabilities** determined and included in the prompt?
    - Note any classes or utilities responsible for:
        - Token counting or trimming
        - Message formatting (e.g., JSON structure, system/user messages)
        - Instruction templates or schema validation

4. **Analyze the Return Parsing**
    - Identify how the system parses the model’s response from `getToolCalls()`:
        - How does it detect which tools were requested by the model?
        - Which parser, schema, or function maps those responses to actual tool invocations?
    - Trace the flow of execution that ultimately **calls the corresponding tool functions**.
    - Document the involved:
        - **Classes**
        - **Methods**
        - **File paths**
        - **Data transformations** (e.g., JSON → function call)

5. **Summarize Findings**
   For each class that implements `IAI`:
   ### Implementation: [ClassName]
   **File:** `path/to/file.ts`  
   **Key Methods:** `getToolCalls()`, `buildPrompt()`, `parseToolResponse()`, etc.  
   **Prompt Construction Flow:**
    1. Inputs collected
    2. Prompt template populated
    3. LLM request formatted and sent  
       **Return Parsing Flow:**
    1. Response received from model
    2. Tools extracted and validated
    3. Tool execution triggered  
       **Dependencies:** Shared utilities, schema parsers, or tool registries used.


6. **Global Overview**

    * Summarize how the entire `IAI` architecture works as a system:

        * How prompt generation and parsing are abstracted.
        * How new AI implementations integrate with this interface.
        * Where the main abstraction boundaries exist.
    * Optionally, include a short diagram (Markdown or ASCII) showing the flow from:

      ```
      request → prompt builder → LLM → response parser → tool executor
      ```

## Output Format

* Use **Markdown** for all output.
* Include code snippets, file paths, and method names.
* Clearly explain each step of the `getToolCalls()` lifecycle, from input → prompt → model → parsed output → tool
  execution.

## Goal

Produce a clear, implementation-focused breakdown of:

* How `getToolCalls()` prompts are constructed.
* How responses are parsed and mapped to tool invocations.
* What files, classes, and methods are involved in the end-to-end flow.


