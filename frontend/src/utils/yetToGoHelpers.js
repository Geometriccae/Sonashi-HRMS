import { isWorkingEmployeeStatus } from "./employeeStatusDisplay";

export const APPROVED_LEAVE_STATUSES = ["Approved", "HOD Approved"];
export const YET_TO_GO_LEAVE_STATUSES = APPROVED_LEAVE_STATUSES;

export const toDayStart = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) {
      const [, year, month, day] = match;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }
  }
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
};

export const normalizeName = (name) =>
  String(name || "").toLowerCase().replace(/[\s_.-]+/g, "").trim();

/** Calendar date for experience: date-only strings stay as picked; datetimes use local Y/M/D (matches DOJ display). */
const toExperienceCalendarDate = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    const dateOnly = value.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (dateOnly) {
      return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
    }
  }
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
};

/** Completed years + months from DOJ as of a reference date (calendar tenure). */
export const computeExperienceMonthsFromDoj = (doj, asOf = new Date()) => {
  const joinDate = toExperienceCalendarDate(doj);
  const refDate = toExperienceCalendarDate(asOf) || toExperienceCalendarDate(new Date());
  if (!joinDate || !refDate) return null;
  if (refDate < joinDate) return 0;

  let years = refDate.getFullYear() - joinDate.getFullYear();
  let months = refDate.getMonth() - joinDate.getMonth();
  let totalMonths = years * 12 + months;
  if (refDate.getDate() < joinDate.getDate()) totalMonths -= 1;
  return Math.max(0, totalMonths);
};

const formatMonthsAsExperience = (totalMonths) => {
  if (totalMonths == null || Number.isNaN(Number(totalMonths))) return null;
  const months = Math.max(0, Math.floor(Number(totalMonths)));
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0 && m === 0) return "0 months";
  if (y === 0) return `${m} month${m !== 1 ? "s" : ""}`;
  if (m === 0) return `${y} Year${y !== 1 ? "s" : ""}`;
  return `${y} Year${y !== 1 ? "s" : ""} and ${m} month${m !== 1 ? "s" : ""}`;
};

/**
 * Structured experience from DOJ → referenceDate.
 * referenceDate defaults to today when omitted.
 */
export const calculateExperience = (doj, referenceDate = new Date(), storedYears = null) => {
  let totalMonths = computeExperienceMonthsFromDoj(doj, referenceDate);
  if (totalMonths == null) {
    if (storedYears == null || Number.isNaN(Number(storedYears))) {
      return { years: 0, months: 0, totalMonths: null, formatted: null };
    }
    totalMonths = Math.round(Number(storedYears) * 12);
  }
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return {
    years,
    months,
    totalMonths,
    formatted: formatMonthsAsExperience(totalMonths),
  };
};

/** Display: "2 Years and 6 months" (from DOJ as of referenceDate; fallback to stored years if no DOJ). */
export const formatExperienceLabel = (doj, totalYearsExperience, asOf = new Date()) =>
  calculateExperience(doj, asOf, totalYearsExperience).formatted;

/**
 * Numeric years for filters — DOJ as of the given reference date (today when omitted).
 * Stored totalYearsExperience is only a fallback when DOJ is missing (it can be stale).
 */
export const computeExperienceYears = (doj, totalYearsExperience, asOf = new Date()) => {
  const months = computeExperienceMonthsFromDoj(doj, asOf);
  if (months != null) return Math.round((months / 12) * 10) / 10;
  if (totalYearsExperience != null && !Number.isNaN(Number(totalYearsExperience))) {
    return Number(totalYearsExperience);
  }
  return null;
};

export const findLinkedEmployee = (req, empList) => {
  if (!Array.isArray(empList) || empList.length === 0) return null;

  const recordId = req.employeeRecordId?._id || req.employeeRecordId;
  if (recordId) {
    const byRecord = empList.find((e) => String(e._id) === String(recordId));
    if (byRecord) return byRecord;
  }

  const populated = req.employee;
  if (populated?.employeeId) {
    const byRef = empList.find((e) => String(e._id) === String(populated.employeeId._id || populated.employeeId));
    if (byRef) return byRef;
  }

  const ownerId = populated?._id || populated || req.employee;
  if (ownerId) {
    const byOwner = empList.find((e) => String(e._id) === String(ownerId));
    if (byOwner) return byOwner;
  }

  const code = req.linkedEmployeeCode || req.employeeId;
  if (code) {
    const byCode = empList.find((e) => String(e.employeeId) === String(code));
    if (byCode) return byCode;
  }

  // Name fallback only when leave has no employee identity
  const hasId =
    Boolean(recordId) ||
    Boolean(populated?.employeeId) ||
    Boolean(ownerId) ||
    Boolean(code);
  if (hasId) return null;

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
};

