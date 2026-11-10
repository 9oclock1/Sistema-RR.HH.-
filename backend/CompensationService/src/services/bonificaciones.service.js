const modelo = require("../models/bonificaciones.model");
const externos = require("./externos.service");
const { ErrorApp } = require("../utils/errores");
const {
  validarIdEmpleado,
  validarFiltros,
  validarTipoBono,
  validarFuenteHistorial,
  validarAuditor,
  filasDeAuditoria,
  aCsv,
} = require("../utils/bonificaciones");

// RF-53, criterio 2: se llama dentro de la misma transacción que reemplaza los bonos del periodo (ver
// condiciones.service.procesar y ventasProductividad.service.aplicarReglas). Sin cambios reales no se escribe
// nada (un reproceso sin novedades es el caso más común, no se debe llenar la auditoría de ruido).
async function registrarCambios(cliente, { anteriores, nuevos, periodo, identidad, tipoBono }) {
  const filas = filasDeAuditoria({ anteriores, nuevos, periodo, identidad, tipoBono });
  if (filas.length > 0) await modelo.registrarCambios(cliente, filas);
  return filas.length;
}

function sucursalDeEmpleado(empleado) {
  return empleado?.sucursal?.nombre ?? empleado?.sucursal ?? null;
}

async function sucursalDe(idEmpleado) {
  const personal = await externos.listarPersonal();
  return sucursalDeEmpleado(personal.find((e) => String(e.id_empleado).toLowerCase() === idEmpleado));
}

// Colaboradores de una sucursal (RF-53, criterio 3): "ver los bonos de todos los de una sucursal", no solo
// de uno. Sin EmployeeService expuesto por id de sucursal en este servicio, se filtra sobre el padrón que ya
// usa sucursalDe.
async function idsEnSucursal(sucursal) {
  const personal = await externos.listarPersonal();
  return personal.filter((e) => sucursalDeEmpleado(e) === sucursal).map((e) => String(e.id_empleado).toLowerCase());
}

const formatearCondicion = (b) => ({
  id_bono: `cond-${b.id_bono}`,
  tipo_bono: "CONDICION",
  periodo: b.periodo,
  empleado: { id_empleado: b.id_empleado, nombre_completo: b.nombre_empleado },
  condicion: { id_condicion: b.id_condicion, codigo: b.codigo, nombre: b.nombre, tipo_condicion: b.tipo_condicion },
  regla: null,
  porcentaje_cumplimiento: null,
  origen: b.origen,
  cantidad: b.cantidad,
  fechas: b.fechas,
  factor: b.factor,
  valor: b.valor,
  monto: b.monto,
  asignacion: b.id_asignacion ? { id_asignacion: b.id_asignacion, area: b.asignacion_area } : null,
  cuenta_contable: b.cuenta_contable_codigo ? { codigo: b.cuenta_contable_codigo, nombre: b.cuenta_contable_nombre } : null,
});

// bonos_productividad no guarda el nombre del colaborador (a diferencia de bonos_condicion): se resuelve
// aparte contra el padrón de EmployeeService, igual que hace ventasProductividad.service.
const formatearProductividad = (nombres) => (b) => ({
  id_bono: `prod-${b.id_bono}`,
  tipo_bono: "PRODUCTIVIDAD",
  periodo: b.periodo,
  empleado: { id_empleado: b.id_empleado, nombre_completo: nombres.get(String(b.id_empleado).toLowerCase()) ?? "Colaborador no registrado" },
  condicion: null,
  regla: { id_regla: b.id_regla, tipo_meta: b.tipo_meta, umbral_cumplimiento: b.umbral_cumplimiento, forma_calculo: b.forma_calculo },
  porcentaje_cumplimiento: b.porcentaje_cumplimiento,
  origen: "PRODUCTIVIDAD",
  cantidad: null,
  fechas: null,
  factor: null,
  valor: b.valor,
  monto: b.monto,
  asignacion: null,
  cuenta_contable: null,
});

