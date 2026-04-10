import type { ServiceRequestEventMessage } from "@/src/entities/models/routing-evaluation";
import type { RoutingEventType } from "@/src/entities/models/routing-event-type";
import { getRoutingEventTypeDescription } from "@/src/entities/models/routing-event-type";
import type { RoutingRule } from "@/src/entities/models/routing-rule";
import type { RoutingToolName } from "@/src/infrastructure/services/routing-tools/routing-tool-registry";
import { routingToolRegistry } from "@/src/infrastructure/services/routing-tools/routing-tool-registry";
import { summarizeServiceRequestMessage } from "./service-request-summarizer";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * Generates a JSON schema representation of a tool's input schema for the prompt
 * with additional hints about required fields
 */
function getToolSchemaForPrompt(toolName: RoutingToolName): { schema: string; requiredFields: string[] } {
  const tool = routingToolRegistry[toolName];
  if (!tool) return { schema: "{}", requiredFields: [] };

  const jsonSchema = zodToJsonSchema(tool.input, { target: "openApi3" }) as {
    properties?: Record<string, unknown>;
    required?: string[];
  };

  // Extract required fields from the schema
  const requiredFields = jsonSchema.required || [];

  return {
    schema: JSON.stringify(jsonSchema, null, 2),
    requiredFields
  };
}

/**
 * Generates the allowed tools list with their schemas for the prompt
 */
function getToolsSchemaSection(enabledTools: string[]): string {
  if (enabledTools.length === 0) {
    return "No tools are enabled for this rule. You MUST output decision: SKIP.";
  }

  const toolDescriptions = enabledTools
    .filter((toolName) => toolName in routingToolRegistry)
    .map((toolName) => {
      const tool = routingToolRegistry[toolName as RoutingToolName];
      const { schema, requiredFields } = getToolSchemaForPrompt(toolName as RoutingToolName);

      let requiredNote = "";
      if (requiredFields.length > 0) {
        requiredNote = `\n**REQUIRED fields (you MUST provide values for these):** ${requiredFields.join(", ")}`;
      }

      return `### ${toolName}
Description: ${tool.description}${requiredNote}
Args Schema:
\`\`\`json
${schema}
\`\`\``;
    })
    .join("\n\n");

  return `## Allowed Tools for This Rule

**ARGUMENT EXTRACTION:**
- Extract argument values from the user instructions or referral data.
- Populate the "args" object with the extracted values.
- If you cannot find a required value, output decision: "SKIP".

**ARGUMENT TYPE RULES:**
- Enum fields: Use one of the allowed values from the schema.
- Boolean fields: Use \`true\` or \`false\` (not strings).
- String fields: Use the text from user instructions or referral data.

**EXAMPLES:**
sendEmail: {"to": "admin@clinic.com", "subject": "Alert", "message": "New patient"}
changeStatus: {"status": "accepted"}
toggleEConsult: {"changeToEConsult": true}

${toolDescriptions}`;
}

export const createJsonDecisionPrompt = ({
                                           rule,
                                           routingEventMessage,
                                           eventType,
                                           referralId
                                         }: {
  rule: RoutingRule;
  routingEventMessage: ServiceRequestEventMessage;
  eventType: RoutingEventType;
  referralId: string;
}): string => {
  const toolsSection = getToolsSchemaSection(rule.enabledTools);


  return `You are an automated reasoning engine for healthcare service requests (eReferrals).

Your task is to evaluate whether the rule criteria are met and output a structured JSON decision.

## Critical Rules

1. Output ONLY valid JSON matching the schema below. No prose, no markdown, no explanations outside the JSON.

2. PHI / Privacy:
   - Never include patient PHI anywhere in the output JSON (including reasonSummary, tool rationales, and tool args).
   - Patient PHI includes: patient names, DOB, addresses, phone numbers, patient emails, medical record numbers, or any identifiers that could identify a patient.
   - IMPORTANT EXCEPTION: Any personal/contact information explicitly provided inside the "-- BEGIN USER INSTRUCTIONS --" block is permitted to be used in tool arguments ONLY, because it is clinic-provided operational configuration (for example: notification email addresses). Do not echo that information outside tool args (do not include it in reasonSummary or rationale).

3. Tool execution correctness:
   - If decision is "EXECUTE", you MUST produce a valid tools array with tool calls that include ALL required arguments.
   - You MUST extract argument values from the user instructions or referral data and put them in the args object.
   - An empty args object {} is NEVER valid when a tool has required fields.
   - If you cannot provide ALL required arguments safely and exactly, you MUST output decision: "SKIP" and tools: [].

4. Tool count default:
   - Unless the user instructions explicitly request multiple tool calls (for example, multiple recipients or multiple actions), you MUST output exactly ONE tool call when decision is "EXECUTE".
   - Do not output multiple instances of the same tool to describe errors or uncertainty.
   - If multiple tool calls are truly required by the user instructions, output one tool entry per required call.

5. Never invent configuration values:
   - Only use values present in the referral data or in the "-- BEGIN USER INSTRUCTIONS --" block.
   - If a required value is missing, decision must be "SKIP" with a concise non-PHI reasonSummary.

## Output JSON Schema

{
  "referralId": "string - the referral ID provided",
  "rule": {
    "ruleId": "string - the rule ID provided",
    "ruleName": "string - the rule name provided",
    "ruleVersion": "string - use '1.0' as default"
  },
  "decision": "EXECUTE" | "SKIP",
  "reasonSummary": "string - concise, non-PHI reason for the decision",
  "confidence": number (0.0 to 1.0),
  "tools": [
    {
      "toolName": "string - must be from allowed tools list",
      "args": { /* must match tool's args schema exactly */ },
      "rationale": "string - concise, non-PHI reason for this tool"
    }
  ],
  "model": {
    "name": "YOUR_MODEL_NAME",
    "requestId": "SYSTEM_PROVIDED"
  }
}

## Decision Rules

- If rule criteria are clearly met AND you can provide valid tool arguments: decision = "EXECUTE"
  - tools MUST contain exactly one tool call unless user instructions explicitly require multiple.
- If rule criteria are NOT met OR you cannot safely determine required arguments: decision = "SKIP"
  - tools MUST be [] when SKIP.

${toolsSection}

## Event Context

** EVENT: ${getRoutingEventTypeDescription(eventType)} **

Referral ID: ${referralId}
Rule ID: ${rule.id}
Rule Name: ${rule.name}

${summarizeServiceRequestMessage(routingEventMessage)}

## User Rule Instructions

-- BEGIN USER INSTRUCTIONS --
${rule.prompt}
-- END USER INSTRUCTIONS --

## IMPORTANT: Argument Extraction Steps

Before outputting your JSON, extract the following from the user instructions above:
1. Look for email addresses (e.g., "email: xxx@yyy.com" or "send to xxx@yyy.com")
2. Look for subjects (e.g., "subject: ..." or "with subject ...")  
3. Look for messages (e.g., "message: ..." or "Message: ...")
4. Look for any other required field values

Place these extracted values in the tool's "args" object. Do NOT leave args empty.

Now output your JSON decision.`;
};

