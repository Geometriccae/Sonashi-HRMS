/**
 * Fast dashboard / annual-vacation aggregates and paginated tab rows.
 * Returned Back rule matches frontend yetToGoHelpers:
 * working + vacationStatus === "Vacation Approved" + return date within last 1 month.
 */

const Employee = require('../models/Employee');
const LeaveRequest = require('../models/LeaveRequest');
const {
  WORKING_EMPLOYEE_STATUSES,
  NON_WORKING_EMPLOYEE_STATUSES,
  workingStatusFilter,
  nonWorkingStatusFilter,
  isWorkingEmployeeStatus,
} = require('./employeeStatus');
const {
  getListCache,
  setListCache,
  getApprovedLeavesCache,
  setApprovedLeavesCache,
} = require('./employeeListCache');

const APPROVED_LEAVE_STATUSES = ['Approved', 'HOD Approved'];
const APPROVED_LEAVE_SELECT =
  'employee employeeId employeeName leaveType startDate endDate status travellingDate lastWorkingDay returnDate firstWorkingDay department';

const EMP_LEAN_FIELDS = [
  'employeeId', 'employeeName', 'employeeStatus', 'vacationStatus', 'emailId',
  'role', 'department', 'doj', 'totalYearsExperience',
  'passportExpiryDate', 'visaExpiryDate',
  'travellingDate', 'returnDate', 'firstWorkingDay', 'lastWorkingDay', 'leaveEndDate',
  'nationality', 'office', 'companyCode', 'createdAt',
].join(' ');

const SUMMARY_TTL_MS = 15000;
let _summaryCache = { data: null, ts: 0 };

function invalidateVacationDashboardStats() {
  _summaryCache = { data: null, ts: 0 };
}

function toDayStart(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) {
      const [, year, month, day] = match;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }
  }
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

function normalizeName(name) {
  return String(name || '').toLowerCase().replace(/[\s_.-]+/g, '').trim();
}

function lastMonthWindow(now = new Date()) {
  const today = toDayStart(now);
  const from = new Date(today);
  from.setMonth(from.getMonth() - 1);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);
  return { today, from, todayEnd };
}

function getVacationReturnDate(emp, leave) {
  return toDayStart(
    emp?.returnDate || emp?.firstWorkingDay || leave?.endDate || emp?.leaveEndDate
  );
}

function isDateWithinLastMonth(value, now = new Date()) {
  const day = toDayStart(value);
  if (!day) return false;
  const { today, from } = lastMonthWindow(now);
  return day >= from && day <= today;
}

function isReturnedBackInLastMonth(emp, leave, now = new Date()) {
  if (!isWorkingEmployeeStatus(emp?.employeeStatus)) return false;
  if ((emp?.vacationStatus || 'Onsite') !== 'Vacation Approved') return false;
  return isDateWithinLastMonth(getVacationReturnDate(emp, leave), now);
}

async function loadApprovedLeaves() {
  const cached = getApprovedLeavesCache();
  if (cached) return cached;
  const rows = await LeaveRequest.find({
    status: { $in: APPROVED_LEAVE_STATUSES },
  })
    .select(APPROVED_LEAVE_SELECT)
    .lean();
  setApprovedLeavesCache(rows);
  return rows;
}

async function loadEmployeesLean() {
  const cached = getListCache();
  if (cached) return cached;
  const rows = await Employee.find({})
    .select(EMP_LEAN_FIELDS)
    .sort({ createdAt: -1 })
    .lean();
  setListCache(rows);
  return rows;
}

function findLinkedEmployee(req, empList) {
  if (!Array.isArray(empList) || empList.length === 0) return null;
  const populated = req.employee;
  if (populated?.employeeId) {
    const byRef = empList.find((e) => String(e._id) === String(populated.employeeId));
    if (byRef) return byRef;
  }
  if (req.employeeId) {
    const byCode = empList.find((e) => String(e.employeeId) === String(req.employeeId));
    if (byCode) return byCode;
  }
  const reqName = normalizeName(req.employeeName || populated?.username);
  if (!reqName) return null;
  const exact = empList.find((e) => normalizeName(e.employeeName) === reqName);
  if (exact) return exact;
  return (
    empList.find((e) => {
      const n = normalizeName(e.employeeName);
      return n && (n.includes(reqName) || reqName.includes(n));
    }) || null
  );
}

