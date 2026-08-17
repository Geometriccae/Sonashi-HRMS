const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const xlsx = require('xlsx');
const SalarySlip = require('../models/SalarySlip');
const User = require('../models/User');
const Employee = require('../models/Employee');
const jwt = require("jsonwebtoken");
const mongoose = require('mongoose');
const { workingStatusFilter } = require('../utils/employeeStatus');
const { ensureUploadSubdir } = require('../utils/uploadsPath');

// One-time cleanup to remove stale database indexes that cause import failures
SalarySlip.on('index', (err) => {
    if (err) console.error('SalarySlip Index Error:', err);
});

// Helper to remove the stale legacy index if it exists in the user's DB
const cleanupLegacyIndex = async () => {
    try {
        const collection = mongoose.connection.db.collection('salaryslips');
        const indexes = await collection.indexes();
        if (indexes.some(idx => idx.name === 'employeeId_1_month_1_year_1')) {
            await collection.dropIndex('employeeId_1_month_1_year_1');
            console.log('Successfully dropped stale legacy index: employeeId_1_month_1_year_1');
        }
    } catch (e) {
        // Index might not exist or connection not ready yet, which is fine
    }
};

// Monitor connection to perform cleanup
mongoose.connection.on('open', cleanupLegacyIndex);

// Enhanced helper to get user data from request
function getUserDataFromReq(req) {
    const defaultData = { userId: null, emailId: null };
    if (!req) return defaultData;

    try {
        const authHeader = req.headers && req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            if (token === 'null' || token === 'undefined') {
                console.log('getUserDataFromReq - Token is null or undefined');
                return defaultData;
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded && decoded.id) {
                return {
                    userId: String(decoded.id),
                    emailId: decoded.emailId ? String(decoded.emailId).toLowerCase() : "",
                    role: decoded.role ? String(decoded.role).toLowerCase() : null
                };
            }
        } else {
            console.log('getUserDataFromReq - No valid Authorization header found');
        }
    } catch (e) {
        console.log('getUserDataFromReq - Token verification failed:', e.message);
    }

    const body = req.body || {};
    const query = req.query || {};
    const userId = body.userId || query.userId || null;
    const emailId = body.emailId || query.emailId || null;

    return {
        userId: userId ? String(userId) : null,
        emailId: emailId ? String(emailId).toLowerCase() : null
    };
}

// Middleware to check admin role
const requireAdmin = async (req, res, next) => {
    try {
        const userData = getUserDataFromReq(req);
        console.log('requireAdmin - userData:', userData);

        if (!userData || !userData.userId) {
            console.log('requireAdmin - No userId found, returning 401');
            return res.status(401).json({ message: 'Unauthorized - No valid token provided' });
        }

        const user = await User.findById(userData.userId).lean();

        let userRole = '';
        if (user) {
            userRole = String(user.role || '').toLowerCase();
        } else if (userData.role) {
            // Fallback to token role if DB lookup fails but token is valid
            userRole = userData.role;
        }

        if (userRole !== 'admin' && userRole !== 'hod' && userRole !== 'hr') {
            console.log('requireAdmin - Access denied for role:', userRole);
            return res.status(403).json({ message: 'Administrative access required' });
        }

        if (user) req.user = user;
        else req.user = { _id: userData.userId, role: userRole }; // Minimal user object for read routes
        next();
    } catch (e) {
        console.error('requireAdmin - Error:', e.message);
        res.status(500).json({ message: "Authentication internal error: " + e.message });
    }
};

