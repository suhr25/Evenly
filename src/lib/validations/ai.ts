import { z } from "zod";

export const sendChatMessageSchema = z.object({
  message: z.string().trim().min(1, "Message can't be empty").max(2000),
});
