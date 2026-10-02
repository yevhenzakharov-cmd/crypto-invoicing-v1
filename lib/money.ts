import { formatUnits, parseUnits } from "viem";

/**
 * All invoice math is done in fixed-point bigint with 18 decimals, never in
 * floating point, so the amount a payer sends is exactly what the invoice says.
 */
export const SCALE = 18;
const ONE = 10n ** BigInt(SCALE);

export type Fixed = bigint;

/** Parses user input like "1,000.50" into fixed-point. Invalid input → null. */
export function parseAmount(input: string): Fixed | null {
  const clean = input.replace(/[,\s_]/g, "");
  if (clean === "" || clean === ".") return 0n;
  if (!/^\d*\.?\d*$/.test(clean)) return null;
  const [whole, frac = ""] = clean.split(".");
  // Extra precision beyond 18 decimals is truncated, not rejected.
  try {
    return parseUnits(`${whole || "0"}.${frac.slice(0, SCALE) || "0"}`, SCALE);
  } catch {
    return null;
  }
}

/** Like parseAmount but treats invalid input as zero (for live totals). */
export function amountOrZero(input: string): Fixed {
  return parseAmount(input) ?? 0n;
}

export function mul(a: Fixed, b: Fixed): Fixed {
  return (a * b) / ONE;
}

/** a × p%  */
export function percentOf(a: Fixed, percent: Fixed): Fixed {
  return (a * percent) / (100n * ONE);
}

/** Converts 18-decimal fixed-point into a token's base units, rounding half up. */
export function toTokenUnits(x: Fixed, decimals: number): bigint {
  if (decimals === SCALE) return x;
  if (decimals > SCALE) return x * 10n ** BigInt(decimals - SCALE);
  const div = 10n ** BigInt(SCALE - decimals);
  return (x + div / 2n) / div;
}

/**
 * Human formatting: thousands separators, at least `minDp` decimals,
 * trailing zeros trimmed beyond that, at most `maxDp`.
 */
export function formatFixed(x: Fixed, { minDp = 2, maxDp = 6 }: { minDp?: number; maxDp?: number } = {}): string {
  const negative = x < 0n;
  const abs = negative ? -x : x;
  // round to maxDp
  const div = 10n ** BigInt(SCALE - maxDp);
  const rounded = ((abs + div / 2n) / div) * div;
  const [whole, frac = ""] = formatUnits(rounded, SCALE).split(".");
  let f = frac.padEnd(maxDp, "0").slice(0, maxDp);
  while (f.length > minDp && f.endsWith("0")) f = f.slice(0, -1);
  const w = BigInt(whole).toLocaleString("en-US");
  return `${negative ? "-" : ""}${w}${f ? "." + f : ""}`;
}

export function formatTokenUnits(units: bigint, decimals: number, minDp = 2): string {
  return formatFixed(parseUnits(formatUnits(units, decimals), SCALE), { minDp, maxDp: Math.min(decimals, 8) });
}
