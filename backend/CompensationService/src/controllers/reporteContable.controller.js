const servicio = require("../services/reporteContable.service");
const exportacion = require("../services/reporteContableExportacion");
const { ErrorApp } = require("../utils/errores");

const FORMATOS = ["json", "csv", "pdf"];

const descarga = (res, tipo, { nombre, contenido }) => {
  res.set({
    "Content-Type": tipo,
    "Content-Disposition": `attachment; filename="${nombre}"`,
    "Cache-Control": "private, no-store",
  });
  res.send(contenido);
};

function formatoDe(req) {
  const formato = (req.query.formato || "json").toLowerCase();
  if (!FORMATOS.includes(formato)) {
    throw new ErrorApp(400, "Formato inválido", [{ campo: "formato", mensaje: `Use ${FORMATOS.join(", ")}.` }]);
  }
  return formato;
}

async function enviar(res, formato, reporte) {
  if (formato === "csv") return descarga(res, "text/csv; charset=utf-8", exportacion.aCsv(reporte));
  if (formato === "pdf") return descarga(res, "application/pdf", await exportacion.aPdf(reporte));
  res.json(reporte);
}

// RF-49: consolidado en pantalla (JSON) o descargable con ?formato=csv | pdf.
async function planilla(req, res) {
  const formato = formatoDe(req);
  await enviar(res, formato, await servicio.generarPlanilla(req.params.periodo));
}

async function aguinaldo(req, res) {
  const formato = formatoDe(req);
  await enviar(res, formato, await servicio.generarAguinaldo(req.params.gestion));
}

module.exports = { planilla, aguinaldo };
