const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3006;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ service: "PerformanceService", status: "Online", port: PORT });
});

app.get("/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() as db_time");
    res.json({
      service: "PerformanceService",
      db_connected: true,
      timestamp: result.rows[0].db_time,
    });
  } catch (error) {
    res
      .status(500)
      .json({
        service: "PerformanceService",
        db_connected: false,
        error: error.message,
      });
  }
});

app.get("/reviews", (req, res) => {
  res.json([
    {
      employeeId: 1,
      score: 92,
      period: "Q3-2026",
      feedback: "Excelente trabajo Cortez en el Sprint",
    },
  ]);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`PerformanceService corriendo en http://0.0.0.0:${PORT}`);
});