// Renglón de CALCULOS_PLANILLA, no un bono propio: valor es el porcentaje de la escala y resultado el monto
// que efectivamente pagó la planilla (ya puede traer redondeos de renglón que el bono crudo no tiene).
const formatearAntiguedad = (c) => ({
  id_bono: `ant-${c.id_calculo}`,
  tipo_bono: "ANTIGUEDAD",
  periodo: c.periodo,
  empleado: { id_empleado: c.id_empleado, nombre_completo: c.nombre_empleado },
  condicion: null,
  regla: null,
  porcentaje_cumplimiento: null,
  origen: "ANTIGUEDAD",
  cantidad: c.cantidad,
  fechas: null,
  factor: null,
  valor: c.valor,
  monto: c.resultado,
  detalle: c.detalle,
  asignacion: null,
  cuenta_contable: null,
});

// Las tres fuentes del historial de un colaborador (RF-53, criterio 1): condición (KAN-72), productividad
// (KAN-71) y antigüedad (KAN-70, de solo lectura). `fuente` acota a una sola cuando se filtra por tipo_bono.
async function historialDeFuentes(ids, { periodo, tipoCondicion, fuente }) {
  const [condicion, productividad, antiguedad] = await Promise.all([
    !fuente || fuente === "CONDICION" ? modelo.historialPorEmpleados(ids, { periodo, tipoCondicion }) : [],
    !fuente || fuente === "PRODUCTIVIDAD" ? modelo.historialProductividadPorEmpleados(ids, { periodo }) : [],
    !fuente || fuente === "ANTIGUEDAD" ? modelo.historialAntiguedadPorEmpleados(ids, { periodo }) : [],
  ]);
  const nombres =
    productividad.length > 0
      ? new Map((await externos.listarPersonal()).map((e) => [String(e.id_empleado).toLowerCase(), e.nombre_completo]))
      : new Map();
  const filas = [
    ...condicion.map(formatearCondicion),
    ...productividad.map(formatearProductividad(nombres)),
    ...antiguedad.map(formatearAntiguedad),
  ];
  filas.sort((a, b) => (a.periodo < b.periodo ? 1 : a.periodo > b.periodo ? -1 : 0));
  return filas;
}

const describirOrigen = (b) => {
  if (b.condicion) return `${b.condicion.codigo} - ${b.condicion.nombre}`;
  if (b.regla) return `Regla de productividad (${b.regla.tipo_meta})`;
  return "Bono de antigüedad";
};

const COLUMNAS_CSV_HISTORIAL = [
  { titulo: "Periodo", valor: (b) => b.periodo },
  { titulo: "Colaborador", valor: (b) => b.empleado.nombre_completo ?? "" },
  { titulo: "Tipo de bono", valor: (b) => b.tipo_bono },
  { titulo: "Regla / condición", valor: describirOrigen },
  { titulo: "% de cumplimiento", valor: (b) => b.porcentaje_cumplimiento ?? "" },
  { titulo: "Monto", valor: (b) => b.monto ?? "" },
  { titulo: "Valor", valor: (b) => b.valor },
  { titulo: "Forma de cálculo", valor: (b) => (b.monto === null ? "PORCENTAJE" : "MONTO_FIJO") },
];

const sinFiltroDeSucursal = async (idEmpleado, sucursal) => {
  if (!sucursal) return true;
  return (await sucursalDe(idEmpleado)) === sucursal;
};

// RF-53, criterio 1: cada bono con tipo, periodo, monto y la condición o regla que lo originó, o el renglón
// de antigüedad ya calculado. RF-53, criterio 3: filtros por tipo, periodo, tipo de bono y sucursal, con
// exportación.
async function historial({ periodo, tipo, tipo_bono, sucursal, formato } = {}, idEmpleadoParam, identidad = {}) {
  validarAuditor(identidad);
  const idEmpleado = validarIdEmpleado(idEmpleadoParam);
  const filtros = validarFiltros({ periodo, tipo });
  const fuente = validarFuenteHistorial(tipo_bono);

  if (!(await sinFiltroDeSucursal(idEmpleado, sucursal))) {
    return formato === "csv" ? { nombre: `bonificaciones-${idEmpleado}.csv`, contenido: aCsv(COLUMNAS_CSV_HISTORIAL, []) } : [];
  }

  const filas = await historialDeFuentes([idEmpleado], { periodo: filtros.periodo, tipoCondicion: filtros.tipo, fuente });

  if (formato === "csv") return { nombre: `bonificaciones-${idEmpleado}.csv`, contenido: aCsv(COLUMNAS_CSV_HISTORIAL, filas) };
  return filas;
}

