const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phoneNumber: { type: String, default: "" },
  emailId: { type: String, default: ""},
  profilePicture: { type: String, default: null },
  role: { 
    type: String, 
    enum: ["admin", "sales_executive"], 
    default: "sales_executive",
    required: true 
  }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
