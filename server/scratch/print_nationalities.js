const mongoose = require('mongoose');
require('dotenv').config({ path: 'c:/ReactWorkSpace/Sonashi-HRMS/server/.env' });
const Employee = require('c:/ReactWorkSpace/Sonashi-HRMS/server/models/Employee');

async function test() {
    await mongoose.connect(process.env.MONGO_URI);
    const nonNullDojCount = await Employee.countDocuments({ doj: { $ne: null } });
    console.log('Employees with non-null doj:', nonNullDojCount);
    
    if (nonNullDojCount > 0) {
        const samples = await Employee.find({ doj: { $ne: null } }).limit(5).select('employeeName doj createdAt');
        console.log('Sample DOJ values:', samples);
    }
    
    await mongoose.disconnect();
}
test().catch(console.error);
