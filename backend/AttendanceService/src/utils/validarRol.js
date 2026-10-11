const { ErrorApp } = require("./errores");
const { UUID_RE } = require("./formatos");
const { PERIODO_ROL, esFechaValida } = require("./periodos");

const MAXIMO_CAMBIOS = 5000;

const esUuid = (valor) => typeof valor === "string" && UUID_RE.test(valor);

function validarNuevoRol(datos = {}) {
  const errores = [];
  const agregar = (campo, mensaje) => errores.push({ campo, mensaje });
  const { id_sucursal, id_departamento, periodo, fecha } = datos;

  if (!esUuid(id_sucursal)) agregar("id_sucursal", "Seleccione una sucursal.");
  if (!esUuid(id_departamento)) agregar("id_departamento", "Seleccione un área.");
  if (!Object.hasOwn(PERIODO_ROL, periodo ?? "")) agregar("periodo", "Seleccione un periodo: SEMANAL o MENSUAL.");
  if (!esFechaValida(fecha)) agregar("fecha", "Ingrese una fecha válida (AAAA-MM-DD).");

  if (errores.length > 0) throw new ErrorApp(400, "Datos del rol inválidos", errores);

  return {
    id_sucursal: id_sucursal.toLowerCase(),
    id_departamento: id_departamento.toLowerCase(),
    periodo,
    fecha,
  };
}

// Cada cambio deja la celda con un turno, un descanso o vacía (id_turno null y descanso false).
function validarCambios(cuerpo, { fecha_inicio, fecha_fin }) {
  const lista = cuerpo?.asignaciones;
  if (!Array.isArray(lista) || lista.length === 0) {
    throw new ErrorApp(400, "Datos de asignación inválidos", [
      { campo: "asignaciones", mensaje: "Envíe al menos una asignación." },
    ]);
  }
  if (lista.length > MAXIMO_CAMBIOS) {
    throw new ErrorApp(400, "Datos de asignación inválidos", [
      { campo: "asignaciones", mensaje: `Envíe como máximo ${MAXIMO_CAMBIOS} asignaciones por vez.` },
    ]);
  }

  const errores = [];
  const cambios = new Map();
  lista.forEach((item, indice) => {
    const agregar = (campo, mensaje) => errores.push({ campo: `asignaciones[${indice}].${campo}`, mensaje });
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errores.push({ campo: `asignaciones[${indice}]`, mensaje: "Cada asignación debe ser un objeto." });
      return;
    }
    const { id_empleado, fecha, id_turno = null, descanso = false } = item;
    const previos = errores.length;
    if (!esUuid(id_empleado)) agregar("id_empleado", "Identificador de empleado inválido.");
    if (!esFechaValida(fecha) || fecha < fecha_inicio || fecha > fecha_fin) {
      agregar("fecha", `La fecha debe estar entre ${fecha_inicio} y ${fecha_fin}.`);
    }
    if (id_turno !== null && !esUuid(id_turno)) agregar("id_turno", "Identificador de turno inválido.");
    if (typeof descanso !== "boolean") agregar("descanso", "Valor inválido.");
    else if (descanso && id_turno !== null) agregar("descanso", "Elija un turno o un descanso, no ambos.");
    if (errores.length > previos) return;

    const idEmpleado = id_empleado.toLowerCase();
    // Si la misma celda llega dos veces, vale la última.
    cambios.set(`${idEmpleado}|${fecha}`, {
      id_empleado: idEmpleado,
      fecha,
      id_turno: id_turno?.toLowerCase() ?? null,
      descanso,
    });
  });

  if (errores.length > 0) throw new ErrorApp(400, "Datos de asignación inválidos", errores);
  return [...cambios.values()];
}

module.exports = { validarNuevoRol, validarCambios, MAXIMO_CAMBIOS };
