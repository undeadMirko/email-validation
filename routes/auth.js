const express = require('express');
const { google } = require('googleapis');
const router = express.Router();

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://appmail.teamcomunicaciones.com/auth/google/callback'
);

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'];

router.get('/login', (req, res) => {
    const url = oauth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES });
    res.redirect(url);
});

router.get('/callback', async (req, res) => {
    const { code } = req.query;
    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        req.session.tokens = tokens;
        res.redirect('/excel');
    } catch (error) {
        res.status(500).send('Authentication failed');
    }
});

module.exports = router;
