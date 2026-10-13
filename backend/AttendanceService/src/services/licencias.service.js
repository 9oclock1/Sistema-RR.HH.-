const modelo = require("../models/licencias.model");
const empleados = require("./empleados.service");
const almacenamiento = require("../utils/almacenamiento");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const { validarSolicitudLicencia } = require("../utils/validarSolicitudLicencia");
const { ESTADO_SOLICITUD, diasSolicitados, evaluarLimite } = require("../utils/licencias");

const EXCLUSION_VIOLADA = "23P01";

async function verificarEmpleado(idEmpleado) {
  const empleado = UUID_RE.test(idEmpleado) ? await empleados.obtener(idEmpleado) : null;
  if (!empleado) throw new ErrorApp(403, "El usuario no corresponde a un empleado registrado.");
  if (empleado.activo !== true) {
    throw new ErrorApp(403, "El empleado no está activo, por lo que no puede solicitar licencias.");
  }
  return empleado;
}

const conClasificacion = (solicitud) => ({
  ...solicitud,
  clasificacion_nomina: solicitud.es_con_goce_haberes ? "CON_GOCE" : "SIN_GOCE",
});

const listarTipos = () => modelo.listarTipos();

async function listarMisSolicitudes(idEmpleado) {
  await verificarEmpleado(idEmpleado);
  return (await modelo.listarPorEmpleado(idEmpleado)).map(conClasificacion);
}

async function radicar(idEmpleado, datos, archivos = []) {
  await verificarEmpleado(idEmpleado);
  const solicitud = validarSolicitudLicencia(datos);

  const tipo = await modelo.obtenerTipo(solicitud.id_tipo_licencia);
  if (!tipo) {
    throw new ErrorApp(400, "Datos de solicitud inválidos", [
      { campo: "id_tipo_licencia", mensaje: "Seleccione un tipo de licencia válido." },
    ]);
  }
  // Criterio 3: sin el respaldo obligatorio no se registra nada.
  if (tipo.requiere_adjunto && archivos.length === 0) {
    throw new ErrorApp(400, "Datos de solicitud inválidos", [
      { campo: "archivos", mensaje: `La licencia «${tipo.nombre}» exige adjuntar el respaldo digital.` },
    ]);
  }

  const dias = diasSolicitados(solicitud.fecha_inicio, solicitud.fecha_fin);
  const { tope, excede } = evaluarLimite(tipo, dias);

  const claves = [];
  try {
    const adjuntos = [];
    for (const archivo of archivos) {
      const clave = await almacenamiento.guardar(archivo);
      claves.push(clave);
      adjuntos.push({
        clave,
        // multer entrega el nombre como latin1; se recupera el UTF-8 original.
        nombreOriginal: Buffer.from(archivo.originalname, "latin1").toString("utf8").slice(0, 255),
        mimetype: archivo.mimetype,
        tamano: archivo.size,
      });
    }
    const idSolicitud = await modelo.crear(
      {
        idEmpleado,
        idTipo: tipo.id_tipo_licencia,
        idEstado: ESTADO_SOLICITUD.PENDIENTE,
        fechaInicio: solicitud.fecha_inicio,
        fechaFin: solicitud.fecha_fin,
        esConGoceHaberes: tipo.es_con_goce_haberes,
        excedeLimiteDias: excede,
        motivo: solicitud.motivo,
      },
      adjuntos
    );
    const creada = conClasificacion(await modelo.obtener(idSolicitud));
    // Criterio 4: se registra igual, pero queda marcada y se advierte que necesita autorización de RRHH.
    const advertencias = excede
      ? [
          `La licencia «${tipo.nombre}» permite hasta ${tope} día(s) continuos y se solicitaron ${dias}. ` +
            "Requiere autorización especial de RRHH.",
        ]
      : [];
    return { ...creada, requiere_autorizacion_rrhh: excede, advertencias };
  } catch (error) {
    await Promise.all(claves.map((clave) => almacenamiento.eliminar(clave).catch(() => {})));
    if (error.code === EXCLUSION_VIOLADA) {
      throw new ErrorApp(409, "Ya tiene una licencia pendiente o aprobada que coincide con esas fechas.", [
        { campo: "fecha_inicio", mensaje: "Elija fechas que no se solapen con otra solicitud activa." },
      ]);
    }
    throw error;
  }
}

async function obtenerAdjunto(idEmpleado, idSolicitud, idAdjunto) {
  await verificarEmpleado(idEmpleado);
  const adjunto =
    UUID_RE.test(idSolicitud) && UUID_RE.test(idAdjunto) ? await modelo.obtenerAdjunto(idSolicitud, idAdjunto) : null;
  // Para otro empleado se responde igual que si no existiera.
  if (!adjunto || adjunto.id_empleado !== idEmpleado) throw new ErrorApp(404, "Comprobante no encontrado");
  return {
    ruta: almacenamiento.rutaDe(adjunto.archivo_url),
    nombre: adjunto.nombre_original,
    mimetype: adjunto.formato_mimetype,
  };
}

module.exports = { listarTipos, listarMisSolicitudes, radicar, obtenerAdjunto };
