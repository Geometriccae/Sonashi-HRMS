const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const User = require('../models/User');
const EmployeeRemark = require('../models/EmployeeRemark');
const authMiddleware = require('../middleware/authMiddleware');
const { blockViewerWrites } = require('../middleware/permissionsMiddleware');
const multer = require('multer');
const path = require('path');
const nodemailer = require("nodemailer");
const Notification = require('../models/Notification');
const Attendance = require('../models/Attendance');
const fs = require('fs'); // Add this import
const crypto = require('crypto');
const xlsx = require('xlsx');
const mongoose = require('mongoose');
const Client = require('../models/Client');
const CompanyDocument = require('../models/CompanyDocument');
const { buildEmployeePayload } = require('../utils/employeeExcelImport');
const { notifyEmployeeOnboarding } = require('../services/hrNotificationService');
const { ensureUploadSubdir } = require('../utils/uploadsPath');
const {
  EMPLOYEE_STATUS_VALUES,
  workingStatusFilter,
  nonWorkingStatusFilter,
} = require('../utils/employeeStatus');
const LeaveRequest = require('../models/LeaveRequest');
const {
  getListCache,
  setListCache,
  invalidateListCache,
  getApprovedLeavesCache,
  setApprovedLeavesCache,
} = require('../utils/employeeListCache');

// ========== SERVER-SIDE LIST CACHE ==========
// Cached via employeeListCache; invalidated on employee writes and leave yet-to-go sync.

/** Map company document particulars → docNumber (Company Code). */
const COMPANY_CODE_TTL_MS = 60000;
let _companyCodeCache = { map: null, ts: 0 };

async function getCompanyCodeMap() {
  try {
    if (_companyCodeCache.map && Date.now() - _companyCodeCache.ts < COMPANY_CODE_TTL_MS) {
      return _companyCodeCache.map;
    }
    const docs = await CompanyDocument.find({}).select('particulars docNumber updatedAt createdAt').lean();
    const map = {};
    const sorted = [...docs].sort((a, b) => {
      const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return ta - tb;
    });
    for (const d of sorted) {
      const key = String(d.particulars || '').trim().toLowerCase();
      const code = String(d.docNumber || '').trim();
      if (key && code) map[key] = code;
    }
    _companyCodeCache = { map, ts: Date.now() };
    return map;
  } catch (err) {
    console.error('Failed to load company codes from Company Documents:', err.message);
    return {};
  }
}

/** Live Company Code from Company Documents (by employee.office / company name).
 *  Preserve stored company codes. Empty → built-in JOINT VEN code.
 */
function applyLiveCompanyCodes(employees, codeMap) {
  if (!Array.isArray(employees)) return employees;
  const DEFAULT_COMPANY_CODE = '0000000172509';
  return employees.map((e) => {
    const stored = String(e.companyCode || '').trim();
    if (stored) return e;
    const key = String(e.office || '').trim().toLowerCase();
    const live = key && codeMap ? codeMap[key] : '';
    if (live) return { ...e, companyCode: live };
    return { ...e, companyCode: DEFAULT_COMPANY_CODE };
  });
}

// warmListCache / invalidateListCache come from employeeListCache
function warmListCache() {
  const mongoose = require('mongoose');
  if (mongoose.connection.readyState !== 1) {
    mongoose.connection.once('connected', () => warmListCache());
    return;
  }
  Employee.find({}).select(EMPLOYEE_LIST_FIELDS).sort({ createdAt: -1 }).lean()
    .then(data => { setListCache(data); console.log(`✅ Employee list cache warmed (${data.length} records)`); })
    .catch(err => console.warn('Cache warm-up failed (non-critical):', err.message));
}
// =============================================

/** Import rows only require these four fields (mobile & email are optional). */
function importRowRequiredFieldsMissing(payload) {
  const missing = [];
  if (!String(payload?.employeeId ?? '').trim()) missing.push('employeeId');
  if (!String(payload?.employeeName ?? '').trim()) missing.push('employeeName');
  if (!String(payload?.role ?? '').trim()) missing.push('role');
  if (!String(payload?.department ?? '').trim()) missing.push('department');
  return missing;
}

const PLACEHOLDER_EMAIL_HOST = 'import.hrms.placeholder';

/**
 * Many databases still have a non-sparse unique index on emailId, so multiple
 * "missing" / null emails throw E11000. When the user leaves email blank we
 * assign a unique internal address; the UI shows "—" for this host.
 */
function ensureEmployeeEmailForDb(target, uniquenessExtra) {
  const raw = String(target?.emailId ?? '').trim();
  if (raw) {
    target.emailId = raw.toLowerCase();
    return;
  }
  let emp = String(target?.employeeId ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (!emp) emp = 'emp';
  emp = emp.slice(0, 48);
  const salt = String(uniquenessExtra ?? '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 24);
  const rand = crypto.randomBytes(6).toString('hex');
  const u = `${salt}${salt ? '-' : ''}${rand}`.slice(0, 56);
  target.emailId = `noemail+${emp}+${u}@${PLACEHOLDER_EMAIL_HOST}`.toLowerCase();
}

const DEFAULT_TASK_REMINDERS = [1, 15, 60, 180, 1440];

const normalizeReminderList = (reminders) => {
  if (!Array.isArray(reminders)) return [...DEFAULT_TASK_REMINDERS];
  const sanitized = reminders
    .map((minutes) => Number(minutes))
    .filter((minutes) => Number.isFinite(minutes) && minutes >= 0);
  return sanitized.length > 0 ? sanitized : [...DEFAULT_TASK_REMINDERS];
};

const deriveEventDateTime = (dateValue, timeValue) => {
  if (!dateValue) return null;

  const normalizeDateString = (value) => {
    if (!value) return null;
    if (typeof value === 'string') {
      // if ISO string, split at T to ensure date-only portion
      return value.split('T')[0];
    }
    if (value instanceof Date && !isNaN(value.getTime())) {
      return value.toISOString().split('T')[0];
    }
    return null;
  };

  const baseDateStr = normalizeDateString(dateValue);
  if (!baseDateStr) return null;

  if (timeValue) {
    return new Date(`${baseDateStr}T${timeValue}:00`);
  }
  return new Date(baseDateStr);
};


const importStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, ensureUploadSubdir());
  },
  filename: (req, file, cb) => {
    cb(null, `employee-import-${Date.now()}${path.extname(file.originalname)}`);
  },
});
const uploadEmployeeImport = multer({
  storage: importStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (['.xlsx', '.xls'].includes(ext)) cb(null, true);
    else cb(new Error('Only .xlsx or .xls files are allowed'));
  },
});

const profilePhotoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, ensureUploadSubdir('employees'));
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const uploadProfilePhoto = multer({
  storage: profilePhotoStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only images (.jpg, .jpeg, .png, .gif, .webp) are allowed'));
    }
  }
});

const DATA_URI_EXT = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
  'image/gif': 'gif', 'image/webp': 'webp', 'image/bmp': 'bmp', 'image/svg+xml': 'svg',
};

/**
 * If a profilePhoto value is an inline base64 data URI, write it to disk and
 * return the public file path. Prevents storing huge base64 blobs in MongoDB,
 * which makes list queries return tens of MB and time out.
 * Returns the original value when it is not a data URI (e.g. already a path).
 */
function persistBase64ProfilePhoto(value, idHint) {
  if (typeof value !== 'string' || !value.startsWith('data:')) return value;
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(value);
  if (!match) return value;
  const mime = (match[1] || 'image/jpeg').toLowerCase();
  const isBase64 = !!match[2];
  const payload = match[3] || '';
  const ext = DATA_URI_EXT[mime] || 'jpg';
  const buffer = isBase64
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeURIComponent(payload), 'utf8');

  const uploadDir = ensureUploadSubdir('employees');

  const safeId = String(idHint || 'emp').replace(/[^a-zA-Z0-9_-]/g, '-');
  const filename = `${safeId}-${Date.now()}.${ext}`;
  fs.writeFileSync(path.join(uploadDir, filename), buffer);
  return `/uploads/employees/${filename}`;
}
// =============================================

