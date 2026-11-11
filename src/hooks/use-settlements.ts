import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface SettlementDTO {
  id: string;
  from: { id: string; name: string };
  to: { id: string; name: string };
  amount: string;
  note: string | null;
  settledAt: string;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Something went wrong");
  return body.data as T;
}

export function useSettlements(groupId: string) {
  return useQuery({
    queryKey: ["groups", groupId, "settlements"],
    queryFn: () => fetchJson<SettlementDTO[]>(`/api/groups/${groupId}/settlements`),
    enabled: Boolean(groupId),
  });
}

export function useRecordSettlement(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { fromMemberId: string; toMemberId: string; amount: string; note?: string }) =>
      fetchJson<SettlementDTO>(`/api/groups/${groupId}/settlements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups", groupId] });
    },
  });
}

// ---------- PayPal Sandbox demo ----------

export interface PayPalPaymentDTO {
  paymentId: string;
  orderId: string | null;
  status:
    | "INITIATED"
    | "ORDER_CREATED"
    | "CAPTURE_PENDING"
    | "CAPTURED"
    | "COMPLETED"
    | "FAILED"
    | "CANCELLED"
    | "NEEDS_REVIEW";
  originalAmount: string;
  originalCurrency: string;
  chargeAmount: string;
  chargeCurrency: string;
  exchangeRate: string;
  converted: boolean;
}

export interface PayPalCaptureDTO {
  status: "COMPLETED" | "CAPTURE_PENDING";
  payment: PayPalPaymentDTO;
  settlementId: string | null;
  message: string;
}

export function createPayPalOrder(groupId: string, toMemberId: string) {
  return fetchJson<PayPalPaymentDTO>(`/api/groups/${groupId}/paypal/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ toMemberId }),
  });
}

export function capturePayPalOrder(groupId: string, orderId: string) {
  return fetchJson<PayPalCaptureDTO>(`/api/groups/${groupId}/paypal/capture`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId }),
  });
}
