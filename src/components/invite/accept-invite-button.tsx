"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function AcceptInviteButton({ token }: { token: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleAccept() {
    setLoading(true);
    try {
      const res = await fetch(`/api/invites/${token}/accept`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to join group");
      toast.success("You're in!");
      router.push(`/groups/${body.data.groupId}`);
      router.refresh();
    } catch (err) {
      setLoading(false);
      toast.error(err instanceof Error ? err.message : "Failed to join group");
    }
  }

  return (
    <Button onClick={handleAccept} disabled={loading} className="w-full">
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      Join group
    </Button>
  );
}
