"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, Mail, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { buildWhatsAppLink } from "@/lib/payment-links";
import { useGenerateInvite } from "@/hooks/use-groups";

interface InviteMemberDialogProps {
  groupId: string;
  groupName: string;
  memberId: string;
  memberName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteMemberDialog({
  groupId,
  groupName,
  memberId,
  memberName,
  open,
  onOpenChange,
}: InviteMemberDialogProps) {
  const generateInvite = useGenerateInvite(groupId);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || link || generateInvite.isPending) return;
    generateInvite
      .mutateAsync(memberId)
      .then(({ token }) => setLink(`${window.location.origin}/invite/${token}`))
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Failed to create invite link");
        onOpenChange(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setLink(null);
      setCopied(false);
    }
  }

  async function copyLink() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const message = `Hey ${memberName}, join our "${groupName}" group on Evenly so we can split expenses together: ${link}`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Invite {memberName}</DialogTitle>
          <DialogDescription>
            Send this link so they can sign up (or log in) and join &ldquo;{groupName}&rdquo; with a
            shared dashboard.
          </DialogDescription>
        </DialogHeader>

        {generateInvite.isPending || !link ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Input readOnly value={link} className="flex-1" />
              <Button type="button" variant="outline" size="icon" onClick={copyLink} aria-label="Copy link">
                {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  window.open(buildWhatsAppLink("", message), "_blank", "noopener,noreferrer")
                }
              >
                <MessageCircle className="size-4" aria-hidden />
                Share on WhatsApp
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  window.location.href = `mailto:?subject=${encodeURIComponent(
                    `Join ${groupName} on Evenly`
                  )}&body=${encodeURIComponent(message)}`;
                }}
              >
                <Mail className="size-4" aria-hidden />
                Share via email
              </Button>
              {typeof navigator !== "undefined" && "share" in navigator && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    navigator.share({ title: `Join ${groupName} on Evenly`, text: message, url: link })
                  }
                >
                  <Share2 className="size-4" aria-hidden />
                  More options
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