export const getLeaveTravelDate = (req, linkedEmployee) =>
  toDayStart(req?.travellingDate || req?.startDate || linkedEmployee?.travellingDate);

export const getEffectiveVacationStatus = (req, linkedEmployee, todayValue = new Date()) => {
  if (!APPROVED_LEAVE_STATUSES.includes(req?.status)) return null;

  const today = toDayStart(todayValue);
  const travelDate = getLeaveTravelDate(req, linkedEmployee);
  const leaveEndDate = toDayStart(req?.endDate);

  if (!today || !travelDate || !leaveEndDate) return null;

  const returnDay = toDayStart(linkedEmployee?.returnDate);
  if (returnDay && today >= returnDay && travelDate <= returnDay && today < leaveEndDate) {
    return "Vacation Approved";
  }
  if (today < travelDate) return "Vacation Pending";
  if (today >= travelDate && today < leaveEndDate) return "On Vacation";
  if (today >= leaveEndDate) return "Vacation Approved";
  return null;
};

export const mapLeaveRow = (req, empList, targetStatus) => {
  const linked = findLinkedEmployee(req, empList);
  const empName = req.employeeName || linked?.employeeName || req.employee?.username || "Unknown";

  return {
    ...req,
    employeeName: linked?.employeeName || empName,
    employeeId: linked?.employeeId || req.employeeId || "—",
    department: linked?.department || req.department || "",
    role: linked?.role || "",
    office: linked?.office || "",
    nationality: linked?.nationality || "",
    doj: linked?.doj || null,
    totalYearsExperience: linked?.totalYearsExperience ?? null,
    experienceYears: computeExperienceYears(linked?.doj, linked?.totalYearsExperience, req.startDate),
    travellingDate: linked?.travellingDate || req.travellingDate || null,
    lastWorkingDay: linked?.lastWorkingDay || req.lastWorkingDay || null,
    returnDate: linked?.returnDate || req.returnDate || null,
    firstWorkingDay: linked?.firstWorkingDay || req.firstWorkingDay || null,
    vacationStatus: linked?.vacationStatus || targetStatus,
    linkedEmployeeId: linked?._id || null,
    _source: "leave",
  };
};

export const leaveMatchesEmployee = (req, emp, empList) => {
  const linked = findLinkedEmployee(req, empList);
  if (linked && String(linked._id) === String(emp._id)) return true;

  const userEmpId = req.employee?.employeeId;
  if (userEmpId && String(userEmpId) === String(emp._id)) return true;

  const reqEmail = String(req.employee?.emailId || "").trim().toLowerCase();
  const empEmail = String(emp.emailId || "").trim().toLowerCase();
  if (reqEmail && empEmail && reqEmail === empEmail) return true;

  const reqName = normalizeName(req.employeeName || req.employee?.username);
  const empName = normalizeName(emp.employeeName);
  return Boolean(reqName && empName && reqName === empName);
};

export const findLeaveForEmployee = (emp, leaveList, empList, tabKey) => {
  const candidates = leaveList.filter(
    (req) => APPROVED_LEAVE_STATUSES.includes(req.status) && leaveMatchesEmployee(req, emp, empList)
  );
  if (candidates.length === 0) return null;

  // Yet to go: any leave type. Other tabs prefer Vacation when present.
  const vacationLeaves = candidates.filter((req) => req.leaveType === "Vacation");
  const pool =
    tabKey === "yetToGo"
      ? candidates
      : vacationLeaves.length > 0
        ? vacationLeaves
        : candidates;

  const today = new Date();

  if (tabKey === "onVacation") {
    const active = pool.find((req) => getEffectiveVacationStatus(req, emp, today) === "On Vacation");
    if (active) return active;
    return null;
  }

  if (tabKey === "yetToGo") {
    const upcoming = pool
      .filter((req) => getEffectiveVacationStatus(req, emp, today) === "Vacation Pending")
      .sort((a, b) => getLeaveTravelDate(a, emp) - getLeaveTravelDate(b, emp));
    if (upcoming.length > 0) return upcoming[0];
    return null;
  }

  if (tabKey === "returned") {
    const today = toDayStart(new Date());
    const from = new Date(today);
    from.setMonth(from.getMonth() - 6);
    const past = pool
      .filter((req) => {
        const end = toDayStart(req.endDate);
        if (!end || end > today) return false;
        if (end >= from) return true;
        return getEffectiveVacationStatus(req, emp, today) === "Vacation Approved";
      })
      .sort((a, b) => toDayStart(b.endDate) - toDayStart(a.endDate));
    if (past.length > 0) return past[0];
    return null;
  }

  return pool.sort(
    (a, b) => new Date(b.appliedOn || b.createdAt || 0) - new Date(a.appliedOn || a.createdAt || 0)
  )[0];
};

