const app = require("./src/app");
const pool = require("./db/pool");

const PORT = process.env.PORT || 3003;

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

// Solo si CV_PARSER_PROVIDER=local
const warmUpModel = async () => {
  try {
    const baseUrl =
      process.env.OLLAMA_BASE_URL || "http://host.docker.internal:11434";
    const model = process.env.OLLAMA_MODEL;
    if (process.env.CV_PARSER_PROVIDER === "local" && model) {
      console.log(`[RecruitmentService] Precargando modelo ${model}`);
      fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, keep_alive: -1 }),
      }).catch(() => {});
    }
  } catch (err) {
    console.warn("[RecruitmentService] No se pudo conectar a Ollama");
  }
};

app.listen(PORT, "0.0.0.0", () => {
  console.log(`RecruitmentService corriendo en http://0.0.0.0:${PORT}`);
  initDbSeed();
});
