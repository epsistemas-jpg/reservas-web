const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------
// 🔹 Conexión a PostgreSQL
// ---------------------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }

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
  reservations.motivo,
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
const moment = require("moment-timezone");
app.post("/api/reservations", requireLogin, (req, res) => {
  const { room, date, start_time, end_time, motivo } = req.body;

  // 🔹 Hora actual en Colombia
  const now = moment.tz("America/Bogota");

  // 🔹 Construir horas de la reserva en zona Colombia
  const startDateTime = moment.tz(`${date} ${start_time}`, "YYYY-MM-DD HH:mm", "America/Bogota");
  const endDateTime = moment.tz(`${date} ${end_time}`, "YYYY-MM-DD HH:mm", "America/Bogota");

  const today = now.clone().startOf("day");
  const selectedDate = moment.tz(date, "YYYY-MM-DD", "America/Bogota");

  // Validaciones
  if (selectedDate.isBefore(today, "day")) {
    return res.status(400).send("No se puede reservar en un día anterior.");
  }

  if (selectedDate.isSame(today, "day") && startDateTime.isSameOrBefore(now)) {
    return res.status(400).send("La hora de inicio ya pasó.");
  }

  if (endDateTime.isSameOrBefore(startDateTime)) {
    return res.status(400).send("La hora de fin debe ser después de la hora de inicio.");
  }

  // 🔹 Verificar choque de horarios
  pool.query(
    `SELECT * FROM reservations 
     WHERE date = $1 AND room = $2 
     AND ((start_time <= $3 AND end_time > $3) 
       OR (start_time < $4 AND end_time >= $4))`,
    [date, room, start_time, end_time]
  )
    .then(result => {
      if (result.rows.length > 0) return res.status(400).send("Horario ocupado.");

      pool.query(
        "INSERT INTO reservations (user_id, room, date, start_time, end_time, motivo) VALUES ($1, $2, $3, $4, $5, $6)",
        [req.session.userId, room, date, start_time, end_time, motivo]
      )
        .then(() => res.send("Reserva creada"))
        .catch(err => res.status(500).send(err.message));
    })
    .catch(err => res.status(500).send(err.message));
});

app.put("/api/reservations/:id", requireLogin, (req, res) => {
  const { room, date, start_time, end_time, motivo } = req.body;

  // 🔹 Hora actual en Colombia
  const now = moment.tz("America/Bogota");
  const startDateTime = moment.tz(`${date} ${start_time}`, "YYYY-MM-DD HH:mm", "America/Bogota");
  const endDateTime = moment.tz(`${date} ${end_time}`, "YYYY-MM-DD HH:mm", "America/Bogota");

  const today = now.clone().startOf("day");
  const selectedDate = moment.tz(date, "YYYY-MM-DD", "America/Bogota");

  // Validaciones
  if (selectedDate.isBefore(today, "day")) {
    return res.status(400).send("No se puede reservar en un día anterior.");
  }

  if (selectedDate.isSame(today, "day") && startDateTime.isSameOrBefore(now)) {
    return res.status(400).send("La hora de inicio ya pasó.");
  }

  if (endDateTime.isSameOrBefore(startDateTime)) {
    return res.status(400).send("La hora de fin debe ser después de la hora de inicio.");
  }

  // 🔹 Validar solapamientos (excluyendo la misma reserva que se edita)
  pool.query(
    `SELECT * FROM reservations 
     WHERE date = $1 AND room = $2 AND id <> $5
     AND ((start_time <= $3 AND end_time > $3) 
       OR (start_time < $4 AND end_time >= $4))`,
    [date, room, start_time, end_time, req.params.id]
  )
    .then(result => {
      if (result.rows.length > 0) return res.status(400).send("Horario ocupado.");

      pool.query(
        `UPDATE reservations 
         SET room = $1, date = $2, start_time = $3, end_time = $4, motivo = $5 
         WHERE id = $6 AND user_id = $7`,
        [room, date, start_time, end_time, motivo, req.params.id, req.session.userId]
      )
        .then(dbRes => {
          if (dbRes.rowCount === 0) return res.status(403).send("No puedes editar esta reserva.");
          res.send("Reserva actualizada ✅");
        })
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
