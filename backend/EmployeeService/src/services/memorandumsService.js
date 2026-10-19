const fs = require("node:fs");
const path = require("node:path");
const pool = require("../../db/pool");
const memorandumsModel = require("../models/memorandumsModel");
const asignacionesModel = require("../models/asignacionesModel");
const pdfGeneratorService = require("./pdfGeneratorService");
const acusesMemorandumService = require("./acusesMemorandumService");
const HttpError = require("../utils/HttpError");
const { withTransaction } = require("../utils/transaction");

// RF-37 (criterio 4): amonestaciones previas en el periodo que disparan la alerta roja a RRHH.
const MESES_PERIODO_ALERTA = 6;
const UMBRAL_ALERTA_ROJA = 3;

const CLASIFICACION_AMONESTACION = "AMONESTACION";

const construirCite = (gestion, numero) =>
  `MEM-${gestion}-${String(numero).padStart(4, "0")}`;

const errorTipoMemo = (mensaje) =>
  new HttpError(400, mensaje, {
    campos_faltantes: [],
    errores: [{ campo: "id_tipo_memo", mensaje }],
  });

const crearMemorandum = async (datos) => {
  const amonestacionesPrevias = await memorandumsModel.contarRecientes(
    pool,
    datos.id_empleado_receptor,
    MESES_PERIODO_ALERTA,
  );

  // El PDF se genera dentro de la transacción: si falla, no queda un memorándum sin documento
  // ni un correlativo consumido.
  let rutaPdf = null;
  let memorandum;
  try {
    memorandum = await withTransaction(async (client) => {
      const tipo = await memorandumsModel.obtenerTipo(
        client,
        datos.id_tipo_memo,
      );
      if (!tipo) {
        throw errorTipoMemo(
          `No existe un tipo de memorándum con id_tipo_memo = ${datos.id_tipo_memo}.`,
        );
      }
      if (
        tipo.clasificacion.trim().toUpperCase() !== CLASIFICACION_AMONESTACION
      ) {
        throw errorTipoMemo(
          `El tipo de memorándum '${tipo.nombre}' no corresponde a una llamada de atención.`,
        );
      }

      const hoy = await asignacionesModel.fechaActual(client);
      const gestion = Number(hoy.slice(0, 4));
      const numero = await memorandumsModel.siguienteCorrelativo(
        client,
        gestion,
      );

      const amonestacion = await memorandumsModel.insertarAmonestacion(client, {
        ...datos,
        fecha_emision: hoy,
        gestion,
        numero_correlativo: numero,
        codigo_cite: construirCite(gestion, numero),
      });

      const documento = await memorandumsModel.obtenerParaDocumento(
        client,
        amonestacion.id_memorandum,
      );
      rutaPdf = await pdfGeneratorService.generarPdfMemorandum(documento);
      return memorandumsModel.guardarRutaPdf(
        client,
        amonestacion.id_memorandum,
        rutaPdf,
      );
    });
  } catch (error) {
    if (rutaPdf) await pdfGeneratorService.descartarPdf(rutaPdf);
    throw error;
  }

  return {
    memorandum,
    alerta_roja: amonestacionesPrevias >= UMBRAL_ALERTA_ROJA,
    // RF-39: el aviso al colaborador sale recién con el memorándum confirmado.
    notificado: await acusesMemorandumService.notificarEmision(memorandum.id_memorandum),
  };
};

const listarTipos = async (clasificacion) =>
  memorandumsModel.listarTipos(pool, clasificacion);

// Resuelve el PDF de un memorándum a una ruta absoluta dentro del directorio de la aplicación.
const obtenerDocumentoPdf = async (idMemorandum) => {
  const documento = await memorandumsModel.obtenerDocumento(pool, idMemorandum);
  if (!documento)
    throw new HttpError(404, "No existe el memorándum solicitado.");
  if (!documento.documento_pdf_url)
    throw new HttpError(
      404,
      "El memorándum aún no tiene un documento PDF generado.",
    );

  const raiz = process.cwd();
  const ruta = path.resolve(raiz, `.${documento.documento_pdf_url}`);
  const relativa = path.relative(raiz, ruta);
  if (
    relativa.startsWith("..") ||
    path.isAbsolute(relativa) ||
    !fs.existsSync(ruta)
  ) {
    throw new HttpError(
      404,
      "El archivo PDF del memorándum no está disponible.",
    );
  }

  return { ruta, nombre: `${documento.codigo_cite}.pdf` };
};

module.exports = { crearMemorandum, listarTipos, obtenerDocumentoPdf };
