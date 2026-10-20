const servicio = require("../services/reportes.service");
const exportacion = require("../services/reportesExportacion");
const { ErrorApp } = require("../utils/errores");

const FORMATOS = ["json", "csv", "pdf"];

// Temporal: el portal envía quién consulta (X-Empleado-Id) y su rol (X-Rol) hasta contar con autenticación.
const identidad = (req) => ({
  idEmpleado: req.get("X-Empleado-Id")?.trim().toLowerCase() || null,
  rol: req.get("X-Rol")?.trim().toLowerCase() || null,
});

const descarga = (res, tipo, { nombre, contenido }) => {
  res.set({
    "Content-Type": tipo,
    "Content-Disposition": `attachment; filename="${nombre}"`,
    "Cache-Control": "private, no-store",
  });
  res.send(contenido);
};

// RF-29: consolidado en pantalla (JSON) o descargable con ?formato=csv | pdf.
async function asistencia(req, res) {
  const formato = (req.query.formato || "json").toLowerCase();
  if (!FORMATOS.includes(formato)) {
    throw new ErrorApp(400, "Formato inválido", [{ campo: "formato", mensaje: `Use ${FORMATOS.join(", ")}.` }]);
  }
  const reporte = await servicio.generar(req.query, identidad(req));
  if (formato === "csv") return descarga(res, "text/csv; charset=utf-8", exportacion.aCsv(reporte));
  if (formato === "pdf") return descarga(res, "application/pdf", await exportacion.aPdf(reporte));
  res.json(reporte);
}

async function alcance(req, res) {
  res.json(await servicio.alcanceFiltros(identidad(req)));
}

module.exports = { asistencia, alcance };
