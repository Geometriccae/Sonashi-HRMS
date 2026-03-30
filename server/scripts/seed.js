/**
 * Seed script: creates an initial admin user if none exists.
 * Run from server folder: node scripts/seed.js
 * Requires: .env with MONGO_URI set.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const INITIAL_ADMIN = {
  username: 'admin',
  password: 'Admin@123',
  role: 'admin',
  emailId: 'admin@sonashi.com',
  phoneNumber: '',
};

async function seed() {
  if (!process.env.MONGO_URI) {
    console.error('❌ MONGO_URI is not set in .env');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected');

    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('ℹ️  An admin user already exists (username: %s). Skipping seed.', existingAdmin.username);
      await mongoose.disconnect();
      console.log('Disconnected.');
      process.exit(0);
      return;
    }

    const existingUsername = await User.findOne({ username: INITIAL_ADMIN.username });
    if (existingUsername) {
      console.log('ℹ️  User "%s" already exists. Skipping seed.', INITIAL_ADMIN.username);
      await mongoose.disconnect();
      console.log('Disconnected.');
      process.exit(0);
      return;
    }

    const hashedPassword = await bcrypt.hash(INITIAL_ADMIN.password, 10);
    await User.create({
      username: INITIAL_ADMIN.username,
      password: hashedPassword,
      role: INITIAL_ADMIN.role,
      emailId: INITIAL_ADMIN.emailId || '',
      phoneNumber: INITIAL_ADMIN.phoneNumber || '',
    });

    console.log('✅ Initial admin user created.');
    console.log('');
    console.log('--- Initial login credentials ---');
    console.log('   Username: %s', INITIAL_ADMIN.username);
    console.log('   Password: %s', INITIAL_ADMIN.password);
    console.log('---------------------------------');
    console.log('Change this password after first login.');
    console.log('');

    await mongoose.disconnect();
    console.log('Disconnected.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
}

seed();
