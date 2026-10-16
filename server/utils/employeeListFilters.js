const {
  EMPLOYEE_STATUS_VALUES,
  workingStatusFilter,
  nonWorkingStatusFilter,
} = require('./employeeStatus');

const text = (value) => String(value || '').trim();
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Build the Mongo filter used by the paginated Team Members table. */
function buildEmployeeListFilter(query = {}, { companyFallbackIds = [] } = {}) {
  const search = text(query.search);
  const categoryStatus = text(query.status);
  const employeeName = text(query.employeeName);
  const employeeStatus = text(query.employeeStatus);
  const companyCode = text(query.companyCode);
  const dojFrom = text(query.dojFrom);
  const dojTo = text(query.dojTo);
  const hasFilters = Boolean(
    search || categoryStatus || employeeName || employeeStatus || companyCode || dojFrom || dojTo
  );
  const clauses = [];

  if (categoryStatus === 'Active') clauses.push(workingStatusFilter());
  else if (categoryStatus === 'InActive') clauses.push(nonWorkingStatusFilter());
  else if (categoryStatus && EMPLOYEE_STATUS_VALUES.includes(categoryStatus)) {
    clauses.push({ employeeStatus: categoryStatus });
  }

  if (employeeStatus) {
    if (!EMPLOYEE_STATUS_VALUES.includes(employeeStatus)) {
      return { error: 'Invalid employee status filter', hasFilters };
    }
    clauses.push({ employeeStatus });
  }

  if (employeeName) {
    clauses.push({ employeeName: new RegExp(escapeRegex(employeeName), 'i') });
  }
  if (companyCode) {
    const fallbackIds = (companyFallbackIds || []).filter(Boolean);
    clauses.push(fallbackIds.length
      ? { $or: [{ companyCode }, { _id: { $in: fallbackIds } }] }
      : { companyCode });
  }

  const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
  if ((dojFrom && !dateOnly.test(dojFrom)) || (dojTo && !dateOnly.test(dojTo))) {
    return { error: 'Joining date filters must use YYYY-MM-DD', hasFilters };
  }
  if (dojFrom && dojTo && dojFrom > dojTo) {
    return { error: 'Joining From Date cannot be after To Date', hasFilters };
  }
  if (dojFrom || dojTo) {
    const doj = {};
    if (dojFrom) doj.$gte = new Date(`${dojFrom}T00:00:00.000Z`);
    if (dojTo) doj.$lte = new Date(`${dojTo}T23:59:59.999Z`);
    clauses.push({ doj });
  }

  if (search) {
    const regex = new RegExp(search, 'i');
    clauses.push({
      $or: [
        { employeeName: regex },
        { employeeId: regex },
        { emailId: regex },
        { role: regex },
        { department: regex },
        { mobile: regex },
      ],
    });
  }

  return {
    filter: clauses.length > 1 ? { $and: clauses } : (clauses[0] || {}),
    hasFilters,
  };
}

module.exports = { buildEmployeeListFilter, escapeRegex };
