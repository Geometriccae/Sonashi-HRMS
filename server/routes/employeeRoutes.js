const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const authMiddleware = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const nodemailer = require("nodemailer");
const Notification = require('../models/Notification');
const Attendance = require('../models/Attendance');
const fs = require('fs'); // Add this import

const DEFAULT_TASK_REMINDERS = [1, 15, 60, 180, 1440];

const normalizeReminderList = (reminders) => {
  if (!Array.isArray(reminders)) return [...DEFAULT_TASK_REMINDERS];
  const sanitized = reminders
    .map((minutes) => Number(minutes))
    .filter((minutes) => Number.isFinite(minutes) && minutes >= 0);
  return sanitized.length > 0 ? sanitized : [...DEFAULT_TASK_REMINDERS];
};

const deriveEventDateTime = (dateValue, timeValue) => {
  if (!dateValue) return null;

  const normalizeDateString = (value) => {
    if (!value) return null;
    if (typeof value === 'string') {
      // if ISO string, split at T to ensure date-only portion
      return value.split('T')[0];
    }
    if (value instanceof Date && !isNaN(value.getTime())) {
      return value.toISOString().split('T')[0];
    }
    return null;
  };

  const baseDateStr = normalizeDateString(dateValue);
  if (!baseDateStr) return null;

  if (timeValue) {
    return new Date(`${baseDateStr}T${timeValue}:00`);
  }
  return new Date(baseDateStr);
};

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

// ========== CREATE UPLOAD MIDDLEWARE ==========
const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});
// =============================================

// ?? Email sending helper
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
router.post('/', authMiddleware, upload.single('profilePhoto'), async (req, res) => {
  try {
    console.log("Incoming employee body:", req.body);
    console.log("Incoming employee file:", req.file);

    let employeeData = req.body.data
      ? JSON.parse(req.body.data)
      : {};

    // Defensive: strip any incoming id fields to avoid duplicate _id insertion
    delete employeeData._id;
    delete employeeData.id;
    delete employeeData.__v;

    // Check for duplicate email BEFORE creating
    if (employeeData.emailId) {
      const existingEmployee = await Employee.findOne({ 
        emailId: employeeData.emailId.toLowerCase().trim() 
      });
      
      if (existingEmployee) {
        return res.status(400).json({ 
          message: `Employee with email "${employeeData.emailId}" already exists` 
        });
      }
    }

    // Check for duplicate employeeId (optional but good practice)
    if (employeeData.employeeId) {
      const existingEmployeeById = await Employee.findOne({ 
        employeeId: employeeData.employeeId 
      });
      
      if (existingEmployeeById) {
        return res.status(400).json({ 
          message: `Employee with ID "${employeeData.employeeId}" already exists` 
        });
      }
    }

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
    
    // Handle duplicate key error specifically
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const value = error.keyValue[field];
      return res.status(400).json({
        message: `Employee with ${field} "${value}" already exists`,
        error: `Duplicate ${field}`
      });
    }
    
    res.status(400).json({
      message: "Error creating employee",
      error: error.message,
    });
  }
});
// Update employee
router.put('/:id', authMiddleware, upload.single('profilePhoto'), async (req, res) => {
  try {
    console.log('🔧 UPDATE EMPLOYEE - START');
    console.log('Employee ID:', req.params.id);
    console.log('Request body:', req.body);
    console.log('Request file:', req.file);

    let updateData = {};
    if (req.body.data) {
      try {
        updateData = JSON.parse(req.body.data);
        console.log('Parsed updateData:', updateData);
        console.log('assignedProjects:', updateData.assignedProjects);
        console.log('Type of assignedProjects:', typeof updateData.assignedProjects);
        
        // Ensure assignedProjects is an array
        if (updateData.assignedProjects && !Array.isArray(updateData.assignedProjects)) {
          console.error('assignedProjects is not an array:', updateData.assignedProjects);
          return res.status(400).json({ 
            message: 'assignedProjects must be an array' 
          });
        }
      } catch (parseErr) {
        console.error('JSON parse error:', parseErr);
        return res.status(400).json({ message: 'Invalid JSON data' });
      }
    } else {
      updateData = req.body;
    }

    // Check for duplicate email (only if email is being updated)
    if (updateData.emailId) {
      const existingEmployee = await Employee.findOne({ 
        emailId: updateData.emailId.toLowerCase().trim(),
        _id: { $ne: req.params.id } // Exclude current employee
      });
      
      if (existingEmployee) {
        return res.status(400).json({ 
          message: `Another employee with email "${updateData.emailId}" already exists` 
        });
      }
    }

    // Handle profile photo
    if (req.file) {
      // Delete old photo if exists
      const currentEmployee = await Employee.findById(req.params.id);
      if (currentEmployee && currentEmployee.profilePhoto) {
        const oldPhotoPath = path.join(__dirname, '..', currentEmployee.profilePhoto);
        if (fs.existsSync(oldPhotoPath)) {
          fs.unlinkSync(oldPhotoPath);
        }
      }
      updateData.profilePhoto = `/uploads/employees/${req.file.filename}`;
    }

    // Update employee
    const updatedEmployee = await Employee.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedEmployee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    console.log('✅ Employee updated successfully:', updatedEmployee._id);
    res.json({
      message: 'Employee updated successfully',
      employee: updatedEmployee
    });

  } catch (error) {
    console.error('❌ Error updating employee:', error);
    
    // Handle duplicate key error specifically
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const value = error.keyValue[field];
      return res.status(400).json({ 
        message: `Another employee with ${field} "${value}" already exists`,
        error: `Duplicate ${field}`
      });
    }
    
    res.status(500).json({ 
      message: 'Error updating employee', 
      error: error.message,
      details: error.toString()
    });
  }
});

