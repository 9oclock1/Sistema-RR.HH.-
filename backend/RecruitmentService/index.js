const express = require("express");
const cors = require("cors");
const pool = require("./db/pool");
const convocatoriasRoutes = require("./src/routes/convocatorias");
const errorHandler = require("./src/middlewares/errorHandler");

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());

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
    res
      .status(500)
      .json({
        service: "RecruitmentService",
        db_connected: false,
        error: error.message,
      });
  }
});
app.use("/convocatorias", convocatoriasRoutes);

app.use(errorHandler);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`RecruitmentService corriendo en http://0.0.0.0:${PORT}`);
});
