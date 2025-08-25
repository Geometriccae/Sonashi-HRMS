const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const authMiddleware = require('./middleware/authMiddleware');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

//  Allow frontend to connect
// app.use(cors({
//   origin: 'http://localhost:3000',
//   credentials: true
// }));
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true
}));


app.get('/api/protected-data', authMiddleware, (req, res) => {
  res.json({ message: "This is protected data", user: req.user });
});

//  Parse JSON
app.use(express.json());

//  Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

//  Setup routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
