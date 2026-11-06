const modelo = require("../models/condiciones.model");
const conceptos = require("../models/conceptos.model");
const externos = require("./externos.service");
const { traducirErrorBD, formatear: formatearConcepto } = require("./conceptos.service");
const { enTransaccion } = require("../config/transaccion");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const { hoyLaPaz } = require("../utils/fechas");
const {
  DETECTABLES,
  validarCondicion,
  validarEdicionCondicion,
  rangoPeriodo,
  bonosDetectados,
  bonosAsignados,
} = require("../utils/condiciones");

const noEncontrada = () => new ErrorApp(404, "Condición no encontrada");

const formatear = ({ id_condicion, tipo_condicion, minutos_nocturnos_minimos, asignaciones_vigentes, ...concepto }) => ({
  id_condicion,
  tipo_condicion,
  minutos_nocturnos_minimos,
  asignaciones_vigentes,
  ...formatearConcepto(concepto),
});

async function buscar(id) {
  const condicion = UUID_RE.test(id) ? await modelo.obtener(id, hoyLaPaz()) : undefined;
  if (!condicion) throw noEncontrada();
  return condicion;
}

async function listar() {
  return (await modelo.listar(hoyLaPaz())).map(formatear);
}

async function obtener(id) {
  return formatear(await buscar(id));
}

// Crea el concepto de ingreso con su primera vigencia y la condición, en una sola transacción.
async function crear(datos) {
  const { concepto, vigencia, condicion } = validarCondicion(datos);
  const id = await enTransaccion(async (cliente) => {
    const idConcepto = await conceptos.crear(cliente, concepto);
    await conceptos.crearVigencia(cliente, idConcepto, vigencia);
    return modelo.crear(cliente, idConcepto, condicion);
  }).catch(traducirErrorBD);
  return obtener(id);
}

// El valor cambia con una nueva vigencia del concepto (POST /conceptos/:id/vigencias).
async function actualizar(id, datos) {
  const actual = await buscar(id);
  const { concepto, minutos_nocturnos_minimos } = validarEdicionCondicion(datos, actual);
  await enTransaccion(async (cliente) => {
    await conceptos.actualizar(actual.id_concepto, concepto, cliente);
    await modelo.actualizarMinutos(cliente, id, minutos_nocturnos_minimos);
  }).catch(traducirErrorBD);
  return obtener(id);
}

async function eliminar(id) {
  const actual = await buscar(id);
  try {
    await conceptos.eliminar(actual.id_concepto);
  } catch (error) {
    if (error.code !== "23503") throw error;
    throw new ErrorApp(409, "La condición ya tiene bonos procesados: solo se puede inactivar.");
  }
}

const formatearBono = (b) => ({
  id_bono: b.id_bono,
  empleado: { id_empleado: b.id_empleado, nombre_completo: b.nombre_empleado },
  condicion: {
    id_condicion: b.id_condicion,
    codigo: b.codigo,
    nombre: b.nombre,
    tipo_condicion: b.tipo_condicion,
    forma_calculo: b.forma_calculo,
    base_calculo: b.base_calculo,
  },
  origen: b.origen,
  cantidad: b.cantidad,
  fechas: b.fechas,
  asignacion: b.id_asignacion
    ? { id_asignacion: b.id_asignacion, vigente_desde: b.asignacion_desde, vigente_hasta: b.asignacion_hasta, area: b.asignacion_area }
    : null,
  id_vigencia: b.id_vigencia,
  valor: b.valor,
  factor: b.factor,
  monto: b.monto,
  cuenta_contable: b.cuenta_contable_codigo
    ? { codigo: b.cuenta_contable_codigo, nombre: b.cuenta_contable_nombre }
    : null,
});

const sumarMontos = (bonos) => Math.round(bonos.reduce((total, b) => total + (b.monto ?? 0), 0) * 100) / 100;

// Bonos del mes procesado, para planillas.
async function listarBonos({ periodo } = {}) {
  const { desde, hasta } = rangoPeriodo(periodo, hoyLaPaz());
  const proceso = await modelo.obtenerProceso(periodo);
  const bonos = proceso ? (await modelo.listarBonos(proceso.id_proceso)).map(formatearBono) : [];
  return {
    periodo,
    desde,
    hasta,
    proceso: proceso
      ? { id_proceso: proceso.id_proceso, procesado_en: proceso.procesado_en, jornadas_analizadas: proceso.jornadas_analizadas }
      : null,
    bonos,
    totales: {
      bonos: bonos.length,
      colaboradores: new Set(bonos.map((b) => b.empleado.id_empleado)).size,
      monto_fijo: sumarMontos(bonos),
      con_porcentaje: bonos.filter((b) => b.monto === null).length,
    },
  };
}

async function nombresDe(bonos) {
  if (bonos.length === 0) return new Map();
  const personal = await externos.listarPersonal();
  return new Map(personal.map((e) => [e.id_empleado, e.nombre_completo]));
}

// Detecta trasnoches y feriados en las jornadas marcadas del mes y aplica las asignaciones vigentes.
async function procesar({ periodo } = {}) {
  const rango = rangoPeriodo(periodo, hoyLaPaz());
  const condiciones = await modelo.activasConVigencias(rango.desde, rango.hasta);
  const hayDetectables = condiciones.some((c) => DETECTABLES.includes(c.tipo_condicion));
  const hayAsignables = condiciones.some((c) => c.tipo_condicion === "ASIGNACION");
  const [jornadas, asignaciones] = await Promise.all([
    hayDetectables ? externos.listarJornadas(rango.desde, rango.hasta) : [],
    hayAsignables ? modelo.asignacionesEnRango(rango.desde, rango.hasta) : [],
  ]);

  const detectados = bonosDetectados(condiciones, jornadas);
  const nombres = await nombresDe(detectados);
  const bonos = [
    ...detectados.map((b) => ({ ...b, nombre_empleado: nombres.get(b.id_empleado) ?? "Colaborador no registrado" })),
    ...bonosAsignados(condiciones, asignaciones, rango),
  ];
  await enTransaccion(async (cliente) => {
    const idProceso = await modelo.reemplazarProceso(cliente, { periodo, ...rango, jornadas: jornadas.length });
    await modelo.guardarBonos(cliente, idProceso, bonos);
  });
  return listarBonos({ periodo });
}

module.exports = { listar, obtener, crear, actualizar, eliminar, listarBonos, procesar };
