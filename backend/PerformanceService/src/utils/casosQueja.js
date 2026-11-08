const { ErrorApp } = require("./errores");
const { UUID_RE } = require("./formatos");

const ESTADO_NOTIFICACION = { PENDIENTE: 1, ENTREGADO: 2, FALLIDO: 3 };
const CODIGO_NOTIFICACION = { 1: "PENDIENTE", 2: "ENTREGADO", 3: "FALLIDO" };
const CONFLICTO_INTERES = "CONFLICTO_INTERES";
const PRIORIDADES_URGENTES = ["ALTA", "CRITICA"];
const SIN_PRIORIDAD = "sin";
const PAGINA = { LIMITE: 20, LIMITE_MAXIMO: 50 };
const COMENTARIO_MAX = 500;

const vacio = (valor) => valor === undefined || valor === null || valor === "";

function entero(valor) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

const esUuid = (valor) => typeof valor === "string" && UUID_RE.test(valor.trim());
const normalizarUuid = (valor) => (esUuid(valor) ? valor.trim().toLowerCase() : null);

const nombreCompleto = (nombres, apellidos) => [nombres, apellidos].filter(Boolean).join(" ") || null;

function validarCatalogo(errores, campo, valor, ids, mensaje) {
  const id = entero(valor);
  if (!ids.has(id)) errores.push({ campo, mensaje });
  return id;
}

function validarClasificacion(cuerpo, { categorias, prioridades }) {
  const errores = [];
  const idCategoria = validarCatalogo(
    errores,
    "id_categoria_queja",
    cuerpo.id_categoria_queja,
    categorias,
    "Seleccione una categoría válida.",
  );
  const idPrioridad = validarCatalogo(
    errores,
    "id_prioridad_queja",
    cuerpo.id_prioridad_queja,
    prioridades,
    "Seleccione la prioridad del caso.",
  );
  if (errores.length) throw new ErrorApp(400, "Revise la clasificación de la queja.", errores);
  return { idCategoria, idPrioridad };
}

function validarDerivacion(cuerpo, { categorias, prioridades }) {
  const errores = [];
  const idResponsable = normalizarUuid(cuerpo.id_empleado_responsable);
  if (!idResponsable) {
    errores.push({ campo: "id_empleado_responsable", mensaje: "Seleccione el responsable del caso." });
  }

  const comentario = typeof cuerpo.comentario === "string" ? cuerpo.comentario.trim() : "";
  if (!vacio(cuerpo.comentario) && typeof cuerpo.comentario !== "string") {
    errores.push({ campo: "comentario", mensaje: "El comentario debe ser texto." });
  } else if (comentario.length > COMENTARIO_MAX) {
    errores.push({ campo: "comentario", mensaje: `El comentario puede tener hasta ${COMENTARIO_MAX} caracteres.` });
  }

  const idCategoria = vacio(cuerpo.id_categoria_queja)
    ? null
    : validarCatalogo(errores, "id_categoria_queja", cuerpo.id_categoria_queja, categorias, "Seleccione una categoría válida.");
  const idPrioridad = vacio(cuerpo.id_prioridad_queja)
    ? null
    : validarCatalogo(errores, "id_prioridad_queja", cuerpo.id_prioridad_queja, prioridades, "Seleccione una prioridad válida.");

  if (errores.length) throw new ErrorApp(400, "Revise los datos de la derivación.", errores);
  return { idResponsable, comentario: comentario || null, idCategoria, idPrioridad };
}

function leerFiltros(consulta = {}) {
  const errores = [];
  const leer = (campo, valor) => {
    if (vacio(valor)) return null;
    const id = entero(valor);
    if (!id) errores.push({ campo, mensaje: "Filtro inválido." });
    return id;
  };

  const sinPrioridad = consulta.prioridad === SIN_PRIORIDAD;
  const filtros = {
    idEstado: leer("estado", consulta.estado),
    idCategoria: leer("categoria", consulta.categoria),
    idPrioridad: sinPrioridad ? null : leer("prioridad", consulta.prioridad),
    sinPrioridad,
    pagina: vacio(consulta.pagina) ? 1 : leer("pagina", consulta.pagina),
    limite: vacio(consulta.limite) ? PAGINA.LIMITE : leer("limite", consulta.limite),
  };
  if (errores.length) throw new ErrorApp(400, "Revise los filtros de la bandeja.", errores);
  filtros.limite = Math.min(filtros.limite, PAGINA.LIMITE_MAXIMO);
  return filtros;
}

const formatoFecha = () =>
  new Intl.DateTimeFormat("es-BO", {
    timeZone: process.env.QUEJAS_ZONA_HORARIA || "America/La_Paz",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

function armarAviso({ codigoSeguimiento, categoria, prioridadCodigo, prioridadNombre, derivadaEn }) {
  return {
    asunto: `Queja ${codigoSeguimiento} derivada para su atención`,
    contenido: [
      "Recursos Humanos le derivó una queja interna para que la atienda.",
      "",
      `Código: ${codigoSeguimiento}`,
      `Categoría: ${categoria}`,
      `Prioridad: ${prioridadNombre}`,
      `Fecha de derivación: ${formatoFecha().format(new Date(derivadaEn))}`,
      "",
      "El detalle del caso está en «Mis casos de quejas» del portal; por confidencialidad no va en este aviso.",
    ].join("\n"),
    prioridad: PRIORIDADES_URGENTES.includes(prioridadCodigo) ? "ALTA" : "NORMAL",
  };
}

module.exports = {
  ESTADO_NOTIFICACION,
  CODIGO_NOTIFICACION,
  CONFLICTO_INTERES,
  SIN_PRIORIDAD,
  PAGINA,
  COMENTARIO_MAX,
  normalizarUuid,
  nombreCompleto,
  validarClasificacion,
  validarDerivacion,
  leerFiltros,
  armarAviso,
};
