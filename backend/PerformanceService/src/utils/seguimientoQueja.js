const { ErrorApp } = require("./errores");
const { ESTADO_QUEJA } = require("./quejas");

const ACCION = { MIN: 10, MAX: 2000 };
const RESOLUCION = { MIN: 10, MAX: 2000 };

const TRANSICIONES = {
  [ESTADO_QUEJA.ASIGNADA]: [ESTADO_QUEJA.EN_ANALISIS],
  [ESTADO_QUEJA.EN_ANALISIS]: [ESTADO_QUEJA.EN_ACCION],
  [ESTADO_QUEJA.EN_ACCION]: [ESTADO_QUEJA.EN_ANALISIS, ESTADO_QUEJA.RESUELTA],
};

const transicionesDesde = (idEstado) => TRANSICIONES[idEstado] ?? [];
const esTransicionValida = (desde, hacia) => transicionesDesde(desde).includes(hacia);
const admiteAcciones = (idEstado) => Object.hasOwn(TRANSICIONES, idEstado);

const texto = (valor) => (typeof valor === "string" ? valor.trim() : "");

function validarTexto(errores, campo, valor, { MIN, MAX }, { vacio, nombre }) {
  if (valor !== undefined && valor !== null && typeof valor !== "string") {
    errores.push({ campo, mensaje: `${nombre} debe ser texto.` });
    return null;
  }
  const limpio = texto(valor);
  if (!limpio) errores.push({ campo, mensaje: vacio });
  else if (limpio.length < MIN) errores.push({ campo, mensaje: `${nombre} debe tener al menos ${MIN} caracteres.` });
  else if (limpio.length > MAX) errores.push({ campo, mensaje: `${nombre} puede tener hasta ${MAX} caracteres.` });
  return limpio;
}

function enteroPositivo(valor) {
  const numero = Number(valor);
  return valor !== "" && valor !== null && Number.isInteger(numero) && numero > 0 ? numero : null;
}

function validarAccion(cuerpo, idsTipo) {
  const errores = [];
  const idTipo = enteroPositivo(cuerpo.id_tipo_accion_queja);
  if (!idsTipo.has(idTipo)) {
    errores.push({ campo: "id_tipo_accion_queja", mensaje: "Indique si la acción es preventiva o correctiva." });
  }
  const descripcion = validarTexto(errores, "descripcion", cuerpo.descripcion, ACCION, {
    vacio: "Describa la acción realizada.",
    nombre: "La descripción",
  });
  if (errores.length) throw new ErrorApp(400, "Revise los datos de la acción.", errores);
  return { idTipo, descripcion };
}

function validarCambioEstado(cuerpo, idsEstado) {
  const idEstado = enteroPositivo(cuerpo.id_estado_queja);
  if (!idsEstado.has(idEstado)) {
    const mensaje = "Seleccione el nuevo estado del caso.";
    throw new ErrorApp(400, mensaje, [{ campo: "id_estado_queja", mensaje }]);
  }
  if (idEstado !== ESTADO_QUEJA.RESUELTA) return { idEstado, resolucion: null };

  const errores = [];
  const resolucion = validarTexto(errores, "resolucion", cuerpo.resolucion, RESOLUCION, {
    vacio: "Describa cómo se resolvió el caso: es obligatorio para marcarlo como resuelto.",
    nombre: "La descripción de la resolución",
  });
  if (errores.length) throw new ErrorApp(400, "Falta la descripción de la resolución.", errores);
  return { idEstado, resolucion };
}

function armarAvisoResolucion({ codigoSeguimiento }) {
  return {
    asunto: `Su queja ${codigoSeguimiento} fue resuelta`,
    contenido: [
      "Recursos Humanos terminó de atender su queja y el caso quedó resuelto.",
      "",
      `Código: ${codigoSeguimiento}`,
      "",
      "Puede ver el estado con este código en «Consultar mi queja».",
    ].join("\n"),
    prioridad: "NORMAL",
  };
}

module.exports = {
  ACCION,
  RESOLUCION,
  transicionesDesde,
  esTransicionValida,
  admiteAcciones,
  validarAccion,
  validarCambioEstado,
  armarAvisoResolucion,
};
