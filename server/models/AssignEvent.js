const mongoose = require('mongoose');

const assignEventSchema = new mongoose.Schema({
  eventName: { type: String, required: true },
  eventType: { type: String },
  date: { type: Date, required: true },
  time: { type: String },
  notes: { type: String },
  link: { type: String },
  assignedTo: { type: String },
  color: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update updatedAt before save
assignEventSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// ⚠ Export the schema, not a model
module.exports = assignEventSchema;
