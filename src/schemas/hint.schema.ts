import { z } from "zod";

export const useHintSchema = z.object({
  hintType: z.enum(["next_step", "solve"]),
  idempotencyKey: z.string().min(1).max(200),
});

export type UseHintInput = z.infer<typeof useHintSchema>;
