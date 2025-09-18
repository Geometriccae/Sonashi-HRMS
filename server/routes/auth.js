const express = require('express');
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require('../models/User'); // your Mongoose model
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const nodemailer = require("nodemailer");
const crypto = require("crypto");


let otpStore = {}; // TEMP store (better use Redis or DB)


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
    const { username, phoneNumber, newPassword, emailId, profilePicture } = req.body;
    const update = {};
    if (username) update.username = username;
    if (phoneNumber !== undefined) update.phoneNumber = phoneNumber;
    if (emailId !== undefined) update.emailId = emailId;
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


// ************************************ OTP RELATED THINGS *****************************

// Send OTP
router.post("/send-otp", async (req, res) => {
  const { emailId } = req.body;

 
  try {
    const user = await User.findOne({ emailId: emailId });
    if (!user) return res.status(404).json({ message: "User not found" });

    // const otp = crypto.randomInt(100000, 999999).toString();

    const otp = crypto.randomInt(1000, 10000).toString();

    otpStore[emailId] = otp;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // Your Gmail
        pass: process.env.EMAIL_PASS, // App password (not normal password)
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: emailId,
      subject: "Your OTP Code",
      text: `Your OTP is ${otp}`,
    });

    res.json({ message: "OTP sent successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error sending OTP", error: err.message });
  }
});

// Verify OTP
router.post("/verify-otp", (req, res) => {
  const { emailId, otp } = req.body;
  if (otpStore[emailId] && otpStore[emailId] === otp) {
    return res.json({ valid: true });
  }
  res.status(400).json({ valid: false, message: "Invalid OTP" });
});

// Reset Password
router.post("/reset-password", async (req, res) => {
  const { emailId, otp, newPassword } = req.body;
  try {
    if (!otpStore[emailId] || otpStore[emailId] !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    delete otpStore[emailId]; // clear otp after use

    // const hashed = await bcrypt.hash(newPassword, 10);

    await User.findOneAndUpdate({ emailId: emailId }, { password: newPassword  });

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error resetting password", error: err.message });
  }
});


module.exports = router;