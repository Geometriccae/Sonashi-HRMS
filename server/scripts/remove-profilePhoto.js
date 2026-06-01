/**
 * Migration Script: Remove `profilePhoto` field from all documents
 * in the `employees` collection in MongoDB Atlas.
 *
 * Run once with: node scripts/remove-profilePhoto.js
 */

const mongoose = require('mongoose');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI not found in .env');
  process.exit(1);
}

async function main() {
  console.log('🔗 Connecting to MongoDB Atlas...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected.');

  const col = mongoose.connection.collection('employees');

  const before = await col.countDocuments({ profilePhoto: { $exists: true } });
  console.log(`📄 Documents with profilePhoto field: ${before}`);

  if (before === 0) {
    console.log('✅ No documents have profilePhoto. Nothing to remove.');
    await mongoose.disconnect();
    return;
  }

  const result = await col.updateMany(
    { profilePhoto: { $exists: true } },
    { $unset: { profilePhoto: '' } }
  );

  console.log(`✅ Removed profilePhoto from ${result.modifiedCount} document(s).`);

  const after = await col.countDocuments({ profilePhoto: { $exists: true } });
  console.log(`🔍 Documents with profilePhoto remaining: ${after}`);

  if (after === 0) {
    console.log('🎉 Migration complete! profilePhoto column fully removed from employees collection.');
  } else {
    console.warn('⚠️ Some documents still have profilePhoto. Please check manually.');
  }

  await mongoose.disconnect();
  console.log('🔌 Disconnected.');
}

main().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
