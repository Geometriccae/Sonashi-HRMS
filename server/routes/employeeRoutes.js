const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const authMiddleware = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');

// Storage config for employee profile photos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/employees'); // save inside /uploads/employees
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // unique filename
  }
});

// File filter (only images allowed)
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files allowed'), false);
  }
};

// Get all employees
router.get('/', authMiddleware, async (req, res) => {
  try {
    const employees = await Employee.find().sort({ createdAt: -1 });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching employees', error: error.message });
  }
});

// Get single employee by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    res.json(employee);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching employee', error: error.message });
  }
});

// Create new employee with profile photo support
router.post(
  '/',
  authMiddleware,
  multer({ storage, fileFilter }).single('profilePhoto'),
  async (req, res) => {
    try {
      // Debugging logs
      console.log("Incoming employee body:", req.body);
      console.log("Incoming employee file:", req.file);

      const employeeData = req.body.data
        ? JSON.parse(req.body.data)
        : {};

      if (req.file) {
        employeeData.profilePhoto = `/uploads/employees/${req.file.filename}`;
      }

      const employee = new Employee(employeeData);
      const savedEmployee = await employee.save();
      res.status(201).json(savedEmployee);
    } catch (error) {
      console.error("Create employee error:", error);
      res.status(400).json({
        message: "Error creating employee",
        error: error.message,
      });
    }
  }
);

// Update employee with profile photo support
router.put(
  '/:id',
  authMiddleware,
  multer({ storage, fileFilter }).single('profilePhoto'),
  async (req, res) => {
    try {
      // Debugging logs
      console.log("Update - Incoming employee body:", req.body);
      console.log("Update - Incoming employee file:", req.file);
      console.log("Update - Employee ID:", req.params.id);

      let updateData = req.body.data
        ? JSON.parse(req.body.data)
        : {};

      // Add profile photo path if file was uploaded
      if (req.file) {
        updateData.profilePhoto = `/uploads/employees/${req.file.filename}`;
        console.log("Update - Profile photo path:", updateData.profilePhoto);
      }

      const updatedEmployee = await Employee.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      );

      if (!updatedEmployee) {
        return res.status(404).json({ message: 'Employee not found' });
      }

      res.json(updatedEmployee);
    } catch (error) {
      console.error("Update employee error:", error);
      res.status(400).json({
        message: 'Error updating employee',
        error: error.message,
      });
    }
  }
);

// Delete employee
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const deletedEmployee = await Employee.findByIdAndDelete(req.params.id);
    if (!deletedEmployee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting employee', error: error.message });
  }
});

// Get employees by department
router.get('/department/:department', authMiddleware, async (req, res) => {
  try {
    const employees = await Employee.find({ 
      department: req.params.department 
    }).sort({ employeeName: 1 });
    
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching employees by department', error: error.message });
  }
});

// Update employee attendance
router.patch('/:id/attendance', authMiddleware, async (req, res) => {
  try {
    const { attendance } = req.body;
    
    if (!attendance || !['Onsite', 'Leave'].includes(attendance)) {
      return res.status(400).json({ message: 'Valid attendance status required (Onsite/Leave)' });
    }

    const updatedEmployee = await Employee.findByIdAndUpdate(
      req.params.id,
      { attendance },
      { new: true, runValidators: true }
    );

    if (!updatedEmployee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.json({ 
      message: 'Attendance updated successfully', 
      employee: updatedEmployee 
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating attendance', error: error.message });
  }
});

// Add project to employee
router.post('/:id/projects', authMiddleware, async (req, res) => {
  try {
    const { project } = req.body;
    
    if (!project) {
      return res.status(400).json({ message: 'Project name is required' });
    }

    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Check if project already exists to avoid duplicates
    if (!employee.assignedProjects.includes(project)) {
      employee.assignedProjects.push(project);
      await employee.save();
    }

    res.status(201).json({ 
      message: 'Project added successfully', 
      employee 
    });
  } catch (error) {
    res.status(500).json({ message: 'Error adding project', error: error.message });
  }
});

// Remove project from employee
router.delete('/:id/projects', authMiddleware, async (req, res) => {
  try {
    const { project } = req.body;
    
    if (!project) {
      return res.status(400).json({ message: 'Project name is required' });
    }

    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    employee.assignedProjects = employee.assignedProjects.filter(
      p => p !== project
    );
    
    await employee.save();

    res.json({ 
      message: 'Project removed successfully', 
      employee 
    });
  } catch (error) {
    res.status(500).json({ message: 'Error removing project', error: error.message });
  }
});

// Get employees by role
router.get('/role/:role', authMiddleware, async (req, res) => {
  try {
    const employees = await Employee.find({ 
      role: req.params.role 
    }).sort({ employeeName: 1 });
    
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching employees by role', error: error.message });
  }
});

// Search employees by name or ID
router.get('/search/:query', authMiddleware, async (req, res) => {
  try {
    const query = req.params.query;
    const employees = await Employee.find({
      $or: [
        { employeeName: { $regex: query, $options: 'i' } },
        { employeeId: { $regex: query, $options: 'i' } }
      ]
    }).sort({ employeeName: 1 });
    
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: 'Error searching employees', error: error.message });
  }
});


// **************************************** CreateEvent Related routes *******************

// Add event to a employee
router.post('/:id/events', authMiddleware, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    employee.events.push(req.body); // req.body should contain event data
    await employee.save();

    res.status(201).json({ message: 'Event added successfully', employee });
  } catch (error) {
    res.status(400).json({ message: 'Error adding event', error: error.message });
  }
});

// Get all events for a employee
router.get('/:id/events', authMiddleware, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id).select('events');
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    res.json(employee.events);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching events', error: error.message });
  }
});

// Update an event
router.put('/:id/events/:eventId', authMiddleware, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Find event by ID
    const event = employee.events.id(req.params.eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Update event fields
    Object.assign(event, req.body);

    await employee.save();

    res.json({ message: 'Event updated successfully', event });
  } catch (error) {
    res.status(500).json({ message: 'Error updating event', error: error.message });
  }
});

// Delete an event
router.delete('/:id/events/:eventId', authMiddleware, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    employee.events = employee.events.filter(e => e._id.toString() !== req.params.eventId);
    await employee.save();

    res.json({ message: 'Event deleted successfully', employee });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting event', error: error.message });
  }
});


// Get all events across all clients
router.get('/events', authMiddleware, async (req, res) => {
  try {
    const clients = await Employee.find({}, { companyName: 1, events: 1 }).lean();
    const all = [];
    for (const c of clients) {
      if (Array.isArray(c.events)) {
        for (const e of c.events) {
          all.push({
            clientId: c._id,
            clientName: c.companyName,
            ...e,
          });
        }
      }
    }
    res.json(all);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching all events', error: error.message });
  }
});


module.exports = router;