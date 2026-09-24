const express = require("express");
const cors = require("cors");
const pool = require("./db/pool");
const cargosRoutes = require("./src/routes/cargos");
const nivelesSalarialesRoutes = require("./src/routes/nivelesSalariales");
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
    res
      .status(500)
      .json({
        service: "EmployeeService",
        db_connected: false,
        error: error.message,
      });
  }
});

app.get("/list", (req, res) => {
  res.json([
    {
      id: 1,
      name: "Cortez perrita",
      role: "Fullstack",
      department: "Tecnología",
    },
    { id: 2, name: "Jose perrita", role: "RRHH", department: "Talento Humano" },
  ]);
});

app.use("/cargos", cargosRoutes);
app.use("/niveles-salariales", nivelesSalarialesRoutes);

// Debe ir después de todas las rutas.
app.use(errorHandler);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`EmployeeService corriendo en http://0.0.0.0:${PORT}`);
});