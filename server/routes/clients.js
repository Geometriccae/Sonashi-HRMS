const express = require('express');
const router = express.Router();
const Client = require('../models/Client');
const authMiddleware = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');

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
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files allowed'), false);
  }
};

// Get all clients
router.get('/', authMiddleware, async (req, res) => {
  try {
    const clients = await Client.find().sort({ createdAt: -1 });
    res.json(clients);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching clients', error: error.message });
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

// Create new client
// router.post('/', authMiddleware, async (req, res) => {
//   try {
//     const client = new Client(req.body);
//     const savedClient = await client.save();
//     res.status(201).json(savedClient);
//   } catch (error) {
//     res.status(400).json({ message: 'Error creating client', error: error.message });
//   }
// });

// router.post(
//   '/',
//   authMiddleware,
//   multer({ storage, fileFilter }).single('profilePicture'),
//   async (req, res) => {
//     try {
//       const clientData = JSON.parse(req.body.data); // Send other fields as JSON string
//       if (req.file) {
//         clientData.profilePicture = `/uploads/clients/${req.file.filename}`;
//       }
//       const client = new Client(clientData);
//       const savedClient = await client.save();
//       res.status(201).json(savedClient);
//     } catch (error) {
//       res.status(400).json({ message: 'Error creating client', error: error.message });
//     }
//   }
// );


router.post(
  '/',
  authMiddleware,
  multer({ storage, fileFilter }).single('profilePicture'),
  async (req, res) => {
    try {
      // Debugging logs
      console.log("Incoming body:", req.body);
      console.log("Incoming file:", req.file);

      const clientData = req.body.data
        ? JSON.parse(req.body.data)
        : {};

      if (req.file) {
        clientData.profilePicture = `/uploads/clients/${req.file.filename}`;
      }

      const client = new Client(clientData);
      const savedClient = await client.save();
      res.status(201).json(savedClient);
    } catch (error) {
      console.error("Create client error:", error); // log the real cause
      res.status(400).json({
        message: "Error creating client2",
        error: error.message,
        // stack: error.stack, // include stack temporarily
      });
    }
  }
);


// Update client
// Update client with file upload support
router.put(
  '/:id',
  authMiddleware,
  multer({ storage, fileFilter }).single('profilePicture'),
  async (req, res) => {
    try {
      // Debugging logs
      console.log("Update - Incoming body:", req.body);
      console.log("Update - Incoming file:", req.file);
      console.log("Update - Client ID:", req.params.id);

      let updateData = req.body.data
        ? JSON.parse(req.body.data)
        : {};

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
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    client.events.push(req.body); // req.body should contain event data
    await client.save();

    res.status(201).json({ message: 'Event added successfully', client });
  } catch (error) {
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
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    // Find event by ID
    const event = client.events.id(req.params.eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Update event fields
    Object.assign(event, req.body);

    await client.save();

    res.json({ message: 'Event updated successfully', event });
  } catch (error) {
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
    res.status(500).json({ message: 'Error fetching all events', error: error.message });
  }
});


module.exports = router;


