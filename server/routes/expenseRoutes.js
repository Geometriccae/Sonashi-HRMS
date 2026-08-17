const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const User = require('../models/User');
const SalarySlip = require('../models/SalarySlip');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { ensureUploadSubdir } = require('../utils/uploadsPath');

// Configure multer for file uploads (outer Hostinger uploads)
const uploadDir = ensureUploadSubdir('expense-documents');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir)
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// Helper to get user data from JWT token
const getUserDataFromReq = (req) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded && decoded.id) {
                return {
                    userId: String(decoded.id),
                    emailId: decoded.emailId ? String(decoded.emailId).toLowerCase() : "",
                    role: decoded.role ? String(decoded.role).toLowerCase() : null
                };
            }
        }
        return null;
    } catch (e) {
        return null;
    }
};

// Middleware to check HOD or Admin role (allows HR for viewing)
const requireHODOrAdmin = async (req, res, next) => {
    try {
        const userData = getUserDataFromReq(req);
        if (!userData || !userData.userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const user = await User.findById(userData.userId).lean();
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        const role = String(user.role || '').toLowerCase();
        // Allow HR to access read routes
        if (role !== 'admin' && role !== 'hod' && role !== 'hr' && role !== 'viewer' && role !== 'authorize_user') {
            return res.status(403).json({ message: 'Administrative access required' });
        }

        req.user = user;
        next();
    } catch (e) {
        res.status(500).json({ message: 'Authentication error: ' + e.message });
    }
};

// Employee: Create expense request
router.post('/create', upload.single('document'), async (req, res) => {
    try {
        const userData = getUserDataFromReq(req);
        if (!userData) return res.status(401).json({ message: 'Unauthorized' });

        const { expenseTitle, expenseDescription, expenseAmount, expenseDate, expenseCategory } = req.body;
        
        let categories = [];
        if (expenseCategory) {
            categories = Array.isArray(expenseCategory) ? expenseCategory : [expenseCategory];
        }

        const expense = new Expense({
            employee: userData.userId,
            expenseTitle,
            expenseDescription,
            expenseAmount,
            expenseDate,
            expenseCategory: categories,
            documentPath: req.file ? `/uploads/expense-documents/${req.file.filename}` : null
        });

        await expense.save();
        res.status(201).json(expense);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Employee: Get my expenses
router.get('/my-expenses', async (req, res) => {
    try {
        const userData = getUserDataFromReq(req);
        if (!userData) return res.status(401).json({ message: 'Unauthorized' });

        const expenses = await Expense.find({ employee: userData.userId }).sort({ createdAt: -1 });
        res.json(expenses);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Admin/HOD/HR: Get all expenses (for management)
router.get('/all', async (req, res) => {
    try {
        const userData = getUserDataFromReq(req);
        if (!userData || !userData.userId) return res.status(401).json({ message: 'Unauthorized' });

        const user = await User.findById(userData.userId).lean();
        if (!user) return res.status(401).json({ message: 'User not found' });

        const role = String(user.role || '').toLowerCase();
        if (role !== 'admin' && role !== 'hod' && role !== 'hr' && role !== 'viewer' && role !== 'authorize_user') {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Enriched with employee data
        const expenses = await Expense.find()
            .populate('employee', 'employeeName emailId designation department')
            .sort({ createdAt: -1 });
        res.json(expenses);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// HOD: Approve/Reject expense
router.put('/hod-action/:id', requireHODOrAdmin, async (req, res) => {
    try {
        const { action } = req.body; // 'approve' or 'reject'
        const status = action === 'approve' ? 'HOD Approved' : 'Rejected';
        
        const expense = await Expense.findByIdAndUpdate(
            req.params.id,
            { 
                status,
                hodVerifiedBy: req.user._id,
                hodVerifiedAt: new Date()
            },
            { new: true }
        );

        if (!expense) return res.status(404).json({ message: 'Expense not found' });
        res.json(expense);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// HR/Admin: Final approval and add to salary
router.put('/hr-action/:id', requireHODOrAdmin, async (req, res) => {
    try {
        const role = String(req.user?.role || '').toLowerCase();
        if (role !== 'admin') {
            return res.status(403).json({ message: 'Only HR Admin can perform this action' });
        }

        const { action } = req.body; // 'approve' or 'reject'
        const status = action === 'approve' ? 'HR Approved' : 'Rejected';
        
        const expense = await Expense.findById(req.params.id);
        if (!expense) return res.status(404).json({ message: 'Expense not found' });

        expense.status = status;
        expense.hrVerifiedBy = req.user._id;
        expense.hrVerifiedAt = new Date();

        if (status === 'HR Approved') {
            // Find existing salary slip or instructions?
            // Usually, we just mark it as approved, and it gets picked up during salary generation.
            expense.isAddedToSalary = true;
        }

        await expense.save();
        res.json(expense);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Admin: Delete expense
router.delete('/:id', requireHODOrAdmin, async (req, res) => {
    try {
        const role = String(req.user?.role || '').toLowerCase();
        if (role !== 'admin') {
            return res.status(403).json({ message: 'Only Admin can delete expenses' });
        }

        await Expense.findByIdAndDelete(req.params.id);
        res.json({ message: 'Expense deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
