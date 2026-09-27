const express = require("express");
const cors = require("cors");
const pool = require("./src/config/db");
const applicantRoutes = require("./src/routes/applicantRoutes");
const manejadorErrores = require("./src/middlewares/manejadorErrores");

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

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

app.get("/vacancies", (req, res) => {
  res.json([
    { id: 101, title: "programador", status: "abierta", candidates: 5 },
    { id: 102, title: "abogado", status: "evaluación", candidates: 3 },
  ]);
});

// === RF-09: Applicant Registration Routes ===
app.use("/applicants", applicantRoutes);
app.use("/postulantes", applicantRoutes);

// ── Stage Catalog Auto-Seed Self-Healing ──
async function initDbSeed() {
  try {
    await pool.query(`
      INSERT INTO CATALOGOS_ETAPA_POSTULACION (id_etapa, codigo, nombre, orden_flujo) VALUES
      (1, 'POSTULADO', 'Postulación Recibida', 1),
      (2, 'REVISION_CV', 'Revisión Curricular', 2),
      (3, 'ENTREVISTA', 'Entrevista', 3),
      (4, 'EVALUACION', 'Evaluación Técnica', 4),
      (5, 'FINALISTA', 'Finalista / Oferta', 5),
      (6, 'CONTRATADO', 'Contratado', 6),
      (7, 'RECHAZADO', 'No Seleccionado', 7)
      ON CONFLICT (id_etapa) DO NOTHING;
    `);
    console.log("[DB] Catálogo de etapas inicializado/verificado correctamente.");
  } catch (err) {
    console.warn("[DB] Advertencia al verificar catálogo de etapas:", err.message);
  }
}

// ── Centralized Error Handling Middleware ──
app.use(manejadorErrores);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`RecruitmentService corriendo en http://0.0.0.0:${PORT}`);
  initDbSeed();
});
