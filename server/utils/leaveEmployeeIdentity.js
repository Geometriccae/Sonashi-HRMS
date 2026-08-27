/**
 * Canonical leave ↔ employee identity helpers.
 *
 * LeaveRequest.employee historically stores either:
 *   - User._id (when the employee has a login), or
 *   - Employee._id (when there is no User account)
 *
 * Authoritative HR employee key for matching across Team Management,
 * Leave Management, Reports, and HR Metrics is Employee._id
 * (plus optional HR code Employee.employeeId).
 */

const mongoose = require('mongoose');

const isObjectIdStr = (v) =>
  typeof v === 'string' && /^[a-fA-F0-9]{24}$/.test(v);

function oid(value) {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  const s = String(value._id || value);
  if (!isObjectIdStr(s)) return null;
  return new mongoose.Types.ObjectId(s);
}

/**
 * Resolve all LeaveRequest.employee values + employeeRecordId that belong
 * to a given Team Management employee (Employee._id or User._id or HR code).
 */
async function resolveLeaveOwnerIds(employeeKey, { User, Employee }) {
  const result = {
    employeeRecordId: null,
    employeeCode: null,
    employeeName: null,
    ownerIds: [],
  };

  if (!employeeKey) return result;
  const key = String(employeeKey).trim();
  if (!key) return result;

  let empDoc = null;

  if (isObjectIdStr(key)) {
    empDoc = await Employee.findById(key).select('_id employeeId employeeName').lean();
    if (!empDoc) {
      const asUser = await User.findById(key).select('_id employeeId username').lean();
      if (asUser?.employeeId) {
        empDoc = await Employee.findById(asUser.employeeId)
          .select('_id employeeId employeeName')
          .lean();
        if (empDoc) {
          result.ownerIds.push(asUser._id);
        }
      } else if (asUser) {
        result.ownerIds.push(asUser._id);
      }
    }
  }

  if (!empDoc) {
    empDoc = await Employee.findOne({
      employeeId: new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    })
      .select('_id employeeId employeeName')
      .lean();
  }

  if (empDoc) {
    result.employeeRecordId = empDoc._id;
    result.employeeCode = empDoc.employeeId || null;
    result.employeeName = empDoc.employeeName || null;
    result.ownerIds.push(empDoc._id);

    const linkedUsers = await User.find({ employeeId: empDoc._id }).select('_id').lean();
    linkedUsers.forEach((u) => result.ownerIds.push(u._id));
  }

  const seen = new Set();
  result.ownerIds = result.ownerIds.filter((id) => {
    const s = String(id);
    if (seen.has(s)) return false;
    seen.add(s);
    return true;
  });

  return result;
}

/**
 * Mongo filter fragment that selects all leave rows for one employee
 * without relying on employeeName.
 */
function buildEmployeeLeaveMongoFilter(resolved) {
  const clauses = [];
  if (resolved.ownerIds?.length) {
    clauses.push({ employee: { $in: resolved.ownerIds } });
  }
  if (resolved.employeeRecordId) {
    clauses.push({ employeeRecordId: resolved.employeeRecordId });
  }
  if (resolved.employeeCode) {
    clauses.push({ employeeId: resolved.employeeCode });
    clauses.push({ employeeId: String(resolved.employeeRecordId) });
  }
  if (!clauses.length) return null;
  return clauses.length === 1 ? clauses[0] : { $or: clauses };
}

/**
 * Batch-enrich leave rows with canonical Employee identity.
 * Does not mutate historical dates/status/days — only adds linking fields
 * for API consumers.
 */
