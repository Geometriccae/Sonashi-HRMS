/**
 * One-time migration: convert inline base64 `profilePhoto` values into real
 * files under /uploads/employees and replace the DB value with the file path.
 *
 * Why: base64 images (~300KB each) stored inline in MongoDB make the employee
 * list endpoint return tens of MB and take 60s+. Storing a short file path
 * instead keeps the list lightweight and lets the static file server deliver
 * images directly.
 *
 * Usage: node scripts/migrateProfilePhotos.js
 */
require('dotenv').config();
const dns = require('dns');
// Atlas SRV lookups can fail with the system resolver on some networks.
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) { /* ignore */ }

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const UPLOAD_DIR = path.join(__dirname, '../../uploads/employees');

const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
};

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI not set');
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  console.log('Connected to MongoDB');

  const Employee = require('../models/Employee');

  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  // Only documents whose profilePhoto is an inline base64 data URI
  const cursor = Employee.find({ profilePhoto: { $regex: '^data:' } })
    .select('_id employeeId profilePhoto')
    .cursor();

  let migrated = 0;
  let failed = 0;

  for (let emp = await cursor.next(); emp != null; emp = await cursor.next()) {
    try {
      const dataUri = emp.profilePhoto || '';
      const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUri);
      if (!match) {
        console.warn(`Skip ${emp.employeeId}: not a recognizable data URI`);
        continue;
      }
      const mime = (match[1] || 'image/jpeg').toLowerCase();
      const isBase64 = !!match[2];
      const payload = match[3] || '';
      const ext = EXT_BY_MIME[mime] || 'jpg';

      const buffer = isBase64
        ? Buffer.from(payload, 'base64')
        : Buffer.from(decodeURIComponent(payload), 'utf8');

      const safeId = String(emp.employeeId || emp._id).replace(/[^a-zA-Z0-9_-]/g, '-');
      const filename = `${safeId}-${Date.now()}.${ext}`;
      const filePath = path.join(UPLOAD_DIR, filename);

      fs.writeFileSync(filePath, buffer);

      const publicPath = `/uploads/employees/${filename}`;
      await Employee.updateOne({ _id: emp._id }, { $set: { profilePhoto: publicPath } });

      migrated += 1;
      console.log(`✓ ${emp.employeeId} -> ${publicPath} (${(buffer.length / 1024).toFixed(0)} KB)`);
    } catch (err) {
      failed += 1;
      console.error(`✗ ${emp.employeeId}: ${err.message}`);
    }
  }

  console.log(`\nDone. Migrated: ${migrated}, Failed: ${failed}`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
