const { randomUUID } = require("node:crypto");

const TIPO_EVENTO = {
  ALTA_CONTABILIDAD: "ALTA_COLABORADOR_CONTABILIDAD",
  ALTA_OPERATIVA: "ALTA_COLABORADOR_OPERATIVO",
};
const ESTADO_EVENTO = { PENDIENTE: 1, ENTREGADO: 2, FALLIDO: 3 };

// Códigos de CATALOGOS_DESTINO_INTEGRACION.
const DESTINO = {
  CONTABILIDAD: "CONTABILIDAD",
  MARKETPLACE_POS: "MARKETPLACE_POS",
  INVENTARIOS: "INVENTARIOS",
  ENTREGAS: "ENTREGAS",
};

const ORIGEN = { grupo: "F", modulo: "RRHH" };
const VERSION_ESQUEMA = 1;

// Mismo formato que AttendanceService (KAN-44): el encabezado dice de quién es el mensaje y para quién.
function armarMensaje({ idMensaje, destino, tipo, fecha, datos }) {
  return {
    encabezado: {
      id_mensaje: idMensaje,
      origen: ORIGEN,
      destino: { grupo: destino.grupo, modulo: destino.nombre_modulo },
      tipo,
      fecha,
      version_esquema: VERSION_ESQUEMA,
    },
    datos,
  };
}

// Datos comunes del colaborador contratado. id_empleado queda en null hasta que EmployeeService lo registre;
// mientras tanto los módulos lo identifican por id_postulacion y su número de documento.
function armarColaborador({ postulacion, alta, cargo, usuario }) {
  return {
    id_postulacion: postulacion.id_postulacion,
    id_empleado: alta.id_empleado_generado ?? null,
    colaborador: {
      numero_documento: alta.numero_documento,
      nombres: alta.nombres,
      apellidos: alta.apellidos,
      nombre_completo: `${alta.nombres} ${alta.apellidos}`,
      correo_electronico: alta.correo_electronico,
      telefono_contacto: alta.telefono_contacto,
      ciudad: alta.ciudad,
    },
    cargo: {
      codigo: cargo.codigo,
      nombre: cargo.nombre,
      id_cargo_referencial: alta.id_cargo_referencial,
    },
    id_sucursal: alta.id_sucursal_destino,
    convocatoria: {
      id_convocatoria: alta.id_convocatoria,
      codigo: alta.codigo_convocatoria,
      titulo_puesto: alta.titulo_puesto,
    },
    fecha_contratacion: postulacion.contratado_en,
    contratado_por: { id_usuario: usuario.id, nombre: usuario.nombre },
  };
}

function armarMensajesAlta({
  postulacion,
  alta,
  cargo,
  usuario,
  destinos,
  fecha = new Date().toISOString(),
}) {
  const colaborador = armarColaborador({ postulacion, alta, cargo, usuario });
  const contabilidad = destinos[DESTINO.CONTABILIDAD];
  const operativo = destinos[cargo.codigo_destino];

  return [
    {
      destino: contabilidad,
      tipo: TIPO_EVENTO.ALTA_CONTABILIDAD,
      datos: {
        ...colaborador,
        registro_contable: {
          tipo: "CENTRO_COSTO_BENEFICIARIO",
          centro_costo: { id_sucursal: alta.id_sucursal_destino },
        },
      },
    },
    {
      destino: operativo,
      tipo: TIPO_EVENTO.ALTA_OPERATIVA,
      datos: { ...colaborador, modulo_asignado: operativo.codigo },
    },
  ].map(({ destino, tipo, datos }) => {
    const idMensaje = randomUUID();
    return {
      idMensaje,
      destino,
      tipo,
      carga: armarMensaje({ idMensaje, destino, tipo, fecha, datos }),
    };
  });
}

// El encabezado repetido como atributos de Pub/Sub: cada grupo filtra su suscripción por `destino` sin leer el cuerpo.
const atributosDe = ({ encabezado }) => ({
  id_mensaje: encabezado.id_mensaje,
  origen: encabezado.origen.grupo,
  origen_modulo: encabezado.origen.modulo,
  destino: encabezado.destino.grupo,
  destino_modulo: encabezado.destino.modulo,
  tipo: encabezado.tipo,
  version_esquema: String(encabezado.version_esquema),
});

// RF-14.5: reintentos con espera exponencial (30 s, 1 min, 2 min… hasta 1 h). Al agotar los intentos el evento
// queda FALLIDO y solo sale de nuevo con un reintento manual.
const MAXIMO_INTENTOS = 8;
const ESPERA_BASE_MS = 30 * 1000;
const ESPERA_MAXIMA_MS = 60 * 60 * 1000;

const esperaReintento = (intentos) =>
  Math.min(ESPERA_BASE_MS * 2 ** Math.max(intentos - 1, 0), ESPERA_MAXIMA_MS);

// Un tópico inexistente o un mensaje inválido no se arreglan reintentando; la red o las credenciales, sí.
function errorDePublicacion(error, topico) {
  switch (error?.code) {
    case 5:
      return { mensaje: `El tópico ${topico} no existe en Pub/Sub`, permanente: true };
    case 3:
      return { mensaje: "Pub/Sub rechazó el mensaje", permanente: true };
    case 7:
    case 16:
      return { mensaje: "Pub/Sub rechazó las credenciales", permanente: false };
    case "ENOENT":
      return { mensaje: "No se encontró la llave de la cuenta de servicio", permanente: false };
    default:
      return {
        mensaje: error?.message === "Pub/Sub no respondió a tiempo" ? error.message : "No se pudo conectar con Pub/Sub",
        permanente: false,
      };
  }
}

/**
 * Qué hacer con la respuesta REST del ERP:
 * - 2xx: entregado. 409: el destino ya tenía ese id_mensaje (un reintento anterior sí llegó), también entregado.
 * - 408, 429 y 5xx, o sin respuesta (red, tiempo agotado): se reintenta.
 * - Otro 4xx: el destino rechazó el mensaje; reintentar el mismo contenido no lo arregla.
 */
function clasificarRespuestaRest(resultado) {
  if (resultado.ok || resultado.estado === 409) return { entregado: true };
  const reintentable =
    resultado.estado === undefined || resultado.estado >= 500 || [408, 429].includes(resultado.estado);
  return { entregado: false, mensaje: resultado.error, permanente: !reintentable };
}

module.exports = {
  TIPO_EVENTO,
  ESTADO_EVENTO,
  DESTINO,
  ORIGEN,
  armarMensaje,
  armarMensajesAlta,
  atributosDe,
  MAXIMO_INTENTOS,
  esperaReintento,
  errorDePublicacion,
  clasificarRespuestaRest,
};
