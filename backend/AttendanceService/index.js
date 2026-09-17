const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3004;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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

app.post("/check-in", (req, res) => {
  const { employeeId } = req.body;
  res.json({
    message: "Registro de entrada exitoso",
    employeeId: employeeId || 1,
    time: new Date(),
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`AttendanceService corriendo en http://0.0.0.0:${PORT}`);
});
