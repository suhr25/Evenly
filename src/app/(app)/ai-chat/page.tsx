import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ChatClient } from "@/components/ai-chat/chat-client";

export const metadata: Metadata = { title: "AI Assistant | Evenly" };

export default async function AiChatPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return <ChatClient />;
}
