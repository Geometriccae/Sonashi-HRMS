const http = require('http');

async function testUpdate() {
  const data = JSON.stringify({
    data: JSON.stringify({ vacationStatus: "Onsite" })
  });
  
  // First we need to get an employee ID from the database
  const mongoose = require("mongoose");
  await mongoose.connect("mongodb://localhost:27017/sonashi-hrms");
  const Employee = mongoose.model("Employee", new mongoose.Schema({}, { strict: false }));
  const emp = await Employee.findOne({});
  
  if (!emp) {
    console.log("No employees found");
    return;
  }
  const id = emp._id.toString();
  console.log("Testing update on employee:", id);
  await mongoose.disconnect();
  
  // Now send the PUT request to the local API
  const formData = new FormData();
  formData.append('data', JSON.stringify({ vacationStatus: "On Vacation" }));
  
  try {
    const res = await fetch(`http://localhost:5000/api/employees/${id}`, {
      method: 'PUT',
      body: formData
    });
    
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Response:", text);
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

testUpdate();