function getLeaveTravelDate(req, linkedEmployee) {
  return toDayStart(linkedEmployee?.travellingDate || req.travellingDate || req.startDate);
}

function getEffectiveVacationStatus(req, linkedEmployee, todayValue = new Date()) {
  if (!APPROVED_LEAVE_STATUSES.includes(req?.status)) return null;
  const today = toDayStart(todayValue);
  const travelDate = getLeaveTravelDate(req, linkedEmployee);
  const leaveEndDate = toDayStart(req?.endDate);
  if (!today || !travelDate || !leaveEndDate) return null;
  if (today < travelDate) return 'Vacation Pending';
  if (today >= travelDate && today < leaveEndDate) return 'On Vacation';
  if (today >= leaveEndDate) return 'Vacation Approved';
  return null;
}

function leaveMatchesEmployee(req, emp, empList) {
  const linked = findLinkedEmployee(req, empList);
  if (linked && String(linked._id) === String(emp._id)) return true;
  const userEmpId = req.employee?.employeeId;
  if (userEmpId && String(userEmpId) === String(emp._id)) return true;
  const reqEmail = String(req.employee?.emailId || '').trim().toLowerCase();
  const empEmail = String(emp.emailId || '').trim().toLowerCase();
  if (reqEmail && empEmail && reqEmail === empEmail) return true;
  const reqName = normalizeName(req.employeeName || req.employee?.username);
  const empName = normalizeName(emp.employeeName);
  return Boolean(reqName && empName && reqName === empName);
}

function findLeaveForEmployee(emp, leaveList, empList, tabKey) {
  const candidates = leaveList.filter(
    (req) => APPROVED_LEAVE_STATUSES.includes(req.status) && leaveMatchesEmployee(req, emp, empList)
  );
  if (candidates.length === 0) return null;
  const vacationLeaves = candidates.filter((req) => req.leaveType === 'Vacation');
  const pool =
    tabKey === 'yetToGo'
      ? candidates
      : vacationLeaves.length > 0
        ? vacationLeaves
        : candidates;
  const today = new Date();
  if (tabKey === 'onVacation') {
    return pool.find((req) => getEffectiveVacationStatus(req, emp, today) === 'On Vacation') || null;
  }
  if (tabKey === 'yetToGo') {
    const upcoming = pool
      .filter((req) => getEffectiveVacationStatus(req, emp, today) === 'Vacation Pending')
      .sort((a, b) => getLeaveTravelDate(a, emp) - getLeaveTravelDate(b, emp));
    return upcoming[0] || null;
  }
  if (tabKey === 'returned') {
    const past = pool
      .filter((req) => getEffectiveVacationStatus(req, emp, today) === 'Vacation Approved')
      .sort((a, b) => toDayStart(b.endDate) - toDayStart(a.endDate));
    return past[0] || null;
  }
  return pool.sort(
    (a, b) => new Date(b.appliedOn || b.createdAt || 0) - new Date(a.appliedOn || a.createdAt || 0)
  )[0];
}

function computeExperienceYears(doj, totalYearsExperience) {
  if (doj) {
    const joinDate = new Date(doj);
    if (!Number.isNaN(joinDate.getTime())) {
      const now = new Date();
      if (now < joinDate) return 0;
      return Math.round(((now - joinDate) / (1000 * 60 * 60 * 24 * 365.25)) * 10) / 10;
    }
  }
  if (totalYearsExperience != null && !Number.isNaN(Number(totalYearsExperience))) {
    return Number(totalYearsExperience);
  }
  return null;
}

