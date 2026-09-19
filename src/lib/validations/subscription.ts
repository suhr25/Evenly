import { z } from "zod";

export const updateSubscriptionSchema = z.object({
  status: z.enum(["ACTIVE", "IGNORED", "INACTIVE", "DETECTED"]).optional(),
  displayName: z.string().trim().max(100).optional().nullable(),
});
