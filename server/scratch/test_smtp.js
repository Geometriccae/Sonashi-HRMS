const nodemailer = require('nodemailer');
require('dotenv').config();

async function testEmail() {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const mailOptions = {
        from: `"Sonashi Test" <${process.env.EMAIL_USER}>`,
        to: 'mydeen1134@gmail.com', // Sending to the user's test email
        subject: 'Sonashi HRMS - SMTP Test',
        html: '<h3>SMTP Configuration is Working!</h3><p>This is a test email from your HRMS system.</p>'
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('✅ Test email sent successfully to mydeen1134@gmail.com');
    } catch (error) {
        console.error('❌ SMTP Test Failed:', error);
    }
}

testEmail();