function buildYetToGoFromLeaves(empList, leaveList) {
  const safeEmpList = Array.isArray(empList) ? empList : [];
  const safeLeaveList = Array.isArray(leaveList) ? leaveList : [];
  const upcoming = safeLeaveList
    .filter((req) => APPROVED_LEAVE_STATUSES.includes(req.status))
    .filter((req) => {
      const linked = findLinkedEmployee(req, safeEmpList);
      return getEffectiveVacationStatus(req, linked) === 'Vacation Pending';
    })
    .sort((a, b) => {
      const aTravel = getLeaveTravelDate(a, findLinkedEmployee(a, safeEmpList));
      const bTravel = getLeaveTravelDate(b, findLinkedEmployee(b, safeEmpList));
      if (!aTravel && !bTravel) return 0;
      if (!aTravel) return 1;
      if (!bTravel) return -1;
      return aTravel - bTravel;
    });

  const seen = new Set();
  const rows = [];

  const dedupeKeyForLeave = (req) => {
    const linked = findLinkedEmployee(req, safeEmpList);
    if (linked?._id) return String(linked._id);
    if (req.employee?._id) return String(req.employee._id);
    if (req.employee) return String(req.employee);
    const name = normalizeName(req.employeeName || req.employee?.username);
    return name || String(req._id);
  };

  upcoming.forEach((req) => {
    const dedupeKey = dedupeKeyForLeave(req);
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    const linked = findLinkedEmployee(req, safeEmpList);
    if (linked) {
      rows.push({
        ...linked,
        _source: 'employee',
        linkedEmployeeId: linked._id,
        linkedLeaveId: req._id,
        startDate: req.startDate,
        endDate: req.endDate,
        leaveStatus: req.status,
        experienceYears: computeExperienceYears(linked.doj, linked.totalYearsExperience),
        vacationStatus: 'Vacation Pending',
      });
    } else {
      rows.push({
        ...req,
        employeeName: req.employeeName || req.employee?.username || 'Unknown',
        employeeId: req.employeeId || '—',
        department: req.department || '',
        vacationStatus: 'Vacation Pending',
        linkedEmployeeId: null,
        linkedLeaveId: req._id,
        _source: 'leave',
        experienceYears: null,
      });
    }
  });

  safeEmpList
    .filter((e) => Boolean(findLeaveForEmployee(e, safeLeaveList, safeEmpList, 'yetToGo')))
    .forEach((e) => {
      const dedupeKey = String(e._id);
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      const leave = findLeaveForEmployee(e, safeLeaveList, safeEmpList, 'yetToGo');
      rows.push({
        ...e,
        _source: 'employee',
        linkedEmployeeId: e._id,
        linkedLeaveId: leave?._id || null,
        startDate: leave?.startDate || null,
        endDate: leave?.endDate || null,
        leaveStatus: leave?.status || null,
        experienceYears: computeExperienceYears(e.doj, e.totalYearsExperience),
        vacationStatus: 'Vacation Pending',
      });
    });

  rows.sort((a, b) => {
    const aStart = toDayStart(a.startDate);
    const bStart = toDayStart(b.startDate);
    if (!aStart && !bStart) return 0;
    if (!aStart) return 1;
    if (!bStart) return -1;
    return aStart - bStart;
  });

  return rows;
}

function filterReturnedBackEmployees(empList, leaveList, now = new Date()) {
  const employees = Array.isArray(empList) ? empList : [];
  const leaves = Array.isArray(leaveList) ? leaveList : [];
  return employees.filter((emp) => {
    const leave = findLeaveForEmployee(emp, leaves, employees, 'returned');
    return isReturnedBackInLastMonth(emp, leave, now);
  });
}

function enrichEmployeeRows(empList, leaveList, tabKey) {
  return empList.map((e) => {
    const leave = findLeaveForEmployee(e, leaveList, empList, tabKey);
    return {
      ...e,
      _source: 'employee',
      linkedEmployeeId: e._id,
      linkedLeaveId: leave?._id || null,
      startDate: leave?.startDate || null,
      endDate: leave?.endDate || e.leaveEndDate || null,
      experienceYears: computeExperienceYears(e.doj, e.totalYearsExperience),
    };
  });
}

async function buildTabRows(tabKey) {
  const [empList, leaveList] = await Promise.all([loadEmployeesLean(), loadApprovedLeaves()]);
  if (tabKey === 'yetToGo') {
    return buildYetToGoFromLeaves(empList, leaveList).filter((row) =>
      isWorkingEmployeeStatus(row.employeeStatus)
    );
  }
  if (tabKey === 'returned') {
    return enrichEmployeeRows(filterReturnedBackEmployees(empList, leaveList), leaveList, 'returned');
  }
  // onVacation — stored vacationStatus (Annual Vacations source of truth)
  const onVac = empList.filter(
    (e) => isWorkingEmployeeStatus(e.employeeStatus) && e.vacationStatus === 'On Vacation'
  );
  return enrichEmployeeRows(onVac, leaveList, 'onVacation');
}

