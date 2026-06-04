const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const CompanyDocument = require("../models/CompanyDocument");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

const uploadDir = path.join(__dirname, "../../uploads/companydocuments");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({ storage });

router.get("/", authMiddleware, async (_req, res) => {
  try {
    const documents = await CompanyDocument.find().sort({ createdAt: -1 }).lean();
    res.json(documents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", authMiddleware, upload.single("file"), async (req, res) => {
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

    const newDoc = new CompanyDocument({
      particulars,
      docNumber: req.body.docNumber ? String(req.body.docNumber).trim() : "",
      issueDate: issueDate && !Number.isNaN(issueDate.getTime()) ? issueDate : null,
      expiryDate: expiryDate && !Number.isNaN(expiryDate.getTime()) ? expiryDate : null,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      filePath: `/uploads/companydocuments/${req.file.filename}`,
      uploadedBy: req.body.uploadedBy || req.user?.username || "",
      userRole: req.body.userRole || req.user?.role || "",
    });

    await newDoc.save();
    res.status(201).json(newDoc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:docId", authMiddleware, async (req, res) => {
  try {
    const doc = await CompanyDocument.findById(req.params.docId);
    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (doc.filePath) {
      const diskPath = path.join(__dirname, "..", "..", doc.filePath);
      if (fs.existsSync(diskPath)) {
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
