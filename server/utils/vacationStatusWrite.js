/**
 * Shared rules for writing an employee's vacation status.
 *
 * Both write paths (POST /employees/:id/vacation-status and PUT /employees/:id)
 * use these helpers so the manual-override and return-date rules cannot drift
 * apart. The date-driven resolver in vacationStatusFromDates.js stays the source
 * of truth for reads; these helpers only decide what a write persists.
 */

const ALLOWED_VACATION_STATUSES = [
  'Onsite',
  'On Vacation',
  'Vacation Approved',
  'Vacation Pending',
  'Onboarding',
];

/** Categories the date-driven resolver would otherwise re-derive on the next read. */
const DATE_DRIVEN_STATUSES = ['On Vacation', 'Vacation Pending', 'Vacation Approved'];

const LEGACY_STATUS_ALIASES = {
  'Not on Vacation': 'Onsite',
};

function normalizeVacationStatusValue(value) {
  const status = String(value ?? '').trim();
  if (!status) return '';
  return LEGACY_STATUS_ALIASES[status] || status;
}

function isAllowedVacationStatus(value) {
  return ALLOWED_VACATION_STATUSES.includes(normalizeVacationStatusValue(value));
}

function startOfDay(value) {
  const dt = value ? new Date(value) : new Date();
  if (Number.isNaN(dt.getTime())) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

/**
 * True when a submitted status is a real user decision rather than a form
 * resubmitting the status it was loaded with. A master-data save that echoes the
 * live status must not pin the employee to 'manual', otherwise unrelated edits
 * would freeze legitimate future/active/returned date calculations.
 */
function isManualStatusChange(requestedStatus, derivedStatus) {
  const requested = normalizeVacationStatusValue(requestedStatus);
  if (!requested) return false;
  const derived = normalizeVacationStatusValue(derivedStatus);
  if (!derived) return true;
  return requested !== derived;
}

/**
 * returnDate coercion that keeps a manual choice from snapping back on the next
 * read. `hasReturnDate` says whether the caller supplied returnDate explicitly.
 */
function vacationReturnDatePatch({
  status,
  derivedStatus,
  hasReturnDate = false,
  returnDate = undefined,
  today = new Date(),
} = {}) {
  const next = normalizeVacationStatusValue(status);
  const patch = {};

  if (next === 'Onsite' && !hasReturnDate) {
    // Onsite must persist even when leave dates still say the employee is away.
    if (DATE_DRIVEN_STATUSES.includes(normalizeVacationStatusValue(derivedStatus))) {
      patch.returnDate = startOfDay(today);
    }
    return patch;
  }

  // Yet to Go / On Vacation override the current trip, so a stale return date
  // must not pull them back to Returned Back.
  if ((next === 'Vacation Pending' || next === 'On Vacation') && !hasReturnDate) {
    patch.returnDate = null;
    return patch;
  }

  if (next === 'Vacation Approved' && !returnDate) {
    patch.returnDate = startOfDay(today);
  }

  return patch;
}

module.exports = {
  ALLOWED_VACATION_STATUSES,
  DATE_DRIVEN_STATUSES,
  normalizeVacationStatusValue,
  isAllowedVacationStatus,
  isManualStatusChange,
  vacationReturnDatePatch,
};
