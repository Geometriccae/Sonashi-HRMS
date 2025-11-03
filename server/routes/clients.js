const express = require('express');
const router = express.Router();
const Client = require('../models/Client');
const Employee = require('../models/Employee');
const Notification = require('../models/Notification');
const authMiddleware = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const nodemailer = require("nodemailer");

// Storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/clients'); // save inside /uploads/clients
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // unique filename
  }
});

// File filter (optional, only images allowed)
const fileFilter = (req, file, cb) => {
  if (file.mimetype && file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files allowed'), false);
  }
};

// 📧 Background email sender (non-blocking)
async function sendEventEmailsInBackground(eventData, assignedBy, client) {
  try {
    console.log("📧 Starting email background process...");
    
    // Collect recipients from event data
    const recipients = [];

    // Add client email if available
    if (client.email) {
      recipients.push(client.email);
      console.log(`📧 Added client email: ${client.email}`);
    }

    // Add assigned team members
    if (Array.isArray(eventData.assignedTeamMembers) && eventData.assignedTeamMembers.length > 0) {
      console.log(`📧 Processing ${eventData.assignedTeamMembers.length} team members`);
      
      for (const memberId of eventData.assignedTeamMembers) {
        try {
          const member = await Employee.findById(memberId);
          if (member?.emailId) {
            recipients.push(member.emailId);
            console.log(`📧 Added team member email: ${member.emailId}`);
          }
        } catch (memberError) {
          console.error(`Error finding employee ${memberId}:`, memberError);
        }
      }
    }

    const uniqueRecipients = [...new Set(recipients)];
    console.log(`📧 Final recipient list:`, uniqueRecipients);

    // Send emails in parallel for better performance
    if (uniqueRecipients.length > 0) {
      const emailResults = await Promise.allSettled(
        uniqueRecipients.map(email => 
          sendClientEventEmail(email, eventData, assignedBy, client.clientName || client.companyName)
        )
      );
      
      // Log email results
      emailResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          console.log(`✅ Email sent to: ${uniqueRecipients[index]}`);
        } else {
          console.error(`❌ Failed to send email to ${uniqueRecipients[index]}:`, result.reason);
        }
      });
    } else {
      console.log("📧 No recipients found for email notification");
    }
  } catch (emailError) {
    console.error("❌ Background email error:", emailError);
  }
}

// 📧 Client Event Email Template
async function sendClientEventEmail(to, eventData, assignedBy, clientName) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Verify transporter configuration
    await transporter.verify();
    console.log(`📧 Email transporter verified, sending to: ${to}`);

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
      subject: `New Client Event: ${eventData.eventName} - ${clientName}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding:20px; background:#f9f9f9;">
          <div style="max-width:600px; margin:auto; background:#fff; border-radius:8px; padding:20px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
            <h2 style="color:#007bff; margin-bottom:10px;">New Client Event Assigned</h2>
            <p><b>Client:</b> ${clientName}</p>
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

    const result = await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${to}, Message ID: ${result.messageId}`);
    return result;
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
    throw error;
  }
}

// Get all clients
// router.get('/', authMiddleware, async (req, res) => {
//   try {
//     const clients = await Client.find().sort({ createdAt: -1 });
//     res.json(clients);
//   } catch (error) {
//     res.status(500).json({ message: 'Error fetching clients', error: error.message });
//   }
// });

// Get all clients
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id; // from authMiddleware
    const userRole = req.user.role; // assuming you store role like "admin", "sales_executive"
    const { followupStatus, startDate, endDate } = req.query;

    const baseFilter = {};
    if (followupStatus) baseFilter.followupStatus = followupStatus;
    if (startDate || endDate) {
      baseFilter.createdAt = {};
      if (startDate) baseFilter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23,59,59,999);
        baseFilter.createdAt.$lte = end;
      }
    }

    let clients;
    if (userRole === 'admin') {
      clients = await Client.find(baseFilter).sort({ createdAt: -1 });
    } else if (userRole === 'sales_executive') {
      clients = await Client.find({
        ...baseFilter,
        $or: [{ createdBy: userId }, { assignedTo: userId }]
      }).sort({ createdAt: -1 });
    } else {
      clients = await Client.find({ ...baseFilter, createdBy: userId }).sort({ createdAt: -1 });
    }
    res.json(clients);
  } catch (err) {
    console.error('GET /clients error:', err);
    res.status(500).json({ message: 'Error fetching clients', error: err.message });
  }
});

