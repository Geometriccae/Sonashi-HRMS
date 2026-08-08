export const APPROVED_LEAVE_STATUSES = ["Approved", "HOD Approved"];
export const YET_TO_GO_LEAVE_STATUSES = ["Pending", "HOD Approved", "Approved"];

export const toDayStart = (value) => {
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  dt.setHours(0, 0, 0, 0);
  return dt;
};

export const normalizeName = (name) =>
  String(name || "").toLowerCase().replace(/[\s_.-]+/g, "").trim();

export const computeExperienceYears = (doj, totalYearsExperience) => {
  if (totalYearsExperience != null && !Number.isNaN(Number(totalYearsExperience))) {
    return Number(totalYearsExperience);
  }
  if (!doj) return null;
  const joinDate = new Date(doj);
  if (Number.isNaN(joinDate.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - joinDate.getFullYear();
  const monthDiff = now.getMonth() - joinDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < joinDate.getDate())) {
    years -= 1;
  }
  return Math.max(0, years);
};

export const findLinkedEmployee = (req, empList) => {
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
  const statusFilter = tabKey === "yetToGo" ? YET_TO_GO_LEAVE_STATUSES : APPROVED_LEAVE_STATUSES;
  const candidates = leaveList.filter(
    (req) => statusFilter.includes(req.status) && leaveMatchesEmployee(req, emp, empList)
  );
  if (candidates.length === 0) return null;

  const vacationLeaves = candidates.filter((req) => req.leaveType === "Vacation");
  const pool = vacationLeaves.length > 0 ? vacationLeaves : candidates;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (tabKey === "onVacation") {
    const active = pool.find((req) => {
      const start = toDayStart(req.startDate);
      const end = toDayStart(req.endDate);
      return start && end && start <= today && end >= today;
    });
    if (active) return active;

    const open = pool
      .filter((req) => {
        const end = toDayStart(req.endDate);
        return end && end >= today;
      })
      .sort((a, b) => toDayStart(a.endDate) - toDayStart(b.endDate));
    if (open.length > 0) return open[0];
  }

  if (tabKey === "yetToGo") {
    const upcoming = pool
      .filter((req) => {
        const start = toDayStart(req.startDate);
        return start && start >= today;
      })
      .sort((a, b) => toDayStart(a.startDate) - toDayStart(b.startDate));
    if (upcoming.length > 0) return upcoming[0];
  }

  if (tabKey === "returned") {
    const past = pool
      .filter((req) => {
        const end = toDayStart(req.endDate);
        return end && end < today;
      })
      .sort((a, b) => toDayStart(b.endDate) - toDayStart(a.endDate));
    if (past.length > 0) return past[0];
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
 * All employees yet to go on vacation — no 60-day window.
 * Includes approved/pending vacation leave with future start dates,
 * plus employees marked Vacation Pending.
 */
export const buildYetToGoFromLeaves = (empList, leaveList) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const safeEmpList = Array.isArray(empList) ? empList : [];
  const safeLeaveList = Array.isArray(leaveList) ? leaveList : [];

  const upcoming = safeLeaveList
    .filter(
      (req) =>
        YET_TO_GO_LEAVE_STATUSES.includes(req.status) &&
        req.leaveType === "Vacation"
    )
    .filter((req) => {
      const start = toDayStart(req.startDate);
      return start && start >= today;
    })
    .sort((a, b) => toDayStart(a.startDate) - toDayStart(b.startDate));

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
        experienceYears: computeExperienceYears(linked.doj, linked.totalYearsExperience),
        vacationStatus: linked.vacationStatus || "Vacation Pending",
      });
    } else {
      rows.push({ ...mapLeaveRow(req, safeEmpList, "Vacation Pending"), leaveStatus: req.status });
    }
  });

  safeEmpList
    .filter((e) => e.vacationStatus === "Vacation Pending")
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
        experienceYears: computeExperienceYears(e.doj, e.totalYearsExperience),
        vacationStatus: e.vacationStatus || "Vacation Pending",
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
