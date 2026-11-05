const { ErrorApp } = require("./errores");
const { UUID_RE } = require("./formatos");

const ESTADO_EVALUACION = { PENDIENTE: 1, BORRADOR: 2, ENVIADA: 3, VENCIDA: 4 };
const ESTADO_CICLO = { PROGRAMADO: 1, ACTIVO: 2, CERRADO: 3 };

const CODIGO_ESTADO_EVALUACION = Object.fromEntries(
  Object.entries(ESTADO_EVALUACION).map(([codigo, id]) => [id, codigo]),
);

const MAX_RESPUESTAS_POR_SOLICITUD = 300;

function validarFiltros({ id_ciclo: idCiclo, estado } = {}) {
  const errores = [];
  let ciclo = null;
  let estados = null;

  if (idCiclo !== undefined && idCiclo !== "") {
    if (typeof idCiclo === "string" && UUID_RE.test(idCiclo))
      ciclo = idCiclo.toLowerCase();
    else
      errores.push({
        campo: "id_ciclo",
        mensaje: "El ciclo debe ser un identificador válido.",
      });
  }

  if (estado !== undefined && estado !== "") {
    const codigos =
      typeof estado === "string"
        ? estado.split(",").map((c) => c.trim().toUpperCase())
        : [];
    const invalidos = codigos.filter(
      (codigo) => !Object.hasOwn(ESTADO_EVALUACION, codigo),
    );
    if (codigos.length === 0 || invalidos.length > 0) {
      errores.push({
        campo: "estado",
        mensaje: `El estado debe ser uno o varios de: ${Object.keys(ESTADO_EVALUACION).join(", ")}.`,
      });
    } else {
      estados = [
        ...new Set(codigos.map((codigo) => ESTADO_EVALUACION[codigo])),
      ];
    }
  }

  if (errores.length > 0) throw new ErrorApp(400, "Filtros inválidos", errores);
  return { idCiclo: ciclo, estados };
}

function validarRespuestas(cuerpo) {
  const lista = cuerpo?.respuestas;
  if (!Array.isArray(lista) || lista.length === 0) {
    throw new ErrorApp(400, "Datos inválidos", [
      { campo: "respuestas", mensaje: "Envíe al menos una respuesta." },
    ]);
  }
  if (lista.length > MAX_RESPUESTAS_POR_SOLICITUD) {
    throw new ErrorApp(400, "Datos inválidos", [
      {
        campo: "respuestas",
        mensaje: `Puede guardar hasta ${MAX_RESPUESTAS_POR_SOLICITUD} respuestas por solicitud.`,
      },
    ]);
  }

  const errores = [];
  const vistas = new Set();
  const respuestas = [];

  lista.forEach((item, posicion) => {
    const campo = `respuestas[${posicion}]`;
    const idPregunta =
      typeof item?.id_pregunta === "string"
        ? item.id_pregunta.toLowerCase()
        : null;
    const idNivel =
      item?.id_nivel === null
        ? null
        : typeof item?.id_nivel === "string"
          ? item.id_nivel.toLowerCase()
          : undefined;

    if (!idPregunta || !UUID_RE.test(idPregunta)) {
      errores.push({
        campo: `${campo}.id_pregunta`,
        mensaje: "La pregunta debe ser un identificador válido.",
      });
      return;
    }
    if (idNivel !== null && (idNivel === undefined || !UUID_RE.test(idNivel))) {
      errores.push({
        campo: `${campo}.id_nivel`,
        mensaje:
          "El nivel debe ser un identificador válido o null para borrar la respuesta.",
      });
      return;
    }
    if (vistas.has(idPregunta)) {
      errores.push({
        campo: `${campo}.id_pregunta`,
        mensaje: "La pregunta está repetida en la solicitud.",
      });
      return;
    }
    vistas.add(idPregunta);
    respuestas.push({ idPregunta, idNivel, posicion });
  });

  if (errores.length > 0) throw new ErrorApp(400, "Datos inválidos", errores);
  return respuestas;
}

// Una evaluación abierta sigue el estado guardado, salvo que su plazo haya pasado o su ciclo esté cerrado: entonces ya es vencida aunque nadie la haya marcado todavía.
function estadoEfectivo({
  id_estado_evaluacion: estado,
  fecha_limite: fechaLimite,
  hoy,
  id_estado_ciclo: estadoCiclo,
}) {
  const abierta =
    estado === ESTADO_EVALUACION.PENDIENTE ||
    estado === ESTADO_EVALUACION.BORRADOR;
  if (abierta && (fechaLimite < hoy || estadoCiclo === ESTADO_CICLO.CERRADO))
    return ESTADO_EVALUACION.VENCIDA;
  return estado;
}

const nombreCompleto = ({ nombres, apellidos }) =>
  `${nombres} ${apellidos}`.trim();

module.exports = {
  ESTADO_EVALUACION,
  ESTADO_CICLO,
  CODIGO_ESTADO_EVALUACION,
  validarFiltros,
  validarRespuestas,
  estadoEfectivo,
  nombreCompleto,
};
