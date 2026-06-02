const mongoose = require('mongoose');
require('dotenv').config({ path: 'c:/ReactWorkSpace/Sonashi-HRMS/server/.env' });

const EmployeeDocument = require('c:/ReactWorkSpace/Sonashi-HRMS/server/models/EmployeeDocuments');

async function migrate() {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB.');

    // 1. Fetch all employee documents
    const documents = await EmployeeDocument.find({});
    console.log(`Found ${documents.length} employee documents total.`);

    let updatedCount = 0;

    // 2. Loop and update their file paths if they match the uppercase pattern
    for (const doc of documents) {
        if (doc.filePath && doc.filePath.includes('/uploads/employeeDocuments/')) {
            const oldPath = doc.filePath;
            const newPath = oldPath.replace('/uploads/employeeDocuments/', '/uploads/employeedocuments/');
            
            doc.filePath = newPath;
            await doc.save();
            
            console.log(`Updated Doc ID: ${doc._id}\n  From: "${oldPath}"\n  To:   "${newPath}"`);
            updatedCount++;
        }
    }

    console.log(`\nMigration completed. Total records updated: ${updatedCount}`);
    
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
}

migrate().catch(err => {
    console.error('Migration failed with error:', err);
    mongoose.disconnect();
});
