const express = require("express");
const cors = require("cors");
const pool = require("./src/config/db");
const conceptosRoutes = require("./src/routes/conceptos.routes");
const antiguedadRoutes = require("./src/routes/antiguedad.routes");
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
app.use(antiguedadRoutes);
app.use(manejadorErrores);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`CompensationService corriendo en http://0.0.0.0:${PORT}`);
});
