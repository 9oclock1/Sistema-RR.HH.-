import express from "express";
import cors from "cors";
import { pool } from "./src/config/dbConfig.js";
import cvTestRoutes from "./src/routes/cvTestRoutes.js";
import postulacionRoutes from "./src/routes/postulacionRoutes.js";
import { errorHandler } from "./src/middlewares/errorHandler.js";

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.json({ service: "RecruitmentService", status: "Online", port: PORT });
});

// endpoints funcionalidades
app.use("/cv", cvTestRoutes);
app.use("/postulaciones", postulacionRoutes);

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

app.use(errorHandler);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`RecruitmentService corriendo en http://0.0.0.0:${PORT}`);
});
