/**
 * Seed script to generate 50 highly realistic mock employees and users.
 * Run from server folder: node scripts/seedMockEmployees.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Employee = require('../models/Employee');
const User = require('../models/User');

const NATIONALITIES = ['Indian', 'Emirati', 'Pakistani', 'Filipino', 'Egyptian', 'Jordanian', 'British', 'Syrian'];
const DEPARTMENTS = ['Operations', 'Sales', 'Accounts', 'HR', 'IT', 'Chartering'];
const ROLES = [
  'operations_executive',
  'sales_executive',
  'operations_pricing_manager',
  'accounts_manager',
  'hr',
  'chartering_manager',
  'office_assistance'
];
const BANK_NAMES = ['Emirates NBD', 'Abu Dhabi Commercial Bank (ADCB)', 'First Abu Dhabi Bank (FAB)', 'Dubai Islamic Bank (DIB)'];

const FIRST_NAMES = [
  'Aarav', 'Ananya', 'Rahul', 'Priya', 'Amit', 'Sneha', 'Vikram', 'Neha', 'Rohan', 'Pooja',
  'Ahmed', 'Fatima', 'Omar', 'Aisha', 'Mustafa', 'Yasmin', 'Tarek', 'Layla', 'John', 'Sarah',
  'Michael', 'Emily', 'David', 'Jessica', 'James', 'Maria', 'Daniel', 'Karen', 'Robert', 'Lisa'
];

const LAST_NAMES = [
  'Sharma', 'Patel', 'Singh', 'Verma', 'Gupta', 'Joshi', 'Reddy', 'Nair', 'Menon', 'Rao',
  'Al-Mansoori', 'Al-Suwaidi', 'Al-Hashemi', 'Al-Maktoum', 'El-Sayed', 'El-Masry', 'Haddad', 'Khoury', 'Smith', 'Jones',
  'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas'
];

async function seedMockData() {
  if (!process.env.MONGO_URI) {
    console.error('❌ MONGO_URI is not set in .env');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected');

    // Clean existing mock data first to avoid duplicate employeeIds (EMP001 to EMP050)
    const deleteResult = await Employee.deleteMany({ employeeId: /^EMP\d+/ });
    console.log(`🧹 Deleted ${deleteResult.deletedCount} existing mock employees`);

    const deleteUsersResult = await User.deleteMany({ username: /^emp\d+/ });
    console.log(`🧹 Deleted ${deleteUsersResult.deletedCount} existing mock users`);

    const hashedPassword = await bcrypt.hash('User@123', 10);
    const employeesToInsert = [];
    const usersToInsert = [];

    for (let i = 1; i <= 50; i++) {
      const padId = String(i).padStart(3, '0');
      const employeeId = `EMP${padId}`;
      const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
      const name = `${firstName} ${lastName}`;
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@sonashi.com`;
      const dept = DEPARTMENTS[Math.floor(Math.random() * DEPARTMENTS.length)];
      
      // Select a role compatible with the department
      let role = 'sales_executive';
      if (dept === 'Operations') role = Math.random() > 0.3 ? 'operations_executive' : 'operations_pricing_manager';
      else if (dept === 'Accounts') role = 'accounts_manager';
      else if (dept === 'HR') role = 'hr';
      else if (dept === 'Chartering') role = 'chartering_manager';
      else if (dept === 'IT') role = 'office_assistance';
      
      const nationality = NATIONALITIES[Math.floor(Math.random() * NATIONALITIES.length)];
      const gender = Math.random() > 0.5 ? 'Male' : 'Female';
      const office = Math.random() > 0.5 ? 'Dubai Office' : 'Abu Dhabi Office';
      const totalYearsExperience = Math.floor(Math.random() * 15) + 1;
      
      // Dates
      const doj = new Date();
      doj.setFullYear(doj.getFullYear() - Math.floor(Math.random() * 5));
      doj.setMonth(Math.floor(Math.random() * 12));
      doj.setDate(Math.floor(Math.random() * 28) + 1);

      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - (22 + Math.floor(Math.random() * 30)));
      dob.setMonth(Math.floor(Math.random() * 12));
      dob.setDate(Math.floor(Math.random() * 28) + 1);

      // Expiries (some within next 3 months to trigger dashboard alerts!)
      const passportExpiry = new Date();
      passportExpiry.setMonth(passportExpiry.getMonth() + (Math.random() > 0.8 ? Math.floor(Math.random() * 3) : Math.floor(Math.random() * 48) + 3));
      passportExpiry.setDate(Math.floor(Math.random() * 28) + 1);

      const laborExpiry = new Date();
      laborExpiry.setMonth(laborExpiry.getMonth() + (Math.random() > 0.8 ? Math.floor(Math.random() * 3) : Math.floor(Math.random() * 48) + 3));
      laborExpiry.setDate(Math.floor(Math.random() * 28) + 1);

      const visaExpiry = new Date();
      visaExpiry.setMonth(visaExpiry.getMonth() + (Math.random() > 0.8 ? Math.floor(Math.random() * 3) : Math.floor(Math.random() * 48) + 3));
      visaExpiry.setDate(Math.floor(Math.random() * 28) + 1);

      // Salaries
      const basic = 4000 + Math.floor(Math.random() * 8000);
      const rent = Math.floor(basic * 0.3);
      const travel = Math.floor(basic * 0.1);
      const other = Math.floor(Math.random() * 1000);
      const totalSalary = basic + rent + travel + other;

      const employeeDoc = new Employee({
        employeeId,
        employeeName: name,
        emailId: email,
        nationality,
        gender,
        office,
        doj,
        dateOfBirth: dob,
        totalYearsExperience,
        workPermitNo: `WP-${Math.floor(100000 + Math.random() * 900000)}`,
        emiratesId: `784-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000000 + Math.random() * 9000000)}-${Math.floor(1 * Math.random() * 9)}`,
        passportNo: `PP-${Math.floor(1000000 + Math.random() * 9000000)}`,
        passportExpiryDate: passportExpiry,
        labourCardExpiryDate: laborExpiry,
        visaExpiryDate: visaExpiry,
        role: role.replace('_', ' ').toUpperCase(),
        designation: role.replace('_', ' ').toUpperCase(),
        department: dept,
        employeeStatus: 'Active',
        vacationStatus: Math.random() > 0.85 ? 'On Vacation' : 'Not on Vacation',
        attendance: Math.random() > 0.9 ? 'Leave' : 'Onsite',
        mobile: `+971 50 ${Math.floor(1000000 + Math.random() * 9000000)}`,
        emergencyContact: {
          uae: {
            name: `${LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]} Family`,
            address: `Marina, Dubai, UAE`,
            contactNo: `+971 52 ${Math.floor(1000000 + Math.random() * 9000000)}`
          },
          homeCountry: {
            name: `${firstName} Parent`,
            address: `${nationality} Address St 12`,
            contactNo: `+91 9840${Math.floor(100000 + Math.random() * 900000)}`
          },
          homeCountry2: {
            name: `${firstName} Sibling`,
            address: `${nationality} Address St 24`,
            contactNo: `+91 9840${Math.floor(100000 + Math.random() * 900000)}`
          }
        },
        salaryDetails: {
          basicSalary: basic,
          houseRent: rent,
          travelExp: travel,
          other: other,
          totalAllowance: rent + travel + other,
          deduction: 0,
          totalSalary: totalSalary,
          bankName: BANK_NAMES[Math.floor(Math.random() * BANK_NAMES.length)],
          accountNumber: `ACC-${Math.floor(100000000 + Math.random() * 900000000)}`,
          ibanNumber: `AE${Math.floor(10 + Math.random() * 89)}ENBD000000${Math.floor(100000000 + Math.random() * 900000000)}`,
          bankSortCode: `SC-${Math.floor(100000 + Math.random() * 900000)}`
        },
        airFare: Math.random() > 0.5,
        medicalInsurance: Math.random() > 0.3,
        lifeInsurance: Math.random() > 0.4
      });

      employeesToInsert.push(employeeDoc);

      const username = `emp${padId}`;
      usersToInsert.push({
        username,
        password: hashedPassword,
        emailId: email,
        phoneNumber: employeeDoc.mobile,
        role: role,
        employeeId: employeeDoc._id,
        leaveBalance: 21
      });
    }

    const insertedEmployees = await Employee.insertMany(employeesToInsert);
    console.log(`✅ Successfully inserted ${insertedEmployees.length} mock employees`);

    // Assign the correct mongo ObjectIds to user records
    const users = usersToInsert.map((usr, idx) => {
      usr.employeeId = insertedEmployees[idx]._id;
      return usr;
    });

    const insertedUsers = await User.insertMany(users);
    console.log(`✅ Successfully inserted ${insertedUsers.length} mock users`);

    await mongoose.disconnect();
    console.log('🎉 Seeding successfully completed!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding mock data failed:', err);
    process.exit(1);
  }
}

seedMockData();
