const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');

// Renderizar la página de carga
router.get('/', (req, res) => res.render('upload'));

// Manejar la subida del archivo
router.post('/upload', (req, res) => {
    try {
        // Validar que el archivo fue cargado
        if (!req.files || !req.files.file) {
            return res.status(400).send('No se subió ningún archivo.');
        }

        // Leer el archivo Excel
        const workbook = XLSX.read(req.files.file.data);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }); // Obtener datos como matriz

        // Verificar que haya filas en el archivo
        if (rows.length === 0) {
            return res.status(400).send('El archivo está vacío.');
        }

        // Buscar la columna "EMAIL" en la primera fila
        const headerRow = rows[0]; // Primera fila (cabecera)
        const emailIndex = headerRow.findIndex(cell => 
            cell && cell.toString().toLowerCase() === 'email'
        );

        if (emailIndex === -1) {
            return res.status(400).send('No se encontró una columna llamada "EMAIL".');
        }

        // Extraer las direcciones de correo de las filas restantes
        const emails = rows.slice(1) // Omitir la cabecera
            .map(row => row[emailIndex]) // Obtener la columna de EMAIL
            .filter(email => email && typeof email === 'string') // Validar los correos
            .map(email => email.toLowerCase()); // Normalizar a minúsculas

        if (emails.length === 0) {
            return res.status(400).send('No se encontraron direcciones de correo válidas.');
        }

        // Guardar los correos en la sesión
        req.session.emails = emails;
        console.log('Correos extraídos:', emails);

        // Redirigir para validar los correos
        res.redirect('/email/validate');
    } catch (error) {
        console.error('Error al procesar el archivo:', error);
        res.status(500).send('Error al procesar el archivo.');
    }
});

module.exports = router;
