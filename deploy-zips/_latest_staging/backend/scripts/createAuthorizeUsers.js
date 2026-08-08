/**
 * Create / update Authorize User accounts: Kailash & Mahesh
 * Passwords (for login): Kailash@123 , Mahesh@123
 *
 * Usage: node scripts/createAuthorizeUsers.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const USERS = [
  { username: 'Kailash', password: 'Kailash@123', role: 'authorize_user' },
  { username: 'Mahesh', password: 'Mahesh@123', role: 'authorize_user' },
];

async function upsertUser({ username, password, role }) {
  const hashedPassword = await bcrypt.hash(password, 10);
  const existing = await User.findOne({
    username: new RegExp(`^${username}$`, 'i'),
  });

  if (existing) {
    existing.password = hashedPassword;
    existing.role = role;
    await existing.save();
    console.log(`Updated: ${existing.username} → role=${role}`);
    return existing;
  }

  const created = await User.create({
    username,
    password: hashedPassword,
    role,
    emailId: '',
    phoneNumber: '',
  });
  console.log(`Created: ${created.username} → role=${role}`);
  return created;
}

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DB_URI;
  if (!uri) {
    console.error('MONGO_URI not set in .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  for (const u of USERS) {
    await upsertUser(u);
  }

  console.log('\nLogin credentials:');
  for (const u of USERS) {
    console.log(`  Username: ${u.username}  |  Password: ${u.password}  |  Role: Authorize User`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
