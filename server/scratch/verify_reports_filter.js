const mongoose = require('mongoose');
require('dotenv').config({ path: 'c:/ReactWorkSpace/Sonashi-HRMS/server/.env' });

const Employee = require('c:/ReactWorkSpace/Sonashi-HRMS/server/models/Employee');

async function testFilters() {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB.');

    // Load all employees
    const employees = await Employee.find({});
    console.log(`Loaded ${employees.length} employees total from database.\n`);

    if (employees.length === 0) {
        console.error('No employees found to run filters against.');
        await mongoose.disconnect();
        return;
    }

    // 1. Department Filter
    const targetDept = employees[0].department || 'Operations';
    const deptFiltered = employees.filter(e => e.department === targetDept);
    console.log(`- Filter [Department = "${targetDept}"]: Matches ${deptFiltered.length}/${employees.length} records.`);

    // 2. Role Filter
    const targetRole = employees[0].role || 'Operations Manager';
    const roleFiltered = employees.filter(e => e.role === targetRole);
    console.log(`- Filter [Role = "${targetRole}"]: Matches ${roleFiltered.length}/${employees.length} records.`);

    // 3. Office Filter
    const offices = [...new Set(employees.map(e => e.office).filter(Boolean))];
    const targetOffice = offices[0] || 'Dubai';
    const officeFiltered = employees.filter(e => e.office === targetOffice);
    console.log(`- Filter [Office Location = "${targetOffice}"]: Matches ${officeFiltered.length}/${employees.length} records.`);

    // 4. Country (Nationality) Filter
    const countries = [...new Set(employees.map(e => e.nationality).filter(Boolean))];
    const targetCountry = countries[0] || 'Indian';
    const countryFiltered = employees.filter(e => e.nationality === targetCountry);
    console.log(`- Filter [Country (Nationality) = "${targetCountry}"]: Matches ${countryFiltered.length}/${employees.length} records.`);

    // 5. Years of Experience Filter
    const expFiltered = employees.filter(e => (e.totalYearsExperience || 0) >= 1);
    console.log(`- Filter [Experience >= 1 year]: Matches ${expFiltered.length}/${employees.length} records.`);

    // 6. DOJ Date Range Filter
    const start = new Date('2020-01-01');
    const end = new Date('2028-12-31');
    const dojFiltered = employees.filter(e => {
        const date = e.doj ? new Date(e.doj) : new Date(e.createdAt);
        return date >= start && date <= end;
    });
    console.log(`- Filter [DOJ between 2020-2028]: Matches ${dojFiltered.length}/${employees.length} records.`);

    console.log('\n✅ All filter queries executed successfully against database records.');
    await mongoose.disconnect();
    console.log('Disconnected.');
}

testFilters().catch(console.error);
