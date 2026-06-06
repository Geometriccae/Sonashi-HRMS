const cron = require('node-cron');
const nodemailer = require('nodemailer');
const Employee = require('../models/Employee');
const User = require('../models/User');
const CompanyDocument = require('../models/CompanyDocument');
const Notification = require('../models/Notification');
const { runDailyHrAlerts } = require('./hrNotificationService');

const ALERT_DAYS = [30, 25, 20, 15, 12, 10, 8, 7, 6, 5, 4, 3, 2, 1, 0];
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function getTimeStr(diffDays) {
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'tomorrow';
    return `in ${diffDays} days`;
}

function getDiffDays(expiryDate, today) {
    const expDate = new Date(expiryDate);
    if (Number.isNaN(expDate.getTime())) return null;
    expDate.setHours(0, 0, 0, 0);
    return Math.round((expDate.getTime() - today.getTime()) / MS_PER_DAY);
}

/**
 * Configure the email transporter using environment variables.
 */
function getTransporter() {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
}

/**
 * Sends an expiry notification email to the employee and the admin.
 */
async function sendExpiryEmail(employee, docName, expiryDate, diffDays) {
    const transporter = getTransporter();
    const expiryStr = new Date(expiryDate).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });

    let timeStr = "soon";
    if (diffDays === 0) timeStr = "today";
    else if (diffDays === 1) timeStr = "tomorrow";
    else timeStr = `in ${diffDays} days`;

    const html = `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #d32f2f;">Document Expiry Reminder</h2>
            <p>Dear <strong>${employee.employeeName}</strong>,</p>
            <p>This is a reminder that your <strong>${docName}</strong> is expiring <strong>${timeStr}</strong> on <strong>${expiryStr}</strong>.</p>
            <p>Please take the necessary actions to renew your document to avoid any inconvenience.</p>
            <br/>
            <p style="color: #757575; font-size: 12px;">This is an automated message from the Sonashi HRMS system.</p>
        </div>
    `;

    // Recipient list: Employee email + Admin emails
    const recipients = [];
    if (employee.emailId && !employee.emailId.includes('import.hrms.placeholder')) {
        recipients.push(employee.emailId);
    }

    try {
        const admins = await User.find({ role: 'admin' }, 'emailId').lean();
        admins.forEach(admin => {
            if (admin.emailId) recipients.push(admin.emailId);
        });
    } catch (err) {
        console.error('Error fetching admins for expiry email:', err);
    }

    const uniqueRecipients = [...new Set(recipients)];
    if (uniqueRecipients.length === 0) return;

    const mailOptions = {
        from: `"Sonashi" <${process.env.EMAIL_USER}>`,
        to: uniqueRecipients.join(','),
        subject: `Document Expiry Alert: ${docName} - ${employee.employeeName}`,
        html: html
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`[Expiry] Email sent for ${employee.employeeName} (${docName}) to ${uniqueRecipients.join(', ')}`);
    } catch (error) {
        console.error(`[Expiry] Error sending email for ${employee.employeeName}:`, error);
    }
}

/**
 * Checks all employees for documents expiring within the next 30 days.
 * Specifically checks for 30, 15, 7, 3, 1, and 0 days remaining.
 */
async function checkExpiries() {
    console.log('[Expiry] Running daily document expiry check...');
    try {
        const employees = await Employee.find({ employeeStatus: 'Active' });
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const emp of employees) {
            const checks = [
                { name: 'Passport', date: emp.passportExpiryDate },
                { name: 'Labour Card', date: emp.labourCardExpiryDate },
                { name: 'Visa', date: emp.visaExpiryDate },
                { name: 'Emirates ID', date: emp.emiratesIdExpiryDate },
            ];

            for (const check of checks) {
                if (!check.date) continue;
                const expDate = new Date(check.date);
                if (isNaN(expDate.getTime())) continue;
                expDate.setHours(0, 0, 0, 0);

                const diffDays = getDiffDays(check.date, today);

                if (diffDays !== null && ALERT_DAYS.includes(diffDays)) {
                    await sendExpiryEmail(emp, check.name, check.date, diffDays);
                }
            }
        }
        console.log('[Expiry] Daily check completed.');
    } catch (error) {
        console.error('[Expiry] Error during checkExpiries:', error);
    }
}

async function sendCompanyDocExpiryNotification(doc, diffDays, io, today) {
    const expiryStr = new Date(doc.expiryDate).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
    const timeStr = getTimeStr(diffDays);
    const docLabel = doc.docNumber
        ? `"${doc.particulars}" (${doc.docNumber})`
        : `"${doc.particulars}"`;
    const todayStr = today.toISOString().slice(0, 10);

    const payload = {
        id: `company-doc-expiry-${doc._id}-${todayStr}`,
        title: 'Company Document Expiry Reminder',
        body: `${docLabel} is expiring ${timeStr} on ${expiryStr}`,
        type: 'company-doc-expiry',
        meta: { url: '/company-document', docId: String(doc._id) },
    };

    if (io) {
        io.to('role-admin').to('role-hod').to('role-hr').to('role-viewer').emit('notification', payload);
    }

    for (const role of ['admin', 'hod', 'hr', 'viewer']) {
        const existing = await Notification.findOne({
            'payload.id': payload.id,
            role,
        }).lean();
        if (existing) continue;

        await Notification.create({
            title: payload.title,
            body: payload.body,
            payload,
            role,
        });
    }
}

async function checkCompanyDocumentExpiries(io) {
    console.log('[Expiry] Running company document expiry check...');
    try {
        const docs = await CompanyDocument.find({ expiryDate: { $ne: null } });
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const doc of docs) {
            const diffDays = getDiffDays(doc.expiryDate, today);
            if (diffDays !== null && diffDays >= 0 && diffDays <= 30) {
                await sendCompanyDocExpiryNotification(doc, diffDays, io, today);
            }
        }
        console.log('[Expiry] Company document check completed.');
    } catch (error) {
        console.error('[Expiry] Error during checkCompanyDocumentExpiries:', error);
    }
}

/**
 * Initializes the expiry check cron job.
 * Runs once every morning at 9:00 AM.
 */
function initExpiryCron(io) {
    cron.schedule('0 9 * * *', () => {
        checkExpiries();
        checkCompanyDocumentExpiries(io);
        runDailyHrAlerts(io);
    });
}

module.exports = { initExpiryCron, checkExpiries, checkCompanyDocumentExpiries };
