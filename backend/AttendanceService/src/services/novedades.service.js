const modelo = require("../models/novedades.model");
const empleados = require("./empleados.service");
const eventos = require("./eventos.service");
const { enTransaccion } = require("../config/transaccion");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const { esFechaValida, sumarDias } = require("../utils/periodos");
const {
  contrastarJornada,
  estadoJornada,
  filasNovedades,
  agruparPorJornada,
  armarCargaConsolidacion,
} = require("../utils/novedades");

// Días hacia atrás que revisa cada contraste (recupera lo que no se procesó si el servicio estuvo detenido).
const DIAS_REVISION = 7;
const LOTE_CONSOLIDACION = 200;
const ORDEN_ESTADO = ["INASISTENCIA", "SIN_MARCAR", "ATRASO", "POR_LLEGAR", "PUNTUAL", "DESCANSO", "SIN_TURNO"];

// Tiempo que se espera después del fin del turno para cerrar la jornada (por defecto 2 horas).
function minutosCierre() {
  const valor = Number(process.env.MINUTOS_CIERRE_JORNADA);
  return Number.isInteger(valor) && valor >= 0 ? valor : 120;
}

function agruparMarcajes(marcajes) {
  const grupos = new Map();
  for (const marcaje of marcajes) {
    if (!grupos.has(marcaje.id_empleado)) grupos.set(marcaje.id_empleado, []);
    grupos.get(marcaje.id_empleado).push(marcaje);
  }
  return grupos;
}

// Contrasta los turnos programados con los marcajes y guarda las novedades nuevas.
// Solo se registra inasistencia a los empleados de `activos` (sin la lista, a nadie).
async function contrastar({ desde, hasta, ids = null, activos = null, ahora }) {
  const programacion = await modelo.listarProgramacion(desde, hasta, ids);
  const idsEmpleados = ids ?? [...new Set(programacion.map((turno) => turno.id_empleado))];
  const marcajes = agruparMarcajes(await modelo.listarMarcajes(idsEmpleados, desde, hasta));

  const resultados = new Map();
  const filas = [];
  for (const turno of programacion) {
    const resultado = contrastarJornada({
      turno,
      fecha: turno.fecha,
      marcajes: marcajes.get(turno.id_empleado) ?? [],
      ahoraMs: ahora.getTime(),
      minutosCierre: minutosCierre(),
      registrarFaltas: activos?.has(turno.id_empleado) ?? false,
    });
    resultados.set(`${turno.id_empleado}|${turno.fecha}`, { turno, resultado });
    filas.push(...filasNovedades(turno, resultado));
  }
  const nuevas = await modelo.registrar(filas);
  return { resultados, nuevas };
}

// Cierra las jornadas terminadas: una novedad se consolida una sola vez y se avisa a compensaciones.
async function consolidar() {
  return enTransaccion(async (cliente) => {
    const novedades = await modelo.reservarPorConsolidar(cliente, minutosCierre(), LOTE_CONSOLIDACION);
    for (const jornada of agruparPorJornada(novedades)) {
      await eventos.registrarConsolidacion(cliente, armarCargaConsolidacion(jornada));
    }
    if (novedades.length > 0) await modelo.marcarConsolidadas(cliente, novedades.map((n) => n.id_novedad));
    return novedades.length;
  });
}

async function ejecutarContraste() {
  const { ahora, hoy } = await modelo.momentoActual();
  // Sin EmployeeService no se sabe quién está activo: las inasistencias esperan al siguiente contraste.
  const activos = await empleados.listarIdsActivos().catch((error) => {
    console.error("Contraste sin inasistencias, no se obtuvo el personal activo:", error.message);
    return null;
  });
  const { nuevas } = await contrastar({ desde: sumarDias(hoy, -DIAS_REVISION), hasta: hoy, activos, ahora });

  let consolidadas = 0;
  let lote;
  do {
    lote = await consolidar();
    consolidadas += lote;
  } while (lote === LOTE_CONSOLIDACION);
  return { nuevas, consolidadas };
}

function iniciarContraste() {
  const intervalo = Number(process.env.INTERVALO_CONTRASTE_MS) || 5 * 60 * 1000;
  let ocupado = false;
  const ejecutar = async () => {
    if (ocupado) return;
    ocupado = true;
    try {
      await ejecutarContraste();
    } catch (error) {
      console.error("Error en el contraste de turnos y marcajes:", error.message);
    } finally {
      ocupado = false;
    }
  };
  setTimeout(ejecutar, 10 * 1000);
  setInterval(ejecutar, intervalo);
}

const resumirNovedad = (n) => ({
  id_novedad: n.id_novedad,
  tipo: { codigo: n.tipo_codigo, nombre: n.tipo_nombre },
  estado: { codigo: n.estado_codigo, nombre: n.estado_nombre },
  fecha_jornada: n.fecha_jornada,
  minutos: n.minutos,
  minutos_penalizacion: n.minutos_penalizacion,
  id_marcaje: n.id_marcaje,
  turno: {
    nombre: n.nombre_turno,
    inicio_programado: n.inicio_programado,
    fin_programado: n.fin_programado,
    minutos_tolerancia: n.minutos_tolerancia,
  },
});

// Contrasta las jornadas de ayer, hoy y mañana (turno que empieza a medianoche) del empleado que acaba de marcar
// y devuelve las novedades de sus marcajes.
async function alMarcar(idEmpleado, idsMarcajes) {
  const { ahora, hoy } = await modelo.momentoActual();
  await contrastar({ desde: sumarDias(hoy, -1), hasta: sumarDias(hoy, 1), ids: [idEmpleado], ahora });
  return (await modelo.listarPorMarcajes(idsMarcajes)).map(resumirNovedad);
}

