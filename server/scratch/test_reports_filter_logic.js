const mongoose = require('mongoose');
require('dotenv').config({ path: 'c:/ReactWorkSpace/Sonashi-HRMS/server/.env' });
const Employee = require('c:/ReactWorkSpace/Sonashi-HRMS/server/models/Employee');

async function testFilterLogic() {
    await mongoose.connect(process.env.MONGO_URI);
    const employees = await Employee.find().lean();
    console.log(`Total employees in DB: ${employees.length}`);

    // Let's test default filters (all "All")
    let empList = [...employees];
    const employeeStatus = "All";
    const filterDepartment = "All";
    const filterRole = "All";
    const filterOffice = "All";
    const filterCountry = "All";
    const minExperience = "";
    const startDate = "";
    const endDate = "";

    if (employeeStatus !== "All") empList = empList.filter(e => e.employeeStatus === employeeStatus || e.attendance === employeeStatus);
    if (filterDepartment !== "All") empList = empList.filter(e => e.department === filterDepartment);
    if (filterRole !== "All") empList = empList.filter(e => e.role === filterRole);
    if (filterOffice !== "All") empList = empList.filter(e => e.office === filterOffice);
    if (filterCountry !== "All") empList = empList.filter(e => e.nationality === filterCountry);
    if (minExperience !== "") {
      const minYears = parseFloat(minExperience);
      if (!isNaN(minYears)) empList = empList.filter(e => (e.totalYearsExperience || 0) >= minYears);
    }
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      empList = empList.filter(e => {
        const date = e.doj ? new Date(e.doj) : new Date(e.createdAt);
        return date >= start && date <= end;
      });
    }

    console.log(`Default filter result count: ${empList.length}`);

    // Let's test Active filter
    let activeList = [...employees];
    if ("Active" !== "All") activeList = activeList.filter(e => e.employeeStatus === "Active" || e.attendance === "Active");
    console.log(`Active filter result count: ${activeList.length}`);

    // Let's test InActive filter
    let inactiveList = [...employees];
    if ("InActive" !== "All") inactiveList = inactiveList.filter(e => e.employeeStatus === "InActive" || e.attendance === "InActive");
    console.log(`InActive filter result count: ${inactiveList.length}`);

    await mongoose.disconnect();
}

testFilterLogic().catch(console.error);
