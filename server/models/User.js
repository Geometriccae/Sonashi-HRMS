const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phoneNumber: { type: String, default: "" },
  profilePicture: { type: String, default: null }
});

module.exports = mongoose.model("User", userSchema);
