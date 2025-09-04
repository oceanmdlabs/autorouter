import { z } from "zod";

export const CommandSchema = z.object({
  name: z.string(),
  args: z.array(z.unknown()),
});

export type Command = z.infer<typeof CommandSchema>;

export type CommandResult = {
  error?: string;
  data?: any;
};
