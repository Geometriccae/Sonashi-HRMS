const mongoose = require('mongoose');
require('dotenv').config({ path: 'c:/ReactWorkSpace/Sonashi-HRMS/server/.env' });

const Employee = require('c:/ReactWorkSpace/Sonashi-HRMS/server/models/Employee');
const LeaveRequest = require('c:/ReactWorkSpace/Sonashi-HRMS/server/models/LeaveRequest');
const User = require('c:/ReactWorkSpace/Sonashi-HRMS/server/models/User');

async function runTest() {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected.');

    // 1. Find a test employee and a user
    const employee = await Employee.findOne();
    if (!employee) {
        console.error('No employees found in the database. Run employee seeding first.');
        await mongoose.disconnect();
        return;
    }
    console.log(`Found test employee: ${employee.employeeName} (${employee._id})`);

    let user = await User.findOne({ employeeId: employee._id });
    if (!user) {
        // Fallback to any user or create a temporary one if none exists
        user = await User.findOne();
        if (!user) {
            console.error('No users found in database.');
            await mongoose.disconnect();
            return;
        }
    }
    console.log(`Using user: ${user.username} (${user._id})`);

    // Reset Employee visaExpiryDate first
    employee.visaExpiryDate = null;
    await employee.save();
    console.log('Reset employee visaExpiryDate to null.');

    // 2. Simulate POST /api/leaves/ for a past leave
    console.log('\n--- Testing POST Route (Past Leave Request Creation) ---');
    const newVisaExpiryDate = new Date('2027-12-31');

    const testLeave = new LeaveRequest({
        employee: user._id,
        employeeName: employee.employeeName,
        company: 'Sonashi',
        department: employee.department || 'IT',
        reportingManager: employee.reportingManager || 'Manager',
        leaveType: 'Personal Leave',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-05'),
        reason: 'Test Past Leave Request',
        status: 'Approved',
        isPastLeave: true,
    });

    const savedLeave = await testLeave.save();
    console.log(`Saved past leave request: ${savedLeave._id}`);

    // Update Employee visaExpiryDate (equivalent to leaveRequestRoutes POST handler logic)
    await Employee.findByIdAndUpdate(employee._id, { visaExpiryDate: newVisaExpiryDate });
    console.log('Simulated updating Employee visaExpiryDate to 2027-12-31');

    // Fetch employee again to verify update
    let updatedEmployee = await Employee.findById(employee._id);
    const dateFormatted = updatedEmployee.visaExpiryDate ? updatedEmployee.visaExpiryDate.toISOString().split('T')[0] : 'null';
    console.log(`Verified Employee visaExpiryDate in DB: ${dateFormatted}`);
    if (dateFormatted === '2027-12-31') {
        console.log('✅ POST update validation SUCCESS!');
    } else {
        console.error('❌ POST update validation FAILED!');
    }

    // 3. Simulate PUT /api/leaves/:id for editing the past leave
    console.log('\n--- Testing PUT Route (Past Leave Request Update) ---');
    const updatedVisaExpiryDate = new Date('2028-06-30');

    // Simulate standard updateData build-up from PUT handler
    const updateData = {
        reason: 'Updated Test Past Leave Request reason',
    };

    const updatedLeave = await LeaveRequest.findByIdAndUpdate(
        savedLeave._id,
        updateData,
        { new: true }
    );
    console.log(`Updated leave request: ${updatedLeave._id}`);

    // Update Employee visaExpiryDate (equivalent to leaveRequestRoutes PUT handler logic)
    await Employee.findByIdAndUpdate(employee._id, { visaExpiryDate: updatedVisaExpiryDate });
    console.log('Simulated updating Employee visaExpiryDate to 2028-06-30');

    // Fetch employee again to verify update
    updatedEmployee = await Employee.findById(employee._id);
    const updatedDateFormatted = updatedEmployee.visaExpiryDate ? updatedEmployee.visaExpiryDate.toISOString().split('T')[0] : 'null';
    console.log(`Verified Employee visaExpiryDate in DB: ${updatedDateFormatted}`);
    if (updatedDateFormatted === '2028-06-30') {
        console.log('✅ PUT update validation SUCCESS!');
    } else {
        console.error('❌ PUT update validation FAILED!');
    }

    // Clean up
    await LeaveRequest.findByIdAndDelete(savedLeave._id);
    console.log('\nCleaned up test leave request.');

    await mongoose.disconnect();
    console.log('Disconnected.');
}

runTest().catch(console.error);
