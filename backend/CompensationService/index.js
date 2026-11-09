const express = require("express");
const cors = require("cors");
const pool = require("./src/config/db");
const conceptosRoutes = require("./src/routes/conceptos.routes");
const condicionesRoutes = require("./src/routes/condiciones.routes");
const anticiposRoutes = require("./src/routes/anticipos.routes");
const antiguedadRoutes = require("./src/routes/antiguedad.routes");
const planillasRoutes = require("./src/routes/planillas.routes");
const confirmacionesRoutes = require("./src/routes/confirmaciones.routes");
const bonificacionesRoutes = require("./src/routes/bonificaciones.routes");
const mensajesPublicadosRoutes = require("./src/routes/mensajesPublicados.routes");
const { iniciarDespachador } = require("./src/services/eventos.service");
const { iniciarConsumidor } = require("./src/services/confirmaciones.service");
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
app.use(anticiposRoutes);
app.use(antiguedadRoutes);
app.use(planillasRoutes);
app.use(confirmacionesRoutes);
app.use(bonificacionesRoutes);
app.use(mensajesPublicadosRoutes);
app.use(manejadorErrores);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`CompensationService corriendo en http://0.0.0.0:${PORT}`);
  // Bandeja de salida (planilla aprobada) y confirmaciones de Contabilidad y Pagos por Pub/Sub.
  iniciarDespachador();
  iniciarConsumidor();
});
