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
app.use(fileUpload());
app.use(session({ secret: 'your_secret_key', resave: false, saveUninitialized: true }));

app.use(fileUpload({
    limits: { fileSize: 0 } // 0 significa sin límite de tamaño de archivo
}));

// Routes
const authRoutes = require('./routes/auth');
const excelRoutes = require('./routes/excel');
const emailRoutes = require('./routes/email');

// Registrando las rutas
app.use('/auth', authRoutes);
app.use('/excel', excelRoutes);
app.use('/email', emailRoutes);

// Mostrar todas las rutas disponibles usando express-list-endpoints
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Rutas disponibles:');
  console.log(listEndpoints(app));  // Muestra todas las rutas registradas
});

app.get('/', (req, res) => res.render('home'));
