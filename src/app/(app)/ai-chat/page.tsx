import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { ChatClient } from "@/components/ai-chat/chat-client";

export const metadata: Metadata = { title: "AI Assistant | Evenly" };

export default async function AiChatPage() {
  // Gate only: the chat client fetches its own data through authenticated routes.
  await requireSession();
  return <ChatClient />;
}
