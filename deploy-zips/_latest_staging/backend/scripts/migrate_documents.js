// const mongoose = require('mongoose');
// const fs = require('fs');
// const path = require('path');
// const Document = require('../models/EmployeeDocuments');
// require('dotenv').config({ path: path.join(__dirname, '../.env') });

// async function migrateDocuments() {
//   try {
//     console.log('Connecting to MongoDB...', process.env.MONGO_URI);
//     await mongoose.connect(process.env.MONGO_URI);
//     console.log('Connected to MongoDB.');

//     const documents = await Document.find();
//     console.log(`Found ${documents.length} documents.`);

//     const workspaceRoot = path.join(__dirname, '../../');

//     let migratedCount = 0;
//     let missingCount = 0;

//     for (const doc of documents) {
//       if (!doc.filePath) continue;

//       const rawType = (doc.type) ? String(doc.type).trim() : "Other";
//       const docType = rawType.replace(/[^a-zA-Z0-9_\- ]/g, "").replace(/\s+/g, "_") || "Other";

//       let currentDiskPath;
//       let urlEmployeeId;
//       let fileName;
      
//       if (doc.filePath.startsWith('/uploads/') && !doc.filePath.startsWith('/uploads/employeeDocuments/')) {
//          // Format: /uploads/<employeeId>/<filename>
//          const parts = doc.filePath.split('/');
//          if (parts.length >= 4) {
//             urlEmployeeId = parts[2];
//             fileName = parts.slice(3).join('/'); // In case filename has slashes, though unlikely
//          } else if (parts.length === 3) { // just in case
//              urlEmployeeId = parts[1];
//              fileName = parts[2];
//          }
//          currentDiskPath = path.join(workspaceRoot, 'uploads/employeeDocuments', urlEmployeeId, fileName);
//       } else if (doc.filePath.startsWith('/Uploades/')) {
//          // legacy
//          fileName = path.basename(doc.filePath);
//          urlEmployeeId = String(doc.employeeId);
//          currentDiskPath = path.join(workspaceRoot, doc.filePath);
//       } else if (doc.filePath.startsWith('/uploads/employeeDocuments/')) {
//           // Already migrated or partially migrated path?
//           const parts = doc.filePath.split('/');
//           if (parts.length === 5) {
//               // /uploads/employeeDocuments/<employeeId>/<filename>
//               urlEmployeeId = parts[3];
//               fileName = parts[4];
//               currentDiskPath = path.join(workspaceRoot, 'uploads/employeeDocuments', urlEmployeeId, fileName);
//           } else if (parts.length >= 6) {
//               // Already correctly migrated: /uploads/employeeDocuments/<employeeId>/<docType>/<filename>
//               continue;
//           } else {
//              continue;
//           }
//       } else {
//          continue; // skip other paths
//       }

//       if (!urlEmployeeId || !fileName) continue;

//       // Desired file path structure
//       const newFilePath = `/uploads/employeeDocuments/${urlEmployeeId}/${docType}/${fileName}`;
//       const newDiskPath = path.join(workspaceRoot, newFilePath);

//       // Check if it's already migrated
//       if (doc.filePath === newFilePath) {
//          continue;
//       }

//       if (fs.existsSync(currentDiskPath)) {
//         // Create destination directory if it doesn't exist
//         const newDir = path.dirname(newDiskPath);
//         if (!fs.existsSync(newDir)) {
//           fs.mkdirSync(newDir, { recursive: true });
//         }

//         // Move the file
//         fs.renameSync(currentDiskPath, newDiskPath);
//         console.log(`Moved: ${currentDiskPath} -> ${newDiskPath}`);

//         // Update database
//         doc.filePath = newFilePath;
//         await doc.save();
//         migratedCount++;
//       } else {
//         // Also check if the file is already at the new location
//         if (fs.existsSync(newDiskPath)) {
//             console.log(`File actually exists at new location. Updating DB... ${newDiskPath}`);
//             doc.filePath = newFilePath;
//             await doc.save();
//             migratedCount++;
//         } else {
//             console.log(`File not found on disk, skipping: ${currentDiskPath}`);
//             missingCount++;
//         }
//       }
//     }

//     console.log(`Migration complete. Migrated: ${migratedCount}, Missing: ${missingCount}`);
//   } catch (error) {
//     console.error('Migration failed:', error);
//   } finally {
//     mongoose.disconnect();
//   }
// }

// migrateDocuments();
