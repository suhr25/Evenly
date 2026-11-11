import { Decimal, toMoney } from "@/lib/money";
import { ApiError } from "@/lib/api-response";

/**
 * PayPal Sandbox demo configuration. Server-only: reads secrets from the environment.
 *
 * Sandbox only, by construction: PAYPAL_BASE_URL must be the sandbox host, so a live
 * endpoint can never be configured by mistake.
 *
 * Currencies: PayPal does not list INR as a supported currency for REST API payments (see
 * https://developer.paypal.com/docs/reports/reference/paypal-supported-currencies/), and
 * Evenly defaults to INR. So the sandbox charge is made in PAYPAL_CHARGE_CURRENCY, converted
 * with an explicit, operator-configured demo rate. There is no built-in rate and no
 * live-rate lookup: without PAYPAL_DEMO_EXCHANGE_RATE, a group whose currency differs from
 * the charge currency simply cannot use PayPal.
 */

export const SANDBOX_BASE_URL = "https://api-m.sandbox.paypal.com";

/** Two-decimal currencies from PayPal's supported list (zero-decimal HUF/JPY/TWD excluded). */
export const SUPPORTED_CHARGE_CURRENCIES = [
  "AUD", "BRL", "CAD", "CHF", "CNY", "CZK", "DKK", "EUR", "GBP", "HKD",
  "ILS", "MXN", "MYR", "NOK", "NZD", "PHP", "PLN", "SEK", "SGD", "THB", "USD",
] as const;

export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  merchantId: string;
  chargeCurrency: string;
  /** Original-currency units per 1 charge-currency unit; null if not configured. */
  exchangeRate: Decimal | null;
}

export function getPayPalConfig(env: NodeJS.ProcessEnv = process.env): PayPalConfig {
  const clientId = (env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? "").trim();
  const clientSecret = (env.PAYPAL_CLIENT_SECRET ?? "").trim();
  const merchantId = (env.PAYPAL_MERCHANT_ID ?? "").trim();
  const baseUrl = (env.PAYPAL_BASE_URL ?? SANDBOX_BASE_URL).trim().replace(/\/+$/, "");
  const chargeCurrency = (env.PAYPAL_CHARGE_CURRENCY ?? "USD").trim().toUpperCase();
  const rateRaw = (env.PAYPAL_DEMO_EXCHANGE_RATE ?? "").trim();

  if (!clientId || !clientSecret || !merchantId) {
    throw new ApiError(503, "PayPal Sandbox is not configured on this server.");
  }
  if (baseUrl !== SANDBOX_BASE_URL) {
    // Names the problem without echoing config values.
    throw new ApiError(503, "PayPal is misconfigured: PAYPAL_BASE_URL must be the Sandbox API host.");
  }
  if (!(SUPPORTED_CHARGE_CURRENCIES as readonly string[]).includes(chargeCurrency)) {
    throw new ApiError(
      503,
      "PayPal is misconfigured: PAYPAL_CHARGE_CURRENCY is not a supported two-decimal currency."
    );
  }

  let exchangeRate: Decimal | null = null;
  if (rateRaw) {
    if (!/^\d+(\.\d{1,8})?$/.test(rateRaw) || new Decimal(rateRaw).lte(0)) {
      throw new ApiError(503, "PayPal is misconfigured: PAYPAL_DEMO_EXCHANGE_RATE must be a positive decimal.");
    }
    exchangeRate = new Decimal(rateRaw);
  }

  return { clientId, clientSecret, baseUrl, merchantId, chargeCurrency, exchangeRate };
}

export interface ChargeQuote {
  originalAmount: string;
  originalCurrency: string;
  chargeAmount: string;
  chargeCurrency: string;
  /** Original-currency units per 1 charge-currency unit ("1" when no conversion). */
  exchangeRate: string;
  converted: boolean;
}

/**
 * Computes the sandbox charge for an amount in the group's currency. Decimal math only;
 * rounds half-up to 2dp. Never relabels a currency: if the currencies differ, the
 * configured rate is mandatory.
 */
export function quoteCharge(
  originalAmount: string,
  originalCurrency: string,
  config: Pick<PayPalConfig, "chargeCurrency" | "exchangeRate">
): ChargeQuote {
  const original = toMoney(originalAmount);
  const currency = originalCurrency.toUpperCase();

  if (currency === config.chargeCurrency) {
    return {
      originalAmount: original.toFixed(2),
      originalCurrency: currency,
      chargeAmount: original.toFixed(2),
      chargeCurrency: config.chargeCurrency,
      exchangeRate: "1",
      converted: false,
    };
  }

  if (!config.exchangeRate) {
    throw new ApiError(
      503,
      `PayPal Sandbox cannot charge in ${currency}. Set PAYPAL_DEMO_EXCHANGE_RATE to enable a demo conversion to ${config.chargeCurrency}.`
    );
  }

  const charge = original.div(config.exchangeRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  if (charge.lt("0.01")) {
    throw new ApiError(400, "This amount is too small to charge through PayPal after conversion.");
  }

  return {
    originalAmount: original.toFixed(2),
    originalCurrency: currency,
    chargeAmount: charge.toFixed(2),
    chargeCurrency: config.chargeCurrency,
    exchangeRate: config.exchangeRate.toString(),
    converted: true,
  };
}
