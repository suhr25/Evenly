import { useMutation, useQueryClient } from "@tanstack/react-query";

export interface ReceiptItemDTO {
  name: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
}

export interface ReceiptDTO {
  id: string;
  imageUrl: string;
  merchant: string | null;
  date: string | null;
  items: ReceiptItemDTO[];
  subtotal: string | null;
  tax: string | null;
  discount: string | null;
  tip: string | null;
  total: string | null;
  confidence: string | null;
  extractionFailed: boolean;
}

export interface ConfirmReceiptInput {
  groupId: string;
  categoryId: string;
  paidByMemberId: string;
  description: string;
  date: string;
  merchant?: string | null;
  items: ReceiptItemDTO[];
  subtotal?: string | null;
  tax?: string | null;
  discount?: string | null;
  tip?: string | null;
  total: string;
  itemAssignments: { itemIndex: number; memberIds: string[] }[];
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Something went wrong");
  return body.data as T;
}

export function useUploadReceipt() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return fetchJson<ReceiptDTO>("/api/receipts", { method: "POST", body: formData });
    },
  });
}

export function useConfirmReceipt(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ receiptId, input }: { receiptId: string; input: ConfirmReceiptInput }) =>
      fetchJson(`/api/receipts/${receiptId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups", groupId] });
    },
  });
}

export function useDiscardReceipt() {
  return useMutation({
    mutationFn: (receiptId: string) => fetchJson(`/api/receipts/${receiptId}`, { method: "DELETE" }),
  });
}
