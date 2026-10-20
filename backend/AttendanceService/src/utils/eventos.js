const TIPO_EVENTO = {
  ROL_TURNOS_PUBLICADO: "ROL_TURNOS_PUBLICADO",
  JORNADA_CONSOLIDADA: "JORNADA_CONSOLIDADA",
  JORNADA_RECALCULADA: "JORNADA_RECALCULADA",
  HORAS_EXTRA_CONSOLIDADAS: "HORAS_EXTRA_CONSOLIDADAS",
  PERSONAL_NO_DISPONIBLE: "PERSONAL_NO_DISPONIBLE",
};
const ESTADO_EVENTO = { PENDIENTE: 1, ENTREGADO: 2, FALLIDO: 3 };

const TOPICO = {
  PRODUCCION_LOGISTICA: "produccion-logistica",
  ENTREGAS_DESPACHOS: "entregas-despachos",
  COMPENSACIONES: "compensaciones",
};

// Remitente y grupos destino dentro del proyecto de Pub/Sub que comparten los módulos del ERP.
const ORIGEN = { grupo: "F", modulo: "RRHH" };
const DESTINOS = {
  [TOPICO.PRODUCCION_LOGISTICA]: { grupo: "G", modulo: "Producción y Logística" },
  [TOPICO.ENTREGAS_DESPACHOS]: { grupo: "H", modulo: "Entregas y Despachos" },
};
const VERSION_ESQUEMA = 1;

// Reintentos del envío por HTTP (Compensaciones); Pub/Sub solo da por fallido un error permanente.
const MAXIMO_INTENTOS = 8;
const ESPERA_BASE_MS = 30 * 1000;
const ESPERA_MAXIMA_MS = 60 * 60 * 1000;

const leerCodigos = (texto) =>
  new Set(
    (texto ?? "")
      .split(",")
      .map((codigo) => codigo.trim().toUpperCase())
      .filter(Boolean)
  );

// Producción (panadería, fraccionamiento) → Producción y Logística; reparto → Entregas y Despachos.
function topicosDelArea(codigoArea, { areasProduccion, areasReparto }) {
  const codigo = (codigoArea ?? "").toUpperCase();
  const topicos = [];
  if (leerCodigos(areasProduccion).has(codigo)) topicos.push(TOPICO.PRODUCCION_LOGISTICA);
  if (leerCodigos(areasReparto).has(codigo)) topicos.push(TOPICO.ENTREGAS_DESPACHOS);
  return topicos;
}

// Espera exponencial entre reintentos: 30 s, 1 min, 2 min… hasta 1 h.
const esperaReintento = (intentos) => Math.min(ESPERA_BASE_MS * 2 ** Math.max(intentos - 1, 0), ESPERA_MAXIMA_MS);

// Cada grupo lee su propio tópico: <prefijo><letra>, p. ej. ucb-sis323-sub-g.
const topicoDelGrupo = (prefijo, grupo) => `${prefijo}${grupo.toLowerCase()}`;

// El encabezado dice de quién es el mensaje y para quién; el contenido va en `datos`.
function armarMensaje({ idMensaje, destino, tipo, fecha, datos }) {
  return {
    encabezado: { id_mensaje: idMensaje, origen: ORIGEN, destino, tipo, fecha, version_esquema: VERSION_ESQUEMA },
    datos,
  };
}

// Mismo encabezado como atributos de Pub/Sub, para filtrar sin leer el cuerpo.
const atributosDe = ({ encabezado }) => ({
  id_mensaje: encabezado.id_mensaje,
  origen: encabezado.origen.grupo,
  origen_modulo: encabezado.origen.modulo,
  destino: encabezado.destino.grupo,
  destino_modulo: encabezado.destino.modulo,
  tipo: encabezado.tipo,
  version_esquema: String(encabezado.version_esquema),
});

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
      return { mensaje: "No se pudo conectar con Pub/Sub", permanente: false };
  }
}

const FRANJA_POR_TIPO = { DIURNO: "manana", VESPERTINO: "tarde", NOCTURNO: "noche" };

const hora = (valor) => valor?.slice(0, 5) ?? null;

// Cuerpo del evento: personal por día y cuántos cubren cada franja.
function armarCargaPublicacion(detalle) {
  const turnos = new Map(detalle.turnos.map((t) => [t.id_turno, t]));
  const vigentes = detalle.empleados.filter((e) => e.vigente);
  const celdas = new Map(detalle.asignaciones.map((a) => [`${a.id_empleado}|${a.fecha}`, a]));

  const disponibilidad = detalle.dias.map((fecha) => {
    const dia = { fecha, manana: 0, tarde: 0, noche: 0, descanso: 0 };
    for (const empleado of vigentes) {
      const celda = celdas.get(`${empleado.id_empleado}|${fecha}`);
      if (!celda) continue;
      if (celda.descanso) dia.descanso += 1;
      else dia[FRANJA_POR_TIPO[turnos.get(celda.id_turno)?.tipo_codigo] ?? "manana"] += 1;
    }
    return dia;
  });

  return {
    id_rol: detalle.id_rol,
    version: detalle.version_publicada,
    publicado_en: detalle.publicado_en,
    sucursal: detalle.sucursal,
    area: detalle.area,
    periodo: detalle.periodo.codigo,
    fecha_inicio: detalle.fecha_inicio,
    fecha_fin: detalle.fecha_fin,
    disponibilidad,
    personal: vigentes.map((empleado) => ({
      id_empleado: empleado.id_empleado,
      nombre_completo: empleado.nombre_completo,
      cargo: empleado.cargo,
      turnos: detalle.dias.flatMap((fecha) => {
        const celda = celdas.get(`${empleado.id_empleado}|${fecha}`);
        if (!celda) return [];
        const turno = turnos.get(celda.id_turno);
        return [
          {
            fecha,
            descanso: celda.descanso,
            turno: celda.descanso ? null : { nombre: turno.nombre, hora_inicio: hora(turno.hora_inicio), hora_fin: hora(turno.hora_fin) },
          },
        ];
      }),
    })),
  };
}

// KAN-53: ausencia aprobada. Producción y Logística (operarios) y Entregas y Despachos (choferes) la leen para
// sacar al empleado de su planificación entre esas fechas.
function armarCargaIndisponibilidad({ solicitud, categoria, empleado, ubicacion, aprobadoPor, aprobadoEn }) {
  return {
    id_solicitud: solicitud.id_solicitud,
    categoria,
    tipo: solicitud.tipo_nombre ?? "Vacaciones",
    fecha_inicio: solicitud.fecha_inicio,
    fecha_fin: solicitud.fecha_fin,
    dias: solicitud.dias_solicitados ?? solicitud.dias_habiles,
    con_goce_haberes: categoria === "VACACIONES" ? true : solicitud.es_con_goce_haberes,
    empleado: {
      id_empleado: solicitud.id_empleado,
      nombre_completo: empleado.nombre_completo,
      cargo: ubicacion.cargo,
      area: ubicacion.area,
      sucursal: ubicacion.sucursal,
    },
    aprobado_por: aprobadoPor,
    aprobado_en: aprobadoEn,
  };
}

module.exports = {
  TIPO_EVENTO,
  ESTADO_EVENTO,
  TOPICO,
  ORIGEN,
  DESTINOS,
  MAXIMO_INTENTOS,
  topicosDelArea,
  esperaReintento,
  topicoDelGrupo,
  armarMensaje,
  atributosDe,
  errorDePublicacion,
  armarCargaPublicacion,
  armarCargaIndisponibilidad,
};