function applyRowFilters(rows, query = {}) {
  const search = String(query.search || '').trim().toLowerCase();
  const department = String(query.department || '').trim();
  const role = String(query.role || '').trim();
  const office = String(query.office || '').trim();
  const country = String(query.country || '').trim();
  const dojFrom = query.dojFrom ? new Date(query.dojFrom) : null;
  const dojTo = query.dojTo ? new Date(query.dojTo) : null;
  const expMin = query.expMin !== '' && query.expMin != null ? Number(query.expMin) : null;
  const expMax = query.expMax !== '' && query.expMax != null ? Number(query.expMax) : null;
  const vacationMonth = String(query.vacationMonth || '').trim();
  const vacationYear = String(query.vacationYear || '').trim();

  return rows.filter((item) => {
    if (search) {
      const haystack = [
        item.employeeName || item.name || '',
        item.employeeId || '',
        item.department || '',
        item.role || '',
        item.office || '',
        item.nationality || '',
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    } else if (!isWorkingEmployeeStatus(item.employeeStatus) && item._source !== 'leave') {
      return false;
    }

    if (department && (item.department || '') !== department) return false;
    if (role && (item.role || '') !== role) return false;
    if (office && (item.office || '') !== office) return false;
    if (country && (item.nationality || '') !== country) return false;

    if (dojFrom || dojTo) {
      const doj = item.doj ? new Date(item.doj) : null;
      if (!doj) return false;
      if (dojFrom && !Number.isNaN(dojFrom.getTime()) && doj < dojFrom) return false;
      if (dojTo && !Number.isNaN(dojTo.getTime()) && doj > dojTo) return false;
    }

    const exp = computeExperienceYears(item.doj, item.totalYearsExperience);
    if (expMin != null && !Number.isNaN(expMin) && (exp == null || exp < expMin)) return false;
    if (expMax != null && !Number.isNaN(expMax) && (exp == null || exp > expMax)) return false;

    if (vacationMonth || vacationYear) {
      // Month values are 0-based strings ("0"=Jan) matching Annual Vacations UI.
      const dates = [item.travellingDate, item.startDate, item.lastWorkingDay].filter(Boolean);
      if (dates.length === 0) return false;
      const monthIdx = vacationMonth !== '' ? Number(vacationMonth) : null;
      const yearNum = vacationYear !== ''
        ? Number(vacationYear)
        : (vacationMonth !== '' ? new Date().getFullYear() : null);
      const hit = dates.some((d) => {
        const dt = toDayStart(d);
        if (!dt) return false;
        if (monthIdx != null && !Number.isNaN(monthIdx) && dt.getMonth() !== monthIdx) return false;
        if (yearNum != null && !Number.isNaN(yearNum) && dt.getFullYear() !== yearNum) return false;
        return true;
      });
      if (!hit) return false;
    }

    return true;
  });
}

/**
 * Lightweight counts for Dashboard + Annual Vacations cards.
 * Returned Back uses the same last-1-month rule as the frontend.
 * Yet to Go uses the same leave+employee builder as Annual Vacations.
 */
async function getDashboardSummary({ force = false } = {}) {
  if (!force && _summaryCache.data && Date.now() - _summaryCache.ts < SUMMARY_TTL_MS) {
    return _summaryCache.data;
  }

  const now = new Date();
  const { today, from, todayEnd } = lastMonthWindow(now);
  const next90 = new Date(today);
  next90.setDate(today.getDate() + 90);
  const next6Months = new Date(today);
  next6Months.setMonth(today.getMonth() + 6);

  const working = workingStatusFilter();

  const [
    totalEmployees,
    activeEmployees,
    inactiveEmployees,
    onVacation,
    returnedBackFast,
    visaExpiry,
    passportExpiry,
    empList,
    leaveList,
  ] = await Promise.all([
    Employee.countDocuments(),
    Employee.countDocuments(working),
    Employee.countDocuments(nonWorkingStatusFilter()),
    Employee.countDocuments({ ...working, vacationStatus: 'On Vacation' }),
    Employee.countDocuments({
      ...working,
      vacationStatus: 'Vacation Approved',
      $or: [
        { returnDate: { $gte: from, $lte: todayEnd } },
        { firstWorkingDay: { $gte: from, $lte: todayEnd } },
        { leaveEndDate: { $gte: from, $lte: todayEnd } },
      ],
    }),
    Employee.countDocuments({
      ...working,
      visaExpiryDate: { $gt: today, $lte: next90 },
    }),
    Employee.countDocuments({
      ...working,
      passportExpiryDate: { $gt: today, $lte: next6Months },
    }),
    loadEmployeesLean(),
    loadApprovedLeaves(),
  ]);

  // Authoritative Returned Back (may enrich return date from linked leave endDate)
  const returnedBack = filterReturnedBackEmployees(empList, leaveList, now).length;
  const yetToGo = buildYetToGoFromLeaves(empList, leaveList).filter((row) =>
    isWorkingEmployeeStatus(row.employeeStatus)
  ).length;

  const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
  const filterOptions = {
    departments: uniq(empList.map((e) => e.department)),
    roles: uniq(empList.map((e) => e.role)),
    offices: uniq(empList.map((e) => e.office)),
    countries: uniq(empList.map((e) => e.nationality)),
  };

  const summary = {
    totalEmployees,
    activeEmployees,
    inactiveEmployees,
    onVacation,
    yetToGo,
    returnedBack,
    /** Alias used by Dashboard card state */
    vacationReturn: returnedBack,
    upcomingVacation: yetToGo,
    visaExpiry,
    passportExpiry,
    totalAssignedProjects: 0,
    filterOptions,
    /** Diagnostic: Mongo-only returned count before leave-end enrichment */
    returnedBackStoredDates: returnedBackFast,
  };

  _summaryCache = { data: summary, ts: Date.now() };
  return summary;
}

async function getVacationTabPage(options = {}) {
  const tab = String(options.tab || '').trim();
  if (!['onVacation', 'yetToGo', 'returned'].includes(tab)) {
    const err = new Error('Invalid tab. Use onVacation, yetToGo, or returned.');
    err.status = 400;
    throw err;
  }

  const page = Math.max(1, parseInt(options.page, 10) || 1);
  const limitRaw = parseInt(options.limit, 10);
  const all = String(options.all || '') === '1' || String(options.all || '').toLowerCase() === 'true';
  const limit = all ? 100000 : Math.min(100, Math.max(1, limitRaw || 20));

  const rows = applyRowFilters(await buildTabRows(tab), options);
  const total = rows.length;
  if (all) {
    return { employees: rows, total, page: 1, limit: total, totalPages: 1, tab };
  }
  const start = (page - 1) * limit;
  return {
    employees: rows.slice(start, start + limit),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    tab,
  };
}

/** Dashboard drill-down categories (not vacation tabs). */
async function getDashboardCategoryPage(options = {}) {
  const category = String(options.category || '').trim();
  const page = Math.max(1, parseInt(options.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(options.limit, 10) || 20));
  const search = String(options.search || '').trim();

  const now = new Date();
  const { today } = lastMonthWindow(now);
  const next90 = new Date(today);
  next90.setDate(today.getDate() + 90);
  const next6Months = new Date(today);
  next6Months.setMonth(today.getMonth() + 6);

  let filter = {};
  if (category === 'total') {
    filter = {};
  } else if (category === 'active') {
    filter = workingStatusFilter();
  } else if (category === 'inactive') {
    filter = nonWorkingStatusFilter();
  } else if (category === 'visaExpiry') {
    filter = {
      ...workingStatusFilter(),
      visaExpiryDate: { $gt: today, $lte: next90 },
    };
  } else if (category === 'passportExpiry') {
    filter = {
      ...workingStatusFilter(),
      passportExpiryDate: { $gt: today, $lte: next6Months },
    };
  } else if (category === 'onVacation' || category === 'yetToGo' || category === 'returned') {
    return getVacationTabPage({ ...options, tab: category });
  } else {
    const err = new Error('Invalid category');
    err.status = 400;
    throw err;
  }

  if (search) {
    const regex = new RegExp(search, 'i');
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: [
          { employeeName: regex },
          { employeeId: regex },
          { department: regex },
          { role: regex },
          { emailId: regex },
        ],
      },
    ];
  }

  const [employees, total] = await Promise.all([
    Employee.find(filter)
      .select(EMP_LEAN_FIELDS)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Employee.countDocuments(filter),
  ]);

  return {
    employees,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    category,
  };
}

module.exports = {
  getDashboardSummary,
  getVacationTabPage,
  getDashboardCategoryPage,
  invalidateVacationDashboardStats,
  filterReturnedBackEmployees,
  buildYetToGoFromLeaves,
  WORKING_EMPLOYEE_STATUSES,
  NON_WORKING_EMPLOYEE_STATUSES,
};
