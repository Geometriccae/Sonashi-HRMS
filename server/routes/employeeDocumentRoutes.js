// routes/documentRoutes.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Document = require("../models/EmployeeDocuments");

const router = express.Router();

// Configure multer for disk storage in the root uploads/employeeDocuments/<employeeId>/<docType> folder (outside server folder)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const employeeId = req.params.employeeId || "unknown";
    // Sanitize document type to use as safe folder name (e.g. "Passport Page 1" -> "Passport_Page_1")
    const rawType = (req.body && req.body.type) ? String(req.body.type).trim() : "Other";
    const docType = rawType.replace(/[^a-zA-Z0-9_\- ]/g, "").replace(/\s+/g, "_") || "Other";
    const uploadDir = path.join(__dirname, "../../uploads/employeedocuments", employeeId, docType);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// Get all documents for an employee
router.get("/:employeeId", async (req, res) => {
  try {
    const documents = await Document.find({ employeeId: req.params.employeeId })
      .lean();
      
    const normalized = documents.map((doc) => {
      const raw = String(doc.filePath || "");
      const fixed = raw.replace(
        /\/uploads\/employeedocuments\/employeedocuments\//g,
        "/uploads/employeedocuments/"
      );
      return { ...doc, filePath: fixed };
    });
    res.json(normalized);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve the document file bytes from MongoDB (for legacy files) or disk
router.get("/file/:docId", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.docId);
    if (!doc) {
      return res.status(404).send("File not found");
    }
    
    // Serve filesystem file
    if (doc.filePath) {
      let diskPath;
      if (doc.filePath.startsWith("/Uploades/") || doc.filePath.startsWith("/uploads/employeeDocuments/") || doc.filePath.startsWith("/uploads/employeedocuments/")) {
        diskPath = path.join(__dirname, "..", "..", doc.filePath);
      } else {
        diskPath = path.join(__dirname, "..", doc.filePath);
      }
      if (fs.existsSync(diskPath)) {
        res.set("Content-Type", doc.fileType || "application/octet-stream");
        res.set("Content-Disposition", `inline; filename="${doc.fileName}"`);
        return res.sendFile(diskPath);
      }
    }
    
    res.status(404).send("File data not available");
  } catch (err) {
    res.status(500).send("Server error");
  }
});

// Upload document for employee and save to disk
router.post("/:employeeId", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Build sanitized doc type folder name (matches what multer used for destination)
    const rawType = (req.body && req.body.type) ? String(req.body.type).trim() : "Other";
    const docType = rawType.replace(/[^a-zA-Z0-9_\- ]/g, "").replace(/\s+/g, "_") || "Other";

    const newDoc = new Document({
      employeeId: req.params.employeeId,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      filePath: `/uploads/employeedocuments/${req.params.employeeId}/${docType}/${req.file.filename}`,
      uploadedBy: req.body.uploadedBy,
      userRole: req.body.userRole,
      type: req.body.type || "Extra",
      uploadedDate: new Date(),
    });

    await newDoc.save();
    res.json(newDoc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete document
router.delete("/:docId", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.docId);
    if (doc && doc.filePath) {
      let diskPath;
      if (doc.filePath.startsWith("/Uploades/") || doc.filePath.startsWith("/uploads/employeeDocuments/") || doc.filePath.startsWith("/uploads/employeedocuments/")) {
        diskPath = path.join(__dirname, "..", "..", doc.filePath);
      } else {
        diskPath = path.join(__dirname, "..", doc.filePath);
      }
      if (fs.existsSync(diskPath)) {
        try {
          fs.unlinkSync(diskPath);
        } catch (unlinkErr) {
          console.warn("Failed to delete file from disk:", unlinkErr);
        }
      }
    }
    await Document.findByIdAndDelete(req.params.docId);
    res.json({ message: "Document deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete all documents for an employee
router.delete("/all/:employeeId", async (req, res) => {
  try {
    const docs = await Document.find({ employeeId: req.params.employeeId });
    for (const doc of docs) {
      if (doc.filePath) {
        let diskPath;
        if (doc.filePath.startsWith("/Uploades/") || doc.filePath.startsWith("/uploads/employeeDocuments/") || doc.filePath.startsWith("/uploads/employeedocuments/")) {
          diskPath = path.join(__dirname, "..", "..", doc.filePath);
        } else {
          diskPath = path.join(__dirname, "..", doc.filePath);
        }
        if (fs.existsSync(diskPath)) {
          try {
            fs.unlinkSync(diskPath);
          } catch (unlinkErr) {
            console.warn("Failed to delete file from disk:", unlinkErr);
          }
        }
      }
    }
    await Document.deleteMany({ employeeId: req.params.employeeId });
    res.json({ message: "All documents deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
