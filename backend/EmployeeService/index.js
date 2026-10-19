const express = require("express");
const cors = require("cors");
const pool = require("./db/pool");
const departamentosRoutes = require("./src/routes/departamentos.routes");
const cargosRoutes = require("./src/routes/cargos");
const sucursalesRoutes = require("./src/routes/sucursales");
const empleadosRoutes = require("./src/routes/empleados");
const kardexRoutes = require("./src/routes/kardex.routes");
const asignacionesRoutes = require("./src/routes/asignaciones");
const organigramaRoutes = require("./src/routes/organigrama.routes"); // RF-20
const jerarquiaRoutes = require("./src/routes/jerarquia.routes"); // RF-18
const memorandumsRoutes = require("./src/routes/memorandums"); // RF-37
const reconocimientosRoutes = require("./src/routes/reconocimientos"); // RF-38
const errorHandler = require("./src/middlewares/errorHandler");
const acusesMemorandumJob = require("./src/jobs/acusesMemorandumJob"); // RF-39

const app = express();
const PORT = process.env.PORT || 3002;

// Detrás del gateway (NGINX en la red interna) req.ip toma la IP real de X-Forwarded-For; RF-39 la registra en el acuse.
app.set("trust proxy", "loopback, uniquelocal");

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ service: "EmployeeService", status: "Online", port: PORT });
});

app.get("/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() as db_time");
    res.json({
      service: "EmployeeService",
      db_connected: true,
      timestamp: result.rows[0].db_time,
    });
  } catch (error) {
    res.status(500).json({
      service: "EmployeeService",
      db_connected: false,
      error: error.message,
    });
  }
});

app.use("/departamentos", departamentosRoutes);
app.use("/cargos", cargosRoutes);
app.use("/sucursales", sucursalesRoutes);
app.use("/empleados", empleadosRoutes);
app.use("/empleados", kardexRoutes);
app.use("/asignaciones", asignacionesRoutes);
app.use("/organigrama", organigramaRoutes); // RF-20
app.use("/jerarquia", jerarquiaRoutes); // RF-18
app.use("/memorandums", memorandumsRoutes); // RF-37
app.use("/reconocimientos", reconocimientosRoutes); // RF-38

app.use((req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
});

app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`EmployeeService corriendo en http://0.0.0.0:${PORT}`);
  });
  acusesMemorandumJob.iniciar(); // RF-39
}

module.exports = app;