// Historial y auditoría de bonificaciones (RF-53, KAN-73). CONDICION (bonos_condicion, KAN-72) y PRODUCTIVIDAD
// (bonos_productividad, KAN-71) se reemplazan por completo en cada reproceso y se auditan (quién, cuándo, valor
// anterior). ANTIGUEDAD (KAN-70) solo aparece en el historial: no se persiste por colaborador fuera de la
// planilla ya calculada, así que no hay nada que auditar ni diferenciar entre reprocesos.
const { ErrorApp } = require("./errores");
const { UUID_RE } = require("./formatos");
const { TIPOS_CONDICION } = require("./condiciones");

// Fuentes que se auditan (reemplazo completo en cada reproceso, con valor anterior que conservar).
const TIPOS_BONO = ["CONDICION", "PRODUCTIVIDAD"];
// Fuentes que puede mostrar el historial de un colaborador: las auditadas más ANTIGUEDAD, de solo lectura.
const FUENTES_HISTORIAL = [...TIPOS_BONO, "ANTIGUEDAD"];
const ACCIONES = ["ALTA", "MODIFICACION", "ANULACION"];
const PERIODO_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
// Temporal (ver controladores de confirmaciones/planillas): mientras no haya autenticación real, el Auditor
// (RF-53) y el Administrador son los únicos roles que pueden ver el historial y la auditoría de bonos.
const ROLES_AUDITORIA = ["admin", "auditor"];

function validarIdEmpleado(id) {
  if (!UUID_RE.test(id ?? "")) {
    throw new ErrorApp(400, "Colaborador inválido", [{ campo: "id_empleado", mensaje: "Use un id de colaborador válido." }]);
  }
  return id.toLowerCase();
}

// Filtros del historial de un colaborador (RF-53, criterio 3): periodo y tipo de condición (trasnoche,
// feriado o asignación). El tipo de bono (la fuente: hoy solo CONDICION) se valida aparte, para la auditoría.
function validarFiltros({ periodo, tipo } = {}) {
  const errores = [];
  if (periodo !== undefined && !PERIODO_RE.test(periodo)) {
    errores.push({ campo: "periodo", mensaje: "Use el formato AAAA-MM." });
  }
  if (tipo !== undefined && !TIPOS_CONDICION.includes(tipo)) {
    errores.push({ campo: "tipo", mensaje: `Use uno de: ${TIPOS_CONDICION.join(", ")}.` });
  }
  if (errores.length > 0) throw new ErrorApp(400, "Filtros inválidos", errores);
  return { periodo: periodo ?? null, tipo: tipo ?? null };
}

// Para la auditoría (RF-53, criterio 2): solo las fuentes que se reemplazan en cada reproceso y se auditan.
function validarTipoBono(tipo_bono) {
  if (tipo_bono !== undefined && !TIPOS_BONO.includes(tipo_bono)) {
    throw new ErrorApp(400, "Filtros inválidos", [
      { campo: "tipo_bono", mensaje: `Use uno de: ${TIPOS_BONO.join(", ")}.` },
    ]);
  }
  return tipo_bono ?? null;
}

// Para el historial (RF-53, criterio 1): además de las auditadas, admite ANTIGUEDAD (solo lectura, sin auditoría).
function validarFuenteHistorial(tipo_bono) {
  if (tipo_bono !== undefined && !FUENTES_HISTORIAL.includes(tipo_bono)) {
    throw new ErrorApp(400, "Filtros inválidos", [
      { campo: "tipo_bono", mensaje: `Use uno de: ${FUENTES_HISTORIAL.join(", ")}.` },
    ]);
  }
  return tipo_bono ?? null;
}

// RF-53: solo el Administrador de RRHH o el Auditor pueden consultar el historial y la auditoría de bonos.
function validarAuditor({ rol } = {}) {
  const normalizado = (rol ?? "").trim().toLowerCase();
  if (!ROLES_AUDITORIA.includes(normalizado)) {
    throw new ErrorApp(403, "Solo el Administrador de RRHH o el Auditor pueden consultar los bonos.");
  }
}

// Identidad de quien ejecuta el reproceso (RF-53, criterio 2): header temporal igual que en el resto del
// servicio. Puede no venir (p. ej. el despachador automático), en cuyo caso la auditoría queda sin usuario.
function identidadAuditoria({ idEmpleado, rol } = {}) {
  return {
    realizado_por: UUID_RE.test(idEmpleado ?? "") ? idEmpleado.toLowerCase() : null,
    realizado_por_rol: (rol ?? "").trim() || null,
  };
}

