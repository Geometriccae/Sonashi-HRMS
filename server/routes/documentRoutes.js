// routes/documentRoutes.js — client (Sales & Leads) documents
const express = require("express");
const multer = require("multer");
const path = require("path");
const Document = require("../models/Documents");
const authMiddleware = require("../middleware/authMiddleware");
const { ensureUploadSubdir } = require("../utils/uploadsPath");
const {
  buildUploaderFields,
  resolveUploaderDisplay,
} = require("../utils/uploaderIdentity");

const router = express.Router();

// Configure multer for file uploads to outer Hostinger uploads/clientdocuments
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ensureUploadSubdir("clientdocuments")),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

const normalizeDoc = (doc) => {
  const { uploadedBy, userRole } = resolveUploaderDisplay(doc);
  return { ...doc, uploadedBy, userRole };
};

// Get all documents for a client
router.get("/:clientId", async (req, res) => {
  try {
    const documents = await Document.find({ clientId: req.params.clientId })
      .populate("uploaderId", "username role")
      .lean();
    res.json(documents.map(normalizeDoc));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload document for client — uploader always from authenticated session
router.post("/:clientId", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const uploader = buildUploaderFields(req.user);
    const newDoc = new Document({
      clientId: req.params.clientId,
      fileName: req.file.originalname,
      filePath: `/uploads/clientdocuments/${path.basename(req.file.destination) === 'uploads' ? '' : path.basename(req.file.destination) + '/'}${req.file.filename}`.replace('//','/'),
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      uploaderId: uploader.uploaderId,
      uploadedBy: uploader.uploadedBy,
      userRole: uploader.userRole,
      type: req.body.type || "Extra",
      uploadedDate: new Date(),
    });
    await newDoc.save();
    const plain = typeof newDoc.toObject === "function" ? newDoc.toObject() : newDoc;
    res.json(normalizeDoc({
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

// Delete document
router.delete("/:docId", async (req, res) => {
  try {
    await Document.findByIdAndDelete(req.params.docId);
    res.json({ message: "Document deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
