const express = require("express");
const cors = require("cors");
const pool = require("./src/config/db");
const authRoutes = require("./src/routes/auth.routes");
const manejadorErrores = require("./src/middlewares/manejadorErrores");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ service: "AuthService", status: "Online", port: PORT });
});

app.get("/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() as db_time");
    res.json({
      service: "AuthService",
      db_connected: true,
      timestamp: result.rows[0].db_time,
    });
  } catch (error) {
    res
      .status(500)
      .json({
        service: "AuthService",
        db_connected: false,
        error: error.message,
      });
  }
});

app.use(authRoutes);
app.use(manejadorErrores);

if (require.main === module) {
  if (!process.env.JWT_SECRET) console.error("Falta JWT_SECRET: no se podrá iniciar sesión.");
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AuthService corriendo en http://0.0.0.0:${PORT}`);
  });
}

module.exports = app;
