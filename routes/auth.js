const express = require('express');
const router = express.Router();
const { google } = require('googleapis');

// Crear cliente OAuth2
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://appmail.teamcomunicaciones.com/auth/google/callback'
);

// Ruta para iniciar el proceso de autenticación
router.get('/google', (req, res) => {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline', // Solicitar refresh_token
        scope: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'],
    });
    res.redirect(authUrl);
});

// Ruta de callback de Google OAuth2
router.get('/google/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) {
        return res.status(400).send('No se recibió el código de autenticación');
    }

    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Guardar tokens en la sesión
        req.session.tokens = tokens;
        console.log('Tokens guardados:', tokens);

        res.redirect('/excel'); // Redirigir a la ruta donde se realizará la validación
    } catch (error) {
        console.error('Error en la autenticación de Google:', error.message);
        res.status(500).send('Error en la autenticación de Google');
    }
});

module.exports = router;
