import { ApiError } from "@/lib/api-response";
import type { PayPalConfig } from "@/lib/paypal/config";

/**
 * Minimal PayPal Orders v2 client (server-only). The OAuth access token and client secret
 * never leave this process; nothing here logs request bodies, headers or tokens.
 */

export interface PayPalMoney {
  currency_code: string;
  value: string;
}

export interface PayPalCapture {
  id: string;
  status: string; // COMPLETED | PENDING | DECLINED | FAILED | REFUNDED | ...
  amount?: PayPalMoney;
  custom_id?: string;
}

export interface PayPalOrder {
  id: string;
  status: string; // CREATED | APPROVED | COMPLETED | VOIDED | PAYER_ACTION_REQUIRED | ...
  intent?: string;
  purchase_units?: Array<{
    reference_id?: string;
    custom_id?: string;
    amount?: PayPalMoney;
    payee?: { merchant_id?: string };
    payments?: { captures?: PayPalCapture[] };
  }>;
}

/** A PayPal API error carrying the machine-readable issue names (never the raw body). */
export class PayPalApiError extends Error {
  constructor(
    public httpStatus: number,
    public issues: string[],
    public debugId: string | null
  ) {
    super(`PayPal API error ${httpStatus}${issues.length ? ` (${issues.join(", ")})` : ""}`);
    this.name = "PayPalApiError";
  }
}

let cachedToken: { value: string; expiresAt: number; baseUrl: string } | null = null;

export function resetPayPalTokenCache() {
  cachedToken = null;
}

async function getAccessToken(config: PayPalConfig): Promise<string> {
  if (cachedToken && cachedToken.baseUrl === config.baseUrl && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  const res = await fetch(`${config.baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) {
    console.error("[paypal] token request failed", res.status);
    throw new ApiError(502, "Could not authenticate with PayPal. Check the Sandbox credentials.");
  }
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000,
    baseUrl: config.baseUrl,
  };
  return body.access_token;
}

async function paypalFetch<T>(
  config: PayPalConfig,
  path: string,
  init: { method: "GET" | "POST"; body?: unknown; requestId?: string }
): Promise<T> {
  const token = await getAccessToken(config);
  const res = await fetch(`${config.baseUrl}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.requestId ? { "PayPal-Request-Id": init.requestId } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const details = (json as { details?: Array<{ issue?: string }> } | null)?.details ?? [];
    const issues = details.map((d) => d.issue).filter((i): i is string => Boolean(i));
    const name = (json as { name?: string } | null)?.name;
    if (name && issues.length === 0) issues.push(name);
    const debugId = (json as { debug_id?: string } | null)?.debug_id ?? res.headers.get("paypal-debug-id");
    if (res.status === 401) cachedToken = null;
    console.error("[paypal] request failed", { path, status: res.status, issues, debugId });
    throw new PayPalApiError(res.status, issues, debugId);
  }
  return json as T;
}

export function createOrder(
  config: PayPalConfig,
  input: { paymentId: string; amount: string; currency: string; description: string; requestId: string }
): Promise<PayPalOrder> {
  return paypalFetch<PayPalOrder>(config, "/v2/checkout/orders", {
    method: "POST",
    requestId: input.requestId,
    body: {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: input.paymentId,
          custom_id: input.paymentId,
          description: input.description.slice(0, 127),
          amount: { currency_code: input.currency, value: input.amount },
          payee: { merchant_id: config.merchantId },
        },
      ],
    },
  });
}

export function getOrder(config: PayPalConfig, orderId: string): Promise<PayPalOrder> {
  return paypalFetch<PayPalOrder>(config, `/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
    method: "GET",
  });
}

export function captureOrder(config: PayPalConfig, orderId: string, requestId: string): Promise<PayPalOrder> {
  return paypalFetch<PayPalOrder>(config, `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    requestId,
    body: {},
  });
}
