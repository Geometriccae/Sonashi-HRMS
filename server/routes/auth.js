const express = require('express');
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require('../models/User'); // your Mongoose model
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');


router.post('/login', async (req, res) => {
  const { username, password } = req.body;


  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    // Plain-text password check fallback if passwords are not hashed yet
    let passwordOk = false;
    if (user.password && user.password.startsWith('$2')) {
      passwordOk = await bcrypt.compare(password, user.password);
    } else {
      passwordOk = user.password === password;
    }
    if (!passwordOk) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    console.log("Found user:", user);
    console.log("User username:", user.username);
    res.status(200).json({
      message: 'Login successful',
      token,
      user,
      username: user.username,

    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Helpers
function getUserIdFromReq(req) {
  try {
    if (req.headers.authorization?.startsWith('Bearer ')) {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return decoded.id;
    }
  } catch (e) {}
  return req.body.userId || req.query.userId;
}

// Storage for profile pictures
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Get current user
router.get('/me', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const user = await User.findById(userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Update current user basic fields (username, phoneNumber) and password
router.put('/me', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const { username, phoneNumber, newPassword, profilePicture } = req.body;
    const update = {};
    if (username) update.username = username;
    if (phoneNumber !== undefined) update.phoneNumber = phoneNumber;
    if (profilePicture !== undefined) update.profilePicture = profilePicture; // allow null to remove
    if (newPassword) {
      // Hash new password
      if (process.env.HASH_PASSWORDS === 'true') {
        update.password = await bcrypt.hash(newPassword, 10);
      } else {
        update.password = newPassword; // fallback if hashing disabled
      }
    }
    const user = await User.findByIdAndUpdate(userId, update, { new: true }).select('-password');
    res.json(user);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Upload/update profile picture
router.post('/me/profile-picture', upload.single('profilePicture'), async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const relativePath = `/uploads/${req.file.filename}`;
    const user = await User.findByIdAndUpdate(userId, { profilePicture: relativePath }, { new: true }).select('-password');
    res.json(user);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;