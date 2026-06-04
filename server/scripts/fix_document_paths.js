// ====== DNS RESOLVER WORKAROUND FOR WINDOWS / SRV ISSUES ======
const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
  console.log('👉 DNS servers set to 8.8.8.8, 1.1.1.1 for Windows connection fallback');
} catch (dnsErr) {
  console.warn('⚠️ Failed to apply DNS workaround:', dnsErr.message);
}

const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const Document = require("../models/EmployeeDocuments");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

async function migrateDocuments() {
  try {
    console.log("Connecting to MongoDB with URI from .env...");
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI not found in .env file!");
    }
    
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB successfully.");

    const documents = await Document.find();
    console.log(`Found ${documents.length} employee documents in DB.`);

    const workspaceRoot = path.resolve(__dirname, "../../");
    console.log(`Workspace root resolved to: ${workspaceRoot}`);

    let alreadyCorrect = 0;
    let migratedCount = 0;
    let missingFileCount = 0;
    let skippedCount = 0;

    for (const doc of documents) {
      if (!doc.filePath) {
        console.warn(`[Skip] Document ID: ${doc._id} has no filePath.`);
        skippedCount++;
        continue;
      }
      if (!doc.employeeId) {
        console.warn(`[Skip] Document ID: ${doc._id} has no employeeId.`);
        skippedCount++;
        continue;
      }

      const employeeId = String(doc.employeeId);
      const rawType = doc.type ? String(doc.type).trim() : "Other";
      const docType = rawType.replace(/[^a-zA-Z0-9_\- ]/g, "").replace(/\s+/g, "_") || "Other";
      const filename = path.basename(doc.filePath);

      // Formulate the target paths
      const targetRelativePath = `/uploads/employeedocuments/${employeeId}/${docType}/${filename}`;
      const targetDiskPath = path.join(workspaceRoot, "uploads", "employeedocuments", employeeId, docType, filename);

      // If already correct, verify disk if possible
      if (doc.filePath === targetRelativePath) {
        if (fs.existsSync(targetDiskPath)) {
          alreadyCorrect++;
          continue;
        } else {
          console.log(`[Warning] Path in DB is correct but file not at target: ${targetDiskPath}`);
        }
      }

      // Candidate paths where the file could be located
      const candidatePaths = [
        doc.filePath,
        doc.filePath.replace(/\/uploads\/employeedocuments\/employeedocuments\//i, "/uploads/employeedocuments/"),
        `uploads/employeedocuments/employeedocuments/${filename}`,
        `uploads/employeedocuments/${employeeId}/${filename}`,
        `uploads/employeeDocuments/${employeeId}/${filename}`,
        `uploads/employeedocuments/${filename}`,
        `uploads/employees/${filename}`,
        `uploads/${filename}`,
        `Uploades/${filename}`
      ];

      let foundDiskPath = null;
      for (const p of candidatePaths) {
        if (!p) continue;
        const cleanPath = p.startsWith('/') || p.startsWith('\\') ? p.substring(1) : p;
        const absPath = path.join(workspaceRoot, cleanPath);
        if (fs.existsSync(absPath)) {
          foundDiskPath = absPath;
          break;
        }
      }

      // Check target path as a candidate just in case
      if (!foundDiskPath && fs.existsSync(targetDiskPath)) {
        foundDiskPath = targetDiskPath;
      }

      if (foundDiskPath) {
        if (foundDiskPath !== targetDiskPath) {
          // Move the file physically
          const targetDir = path.dirname(targetDiskPath);
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }
          fs.renameSync(foundDiskPath, targetDiskPath);
          console.log(`[Moved File] ${foundDiskPath} -> ${targetDiskPath}`);
        } else {
          console.log(`[File In Place] Already correct location on disk: ${targetDiskPath}`);
        }

        // Update DB
        doc.filePath = targetRelativePath;
        await doc.save();
        console.log(`[DB Updated] Document ID: ${doc._id} -> ${targetRelativePath}`);
        migratedCount++;
      } else {
        // Update DB path even if physical file is not found
        console.warn(`[File Missing] File "${filename}" not found in candidate paths. Updating DB path to standard format anyway.`);
        doc.filePath = targetRelativePath;
        await doc.save();
        console.log(`[DB Updated (Missing File)] Document ID: ${doc._id} -> ${targetRelativePath}`);
        missingFileCount++;
      }
    }

    console.log("\n================ MIGRATION SUMMARY ================");
    console.log(`Total documents processed: ${documents.length}`);
    console.log(`Already in correct format: ${alreadyCorrect}`);
    console.log(`Successfully migrated:    ${migratedCount}`);
    console.log(`Missing file (DB updated): ${missingFileCount}`);
    console.log(`Skipped (invalid doc):     ${skippedCount}`);
    console.log("===================================================\n");

  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("MongoDB connection closed.");
  }
}

migrateDocuments();
