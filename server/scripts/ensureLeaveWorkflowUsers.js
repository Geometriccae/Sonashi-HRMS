/**
 * Ensures the Leave workflow users exist:
 *   Admin: Melvin / Melvin@123, Kantesh / Kantesh@123
 *   Authorize User: Kailash / Kailash@123, Mahesh / Mahesh@123
 *
 * Usage (from server folder):
 *   node scripts/ensureLeaveWorkflowUsers.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const USERS = [
  { username: 'Melvin', password: 'Melvin@123', role: 'admin' },
  { username: 'Kantesh', password: 'Kantesh@123', role: 'admin' },
  { username: 'Kailash', password: 'Kailash@123', role: 'authorize_user' },
  { username: 'Mahesh', password: 'Mahesh@123', role: 'authorize_user' },
];

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGO_URI / MONGODB_URI not set in .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  for (const u of USERS) {
    const existing = await User.findOne({
      username: new RegExp(`^${u.username}$`, 'i'),
    });
    const hashed = await bcrypt.hash(u.password, 10);

    if (existing) {
      existing.role = u.role;
      existing.password = hashed;
      await existing.save();
      console.log(`Updated: ${u.username} → role=${u.role}`);
    } else {
      await User.create({
        username: u.username,
        password: hashed,
        role: u.role,
        emailId: `${u.username.toLowerCase()}@sonashi.local`,
      });
      console.log(`Created: ${u.username} → role=${u.role}`);
    }
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
