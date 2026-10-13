/**
 * Display formatting for prices, money and timestamps.
 *
 * Kept pure and free of Effect/Plot so the menu tables can be asserted on
 * without a terminal, and so every menu renders the same value the same way.
 */

/**
 * Format a USD price, keeping enough precision for tokens that trade in
 * fractions of a cent.
 *
 * A token at `0.0000022` rounded to two decimals is `0.00`, which hides both
 * the price and every move in it, so small values keep significant digits
 * instead of decimal places.
 */
export const formatUsd = (value: number): string => {
  if (!Number.isFinite(value)) return "n/a";
  const abs = Math.abs(value);
  if (abs >= 1000) {
    return `$${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  if (abs >= 1) return `$${value.toFixed(2)}`;
  if (abs === 0) return "$0";
  return `$${Number(value.toPrecision(6))}`;
};

const COMPACT_UNITS = [
  [1e12, "T"],
  [1e9, "B"],
  [1e6, "M"],
  [1e3, "K"],
] as const;

/** Format a USD amount compactly: `$103.84K`, `$1.12T`. */
export const formatCompactUsd = (value: number | undefined): string => {
  if (value === undefined || !Number.isFinite(value)) return "n/a";
  const abs = Math.abs(value);
  for (const [scale, suffix] of COMPACT_UNITS) {
    if (abs >= scale) return `$${(value / scale).toFixed(2)}${suffix}`;
  }
  return `$${value.toFixed(2)}`;
};

/** Format a percentage change with its sign: `+14.72%`, `-3.10%`. */
export const formatSignedPct = (
  value: number | undefined,
  decimals = 2,
): string =>
  value === undefined || !Number.isFinite(value)
    ? "n/a"
    : `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`;

/** Format an ISO-8601 instant as `YYYY-MM-DD HH:MM UTC`. */
export const toUtcLabel = (iso?: string): string => {
  if (!iso) return "n/a";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return `${parsed.toISOString().slice(0, 16).replace("T", " ")} UTC`;
};
