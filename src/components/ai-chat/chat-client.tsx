"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useChatHistory, useClearChat, useSendChatMessage } from "@/hooks/use-ai-chat";

const MARKDOWN_COMPONENTS = {
  p: (props: React.ComponentProps<"p">) => <p className="mb-2 last:mb-0" {...props} />,
  ul: (props: React.ComponentProps<"ul">) => <ul className="mb-2 list-disc space-y-0.5 pl-4 last:mb-0" {...props} />,
  ol: (props: React.ComponentProps<"ol">) => <ol className="mb-2 list-decimal space-y-0.5 pl-4 last:mb-0" {...props} />,
  li: (props: React.ComponentProps<"li">) => <li {...props} />,
  strong: (props: React.ComponentProps<"strong">) => <strong className="font-semibold" {...props} />,
  code: (props: React.ComponentProps<"code">) => (
    <code className="rounded bg-black/10 px-1 py-0.5 text-xs dark:bg-white/10" {...props} />
  ),
};

const SUGGESTED_PROMPTS = [
  "How much did I spend on food this month?",
  "Who owes me money?",
  "What's my biggest expense category?",
  "How much did I spend last month?",
  "Do I have any recurring expenses?",
  "How am I doing on my budgets?",
];

export function ChatClient() {
  const { data, isLoading } = useChatHistory();
  const sendMessage = useSendChatMessage();
  const clearChat = useClearChat();
  const [input, setInput] = useState("");
  const [pendingUserText, setPendingUserText] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = data?.messages ?? [];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, pendingUserText]);

  async function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sendMessage.isPending) return;
    setInput("");
    setPendingUserText(trimmed);
    try {
      await sendMessage.mutateAsync(trimmed);
      setUnavailable(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      if (message.toLowerCase().includes("unavailable")) {
        setUnavailable(true);
      } else {
        toast.error(message);
      }
    } finally {
      setPendingUserText(null);
    }
  }

  async function handleClear() {
    try {
      await clearChat.mutateAsync();
      toast.success("Chat cleared");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clear chat");
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4 md:h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Assistant</h1>
          <p className="text-sm text-muted-foreground">Ask about your real spending, income, and balances.</p>
        </div>
        {messages.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleClear} disabled={clearChat.isPending}>
            <Trash2 className="size-3.5" aria-hidden />
            Clear chat
          </Button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto rounded-lg border p-4">
        {isLoading ? null : messages.length === 0 && !pendingUserText ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <Sparkles className="size-8 text-muted-foreground/50" aria-hidden />
            <div>
              <p className="font-medium">Ask me anything about your money</p>
              <p className="text-sm text-muted-foreground">I&apos;ll look up your real data before answering.</p>
            </div>
            <div className="flex max-w-lg flex-wrap justify-center gap-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleSend(prompt)}
                  className="rounded-full border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((m) => (
              <ChatBubble key={m.id} role={m.role} content={m.content} />
            ))}
            {pendingUserText && <ChatBubble role="user" content={pendingUserText} />}
            {sendMessage.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                Thinking...
              </div>
            )}
            {unavailable && (
              <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                AI features are currently unavailable. Everything else in Evenly still works.
              </p>
            )}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(input);
        }}
        className="flex items-end gap-2"
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend(input);
            }
          }}
          placeholder="Ask about your spending..."
          rows={1}
          className="max-h-32 min-h-10 flex-1 resize-none"
        />
        <Button type="submit" size="icon" disabled={!input.trim() || sendMessage.isPending} aria-label="Send message">
          <Send className="size-4" aria-hidden />
        </Button>
      </form>
    </div>
  );
}

function ChatBubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const isUser = role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm sm:max-w-[70%]",
          isUser ? "whitespace-pre-wrap bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        {isUser ? content : <ReactMarkdown components={MARKDOWN_COMPONENTS}>{content}</ReactMarkdown>}
      </div>
    </div>
  );
}
