const express = require("express");
const cors = require("cors");
const pool = require("./src/config/db");
const turnosRoutes = require("./src/routes/turnos.routes");
const marcajesRoutes = require("./src/routes/marcajes.routes");
const licenciasRoutes = require("./src/routes/licencias.routes");
const rolesTurnoRoutes = require("./src/routes/rolesTurno.routes");
const eventosRoutes = require("./src/routes/eventos.routes");
const novedadesRoutes = require("./src/routes/novedades.routes");
const justificacionesRoutes = require("./src/routes/justificaciones.routes");
const horasExtraRoutes = require("./src/routes/horasExtra.routes");
const reportesRoutes = require("./src/routes/reportes.routes");
const manejadorErrores = require("./src/middlewares/manejadorErrores");
const { iniciarDespachador } = require("./src/services/eventos.service");
const { iniciarContraste } = require("./src/services/novedades.service");

const app = express();
const PORT = process.env.PORT || 3004;

app.use(cors());
// Un rol mensual puede guardar miles de celdas de una vez.
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.json({ service: "AttendanceService", status: "Online", port: PORT });
});

app.get("/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() as db_time");
    res.json({
      service: "AttendanceService",
      db_connected: true,
      timestamp: result.rows[0].db_time,
    });
  } catch (error) {
    res
      .status(500)
      .json({
        service: "AttendanceService",
        db_connected: false,
        error: error.message,
      });
  }
});

app.use(turnosRoutes);
app.use(marcajesRoutes);
app.use(licenciasRoutes);
app.use(rolesTurnoRoutes);
app.use(eventosRoutes);
app.use(novedadesRoutes);
app.use(justificacionesRoutes);
app.use(horasExtraRoutes);
app.use(reportesRoutes);
app.use(manejadorErrores);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`AttendanceService corriendo en http://0.0.0.0:${PORT}`);
  iniciarDespachador();
  iniciarContraste();
});
