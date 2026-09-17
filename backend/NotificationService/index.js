const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3007;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ service: "NotificationService", status: "Online", port: PORT });
});

app.get("/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() as db_time");
    res.json({
      service: "NotificationService",
      db_connected: true,
      timestamp: result.rows[0].db_time,
    });
  } catch (error) {
    res
      .status(500)
      .json({
        service: "NotificationService",
        db_connected: false,
        error: error.message,
      });
  }
});

app.post("/send", (req, res) => {
  const { to, subject } = req.body;
  res.json({
    status: "Enviado",
    to: to || "joseph.cortez@ucb.edu.bo",
    subject: subject || "Alerta de prueba",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`NotificationService corriendo en http://0.0.0.0:${PORT}`);
});
