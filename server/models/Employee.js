const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true }, // unique employee code/ID
  employeeName: { type: String, required: true },
  
  attendance: { 
    type: String, 
    enum: ["Onsite", "Leave"], 
    default: "Onsite" 
  },

  mobile: { type: String, required: true },
  emailId: { type: String, required: true, unique: true },

  profilePhoto: { type: String, default: "" }, // URL or path to photo

  role: { type: String, required: true }, // e.g., Operations Manager, Sales Executive
  designation: { type: String }, // same or different from role if needed

  department: { 
    type: String, 
    required: true 
  },

  assignedProjects: [{ type: String }], // multiple projects can be assigned

}, { timestamps: true });

module.exports = mongoose.model("Employee", employeeSchema);
