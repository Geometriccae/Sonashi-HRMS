const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  title: { type: String, required: true },
  project: { type: String },
  priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
  date: { type: Date, required: true },
  assignedEmployees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }],
  notes: { type: String },
  link: { type: String },
  color: { type: String },
  status: { type: String, enum: ['backlog', 'todo', 'inprogress', 'done'], default: 'todo' },
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);


