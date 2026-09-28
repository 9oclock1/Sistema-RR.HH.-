import app from "./src/app.js";
import { pool } from "./src/config/dbConfig.js";

const PORT = process.env.PORT || 3003;

app.get("/", (req, res) => {
  res.json({ service: "RecruitmentService", status: "Online", port: PORT });
});

app.get("/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() as db_time");
    res.json({
      service: "RecruitmentService",
      db_connected: true,
      timestamp: result.rows[0].db_time,
    });
  } catch (error) {
    res.status(500).json({
      service: "RecruitmentService",
      db_connected: false,
      error: error.message,
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`RecruitmentService corriendo en http://0.0.0.0:${PORT}`);
});
