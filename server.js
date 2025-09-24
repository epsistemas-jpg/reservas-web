const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = 3000;

// Middlewares
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: "secret-key",
  resave: false,
  saveUninitialized: false
}));

// Archivos estáticos
app.use(express.static(path.join(__dirname, "public")));

// Redirigir la raíz al login
app.get("/", (req, res) => {
  res.redirect("/login.html");
});


// Base de datos SQLite
const db = new sqlite3.Database(path.join(__dirname, "reservas.db"), (err) => {
  if (err) console.error(err.message);
  else console.log("Base de datos conectada.");
});

// Crear tablas si no existen
db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT UNIQUE, password TEXT)");
  db.run("CREATE TABLE IF NOT EXISTS reservations (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, room TEXT, date TEXT, start_time TEXT, end_time TEXT, FOREIGN KEY(user_id) REFERENCES users(id))");
});

// Middleware de autenticación
function requireLogin(req, res, next) {
  if (!req.session.userId) return res.status(401).send("No autenticado");
  next();
}

// Rutas de autenticación
app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);

  db.run("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", [name, email, hashed], function (err) {
    if (err) return res.status(400).send("Usuario ya existe o error.");
    res.redirect("/login.html");
  });
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, row) => {
    if (!row) return res.status(400).send("Usuario no encontrado");

    const match = await bcrypt.compare(password, row.password);
    if (!match) return res.status(400).send("Contraseña incorrecta");

    req.session.userId = row.id;
    req.session.userName = row.name;
    res.redirect("/reservas.html");
  });
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login.html");
  });
});

// API Reservas
app.get("/api/reservations", (req, res) => {
  const query = `
    SELECT reservations.id, reservations.room, reservations.date, 
           reservations.start_time, reservations.end_time, users.name AS user_name
    FROM reservations
    JOIN users ON reservations.user_id = users.id
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).send(err.message);
    res.json(rows);
  });
});


app.get("/api/myreservations", requireLogin, (req, res) => {
  db.all("SELECT * FROM reservations WHERE user_id = ?", [req.session.userId], (err, rows) => {
    if (err) return res.status(500).send(err.message);
    res.json(rows);
  });
});

app.post("/api/reservations", requireLogin, (req, res) => {
  const { room, date, start_time, end_time } = req.body;

  // Validar fecha y hora
  const now = new Date();
  const selectedDate = new Date(date + "T" + start_time);
  if (selectedDate < now) return res.status(400).send("No se puede reservar en el pasado.");

  db.get("SELECT * FROM reservations WHERE date = ? AND room = ? AND ((start_time <= ? AND end_time > ?) OR (start_time < ? AND end_time >= ?))",
    [date, room, start_time, start_time, end_time, end_time], (err, row) => {
      if (row) return res.status(400).send("Horario ocupado.");

      db.run("INSERT INTO reservations (user_id, room, date, start_time, end_time) VALUES (?, ?, ?, ?, ?)",
        [req.session.userId, room, date, start_time, end_time], function (err) {
          if (err) return res.status(500).send(err.message);
          res.send("Reserva creada");
        });
    });
});

app.delete("/api/reservations/:id", requireLogin, (req, res) => {
  db.run("DELETE FROM reservations WHERE id = ? AND user_id = ?", [req.params.id, req.session.userId], function (err) {
    if (err) return res.status(500).send(err.message);
    res.send("Reserva eliminada");
  });
});

// Iniciar servidor
app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
