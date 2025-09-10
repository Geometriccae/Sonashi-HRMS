const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const authMiddleware = require('./middleware/authMiddleware');
require('dotenv').config();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

//  Allow frontend to connect
// app.use(cors({
//   origin: 'http://localhost:3000',
//   credentials: true
// }));

// app.use(cors({
//   origin: process.env.CLIENT_URL,
//   credentials: true
// }));

const allowedOrigins = [
  "http://localhost:3000", // local frontend
  "https://auxin-mern-app-front.onrender.com" // live frontend
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true); // allow curl/postman
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true
}));


app.get('/api/protected-data', authMiddleware, (req, res) => {
  res.json({ message: "This is protected data", user: req.user });
});

//  Parse JSON
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/clients', require('./routes/clients'));

//  Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend server is running!', timestamp: new Date() });
});

//  Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

//  Setup routes
const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');

app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


