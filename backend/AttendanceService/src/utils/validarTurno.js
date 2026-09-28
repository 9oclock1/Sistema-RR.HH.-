const { ErrorApp } = require("./errores");
const { minutosDuracion } = require("./jornada");

const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d(:00)?$/;

const esMinutos = (valor) => Number.isInteger(valor) && valor >= 0;

function validarTurno(datos = {}) {
  const errores = [];
  const agregar = (campo, mensaje) => errores.push({ campo, mensaje });
  const nombre = typeof datos.nombre === "string" ? datos.nombre.trim() : "";
  const {
    id_tipo_jornada,
    hora_inicio,
    hora_fin,
    minutos_refrigerio = 0,
    minutos_tolerancia = 0,
    esta_activo = true,
  } = datos;

  if (!nombre || nombre.length > 60) agregar("nombre", "Ingrese un nombre de hasta 60 caracteres.");
  if (!Number.isInteger(id_tipo_jornada)) agregar("id_tipo_jornada", "Seleccione un tipo de jornada.");
  if (!HORA_RE.test(hora_inicio)) agregar("hora_inicio", "Ingrese una hora válida.");
  if (!HORA_RE.test(hora_fin)) agregar("hora_fin", "Ingrese una hora válida.");
  if (!esMinutos(minutos_refrigerio)) agregar("minutos_refrigerio", "Ingrese minutos enteros, 0 o más.");
  if (!esMinutos(minutos_tolerancia)) agregar("minutos_tolerancia", "Ingrese minutos enteros, 0 o más.");
  if (typeof esta_activo !== "boolean") agregar("esta_activo", "Valor inválido.");

  if (errores.length === 0) {
    const duracion = minutosDuracion({ hora_inicio, hora_fin });
    if (duracion === 0) agregar("hora_fin", "Debe ser distinta de la hora de inicio.");
    else {
      if (minutos_refrigerio >= duracion) agregar("minutos_refrigerio", "Debe ser menor a la duración del turno.");
      if (minutos_tolerancia >= duracion) agregar("minutos_tolerancia", "Debe ser menor a la duración del turno.");
    }
  }

  if (errores.length > 0) throw new ErrorApp(400, "Datos de turno inválidos", errores);

  return {
    nombre,
    id_tipo_jornada,
    hora_inicio: hora_inicio.slice(0, 5),
    hora_fin: hora_fin.slice(0, 5),
    minutos_refrigerio,
    minutos_tolerancia,
    esta_activo,
  };
}

module.exports = { validarTurno };
