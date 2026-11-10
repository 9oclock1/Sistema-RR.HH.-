const ESTADO_EVENTO = { PENDIENTE: 1, ENTREGADO: 2, FALLIDO: 3, OMITIDO: 4 };

const TIPO_SOLICITUD_METRICAS_CRM = "SOLICITUD_METRICAS_CRM";

const ORIGEN = { grupo: "F", modulo: "RRHH" };
const DESTINO_CRM = { grupo: "B", modulo: "CRM" };
const VERSION_ESQUEMA = 1;

const TOPICO_POR_DEFECTO = "ucb-sis323-sub-f";
const TIEMPO_PUBLICACION_POR_DEFECTO_MS = 15000;

const topicoRrhh = () => process.env.PUBSUB_TOPICO || TOPICO_POR_DEFECTO;
const tiempoPublicacionMs = () =>
  Number(process.env.PUBSUB_TIMEOUT_MS) || TIEMPO_PUBLICACION_POR_DEFECTO_MS;

// Cargos (código de CARGOS en EmployeeService) cuyas métricas mide el CRM: cajeros y atención al cliente.
const CARGOS_CRM_POR_DEFECTO = ["ATC-CAJ", "ATC-ASE"];
const cargosCrm = () => {
  const codigos = (process.env.CRM_CARGOS_METRICAS ?? "")
    .split(",")
    .map((codigo) => codigo.trim().toUpperCase())
    .filter(Boolean);
  return codigos.length > 0 ? codigos : CARGOS_CRM_POR_DEFECTO;
};

function armarMensaje({ idMensaje, destino, tipo, fecha, datos }) {
  return {
    encabezado: {
      id_mensaje: idMensaje,
      origen: ORIGEN,
      destino,
      tipo,
      fecha,
      version_esquema: VERSION_ESQUEMA,
    },
    datos,
  };
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

// Solicitud de métricas del periodo al CRM: ciclo, periodo y colaboradores de atención al cliente y cajas.
// ciclo: { id_ciclo, nombre, fecha_inicio, fecha_limite, cerrado_en, id_periodo, periodo, periodo_fecha_inicio,
//          periodo_fecha_fin }. colaboradores: ya filtrados por cargo.
function armarSolicitudMetricasCrm({ idMensaje, fecha, ciclo, colaboradores }) {
  return armarMensaje({
    idMensaje,
    destino: DESTINO_CRM,
    tipo: TIPO_SOLICITUD_METRICAS_CRM,
    fecha,
    datos: {
      id_ciclo: ciclo.id_ciclo,
      ciclo: {
        nombre: ciclo.nombre,
        fecha_inicio: ciclo.fecha_inicio,
        fecha_limite: ciclo.fecha_limite,
        cerrado_en: ciclo.cerrado_en,
      },
      periodo: {
        id_periodo: ciclo.id_periodo,
        nombre: ciclo.periodo,
        fecha_inicio: ciclo.periodo_fecha_inicio,
        fecha_fin: ciclo.periodo_fecha_fin,
      },
      colaboradores,
    },
  });
}

// De los colaboradores evaluados en el ciclo, solo los que ocupan un cargo que mide el CRM.
// idsEvaluados: ids guardados en el evento. personal: GET /empleados. cargos: GET /jerarquia/cargos.
function seleccionarColaboradoresCrm(
  idsEvaluados,
  personal,
  cargos,
  codigosCargo = cargosCrm(),
) {
  const codigoPorCargo = new Map(
    cargos.map((cargo) => [cargo.id_cargo, cargo]),
  );
  const evaluados = new Set(idsEvaluados);
  return personal
    .filter((persona) => evaluados.has(persona.id_empleado))
    .flatMap((persona) => {
      const cargo = codigoPorCargo.get(persona.id_cargo);
      if (!cargo || !codigosCargo.includes(String(cargo.codigo).toUpperCase()))
        return [];
      return [
        {
          id_empleado: persona.id_empleado,
          nombre_completo: persona.nombre_completo,
          cargo: { codigo: cargo.codigo, nombre: cargo.nombre },
          id_sucursal: persona.id_sucursal,
          sucursal: persona.sucursal,
        },
      ];
    })
    .sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo, "es"));
}

// Reintentos con espera exponencial (30 s, 1 min, 2 min… hasta 1 h). Al agotar los intentos el evento queda
// FALLIDO y solo vuelve a salir con un reintento manual.
const MAXIMO_INTENTOS = 8;
const ESPERA_BASE_MS = 30 * 1000;
const ESPERA_MAXIMA_MS = 60 * 60 * 1000;

const esperaReintento = (intentos) =>
  Math.min(ESPERA_BASE_MS * 2 ** Math.max(intentos - 1, 0), ESPERA_MAXIMA_MS);

// Un tópico inexistente o un mensaje inválido no se arreglan reintentando; la red o las credenciales, sí.
function errorDePublicacion(error, topico) {
  switch (error?.code) {
    case 5:
      return {
        mensaje: `El tópico ${topico} no existe en Pub/Sub`,
        permanente: true,
      };
    case 3:
      return { mensaje: "Pub/Sub rechazó el mensaje", permanente: true };
    case 7:
    case 16:
      return { mensaje: "Pub/Sub rechazó las credenciales", permanente: false };
    case "ENOENT":
      return {
        mensaje: "No se encontró la llave de la cuenta de servicio",
        permanente: false,
      };
    default:
      return {
        mensaje:
          error?.message === "Pub/Sub no respondió a tiempo"
            ? error.message
            : "No se pudo conectar con Pub/Sub",
        permanente: false,
      };
  }
}

module.exports = {
  ESTADO_EVENTO,
  TIPO_SOLICITUD_METRICAS_CRM,
  ORIGEN,
  DESTINO_CRM,
  topicoRrhh,
  tiempoPublicacionMs,
  cargosCrm,
  armarMensaje,
  atributosDe,
  armarSolicitudMetricasCrm,
  seleccionarColaboradoresCrm,
  MAXIMO_INTENTOS,
  esperaReintento,
  errorDePublicacion,
};
