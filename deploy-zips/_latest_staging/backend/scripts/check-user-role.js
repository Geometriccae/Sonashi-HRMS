const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const users = await User.find({ username: /Mohamed/i });
        console.log('Found users:', users.map(u => ({ username: u.username, role: u.role, id: u._id })));
        await mongoose.disconnect();
    } catch (e) {
        console.error(e);
    }
}

check();
