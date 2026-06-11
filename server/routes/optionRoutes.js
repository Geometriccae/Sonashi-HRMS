const express = require('express');
const router = express.Router();
const Option = require('../models/Option');
const authMiddleware = require('../middleware/authMiddleware');

// Get labels of built-in default options the user has hidden from dropdowns
router.get('/:type/excluded', async (req, res) => {
  try {
    const { type } = req.params;
    const excluded = await Option.find({ type, isExcludedDefault: true }).sort({ label: 1 });
    res.json(excluded.map((opt) => opt.label));
  } catch (error) {
    console.error(`[API] Error fetching excluded options:`, error);
    res.status(500).json({ message: 'Error fetching excluded options', error: error.message });
  }
});

// Hide a built-in default option from dropdowns (stored in DB so it persists)
router.post('/:type/exclude-default', authMiddleware, async (req, res) => {
  try {
    const { type } = req.params;
    const { label } = req.body;

    if (!label || !label.trim()) {
      return res.status(400).json({ message: 'Label is required' });
    }

    const value = label.trim();
    const option = await Option.findOneAndUpdate(
      { type, value },
      { type, label: value, value, isExcludedDefault: true },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json(option);
  } catch (error) {
    console.error(`[API] Error excluding default option:`, error);
    res.status(500).json({ message: 'Error excluding default option', error: error.message });
  }
});

// Get all user-added options for a specific type (excludes hidden defaults)
router.get('/:type', async (req, res) => {
  try {
    const { type } = req.params;
    console.log(`[API] Fetching options for type: ${type}`);
    const options = await Option.find({
      type,
      $or: [{ isExcludedDefault: false }, { isExcludedDefault: { $exists: false } }]
    }).sort({ label: 1 });
    res.json(options);
  } catch (error) {
    console.error(`[API] Error fetching options:`, error);
    res.status(500).json({ message: 'Error fetching options', error: error.message });
  }
});

// Add a new option
router.post('/:type', authMiddleware, async (req, res) => {
  try {
    const { type } = req.params;
    const { label } = req.body;
    console.log(`[API] Adding new option - Type: ${type}, Label: ${label}`);

    if (!label || !label.trim()) {
      return res.status(400).json({ message: 'Label is required' });
    }

    const value = label.trim();
    
    // Check if exists
    const existing = await Option.findOne({ type, value });
    if (existing) {
      if (existing.isExcludedDefault) {
        existing.isExcludedDefault = false;
        await existing.save();
        console.log(`[API] Restored previously excluded option: ${value}`);
        return res.status(201).json(existing);
      }
      console.warn(`[API] Option already exists: ${value}`);
      return res.status(400).json({ message: 'Option already exists' });
    }

    const newOption = new Option({
      type,
      label: value,
      value: value
    });

    await newOption.save();
    console.log(`[API] Option saved successfully: ${value}`);
    res.status(201).json(newOption);
  } catch (error) {
    console.error(`[API] Error adding option:`, error);
    res.status(500).json({ message: 'Error adding option', error: error.message });
  }
});

// Delete an option
router.delete('/:type/:id', authMiddleware, async (req, res) => {
  try {
    const { id, type } = req.params;
    console.log(`[API] Deleting option - ID: ${id}, Type: ${type}`);
    await Option.findByIdAndDelete(id);
    res.json({ message: 'Option deleted successfully' });
  } catch (error) {
    console.error(`[API] Error deleting option:`, error);
    res.status(500).json({ message: 'Error deleting option', error: error.message });
  }
});

module.exports = router;