function leerFiltrosPanel({ id_sucursal, id_departamento, fecha } = {}, hoy) {
  const errores = [];
  if (!id_sucursal) errores.push({ campo: "id_sucursal", mensaje: "Seleccione la sucursal." });
  else if (!UUID_RE.test(id_sucursal)) errores.push({ campo: "id_sucursal", mensaje: "Sucursal inválida." });
  if (id_departamento && !UUID_RE.test(id_departamento)) {
    errores.push({ campo: "id_departamento", mensaje: "Área inválida." });
  }
  const dia = fecha || hoy;
  if (!esFechaValida(dia)) errores.push({ campo: "fecha", mensaje: "Use el formato AAAA-MM-DD." });
  else if (dia > hoy) errores.push({ campo: "fecha", mensaje: "No se puede consultar un día que todavía no llega." });
  if (errores.length > 0) throw new ErrorApp(400, "Filtros inválidos", errores);
  return { idSucursal: id_sucursal.toLowerCase(), idDepartamento: id_departamento?.toLowerCase() || null, dia };
}

const SIN_TURNO = { horario: null, entrada: null, salida: null, novedades: [] };

const resumirMarcaje = (marcaje) =>
  marcaje ? { id_marcaje: marcaje.id_marcaje, fecha_hora_marcaje: marcaje.fecha_hora_marcaje } : null;

function armarFila(empleado, { turno = null, resultado = SIN_TURNO } = {}, ahoraMs, atrasoMes) {
  const minutosDe = (tipo) => resultado.novedades.find((n) => n.tipo === tipo)?.minutos ?? null;
  return {
    id_empleado: empleado.id_empleado,
    nombre_completo: empleado.nombre_completo,
    cargo: empleado.cargo ?? null,
    area: empleado.area ?? null,
    descanso: Boolean(turno?.descanso),
    turno:
      turno && !turno.descanso
        ? {
            nombre: turno.nombre_turno,
            hora_inicio: turno.hora_inicio.slice(0, 5),
            hora_fin: turno.hora_fin.slice(0, 5),
            minutos_tolerancia: turno.minutos_tolerancia,
            inicio_programado: new Date(resultado.horario.inicioMs).toISOString(),
            limite_puntualidad: new Date(resultado.horario.limiteMs).toISOString(),
            fin_programado: new Date(resultado.horario.finMs).toISOString(),
            origen: turno.id_rol ? "ROL" : "FIJO",
          }
        : null,
    entrada: resumirMarcaje(resultado.entrada),
    salida: resumirMarcaje(resultado.salida),
    estado: estadoJornada(turno, resultado, ahoraMs),
    minutos_atraso: minutosDe("ATRASO"),
    minutos_inasistencia: minutosDe("INASISTENCIA"),
    minutos_salida_anticipada: minutosDe("SALIDA_ANTICIPADA"),
    omision_salida: resultado.novedades.some((n) => n.tipo === "OMISION_SALIDA"),
    minutos_penalizacion: resultado.novedades.reduce((total, n) => total + n.minutos_penalizacion, 0),
    atraso_del_mes: { minutos: atrasoMes?.minutos ?? 0, cantidad: atrasoMes?.cantidad ?? 0 },
  };
}

function resumirPanel(filas) {
  const contar = (condicion) => filas.filter(condicion).length;
  const conEstado = (codigo) => contar((f) => f.estado.codigo === codigo);
  return {
    colaboradores: filas.length,
    con_turno: contar((f) => f.turno !== null),
    puntuales: conEstado("PUNTUAL"),
    atrasos: conEstado("ATRASO"),
    por_llegar: conEstado("POR_LLEGAR"),
    sin_marcar: conEstado("SIN_MARCAR"),
    inasistencias: conEstado("INASISTENCIA"),
    salidas_anticipadas: contar((f) => f.minutos_salida_anticipada !== null),
    omisiones_salida: contar((f) => f.omision_salida),
    descansos: conEstado("DESCANSO"),
    sin_turno: conEstado("SIN_TURNO"),
  };
}

// Estado de la jornada de cada colaborador activo de una sucursal (y área) en un día.
async function panel(filtros) {
  const { ahora, hoy } = await modelo.momentoActual();
  const { idSucursal, idDepartamento, dia } = leerFiltrosPanel(filtros, hoy);
  const personal = (await empleados.listarPorArea(idSucursal, idDepartamento)).filter((e) => e.activo);
  const ids = personal.map((e) => e.id_empleado);

  const { resultados } =
    ids.length > 0
      ? await contrastar({ desde: dia, hasta: dia, ids, activos: new Set(ids), ahora })
      : { resultados: new Map() };
  const atrasos = new Map((await modelo.sumarAtrasosDelMes(ids, dia)).map((fila) => [fila.id_empleado, fila]));

  const filas = personal
    .map((e) => armarFila(e, resultados.get(`${e.id_empleado}|${dia}`), ahora.getTime(), atrasos.get(e.id_empleado)))
    .sort(
      (a, b) =>
        ORDEN_ESTADO.indexOf(a.estado.codigo) - ORDEN_ESTADO.indexOf(b.estado.codigo) ||
        a.nombre_completo.localeCompare(b.nombre_completo, "es")
    );

  return { fecha: dia, es_hoy: dia === hoy, generado_en: ahora, resumen: resumirPanel(filas), colaboradores: filas };
}

module.exports = { contrastar, consolidar, ejecutarContraste, iniciarContraste, alMarcar, panel };
