const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const SalaryAdvance = require('../models/SalaryAdvance');
const Employee = require('../models/Employee');
const authMiddleware = require('../middleware/authMiddleware');

// ──────────────────────────────────────────────
// Role guard: admin, hod, hr (same as salary slips)
// ──────────────────────────────────────────────
const requireAdmin = (req, res, next) => {
  const role = String(req.user?.role || '').toLowerCase();
  if (['admin', 'hod', 'hr'].includes(role)) return next();
  return res.status(403).json({ message: 'Access denied.' });
};

const toNum = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const roundAed = (v) => Math.round(toNum(v) * 100) / 100;

// ──────────────────────────────────────────────
// POST /api/salary-advances
// Create one or more advances in a single call.
// Body: { advances: [{ employeeId, amount, advanceDate, remarks }] }
// ──────────────────────────────────────────────
router.post('/', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const items = Array.isArray(req.body.advances) ? req.body.advances : [req.body];

    if (!items.length) {
      return res.status(400).json({ message: 'No advance data provided.' });
    }

    const created = [];
    const errors = [];

    for (const item of items) {
      try {
        const amount = roundAed(item.amount ?? item.originalAmount);
        if (!amount || amount <= 0) {
          errors.push({ employeeId: item.employeeId, error: 'Amount must be a positive number.' });
          continue;
        }

        if (!item.employeeId) {
          errors.push({ error: 'employeeId is required for each entry.' });
          continue;
        }

        // Resolve employee
        const isObjectId = mongoose.Types.ObjectId.isValid(item.employeeId);
        const emp = isObjectId
          ? await Employee.findById(item.employeeId).lean()
          : await Employee.findOne({
              $or: [
                { employeeId: item.employeeId },
                { emailId: item.employeeId },
              ],
            }).lean();

        if (!emp) {
          errors.push({ employeeId: item.employeeId, error: 'Employee not found.' });
          continue;
        }

        const advanceDate = item.advanceDate ? new Date(item.advanceDate) : new Date();
        if (isNaN(advanceDate.getTime())) {
          errors.push({ employeeId: item.employeeId, error: 'Invalid advanceDate.' });
          continue;
        }

        const advance = await SalaryAdvance.create({
          employee: emp._id,
          employeeId: emp.employeeId || '',
          employeeEmail: String(emp.emailId || '').trim().toLowerCase(),
          employeeName: emp.employeeName || '',
          department: emp.department || '',
          designation: emp.designation || emp.role || '',
          company: emp.company || '',
          originalAmount: amount,
          advanceDate,
          remarks: item.remarks || '',
          recoveredAmount: 0,
          outstandingBalance: amount,
          status: 'active',
          createdBy: req.user._id,
        });

        created.push(advance);
      } catch (err) {
        errors.push({ employeeId: item.employeeId, error: err.message });
      }
    }

    return res.status(201).json({
      ok: true,
      created,
      errors,
      message: `${created.length} advance(s) created${errors.length ? `, ${errors.length} failed` : ''}.`,
    });
  } catch (err) {
    console.error('POST /salary-advances error:', err);
    return res.status(500).json({ message: err.message });
  }
});

// ──────────────────────────────────────────────
// GET /api/salary-advances
// List all advances with optional filters:
//   ?status=active|fully_recovered|cancelled
//   ?employeeId=<mongo _id | employee code>
// ──────────────────────────────────────────────
router.get('/', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.employeeId) {
      const isObjectId = mongoose.Types.ObjectId.isValid(req.query.employeeId);
      if (isObjectId) {
        filter.employee = req.query.employeeId;
      } else {
        filter.$or = [
          { employeeId: req.query.employeeId },
          { employeeEmail: req.query.employeeId.toLowerCase() },
        ];
      }
    }

    const advances = await SalaryAdvance.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return res.json(advances);
  } catch (err) {
    console.error('GET /salary-advances error:', err);
    return res.status(500).json({ message: err.message });
  }
});

// ──────────────────────────────────────────────
// GET /api/salary-advances/employee/:employeeId
// History for a specific employee.
// ──────────────────────────────────────────────
router.get('/employee/:employeeId', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const isObjectId = mongoose.Types.ObjectId.isValid(employeeId);

    const filter = isObjectId
      ? { employee: employeeId }
      : {
          $or: [
            { employeeId },
            { employeeEmail: employeeId.toLowerCase() },
          ],
        };

    const advances = await SalaryAdvance.find(filter).sort({ createdAt: -1 }).lean();
    return res.json(advances);
  } catch (err) {
    console.error('GET /salary-advances/employee/:id error:', err);
    return res.status(500).json({ message: err.message });
  }
});

// ──────────────────────────────────────────────
// GET /api/salary-advances/:id
// Single advance detail.
// ──────────────────────────────────────────────
router.get('/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const advance = await SalaryAdvance.findById(req.params.id).lean();
    if (!advance) return res.status(404).json({ message: 'Advance not found.' });
    return res.json(advance);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ──────────────────────────────────────────────
// PUT /api/salary-advances/:id
// Update remarks, advanceDate, or cancel an advance.
// Admin only (not hod/hr) for safety.
// ──────────────────────────────────────────────
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    if (role !== 'admin') {
      return res.status(403).json({ message: 'Only admin can update advances.' });
    }

    const advance = await SalaryAdvance.findById(req.params.id);
    if (!advance) return res.status(404).json({ message: 'Advance not found.' });

    const allowedUpdates = ['remarks', 'advanceDate', 'status'];
    for (const field of allowedUpdates) {
      if (req.body[field] !== undefined) {
        if (field === 'status' && !['active', 'fully_recovered', 'cancelled'].includes(req.body.status)) {
          return res.status(400).json({ message: 'Invalid status value.' });
        }
        advance[field] = req.body[field];
      }
    }

    await advance.save();
    return res.json(advance);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
