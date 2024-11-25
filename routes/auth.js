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
    res.redirect(url);
});

// Ruta de callback que Google llama después de la autenticación
router.get('/callback', async (req, res) => {
    console.log('Callback recibido de Google...');

    const { code } = req.query;
    if (!code) {
        console.error('No se recibió el código de autenticación.');
        return res.status(400).send('No se recibió el código de autenticación');
    }

    try {
        // Intercambiar el código de autenticación por el token
        console.log('Intercambiando el código por el token de acceso...');
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Guardar los tokens en la sesión
        req.session.tokens = tokens;

        console.log('Autenticación exitosa. Tokens recibidos:', tokens);

        // Redirigir a la página de carga de Excel
        res.redirect('/excel');
    } catch (error) {
        console.error('Error durante la autenticación de Google:', error.message);
        console.error('Stack Trace:', error.stack);  // Imprime el error completo para depurar
        res.status(500).send('Authentication failed');
    }
});

module.exports = router;