// Multer setup — outer Hostinger uploads root
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ensureUploadSubdir()),
    filename: (req, file, cb) => cb(null, `salary-import-${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage });

// Middleware to check strictly admin or HOD role (no HR)
const requireStrictAdmin = async (req, res, next) => {
    try {
        const userData = getUserDataFromReq(req);
        if (!userData || !userData.userId) return res.status(401).json({ message: 'Unauthorized' });

        const user = await User.findById(userData.userId).lean();

        let userRole = '';
        if (user) {
            userRole = String(user.role || '').toLowerCase();
        } else if (userData.role) {
            userRole = userData.role;
        }

        if (userRole !== 'admin' && userRole !== 'hod') {
            return res.status(403).json({ message: 'Admin or HOD access required for this action' });
        }

        if (user) req.user = user;
        else req.user = { _id: userData.userId, role: userRole };
        next();
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

// Manual Create
router.post('/create', requireStrictAdmin, async (req, res) => {
    try {
        const slipData = { ...req.body, uploadedBy: req.user._id };
        if (!slipData.emailId) return res.status(400).json({ message: 'Email ID is required' });

        const slip = await SalarySlip.findOneAndUpdate(
            { emailId: slipData.emailId.trim().toLowerCase(), month: slipData.month, year: slipData.year },
            { ...slipData, emailId: slipData.emailId.trim().toLowerCase() },
            { upsert: true, new: true }
        );
        res.status(201).json(slip);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// Admin: Auto-generate slips for all active employees
router.post('/generate-bulk', requireStrictAdmin, async (req, res) => {
    try {
        const { month, year } = req.body;
        if (!month || !year) {
            return res.status(400).json({ message: 'Month and Year are required' });
        }

        // Fetch all working employees with salaryDetails
        const employees = await Employee.find(workingStatusFilter()).lean();
        
        const results = [];
        const skipped = [];
        const errors = [];

        for (const emp of employees) {
            try {
                if (!emp.emailId) {
                    skipped.push({ name: emp.employeeName, reason: "No email ID" });
                    continue;
                }

                const email = emp.emailId.trim().toLowerCase();
                
                // Prepare slip data from this employee's salaryDetails only (no invented defaults).
                // Keep 0 as 0 — do not treat empty rent as basic/2.
                const salary = emp.salaryDetails || {};
                const toAmt = (v) => {
                    const n = parseFloat(v);
                    return Number.isFinite(n) ? n : 0;
                };
                const basic = toAmt(salary.basicSalary);
                const houseRent = toAmt(salary.houseRent);
                const travelExp = toAmt(salary.travelExp);
                const other = toAmt(salary.other);
                const deduction = toAmt(salary.deduction);

                const grossSalary = basic + houseRent + travelExp + other;
                const netSalary = grossSalary - deduction;

                const slipData = {
                    employeeName: emp.employeeName,
                    emailId: email,
                    department: emp.department || '',
                    designation: emp.designation || emp.role || 'Employee',
                    month: month,
                    year: year,
                    basicPay: basic,
                    hra: houseRent,
                    conveyanceAllowance: travelExp,
                    otherAllowance: other,
                    grossSalary: grossSalary,
                    totalDeduction: deduction,
                    deductionsPFTax: deduction,
                    netSalary: netSalary,
                    uploadedBy: req.user._id
                };

                // Use findOneAndUpdate with upsert: true to overwrite/update existing slips
                await SalarySlip.findOneAndUpdate(
                    { emailId: email, month: { $regex: new RegExp(`^${month}$`, 'i') }, year: year },
                    { $set: slipData },
                    { upsert: true, new: true }
                );
                
                results.push(email);
            } catch (err) {
                errors.push({ name: emp.employeeName, error: err.message });
            }
        }

        res.json({
            message: `Successfully generated/updated ${results.length} salary slips.`,
            count: results.length,
            results,
            skipped,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// Admin: Bulk Import Salary Slips
router.post('/import', requireStrictAdmin, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet, { header: 0, defval: '' });

        const monthValue = String(req.body.month || '').trim();
        const yearValue = String(req.body.year || '').trim();

        if (!monthValue || !yearValue) return res.status(400).json({ message: 'Month and Year are required' });

        const results = [];
        const errors = [];

        // Exact match mapping based on user error logs
        const fieldMappings = {
            employeeName: ['Employee Name', 'Name', 'FullName', 'EmployeeName'],
            emailId: ['Employee Email ID', 'Email ID', 'Email', 'User Email', 'EmailId', 'Mail', 'id'],
            designation: ['Designation', 'Project Manager', 'Designation Name', 'DesignationName'],
            basicPay: ['Basic Pay (₹)', 'Basic Pay', 'Basic Salary', 'BasicPay', 'Basic'],
            hra: ['HRA (₹)', 'HRA', 'House Rent Allowance', 'HRA Amount'],
            deductionsPFTax: ['Deductions (₹)', 'Deductions', 'Deduction', 'PF / Tax', 'PF', 'Tax', 'PF/Tax'],
            netSalary: ['Net Salary (₹)', 'Net Salary', 'Total Salary', 'Total Payable', 'NetSalary']
        };

        const parseNum = (val) => {
            if (typeof val === 'number') return val;
            if (!val) return 0;
            const cleaned = String(val).replace(/[^0-9.-]/g, '');
            const parsed = parseFloat(cleaned);
            return isNaN(parsed) ? 0 : parsed;
        };

        for (const row of data) {
            try {
                if (!row) continue;
                const rowKeys = Object.keys(row);

                const getRowVal = (possibleKeys) => {
                    const foundKey = rowKeys.find(k => {
                        const cleanK = String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
                        return possibleKeys.some(pk => {
                            const cleanPk = pk.toLowerCase().replace(/[^a-z0-9]/g, '');
                            return cleanK === cleanPk || cleanK.includes(cleanPk);
                        });
                    });
                    return foundKey ? row[foundKey] : undefined;
                };

                const rawEmail = getRowVal(fieldMappings.emailId);
                if (!rawEmail && !getRowVal(fieldMappings.employeeName)) continue;
                if (!rawEmail) {
                    errors.push({ row, error: "Email ID not found in row" });
                    continue;
                }

                const slipData = {
                    employeeName: String(getRowVal(fieldMappings.employeeName) || 'Unknown').trim(),
                    emailId: String(rawEmail).trim().toLowerCase(),
                    designation: String(getRowVal(fieldMappings.designation) || 'N/A').trim(),
                    month: monthValue,
                    year: yearValue,
                    basicPay: parseNum(getRowVal(fieldMappings.basicPay)),
                    hra: parseNum(getRowVal(fieldMappings.hra)),
                    deductionsPFTax: parseNum(getRowVal(fieldMappings.deductionsPFTax)),
                    netSalary: parseNum(getRowVal(fieldMappings.netSalary)),
                    uploadedBy: req.user._id
                };

                // Try to find employee to get department
                const employeeRecord = await Employee.findOne({ emailId: slipData.emailId }).lean();
                if (employeeRecord) {
                    slipData.department = employeeRecord.department || '';
                }

                // Clear any legacy keys that might trigger stale unique indexes
                await SalarySlip.findOneAndUpdate(
                    { emailId: slipData.emailId, month: { $regex: new RegExp(`^${slipData.month}$`, 'i') }, year: slipData.year },
                    { $set: slipData, $unset: { employeeId: "" } }, // Unset legacy key to avoid null collisions
                    { upsert: true, new: true, runValidators: true }
                );

                results.push(slipData.emailId);
            } catch (err) {
                errors.push({ row, error: err.message });
            }
        }

        res.json({
            message: `Successfully processed ${results.length} salary slips.`,
            count: results.length,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});


// Admin/HR: Get all
router.get('/all', async (req, res) => {
    try {
        const userData = getUserDataFromReq(req);
        if (!userData || !userData.userId) return res.status(401).json({ message: 'Unauthorized' });

        const user = await User.findById(userData.userId).lean();
        if (!user) return res.status(401).json({ message: 'User not found' });

        const role = String(user.role || '').toLowerCase();
        // Only allow Administrative roles + HR
        if (role !== 'admin' && role !== 'hod' && role !== 'hr' && role !== 'viewer' && role !== 'authorize_user') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const { month, year } = req.query;
        const filter = {};
        if (month && month !== 'All' && month !== '') filter.month = { $regex: new RegExp(`^${String(month).trim()}$`, 'i') };
        if (year && year !== 'All' && year !== '') filter.year = String(year).trim();
        const slips = await SalarySlip.find(filter).sort({ createdAt: -1 });
        res.json(slips);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// Employee: Get mine
router.get('/my-slips', async (req, res) => {
    try {
        const userData = getUserDataFromReq(req);
        if (!userData || (!userData.userId && !userData.emailId)) return res.status(401).json({ message: 'Unauthorized' });
        let userEmail = userData.emailId;
        if (!userEmail && userData.userId) {
            const user = await User.findById(userData.userId);
            if (user) userEmail = user.emailId;
        }
        if (!userEmail) return res.status(400).json({ message: 'No linked email found' });

        const slips = await SalarySlip.find({ emailId: String(userEmail).trim().toLowerCase() }).sort({ year: -1, month: -1 });
        res.json(slips);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// Bulk Delete
router.post('/bulk-delete', requireStrictAdmin, async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'No IDs provided' });
        }

        await SalarySlip.deleteMany({ _id: { $in: ids } });
        res.json({ message: `Successfully deleted ${ids.length} salary slips` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update salary slip
router.put('/:id', requireStrictAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = { ...req.body };

        // Normalize email if provided
        if (updateData.emailId) {
            updateData.emailId = String(updateData.emailId).trim().toLowerCase();
        }

        const updatedSlip = await SalarySlip.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!updatedSlip) {
            return res.status(404).json({ message: 'Salary slip not found' });
        }

        res.json(updatedSlip);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Delete
router.delete('/:id', requireStrictAdmin, async (req, res) => {
    try {
        await SalarySlip.findByIdAndDelete(req.params.id);
        res.json({ message: 'Salary slip deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
