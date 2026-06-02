const mongoose = require('mongoose');
require('dotenv').config({ path: 'c:/ReactWorkSpace/Sonashi-HRMS/server/.env' });
const Employee = require('c:/ReactWorkSpace/Sonashi-HRMS/server/models/Employee');
const Client = require('c:/ReactWorkSpace/Sonashi-HRMS/server/models/Client');

async function checkData() {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected.');

    const totalEmp = await Employee.countDocuments({});
    console.log(`Total Employees: ${totalEmp}`);

    const totalClients = await Client.countDocuments({});
    console.log(`Total Clients: ${totalClients}`);

    if (totalClients > 0) {
        const sampleClient = await Client.findOne({});
        console.log('Sample Client:', JSON.stringify(sampleClient, null, 2));

        const leadTypes = await Client.distinct('leadType');
        console.log('Client leadTypes:', leadTypes);

        const followupStatuses = await Client.distinct('followupStatus');
        console.log('Client followupStatuses:', followupStatuses);
    } else {
        console.log('No clients found in the database.');
    }

    await mongoose.disconnect();
}

checkData().catch(console.error);
