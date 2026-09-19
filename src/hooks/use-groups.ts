import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface GroupSummary {
  id: string;
  name: string;
  icon: string;
  memberCount: number;
  yourBalance: string;
}

export interface GroupMemberDTO {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  upiId: string | null;
  userId: string | null;
  isActive: boolean;
  isYou: boolean;
  netBalance: string;
}

export interface SuggestedSettlement {
  fromMemberId: string;
  fromName: string;
  fromPhone: string | null;
  toMemberId: string;
  toName: string;
  toUpiId: string | null;
  amount: string;
}

export interface GroupDetail {
  id: string;
  name: string;
  icon: string;
  createdBy: string;
  isCreator: boolean;
  members: GroupMemberDTO[];
  suggestedSettlements: SuggestedSettlement[];
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Something went wrong");
  return body.data as T;
}

export function useGroups() {
  return useQuery({
    queryKey: ["groups"],
    queryFn: () => fetchJson<GroupSummary[]>("/api/groups"),
  });
}

export function useGroupDetail(groupId: string) {
  return useQuery({
    queryKey: ["groups", groupId],
    queryFn: () => fetchJson<GroupDetail>(`/api/groups/${groupId}`),
    enabled: Boolean(groupId),
    retry: false,
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; icon: string }) =>
      fetchJson<{ id: string }>("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["groups"] }),
  });
}

export function useUpdateGroup(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; icon: string }) =>
      fetchJson(`/api/groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["groups", groupId] });
    },
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => fetchJson(`/api/groups/${groupId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["groups"] }),
  });
}

export function useAddMember(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; email?: string; phone?: string }) =>
      fetchJson(`/api/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups", groupId] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

export function useGenerateInvite(groupId: string) {
  return useMutation({
    mutationFn: (memberId: string) =>
      fetchJson<{ token: string; expiresAt: string }>(
        `/api/groups/${groupId}/members/${memberId}/invite`,
        { method: "POST" }
      ),
  });
}

export function useRemoveMember(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) =>
      fetchJson(`/api/groups/${groupId}/members/${memberId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups", groupId] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}
