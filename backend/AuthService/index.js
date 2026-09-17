const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3001;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ service: "AuthService", status: "Online", port: PORT });
});

// pruebita postgre
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

// pruebita endpoint
app.post("/login", (req, res) => {
  const { email } = req.body;
  res.json({
    message: "pruebita",
    user: email || "admin@empresa.com",
    token: "fake-jwt-token-123",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`AuthService corriendo en http://0.0.0.0:${PORT}`);
});
