const modelo = require("../models/evaluacionesModel");
const { enTransaccion } = require("../config/transaccion");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const {
  ESTADO_EVALUACION,
  ESTADO_CICLO,
  CODIGO_ESTADO_EVALUACION,
  validarFiltros,
  validarRespuestas,
  estadoEfectivo,
  nombreCompleto,
} = require("../utils/evaluaciones");
const {
  armarFormulario,
  resumirProgreso,
  buscarFaltantes,
  calcularResultado,
} = require("../utils/formulario");

const describirColaborador = ({
  id_empleado_evaluado,
  nombres,
  apellidos,
  sucursal,
  departamento,
}) => ({
  id_empleado: id_empleado_evaluado,
  nombres,
  apellidos,
  nombre_completo: nombreCompleto({ nombres, apellidos }),
  sucursal,
  departamento,
});

async function listarEvaluaciones(idEmpleado, consulta) {
  const { idCiclo, estados } = validarFiltros(consulta);
  const filas = await modelo.listarBandeja({
    idEvaluador: idEmpleado,
    idCiclo,
    estados,
  });
  return filas.map((fila) => ({
    id_evaluacion: fila.id_evaluacion,
    colaborador: describirColaborador({ ...fila, departamento: undefined }),
    ciclo: {
      id_ciclo: fila.id_ciclo,
      nombre: fila.ciclo,
      fecha_limite: fila.fecha_limite,
    },
    estado_codigo: fila.estado_codigo,
    estado_nombre: fila.estado_nombre,
    puntaje_final: fila.puntaje_final,
    enviada_en: fila.enviada_en,
    actualizado_en: fila.actualizado_en,
    progreso: {
      total: fila.total,
      respondidas: fila.respondidas,
      obligatorias_total: fila.obligatorias_total,
      obligatorias_respondidas: fila.obligatorias_respondidas,
    },
  }));
}

function listarCiclos(idEmpleado) {
  return modelo.listarCiclos(idEmpleado);
}

async function leerDelEvaluador(
  idEmpleado,
  idEvaluacion,
  { bloquear = false } = {},
  db,
) {
  const evaluacion = UUID_RE.test(idEvaluacion)
    ? await modelo.obtenerEvaluacion(
        idEvaluacion.toLowerCase(),
        { bloquear },
        db,
      )
    : null;
  if (!evaluacion) throw new ErrorApp(404, "Evaluación no encontrada");
  if (evaluacion.id_empleado_evaluador !== idEmpleado) {
    throw new ErrorApp(403, "Esta evaluación está asignada a otro evaluador.");
  }
  if (evaluacion.id_estado_ciclo === ESTADO_CICLO.PROGRAMADO) {
    throw new ErrorApp(409, "El ciclo de esta evaluación aún no está activo.");
  }
  return evaluacion;
}

const errorVencida = (evaluacion) =>
  evaluacion.id_estado_ciclo === ESTADO_CICLO.CERRADO
    ? new ErrorApp(
        409,
        `El ciclo «${evaluacion.ciclo}» está cerrado: la evaluación ya no se puede responder.`,
      )
    : new ErrorApp(
        409,
        `El plazo de esta evaluación venció el ${evaluacion.fecha_limite}: ya no se puede responder.`,
      );

async function cargarFormulario(evaluacion, db) {
  const filas = await modelo.listarEstructura(
    evaluacion.id_version,
    evaluacion.id_evaluacion,
    db,
  );
  const niveles = await modelo.listarNiveles(
    [...new Set(filas.map((fila) => fila.id_escala))],
    db,
  );
  return armarFormulario(filas, niveles);
}

async function obtenerFormulario(idEmpleado, idEvaluacion) {
  const evaluacion = await leerDelEvaluador(idEmpleado, idEvaluacion);
  const formulario = await cargarFormulario(evaluacion);
  const estado = estadoEfectivo(evaluacion);
  const enviada = estado === ESTADO_EVALUACION.ENVIADA;

  return {
    id_evaluacion: evaluacion.id_evaluacion,
    estado_codigo: CODIGO_ESTADO_EVALUACION[estado],
    editable:
      estado === ESTADO_EVALUACION.PENDIENTE ||
      estado === ESTADO_EVALUACION.BORRADOR,
    colaborador: describirColaborador(evaluacion),
    ciclo: {
      id_ciclo: evaluacion.id_ciclo,
      nombre: evaluacion.ciclo,
      fecha_limite: evaluacion.fecha_limite,
    },
    plantilla: {
      nombre: evaluacion.plantilla,
      objetivo: evaluacion.objetivo,
      numero_version: evaluacion.numero_version,
    },
    puntaje_final: evaluacion.puntaje_final,
    enviada_en: evaluacion.enviada_en,
    actualizado_en: evaluacion.actualizado_en,
    progreso: resumirProgreso(formulario),
    escalas: formulario.escalas,
    secciones: formulario.secciones,
    resultado: enviada
      ? {
          ...calcularResultado(formulario),
          puntaje_final: evaluacion.puntaje_final,
        }
      : null,
  };
}

// Toma la evaluación para escribir en ella. Una evaluación enviada no se toca; una vencida se marca como tal (esa marca sí debe quedar guardada) y se avisa con `vencida` para que quien llama responda 409 después de confirmar.
async function prepararEscritura(idEmpleado, idEvaluacion, db) {
  const evaluacion = await leerDelEvaluador(
    idEmpleado,
    idEvaluacion,
    { bloquear: true },
    db,
  );
  const estado = estadoEfectivo(evaluacion);

  if (estado === ESTADO_EVALUACION.ENVIADA) {
    throw new ErrorApp(
      409,
      "La evaluación ya fue enviada y no se puede modificar.",
    );
  }
  if (estado === ESTADO_EVALUACION.VENCIDA) {
    if (evaluacion.id_estado_evaluacion !== ESTADO_EVALUACION.VENCIDA) {
      await modelo.cambiarEstadoAbierta(
        evaluacion.id_evaluacion,
        ESTADO_EVALUACION.VENCIDA,
        db,
      );
    }
    return { ...evaluacion, vencida: true };
  }
  return { ...evaluacion, vencida: false };
}

