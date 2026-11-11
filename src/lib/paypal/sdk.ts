"use client";

/** Loads PayPal's JS SDK once per currency. Only the public client ID is used here. */

interface PayPalButtonsOptions {
  style?: Record<string, unknown>;
  createOrder: () => Promise<string>;
  onApprove: (data: { orderID: string }) => Promise<void>;
  onCancel?: () => void;
  onError?: (err: unknown) => void;
}

export interface PayPalNamespace {
  Buttons: (options: PayPalButtonsOptions) => { render: (el: HTMLElement) => Promise<void>; close: () => Promise<void> };
}

declare global {
  interface Window {
    paypal?: PayPalNamespace;
  }
}

let loading: { key: string; promise: Promise<PayPalNamespace> } | null = null;

export function loadPayPalSdk(clientId: string, currency: string): Promise<PayPalNamespace> {
  const key = `${clientId}:${currency}`;
  if (loading?.key === key) return loading.promise;

  document.querySelectorAll("script[data-evenly-paypal]").forEach((s) => s.remove());
  delete window.paypal;

  const promise = new Promise<PayPalNamespace>((resolve, reject) => {
    const script = document.createElement("script");
    script.src =
      `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}` +
      `&currency=${encodeURIComponent(currency)}&intent=capture&components=buttons`;
    script.dataset.evenlyPaypal = "true";
    script.async = true;
    script.onload = () => (window.paypal ? resolve(window.paypal) : reject(new Error("PayPal SDK failed to initialise.")));
    script.onerror = () => {
      loading = null;
      reject(new Error("Could not load the PayPal SDK."));
    };
    document.head.appendChild(script);
  });
  loading = { key, promise };
  return promise;
}