// ?? Email sending helper
async function sendTaskAssignedEmail(to, eventData, assignedBy, employeeName, actionType = 'created') {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const formattedDate = eventData.date
    ? new Date(eventData.date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    : "N/A";

  const subjectPrefix = actionType === 'reminder' ? 'Reminder: ' : 'New Task Assigned: ';
  const titlePrefix = actionType === 'reminder' ? 'Task Reminder' : 'New Task Assigned';

  const mailOptions = {
    from: `"Auxin Task Manager" <${process.env.EMAIL_USER}>`,
    to,
    subject: `${subjectPrefix}${eventData.eventName} - ${employeeName}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding:20px; background:#f9f9f9;">
        <div style="max-width:600px; margin:auto; background:#fff; border-radius:8px; padding:20px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
          <h2 style="color:#007bff; margin-bottom:10px;">${titlePrefix}</h2>
          <p><b>Event Name:</b> ${eventData.eventName}</p>
          <p><b>Event Type:</b> ${eventData.eventType || "N/A"}</p>
          <p><b>Date:</b> ${formattedDate}</p>
          <p><b>Time:</b> ${eventData.time || "N/A"}</p>
          <p><b>Assigned by:</b> ${assignedBy}</p>
          ${eventData.notes ? `<p><b>Notes:</b> ${eventData.notes}</p>` : ""}
          ${eventData.link ? `<p><b>Link:</b> <a href="${eventData.link}" style="color:#007bff;">${eventData.link}</a></p>` : ""}
          <p style="margin-top:20px; color:#555;">Please check your dashboard for more details.</p>
        </div>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}

// Helper for background emails
async function sendTaskEmailsInBackground(employee, eventData, assignedBy, actionType = 'created') {
  try {
    const recipients = [];
    if (employee.emailId) recipients.push(employee.emailId);

    if (Array.isArray(eventData.assignedTeamMembers)) {
      for (const memberId of eventData.assignedTeamMembers) {
        try {
          const member = await Employee.findById(memberId).limit(1).lean(); // optimized
          if (member?.emailId) recipients.push(member.emailId);
        } catch (e) {
          console.warn(`Failed to lookup team member ${memberId}:`, e);
        }
      }
    }
    const uniqueRecipients = [...new Set(recipients)];

    const emailPromises = uniqueRecipients.map(email =>
      sendTaskAssignedEmail(email, eventData, assignedBy, employee.employeeName || 'Employee', actionType).catch(err => {
        console.error(`Failed to send task email to ${email}:`, err);
      })
    );
    await Promise.allSettled(emailPromises);
  } catch (err) {
    console.error("Background email error:", err);
  }
}


// ====== STATIC ROUTES (No parameters) ======

const EMPLOYEE_LIST_FIELDS = [
  'employeeId', 'employeeName', 'employeeStatus', 'previousEmployeeStatus', 'vacationStatus', 'emailId', 'mobile',
  'role', 'department', 'attendance', 'doj', 'totalYearsExperience', 'passportExpiryDate',
  'visaExpiryDate', 'labourCardExpiryDate', 'emiratesIdExpiryDate', 'contractRenewalDate',
  'travellingDate', 'returnDate', 'firstWorkingDay', 'lastWorkingDay', 'leaveEndDate',
  'noticePeriod', 'provisionPeriod', 'noticePeriodStartDate', 'noticePeriodEndDate',
  'provisionPeriodStartDate', 'provisionPeriodEndDate',
  'reportingManager', 'assignedProjects',
  'nationality', 'office', 'companyCode', 'passportNo', 'emiratesId', 'airFare', 'createdAt',
].join(' ');

const APPROVED_VACATION_LEAVE_STATUSES = ['Approved', 'HOD Approved'];
const DYNAMIC_VACATION_STATUSES = new Set(['Vacation Pending', 'On Vacation', 'Vacation Approved']);
const APPROVED_LEAVE_SELECT =
  'employee employeeId employeeName leaveType startDate endDate status travellingDate lastWorkingDay returnDate firstWorkingDay department';

async function getApprovedLeavesForVacation() {
  const cached = getApprovedLeavesCache();
  if (cached) return cached;
  const rows = await LeaveRequest.find({
    status: { $in: APPROVED_VACATION_LEAVE_STATUSES },
  })
    .select(APPROVED_LEAVE_SELECT)
    .populate('employee', 'username emailId employeeId')
    .lean();
  setApprovedLeavesCache(rows);
  return rows;
}

function toCalendarDate(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) {
      const [, year, month, day] = match;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function normalizeVacationMatchValue(value) {
  return String(value || '').toLowerCase().replace(/[\s_.-]+/g, '').trim();
}

function leaveBelongsToEmployee(leave, employee) {
  if (!leave || !employee) return false;

  const employeeMongoId = String(employee._id || '').trim();
  const employeeCode = String(employee.employeeId || '').trim();
  const employeeEmail = String(employee.emailId || '').trim().toLowerCase();
  const employeeName = normalizeVacationMatchValue(employee.employeeName);

  const leaveUserRef = String(leave.employee?._id || leave.employee || '').trim();
  if (leaveUserRef && employeeMongoId && leaveUserRef === employeeMongoId) return true;

  const linkedEmployeeRef = String(leave.employee?.employeeId || '').trim();
  if (linkedEmployeeRef && employeeMongoId && linkedEmployeeRef === employeeMongoId) return true;
  if (linkedEmployeeRef && employeeCode && linkedEmployeeRef === employeeCode) return true;

  const leaveEmployeeCode = String(leave.employeeId || '').trim();
  if (leaveEmployeeCode && employeeCode && leaveEmployeeCode === employeeCode) return true;

  const leaveEmail = String(leave.employee?.emailId || '').trim().toLowerCase();
  if (leaveEmail && employeeEmail && leaveEmail === employeeEmail) return true;

  const leaveName = normalizeVacationMatchValue(leave.employeeName || leave.employee?.username);
  return Boolean(leaveName && employeeName && leaveName === employeeName);
}

function getLeaveTravelStartDate(leave, employee) {
  return toCalendarDate(employee?.travellingDate || leave?.travellingDate || leave?.startDate);
}

function getEffectiveVacationStatusFromLeave(leave, employee, today = new Date()) {
  if (!leave || !APPROVED_VACATION_LEAVE_STATUSES.includes(leave.status)) return null;

  const todayDate = toCalendarDate(today);
  const travelDate = getLeaveTravelStartDate(leave, employee);
  const leaveEndDate = toCalendarDate(leave.endDate);

  if (!todayDate || !travelDate || !leaveEndDate) return null;
  if (todayDate < travelDate) return 'Vacation Pending';
  if (todayDate >= travelDate && todayDate <= leaveEndDate) return 'On Vacation';
  if (todayDate > leaveEndDate) return 'Vacation Approved';
  return null;
}

function applyEffectiveVacationStatuses(employees, leaveRequests) {
  const safeEmployees = Array.isArray(employees) ? employees : [];
  const safeLeaves = Array.isArray(leaveRequests) ? leaveRequests : [];

  // Index leaves once — avoids O(employees × leaves) full scans
  const leavesByEmpId = new Map();
  const leavesByCode = new Map();
  const leavesByName = new Map();
  for (const leave of safeLeaves) {
    const empRef = leave.employee;
    const oid = empRef && (empRef._id || empRef);
    if (oid) {
      const k = String(oid);
      if (!leavesByEmpId.has(k)) leavesByEmpId.set(k, []);
      leavesByEmpId.get(k).push(leave);
    }
    if (leave.employeeId) {
      const k = String(leave.employeeId);
      if (!leavesByCode.has(k)) leavesByCode.set(k, []);
      leavesByCode.get(k).push(leave);
    }
    const nameKey = normalizeVacationMatchValue(leave.employeeName || empRef?.username);
    if (nameKey) {
      if (!leavesByName.has(nameKey)) leavesByName.set(nameKey, []);
      leavesByName.get(nameKey).push(leave);
    }
  }

  const leavesForEmployee = (employee) => {
    const seen = new Set();
    const out = [];
    const add = (arr) => {
      if (!arr) return;
      for (const leave of arr) {
        const id = String(leave._id || '');
        if (id && seen.has(id)) continue;
        if (id) seen.add(id);
        if (leaveBelongsToEmployee(leave, employee)) out.push(leave);
      }
    };
    add(leavesByEmpId.get(String(employee._id)));
    if (employee.employeeId) add(leavesByCode.get(String(employee.employeeId)));
    add(leavesByName.get(normalizeVacationMatchValue(employee.employeeName)));
    // Fallback if indexing missed a match
    if (out.length === 0) {
      return safeLeaves.filter((leave) => leaveBelongsToEmployee(leave, employee));
    }
    return out;
  };

  return safeEmployees.map((employee) => {
    const employeeLeaves = leavesForEmployee(employee);

    const activeLeave = employeeLeaves.find(
      (leave) => getEffectiveVacationStatusFromLeave(leave, employee) === 'On Vacation'
    );
    if (activeLeave) return { ...employee, vacationStatus: 'On Vacation' };

    const upcomingLeave = employeeLeaves.find(
      (leave) => getEffectiveVacationStatusFromLeave(leave, employee) === 'Vacation Pending'
    );
    if (upcomingLeave) return { ...employee, vacationStatus: 'Vacation Pending' };

    const completedLeave = [...employeeLeaves].reverse().find(
      (leave) => getEffectiveVacationStatusFromLeave(leave, employee) === 'Vacation Approved'
    );
    if (completedLeave) return { ...employee, vacationStatus: 'Vacation Approved' };

    if (DYNAMIC_VACATION_STATUSES.has(employee.vacationStatus)) {
      return { ...employee, vacationStatus: 'Onsite' };
    }

    return employee;
  });
}

// Lightweight stats for dashboard / team management cards
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const [totalEmployees, activeEmployees, inactiveEmployees] = await Promise.all([
      Employee.countDocuments(),
      Employee.countDocuments(workingStatusFilter()),
      Employee.countDocuments(nonWorkingStatusFilter()),
    ]);

    res.json({
      totalEmployees,
      activeEmployees,
      inactiveEmployees,
      totalAssignedProjects: 0,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching employee stats', error: error.message });
  }
});

// Get all employees (use ?view=list for lightweight table data)
// Supports server-side pagination: ?page=1&limit=20&search=...&status=Active|InActive
router.get('/', authMiddleware, async (req, res) => {
  try {
    const view = String(req.query.view || '').toLowerCase();
    const page = parseInt(req.query.page, 10);
    const limit = parseInt(req.query.limit, 10);
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || '').trim();
    const paginate = !isNaN(page) && page > 0 && !isNaN(limit) && limit > 0;
    const hasFilters = search || status;
    const includeVacation =
      String(req.query.includeVacation || '') === '1' ||
      String(req.query.includeVacation || '').toLowerCase() === 'true';
    const withLeaves =
      String(req.query.withLeaves || '') === '1' ||
      String(req.query.withLeaves || '').toLowerCase() === 'true';

    // Only load approved leaves when vacation status merge is requested.
    // Default list/dropdown loads skip this (was dominating response time).
    const approvedLeavesPromise = includeVacation
      ? getApprovedLeavesForVacation()
      : Promise.resolve([]);

    const respondEmployees = (employees, approvedLeaves) => {
      if (withLeaves && includeVacation) {
        return res.json({ employees, leaves: approvedLeaves || [] });
      }
      return res.json(employees);
    };

    // Fast path: unfiltered list view served from in-memory cache
    if (view === 'list' && !paginate && !hasFilters) {
      const cached = getListCache();
      if (cached) {
        const [codeMap, approvedLeaves] = await Promise.all([getCompanyCodeMap(), approvedLeavesPromise]);
        const withCodes = applyLiveCompanyCodes(cached, codeMap);
        const employees = includeVacation
          ? applyEffectiveVacationStatuses(withCodes, approvedLeaves)
          : withCodes;
        return respondEmployees(employees, approvedLeaves);
      }
    }

    const filter = {};
    if (status === 'Active') Object.assign(filter, workingStatusFilter());
    else if (status === 'InActive') Object.assign(filter, nonWorkingStatusFilter());
    else if (status && EMPLOYEE_STATUS_VALUES.includes(status)) filter.employeeStatus = status;

    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [
        { employeeName: regex },
        { employeeId: regex },
        { emailId: regex },
        { role: regex },
        { department: regex },
        { mobile: regex },
      ];
    }

    const [codeMap, approvedLeaves] = await Promise.all([getCompanyCodeMap(), approvedLeavesPromise]);

    if (paginate && view === 'list') {
      const [employees, total] = await Promise.all([
        Employee.find(filter)
          .select(EMPLOYEE_LIST_FIELDS)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Employee.countDocuments(filter),
      ]);
      const withCodes = applyLiveCompanyCodes(employees, codeMap);
      const merged = includeVacation
        ? applyEffectiveVacationStatuses(withCodes, approvedLeaves)
        : withCodes;
      if (withLeaves && includeVacation) {
        return res.json({
          employees: merged,
          leaves: approvedLeaves || [],
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        });
      }
      return res.json({
        employees: merged,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    }

    const query = Employee.find(filter).sort({ createdAt: -1 });
    if (view === 'list') {
      query.select(EMPLOYEE_LIST_FIELDS).lean();
    } else {
      query.select('-profilePhoto').lean();
    }

    const employees = await query;

    // Populate cache for unfiltered list queries (raw; company code applied on read)
    if (view === 'list' && !hasFilters) {
      setListCache(employees);
    }

    const withCodes = applyLiveCompanyCodes(employees, codeMap);
    const merged = includeVacation
      ? applyEffectiveVacationStatuses(withCodes, approvedLeaves)
      : withCodes;
    return respondEmployees(merged, approvedLeaves);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching employees', error: error.message });
  }
});

// Get profile photo URL by employee email
router.get('/profile-photo', authMiddleware, async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ message: 'Email query param is required' });
    }
    const employee = await Employee.findOne({ emailId: new RegExp(`^${email.trim()}$`, 'i') }).select('profilePhoto').lean();
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    res.json({ profilePhoto: employee.profilePhoto || '' });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching profile photo', error: error.message });
  }
});

// Batch fetch profile photos for a specific set of employee IDs (current page only).
// Keeps the main list lightweight while still showing avatars. ?ids=id1,id2,...
router.get('/photos', authMiddleware, async (req, res) => {
  try {
    const idsParam = String(req.query.ids || '').trim();
    if (!idsParam) return res.json([]);
    const ids = idsParam
      .split(',')
      .map((s) => s.trim())
      .filter((s) => mongoose.Types.ObjectId.isValid(s));
    if (!ids.length) return res.json([]);

    const employees = await Employee.find({ _id: { $in: ids } })
      .select('profilePhoto')
      .lean();
    res.json(employees.map((e) => ({ _id: e._id, profilePhoto: e.profilePhoto || '' })));
  } catch (error) {
    res.status(500).json({ message: 'Error fetching profile photos', error: error.message });
  }
});

// Get all events across all employees - MUST COME BEFORE PARAMETERIZED ROUTES
router.get('/events', authMiddleware, async (req, res) => {
  try {
    const employees = await Employee.find({}, { employeeName: 1, events: 1 }).lean();
    const allEvents = [];
    for (const employee of employees) {
      if (Array.isArray(employee.events)) {
        for (const event of employee.events) {
          allEvents.push({
            employeeId: employee._id,
            employeeName: employee.employeeName,
            ...event,
          });
        }
      }
    }

    // Get the IO instance if available
    const io = req.app.get('io');

    // If socket.io is configured, emit a notification about events fetch
    // if (io) {
    //   io.to('role-admin').emit('notification', {
    //     id: `events-fetch-${Date.now()}`,
    //     type: 'system',
    //     title: 'Events Data Accessed',
    //     message: `All events data was accessed by ${req.user?.username || 'a user'}`,
    //     timestamp: new Date()
    //   });
    // }

    res.json(allEvents);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching all events', error: error.message });
  }
});

// Bulk import employees from Excel (first sheet; headers match Team Management / Add Employee fields)
router.post('/import', authMiddleware, blockViewerWrites, uploadEmployeeImport.single('file'), async (req, res) => {
  let filePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    filePath = req.file.path;

    const clients = await Client.find({}, { companyName: 1 }).lean();
    const nameToId = new Map();
    for (const c of clients) {
      if (c.companyName) nameToId.set(String(c.companyName).trim().toLowerCase(), String(c._id));
    }

    const workbook = xlsx.readFile(filePath, { cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '', raw: false });

    const results = [];
    const errors = [];
    /** Employee ID -> first Excel row number in this import that successfully saved (for clearer duplicate errors). */
    const employeeIdFirstRowThisImport = new Map();

    for (let i = 0; i < rows.length; i++) {
      const rowIndex = i + 2; // Excel row (1-based + header)
      const row = rows[i];
      if (!row || typeof row !== 'object') continue;

      const allEmpty = Object.values(row).every(
        (v) => v === '' || v === null || v === undefined || String(v).trim() === ''
      );
      if (allEmpty) continue;

      try {
        const payload = buildEmployeePayload(row, nameToId);
        const missing = importRowRequiredFieldsMissing(payload);
        if (missing.length) {
          errors.push({ row: rowIndex, message: `Missing required: ${missing.join(', ')}` });
          continue;
        }

        if (payload.mobile === undefined || payload.mobile === null) {
          payload.mobile = '';
        }

        if (String(payload.emailId || '').trim()) {
          payload.emailId = String(payload.emailId).trim().toLowerCase();
        } else {
          delete payload.emailId;
        }

        ensureEmployeeEmailForDb(payload, `r${rowIndex}`);



        if (payload.employeeStatus && !EMPLOYEE_STATUS_VALUES.includes(payload.employeeStatus)) {
          delete payload.employeeStatus;
        }
        if (payload.attendance && !['Onsite', 'Leave'].includes(payload.attendance)) {
          delete payload.attendance;
        }
        if (Array.isArray(payload.assignedProjects)) {
          payload.assignedProjects = payload.assignedProjects.filter((id) =>
            mongoose.Types.ObjectId.isValid(id)
          );
          if (payload.assignedProjects.length === 0) delete payload.assignedProjects;
        }

        const existingMail = await Employee.findOne({
          emailId: payload.emailId.toLowerCase().trim(),
        }).lean();
        if (existingMail) {
          errors.push({ row: rowIndex, message: `Duplicate email: ${payload.emailId}` });
          continue;
        }

        const empIdKey = String(payload.employeeId).trim();
        if (employeeIdFirstRowThisImport.has(empIdKey)) {
          const firstRow = employeeIdFirstRowThisImport.get(empIdKey);
          errors.push({
            row: rowIndex,
            message: `Duplicate employee ID: ${payload.employeeId} (same ID as Excel row ${firstRow} in this file — every row needs a unique Employee ID)`,
          });
          continue;
        }

        const existingId = await Employee.findOne({ employeeId: empIdKey }).lean();
        if (existingId) {
          errors.push({
            row: rowIndex,
            message: `Duplicate employee ID: ${payload.employeeId} (already in the database — change this ID in Excel or delete/rename the existing employee first)`,
          });
          continue;
        }

        const employee = new Employee(payload);
        const saved = await employee.save();
        employeeIdFirstRowThisImport.set(String(saved.employeeId).trim(), rowIndex);

        try {
          const io = req.app.get('io');
          if (io) {
            io.emit('employee-created', saved);
            if (saved.emailId) io.to(`email-${saved.emailId}`).emit('employee-created', saved);
            io.to('role-admin').emit('employee-created', saved);
          }
        } catch (emitErr) {
          console.warn('employee import socket emit:', emitErr);
        }

        results.push({
          row: rowIndex,
          status: 'created',
          _id: String(saved._id),
          employeeId: saved.employeeId,
          emailId: saved.emailId,
        });
      } catch (rowErr) {
        errors.push({ row: rowIndex, message: rowErr.message || String(rowErr) });
      }
    }

    invalidateListCache();
    res.status(201).json({
      message: 'Import finished',
      created: results.length,
      failed: errors.length,
      results,
      errors,
    });
  } catch (error) {
    console.error('Employee import error:', error);
    res.status(500).json({ message: error.message || 'Import failed' });
  } finally {
    if (filePath) {
      try {
        fs.unlinkSync(filePath);
      } catch (_) {
        /* ignore */
      }
    }
  }
});

// Create new employee
router.post('/', authMiddleware, blockViewerWrites, uploadProfilePhoto.single('profilePhoto'), async (req, res) => {
  try {
    console.log("Incoming employee body:", req.body);
    console.log("Incoming employee file:", req.file);

    let employeeData = {};
    if (req.body && req.body.data) {
      try {
        employeeData = JSON.parse(req.body.data);
      } catch (parseErr) {
        console.error('JSON parse error in POST /:', parseErr);
        return res.status(400).json({ message: 'Invalid JSON data' });
      }
    } else {
      employeeData = req.body || {};
    }

    if (req.file) {
      employeeData.profilePhoto = `/uploads/employees/${req.file.filename}`;
    } else if (employeeData.profilePhoto) {
      // Convert any inline base64 image into a file path
      employeeData.profilePhoto = persistBase64ProfilePhoto(employeeData.profilePhoto, employeeData.employeeId);
    }

    // Defensive: strip any incoming id fields to avoid duplicate _id insertion
    delete employeeData._id;
    delete employeeData.id;
    delete employeeData.__v;

    if (employeeData.mobile !== undefined && employeeData.mobile !== null) {
      employeeData.mobile = String(employeeData.mobile).replace(/\D/g, '');
    }
    if (employeeData.emailId !== undefined && employeeData.emailId !== null) {
      const em = String(employeeData.emailId).trim();
      if (em) employeeData.emailId = em.toLowerCase();
      else delete employeeData.emailId;
    }

    ensureEmployeeEmailForDb(employeeData, `c${Date.now().toString(36)}`);

    if (!String(employeeData.companyCode || '').trim()) {
      employeeData.companyCode = '0000000172509';
    }
    if (!String(employeeData.office || '').trim()) {
      employeeData.office = 'JOINT VEN TRADING CO LLC';
    }

    const existingEmployee = await Employee.findOne({
      emailId: employeeData.emailId.toLowerCase().trim(),
    });

    if (existingEmployee) {
      return res.status(400).json({
        message: `Employee with email "${employeeData.emailId}" already exists`,
      });
    }

    // Check for duplicate employeeId (optional but good practice)
    if (employeeData.employeeId) {
      const existingEmployeeById = await Employee.findOne({
        employeeId: employeeData.employeeId
      });

      if (existingEmployeeById) {
        return res.status(400).json({
          message: `Employee with ID "${employeeData.employeeId}" already exists`
        });
      }
    }


    const employee = new Employee(employeeData);
    const savedEmployee = await employee.save();
    invalidateListCache();

    // Emit lightweight event so frontends can update lists in real-time
    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('employee-created', savedEmployee);
        if (savedEmployee.emailId) io.to(`email-${savedEmployee.emailId}`).emit('employee-created', savedEmployee);
        io.to('role-admin').emit('employee-created', savedEmployee);
      }
    } catch (emitErr) {
      console.warn('Failed to emit employee-created task:', emitErr);
    }

    try {
      const io = req.app.get('io');
      notifyEmployeeOnboarding(io, savedEmployee)
        .catch((e) => console.error('[Employee] Onboarding notification error:', e));
    } catch (notifErr) {
      console.warn('Failed to send onboarding notification:', notifErr);
    }

    res.status(201).json(savedEmployee);
  } catch (error) {
    console.error("Create employee error:", error);

    // Handle duplicate key error specifically
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const value = error.keyValue[field];
      return res.status(400).json({
        message: `Employee with ${field} "${value}" already exists`,
        error: `Duplicate ${field}`
      });
    }

    res.status(400).json({
      message: "Error creating employee",
      error: error.message,
    });
  }
});
// Update employee
router.put('/:id', authMiddleware, blockViewerWrites, uploadProfilePhoto.single('profilePhoto'), async (req, res) => {
  try {
    console.log('🔧 UPDATE EMPLOYEE - START');
    console.log('Employee ID:', req.params.id);
    console.log('Request body:', req.body);
    console.log('Request file:', req.file);

    let updateData = {};
    if (req.body && req.body.data) {
      try {
        updateData = JSON.parse(req.body.data);
        console.log('Parsed updateData:', updateData);
        console.log('assignedProjects:', updateData.assignedProjects);
        console.log('Type of assignedProjects:', typeof updateData.assignedProjects);

        // Ensure assignedProjects is an array
        if (updateData.assignedProjects && !Array.isArray(updateData.assignedProjects)) {
          console.error('assignedProjects is not an array:', updateData.assignedProjects);
          return res.status(400).json({
            message: 'assignedProjects must be an array'
          });
        }
      } catch (parseErr) {
        console.error('JSON parse error:', parseErr);
        return res.status(400).json({ message: 'Invalid JSON data' });
      }
    } else {
      updateData = req.body || {};
    }

    if (req.file) {
      updateData.profilePhoto = `/uploads/employees/${req.file.filename}`;
    } else if (updateData.profilePhoto) {
      // Convert any inline base64 image into a file path
      updateData.profilePhoto = persistBase64ProfilePhoto(updateData.profilePhoto, req.params.id);
    }

    if (Object.prototype.hasOwnProperty.call(updateData, 'mobile') && updateData.mobile != null) {
      updateData.mobile = String(updateData.mobile).replace(/\D/g, '');
    }
    if (Object.prototype.hasOwnProperty.call(updateData, 'emailId')) {
      const em = String(updateData.emailId || '').trim();
      if (em) {
        updateData.emailId = em.toLowerCase();
      } else {
        const cur = await Employee.findById(req.params.id).select('employeeId').lean();
        const t = { employeeId: cur?.employeeId || 'emp', emailId: '' };
        ensureEmployeeEmailForDb(t, `e${String(req.params.id).replace(/[^a-f0-9]/gi, '').slice(-12)}`);
        updateData.emailId = t.emailId;
      }
    }

    // Check for duplicate email (only if email is being updated to a non-empty value)
    if (updateData.emailId) {
      const existingEmployee = await Employee.findOne({
        emailId: updateData.emailId.toLowerCase().trim(),
        _id: { $ne: req.params.id }, // Exclude current employee
      });

      if (existingEmployee) {
        return res.status(400).json({
          message: `Another employee with email "${updateData.emailId}" already exists`,
        });
      }
    }


    // Normalize legacy vacationStatus value -> remap old label to new
    if (updateData.vacationStatus === 'Not on Vacation') {
      updateData.vacationStatus = 'Onsite';
    }

    if (Object.prototype.hasOwnProperty.call(updateData, 'companyCode')
      && !String(updateData.companyCode || '').trim()) {
      updateData.companyCode = '0000000172509';
    }

    // Use $set so nested salaryDetails / bank fields merge correctly on update
    const updatedEmployee = await Employee.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedEmployee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    invalidateListCache();
    console.log('✅ Employee updated successfully:', updatedEmployee._id);
    res.json({
      message: 'Employee updated successfully',
      employee: updatedEmployee
    });

  } catch (error) {
    console.error('❌ Error updating employee:', error);

    // Handle duplicate key error specifically
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const value = error.keyValue[field];
      return res.status(400).json({
        message: `Another employee with ${field} "${value}" already exists`,
        error: `Duplicate ${field}`
      });
    }

    const fs = require('fs');
    try { fs.appendFileSync('c:/ReactWorkSpace/Sonashi-HRMS/server/update_error.log', new Date().toISOString() + ' ERROR: ' + error.message + '\n' + JSON.stringify(error) + '\n'); } catch(e){}

    res.status(500).json({
      message: 'Error updating employee',
      error: error.message,
      details: error.toString()
    });
  }
});

// Bulk delete employees
router.post('/bulk-delete', authMiddleware, blockViewerWrites, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'No employee IDs provided' });
    }

    console.log(`Bulk deleting employees: ${ids.length} IDs provided`);

    // 1. Delete related EmployeeDocuments
    const EmployeeDocument = require('../models/EmployeeDocuments');
    const docResult = await EmployeeDocument.deleteMany({ employeeId: { $in: ids } });
    console.log(`Deleted ${docResult.deletedCount} related employee documents`);

    // 2. Delete Employees
    const result = await Employee.deleteMany({ _id: { $in: ids } });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'No employees found to delete' });
    }

    invalidateListCache();
    res.json({
      message: 'Employees and related data deleted successfully',
      deletedCount: result.deletedCount,
      deletedDocuments: docResult.deletedCount
    });
  } catch (error) {
    console.error('Error bulk deleting employees:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ====== PARAMETERIZED ROUTES (With :id or other parameters) ======


// Get employee by email
router.get('/by-email/:email', authMiddleware, async (req, res) => {
  try {
    const { email } = req.params;
    const employee = await Employee.findOne({ emailId: new RegExp(`^${email}$`, 'i') });
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    res.json(employee);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching employee', error: error.message });
  }
});


// ---- Employee Remarks (must be before /:id) ----
// Middleware: only admin or hod can add/view remarks
const requireAdminOrHod = (req, res, next) => {
  const role = req.user?.role;
  if (role === 'admin' || role === 'hod') return next();
  return res.status(403).json({ message: 'Only Admin or HOD can access remarks' });
};

// GET /api/employees/:id/remarks - fetch remarks for employee (latest first)
router.get('/:id/remarks', authMiddleware, requireAdminOrHod, async (req, res) => {
  try {
    const { id } = req.params;
    const remarks = await EmployeeRemark.find({ employeeId: id })
      .sort({ createdAt: -1 })
      .lean();
    res.json(remarks);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching remarks', error: error.message });
  }
});

// POST /api/employees/:id/remarks - add a remark (validation: text required)
router.post('/:id/remarks', authMiddleware, requireAdminOrHod, async (req, res) => {
  try {
    const { id } = req.params;
    const text = req.body?.text != null ? String(req.body.text).trim() : '';
    if (!text) {
      return res.status(400).json({ message: 'Remark text cannot be empty' });
    }
    const employee = await Employee.findById(id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    const remark = new EmployeeRemark({
      employeeId: id,
      text,
      createdBy: {
        userId: req.user._id,
        username: req.user.username || 'Unknown',
        role: req.user.role || ''
      }
    });
    await remark.save();
    res.status(201).json(remark);
  } catch (error) {
    res.status(500).json({ message: 'Error adding remark', error: error.message });
  }
});

// POST /api/employees/:id/increments - add an increment
router.post('/:id/increments', authMiddleware, requireAdminOrHod, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      date, 
      previousSalary, 
      incrementAmount, 
      newSalary, 
      basicSalaryIncrement, 
      houseRentIncrement, 
      travelExpIncrement, 
      otherIncrement, 
      reason 
    } = req.body;

    const employee = await Employee.findById(id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const newIncrement = {
      date: date || Date.now(),
      previousSalary: Number(previousSalary) || 0,
      incrementAmount: Number(incrementAmount) || 0,
      newSalary: Number(newSalary) || 0,
      basicSalaryIncrement: Number(basicSalaryIncrement) || 0,
      houseRentIncrement: Number(houseRentIncrement) || 0,
      travelExpIncrement: Number(travelExpIncrement) || 0,
      otherIncrement: Number(otherIncrement) || 0,
      reason: reason || ""
    };

    if (!employee.increments) {
      employee.increments = [];
    }
    
    employee.increments.push(newIncrement);

    // Update the main salary details to reflect the increments
    employee.salaryDetails.basicSalary = (employee.salaryDetails.basicSalary || 0) + Number(basicSalaryIncrement || 0);
    employee.salaryDetails.houseRent = (employee.salaryDetails.houseRent || 0) + Number(houseRentIncrement || 0);
    employee.salaryDetails.travelExp = (employee.salaryDetails.travelExp || 0) + Number(travelExpIncrement || 0);
    employee.salaryDetails.other = (employee.salaryDetails.other || 0) + Number(otherIncrement || 0);
    
    if (newSalary) {
      employee.salaryDetails.totalSalary = Number(newSalary);
    } else {
      employee.salaryDetails.totalSalary = (employee.salaryDetails.totalSalary || 0) + Number(incrementAmount || 0);
    }

    await employee.save();
    invalidateListCache();
    res.status(201).json(employee);
  } catch (error) {
    res.status(500).json({ message: 'Error adding increment', error: error.message });
  }
});

// PUT /api/employees/:id/increments/:incrementId - update an increment
router.put('/:id/increments/:incrementId', authMiddleware, requireAdminOrHod, async (req, res) => {
  try {
    const { id, incrementId } = req.params;
    const { 
      date, 
      previousSalary, 
      incrementAmount, 
      newSalary, 
      basicSalaryIncrement, 
      houseRentIncrement, 
      travelExpIncrement, 
      otherIncrement, 
      reason 
    } = req.body;

    const employee = await Employee.findById(id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const increment = employee.increments.id(incrementId);
    if (!increment) return res.status(404).json({ message: 'Increment not found' });

    // Calculate changes (difference between new values and old saved values)
    const diffBasic = (Number(basicSalaryIncrement) || 0) - (increment.basicSalaryIncrement || 0);
    const diffHouseRent = (Number(houseRentIncrement) || 0) - (increment.houseRentIncrement || 0);
    const diffTravelExp = (Number(travelExpIncrement) || 0) - (increment.travelExpIncrement || 0);
    const diffOther = (Number(otherIncrement) || 0) - (increment.otherIncrement || 0);
    const diffTotal = (Number(incrementAmount) || 0) - (increment.incrementAmount || 0);

    // Apply differences to salary details
    employee.salaryDetails.basicSalary = Math.max(0, (employee.salaryDetails.basicSalary || 0) + diffBasic);
    employee.salaryDetails.houseRent = Math.max(0, (employee.salaryDetails.houseRent || 0) + diffHouseRent);
    employee.salaryDetails.travelExp = Math.max(0, (employee.salaryDetails.travelExp || 0) + diffTravelExp);
    employee.salaryDetails.other = Math.max(0, (employee.salaryDetails.other || 0) + diffOther);
    employee.salaryDetails.totalSalary = Math.max(0, (employee.salaryDetails.totalSalary || 0) + diffTotal);

    if (date) increment.date = date;
    if (previousSalary !== undefined) increment.previousSalary = Number(previousSalary);
    if (incrementAmount !== undefined) increment.incrementAmount = Number(incrementAmount);
    if (newSalary !== undefined) increment.newSalary = Number(newSalary);
    
    if (basicSalaryIncrement !== undefined) increment.basicSalaryIncrement = Number(basicSalaryIncrement);
    if (houseRentIncrement !== undefined) increment.houseRentIncrement = Number(houseRentIncrement);
    if (travelExpIncrement !== undefined) increment.travelExpIncrement = Number(travelExpIncrement);
    if (otherIncrement !== undefined) increment.otherIncrement = Number(otherIncrement);
    
    if (reason !== undefined) increment.reason = reason;

    await employee.save();
    res.json(employee);
  } catch (error) {
    res.status(500).json({ message: 'Error updating increment', error: error.message });
  }
});

// DELETE /api/employees/:id/increments/:incrementId - delete an increment
router.delete('/:id/increments/:incrementId', authMiddleware, requireAdminOrHod, async (req, res) => {
  try {
    const { id, incrementId } = req.params;
    const employee = await Employee.findById(id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const increment = employee.increments.id(incrementId);
    if (increment) {
      // Revert the main salary details (subtracting the saved increment amounts)
      employee.salaryDetails.basicSalary = Math.max(0, (employee.salaryDetails.basicSalary || 0) - (increment.basicSalaryIncrement || 0));
      employee.salaryDetails.houseRent = Math.max(0, (employee.salaryDetails.houseRent || 0) - (increment.houseRentIncrement || 0));
      employee.salaryDetails.travelExp = Math.max(0, (employee.salaryDetails.travelExp || 0) - (increment.travelExpIncrement || 0));
      employee.salaryDetails.other = Math.max(0, (employee.salaryDetails.other || 0) - (increment.otherIncrement || 0));
      employee.salaryDetails.totalSalary = Math.max(0, (employee.salaryDetails.totalSalary || 0) - (increment.incrementAmount || 0));
    }

    employee.increments.pull({ _id: incrementId });
    await employee.save();
    res.json(employee);
  } catch (error) {
    res.status(500).json({ message: 'Error deleting increment', error: error.message });
  }
});

// Get single employee by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id).lean();
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    const codeMap = await getCompanyCodeMap();
    const [enriched] = applyLiveCompanyCodes([employee], codeMap);
    res.json(enriched);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching employee', error: error.message });
  }
});



// Delete single employee
router.delete('/:id', authMiddleware, blockViewerWrites, async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Delete related EmployeeDocuments
    const EmployeeDocument = require('../models/EmployeeDocuments');
    await EmployeeDocument.deleteMany({ employeeId: id });

    // 2. Delete Employee
    const result = await Employee.findByIdAndDelete(id);

    if (!result) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    invalidateListCache();
    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ message: 'Error deleting employee', error: error.message });
  }
});

// Remove project from employee
router.delete('/:id/projects', authMiddleware, blockViewerWrites, async (req, res) => {
  try {
    const { project } = req.body;

    if (!project) {
      return res.status(400).json({ message: 'Project name is required' });
    }

    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    employee.assignedProjects = employee.assignedProjects.filter(
      p => p !== project
    );

    await employee.save();

    res.json({
      message: 'Project removed successfully',
      employee
    });
  } catch (error) {
    res.status(500).json({ message: 'Error removing project', error: error.message });
  }
});

// Get employees by role
router.get('/role/:role', authMiddleware, async (req, res) => {
  try {
    const employees = await Employee.find({
      role: req.params.role
    }).sort({ employeeName: 1 });

    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching employees by role', error: error.message });
  }
});

// Search employees by name or ID
router.get('/search/:query', authMiddleware, async (req, res) => {
  try {
    const query = req.params.query;
    const employees = await Employee.find({
      $or: [
        { employeeName: { $regex: query, $options: 'i' } },
        { employeeId: { $regex: query, $options: 'i' } }
      ]
    }).sort({ employeeName: 1 });

    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: 'Error searching employees', error: error.message });
  }
});

// ====== NESTED PARAMETERIZED ROUTES (With multiple parameters) ======

// Add event to an employee
router.post('/:id/events', authMiddleware, blockViewerWrites, async (req, res) => {
  try {
    const { id } = req.params;
    const eventData = req.body || {};
    const assignedBy = req.user?.username || "Admin"; // logged-in user from token

    // Basic validation (don't allow empty events that will cause downstream issues)
    if (!eventData || !eventData.eventName) {
      return res.status(400).json({ message: "eventName is required" });
    }

    const employee = await Employee.findById(id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Add assignedBy inside event data and set timestamps
    const eventWithAssignedBy = {
      ...eventData,
      assignedBy,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    eventWithAssignedBy.reminders = normalizeReminderList(eventWithAssignedBy.reminders);

    // Push and save
    employee.events.push(eventWithAssignedBy);
    await employee.save();

    // Get the saved event (the last pushed)
    const savedEvent = employee.events[employee.events.length - 1];
    const savedEventSnapshot = typeof savedEvent.toObject === 'function'
      ? savedEvent.toObject({ depopulate: true })
      : JSON.parse(JSON.stringify(savedEvent));

    // Respond immediately with the persisted event and employee snapshot
    res.status(201).json({
      message: 'Task added successfully',
      event: savedEvent,
      employeeId: employee._id
    });

    // Background tasks: send emails, emit socket notifications, persist Notification
    (async () => {
      try {
        // Collect recipients (employee + team members)
        // Send emails in background
        await sendTaskEmailsInBackground(employee, eventWithAssignedBy, assignedBy);

        // Build a single notification payload with stable id
        const payload = {
          id: `employee-event-${employee._id}-${savedEvent._id}`,
          type: 'employee-event',
          title: `New Task for ${employee.employeeName || 'Employee'}`,
          body: `${eventWithAssignedBy.eventName} was added`,
          meta: { employeeId: employee._id, eventId: savedEvent._id, event: eventWithAssignedBy },
          url: `/teammanagement_salesleads/${employee._id}`,
          timestamp: new Date()
        };

        // Emit notification and entity event
        try {
          const io = req.app.get('io');
          if (io) {
            // Generic notification channel (bell/native notifications)
            io.emit('notification', payload);
            // Domain event with saved event so UI lists can append the actual object
            io.emit('employee-event', { ...payload, event: savedEvent });
            // targeted rooms
            io.to(`user-${employee._id}`).emit('notification', payload);
            io.to(`user-${employee._id}`).emit('employee-event', { ...payload, event: savedEvent });
            if (employee.emailId) {
              io.to(`email-${employee.emailId}`).emit('notification', payload);
              io.to(`email-${employee.emailId}`).emit('employee-event', { ...payload, event: savedEvent });
            }
          }
        } catch (emitErr) {
          console.error('Failed to emit socket notifications for employee event:', emitErr);
        }

        // Persist a Notification document for offline delivery (safe best-effort)
        try {
          await Notification.create({
            title: payload.title,
            body: payload.body,
            payload,
            email: employee.emailId || null
          });
        } catch (noteErr) {
          console.error('Failed to persist notification for employee task:', noteErr);
        }
      } catch (bgErr) {
        console.error('Background processing error for employee task:', bgErr);
      }
    })();

    // Schedule reminders for the assigned task/event
    if (savedEventSnapshot.reminders && savedEventSnapshot.reminders.length > 0) {
      const eventDateTime = deriveEventDateTime(savedEventSnapshot.date, savedEventSnapshot.time);

      savedEventSnapshot.reminders.forEach((reminderMinutes) => {
        if (!eventDateTime || isNaN(eventDateTime.getTime())) return;
        const reminderTime = new Date(eventDateTime.getTime() - reminderMinutes * 60000);
        const delay = reminderTime.getTime() - Date.now();
        if (delay <= 0) return;

        setTimeout(() => {
          const io = req.app.get('io');
          if (!io) return;

          const reminderPayload = {
            id: `task-reminder-${savedEventSnapshot._id}-${reminderMinutes}`,
            type: 'task-reminder',
            title: `Reminder: ${savedEventSnapshot.eventName || 'Task'}`,
            body: `Task in ${reminderMinutes} minutes`,
            meta: {
              employeeId: employee._id,
              eventId: savedEventSnapshot._id,
              event: savedEventSnapshot,
              reminderMinutes,
            },
            url: `/teammanagement_salesleads/${employee._id}`,
            timestamp: new Date(),
          };

          io.emit('task-reminder', reminderPayload);

          const recipientUserIds = new Set();
          if (req.user?.id) recipientUserIds.add(String(req.user.id));
          if (employee?._id) recipientUserIds.add(String(employee._id));
          (savedEventSnapshot.assignedTeamMembers || []).forEach((memberId) => {
            if (memberId) recipientUserIds.add(String(memberId));
          });

          recipientUserIds.forEach((userId) => {
            io.to(`user-${userId}`).emit('notification', reminderPayload);
            io.to(`user-${userId}`).emit('task-reminder', reminderPayload);
          });

          // Send reminder email
          sendTaskEmailsInBackground(employee, savedEventSnapshot, assignedBy, 'reminder')
            .catch(e => console.error("Error sending task reminder email:", e));
        }, delay);
      });
    }

  } catch (error) {
    console.error("Error adding event:", error);
    // Provide helpful error message while avoiding leaking internals
    res.status(400).json({ message: 'Error adding task', error: error.message });
  }
});

// Get all events for an employee
router.get('/:id/events', authMiddleware, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id).select('events');
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    res.json(employee.events);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching events', error: error.message });
  }
});

// Update an event
// Update an event
router.put('/:id/events/:eventId', authMiddleware, blockViewerWrites, async (req, res) => {
  try {
    const { id, eventId } = req.params;
    const updatedData = req.body;
    const assignedBy = req.user?.username || "Admin";

    const employee = await Employee.findById(id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Find event by ID
    const event = employee.events.id(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Update event details
    Object.assign(event, updatedData);
    event.updatedAt = new Date();

    await employee.save();

    // Send update notification emails in background
    sendTaskEmailsInBackground(employee, updatedData, assignedBy, 'updated')
      .catch(err => console.error("Email error:", err));

    // Browser notification + persist
    try {
      const io = req.app.get('io');
      if (io) {
        const payload = {
          id: `employee-event-update-${employee._id}-${Date.now()}`,
          type: 'employee-event-update',
          title: `Task updated for ${employee.employeeName || 'Employee'}`,
          body: `${updatedData.eventName || 'An event'} was updated`,
          meta: { employeeId: employee._id, eventId, event: updatedData },
          timestamp: new Date()
        };
        io.to(`user-${employee._id}`).emit('notification', payload);
        if (employee.emailId) io.to(`email-${employee.emailId}`).emit('notification', payload);

        // Targeted emit to assigned members
        if (Array.isArray(updatedData.assignedTeamMembers)) {
          updatedData.assignedTeamMembers.forEach(memberId => {
            io.to(`user-${memberId}`).emit('notification', payload);
          });
        }

        await Notification.create({
          title: payload.title,
          body: payload.body,
          payload,
          userId: null,
          email: employee.emailId || null
        });
      }
    } catch (notifyErr) {
      console.error('Error emitting/persisting notification for employee event update:', notifyErr);
    }

    // ? Reschedule Reminders (Add new setTimeouts)
    if (updatedData.reminders && updatedData.reminders.length > 0) {
      const deriveEventDateTime = (d, t) => {
        if (!d) return null;
        let dateStr = typeof d === 'string' ? d.split('T')[0] : d.toISOString().split('T')[0];
        if (t) return new Date(`${dateStr}T${t}:00`);
        return new Date(dateStr);
      };

      const eventDateTime = deriveEventDateTime(updatedData.date, updatedData.time);

      updatedData.reminders.forEach((reminderMinutes) => {
        if (!eventDateTime || isNaN(eventDateTime.getTime())) return;
        const reminderTime = new Date(eventDateTime.getTime() - reminderMinutes * 60000);
        const delay = reminderTime.getTime() - Date.now();

        if (delay > 0) {
          setTimeout(() => {
            const io = req.app.get('io');
            if (!io) return;

            const reminderPayload = {
              id: `task-reminder-${eventId}-${reminderMinutes}-${Date.now()}`,
              type: 'task-reminder',
              title: `Reminder: ${updatedData.eventName || 'Task'}`,
              body: `Task in ${reminderMinutes} minutes`,
              meta: {
                employeeId: employee._id,
                eventId: eventId,
                event: updatedData,
                reminderMinutes,
              },
              url: `/teammanagement_salesleads/${employee._id}`,
              timestamp: new Date(),
            };

            io.emit('task-reminder', reminderPayload);

            const recipientUserIds = new Set();
            if (req.user?.id) recipientUserIds.add(String(req.user.id));
            if (employee?._id) recipientUserIds.add(String(employee._id));
            (updatedData.assignedTeamMembers || []).forEach((memberId) => {
              if (memberId) recipientUserIds.add(String(memberId));
            });

            recipientUserIds.forEach((userId) => {
              io.to(`user-${userId}`).emit('notification', reminderPayload);
              io.to(`user-${userId}`).emit('task-reminder', reminderPayload);
            });

            // Send reminder email
            sendTaskEmailsInBackground(employee, updatedData, assignedBy, 'reminder')
              .catch(e => console.error("Error sending task reminder email:", e));

          }, delay);
        }
      });
    }

    res.json({
      message: 'Task updated and email(s) sent successfully',
      event,
    });
  } catch (error) {
    console.error("Error updating event:", error);
    res.status(500).json({ message: 'Error updating task', error: error.message });
  }
});

// Update meeting (with email notifications)
router.put('/:id', authMiddleware, blockViewerWrites, async (req, res) => {
  try {
    const update = req.body;
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

    // Store old meeting data for comparison
    const oldMeetingData = meeting.toObject();

    // Clear existing reminders before updating
    if (global.scheduledMeetingReminders && global.scheduledMeetingReminders[meeting._id]) {
      console.log(`?? Clearing existing reminders for meeting ${meeting._id}`);
      global.scheduledMeetingReminders[meeting._id].forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
      delete global.scheduledMeetingReminders[meeting._id];
    }

    Object.assign(meeting, {
      title: update.title ?? meeting.title,
      type: update.type ?? meeting.type,
      date: update.date ? new Date(update.date) : meeting.date,
      time: update.time ?? meeting.time,
      clientId: update.clientId ?? meeting.clientId,
      assignedTeamMembers: Array.isArray(update.assignedTeamMembers) ? update.assignedTeamMembers : meeting.assignedTeamMembers,
      notes: update.notes ?? meeting.notes,
      link: update.link ?? meeting.link,
      color: update.color ?? meeting.color,
      reminders: Array.isArray(update.reminders) ? update.reminders : meeting.reminders
    });

    const saved = await meeting.save();
    const assignedBy = req.user?.username || "Admin";

    res.json(saved);

    // Send email notifications in background
    sendMeetingEmailsInBackground(saved, 'updated', assignedBy)
      .then(() => console.log("Meeting update email process completed"))
      .catch(err => console.error("Meeting update email process failed:", err));

    // ? RESCHEDULE REMINDERS WITH NEW TIME
    if (saved.reminders && saved.reminders.length > 0) {
      const meetingDateTime = saved.time ?
        new Date(`${saved.date.toISOString().split('T')[0]}T${saved.time}:00`) :
        saved.date;

      // Initialize global tracking if not exists
      if (!global.scheduledMeetingReminders) {
        global.scheduledMeetingReminders = {};
      }
      global.scheduledMeetingReminders[saved._id] = [];

      saved.reminders.forEach(reminderMinutes => {
        const reminderTime = new Date(meetingDateTime.getTime() - reminderMinutes * 60000);
        const delay = reminderTime.getTime() - Date.now();

        if (delay > 0) {
          const timeoutId = setTimeout(() => {
            try {
              const io = req.app.get('io');
              if (io) {
                // Send reminder email
                sendMeetingReminderEmail(saved, reminderMinutes, assignedBy)
                  .then(() => console.log(`Meeting reminder email sent for ${reminderMinutes} minutes before`))
                  .catch(err => console.error('Meeting reminder email failed:', err));

                const reminderPayload = {
                  id: `meeting-reminder-${saved._id}-${reminderMinutes}`,
                  type: 'meeting-reminder',
                  title: `Reminder: ${saved.title}`,
                  body: `Meeting in ${reminderMinutes} minutes`,
                  meta: {
                    meetingId: saved._id,
                    meeting: saved,
                    reminderMinutes,
                    clientId: saved.clientId
                  },
                  url: `/meetings/${saved._id}`,
                  timestamp: new Date()
                };

                // Emit to all
                io.emit('meeting-reminder', reminderPayload);

                // Emit to assigned members and creator
                const recipients = [
                  ...(saved.assignedTeamMembers || []),
                  saved.createdBy
                ].filter((v, i, a) => a.indexOf(v) === i);

                recipients.forEach(userId => {
                  io.to(`user-${userId}`).emit('notification', reminderPayload);
                  io.to(`user-${userId}`).emit('meeting-reminder', reminderPayload);
                });
              }
            } catch (error) {
              console.error('Error in meeting reminder timeout:', error);
            }

            // Clean up after firing
            if (global.scheduledMeetingReminders && global.scheduledMeetingReminders[saved._id]) {
              const index = global.scheduledMeetingReminders[saved._id].indexOf(timeoutId);
              if (index > -1) {
                global.scheduledMeetingReminders[saved._id].splice(index, 1);
              }
            }
          }, delay);

          global.scheduledMeetingReminders[saved._id].push(timeoutId);
          console.log(`?? Scheduled reminder for meeting ${saved._id}: ${reminderMinutes} minutes before (delay: ${delay}ms)`);
        }
      });
    }

    // Socket notification for the update
    try {
      const io = req.app.get('io');
      const payload = {
        id: `meeting-updated-${saved._id}`,
        type: 'meeting-updated',
        title: `Meeting updated: ${saved.title}`,
        body: `${saved.title} updated`,
        meta: { meetingId: saved._id, meeting: saved },
        url: `/meetings/${saved._id}`,
        timestamp: new Date()
      };
      if (io) {
        io.emit('notification', payload);
        io.emit('meeting-updated', saved);
        if (saved.clientId) io.to(`client-${saved.clientId}`).emit('meeting-updated', payload);
        for (const memberId of saved.assignedTeamMembers || []) {
          io.to(`user-${memberId}`).emit('notification', payload);
          io.to(`user-${memberId}`).emit('meeting-updated', payload);
        }
      }
      await Notification.create({ title: payload.title, body: payload.body, payload, role: null, userId: null });
    } catch (emitErr) {
      console.error('Meeting update emit/persist error:', emitErr);
    }
  } catch (err) {
    console.error('Update meeting error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Delete an event
router.delete('/:id/events/:eventId', authMiddleware, blockViewerWrites, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    employee.events = employee.events.filter(e => e._id.toString() !== req.params.eventId);
    await employee.save();

    res.json({ message: 'Task deleted successfully', employee });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting task', error: error.message });
  }
});

/**
 * Mark / update staff return from vacation (early or extended).
 * Allowed: admin, hod, hr, authorize_user.
 * Updates leave end date, vacation status, return dates, and attendance.
 * Does not change leave approval workflow.
 */
router.post('/:id/vacation-return', authMiddleware, async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    const allowed = ['admin', 'hod', 'hr', 'authorize_user'];
    if (!allowed.includes(role)) {
      return res.status(403).json({
        message: 'You do not have permission to update vacation return dates.',
      });
    }

    const returnRaw = req.body?.returnDate;
    if (!returnRaw) {
      return res.status(400).json({ message: 'Return / Entry Date is required.' });
    }

    const returnDt = new Date(returnRaw);
    if (Number.isNaN(returnDt.getTime())) {
      return res.status(400).json({ message: 'Invalid return date.' });
    }
    returnDt.setHours(0, 0, 0, 0);

    let firstWork = req.body?.firstWorkingDay
      ? new Date(req.body.firstWorkingDay)
      : new Date(returnDt);
    if (Number.isNaN(firstWork.getTime())) firstWork = new Date(returnDt);
    firstWork.setHours(0, 0, 0, 0);

    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    let leave = null;
    const leaveId = req.body?.leaveId;
    if (leaveId && mongoose.Types.ObjectId.isValid(String(leaveId))) {
      leave = await LeaveRequest.findById(leaveId);
    }

    if (!leave) {
      const name = String(employee.employeeName || '').trim();
      const vacationTypes = ['Vacation', 'Annual Leave'];
      const candidates = await LeaveRequest.find({
        status: { $in: ['Approved', 'HOD Approved'] },
        leaveType: { $in: vacationTypes },
        ...(name ? { employeeName: name } : {}),
      })
        .sort({ startDate: -1 })
        .limit(20);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      leave =
        candidates.find((reqLeave) => {
          const start = reqLeave.startDate ? new Date(reqLeave.startDate) : null;
          const end = reqLeave.endDate ? new Date(reqLeave.endDate) : null;
          if (!start) return false;
          start.setHours(0, 0, 0, 0);
          if (end) end.setHours(0, 0, 0, 0);
          // Prefer leave covering return date or still open / recently ended
          if (start <= returnDt && (!end || end >= returnDt || end >= today)) return true;
          if (start <= today && (!end || end >= today)) return true;
          return false;
        }) || candidates[0] || null;
    }

    if (leave) {
      const actor = req.user?.username || req.user?.emailId || 'System';
      const plannedEnd = leave.endDate ? new Date(leave.endDate) : null;
      let remark = 'Vacation return date updated';
      if (plannedEnd && !Number.isNaN(plannedEnd.getTime())) {
        plannedEnd.setHours(0, 0, 0, 0);
        if (returnDt < plannedEnd) remark = 'Returned earlier than planned; leave end date updated';
        else if (returnDt > plannedEnd) remark = 'Vacation extended; leave end date updated';
      }

      leave.endDate = returnDt;
      leave.changeStatus = 'Modified';
      leave.changedBy = actor;
      leave.changedByUser = req.user._id || req.user.id || null;
      leave.changedOn = new Date();
      leave.changeRemarks = remark;
      if (Array.isArray(leave.statusChangeHistory)) {
        leave.statusChangeHistory.push({
          changeStatus: 'Modified',
          changedBy: actor,
          changedByUser: req.user._id || req.user.id || null,
          changedOn: new Date(),
          remarks: remark,
        });
      }
      await leave.save();
    }

    employee.vacationStatus = 'Vacation Approved';
    employee.returnDate = returnDt;
    employee.firstWorkingDay = firstWork;
    employee.attendance = 'Onsite';
    await employee.save();
    invalidateListCache();

    // Best-effort attendance Onsite for return day
    try {
      await Attendance.findOneAndUpdate(
        { employee: employee._id, date: returnDt },
        {
          $set: {
            employee: employee._id,
            date: returnDt,
            status: 'Onsite',
            updatedBy: req.user._id || req.user.id || null,
          },
        },
        { upsert: true, new: true }
      );
    } catch (attErr) {
      console.warn('[vacation-return] Attendance update skipped:', attErr.message);
    }

    res.json({
      message: 'Vacation return updated successfully',
      employee,
      leave,
    });
  } catch (error) {
    console.error('Error updating vacation return:', error);
    res.status(400).json({
      message: 'Error updating vacation return',
      error: error.message,
    });
  }
});

warmListCache();

module.exports = router;