const express = require('express');
const router = express.Router();
const dns = require('dns').promises;
const nodemailer = require('nodemailer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');

const validateEmail = async (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(email)) return false;

    const domain = email.split('@')[1];
    try {
        const mxRecords = await dns.resolveMx(domain);
        return mxRecords && mxRecords.length > 0;
    } catch {
        return false;
    }
};

const containsInvalidKeywords = (email) => {
    const keywords = ['no.tiene', 'tiene', 'no.email'];
    return keywords.some(keyword => email.includes(keyword));
};

router.get('/validate', async (req, res) => {
    const emails = req.session.emails || [];
    const approved = [];
    const notApproved = [];
    const bouncing = [];

    for (const email of emails) {
        console.log(`Validando correo: ${email}`);
        if (containsInvalidKeywords(email)) {
            notApproved.push(email);
            continue;
        }

        const isValid = await validateEmail(email);
        if (!isValid) {
            notApproved.push(email);
        } else {
            const domain = email.split('@')[1];
            if (!['hotmail.com', 'gmail.com', 'outlook.com', 'outlook.es', 'yahoo.com'].includes(domain)) {
                notApproved.push(email);
            } else {
                approved.push(email);
            }
        }
    }

    req.session.results = { approved, notApproved, bouncing };
    console.log('Resultados de validación:', req.session.results);
    res.redirect('/results');
});

router.get('/read-bounced', async (req, res) => {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        'https://appmail.teamcomunicaciones.com/auth/google/callback'
    );

    oauth2Client.setCredentials(req.session.tokens);

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    try {
        const approvedEmails = req.session.results.approved || [];
        const response = await gmail.users.messages.list({
            userId: 'me',
            q: 'subject:"Delivery Status Notification" OR subject:"Mail Delivery Subsystem"',
        });

        const messages = response.data.messages || [];
        console.log(`Correos de rebote encontrados: ${messages.length}`);

        for (const message of messages) {
            try {
                const mail = await gmail.users.messages.get({
                    userId: 'me',
                    id: message.id,
                });

                const headers = mail.data.payload.headers;
                const toHeader = headers.find(header => header.name === 'To');
                const emailMatch = toHeader ? toHeader.value.match(/<(.+)>/) : null;

                if (emailMatch && emailMatch[1]) {
                    const email = emailMatch[1].toLowerCase();
                    if (approvedEmails.includes(email) && !req.session.results.bouncing.includes(email)) {
                        req.session.results.bouncing.push(email);
                        console.log(`Correo rebotado detectado: ${email}`);
                    }
                }
            } catch (error) {
                console.error(`Error procesando mensaje ID ${message.id}:`, error.message);
            }
        }

        res.redirect('/results');
    } catch (error) {
        console.error('Error leyendo correos rebotados:', error.message);
        res.status(500).send('Error leyendo correos rebotados.');
    }
});

router.get('/export', (req, res) => {
    const { approved, notApproved, bouncing } = req.session.results || {};
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(approved.map(email => ({ EMAIL: email }))), 'Aprobados');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(notApproved.map(email => ({ EMAIL: email }))), 'No Aprobados');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(bouncing.map(email => ({ EMAIL: email }))), 'Bouncing');

    const filePath = path.join(__dirname, '../results.xlsx');
    XLSX.writeFile(workbook, filePath);

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: 'manuel.arango@teamcomunicaciones.com, backoffice3@teamcomunicaciones.com, acruz@teamcomunicaciones.com',
        subject: 'Validación de Emails',
        text: `Fecha de envío: ${new Date().toLocaleString()}`,
        attachments: [{ filename: 'results.xlsx', path: filePath }],
    };

    transporter.sendMail(mailOptions, (err, info) => {
        if (err) {
            console.error('Error enviando el correo:', err.message);
            return res.status(500).send('Error enviando el reporte.');
        }
        console.log('Reporte enviado: ', info.response);
        fs.unlinkSync(filePath);
        res.send('Reporte generado y enviado correctamente.');
    });
});

module.exports = router;
