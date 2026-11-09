const modelo = require("../models/bonificaciones.model");
const externos = require("./externos.service");
const { ErrorApp } = require("../utils/errores");
const {
  validarIdEmpleado,
  validarFiltros,
  validarTipoBono,
  validarAuditor,
  filasDeAuditoria,
  aCsv,
} = require("../utils/bonificaciones");

// RF-53, criterio 2: se llama dentro de la misma transacción que reemplaza los bonos del periodo (ver
// condiciones.service.procesar). Sin cambios reales no se escribe nada (un reproceso sin novedades es el
// caso más común, no se debe llenar la auditoría de ruido).
async function registrarCambios(cliente, { anteriores, nuevos, periodo, identidad }) {
  const filas = filasDeAuditoria({ anteriores, nuevos, periodo, identidad });
  if (filas.length > 0) await modelo.registrarCambios(cliente, filas);
  return filas.length;
}

async function sucursalDe(idEmpleado) {
  const personal = await externos.listarPersonal();
  const empleado = personal.find((e) => String(e.id_empleado).toLowerCase() === idEmpleado);
  return empleado?.sucursal?.nombre ?? empleado?.sucursal ?? null;
}

const formatearBono = (b) => ({
  id_bono: b.id_bono,
  tipo_bono: "CONDICION",
  periodo: b.periodo,
  condicion: { id_condicion: b.id_condicion, codigo: b.codigo, nombre: b.nombre, tipo_condicion: b.tipo_condicion },
  origen: b.origen,
  cantidad: b.cantidad,
  fechas: b.fechas,
  factor: b.factor,
  valor: b.valor,
  monto: b.monto,
  asignacion: b.id_asignacion ? { id_asignacion: b.id_asignacion, area: b.asignacion_area } : null,
  cuenta_contable: b.cuenta_contable_codigo ? { codigo: b.cuenta_contable_codigo, nombre: b.cuenta_contable_nombre } : null,
});

const COLUMNAS_CSV_HISTORIAL = [
  { titulo: "Periodo", valor: (b) => b.periodo },
  { titulo: "Tipo de bono", valor: (b) => b.tipo_bono },
  { titulo: "Condición", valor: (b) => `${b.condicion.codigo} - ${b.condicion.nombre}` },
  { titulo: "Monto", valor: (b) => b.monto ?? "" },
  { titulo: "Valor", valor: (b) => b.valor },
  { titulo: "Forma de cálculo", valor: (b) => (b.monto === null ? "PORCENTAJE" : "MONTO_FIJO") },
];

// RF-53, criterio 1: cada bono con tipo, periodo, monto y la condición (regla) que lo originó.
// RF-53, criterio 3: filtros por tipo, periodo y sucursal, con exportación.
async function historial({ periodo, tipo, sucursal, formato } = {}, idEmpleadoParam, identidad = {}) {
  validarAuditor(identidad);
  const idEmpleado = validarIdEmpleado(idEmpleadoParam);
  const filtros = validarFiltros({ periodo, tipo });

  if (sucursal) {
    const sucursalColaborador = await sucursalDe(idEmpleado);
    if (sucursalColaborador !== sucursal) {
      return formato === "csv" ? { nombre: `bonificaciones-${idEmpleado}.csv`, contenido: aCsv(COLUMNAS_CSV_HISTORIAL, []) } : [];
    }
  }

  const filas = (
    await modelo.historialPorEmpleado(idEmpleado, { periodo: filtros.periodo, tipoCondicion: filtros.tipo })
  ).map(formatearBono);

  if (formato === "csv") return { nombre: `bonificaciones-${idEmpleado}.csv`, contenido: aCsv(COLUMNAS_CSV_HISTORIAL, filas) };
  return filas;
}

const formatearAuditoria = (a) => ({
  id_auditoria: a.id_auditoria,
  tipo_bono: a.tipo_bono,
  periodo: a.periodo,
  empleado: { id_empleado: a.id_empleado, nombre_completo: a.nombre_empleado },
  condicion: { id_condicion: a.id_condicion },
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
  { titulo: "Colaborador", valor: (a) => a.empleado.nombre_completo },
  { titulo: "Acción", valor: (a) => a.accion },
  { titulo: "Valor anterior", valor: (a) => a.valor.anterior ?? "" },
  { titulo: "Valor nuevo", valor: (a) => a.valor.nuevo ?? "" },
  { titulo: "Monto anterior", valor: (a) => a.monto.anterior ?? "" },
  { titulo: "Monto nuevo", valor: (a) => a.monto.nuevo ?? "" },
  { titulo: "Realizado por", valor: (a) => a.realizado_por ?? "" },
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

module.exports = { registrarCambios, historial, auditoria };
