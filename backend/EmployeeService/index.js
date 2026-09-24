const express = require("express");
const cors = require("cors");

const pool = require("./db/pool"); // centralizado acá, ya no se crea el Pool inline
const departamentosRoutes = require("./src/routes/departamentos.routes"); // asume que renombraste "src copy" a "src"

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

// RF-16 a RF-20: departamentos, cargos, organigrama
// El gateway NGINX ya resuelve el prefijo /api/empl externamente;
// puertas adentro, este servicio responde directo en su raíz.
// Si tu NGINX reenvía el prefijo tal cual, usa:
// app.use('/api/empl', departamentosRoutes);
app.use(departamentosRoutes);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`EmployeeService corriendo en http://0.0.0.0:${PORT}`);
});