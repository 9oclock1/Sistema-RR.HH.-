const express = require("express");
const cors = require("cors");
const pool = require("./src/config/db");
const comunicacionesRoutes = require("./src/routes/comunicaciones.routes");
const manejadorErrores = require("./src/middlewares/manejadorErrores");

const app = express();
const PORT = process.env.PORT || 3007;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ service: "NotificationService", status: "Online", port: PORT });
});

app.get("/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() as db_time");
    res.json({
      service: "NotificationService",
      db_connected: true,
      timestamp: result.rows[0].db_time,
    });
  } catch (error) {
    res.status(503).json({
      service: "NotificationService",
      db_connected: false,
      error: error.message,
    });
  }
});

// Endpoint legado de compatibilidad
app.post("/send", (req, res) => {
  const { to, subject } = req.body;
  res.json({
    status: "Enviado",
    to: to || "joseph.cortez@ucb.edu.bo",
    subject: subject || "Alerta de prueba",
  });
});

// Rutas de microservicio de notificaciones y mensajería
app.use(comunicacionesRoutes);

// Manejador para rutas no encontradas en formato JSON (evita HTML 404 por defecto)
app.use((req, res) => {
  res.status(404).json({
    exito: false,
    error: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  });
});

// Manejador centralizado de errores
app.use(manejadorErrores);

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`NotificationService corriendo en http://0.0.0.0:${PORT}`);
  });
}

module.exports = app;