async function enrichLeaveRowsWithEmployeeIdentity(rows, { User, Employee }) {
  if (!Array.isArray(rows) || rows.length === 0) return rows || [];

  const ownerIds = [
    ...new Set(
      rows
        .map((r) => String(r.employee?._id || r.employee || ''))
        .filter((id) => isObjectIdStr(id))
    ),
  ];

  const recordIdsFromRows = [
    ...new Set(
      rows
        .map((r) => String(r.employeeRecordId?._id || r.employeeRecordId || ''))
        .filter((id) => isObjectIdStr(id))
    ),
  ];

  const [users, employeesById] = await Promise.all([
    ownerIds.length
      ? User.find({ _id: { $in: ownerIds } })
          .select('_id employeeId username emailId')
          .lean()
      : [],
    (() => {
      const ids = [...new Set([...ownerIds, ...recordIdsFromRows])];
      return ids.length
        ? Employee.find({ _id: { $in: ids } })
            .select('_id employeeId employeeName emailId department reportingManager companyCode')
            .lean()
        : Promise.resolve([]);
    })(),
  ]);

  const userById = new Map(users.map((u) => [String(u._id), u]));
  const empById = new Map(employeesById.map((e) => [String(e._id), e]));

  const linkedEmpIds = [
    ...new Set(
      users
        .map((u) => String(u.employeeId || ''))
        .filter((id) => isObjectIdStr(id) && !empById.has(id))
    ),
  ];
  if (linkedEmpIds.length) {
    const more = await Employee.find({ _id: { $in: linkedEmpIds } })
      .select('_id employeeId employeeName emailId department reportingManager companyCode')
      .lean();
    more.forEach((e) => empById.set(String(e._id), e));
  }

  const codes = [
    ...new Set(
      rows
        .map((r) => String(r.employeeId || '').trim())
        .filter((c) => c && !isObjectIdStr(c))
    ),
  ];
  if (codes.length) {
    const byCode = await Employee.find({ employeeId: { $in: codes } })
      .select('_id employeeId employeeName emailId department reportingManager companyCode')
      .lean();
    byCode.forEach((e) => empById.set(String(e._id), e));
  }

  const empByCode = new Map();
  empById.forEach((e) => {
    if (e.employeeId) empByCode.set(String(e.employeeId).toLowerCase(), e);
  });

  return rows.map((row) => {
    const ownerId = String(row.employee?._id || row.employee || '');
    const user = userById.get(ownerId);
    let emp =
      (row.employeeRecordId && empById.get(String(row.employeeRecordId._id || row.employeeRecordId))) ||
      (user?.employeeId && empById.get(String(user.employeeId))) ||
      empById.get(ownerId) ||
      null;

    if (!emp && row.employeeId) {
      const code = String(row.employeeId).trim();
      if (isObjectIdStr(code)) emp = empById.get(code) || null;
      else emp = empByCode.get(code.toLowerCase()) || null;
    }

    const employeeRecordId = emp?._id || row.employeeRecordId || null;
    const employeeCode =
      emp?.employeeId ||
      (row.employeeId && !isObjectIdStr(String(row.employeeId)) ? row.employeeId : '') ||
      '';

    return {
      ...row,
      employeeRecordId: employeeRecordId || undefined,
      employeeId: employeeCode || row.employeeId || undefined,
      linkedEmployeeName: emp?.employeeName || undefined,
      linkedEmployeeCode: employeeCode || undefined,
      employee:
        row.employee && typeof row.employee === 'object'
          ? {
              ...row.employee,
              employeeId: row.employee.employeeId || emp?._id || user?.employeeId || undefined,
            }
          : row.employee,
    };
  });
}

function identityFieldsFromEmployee(empDoc) {
  if (!empDoc) return {};
  return {
    employeeRecordId: empDoc._id,
    employeeId: empDoc.employeeId || '',
  };
}

function compactName(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function firstNameToken(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .find((t) => t.length >= 3 && !/^(mr|mrs|ms|miss|mdm|dr)$/i.test(t)) || "";
}

const COMMON_FIRST = new Set([
  "muhammad", "mohammed", "mohammad", "mohd", "ahmed", "ahmad",
  "abdul", "syed", "kumar", "singh", "md",
]);

function namesCompatible(excelName, softwareName) {
  const ca = compactName(excelName);
  const cb = compactName(softwareName);
  if (!ca || !cb) return false;
  if (ca === cb) return true;
  if (ca.length >= 8 && cb.length >= 8 && (ca.startsWith(cb) || cb.startsWith(ca))) return true;
  const fa = firstNameToken(excelName);
  const fb = firstNameToken(softwareName);
  if (fa && fb && fa === fb && fa.length >= 5) return true;
  return false;
}

function matchEmployeeFromExcel(employees, excelId, excelName) {
  const list = employees || [];
  const id = String(excelId || "").trim();
  if (id && /^id[a-z]{2,4}-\d+/i.test(id)) {
    const hit = list.find((e) => String(e.employeeId || "").toLowerCase() === id.toLowerCase());
    if (hit && namesCompatible(excelName, hit.employeeName)) return hit;
  }
  const compact = compactName(excelName);
  if (!compact) return null;
  const exact = list.filter((e) => compactName(e.employeeName) === compact);
  if (exact.length === 1) return exact[0];
  const starts = list.filter((e) => {
    const n = compactName(e.employeeName);
    return n && compact && (n.startsWith(compact) || compact.startsWith(n)) && Math.min(n.length, compact.length) >= 10;
  });
  if (starts.length === 1) return starts[0];
  const first = firstNameToken(excelName);
  const second = String(excelName || "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3)[1];
  if (first && second) {
    const two = list.filter((e) => {
      const tokens = String(e.employeeName || "")
        .toLowerCase()
        .replace(/[^a-z\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length >= 3);
      return tokens[0] === first && tokens[1] === second;
    });
    if (two.length === 1) return two[0];
  }
  if (first && first.length >= 7 && !COMMON_FIRST.has(first)) {
    const byFirst = list.filter((e) => firstNameToken(e.employeeName) === first);
    if (byFirst.length === 1) return byFirst[0];
  }
  return exact[0] || null;
}

module.exports = {
  isObjectIdStr,
  oid,
  resolveLeaveOwnerIds,
  buildEmployeeLeaveMongoFilter,
  enrichLeaveRowsWithEmployeeIdentity,
  identityFieldsFromEmployee,
  matchEmployeeFromExcel,
};
