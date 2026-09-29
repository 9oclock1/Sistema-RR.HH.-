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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`RecruitmentService corriendo en http://0.0.0.0:${PORT}`);
  initDbSeed();
});
