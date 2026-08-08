const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['role', 'department']
  },
  label: {
    type: String,
    required: true,
    trim: true
  },
  value: {
    type: String,
    required: true,
    trim: true
  },
  isExcludedDefault: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Ensure unique label per type
optionSchema.index({ type: 1, value: 1 }, { unique: true });

module.exports = mongoose.model('Option', optionSchema);