const getEmployeeDedupeKey = (req, empList) => {
  const linked = findLinkedEmployee(req, empList);
  if (linked?._id) return String(linked._id);
  if (req.employee?._id) return String(req.employee._id);
  if (req.employee) return String(req.employee);
  const name = normalizeName(req.employeeName || req.employee?.username);
  return name || String(req._id);
};

/**
 * All employees yet to go — no 60-day window.
 * Includes pending/approved leave of any type with future start dates,
 * plus employees marked Vacation Pending.
 */
export const buildYetToGoFromLeaves = (empList, leaveList) => {
  const safeEmpList = Array.isArray(empList) ? empList : [];
  const safeLeaveList = Array.isArray(leaveList) ? leaveList : [];

  const upcoming = safeLeaveList
    .filter((req) => YET_TO_GO_LEAVE_STATUSES.includes(req.status))
    .filter((req) => {
      const linked = findLinkedEmployee(req, safeEmpList);
      return getEffectiveVacationStatus(req, linked) === "Vacation Pending";
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

  upcoming.forEach((req) => {
    const dedupeKey = getEmployeeDedupeKey(req, safeEmpList);
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    const linked = findLinkedEmployee(req, safeEmpList);
    if (linked) {
      rows.push({
        ...linked,
        _source: "employee",
        linkedEmployeeId: linked._id,
        linkedLeaveId: req._id,
        startDate: req.startDate,
        endDate: req.endDate,
        leaveStatus: req.status,
        experienceYears: computeExperienceYears(linked.doj, linked.totalYearsExperience, req.startDate),
        vacationStatus: "Vacation Pending",
      });
    } else {
      rows.push({ ...mapLeaveRow(req, safeEmpList, "Vacation Pending"), leaveStatus: req.status });
    }
  });

  safeEmpList
    .filter((e) => Boolean(findLeaveForEmployee(e, safeLeaveList, safeEmpList, "yetToGo")))
    .forEach((e) => {
      const dedupeKey = String(e._id);
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);

      const leave = findLeaveForEmployee(e, safeLeaveList, safeEmpList, "yetToGo");
      rows.push({
        ...e,
        _source: "employee",
        linkedEmployeeId: e._id,
        linkedLeaveId: leave?._id || null,
        startDate: leave?.startDate || null,
        endDate: leave?.endDate || null,
        leaveStatus: leave?.status || null,
        experienceYears: computeExperienceYears(e.doj, e.totalYearsExperience, leave?.startDate),
        vacationStatus: "Vacation Pending",
      });
    });

  safeEmpList.forEach((e) => {
    if (e?.vacationStatus !== "Vacation Pending") return;
    if (!isWorkingEmployeeStatus(e.employeeStatus)) return;
    const dedupeKey = String(e._id);
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    const leave = findLeaveForEmployee(e, safeLeaveList, safeEmpList, "yetToGo");
    rows.push({
      ...e,
      _source: "employee",
      linkedEmployeeId: e._id,
      linkedLeaveId: leave?._id || null,
      startDate: leave?.startDate || e.travellingDate || null,
      endDate: leave?.endDate || e.leaveEndDate || null,
      leaveStatus: leave?.status || null,
      experienceYears: computeExperienceYears(e.doj, e.totalYearsExperience, leave?.startDate || e.travellingDate),
      vacationStatus: "Vacation Pending",
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
};

/** Display labels aligned with Annual Vacation / Team Management. */
export const formatVacationStatusLabel = (vacationStatus) => {
  const vs = String(vacationStatus || "").trim();
  if (!vs) return "";
  if (vs === "Vacation Pending") return "Yet to go";
  if (vs === "On Vacation") return "On Vacation";
  if (vs === "Vacation Approved") return "Vacation Approved";
  return vs;
};

/**
 * Overlay live vacationStatus from the same includeVacation list Annual Vacations uses.
 * Does not invent a new calculation — merges statuses already computed server-side.
 */
export const mergeEffectiveVacationStatuses = (employees, vacationList) => {
  const list = Array.isArray(employees) ? employees : [];
  const vacRows = Array.isArray(vacationList) ? vacationList : [];
  if (!list.length || !vacRows.length) return list;

  const byId = new Map();
  const byCode = new Map();
  for (const row of vacRows) {
    if (row?._id != null) byId.set(String(row._id), row.vacationStatus);
    if (row?.employeeId) byCode.set(String(row.employeeId), row.vacationStatus);
  }

  return list.map((emp) => {
    const fromId = emp?._id != null ? byId.get(String(emp._id)) : undefined;
    const fromCode = emp?.employeeId ? byCode.get(String(emp.employeeId)) : undefined;
    const nextStatus = fromId !== undefined ? fromId : fromCode;
    if (nextStatus === undefined) return emp;
    return { ...emp, vacationStatus: nextStatus };
  });
};

/**
 * Actual return day used for "Returned Back / Last 6 months".
 * Team Management returnDate wins over planned leave.endDate so early return
 * shows on the dashboard without changing leave-day calculation.
 */
export const getVacationReturnDate = (emp, leave) => {
  const vs = emp?.vacationStatus || "Onsite";
  const empReturn = emp?.returnDate || emp?.firstWorkingDay || emp?.leaveEndDate;
  if (vs === "Vacation Approved" && empReturn) {
    return toDayStart(empReturn);
  }
  return toDayStart(leave?.endDate || empReturn);
};

/** Inclusive window: today back six calendar months. */
export const isDateWithinLastMonth = (value, now = new Date()) => {
  const day = toDayStart(value);
  if (!day) return false;
  const today = toDayStart(now);
  const from = new Date(today);
  from.setMonth(from.getMonth() - 6);
  return day >= from && day <= today;
};

/**
 * Returned Back (last 6 months): leave history end dates, not only
 * employees still marked Vacation Approved (many are set back to Onsite).
 * Exclude currently On Vacation / Yet to Go.
 */
export const isReturnedBackInLastMonth = (emp, leave, now = new Date()) => {
  if (!isWorkingEmployeeStatus(emp?.employeeStatus)) return false;
  const vs = emp?.vacationStatus || "Onsite";
  if (vs === "On Vacation" || vs === "Vacation Pending") return false;

  const leaveEnd = toDayStart(leave?.endDate);
  const returnDate = getVacationReturnDate(emp, leave);
  if (!isDateWithinLastMonth(returnDate, now)) return false;

  if (vs === "Vacation Approved") return true;
  if (leaveEnd) {
    const today = toDayStart(now);
    if (today && leaveEnd <= today) return true;
  }
  return false;
};

export const filterReturnedBackEmployees = (empList, leaveList, now = new Date()) => {
  const employees = Array.isArray(empList) ? empList : [];
  const leaves = Array.isArray(leaveList) ? leaveList : [];
  const today = toDayStart(now);
  const from = new Date(today);
  from.setMonth(from.getMonth() - 6);

  return employees.filter((emp) => {
    if (!isWorkingEmployeeStatus(emp?.employeeStatus)) return false;
    const vs = emp?.vacationStatus || "Onsite";
    if (vs === "On Vacation" || vs === "Vacation Pending") return false;

    if (vs === "Vacation Approved") {
      const empReturn = toDayStart(
        emp?.returnDate || emp?.firstWorkingDay || emp?.leaveEndDate
      );
      if (empReturn && isDateWithinLastMonth(empReturn, now)) return true;
    }

    const endedInWindow = leaves
      .filter((req) => {
        if (!APPROVED_LEAVE_STATUSES.includes(req.status)) return false;
        if (!leaveMatchesEmployee(req, emp, employees)) return false;
        const end = toDayStart(req.endDate);
        if (!end || end > today) return false;
        return end >= from && end <= today;
      })
      .sort((a, b) => toDayStart(b.endDate) - toDayStart(a.endDate));

    const vacationEnded = endedInWindow.filter((r) => r.leaveType === "Vacation");
    const leave =
      (vacationEnded.length > 0 ? vacationEnded[0] : null) ||
      endedInWindow[0] ||
      findLeaveForEmployee(emp, leaves, employees, "returned");

    return isReturnedBackInLastMonth(emp, leave, now);
  });
};
