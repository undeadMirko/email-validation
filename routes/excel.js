const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');

router.get('/', (req, res) => res.render('upload'));

router.post('/upload', (req, res) => {
    if (!req.files || !req.files.file) return res.status(400).send('No file uploaded.');
    const workbook = XLSX.read(req.files.file.data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);
    req.session.emails = rows.map(row => row.EMAIL.toLowerCase());
    res.redirect('/email/validate');
});

module.exports = router;
