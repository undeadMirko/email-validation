const express = require('express');
const { google } = require('googleapis');
const router = express.Router();

// Crear el cliente OAuth2 usando las credenciales de tu archivo .env
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://appmail.teamcomunicaciones.com/auth/google/callback'
);

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'];

// Ruta para iniciar sesión con Google (redirige al login de Google)
router.get('/login', (req, res) => {
    console.log('Redirigiendo al login de Google...');
    const url = oauth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES });
    console.log('URL de redirección:', url);  // Verifica la URL generada
    res.redirect(url);
});

// Ruta de callback que Google llama después de la autenticación
router.get('/google/callback', async (req, res) => {
    console.log('Callback recibido de Google...');
    console.log('Parámetros de la solicitud:', req.query);  // Verifica los parámetros de la solicitud

    const { code } = req.query;
    if (!code) {
        console.error('No se recibió el código de autenticación.');
        return res.status(400).send('No se recibió el código de autenticación');
    }

    try {
        console.log('Intercambiando el código por el token de acceso...');
        const { tokens } = await oauth2Client.getToken(code);
        console.log('Tokens obtenidos:', tokens);

        oauth2Client.setCredentials(tokens);
        req.session.tokens = tokens;
        console.log('Autenticación exitosa. Tokens guardados en la sesión:', tokens);

        res.redirect('/excel');
    } catch (error) {
        console.error('Error durante la autenticación de Google:', error.message);
        console.error('Stack Trace:', error.stack);
        res.status(500).send('Authentication failed');
    }
});


module.exports = router;
