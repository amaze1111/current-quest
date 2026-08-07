import { z } from "zod";

export const completeLevelSchema = z.object({
  timeMs: z.number().int().min(0),
});

export type CompleteLevelInput = z.infer<typeof completeLevelSchema>;
