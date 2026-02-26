import { z } from "zod";
import type { RoutingToolDefinition } from "@/src/entities/models/routing-tool";

const name = "showCdsCard";
const showCdsCard = z.object({
  severity: z.enum(["info", "warning", "blocker"]),
  title: z.string(),
  message: z.string(),
});
const parameters = showCdsCard;

export const showCdsCardTool: RoutingToolDefinition<
  typeof name,
  typeof parameters
> = {
  name,
  input: parameters,
  description:
    "Provide supplemental information, warnings, or errors regarding the submission (via a CDS Hooks card)",
  briefDescription: "CDS Submission Hook",
  supportsCdsHook: true,
};
