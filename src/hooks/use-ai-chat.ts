import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface ChatMessageDTO {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Something went wrong");
  return body.data as T;
}

export function useChatHistory() {
  return useQuery({
    queryKey: ["ai-chat"],
    queryFn: () => fetchJson<{ messages: ChatMessageDTO[] }>("/api/ai/chat"),
  });
}

export function useSendChatMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (message: string) =>
      fetchJson<{ message: string }>("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      }),
    // The user's message is persisted server-side even if the AI call
    // itself then fails (e.g. no provider configured), so refetch on
    // settle rather than success only, and await it so the real
    // (already-saved) message is in the cache before the caller's
    // mutateAsync resolves/rejects.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["ai-chat"] }),
  });
}

export function useClearChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => fetchJson("/api/ai/chat", { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-chat"] }),
  });
}