// Identifica "el mismo bono" entre dos reprocesos, aunque cada reproceso le asigne un id_bono nuevo (bonos_condicion
// y bonos_productividad se reemplazan por completo, ver reemplazarProceso y aplicarReglas). CONDICION: condición,
// colaborador y asignación (NO la vigencia: una condición con una vigencia nueva sigue siendo el mismo bono, con
// un valor distinto, y debe quedar como MODIFICACION en vez de ANULACION + ALTA). PRODUCTIVIDAD: colaborador y
// regla (no hay condición ni asignación).
const claveBono = (b, tipoBono) =>
  tipoBono === "PRODUCTIVIDAD" ? `${b.id_empleado}|${b.id_regla}` : `${b.id_condicion}|${b.id_empleado}|${b.id_asignacion ?? ""}`;

const igual = (a, b) => a === b || (a === null && b === null) || (a == null && b == null);

// Compara los bonos de un reproceso con los del anterior y devuelve solo las filas de auditoría de lo que
// realmente cambió (RF-53, criterio 2): altas, anulaciones y modificaciones de valor, monto o factor. Un
// reproceso que no cambia nada (el caso más común: se vuelve a generar la planilla del mes) no genera ruido.
function diffBonos(anteriores, nuevos, tipoBono = "CONDICION") {
  const clave = (b) => claveBono(b, tipoBono);
  const porClaveAnterior = new Map(anteriores.map((b) => [clave(b), b]));
  const porClaveNueva = new Map(nuevos.map((b) => [clave(b), b]));
  const filas = [];

  for (const [c, nuevo] of porClaveNueva) {
    const anterior = porClaveAnterior.get(c);
    if (!anterior) {
      filas.push({ bono: nuevo, accion: "ALTA" });
    } else if (
      !igual(anterior.valor, nuevo.valor) ||
      !igual(anterior.monto, nuevo.monto) ||
      !igual(anterior.factor, nuevo.factor)
    ) {
      filas.push({ bono: nuevo, anterior, accion: "MODIFICACION" });
    }
  }
  for (const [c, anterior] of porClaveAnterior) {
    if (!porClaveNueva.has(c)) filas.push({ bono: anterior, accion: "ANULACION" });
  }
  return filas;
}

// Fila lista para insertar en AUDITORIA_BONIFICACIONES.
function filaAuditoria({ bono, anterior, accion }, { periodo, realizado_por, realizado_por_rol, tipoBono }) {
  const actual = accion === "ANULACION" ? null : bono;
  const previo = accion === "ALTA" ? null : (anterior ?? bono);
  const origen =
    tipoBono === "PRODUCTIVIDAD"
      ? { id_condicion: null, id_asignacion: null, id_regla: bono.id_regla }
      : { id_condicion: bono.id_condicion, id_asignacion: bono.id_asignacion ?? null, id_regla: null };
  return {
    tipo_bono: tipoBono,
    ...origen,
    periodo,
    id_empleado: bono.id_empleado,
    nombre_empleado: bono.nombre_empleado,
    accion,
    valor_anterior: previo?.valor ?? null,
    valor_nuevo: actual?.valor ?? null,
    monto_anterior: previo?.monto ?? null,
    monto_nuevo: actual?.monto ?? null,
    factor_anterior: previo?.factor ?? null,
    factor_nuevo: actual?.factor ?? null,
    realizado_por,
    realizado_por_rol,
  };
}

// Filas de auditoría para un reproceso: compara y arma cada fila en un solo paso.
function filasDeAuditoria({ anteriores, nuevos, periodo, identidad, tipoBono = "CONDICION" }) {
  const { realizado_por, realizado_por_rol } = identidadAuditoria(identidad);
  return diffBonos(anteriores, nuevos, tipoBono).map((cambio) =>
    filaAuditoria(cambio, { periodo, realizado_por, realizado_por_rol, tipoBono })
  );
}

// CSV con BOM y separador ";" (Excel en español), igual que los reportes de Asistencia.
function aCsv(columnas, filas) {
  const escapar = (valor) => {
    const texto = valor === null || valor === undefined ? "" : String(valor);
    return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  const encabezado = columnas.map((c) => escapar(c.titulo)).join(";");
  const lineas = filas.map((fila) => columnas.map((c) => escapar(c.valor(fila))).join(";"));
  return `﻿${[encabezado, ...lineas].join("\r\n")}\r\n`;
}

module.exports = {
  TIPOS_BONO,
  FUENTES_HISTORIAL,
  ACCIONES,
  ROLES_AUDITORIA,
  validarIdEmpleado,
  validarFiltros,
  validarTipoBono,
  validarFuenteHistorial,
  validarAuditor,
  claveBono,
  diffBonos,
  filaAuditoria,
  filasDeAuditoria,
  aCsv,
};
