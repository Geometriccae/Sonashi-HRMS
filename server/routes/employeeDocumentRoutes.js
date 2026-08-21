const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Document = require("../models/EmployeeDocuments");
const { resolveUploadDiskPath, ensureUploadSubdir } = require("../utils/uploadsPath");

const router = express.Router();

const sanitizeDocType = (rawType) => {
  const cleaned = String(rawType || "Other")
    .trim()
    .replace(/[^a-zA-Z0-9_\- ]/g, "")
    .replace(/\s+/g, "_");
  return cleaned || "Other";
};

/** Disk folder: uploads/employeeDocuments/<employeeId>/<docType> (outer Hostinger root) */
const employeeDocsDir = (...parts) => ensureUploadSubdir("employeeDocuments", ...parts);

// Configure multer for disk storage in uploads/employeeDocuments/<employeeId>/<docType>
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const employeeId = req.params.employeeId || "unknown";
    const docType = sanitizeDocType(req.body && req.body.type);
    cb(null, employeeDocsDir(employeeId, docType));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });
const memUpload = multer({ storage: multer.memoryStorage() });

const normalizeDoc = (doc) => {
  const raw = String(doc.filePath || "");
  const fixed = raw
    .replace(
      /\/uploads\/employeedocuments\/employeedocuments\//gi,
      "/uploads/employeeDocuments/"
    )
    .replace(
      /\/uploads\/employeeDocuments\/employeeDocuments\//gi,
      "/uploads/employeeDocuments/"
    )
    .replace(/\/uploads\/employeedocuments\//gi, "/uploads/employeeDocuments/");
  return { ...doc, filePath: fixed };
};

// IMPORTANT: /file/:docId must be registered BEFORE /:employeeId
// otherwise "file" is treated as an employeeId.
router.get("/file/:docId", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.docId);
    if (!doc) {
      return res.status(404).send("File not found");
    }

    if (doc.filePath) {
      const diskPath = resolveUploadDiskPath(doc.filePath);
      if (diskPath) {
        res.set("Content-Type", doc.fileType || "application/octet-stream");
        res.set(
          "Content-Disposition",
          `inline; filename="${String(doc.fileName || "document").replace(/"/g, "")}"`
        );
        return res.sendFile(path.resolve(diskPath));
      }
    }

    return res.status(404).send(
      "File missing on server disk. The document record exists, but the file was not found under uploads/. Please re-upload this document (and keep the uploads folder when redeploying)."
    );
  } catch (err) {
    console.error("[EmployeeDocuments] file serve error:", err);
    res.status(500).send("Server error");
  }
});

// Get all documents for an employee
router.get("/:employeeId", async (req, res) => {
  try {
    if (req.params.employeeId === "file") {
      return res.status(400).json({ error: "Invalid employee id" });
    }
    const documents = await Document.find({ employeeId: req.params.employeeId }).lean();
    res.json(documents.map(normalizeDoc));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload document for employee and save to disk
router.post("/:employeeId", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const docType = sanitizeDocType(req.body && req.body.type);

    const newDoc = new Document({
      employeeId: req.params.employeeId,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      filePath: `/uploads/employeeDocuments/${req.params.employeeId}/${docType}/${req.file.filename}`,
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

// Replace document file (re-upload)
router.put("/:docId", memUpload.single("file"), async (req, res) => {
  try {
    const doc = await Document.findById(req.params.docId);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    if (doc.filePath) {
      const oldDiskPath = resolveUploadDiskPath(doc.filePath);
      if (oldDiskPath) {
        try {
          fs.unlinkSync(oldDiskPath);
        } catch (e) {
          console.warn("Could not delete old file:", e.message);
        }
      }
    }

    const rawType = (req.body && req.body.type ? String(req.body.type).trim() : "") || doc.type || "Other";
    const docType = sanitizeDocType(rawType);
    const employeeId = String(doc.employeeId);

    const newFilename = Date.now() + "-" + req.file.originalname;
    const uploadDir = employeeDocsDir(employeeId, docType);
    fs.writeFileSync(path.join(uploadDir, newFilename), req.file.buffer);

    const newFilePath = `/uploads/employeeDocuments/${employeeId}/${docType}/${newFilename}`;

    const updated = await Document.findByIdAndUpdate(
      req.params.docId,
      {
        $set: {
          fileName: req.file.originalname,
          fileType: req.file.mimetype,
          fileSize: req.file.size,
          filePath: newFilePath,
          type: rawType,
          uploadedDate: new Date(),
        },
      },
      { new: true }
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update document type only
router.patch("/:docId/type", async (req, res) => {
  try {
    const rawType = req.body && req.body.type ? String(req.body.type).trim() : "";
    if (!rawType) return res.status(400).json({ error: "Document type is required" });

    const doc = await Document.findById(req.params.docId);
    if (!doc) return res.status(404).json({ error: "Document not found" });

    const updated = await Document.findByIdAndUpdate(
      req.params.docId,
      { $set: { type: rawType } },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete document
router.delete("/:docId", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.docId);
    if (doc && doc.filePath) {
      const diskPath = resolveUploadDiskPath(doc.filePath);
      if (diskPath) {
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
        const diskPath = resolveUploadDiskPath(doc.filePath);
        if (diskPath) {
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