// Get single client by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    res.json(client);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching client', error: error.message });
  }
});

router.post('/', authMiddleware,
  multer({ storage, fileFilter }).single('profilePicture'),
  async (req, res) => {
    try {
      console.log("Incoming body:", req.body);
      console.log("Incoming file:", req.file);

      // Support both JSON body and multipart/form-data with 'data' field.
      let clientData = {};
      if (req.body) {
        if (req.body.data) {
          try {
            clientData = JSON.parse(req.body.data);
          } catch (parseErr) {
            console.warn("Failed to parse req.body.data, falling back to req.body:", parseErr);
            clientData = req.body;
          }
        } else {
          clientData = req.body;
        }
      }

      // Defensive: remove any client-provided id values to avoid duplicate _id insertion
      // Clients must never supply _id when creating a new resource.
      delete clientData._id;
      delete clientData.id;
      delete clientData.__v;

      // Basic validation: companyName is required by schema
      if (!clientData.companyName || clientData.companyName.toString().trim() === "") {
        return res.status(400).json({ message: "companyName is required" });
      }

      // Add ownership information
      clientData.createdBy = req.user.id;

      // If sales executive is creating → assign to self
      if (req.user.role === 'sales_executive') {
        clientData.assignedTo = req.user.id;
      }
      // If admin creating → can assign manually, else assign to self
      else if (req.user.role === 'admin' && !clientData.assignedTo) {
        clientData.assignedTo = req.user.id;
      }

      if (req.file) {
        clientData.profilePicture = `/uploads/clients/${req.file.filename}`;
      }

      // Try to create; on duplicate-key, attempt to find the existing document and return it
      let savedClient;
      try {
        const client = new Client(clientData);
        savedClient = await client.save();
      } catch (createErr) {
        // Handle duplicate-key on _id or other unique index
        if (createErr && createErr.code === 11000) {
          console.warn('Duplicate key error while creating client. Attempting to resolve to existing record.', createErr);
          // Try to find existing by email or companyName (best-effort)
          const lookup = {};
          if (clientData.email) lookup.email = clientData.email;
          if (clientData.companyName) lookup.companyName = clientData.companyName;
          const existing = Object.keys(lookup).length ? await Client.findOne(lookup).lean() : null;
          if (existing) {
            // Return existing record so frontend sees the saved client instead of a raw DB error
            return res.status(200).json(existing);
          }
          // If we can't resolve, return a 409 with a helpful message
          return res.status(409).json({ message: 'Duplicate key error creating client', error: createErr.message });
        }
        // otherwise rethrow
        throw createErr;
      }

      // Get the IO instance
      const io = req.app.get('io');
      if (io) {
        // Emit a simple creation event so frontends can refresh optimistically
        try {
          io.emit('client-created', savedClient);
          if (savedClient.assignedTo) {
            io.to(`user-${savedClient.assignedTo}`).emit('client-created', savedClient);
          }
          // also notify role rooms for real-time updates
          io.to('role-admin').emit('client-created', savedClient);
          io.to('role-sales_executive').emit('client-created', savedClient);
        } catch (emitErr) {
          console.warn('Failed to emit client-created event:', emitErr);
        }

        const notificationPayloadBase = {
          id: `client-${savedClient._id}-${Date.now()}`,
          type: 'client',
          title: 'New Client Added',
          clientId: savedClient._id,
          url: `/clients/${savedClient._id}`,
          timestamp: new Date()
        };

        // If client has assignedTo field, send targeted notification to that user and persist
        if (savedClient.assignedTo) {
          const personalPayload = {
            ...notificationPayloadBase,
            message: `Client "${savedClient.companyName}" has been assigned to you`,
            body: `Client "${savedClient.companyName}" has been assigned to you`,
            targetUserId: savedClient.assignedTo
          };

          io.to(`user-${savedClient.assignedTo}`).emit('notification', personalPayload);
          console.log(`Sent client notification to user: ${savedClient.assignedTo}`);

          // persist notification for that user
          try {
            const note = new Notification({
              title: personalPayload.title,
              body: personalPayload.body,
              payload: personalPayload,
              userId: savedClient.assignedTo
            });
            await note.save();
          } catch (noteErr) {
            console.error('Failed to persist notification for assigned user:', noteErr);
          }
        }

        // Broadcast role notifications (admin and sales_executive) and persist them
        try {
          const adminPayload = {
            ...notificationPayloadBase,
            message: `New client "${savedClient.companyName}" has been added`,
            body: `New client "${savedClient.companyName}" has been added`,
            targetRole: 'admin'
          };
          io.to('role-admin').emit('notification', adminPayload);
          console.log('Sent client notification to role-admin');
          const adminNotice = new Notification({ title: adminPayload.title, body: adminPayload.body, payload: adminPayload, role: 'admin' });
          await adminNotice.save();
        } catch (roleErr) {
          console.error('Error emitting/persisting admin role notification:', roleErr);
        }

        try {
          const salesPayload = {
            ...notificationPayloadBase,
            message: `New client "${savedClient.companyName}" has been added`,
            body: `New client "${savedClient.companyName}" has been added`,
            targetRole: 'sales_executive'
          };
          io.to('role-sales_executive').emit('notification', salesPayload);
          console.log('Sent client notification to role-sales_executive');
          const salesNotice = new Notification({ title: salesPayload.title, body: salesPayload.body, payload: salesPayload, role: 'sales_executive' });
          await salesNotice.save();
        } catch (roleErr) {
          console.error('Error emitting/persisting sales_executive role notification:', roleErr);
        }
      }

      res.status(201).json(savedClient);
    } catch (error) {
      console.error("Create client error:", error);
      const message = error?.message || "Error creating client";
      res.status(400).json({ message, error: message });
    }
  }
);

