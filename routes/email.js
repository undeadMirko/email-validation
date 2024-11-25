const express = require('express');
const router = express.Router();
const dns = require('dns').promises;
const nodemailer = require('nodemailer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');

// Valida si el correo tiene formato correcto y un dominio con registros MX
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

// Detecta palabras clave no válidas en el correo
const containsInvalidKeywords = (email) => {
    const keywords = ['no.tiene', 'tiene', 'no.email'];
    return keywords.some(keyword => email.includes(keyword));
};

// Función para obtener un nuevo access token automáticamente
const getAccessToken = async (oauth2Client) => {
    try {
        // Verificar si ya tenemos un access_token válido
        const currentAccessToken = oauth2Client.credentials.access_token;
        if (currentAccessToken) {
            return currentAccessToken; // Si existe un access_token, devolverlo
        }

        // Si no existe, intentar usar el refresh_token para obtener un nuevo access_token
        if (!oauth2Client.credentials.refresh_token) {
            throw new Error('No se encontró el refresh_token');
        }

        const token = await oauth2Client.getAccessToken();
        console.log('Nuevo Access Token:', token.token);
        return token.token;
    } catch (error) {
        console.error('Error obteniendo el access token:', error.message);
        if (error.message.includes('invalid_grant')) {
            throw new Error('El refresh token ha caducado. El usuario necesita reautenticarse.');
        }
        throw new Error('No se pudo obtener el access token');
    }
};

// Ruta para validar los correos y enviar los aprobados
router.get('/validate', async (req, res) => {
    const emails = req.session.emails || [];
    const approved = [];
    const notApproved = [];
    const bouncing = [];

    // Validar los correos
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
    console.log('Resultados de validación guardados en la sesión:', req.session.results);
    res.redirect('/results');
});

// Ruta para leer los correos rebotados desde Gmail
router.get('/read-bounced', async (req, res) => {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        'https://appmail.teamcomunicaciones.com/auth/google/callback'
    );

    oauth2Client.setCredentials(req.session.tokens);

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    try {
        console.log('Buscando correos rebotados...');
        const response = await gmail.users.messages.list({
            userId: 'me',
            q: 'subject:"Delivery Status Notification" OR subject:"Mail Delivery Subsystem"',
        });

        const messages = response.data.messages || [];
        console.log(`Correos de rebote encontrados: ${messages.length}`);

        for (const message of messages) {
            try {
                console.log('Procesando mensaje ID:', message.id);
                const mail = await gmail.users.messages.get({
                    userId: 'me',
                    id: message.id,
                });

                const headers = mail.data.payload.headers;
                const toHeader = headers.find(header => header.name === 'To');
                const emailMatch = toHeader ? toHeader.value.match(/<(.+)>/) : null;

                if (emailMatch && emailMatch[1]) {
                    const email = emailMatch[1].toLowerCase();
                    if (!req.session.results.bouncing.includes(email)) {
                        req.session.results.bouncing.push(email);
                        console.log(`Correo rebotado detectado: ${email}`);
                    }
                }
            } catch (error) {
                console.error(`Error procesando mensaje ID ${message.id}:`, error.message);
            }
        }

        console.log('Correos rebotados almacenados en la sesión:', req.session.results.bouncing);
        res.redirect('/results');
    } catch (error) {
        console.error('Error leyendo correos rebotados:', error.message);
        res.status(500).send('Error leyendo correos rebotados.');
    }
});

// Ruta para enviar los correos aprobados
router.get('/send', async (req, res) => {
    const { approved } = req.session.results || { approved: [] };

    if (approved.length === 0) {
        console.log('No hay correos aprobados para enviar.');
        return res.redirect('/results');
    }

    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        'https://appmail.teamcomunicaciones.com/auth/google/callback'
    );

    oauth2Client.setCredentials(req.session.tokens);

    try {
        const accessToken = await getAccessToken(oauth2Client);

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user: 'mirko13084@gmail.com',
                clientId: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                refreshToken: req.session.tokens.refresh_token,
                accessToken: accessToken,
            },
            debug: true, // Activar logs detallados
        });

        console.log('Iniciando el envío de correos...');

        for (const email of approved) {
            try {
                console.log(`Enviando correo a: ${email}`);
                const info = await transporter.sendMail({
                    from: 'mirko13084@gmail.com',
                    to: email,
                    subject: 'Validación de correo',
                    text: 'Este es un correo de prueba para validar tu email.',
                });
                console.log(`Correo enviado correctamente a: ${email}`);
                console.log('Info del envío:', info);
            } catch (error) {
                console.error(`Error enviando correo a ${email}:`, error.message);
                if (!req.session.results.bouncing.includes(email)) {
                    req.session.results.bouncing.push(email);
                }
            }
        }

        console.log('Envío de correos completado.');
        res.redirect('/results');
    } catch (error) {
        console.error('Error obteniendo el Access Token:', error.message);
        res.status(500).send('Error en la autenticación de Google.');
    }
});

// Ruta para exportar los resultados a un archivo Excel y enviarlo por correo
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
            user: 'mirko13084@gmail.com',
            pass: process.env.EMAIL_PASS,
        },
    });

    const mailOptions = {
        from: 'mirko13084@gmail.com',
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
