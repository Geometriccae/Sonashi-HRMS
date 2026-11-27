const mongoose = require('mongoose');
require('dotenv').config();

(async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('No MONGO_URI');
  await mongoose.connect(uri);
  const Emp = require('../models/Employee');

  const counts = {
    total: await Emp.countDocuments({}),
    withPassportNo: await Emp.countDocuments({ passportNo: { $nin: [null, ''] } }),
    withLabourExpiry: await Emp.countDocuments({ labourCardExpiryDate: { $ne: null } }),
    withLabourNo: await Emp.countDocuments({ labourCardNumber: { $nin: [null, ''] } }),
  };

  const sample = await Emp.findOne({ passportNo: { $nin: [null, ''] } })
    .select('employeeId employeeName passportNo passportExpiryDate labourCardNumber labourCardExpiryDate workPermitNo')
    .lean();

  const withLabour = await Emp.findOne({ labourCardExpiryDate: { $ne: null } })
    .select('employeeId employeeName passportNo labourCardNumber labourCardExpiryDate workPermitNo')
    .lean();

  const rawKeys = await Emp.findOne({}).lean();
  const keyHits = Object.keys(rawKeys || {}).filter((k) =>
    /passport|labour|labor|permit|visa/i.test(k)
  );

  console.log(JSON.stringify({ counts, sample, withLabour, keyHits }, null, 2));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
