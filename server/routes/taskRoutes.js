const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Task = require('../models/Task');

// Create task for a client
router.post('/clients/:clientId/tasks', authMiddleware, async (req, res) => {
  try {
    const { clientId } = req.params;
    const {
      title,
      project,
      priority,
      date,
      assignedEmployees,
      notes,
      link,
      color,
      status,
    } = req.body;

    if (!title || !date) {
      return res.status(400).json({ message: 'title and date are required' });
    }

    const task = new Task({
      clientId,
      title,
      project,
      priority,
      date,
      assignedEmployees: Array.isArray(assignedEmployees) ? assignedEmployees : [],
      notes,
      link,
      color,
      status,
    });

    const saved = await task.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ message: 'Error creating task', error: error.message });
  }
});

// List tasks for a client
router.get('/clients/:clientId/tasks', authMiddleware, async (req, res) => {
  try {
    const { clientId } = req.params;
    const tasks = await Task.find({ clientId }).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching tasks', error: error.message });
  }
});

// Update a task
router.put('/clients/:clientId/tasks/:taskId', authMiddleware, async (req, res) => {
  try {
    const { clientId, taskId } = req.params;
    const update = req.body || {};
    const updated = await Task.findOneAndUpdate(
      { _id: taskId, clientId },
      update,
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Task not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error updating task', error: error.message });
  }
});

// Delete a task
router.delete('/clients/:clientId/tasks/:taskId', authMiddleware, async (req, res) => {
  try {
    const { clientId, taskId } = req.params;
    const deleted = await Task.findOneAndDelete({ _id: taskId, clientId });
    if (!deleted) return res.status(404).json({ message: 'Task not found' });
    res.json({ message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting task', error: error.message });
  }
});

module.exports = router;



