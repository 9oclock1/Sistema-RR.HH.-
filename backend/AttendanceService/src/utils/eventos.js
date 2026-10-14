const TIPO_EVENTO = { ROL_TURNOS_PUBLICADO: "ROL_TURNOS_PUBLICADO", JORNADA_CONSOLIDADA: "JORNADA_CONSOLIDADA" };
const ESTADO_EVENTO = { PENDIENTE: 1, ENTREGADO: 2, FALLIDO: 3 };

const TOPICO = {
  PRODUCCION_LOGISTICA: "produccion-logistica",
  ENTREGAS_DESPACHOS: "entregas-despachos",
  COMPENSACIONES: "compensaciones",
};

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
    evento: TIPO_EVENTO.ROL_TURNOS_PUBLICADO,
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

module.exports = {
  TIPO_EVENTO,
  ESTADO_EVENTO,
  TOPICO,
  MAXIMO_INTENTOS,
  topicosDelArea,
  esperaReintento,
  armarCargaPublicacion,
};
