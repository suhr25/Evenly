import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface GmailStatus {
  connected: boolean;
  emailAddress: string | null;
  lastSyncedAt: string | null;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Something went wrong");
  return body.data as T;
}

export function useGmailStatus() {
  return useQuery({
    queryKey: ["gmail-status"],
    queryFn: () => fetchJson<GmailStatus>("/api/integrations/gmail"),
  });
}

export function useSyncGmail() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: () =>
      fetchJson<{ scanned: number; imported: number }>("/api/integrations/gmail/sync", {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gmail-status"] });
      queryClient.invalidateQueries({ queryKey: ["pending-imports"] });
      // Server-rendered surfaces (dashboard prompt, insights) show the
      // pending-import count, so they need re-running too.
      router.refresh();
    },
  });
}

export function useDisconnectGmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => fetchJson<{ ok: true }>("/api/integrations/gmail", { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gmail-status"] }),
  });
}
