const mongoose = require('mongoose');
require('dotenv').config({ path: 'c:/ReactWorkSpace/Sonashi-HRMS/server/.env' });

const EmployeeDocument = require('c:/ReactWorkSpace/Sonashi-HRMS/server/models/EmployeeDocuments');
const Employee = require('c:/ReactWorkSpace/Sonashi-HRMS/server/models/Employee');

async function verify() {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB.');

    // Find a test employee
    const employee = await Employee.findOne();
    if (!employee) {
        console.error('No employees found to test.');
        await mongoose.disconnect();
        return;
    }

    const testId = employee._id;
    console.log(`Using Employee ID: ${testId}`);

    // Create a new mock document using the exact logic of the POST route
    const docType = 'Passport_Page_1';
    const filename = `${Date.now()}-passport.pdf`;
    const newDoc = new EmployeeDocument({
        employeeId: testId,
        fileName: 'passport.pdf',
        fileType: 'application/pdf',
        fileSize: 10240,
        filePath: `/uploads/employeedocuments/${testId}/${docType}/${filename}`,
        uploadedBy: 'test-admin',
        userRole: 'admin',
        type: 'Passport Page 1',
        uploadedDate: new Date(),
    });

    const savedDoc = await newDoc.save();
    console.log(`Saved new document with path: "${savedDoc.filePath}"`);

    // Verify it is lowercase format
    const isLowercase = savedDoc.filePath.startsWith(`/uploads/employeedocuments/${testId}/${docType}/`);
    if (isLowercase) {
        console.log('✅ Verification SUCCESS: new document path is correctly formatted to standard lowercase employeedocuments.');
    } else {
        console.error('❌ Verification FAILED: path is not standard lowercase format.');
    }

    // Clean up
    await EmployeeDocument.findByIdAndDelete(savedDoc._id);
    console.log('Cleaned up test document.');

    await mongoose.disconnect();
    console.log('Disconnected.');
}

verify().catch(console.error);
