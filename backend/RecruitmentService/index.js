import express from "express";
import cvTestRoutes from "./src/routes/cvTestRoutes.js";
import { errorHandler } from "./src/middlewares/errorHandler.js";
import cors from "cors";
import { Pool } from "pg";

const app = express();
const PORT = process.env.PORT || 3003;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ service: "RecruitmentService", status: "Online", port: PORT });
});

app.use("/cv", cvTestRoutes);

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

app.get("/vacancies", (req, res) => {
  res.json([
    { id: 101, title: "programador", status: "abierta", candidates: 5 },
    { id: 102, title: "abogado", status: "evaluación", candidates: 3 },
  ]);
});

app.use(errorHandler);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`RecruitmentService corriendo en http://0.0.0.0:${PORT}`);
});
