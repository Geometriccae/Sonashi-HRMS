const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const CompanyDocument = require("../models/CompanyDocument");
const Employee = require("../models/Employee");
const CompanySifSettings = require("../models/CompanySifSettings");
const authMiddleware = require("../middleware/authMiddleware");
const { blockViewerWrites } = require("../middleware/permissionsMiddleware");
const { ensureUploadSubdir, resolveUploadDiskPath } = require("../utils/uploadsPath");
const {
  buildUploaderFields,
  resolveUploaderDisplay,
} = require("../utils/uploaderIdentity");

const router = express.Router();

const normalizeCompanyCode = (value) => String(value || "").trim().toUpperCase();
const normalizeEmployerId = (value) => String(value || "").replace(/\D/g, "");
const requireAdminOrHod = (req, res, next) => {
  const role = String(req.user?.role || "").toLowerCase();
  if (role === "admin" || role === "hod") return next();
  return res.status(403).json({ message: "Admin or HOD access required" });
};

const uploadDir = ensureUploadSubdir("companydocuments");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({ storage });

const normalizeDoc = (doc) => {
  const { uploadedBy, userRole } = resolveUploaderDisplay(doc);
  return { ...doc, uploadedBy, userRole };
};

router.get("/", authMiddleware, async (_req, res) => {
  try {
    const documents = await CompanyDocument.find()
      .populate("uploaderId", "username role")
      .sort({ createdAt: -1 })
      .lean();
    res.json(documents.map(normalizeDoc));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/companies", authMiddleware, async (_req, res) => {
  try {
    const companies = await CompanyDocument.find({ recordType: "company" })
      .select("particulars docNumber employerId createdAt updatedAt")
      .sort({ particulars: 1 })
      .lean();
    res.json(companies);
  } catch (err) {
    res.status(500).json({ message: "Failed to load companies" });
  }
});

router.post("/companies", authMiddleware, blockViewerWrites, requireAdminOrHod, async (req, res) => {
  try {
    const particulars = String(req.body.particulars || "").trim();
    const companyCode = normalizeCompanyCode(req.body.companyCode);
    const employerId = normalizeEmployerId(req.body.employerId);

    if (!particulars) return res.status(400).json({ message: "Company name is required" });
    if (!companyCode || !/^[A-Z0-9]+$/.test(companyCode)) {
      return res.status(400).json({ message: "Company Code must contain only letters and numbers" });
    }
    if (employerId && employerId.length !== 13) {
      return res.status(400).json({ message: "Employer ID must be exactly 13 digits" });
    }

    const duplicate = await CompanyDocument.findOne({
      recordType: "company",
      $or: [
        { docNumber: companyCode },
        { particulars: { $regex: `^${particulars.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } },
        ...(employerId ? [{ employerId }] : []),
      ],
    }).lean();
    if (duplicate) {
      return res.status(409).json({ message: "A company with this name, Company Code, or Employer ID already exists" });
    }

    const company = await CompanyDocument.create({
      particulars,
      docNumber: companyCode,
      employerId,
      recordType: "company",
      ...buildUploaderFields(req.user),
    });
    res.status(201).json(company);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "A company with this Company Code already exists" });
    }
    res.status(500).json({ message: err.message || "Failed to create company" });
  }
});

router.delete("/companies/:companyId", authMiddleware, blockViewerWrites, requireAdminOrHod, async (req, res) => {
  try {
    const company = await CompanyDocument.findOne({
      _id: req.params.companyId,
      recordType: "company",
    });
    if (!company) return res.status(404).json({ message: "Company not found" });

    const employeeCount = await Employee.countDocuments({
      $or: [{ companyCode: company.docNumber }, { office: company.particulars }],
    });
    if (employeeCount > 0) {
      return res.status(409).json({
        message: `Company is assigned to ${employeeCount} employee(s). Reassign them before deleting it.`,
      });
    }

    const employerId = normalizeEmployerId(company.employerId);
    if (employerId) {
      const sifDependency = await CompanySifSettings.exists({
        $or: [
          { employerId },
          { employerRoutingCodes: { $elemMatch: { employerId } } },
        ],
      });
      if (sifDependency) {
        return res.status(409).json({
          message: "Company is referenced by Company SIF Settings. Remove that dependency before deleting it.",
        });
      }
    }

    await CompanyDocument.deleteOne({ _id: company._id });
    res.json({ message: "Company deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to delete company" });
  }
});

router.post("/", authMiddleware, blockViewerWrites, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const particulars = req.body.particulars ? String(req.body.particulars).trim() : "";
    if (!particulars) {
      return res.status(400).json({ error: "Particulars is required" });
    }

    const issueDate = req.body.issueDate ? new Date(req.body.issueDate) : null;
    const expiryDate = req.body.expiryDate ? new Date(req.body.expiryDate) : null;
    const uploader = buildUploaderFields(req.user);

    const newDoc = new CompanyDocument({
      particulars,
      docNumber: req.body.docNumber ? String(req.body.docNumber).trim() : "",
      issueDate: issueDate && !Number.isNaN(issueDate.getTime()) ? issueDate : null,
      expiryDate: expiryDate && !Number.isNaN(expiryDate.getTime()) ? expiryDate : null,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      filePath: `/uploads/companydocuments/${req.file.filename}`,
      uploaderId: uploader.uploaderId,
      uploadedBy: uploader.uploadedBy,
      userRole: uploader.userRole,
    });

    await newDoc.save();
    const plain = typeof newDoc.toObject === "function" ? newDoc.toObject() : newDoc;
    res.status(201).json(normalizeDoc({
      ...plain,
      uploaderId: {
        _id: uploader.uploaderId,
        username: uploader.uploadedBy,
        role: req.user.role,
      },
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:docId", authMiddleware, blockViewerWrites, upload.single("file"), async (req, res) => {
  try {
    const doc = await CompanyDocument.findById(req.params.docId);
    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }
    if (doc.recordType === "company") {
      return res.status(409).json({
        message: "Manage company records from the Employee Details Company dropdown.",
      });
    }

    const particulars = req.body.particulars ? String(req.body.particulars).trim() : "";
    if (!particulars) {
      return res.status(400).json({ error: "Particulars is required" });
    }

    const issueDate = req.body.issueDate ? new Date(req.body.issueDate) : null;
    const expiryDate = req.body.expiryDate ? new Date(req.body.expiryDate) : null;

    doc.particulars = particulars;
    doc.docNumber = req.body.docNumber ? String(req.body.docNumber).trim() : "";
    doc.issueDate = issueDate && !Number.isNaN(issueDate.getTime()) ? issueDate : null;
    doc.expiryDate = expiryDate && !Number.isNaN(expiryDate.getTime()) ? expiryDate : null;

    if (req.file) {
      if (doc.filePath) {
        const oldDiskPath = resolveUploadDiskPath(doc.filePath);
        if (oldDiskPath) {
          try {
            fs.unlinkSync(oldDiskPath);
          } catch (unlinkErr) {
            console.warn("Failed to delete old file from disk:", unlinkErr);
          }
        }
      }

      doc.fileName = req.file.originalname;
      doc.fileType = req.file.mimetype;
      doc.fileSize = req.file.size;
      doc.filePath = `/uploads/companydocuments/${req.file.filename}`;
    }

    await doc.save();
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:docId", authMiddleware, blockViewerWrites, async (req, res) => {
  try {
    const doc = await CompanyDocument.findById(req.params.docId);
    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }
    if (doc.recordType === "company") {
      return res.status(409).json({
        message: "Manage company records from the Employee Details Company dropdown.",
      });
    }

    if (doc.filePath) {
      const diskPath = resolveUploadDiskPath(doc.filePath);
      if (diskPath) {
        try {
          fs.unlinkSync(diskPath);
        } catch (unlinkErr) {
          console.warn("Failed to delete file from disk:", unlinkErr);
        }
      }
    }

    await CompanyDocument.findByIdAndDelete(req.params.docId);
    res.json({ message: "Document deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
