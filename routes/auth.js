const express = require('express');
const router = express.Router();
const { getAuthUrl, handleGoogleCallback } = require('./authUtil');

// Ruta para iniciar sesión con Google (redirige al login de Google)
router.get('/login', (req, res) => {
    const url = getAuthUrl();  // Usamos la función de authUtil.js
    console.log('URL de redirección:', url); // Log para depurar
    res.redirect(url);
});

// Ruta de callback que Google llama después de la autenticación
router.get('/google/callback', handleGoogleCallback);  // Usamos la función de authUtil.js

module.exports = router;
