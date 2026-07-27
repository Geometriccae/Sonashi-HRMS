/**
 * Fixed FX for Salary Slips display: 1 AED = 26.20 INR
 * Stored payroll values remain in INR; UI/PDF show AED via this conversion.
 */
export const INR_PER_AED = 26.2;

/** Convert INR amount → AED (same numeric space; no change to payroll formulas). */
export function inrToAed(amountInr) {
  const n = Number(amountInr);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n / INR_PER_AED) * 100) / 100;
}

/** Convert AED amount → INR (for saving form values back to existing INR storage). */
export function aedToInr(amountAed) {
  const n = Number(amountAed);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * INR_PER_AED * 100) / 100;
}

/** Format an INR amount as AED for display. */
export function formatAedFromInr(amountInr) {
  return `AED ${inrToAed(amountInr).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Format a number already in AED. */
export function formatAed(amountAed) {
  const n = Number(amountAed);
  const value = Number.isFinite(n) ? n : 0;
  return `AED ${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
