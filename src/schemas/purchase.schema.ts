import { z } from "zod";

export const verifyPurchaseSchema = z.object({
  productId: z.string().min(1),
  purchaseToken: z.string().min(1),
});

export type VerifyPurchaseInput = z.infer<typeof verifyPurchaseSchema>;
