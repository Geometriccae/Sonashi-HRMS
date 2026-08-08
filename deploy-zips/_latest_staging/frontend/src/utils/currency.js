/**
 * Default currency: AED (United Arab Emirates Dirham).
 * Display/label only — no FX conversion; amounts are shown as stored.
 */
export const DEFAULT_CURRENCY = 'AED';
export const CURRENCY_CODE = 'AED';
export const CURRENCY_PREFIX = 'AED ';

/** Format a monetary amount with AED label (no conversion). */
export function formatAed(amount) {
  const n = Number(amount);
  const value = Number.isFinite(n) ? n : 0;
  return `${CURRENCY_PREFIX}${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** @deprecated Use formatAed — kept so older imports keep working without conversion. */
export function formatAedFromInr(amount) {
  return formatAed(amount);
}

/** Identity helpers (no conversion) for any leftover call sites. */
export function inrToAed(amount) {
  const n = Number(amount);
  return Number.isFinite(n) ? n : 0;
}

export function aedToInr(amount) {
  const n = Number(amount);
  return Number.isFinite(n) ? n : 0;
}
