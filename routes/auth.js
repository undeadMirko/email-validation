const express = require('express');
const { google } = require('googleapis');
const router = express.Router();

// Crear el cliente OAuth2 usando las credenciales de tu archivo .env
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://appmail.teamcomunicaciones.com/auth/google/callback'
);

// Define los permisos requeridos por tu aplicación
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'];

// Ruta para iniciar sesión con Google (redirige al login de Google)
router.get('/login', (req, res) => {
    console.log('Redirigiendo al login de Google...');
    
    // Generar URL de autenticación con los parámetros adecuados
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline', // Solicitar un refresh_token
        prompt: 'consent', // Forzar consentimiento cada vez para asegurar un refresh_token
        scope: SCOPES,
    });

    console.log('URL de redirección:', url); // Log para depurar
    res.redirect(url);
});

// Ruta de callback que Google llama después de la autenticación
router.get('/google/callback', async (req, res) => {
    console.log('Callback recibido de Google...');
    console.log('Parámetros de la solicitud:', req.query); // Verificar los parámetros recibidos

    const { code } = req.query;
    if (!code) {
        console.error('No se recibió el código de autenticación.');
        return res.status(400).send('No se recibió el código de autenticación');
    }

    try {
        console.log('Intercambiando el código por el token de acceso...');
        
        // Obtener tokens usando el código recibido
        const { tokens } = await oauth2Client.getToken(code);

        // Validar si se recibió el refresh_token
        if (!tokens.refresh_token) {
            console.error('No se recibió el refresh_token:', tokens);
            throw new Error(
                'No se recibió el refresh_token. Es posible que el usuario ya haya autorizado previamente.'
            );
        }

        console.log('Tokens obtenidos:', tokens); // Log para depurar
        oauth2Client.setCredentials(tokens);

        // Guardar tokens en la sesión
        req.session.tokens = tokens;
        console.log('Autenticación exitosa. Tokens guardados en la sesión:', tokens);

        res.redirect('/excel'); // Redirigir a la ruta deseada
    } catch (error) {
        console.error('Error durante la autenticación de Google:', error.message);
        console.error('Stack Trace:', error.stack);
        res.status(500).send('Authentication failed');
    }
});

module.exports = router;
