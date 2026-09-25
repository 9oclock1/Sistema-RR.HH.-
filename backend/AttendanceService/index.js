const express = require("express");
const cors = require("cors");
const pool = require("./src/config/db");
const turnosRoutes = require("./src/routes/turnos.routes");
const marcajesRoutes = require("./src/routes/marcajes.routes");
const manejadorErrores = require("./src/middlewares/manejadorErrores");

const app = express();
const PORT = process.env.PORT || 3004;

app.use(cors());
app.use(express.json());

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
app.use(manejadorErrores);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`AttendanceService corriendo en http://0.0.0.0:${PORT}`);
});
