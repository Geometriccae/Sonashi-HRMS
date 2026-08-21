const xlsx = require('xlsx');

function normHeader(s) {
  return String(s ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ');
}

/** Map normalized header -> list of DB field keys (first match wins per field via pick) */
const HEADER_ALIASES = {
  workpermitno: 'workPermitNo',
  'work permit no': 'workPermitNo',
  'work permit': 'workPermitNo',
  permit: 'workPermitNo',
  personcode: 'workPermitNo',
  'person code': 'workPermitNo',
  employeeid: 'employeeId',
  'employee id': 'employeeId',
  'emp id': 'employeeId',
  'emp code': 'employeeId',
  'employee code': 'employeeId',
  'staff id': 'employeeId',
  'employee no': 'employeeId',
  'emp no': 'employeeId',
  'emp number': 'employeeId',
  'work id': 'employeeId',
  code: 'employeeId',
  office: 'office',
  employeename: 'employeeName',
  'employee name': 'employeeName',
  name: 'employeeName',
  fullname: 'employeeName',
  'full name': 'employeeName',
  'staff name': 'employeeName',
  reportingmanager: 'reportingManager',
  'reporting manager': 'reportingManager',
  manager: 'reportingManager',
  gender: 'gender',
  sex: 'gender',
  'sex/gender': 'gender',
  'gender/sex': 'gender',
  mobile: 'mobile',
  'mobile number': 'mobile',
  'mobile no': 'mobile',
  cellphone: 'mobile',
  'cell phone': 'mobile',
  'cell number': 'mobile',
  telephone: 'mobile',
  'phone number': 'mobile',
  phone: 'mobile',
  tel: 'mobile',
  whatsapp: 'mobile',
  'contact number': 'mobile',
  'contact no': 'mobile',
  emailid: 'emailId',
  'email id': 'emailId',
  'e mail': 'emailId',
  'e-mail': 'emailId',
  'work email': 'emailId',
  'office email': 'emailId',
  'mail id': 'emailId',
  'user email': 'emailId',
  email: 'emailId',
  emiratesid: 'emiratesId',
  'emirates id': 'emiratesId',
  eid: 'emiratesId',
  nationality: 'nationality',
  role: 'role',
  'job title': 'role',
  position: 'role',
  'job role': 'role',
  designation: 'designation',
  doj: 'doj',
  'date of joining': 'doj',
  joining: 'doj',
  totalyearsofexperience: 'totalYearsExperience',
  'total years experience': 'totalYearsExperience',
  'total year of experience': 'totalYearsExperience',
  experience: 'totalYearsExperience',
  dateofbirth: 'dateOfBirth',
  'date of birth': 'dateOfBirth',
  dob: 'dateOfBirth',
  passportno: 'passportNo',
  'passport no': 'passportNo',
  passport: 'passportNo',
  passportexpirydate: 'passportExpiryDate',
  'passport expiry date': 'passportExpiryDate',
  'passport expiry': 'passportExpiryDate',
  labourcardexpirydate: 'labourCardExpiryDate',
  'labour card expiry date': 'labourCardExpiryDate',
  'labor card expiry date': 'labourCardExpiryDate',
  'labour card expiry': 'labourCardExpiryDate',
  visaexpirydate: 'visaExpiryDate',
  'visa expiry date': 'visaExpiryDate',
  'visa expiry': 'visaExpiryDate',
  remarks: 'remarks',
  notes: 'remarks',
  department: 'department',
  dept: 'department',
  'dept name': 'department',
  'department name': 'department',
  division: 'department',
  'business unit': 'department',
  employeestatus: 'employeeStatus',
  'employee status': 'employeeStatus',
  'active status': 'employeeStatus',
  status: 'employeeStatus',
  noticeperiodstartdate: 'noticePeriodStartDate',
  'notice period start date': 'noticePeriodStartDate',
  'notice period start': 'noticePeriodStartDate',
  noticeperiodenddate: 'noticePeriodEndDate',
  'notice period end date': 'noticePeriodEndDate',
  'notice period end': 'noticePeriodEndDate',
  provisionperiodstartdate: 'provisionPeriodStartDate',
  'provision period start date': 'provisionPeriodStartDate',
  'probation period start date': 'provisionPeriodStartDate',
  provisionperiodenddate: 'provisionPeriodEndDate',
  'provision period end date': 'provisionPeriodEndDate',
  'probation period end date': 'provisionPeriodEndDate',
  attendance: 'attendance',
  lifeinsurance: 'lifeInsurance',
  'life insurance': 'lifeInsurance',
  medicalinsurance: 'medicalInsurance',
  'medical insurance': 'medicalInsurance',
  airfare: 'airFare',
  'air fare': 'airFare',
  bankname: 'bankName',
  'bank name': 'bankName',
  bank: 'bankName',
  accountnumber: 'accountNumber',
  'account number': 'accountNumber',
  account: 'accountNumber',
  'acc no': 'accountNumber',
  ibannumber: 'ibanNumber',
  'iban number': 'ibanNumber',
  iban: 'ibanNumber',
  banksortcode: 'bankSortCode',
  'bank sort code': 'bankSortCode',
  'sort code': 'bankSortCode',
  sortcode: 'bankSortCode',
};

function rowToNormMap(row) {
  const m = {};
  if (!row || typeof row !== 'object') return m;
  for (const [k, v] of Object.entries(row)) {
    const nk = normHeader(k);
    if (nk) m[nk] = v;
  }
  return m;
}

function pickRaw(map, fieldKey) {
  for (const [h, fk] of Object.entries(HEADER_ALIASES)) {
    if (fk === fieldKey && map[h] !== undefined && map[h] !== null && String(map[h]).trim() !== '') {
      return map[h];
    }
  }
  const direct = normHeader(fieldKey);
  if (map[direct] !== undefined && map[direct] !== null && String(map[direct]).trim() !== '') {
    return map[direct];
  }
  return '';
}

/**
 * Store imported calendar dates at UTC noon to avoid timezone day-shift.
 * (UTC midnight can render as previous date in some timezones.)
 */
function dateAtUtcNoon(y, m, d) {
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

function parseExcelDate(val) {
  if (val === '' || val === null || val === undefined) return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    // XLSX date cells are often local-time Date objects; keep local calendar day.
    return dateAtUtcNoon(val.getFullYear(), val.getMonth() + 1, val.getDate());
  }
  if (typeof val === 'number' && Number.isFinite(val)) {
    try {
      const d = xlsx.SSF.parse_date_code(val);
      if (d && d.y) return dateAtUtcNoon(d.y, d.m, d.d);
    } catch (_) {
      /* ignore */
    }
  }
  const s = String(val).trim();
  if (!s) return null;

  // yyyy-mm-dd
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return dateAtUtcNoon(Number(m[1]), Number(m[2]), Number(m[3]));

  // dd/mm/yyyy or dd-mm-yyyy
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return dateAtUtcNoon(Number(m[3]), Number(m[2]), Number(m[1]));

  const parsed = new Date(s);
  if (isNaN(parsed.getTime())) return null;
  return dateAtUtcNoon(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
}

function parseGender(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return '';
  if (['m', 'male', 'man', 'boy'].includes(s)) return 'Male';
  if (['f', 'female', 'woman', 'girl'].includes(s)) return 'Female';
  if (['other', 'others', 'o', 'non-binary', 'nonbinary'].includes(s)) return 'Other';
  return String(raw).trim();
}

function parseBool(val) {
  if (val === true || val === false) return val;
  const s = String(val).trim().toLowerCase();
  if (['yes', 'y', '1', 'true'].includes(s)) return true;
  if (['no', 'n', '0', 'false'].includes(s)) return false;
  return null;
}

function parseNumber(val) {
  if (val === '' || val === null || val === undefined) return null;
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  const n = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Digits only (strip spaces, +, dashes, etc.) for mobile storage. */
function normalizeMobileDigits(raw) {
  return String(raw ?? '').replace(/\D/g, '');
}

/**
 * Resolve assigned project cell to array of Client ObjectIds (strings).
 * @param {string|number} raw
 * @param {Map<string, string>} nameToId lowercased company/client name -> _id string
 */
function parseAssignedProjects(raw, nameToId) {
  if (raw === '' || raw === null || raw === undefined) return [];
  const parts = String(raw)
    .split(/[,;|]/g)
    .map((p) => p.trim())
    .filter(Boolean);
  const ids = [];
  for (const p of parts) {
    if (/^[a-f0-9]{24}$/i.test(p)) {
      ids.push(p);
      continue;
    }
    const id = nameToId.get(p.toLowerCase());
    if (id) ids.push(id);
  }
  return [...new Set(ids)];
}

function buildEmployeePayload(row, nameToId) {
  const map = rowToNormMap(row);

  const employeeId = String(pickRaw(map, 'employeeId')).trim();
  const employeeName = String(pickRaw(map, 'employeeName')).trim();
  const mobileDigits = normalizeMobileDigits(pickRaw(map, 'mobile'));
  const emailRaw = String(pickRaw(map, 'emailId')).trim();
  const role = String(pickRaw(map, 'role')).trim();
  const department = String(pickRaw(map, 'department')).trim();

  const payload = {
    workPermitNo: String(pickRaw(map, 'workPermitNo') || '').trim(),
    employeeId,
    office: String(pickRaw(map, 'office') || '').trim(),
    employeeName,
    reportingManager: String(pickRaw(map, 'reportingManager') || '').trim(),
    gender: parseGender(pickRaw(map, 'gender')),
    mobile: mobileDigits,
    emiratesId: String(pickRaw(map, 'emiratesId') || '').trim(),
    nationality: String(pickRaw(map, 'nationality') || '').trim(),
    role,
    designation: String(pickRaw(map, 'designation') || '').trim(),
    passportNo: String(pickRaw(map, 'passportNo') || '').trim(),
    remarks: String(pickRaw(map, 'remarks') || '').trim(),
    department,
    salaryDetails: {
      bankName: String(pickRaw(map, 'bankName') || '').trim(),
      accountNumber: String(pickRaw(map, 'accountNumber') || '').trim(),
      ibanNumber: String(pickRaw(map, 'ibanNumber') || '').trim(),
      bankSortCode: String(pickRaw(map, 'bankSortCode') || '').trim(),
      basicSalary: 0, // placeholders for required structure
      houseRent: 0,
      travelExp: 0,
      other: 0,
      totalAllowance: 0,
      deduction: 0,
      totalSalary: 0
    }
  };

  if (emailRaw) payload.emailId = emailRaw.toLowerCase();

  const doj = parseExcelDate(pickRaw(map, 'doj'));
  if (doj) payload.doj = doj;

  const dob = parseExcelDate(pickRaw(map, 'dateOfBirth'));
  if (dob) payload.dateOfBirth = dob;

  const ped = parseExcelDate(pickRaw(map, 'passportExpiryDate'));
  if (ped) payload.passportExpiryDate = ped;

  const lcd = parseExcelDate(pickRaw(map, 'labourCardExpiryDate'));
  if (lcd) payload.labourCardExpiryDate = lcd;

  const ved = parseExcelDate(pickRaw(map, 'visaExpiryDate'));
  if (ved) payload.visaExpiryDate = ved;

  const ty = parseNumber(pickRaw(map, 'totalYearsExperience'));
  if (ty !== null) payload.totalYearsExperience = ty;

  const es = String(pickRaw(map, 'employeeStatus') || '').trim();
  if (es) {
    const lower = es.toLowerCase();
    if (/^in.?active|inactive|non.?working/.test(lower)) payload.employeeStatus = 'InActive';
    else if (/provision|probation/.test(lower)) payload.employeeStatus = 'Provision Period';
    else if (/notice/.test(lower)) payload.employeeStatus = 'Notice Period';
    else if (/confirm/.test(lower)) payload.employeeStatus = 'Confirmed';
    else if (/resign/.test(lower)) payload.employeeStatus = 'Resigned';
    else if (/terminat/.test(lower)) payload.employeeStatus = 'Terminated';
    else if (/reliev/.test(lower)) payload.employeeStatus = 'Relieved';
    else if (/on.?hold|hold/.test(lower)) payload.employeeStatus = 'On Hold';
    else if (/^active|working/.test(lower)) payload.employeeStatus = 'Active';
    else payload.employeeStatus = es;
  }

  const nps = parseExcelDate(pickRaw(map, 'noticePeriodStartDate'));
  if (nps) payload.noticePeriodStartDate = nps;
  const npe = parseExcelDate(pickRaw(map, 'noticePeriodEndDate'));
  if (npe) payload.noticePeriodEndDate = npe;
  const pps = parseExcelDate(pickRaw(map, 'provisionPeriodStartDate'));
  if (pps) payload.provisionPeriodStartDate = pps;
  const ppe = parseExcelDate(pickRaw(map, 'provisionPeriodEndDate'));
  if (ppe) payload.provisionPeriodEndDate = ppe;

  const att = String(pickRaw(map, 'attendance') || '').trim();
  if (att) {
    if (/leave/i.test(att)) payload.attendance = 'Leave';
    else if (/onsite|on site|office/i.test(att)) payload.attendance = 'Onsite';
    else payload.attendance = att;
  }

  const li = parseBool(pickRaw(map, 'lifeInsurance'));
  if (li !== null) payload.lifeInsurance = li;

  const mi = parseBool(pickRaw(map, 'medicalInsurance'));
  if (mi !== null) payload.medicalInsurance = mi;

  const af = parseBool(pickRaw(map, 'airFare'));
  if (af !== null) payload.airFare = af;



  return payload;
}

module.exports = {
  normHeader,
  buildEmployeePayload,
  rowToNormMap,
  normalizeMobileDigits,
};