// Cada pregunta debe ser de la plantilla del ciclo y cada nivel de la escala de su pregunta.
function verificarReferencias(formulario, cambios) {
  const preguntas = new Map(
    formulario.secciones
      .flatMap((s) => s.criterios.flatMap((c) => c.preguntas))
      .map((pregunta) => [pregunta.id_pregunta, pregunta]),
  );
  const nivelesPorEscala = new Map(
    formulario.escalas.map((escala) => [
      escala.id_escala,
      new Set(escala.niveles.map((nivel) => nivel.id_nivel)),
    ]),
  );

  const errores = [];
  for (const { idPregunta, idNivel, posicion } of cambios) {
    const pregunta = preguntas.get(idPregunta);
    if (!pregunta) {
      errores.push({
        campo: `respuestas[${posicion}].id_pregunta`,
        mensaje: "La pregunta no pertenece al formulario de esta evaluación.",
      });
    } else if (
      idNivel !== null &&
      !nivelesPorEscala.get(pregunta.id_escala).has(idNivel)
    ) {
      errores.push({
        campo: `respuestas[${posicion}].id_nivel`,
        mensaje: "El nivel no pertenece a la escala de esta pregunta.",
      });
    }
  }
  if (errores.length > 0) throw new ErrorApp(400, "Datos inválidos", errores);
}

// Se guardan solo las respuestas enviadas y la evaluación queda como borrador. Con id_nivel = null se borra la respuesta; si no queda ninguna, la evaluación vuelve a pendiente.
async function guardarRespuestas(idEmpleado, idEvaluacion, cuerpo) {
  const cambios = validarRespuestas(cuerpo);

  const resultado = await enTransaccion(async (db) => {
    const evaluacion = await prepararEscritura(idEmpleado, idEvaluacion, db);
    if (evaluacion.vencida) return { evaluacion };

    verificarReferencias(await cargarFormulario(evaluacion, db), cambios);
    await modelo.guardarRespuestas(
      evaluacion.id_evaluacion,
      cambios.filter((c) => c.idNivel !== null),
      db,
    );
    await modelo.borrarRespuestas(
      evaluacion.id_evaluacion,
      cambios.filter((c) => c.idNivel === null).map((c) => c.idPregunta),
      db,
    );

    const estado =
      (await modelo.contarRespuestas(evaluacion.id_evaluacion, db)) > 0
        ? ESTADO_EVALUACION.BORRADOR
        : ESTADO_EVALUACION.PENDIENTE;
    const actualizadoEn = await modelo.cambiarEstadoAbierta(
      evaluacion.id_evaluacion,
      estado,
      db,
    );
    return {
      evaluacion,
      estado,
      actualizadoEn,
      progreso: resumirProgreso(await cargarFormulario(evaluacion, db)),
    };
  });

  if (resultado.evaluacion.vencida) throw errorVencida(resultado.evaluacion);
  return {
    id_evaluacion: resultado.evaluacion.id_evaluacion,
    estado_codigo: CODIGO_ESTADO_EVALUACION[resultado.estado],
    actualizado_en: resultado.actualizadoEn,
    progreso: resultado.progreso,
  };
}

// Con todo lo obligatorio respondido se calcula el puntaje ponderado, se congela y la evaluación queda bloqueada. Si falta algo se rechaza con la lista de preguntas pendientes y no cambia nada.
async function enviar(idEmpleado, idEvaluacion) {
  const resultado = await enTransaccion(async (db) => {
    const evaluacion = await prepararEscritura(idEmpleado, idEvaluacion, db);
    if (evaluacion.vencida) return { evaluacion };

    const formulario = await cargarFormulario(evaluacion, db);
    const faltantes = buscarFaltantes(formulario);
    if (faltantes.length > 0) {
      throw new ErrorApp(
        422,
        `Faltan ${faltantes.length} pregunta(s) obligatoria(s) por responder.`,
        faltantes,
      );
    }

    const calculo = calcularResultado(formulario);
    if (calculo.puntaje_final === null) {
      throw new ErrorApp(
        422,
        "Responda al menos una pregunta antes de enviar la evaluación.",
      );
    }
    const enviadaEn = await modelo.marcarEnviada(
      evaluacion.id_evaluacion,
      calculo.puntaje_final,
      db,
    );
    if (!enviadaEn)
      throw new ErrorApp(
        409,
        "La evaluación ya fue enviada y no se puede modificar.",
      );
    return {
      evaluacion,
      calculo,
      enviadaEn,
      progreso: resumirProgreso(formulario),
    };
  });

  if (resultado.evaluacion.vencida) throw errorVencida(resultado.evaluacion);
  return {
    id_evaluacion: resultado.evaluacion.id_evaluacion,
    estado_codigo: CODIGO_ESTADO_EVALUACION[ESTADO_EVALUACION.ENVIADA],
    puntaje_final: resultado.calculo.puntaje_final,
    enviada_en: resultado.enviadaEn,
    progreso: resultado.progreso,
    resultado: resultado.calculo,
  };
}

module.exports = {
  listarEvaluaciones,
  listarCiclos,
  obtenerFormulario,
  guardarRespuestas,
  enviar,
};
