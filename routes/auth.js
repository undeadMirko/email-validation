const express = require('express');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
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
        console.log('Tokens obtenidos desde Google:', tokens); // Log para depurar

        // Validar si se recibió el refresh_token
        if (!tokens.refresh_token) {
            console.error('No se recibió el refresh_token:', tokens);
            throw new Error('No se recibió el refresh_token');
        }

        oauth2Client.setCredentials(tokens);
        req.session.tokens = tokens; // Guardar tokens en la sesión
        console.log('Tokens guardados en la sesión:', tokens); // Log para depurar

        res.redirect('/excel'); // Redirigir a la ruta deseada
    } catch (error) {
        console.error('Error durante la autenticación de Google:', error.message);
        req.session.tokens = null; // Limpiar los tokens si hay un error
        res.status(500).send('Authentication failed');
    }
});

// Ruta para obtener un nuevo access token cuando el token actual haya expirado
router.get('/refresh-token', async (req, res) => {
    if (!req.session.tokens || !req.session.tokens.refresh_token) {
        console.error('No se encontró refresh_token en la sesión');
        return res.status(400).send('No se encontró un refresh_token en la sesión');
    }

    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        'https://appmail.teamcomunicaciones.com/auth/google/callback'
    );

    oauth2Client.setCredentials(req.session.tokens);

    try {
        console.log('Refrescando el token de acceso...');
        const newTokens = await oauth2Client.refreshAccessToken();
        req.session.tokens = newTokens.credentials;
        console.log('Tokens refrescados:', newTokens.credentials); // Log para depurar
        res.json(newTokens.credentials); // Retornar los nuevos tokens
    } catch (error) {
        console.error('Error al refrescar el token de acceso:', error.message);
        req.session.tokens = null; // Limpiar los tokens si no se pueden refrescar
        res.status(500).send('Error al refrescar el token de acceso');
    }
});

// Ruta para enviar un correo utilizando nodemailer y el token de acceso
router.post('/send', async (req, res) => {
    if (!req.session.tokens || !req.session.tokens.access_token) {
        console.error('No se encontraron tokens de acceso en la sesión');
        return res.status(400).send('No se encontraron tokens de acceso en la sesión');
    }

    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        'https://appmail.teamcomunicaciones.com/auth/google/callback'
    );

    oauth2Client.setCredentials(req.session.tokens);

    try {
        console.log('Verificando el token de acceso...');
        const accessToken = await oauth2Client.getAccessToken();
        console.log('Token de acceso obtenido:', accessToken.token);

        // Configurar el transportador de nodemailer con OAuth2
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user: 'mirko13084@gmail.com', // Tu correo de Gmail
                clientId: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                refreshToken: req.session.tokens.refresh_token,
                accessToken: accessToken.token, // Usar el token de acceso renovado
            },
        });

        // Configuración del correo
        const mailOptions = {
            from: 'mirko13084@gmail.com',
            to: req.body.to, // Dirección del destinatario
            subject: req.body.subject, // Asunto
            text: req.body.text, // Cuerpo del mensaje
        };

        // Enviar el correo
        const info = await transporter.sendMail(mailOptions);
        console.log('Correo enviado:', info.response);
        res.status(200).send('Correo enviado con éxito');
    } catch (error) {
        console.error('Error al enviar correo:', error.message);
        req.session.tokens = null; // Limpiar los tokens si hay un error al enviar el correo
        res.status(500).send('Error al enviar correo');
    }
});

// Ruta para cerrar sesión y borrar los tokens guardados
router.get('/logout', (req, res) => {
    req.session.tokens = null;  // Eliminar los tokens de la sesión
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send('Error al cerrar sesión');
        }
        res.redirect('/');
    });
});

module.exports = router;
