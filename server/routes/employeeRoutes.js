const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const authMiddleware = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const nodemailer = require("nodemailer");
const Notification = require('../models/Notification');

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



// 📧 Email sending helper
async function sendTaskAssignedEmail(to, eventData, assignedBy) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const formattedDate = eventData.date
    ? new Date(eventData.date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "N/A";

  const mailOptions = {
    from: `"Auxin Task Manager" <${process.env.EMAIL_USER}>`,
    to,
    subject: `New Event Assigned: ${eventData.eventName}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding:20px; background:#f9f9f9;">
        <div style="max-width:600px; margin:auto; background:#fff; border-radius:8px; padding:20px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
          <h2 style="color:#007bff; margin-bottom:10px;">New Event Assigned</h2>
          <p><b>Event Name:</b> ${eventData.eventName}</p>
          <p><b>Event Type:</b> ${eventData.eventType || "N/A"}</p>
          <p><b>Date:</b> ${formattedDate}</p>
          <p><b>Time:</b> ${eventData.time || "N/A"}</p>
          <p><b>Assigned by:</b> ${assignedBy}</p>
          ${eventData.notes ? `<p><b>Notes:</b> ${eventData.notes}</p>` : ""}
          ${eventData.link ? `<p><b>Link:</b> <a href="${eventData.link}" style="color:#007bff;">${eventData.link}</a></p>` : ""}
          <p style="margin-top:20px; color:#555;">Please check your dashboard for more details.</p>
        </div>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}


// ====== STATIC ROUTES (No parameters) ======

// Get all employees
router.get('/', authMiddleware, async (req, res) => {
  try {
    const employees = await Employee.find().sort({ createdAt: -1 });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching employees', error: error.message });
  }
});

// Get all events across all employees - MUST COME BEFORE PARAMETERIZED ROUTES
router.get('/events', authMiddleware, async (req, res) => {
  try {
    const employees = await Employee.find({}, { employeeName: 1, events: 1 }).lean();
    const allEvents = [];
    for (const employee of employees) {
      if (Array.isArray(employee.events)) {
        for (const event of employee.events) {
          allEvents.push({
            employeeId: employee._id,
            employeeName: employee.employeeName,
            ...event,
          });
        }
      }
    }
    
    // Get the IO instance if available
    const io = req.app.get('io');
    
    // If socket.io is configured, emit a notification about events fetch
    if (io) {
      io.to('role-admin').emit('notification', {
        id: `events-fetch-${Date.now()}`,
        type: 'system',
        title: 'Events Data Accessed',
        message: `All events data was accessed by ${req.user?.username || 'a user'}`,
        timestamp: new Date()
      });
    }
    
    res.json(allEvents);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching all events', error: error.message });
  }
});

// Create new employee with profile photo support
router.post('/', authMiddleware,
  multer({ storage, fileFilter }).single('profilePhoto'),
  async (req, res) => {
    try {
      // Debugging logs
      console.log("Incoming employee body:", req.body);
      console.log("Incoming employee file:", req.file);

      const employeeData = req.body.data
        ? JSON.parse(req.body.data)
        : {};

      // Defensive: strip any incoming id fields to avoid duplicate _id insertion
      delete employeeData._id;
      delete employeeData.id;
      delete employeeData.__v;

      if (req.file) {
        employeeData.profilePhoto = `/uploads/employees/${req.file.filename}`;
      }

      const employee = new Employee(employeeData);
      const savedEmployee = await employee.save();

      // Emit lightweight event so frontends can update lists in real-time
      try {
        const io = req.app.get('io');
        if (io) {
          io.emit('employee-created', savedEmployee);
          if (savedEmployee.emailId) io.to(`email-${savedEmployee.emailId}`).emit('employee-created', savedEmployee);
          io.to('role-admin').emit('employee-created', savedEmployee);
        }
      } catch (emitErr) {
        console.warn('Failed to emit employee-created event:', emitErr);
      }
      
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

// ====== PARAMETERIZED ROUTES (With :id or other parameters) ======

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

// Update employee with profile photo support
router.put('/:id',
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

// ====== NESTED PARAMETERIZED ROUTES (With multiple parameters) ======

// Add event to an employee
router.post('/:id/events', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const eventData = req.body;
    const assignedBy = req.user?.username || "Admin"; // logged-in user from token

    const employee = await Employee.findById(id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Add assignedBy inside event data
    const eventWithAssignedBy = { ...eventData, assignedBy };
    employee.events.push(eventWithAssignedBy);
    await employee.save();

    // Collect recipients (employee + team members)
    const recipients = [];

    if (employee.emailId) recipients.push(employee.emailId);

    if (Array.isArray(eventData.assignedTeamMembers)) {
      for (const memberId of eventData.assignedTeamMembers) {
        const member = await Employee.findById(memberId);
        if (member?.emailId) recipients.push(member.emailId);
      }
    }

    const uniqueRecipients = [...new Set(recipients)];

    // Send email notification to all recipients
    for (const email of uniqueRecipients) {
      await sendTaskAssignedEmail(email, eventData, assignedBy);
    }

    // Emit browser notification (socket.io) and persist Notification for offline delivery
    try {
      const io = req.app.get('io');
      if (io) {
        const eventId = employee.events[employee.events.length - 1]._id;
        const payload = {
          id: `employee-event-${employee._id}-${Date.now()}`,
          type: 'employee-event',
          title: `New Event for ${employee.employeeName || 'Employee'}`,
          body: `${eventData.eventName || 'An event'} was added`,
          meta: { employeeId: employee._id, eventId, event: eventWithAssignedBy },
          timestamp: new Date()
        };

        // Emit to room keyed by employee id (compat) and to email-based room
        io.to(`user-${employee._id}`).emit('notification', payload);
        if (employee.emailId) io.to(`email-${employee.emailId}`).emit('notification', payload);

        // persist notification for offline delivery (associate email and employee id)
        await Notification.create({
          title: payload.title,
          body: payload.body,
          payload,
          userId: null, // employee may not map to a User; delivery by email or employee id rooms
          email: employee.emailId || null
        });
      }
    } catch (notifyErr) {
      console.error('Error emitting/persisting notification for employee event:', notifyErr);
    }
    
    res.status(201).json({
      message: 'Event added and email(s) sent successfully',
      employee
    });

  } catch (error) {
    console.error("Error adding event:", error);
    res.status(400).json({ message: 'Error adding event', error: error.message });
  }
});



// Get all events for an employee
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
    const { id, eventId } = req.params;
    const updatedData = req.body;
    const assignedBy = req.user?.username || "Admin";

    const employee = await Employee.findById(id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Find event by ID
    const event = employee.events.id(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Update event details
    Object.assign(event, updatedData);
    event.updatedAt = new Date();

    await employee.save();

    // ✅ Collect recipients (employee + assigned team members)
    const recipients = [];

    if (employee.emailId) recipients.push(employee.emailId);

    if (Array.isArray(updatedData.assignedTeamMembers)) {
      for (const memberId of updatedData.assignedTeamMembers) {
        const member = await Employee.findById(memberId);
        if (member?.emailId) recipients.push(member.emailId);
      }
    }

    const uniqueRecipients = [...new Set(recipients)];

    // ✅ Send update notification emails
    for (const email of uniqueRecipients) {
      await sendTaskAssignedEmail(email, updatedData, assignedBy);
    }

    // Browser notification + persist
    try {
      const io = req.app.get('io');
      if (io) {
        const payload = {
          id: `employee-event-update-${employee._id}-${Date.now()}`,
          type: 'employee-event-update',
          title: `Event updated for ${employee.employeeName || 'Employee'}`,
          body: `${updatedData.eventName || 'An event'} was updated`,
          meta: { employeeId: employee._id, eventId, event: updatedData },
          timestamp: new Date()
        };
        io.to(`user-${employee._id}`).emit('notification', payload);
        if (employee.emailId) io.to(`email-${employee.emailId}`).emit('notification', payload);
        await Notification.create({
          title: payload.title,
          body: payload.body,
          payload,
          userId: null,
          email: employee.emailId || null
        });
      }
    } catch (notifyErr) {
      console.error('Error emitting/persisting notification for employee event update:', notifyErr);
    }
    
    res.json({
      message: 'Event updated and email(s) sent successfully',
      event,
    });
  } catch (error) {
    console.error("Error updating event:", error);
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

module.exports = router;