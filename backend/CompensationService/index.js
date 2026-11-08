const express = require("express");
const cors = require("cors");
const pool = require("./src/config/db");
const conceptosRoutes = require("./src/routes/conceptos.routes");
const condicionesRoutes = require("./src/routes/condiciones.routes");
const planillasRoutes = require("./src/routes/planillas.routes");
const mensajesPublicadosRoutes = require("./src/routes/mensajesPublicados.routes");
const { iniciarDespachador } = require("./src/services/eventos.service");
const manejadorErrores = require("./src/middlewares/manejadorErrores");

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ service: "CompensationService", status: "Online", port: PORT });
});

app.get("/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() as db_time");
    res.json({
      service: "CompensationService",
      db_connected: true,
      timestamp: result.rows[0].db_time,
    });
  } catch (error) {
    res
      .status(500)
      .json({
        service: "CompensationService",
        db_connected: false,
        error: error.message,
      });
  }
});

app.use(conceptosRoutes);
app.use(condicionesRoutes);
app.use(planillasRoutes);
app.use(mensajesPublicadosRoutes);
app.use(manejadorErrores);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`CompensationService corriendo en http://0.0.0.0:${PORT}`);
  // Bandeja de salida: envía a Pub/Sub la planilla aprobada (Contabilidad y Pagos).
  iniciarDespachador();
});
