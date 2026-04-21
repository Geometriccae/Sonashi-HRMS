const mongoose = require('mongoose');
require('dotenv').config();
const Employee = require('../models/Employee');

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDays = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const exp = await Employee.find({
        $or: [
            { passportExpiryDate: { $lte: thirtyDays, $gte: today } },
            { labourCardExpiryDate: { $lte: thirtyDays, $gte: today } },
            { visaExpiryDate: { $lte: thirtyDays, $gte: today } }
        ]
    });
    
    console.log('Expiring employees count:', exp.length);
    exp.forEach(e => {
        console.log(`${e.employeeName} | Passport: ${e.passportExpiryDate} | Labour: ${e.labourCardExpiryDate} | Visa: ${e.visaExpiryDate}`);
    });
    
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});
