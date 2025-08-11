const express = require('express');
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require('../models/User'); // your Mongoose model


router.post('/login', async (req, res) => {
  const { username, password } = req.body;


  try {
    const user = await User.findOne({ username, password });
    if (!user) {
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
module.exports = router;