const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const session = require('express-session');
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
const listEndpoints = require('express-list-endpoints');  // Importamos el paquete para listar las rutas

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Middleware para manejar las cargas de archivos
app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 }, // Limita el tamaño del archivo a 50MB
    safeFileNames: true,  // Previene caracteres peligrosos en los nombres de archivo
    preserveExtension: true  // Conserva la extensión del archivo original
}));



// Configuración de sesiones
app.use(session({ secret: 'your_secret_key', resave: false, saveUninitialized: true }));

// Routes
const authRoutes = require('./routes/auth');
const excelRoutes = require('./routes/excel');
const emailRoutes = require('./routes/email');

// Registrando las rutas
app.use('/auth', authRoutes);
app.use('/excel', excelRoutes);
app.use('/email', emailRoutes);

app.get('/results', (req, res) => {
    const results = req.session.results;

    if (!results) {
        return res.status(400).send('No se encontraron resultados.');
    }

    res.render('result', { results }); // Renderiza los resultados
});

require('dotenv').config(); // Carga las variables de entorno del archivo .env

// Verificación de las variables de entorno
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID); 
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET); 
console.log('GOOGLE_CLIENT_SECRET:', process.env.EMAIL_USER); 
console.log('EMAIL_PASS:', process.env.EMAIL_PASS);

// Si alguna de estas variables está vacía o es undefined, muestra un error y termina la ejecución
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
    console.error("Falta alguna de las credenciales de Google en el archivo .env.");
    process.exit(1); // Detiene la ejecución si no se encuentran las variables
}

// Mostrar todas las rutas disponibles usando express-list-endpoints
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Rutas disponibles:');
  console.log(listEndpoints(app));  // Muestra todas las rutas registradas
});

// Ruta de inicio
app.get('/', (req, res) => res.render('home'));
