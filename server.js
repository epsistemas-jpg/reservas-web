const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const { Pool } = require("pg");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------
// 🔹 Conexión a PostgreSQL
// ---------------------------
const pool = new Pool({
  connectionString: "postgresql://reservasdb_xddp_user:CBiDZwHLQi4Vpdxkpfx69vXs4jHDwneD@dpg-d39hb7fdiees73f2un60-a.virginia-postgres.render.com:5432/reservasdb_xddp",
  ssl: {
    rejectUnauthorized: false
  }
});


// Ejemplo para probar conexión
pool.connect()
  .then(() => console.log("Conectado a PostgreSQL Local 🚀"))
  .catch(err => console.error("Error de conexión:", err));

// ---------------------------
// 🔹 Middlewares
// ---------------------------
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: "secret-key",
  resave: false,
  saveUninitialized: false
}));
app.use(express.static(path.join(__dirname, "public")));

// ---------------------------
// 🔹 Redirigir raíz al login
// ---------------------------
app.get("/", (req, res) => {
  res.redirect("/login.html");
});

// ---------------------------
// 🔹 Middleware de autenticación
// ---------------------------
function requireLogin(req, res, next) {
  if (!req.session.userId) return res.status(401).send("No autenticado");
  next();
}

// ---------------------------
// 🔹 Rutas de autenticación
// ---------------------------
app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);

  pool.query(
    "INSERT INTO users (name, email, password) VALUES ($1, $2, $3)",
    [name, email, hashed]
  )
    .then(() => res.redirect("/login.html"))
    .catch(err => {
      console.error(err);
      res.status(400).send("Usuario ya existe o error.");
    });
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  pool.query("SELECT * FROM users WHERE email = $1", [email])
    .then(async result => {
      if (result.rows.length === 0) return res.status(400).send("Usuario no encontrado");

      const row = result.rows[0];
      const match = await bcrypt.compare(password, row.password);
      if (!match) return res.status(400).send("Contraseña incorrecta");

      req.session.userId = row.id;
      req.session.userName = row.name;
      res.redirect("/reservas.html");
    })
    .catch(err => res.status(500).send(err.message));
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login.html");
  });
});

// ---------------------------
// 🔹 API Reservas
// ---------------------------
app.get("/api/reservations", (req, res) => {
  const query = `
    SELECT 
  reservations.id, 
  reservations.room, 
  TO_CHAR(reservations.date, 'YYYY-MM-DD') as date, 
  reservations.start_time, 
  reservations.end_time, 
  users.name AS user_name
FROM reservations
JOIN users ON reservations.user_id = users.id;

  `;
  pool.query(query)
    .then(result => {
      //console.log(result.rows); // 👈 Ver qué devuelve
      res.json(result.rows);
    })
    .catch(err => res.status(500).send(err.message));
});


app.get("/api/myreservations", requireLogin, (req, res) => {
  pool.query("SELECT * FROM reservations WHERE user_id = $1", [req.session.userId])
    .then(result => res.json(result.rows))
    .catch(err => res.status(500).send(err.message));
});

app.post("/api/reservations", requireLogin, (req, res) => {
  const { room, date, start_time, end_time } = req.body;


  const now = new Date();

  // Construir inicio y fin completos (fecha + hora)
  const startDateTime = new Date(`${date}T${start_time}`);
  const endDateTime = new Date(`${date}T${end_time}`);

  // 1. No dejar reservar en fechas anteriores
  const today = new Date(now.toISOString().split("T")[0]); // solo fecha actual sin hora
  const selectedDate = new Date(date);

  if (selectedDate < today) {
    return res.status(400).send("No se puede reservar en un día anterior.");
  }

  // 2. Si es hoy, verificar que la hora inicio sea mayor a la actual
  if (selectedDate.getTime() === today.getTime() && startDateTime <= now) {
    return res.status(400).send("La hora de inicio ya pasó.");
  }

  // 3. Validar que hora fin sea mayor a inicio
  if (endDateTime <= startDateTime) {
    return res.status(400).send("La hora de fin debe ser después de la hora de inicio.");
  }

  pool.query(
    "SELECT * FROM reservations WHERE date = $1 AND room = $2 AND ((start_time <= $3 AND end_time > $3) OR (start_time < $4 AND end_time >= $4))",
    [date, room, start_time, end_time]
  )
    .then(result => {
      if (result.rows.length > 0) return res.status(400).send("Horario ocupado.");

      pool.query(
        "INSERT INTO reservations (user_id, room, date, start_time, end_time) VALUES ($1, $2, $3, $4, $5)",
        [req.session.userId, room, date, start_time, end_time]
      )
        .then(() => res.send("Reserva creada"))
        .catch(err => res.status(500).send(err.message));
    })
    .catch(err => res.status(500).send(err.message));
});

app.delete("/api/reservations/:id", requireLogin, (req, res) => {
  pool.query("DELETE FROM reservations WHERE id = $1 AND user_id = $2", [req.params.id, req.session.userId])
    .then(() => res.send("Reserva eliminada"))
    .catch(err => res.status(500).send(err.message));
});

// ---------------------------
// 🔹 Iniciar servidor
// ---------------------------
app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
