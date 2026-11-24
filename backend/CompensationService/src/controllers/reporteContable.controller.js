const servicio = require("../services/reporteContable.service");
const exportacion = require("../services/reporteContableExportacion");
const { ErrorApp } = require("../utils/errores");

const FORMATOS = ["json", "xlsx", "pdf"];
const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; charset=utf-8";

// Temporal: el portal envía quién actúa (X-Empleado-Id) y su rol (X-Rol) hasta contar con autenticación.
const identidad = (req) => ({
  idEmpleado: req.get("X-Empleado-Id")?.trim() || null,
  rol: req.get("X-Rol")?.trim() || null,
});

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
  if (formato === "xlsx") return descarga(res, TIPO_XLSX, await exportacion.aXlsx(reporte));
  if (formato === "pdf") return descarga(res, "application/pdf", await exportacion.aPdf(reporte));
  res.json(reporte);
}

// RF-49: consolidado en pantalla (JSON) o descargable con ?formato=xlsx | pdf.
async function planilla(req, res) {
  const formato = formatoDe(req);
  await enviar(res, formato, await servicio.generarPlanilla(req.params.periodo, identidad(req)));
}

async function aguinaldo(req, res) {
  const formato = formatoDe(req);
  await enviar(res, formato, await servicio.generarAguinaldo(req.params.gestion, identidad(req)));
}

module.exports = { planilla, aguinaldo };
