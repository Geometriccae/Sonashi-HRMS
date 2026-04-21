// routes/documentRoutes.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const Document = require("../models/EmployeeDocuments");

const router = express.Router();

// Configure multer for memory storage buffer
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Get all documents for an employee (excluding large fileData buffers)
router.get("/:employeeId", async (req, res) => {
  try {
    const documents = await Document.find({ employeeId: req.params.employeeId })
      .select("-fileData")
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

// Serve the document file bytes directly from MongoDB
router.get("/file/:docId", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.docId);
    if (!doc || !doc.fileData) {
      return res.status(404).send("File not found or no data available");
    }
    
    res.set("Content-Type", doc.fileType || "application/octet-stream");
    // Ensure inline display so images/pdfs open in browser
    res.set("Content-Disposition", `inline; filename="${doc.fileName}"`);
    res.send(doc.fileData);
  } catch (err) {
    res.status(500).send("Server error");
  }
});

// Upload document for employee to Database
router.post("/:employeeId", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    
    const newDoc = new Document({
      employeeId: req.params.employeeId,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      fileData: req.file.buffer, // Save buffer to DB
      uploadedBy: req.body.uploadedBy,
      userRole: req.body.userRole,
      type: req.body.type || "Extra",
      uploadedDate: new Date(),
    });
    
    // Set a virtual file path for frontend pointing to our new GET route
    newDoc.filePath = `/api/employeedocuments/file/${newDoc._id}`;
    
    await newDoc.save();
    
    // Strip fileData before responding so we don't send mega JSON
    const resDoc = newDoc.toObject();
    delete resDoc.fileData;
    res.json(resDoc);
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