// Update client with file upload support
router.put('/:id', authMiddleware, // keep sales_executive also admin separately if needed
  multer({ storage, fileFilter }).single('profilePicture'),
  async (req, res) => {
    try {
      // Debugging logs
      console.log("Update - Incoming body:", req.body);
      console.log("Update - Incoming file:", req.file);
      console.log("Update - Client ID:", req.params.id);
      
      let updateData = req.body.data 
        ? JSON.parse(req.body.data)
        : req.body;
        
      // Add profile picture path if file was uploaded
      if (req.file) {
        updateData.profilePicture = `/uploads/clients/${req.file.filename}`;
        console.log("Update - Profile picture path:", updateData.profilePicture);
      }
      
      // Convert date strings to Date objects if they exist
      if (updateData.projectTimelineStart) {
        updateData.projectTimelineStart = new Date(updateData.projectTimelineStart);
      }
      if (updateData.projectTimelineEnd) {
        updateData.projectTimelineEnd = new Date(updateData.projectTimelineEnd);
      }
      if (updateData.followUpDate) {
        updateData.followUpDate = new Date(updateData.followUpDate);
      }
      
      // Convert opportunityValue to number if it exists
      if (updateData.opportunityValue) {
        updateData.opportunityValue = Number(updateData.opportunityValue);
      }
      
      const updatedClient = await Client.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      );
      
      if (!updatedClient) {
        return res.status(404).json({ message: 'Client not found' });
      }
      
      res.json(updatedClient);
    } catch (error) {
      console.error("Update client error:", error);
      res.status(400).json({
        message: 'Error updating client',
        error: error.message,
        // stack: error.stack, // include stack temporarily
      });
    }
  }
);

