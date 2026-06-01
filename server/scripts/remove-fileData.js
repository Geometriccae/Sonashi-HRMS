/**
 * Migration Script: Remove `fileData` field from all EmployeeDocument records in MongoDB.
 *
 * This performs an atomic $unset on all documents in the employeedocuments collection.
 * Run once with: node scripts/remove-fileData.js
 */

const mongoose = require('mongoose');
const path = require('path');

// Load env from .env file in the server directory
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI not found in environment. Make sure .env is present in the server folder.');
  process.exit(1);
}

async function main() {
  console.log('🔗 Connecting to MongoDB Atlas...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected.');

  const collection = mongoose.connection.collection('employeedocuments');

  // Count documents with fileData field before removal
  const totalBefore = await collection.countDocuments({ fileData: { $exists: true } });
  console.log(`📄 Documents with fileData field: ${totalBefore}`);

  if (totalBefore === 0) {
    console.log('✅ No documents have fileData. Nothing to remove.');
    await mongoose.disconnect();
    return;
  }

  // Perform the $unset to remove fileData from all matching documents
  const result = await collection.updateMany(
    { fileData: { $exists: true } },
    { $unset: { fileData: '' } }
  );

  console.log(`✅ Removed fileData from ${result.modifiedCount} document(s).`);

  // Verify
  const totalAfter = await collection.countDocuments({ fileData: { $exists: true } });
  console.log(`🔍 Documents with fileData remaining after removal: ${totalAfter}`);

  if (totalAfter === 0) {
    console.log('🎉 Migration complete! fileData column fully removed from all documents.');
  } else {
    console.warn(`⚠️ Some documents still have fileData. Please check manually.`);
  }

  await mongoose.disconnect();
  console.log('🔌 Disconnected from MongoDB.');
}

main().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
