import Decimal from "decimal.js";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export type MoneyInput = Decimal.Value;

/** Parse any money-ish input (string, number, Decimal, Prisma.Decimal) into a Decimal rounded to 2dp. */
export function toMoney(value: MoneyInput): Decimal {
  return new Decimal(value.toString()).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** Convert to integer minor units (paise) for exact split arithmetic. */
export function toMinorUnits(value: MoneyInput): number {
  return new Decimal(value.toString())
    .mul(100)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();
}

export function fromMinorUnits(minorUnits: number): Decimal {
  return new Decimal(minorUnits).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function addMoney(...values: MoneyInput[]): Decimal {
  return values.reduce((sum: Decimal, v) => sum.plus(v.toString()), new Decimal(0)).toDecimalPlaces(2);
}

export function subtractMoney(a: MoneyInput, b: MoneyInput): Decimal {
  return toMoney(a).minus(toMoney(b)).toDecimalPlaces(2);
}

export function isPositive(value: MoneyInput): boolean {
  return new Decimal(value.toString()).greaterThan(0);
}

export function moneyEquals(a: MoneyInput, b: MoneyInput): boolean {
  return toMoney(a).equals(toMoney(b));
}

export function formatMoney(value: MoneyInput, currency = "INR"): string {
  const amount = toMoney(value).toNumber();
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Split `total` into `count` equal parts that sum exactly back to `total`.
 * Extra minor units (paise) from rounding are distributed one at a time to
 * the first N recipients, so results are deterministic and reproducible.
 */
export function splitEqual(total: MoneyInput, count: number): Decimal[] {
  if (count <= 0) throw new Error("splitEqual: count must be positive");
  const totalMinor = toMinorUnits(total);
  const base = Math.floor(totalMinor / count);
  const remainder = totalMinor - base * count;
  return Array.from({ length: count }, (_, i) =>
    fromMinorUnits(base + (i < remainder ? 1 : 0))
  );
}

/**
 * Split `total` by percentages (0-100, must sum to 100). Rounding remainder
 * (in paise) is distributed to the largest shares first, deterministically.
 */
export function splitByPercentage(total: MoneyInput, percentages: number[]): Decimal[] {
  const sum = percentages.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 100) > 0.001) {
    throw new Error(`splitByPercentage: percentages must sum to 100, got ${sum}`);
  }
  return distributeByWeight(
    total,
    percentages.map((p) => p)
  );
}

/** Split `total` by integer/decimal shares (e.g. 2 shares vs 1 share). */
export function splitByShares(total: MoneyInput, shares: number[]): Decimal[] {
  if (shares.some((s) => s <= 0)) {
    throw new Error("splitByShares: all shares must be positive");
  }
  return distributeByWeight(total, shares);
}

function distributeByWeight(total: MoneyInput, weights: number[]): Decimal[] {
  const totalMinor = toMinorUnits(total);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum <= 0) throw new Error("distributeByWeight: weights must sum to > 0");

  const raw = weights.map((w) => (totalMinor * w) / weightSum);
  const base = raw.map(Math.floor);
  let remainder = totalMinor - base.reduce((a, b) => a + b, 0);

  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);

  const result = [...base];
  for (const { i } of order) {
    if (remainder <= 0) break;
    result[i] += 1;
    remainder -= 1;
  }

  return result.map(fromMinorUnits);
}

/** Validates that a set of exact amounts sums to `total` (used for "exact" splits). */
export function validateExactSplit(total: MoneyInput, amounts: MoneyInput[]): boolean {
  return moneyEquals(total, addMoney(...amounts));
}

export { Decimal };
