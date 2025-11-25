const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const authMiddleware = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const nodemailer = require("nodemailer");
const Notification = require('../models/Notification');
const Attendance = require('../models/Attendance');

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

    // Also record daily attendance (upsert) for reporting
    try {
      const now = new Date();
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      await Attendance.findOneAndUpdate(
        { employee: updatedEmployee._id, date: day },
        { employee: updatedEmployee._id, date: day, status: attendance, updatedBy: req.user?._id },
        { upsert: true, new: true }
      );
    } catch (logErr) {
      console.warn('Failed to upsert attendance record:', logErr?.message);
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
    const eventData = req.body || {};
    const assignedBy = req.user?.username || "Admin"; // logged-in user from token

    // Basic validation (don't allow empty events that will cause downstream issues)
    if (!eventData || !eventData.eventName) {
      return res.status(400).json({ message: "eventName is required" });
    }

    const employee = await Employee.findById(id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Add assignedBy inside event data and set timestamps
    const eventWithAssignedBy = {
      ...eventData,
      assignedBy,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Push and save
    employee.events.push(eventWithAssignedBy);
    await employee.save();

    // Get the saved event (the last pushed)
    const savedEvent = employee.events[employee.events.length - 1];

    // Respond immediately with the persisted event and employee snapshot
    res.status(201).json({
      message: 'Event added successfully',
      event: savedEvent,
      employeeId: employee._id
    });

    // Background tasks: send emails, emit socket notifications, persist Notification
    (async () => {
      try {
        // Collect recipients (employee + team members)
        const recipients = [];
        if (employee.emailId) recipients.push(employee.emailId);

        if (Array.isArray(eventData.assignedTeamMembers)) {
          for (const memberId of eventData.assignedTeamMembers) {
            try {
              const member = await Employee.findById(memberId).lean();
              if (member?.emailId) recipients.push(member.emailId);
            } catch (e) {
              console.warn(`Failed to lookup team member ${memberId}:`, e);
            }
          }
        }
        const uniqueRecipients = [...new Set(recipients)];

        // Send emails in parallel but don't fail the API if they fail
        const emailPromises = uniqueRecipients.map(email =>
          sendTaskAssignedEmail(email, eventWithAssignedBy, assignedBy).catch(err => {
            console.error(`Failed to send event email to ${email}:`, err);
            return { error: String(err) };
          })
        );
        await Promise.allSettled(emailPromises);

        // Build a single notification payload with stable id
        const payload = {
          id: `employee-event-${employee._id}-${savedEvent._id}`,
          type: 'employee-event',
          title: `New Event for ${employee.employeeName || 'Employee'}`,
          body: `${eventWithAssignedBy.eventName} was added`,
          meta: { employeeId: employee._id, eventId: savedEvent._id, event: eventWithAssignedBy },
          url: `/teammanagement_salesleads/${employee._id}`,
          timestamp: new Date()
        };

        // Emit notification and entity event
        try {
          const io = req.app.get('io');
          if (io) {
            // Generic notification channel (bell/native notifications)
            io.emit('notification', payload);
            // Domain event with saved event so UI lists can append the actual object
            io.emit('employee-event', { ...payload, event: savedEvent });
            // targeted rooms
            io.to(`user-${employee._id}`).emit('notification', payload);
            io.to(`user-${employee._id}`).emit('employee-event', { ...payload, event: savedEvent });
            if (employee.emailId) {
              io.to(`email-${employee.emailId}`).emit('notification', payload);
              io.to(`email-${employee.emailId}`).emit('employee-event', { ...payload, event: savedEvent });
            }
          }
        } catch (emitErr) {
          console.error('Failed to emit socket notifications for employee event:', emitErr);
        }

        // Persist a Notification document for offline delivery (safe best-effort)
        try {
          await Notification.create({
            title: payload.title,
            body: payload.body,
            payload,
            email: employee.emailId || null
          });
        } catch (noteErr) {
          console.error('Failed to persist notification for employee event:', noteErr);
        }
      } catch (bgErr) {
        console.error('Background processing error for employee event:', bgErr);
      }
    })();

  } catch (error) {
    console.error("Error adding event:", error);
    // Provide helpful error message while avoiding leaking internals
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