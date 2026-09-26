const express = require("express");
const cors = require("cors");
const pool = require("./db/pool");
const departamentosRoutes = require("./src/routes/departamentos.routes");
const cargosRoutes = require("./src/routes/cargos");
const asignacionesRoutes = require("./src/routes/asignaciones");
const errorHandler = require("./src/middlewares/errorHandler");

const app = express();
const PORT = process.env.PORT || 3002;

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
app.use("/asignaciones", asignacionesRoutes);

app.use(errorHandler);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`EmployeeService corriendo en http://0.0.0.0:${PORT}`);
});