// Delete client
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const deletedClient = await Client.findByIdAndDelete(req.params.id);
    if (!deletedClient) {
      return res.status(404).json({ message: 'Client not found' });
    }
    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting client', error: error.message });
  }
});

// **************************************** CreateEvent Related routes *******************
// Add event to a client
router.post('/:id/events', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const eventData = req.body;
    const assignedBy = req.user?.username || "Admin";
    console.log(`🔄 Adding event to client ${id}`, eventData);
    
    const client = await Client.findById(id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    
    // Add assignedBy to event data
    const eventWithAssignedBy = { ...eventData, assignedBy };
    client.events.push(eventWithAssignedBy);
    
    // Save immediately without waiting for emails
    await client.save();
    console.log("Event saved to database");
    
    // Send response first for better UX
    res.status(201).json({
      message: 'Event added successfully',
      client
    });
    
    // Emit socket notification to connected clients
    try {
      const io = req.app.get('io');
      if (io) {
        const payload = {
          id: `client-event-${client._id}-${Date.now()}`,
          type: 'client-event',
          title: 'New Client Event',
          body: `${eventData.eventName || 'An event'} was added for ${client.companyName || 'a client'}`,
          meta: { clientId: client._id, eventId: client.events[client.events.length - 1]._id, event: eventWithAssignedBy },
          timestamp: new Date()
        };

        // Broadcast (existing)
        io.emit('notification', payload);
        console.log('Emitted client event notification to all (broadcast)');

        // Targeted emit to sockets that joined this specific client page
        try {
          io.to(`client-${client._id}`).emit('client-event', payload);
          console.log(`Emitted client-event to room client-${client._id}`);
        } catch (roomErr) {
          console.warn(`Failed to emit client-event to room client-${client._id}:`, roomErr);
        }

        // persist broadcast for sales_executive role so offline users get it
        const eventNotice = new Notification({
          title: payload.title,
          body: payload.body,
          payload,
          role: 'sales_executive'
        });
        await eventNotice.save();
      }
    } catch (emitErr) {
      console.error('Error emitting socket notification for client event:', emitErr);
    }
    
    // Send emails in background (non-blocking)
    sendEventEmailsInBackground(eventData, assignedBy, client)
      .then(() => console.log("Background email process completed"))
      .catch(err => console.error("Background email process failed:", err));
  } catch (error) {
    console.error("Error adding event:", error);
    res.status(400).json({ message: 'Error adding event', error: error.message });
  }
});

// Get all events for a client
router.get('/:id/events', authMiddleware, async (req, res) => {
  try {
    const client = await Client.findById(req.params.id).select('events');
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    res.json(client.events);
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
    console.log(`🔄 Updating event ${eventId} for client ${id}`, updatedData);
    
    const client = await Client.findById(id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    
    // Find event by ID
    const event = client.events.id(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Update event details
    Object.assign(event, updatedData);
    event.updatedAt = new Date();
    
    // Save immediately
    await client.save();
    console.log("Event updated in database");
    
    // Send response first
    res.json({
      message: 'Event updated successfully',
      event
    });
    
    // Send emails in background
    sendEventEmailsInBackground(updatedData, assignedBy, client)
      .then(() => console.log("Background email process completed"))
      .catch(err => console.error("Background email process failed:", err));
  } catch (error) {
    console.error("Error updating event:", error);
    res.status(500).json({ message: 'Error updating event', error: error.message });
  }
});

// Delete an event
router.delete('/:id/events/:eventId', authMiddleware, async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    client.events = client.events.filter(e => e._id.toString() !== req.params.eventId);
    await client.save();
    res.json({ message: 'Event deleted successfully', client });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting event', error: error.message });
  }
});

// Get all events across all clients
router.get('/events', authMiddleware, async (req, res) => {
  try {
    const clients = await Client.find({}, { companyName: 1, events: 1 }).lean();
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
    console.error('Error fetching all events:', error);
    res.status(500).json({ message: 'Error fetching all events', error: error.message });
  }
});

module.exports = router;
