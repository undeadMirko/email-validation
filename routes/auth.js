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
router.get('/callback', async (req, res) => {
    console.log('Callback recibido de Google...');
    
    // Verifica que el código esté presente
    const { code } = req.query;
    console.log('Código recibido en el callback:', code);  // Verifica el código recibido
    if (!code) {
        console.error('No se recibió el código de autenticación.');
        return res.status(400).send('No se recibió el código de autenticación');
    }

    try {
        console.log('Intercambiando el código por el token de acceso...');
        const { tokens } = await oauth2Client.getToken(code);  // Intercambia el código por el token
        console.log('Tokens obtenidos:', tokens);  // Verifica los tokens obtenidos

        oauth2Client.setCredentials(tokens);  // Establece las credenciales del cliente OAuth2
        req.session.tokens = tokens;  // Guarda los tokens en la sesión

        console.log('Autenticación exitosa. Tokens guardados en la sesión:', tokens);  // Verifica que los tokens se guardaron

        // Redirige a la página de carga de Excel
        res.redirect('/excel');
    } catch (error) {
        console.error('Error durante la autenticación de Google:', error.message);
        console.error('Stack Trace:', error.stack);  // Imprime el error completo para depurar
        res.status(500).send('Authentication failed');
    }
});

module.exports = router;
