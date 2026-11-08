const pool = require("../config/db");
const modelo = require("../models/condiciones.model");
const conceptos = require("../models/conceptos.model");
const planillas = require("../models/planillas.model");
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
  validarAsignacion,
  validarCambioFin,
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
  const [planilla] = await planillas.listar(periodo);
  if (planilla && planilla.estado !== "BORRADOR") {
    throw new ErrorApp(409, "La planilla del mes ya fue aprobada: sus bonos no se pueden volver a procesar.");
  }
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

const asignacionNoEncontrada = () => new ErrorApp(404, "Asignación no encontrada");
const fechaCorta = (fecha) => fecha.split("-").reverse().join("/");

const formatearAsignacion = (a) => ({
  id_asignacion: a.id_asignacion,
  id_condicion: a.id_condicion,
  empleado: { id_empleado: a.id_empleado, nombre_completo: a.nombre_empleado, area: a.area },
  vigente_desde: a.vigente_desde,
  vigente_hasta: a.vigente_hasta,
  motivo: a.motivo,
  creado_en: a.creado_en,
});

function errorDeCruces(cruces) {
  return new ErrorApp(
    409,
    "Algunos colaboradores ya tienen la condición en esas fechas",
    cruces.map((a) => ({
      campo: "ids_empleado",
      mensaje: `${a.nombre_empleado} ya la tiene desde el ${fechaCorta(a.vigente_desde)}${
        a.vigente_hasta ? ` hasta el ${fechaCorta(a.vigente_hasta)}` : ", sin fecha de fin"
      }.`,
    }))
  );
}

function traducirCruce(error) {
  if (error.code === "23P01") {
    throw new ErrorApp(409, "La asignación se cruza con otra del mismo colaborador", [
      { campo: "vigente_desde", mensaje: "Se cruza con otra asignación del colaborador." },
    ]);
  }
  throw error;
}

async function asignable(id) {
  const condicion = await buscar(id);
  if (condicion.tipo_condicion !== "ASIGNACION") {
    throw new ErrorApp(409, "Esta condición se detecta de las jornadas marcadas: no se asigna por colaborador.");
  }
  return condicion;
}

async function listarAsignaciones(id) {
  await buscar(id);
  return (await modelo.listarAsignaciones(id, hoyLaPaz())).map(formatearAsignacion);
}

// Nombre y área se copian de EmployeeService al asignar.
async function asignar(id, datos) {
  await asignable(id);
  const { ids, vigente_desde, vigente_hasta, motivo } = validarAsignacion(datos);
  const personal = new Map((await externos.listarPersonal()).map((e) => [String(e.id_empleado).toLowerCase(), e]));
  const desconocidos = ids.filter((idEmpleado) => !personal.has(idEmpleado));
  if (desconocidos.length > 0) {
    throw new ErrorApp(400, "Datos de la asignación inválidos", [
      { campo: "ids_empleado", mensaje: `No se encontraron ${desconocidos.length} de los colaboradores seleccionados.` },
    ]);
  }
  const creadas = await enTransaccion(async (cliente) => {
    const cruces = await modelo.asignacionesQueSeCruzan(cliente, id, ids, vigente_desde, vigente_hasta);
    if (cruces.length > 0) throw errorDeCruces(cruces);
    const filas = [];
    for (const idEmpleado of ids) {
      const empleado = personal.get(idEmpleado);
      filas.push(
        await modelo.crearAsignacion(cliente, id, {
          id_empleado: idEmpleado,
          nombre_empleado: empleado.nombre_completo,
          area: empleado.area ?? null,
          vigente_desde,
          vigente_hasta,
          motivo,
        })
      );
    }
    return filas;
  }).catch(traducirCruce);
  return creadas.map(formatearAsignacion);
}

async function buscarAsignacion(id, idAsignacion) {
  await buscar(id);
  const asignacion = UUID_RE.test(idAsignacion) ? await modelo.obtenerAsignacion(id, idAsignacion) : undefined;
  if (!asignacion) throw asignacionNoEncontrada();
  return asignacion;
}

async function cambiarFinAsignacion(id, idAsignacion, datos) {
  const actual = await buscarAsignacion(id, idAsignacion);
  const hasta = validarCambioFin(datos, actual.vigente_desde);
  const cruces = await modelo.asignacionesQueSeCruzan(
    pool,
    id,
    [actual.id_empleado],
    actual.vigente_desde,
    hasta,
    idAsignacion
  );
  if (cruces.length > 0) throw errorDeCruces(cruces);
  const editada = await modelo.cambiarFinAsignacion(idAsignacion, hasta).catch(traducirCruce);
  return formatearAsignacion(editada);
}

async function eliminarAsignacion(id, idAsignacion) {
  await buscarAsignacion(id, idAsignacion);
  await modelo.eliminarAsignacion(idAsignacion);
}

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  eliminar,
  listarBonos,
  procesar,
  listarAsignaciones,
  asignar,
  cambiarFinAsignacion,
  eliminarAsignacion,
};
