"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Mail, RefreshCw, Unlink } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useDisconnectGmail,
  useGmailStatus,
  useSyncGmail,
} from "@/hooks/use-gmail";

const STATUS_MESSAGES: Record<string, { type: "success" | "error"; text: string }> = {
  connected: { type: "success", text: "Gmail connected." },
  denied: { type: "error", text: "Gmail connection was cancelled." },
  error: { type: "error", text: "Couldn't connect Gmail. Please try again." },
  not_configured: {
    type: "error",
    text: "Gmail sync isn't configured on this server yet (missing Google OAuth credentials).",
  },
};

export function GmailImportCard() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useGmailStatus();
  const sync = useSyncGmail();
  const disconnect = useDisconnectGmail();

  useEffect(() => {
    const flag = searchParams.get("gmail");
    if (!flag) return;
    const message = STATUS_MESSAGES[flag];
    if (message) {
      if (message.type === "success") toast.success(message.text);
      else toast.error(message.text);
    }
    queryClient.invalidateQueries({ queryKey: ["gmail-status"] });
    window.history.replaceState(null, "", "/settings");
  }, [searchParams, queryClient]);

  async function handleSync() {
    try {
      const result = await sync.mutateAsync();
      if (result.imported > 0) {
        toast.success(
          `Found ${result.imported} new transaction${result.imported === 1 ? "" : "s"} to review in Money Flow.`
        );
      } else {
        toast.info(`Scanned ${result.scanned} email${result.scanned === 1 ? "" : "s"}, nothing new.`);
      }
      queryClient.invalidateQueries({ queryKey: ["pending-imports"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    }
  }

  async function handleDisconnect() {
    try {
      await disconnect.mutateAsync();
      toast.success("Gmail disconnected");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to disconnect");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="size-4 text-primary" aria-hidden />
          Gmail auto-import
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Evenly can scan your Gmail for bank transaction alert emails and stage them for you to
          review in Money Flow. One tap to confirm instead of typing each one in. Nothing is ever
          added to your budget automatically; you always confirm first. Read-only access, Evenly
          never sends or modifies your mail.
        </p>

        {isLoading ? null : status?.connected ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              Connected as <span className="font-medium">{status.emailAddress}</span>
              {status.lastSyncedAt && (
                <span className="text-muted-foreground">
                  {" "}
                  · last synced {new Date(status.lastSyncedAt).toLocaleString()}
                </span>
              )}
            </p>
            <div className="flex gap-2">
              <Button onClick={handleSync} disabled={sync.isPending} size="sm">
                {sync.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="size-4" aria-hidden />
                )}
                Sync now
              </Button>
              <Button
                onClick={handleDisconnect}
                disabled={disconnect.isPending}
                variant="outline"
                size="sm"
              >
                <Unlink className="size-4" aria-hidden />
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <a href="/api/integrations/gmail/connect" className={buttonVariants({ className: "w-fit" })}>
            <Mail className="size-4" aria-hidden />
            Connect Gmail
          </a>
        )}
      </CardContent>
    </Card>
  );
}