// RF-53, criterio 3: todos los colaboradores de una sucursal, no solo uno. Mismo RBAC y mismas fuentes que
// el historial por colaborador.
async function historialPorSucursal({ sucursal, periodo, tipo, tipo_bono, formato } = {}, identidad = {}) {
  validarAuditor(identidad);
  if (!sucursal) {
    throw new ErrorApp(400, "Filtros inválidos", [{ campo: "sucursal", mensaje: "Indique la sucursal a consultar." }]);
  }
  const filtros = validarFiltros({ periodo, tipo });
  const fuente = validarFuenteHistorial(tipo_bono);

  const nombreArchivo = `bonificaciones-${sucursal.replace(/\s+/g, "-").toLowerCase()}.csv`;
  const ids = await idsEnSucursal(sucursal);
  if (ids.length === 0) {
    return formato === "csv" ? { nombre: nombreArchivo, contenido: aCsv(COLUMNAS_CSV_HISTORIAL, []) } : [];
  }

  const filas = await historialDeFuentes(ids, { periodo: filtros.periodo, tipoCondicion: filtros.tipo, fuente });

  if (formato === "csv") return { nombre: nombreArchivo, contenido: aCsv(COLUMNAS_CSV_HISTORIAL, filas) };
  return filas;
}

const formatearAuditoria = (a) => ({
  id_auditoria: a.id_auditoria,
  tipo_bono: a.tipo_bono,
  periodo: a.periodo,
  empleado: { id_empleado: a.id_empleado, nombre_completo: a.nombre_empleado },
  condicion: a.tipo_bono === "CONDICION" ? { id_condicion: a.id_condicion } : null,
  regla: a.tipo_bono === "PRODUCTIVIDAD" ? { id_regla: a.id_regla } : null,
  accion: a.accion,
  valor: { anterior: a.valor_anterior, nuevo: a.valor_nuevo },
  monto: { anterior: a.monto_anterior, nuevo: a.monto_nuevo },
  factor: { anterior: a.factor_anterior, nuevo: a.factor_nuevo },
  realizado_por: a.realizado_por,
  realizado_por_rol: a.realizado_por_rol,
  realizado_en: a.realizado_en,
});

const COLUMNAS_CSV_AUDITORIA = [
  { titulo: "Fecha", valor: (a) => new Date(a.realizado_en).toISOString() },
  { titulo: "Periodo", valor: (a) => a.periodo },
  { titulo: "Tipo de bono", valor: (a) => a.tipo_bono },
  { titulo: "Colaborador", valor: (a) => a.empleado.nombre_completo },
  { titulo: "Acción", valor: (a) => a.accion },
  { titulo: "Valor anterior", valor: (a) => a.valor.anterior ?? "" },
  { titulo: "Valor nuevo", valor: (a) => a.valor.nuevo ?? "" },
  { titulo: "Monto anterior", valor: (a) => a.monto.anterior ?? "" },
  { titulo: "Monto nuevo", valor: (a) => a.monto.nuevo ?? "" },
  { titulo: "Realizado por", valor: (a) => a.realizado_por ?? "" },
  { titulo: "Rol", valor: (a) => a.realizado_por_rol ?? "" },
];

// Para el Auditor (RF-53): quién cambió qué y cuándo, sin tener que elegir un colaborador primero.
async function auditoria({ id_empleado, periodo, tipo_bono, formato } = {}, identidad = {}) {
  validarAuditor(identidad);
  if (id_empleado !== undefined) validarIdEmpleado(id_empleado);
  const filtros = validarFiltros({ periodo });
  const tipoBono = validarTipoBono(tipo_bono);
  if (!id_empleado && !filtros.periodo) {
    throw new ErrorApp(400, "Filtros inválidos", [
      { campo: "periodo", mensaje: "Indique un colaborador o un periodo para acotar la consulta." },
    ]);
  }

  const filas = (
    await modelo.listarAuditoria({
      idEmpleado: id_empleado ? id_empleado.toLowerCase() : null,
      periodo: filtros.periodo,
      tipoBono,
    })
  ).map(formatearAuditoria);

  if (formato === "csv") return { nombre: "auditoria-bonos.csv", contenido: aCsv(COLUMNAS_CSV_AUDITORIA, filas) };
  return filas;
}

module.exports = { registrarCambios, historial, historialPorSucursal, auditoria };