// Bulk delete employees
router.post('/bulk-delete', authMiddleware, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'No employee IDs provided' });
    }

    console.log(`Bulk deleting employees: ${ids.length} IDs provided`);

    // 1. Delete related EmployeeDocuments
    const EmployeeDocument = require('../models/EmployeeDocuments');
    const docResult = await EmployeeDocument.deleteMany({ employeeId: { $in: ids } });
    console.log(`Deleted ${docResult.deletedCount} related employee documents`);

    // 2. Delete Employees
    const result = await Employee.deleteMany({ _id: { $in: ids } });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'No employees found to delete' });
    }

    res.json({
      message: 'Employees and related data deleted successfully',
      deletedCount: result.deletedCount,
      deletedDocuments: docResult.deletedCount
    });
  } catch (error) {
    console.error('Error bulk deleting employees:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

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



// Delete single employee
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Delete related EmployeeDocuments
    const EmployeeDocument = require('../models/EmployeeDocuments');
    await EmployeeDocument.deleteMany({ employeeId: id });

    // 2. Delete Employee
    const result = await Employee.findByIdAndDelete(id);

    if (!result) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ message: 'Error deleting employee', error: error.message });
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
    eventWithAssignedBy.reminders = normalizeReminderList(eventWithAssignedBy.reminders);

    // Push and save
    employee.events.push(eventWithAssignedBy);
    await employee.save();

    // Get the saved event (the last pushed)
    const savedEvent = employee.events[employee.events.length - 1];
    const savedEventSnapshot = typeof savedEvent.toObject === 'function'
      ? savedEvent.toObject({ depopulate: true })
      : JSON.parse(JSON.stringify(savedEvent));

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

    // Schedule reminders for the assigned task/event
    if (savedEventSnapshot.reminders && savedEventSnapshot.reminders.length > 0) {
      const eventDateTime = deriveEventDateTime(savedEventSnapshot.date, savedEventSnapshot.time);

      savedEventSnapshot.reminders.forEach((reminderMinutes) => {
        if (!eventDateTime || isNaN(eventDateTime.getTime())) return;
        const reminderTime = new Date(eventDateTime.getTime() - reminderMinutes * 60000);
        const delay = reminderTime.getTime() - Date.now();
        if (delay <= 0) return;

        setTimeout(() => {
          const io = req.app.get('io');
          if (!io) return;

          const reminderPayload = {
            id: `task-reminder-${savedEventSnapshot._id}-${reminderMinutes}`,
            type: 'task-reminder',
            title: `Reminder: ${savedEventSnapshot.eventName || 'Task'}`,
            body: `Task in ${reminderMinutes} minutes`,
            meta: {
              employeeId: employee._id,
              eventId: savedEventSnapshot._id,
              event: savedEventSnapshot,
              reminderMinutes,
            },
            url: `/teammanagement_salesleads/${employee._id}`,
            timestamp: new Date(),
          };

          io.emit('task-reminder', reminderPayload);

          const recipientUserIds = new Set();
          if (req.user?.id) recipientUserIds.add(String(req.user.id));
          if (employee?._id) recipientUserIds.add(String(employee._id));
          (savedEventSnapshot.assignedTeamMembers || []).forEach((memberId) => {
            if (memberId) recipientUserIds.add(String(memberId));
          });

          recipientUserIds.forEach((userId) => {
            io.to(`user-${userId}`).emit('notification', reminderPayload);
            io.to(`user-${userId}`).emit('task-reminder', reminderPayload);
          });
        }, delay);
      });
    }

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

    // ? Collect recipients (employee + assigned team members)
    const recipients = [];

    if (employee.emailId) recipients.push(employee.emailId);

    if (Array.isArray(updatedData.assignedTeamMembers)) {
      for (const memberId of updatedData.assignedTeamMembers) {
        try {
          const member = await Employee.findById(memberId);
          if (member?.emailId) recipients.push(member.emailId);
        } catch (e) {
          console.warn(`Failed to lookup team member ${memberId}:`, e);
        }
      }
    }

    const uniqueRecipients = [...new Set(recipients)];

    // ? Send update notification emails
    for (const email of uniqueRecipients) {
      await sendTaskAssignedEmail(email, updatedData, assignedBy).catch(err => console.error("Email error:", err));
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

    // ? Reschedule Reminders (Add new setTimeouts)
    if (updatedData.reminders && updatedData.reminders.length > 0) {
      const eventDateTime = deriveEventDateTime(updatedData.date, updatedData.time);

      updatedData.reminders.forEach((reminderMinutes) => {
        if (!eventDateTime || isNaN(eventDateTime.getTime())) return;
        const reminderTime = new Date(eventDateTime.getTime() - reminderMinutes * 60000);
        const delay = reminderTime.getTime() - Date.now();

        if (delay > 0) {
          setTimeout(() => {
            const io = req.app.get('io');
            if (!io) return;

            const reminderPayload = {
              id: `task-reminder-${eventId}-${reminderMinutes}-${Date.now()}`,
              type: 'task-reminder',
              title: `Reminder: ${updatedData.eventName || 'Task'}`,
              body: `Task in ${reminderMinutes} minutes`,
              meta: {
                employeeId: employee._id,
                eventId: eventId,
                event: updatedData,
                reminderMinutes,
              },
              url: `/teammanagement_salesleads/${employee._id}`,
              timestamp: new Date(),
            };

            io.emit('task-reminder', reminderPayload);

            const recipientUserIds = new Set();
            if (req.user?.id) recipientUserIds.add(String(req.user.id));
            if (employee?._id) recipientUserIds.add(String(employee._id));
            (updatedData.assignedTeamMembers || []).forEach((memberId) => {
              if (memberId) recipientUserIds.add(String(memberId));
            });

            recipientUserIds.forEach((userId) => {
              io.to(`user-${userId}`).emit('notification', reminderPayload);
              io.to(`user-${userId}`).emit('task-reminder', reminderPayload);
            });
          }, delay);
        }
      });
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