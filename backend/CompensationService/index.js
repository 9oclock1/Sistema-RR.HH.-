const express = require("express");
const cors = require("cors");
const pool = require("./src/config/db");
const conceptosRoutes = require("./src/routes/conceptos.routes");
const condicionesRoutes = require("./src/routes/condiciones.routes");
const anticiposRoutes = require("./src/routes/anticipos.routes");
const antiguedadRoutes = require("./src/routes/antiguedad.routes");
const planillasRoutes = require("./src/routes/planillas.routes");
const ventasProductividadRoutes = require("./src/routes/ventasProductividad.routes");
const manejadorErrores = require("./src/middlewares/manejadorErrores");
const ventasProductividad = require("./src/services/ventasProductividad.service");

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
app.use(ventasProductividadRoutes);
app.use(manejadorErrores);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`CompensationService corriendo en http://0.0.0.0:${PORT}`);
});

// RF-51: se suscribe al cierre de ventas del periodo publicado por Marketplace y Ventas (grupo E).
ventasProductividad.iniciarConsumidor();
