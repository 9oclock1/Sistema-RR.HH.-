const { ErrorApp } = require("./errores");
const { UUID_RE } = require("./formatos");
const { esFecha, hoyLaPaz } = require("./fechas");

const ESTADOS = ["INICIADO", "EN_CURSO", "CERRADO", "ANULADO"];
const ESTADOS_ABIERTOS = ["INICIADO", "EN_CURSO"];
const TIPOS_RESPALDO = ["application/pdf", "image/jpeg", "image/png"];
const MAX_OBSERVACIONES = 500;
const ROL_ADMIN = "admin";

function validarAdmin({ rol } = {}) {
  const normalizado = (rol ?? "").trim().toLowerCase();
  if (normalizado !== ROL_ADMIN) {
    throw new ErrorApp(403, "Solo el Administrador de RRHH puede gestionar las desvinculaciones.");
  }
}

function identidadRegistro({ idEmpleado, rol } = {}) {
  return {
    registrado_por: UUID_RE.test(idEmpleado ?? "") ? idEmpleado.toLowerCase() : null,
    registrado_por_rol: (rol ?? "").trim().toLowerCase() || null,
  };
}

function validarFiltros({ estado, codigo_causal, id_empleado } = {}) {
  const errores = [];
  if (estado !== undefined && estado !== "" && !ESTADOS.includes(estado)) {
    errores.push({ campo: "estado", mensaje: `Use uno de: ${ESTADOS.join(", ")}.` });
  }
  if (codigo_causal !== undefined && codigo_causal !== "" && (typeof codigo_causal !== "string" || codigo_causal.trim().length > 25)) {
    errores.push({ campo: "codigo_causal", mensaje: "Código de causal inválido." });
  }
  if (id_empleado !== undefined && id_empleado !== "" && !UUID_RE.test(id_empleado)) {
    errores.push({ campo: "id_empleado", mensaje: "Use un id de colaborador válido." });
  }
  if (errores.length > 0) throw new ErrorApp(400, "Filtros inválidos", errores);
  return {
    estado: estado || null,
    codigo_causal: codigo_causal ? codigo_causal.trim().toUpperCase() : null,
    id_empleado: id_empleado ? id_empleado.toLowerCase() : null,
  };
}

// Validación pura de los campos recibidos al registrar la baja (AC1).
function validarDatosDesvinculacion(datos = {}, archivo = null) {
  const errores = [];
  const agregar = (campo, mensaje) => errores.push({ campo, mensaje });
  const { id_empleado, codigo_causal, fecha_retiro, observaciones } = datos || {};

  if (typeof id_empleado !== "string" || !UUID_RE.test(id_empleado.trim())) {
    agregar("id_empleado", "Seleccione el colaborador.");
  }
  if (typeof codigo_causal !== "string" || !codigo_causal.trim()) {
    agregar("codigo_causal", "Seleccione la causal de desvinculación.");
  }
  if (!esFecha(fecha_retiro)) {
    agregar("fecha_retiro", "Ingrese una fecha de retiro válida.");
  }

  const obsTexto = typeof observaciones === "string" ? observaciones.trim() : "";
  if (obsTexto.length > MAX_OBSERVACIONES) {
    agregar("observaciones", `Use hasta ${MAX_OBSERVACIONES} caracteres.`);
  }

  if (!archivo || !archivo.buffer || !archivo.mimetype) {
    agregar("documento", "Adjunte el documento de respaldo (PDF, JPG o PNG).");
  }

  if (errores.length > 0) {
    throw new ErrorApp(400, "Datos de desvinculación inválidos", errores);
  }

  return {
    id_empleado: id_empleado.trim().toLowerCase(),
    codigo_causal: codigo_causal.trim().toUpperCase(),
    fecha_retiro,
    observaciones: obsTexto || null,
  };
}

// La fecha de retiro no puede ser anterior al ingreso ni posterior a hoy (la baja se efectiviza en EmployeeService).
function validarFechaRetiro(fechaRetiro, fechaIngreso, hoy = hoyLaPaz()) {
  if (fechaIngreso && fechaRetiro < fechaIngreso) {
    throw new ErrorApp(400, "La fecha de retiro no puede ser anterior a la fecha de ingreso.", [
      { campo: "fecha_retiro", mensaje: `No puede ser anterior a la fecha de ingreso (${fechaIngreso}).` },
    ]);
  }
  if (fechaRetiro > hoy) {
    throw new ErrorApp(400, "La fecha de retiro no puede ser posterior a hoy.", [
      { campo: "fecha_retiro", mensaje: `No puede ser posterior a hoy (${hoy}).` },
    ]);
  }
}

module.exports = {
  ESTADOS,
  ESTADOS_ABIERTOS,
  TIPOS_RESPALDO,
  MAX_OBSERVACIONES,
  validarAdmin,
  identidadRegistro,
  validarFiltros,
  validarDatosDesvinculacion,
  validarFechaRetiro,
};
