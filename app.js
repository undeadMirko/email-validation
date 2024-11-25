const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const session = require('express-session');
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');

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

// Routes
const authRoutes = require('./routes/auth');
const excelRoutes = require('./routes/excel');
const emailRoutes = require('./routes/email');

// Registrando las rutas
app.use('/auth', authRoutes);
app.use('/excel', excelRoutes);
app.use('/email', emailRoutes);

// Mostrar todas las rutas disponibles
app._router.stack.forEach((middleware) => {
  if (middleware.route) {
    console.log(`${middleware.route.path}`);
  }
});

app.get('/', (req, res) => res.render('home'));

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
