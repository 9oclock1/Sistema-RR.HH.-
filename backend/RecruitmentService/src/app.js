const express = require("express");
const cors = require("cors");
const pool = require("../db/pool");
const convocatoriasRoutes = require("./routes/convocatorias");
const convocatoriaRoutes = require("./routes/convocatoriaRoutes");
const applicantRoutes = require("./routes/applicantRoutes");
const postulacionRoutes = require("./routes/postulacionRoutes");
const cvDataRoutes = require("./routes/cvDataRoutes");
const errorHandler = require("./middlewares/errorHandler");

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

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

// RF-08 convocatorias; RF-10 agrega GET /convocatorias/:id/postulantes.
app.use("/convocatorias", convocatoriasRoutes);
app.use("/convocatorias", convocatoriaRoutes);

// === RF-09: Applicant Registration Routes ===
app.use("/applicants", applicantRoutes);
app.use("/postulantes", applicantRoutes);

// RF-10: carga y consulta de CV.
app.use("/postulaciones", postulacionRoutes);

// RF-11: datos extraídos del CV.
app.use(cvDataRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    statusCode: 404,
    error: "Ruta no encontrada.",
    message: "Ruta no encontrada.",
  });
});

// Debe ir después de todas las rutas.
app.use(errorHandler);

module.exports = app;
