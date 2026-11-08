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
const {
  validarRetroalimentacion,
  verificarFechasCompromisos,
  describirRetroalimentacion,
} = require("../utils/retroalimentacion");

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

const describirEvaluador = ({ id_empleado_evaluador, evaluador_nombres, evaluador_apellidos }) => ({
  id_empleado: id_empleado_evaluador,
  nombre_completo: nombreCompleto({ nombres: evaluador_nombres ?? "", apellidos: evaluador_apellidos ?? "" }),
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
    retroalimentacion: describirRetroalimentacion(
      evaluacion,
      await modelo.listarCompromisos(evaluacion.id_evaluacion),
    ),
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

// KAN-26: el evaluador registra la retroalimentación cualitativa en la sección final, una vez que completó los
// puntajes. Los textos se reemplazan y la lista de compromisos sustituye a la guardada. Tras el envío ya no se edita.
async function guardarRetroalimentacion(idEmpleado, idEvaluacion, cuerpo) {
  const datos = validarRetroalimentacion(cuerpo);

  const resultado = await enTransaccion(async (db) => {
    const evaluacion = await prepararEscritura(idEmpleado, idEvaluacion, db);
    if (evaluacion.vencida) return { evaluacion };

    const formulario = await cargarFormulario(evaluacion, db);
    const faltantes = buscarFaltantes(formulario);
    if (faltantes.length > 0 || resumirProgreso(formulario).respondidas === 0) {
      throw new ErrorApp(
        422,
        "Complete los puntajes de la evaluación antes de registrar la retroalimentación final.",
        faltantes,
      );
    }
    verificarFechasCompromisos(datos.compromisos, evaluacion.hoy);

    const actualizadoEn = await modelo.guardarRetroalimentacion(evaluacion.id_evaluacion, datos, db);
    if (!actualizadoEn) {
      throw new ErrorApp(409, "La evaluación ya fue enviada y no se puede modificar.");
    }
    await modelo.reemplazarCompromisos(evaluacion.id_evaluacion, datos.compromisos, db);
    return {
      evaluacion: { ...evaluacion, ...datos },
      actualizadoEn,
      compromisos: await modelo.listarCompromisos(evaluacion.id_evaluacion, db),
    };
  });

  if (resultado.evaluacion.vencida) throw errorVencida(resultado.evaluacion);
  return {
    id_evaluacion: resultado.evaluacion.id_evaluacion,
    actualizado_en: resultado.actualizadoEn,
    retroalimentacion: describirRetroalimentacion(resultado.evaluacion, resultado.compromisos),
  };
}

// KAN-26: el colaborador ve solo sus evaluaciones ya enviadas.
async function listarMisResultados(idEmpleado) {
  const filas = await modelo.listarResultadosDelEvaluado(idEmpleado);
  return filas.map((fila) => ({
    id_evaluacion: fila.id_evaluacion,
    ciclo: { id_ciclo: fila.id_ciclo, nombre: fila.ciclo, fecha_limite: fila.fecha_limite },
    plantilla: { nombre: fila.plantilla },
    evaluador: {
      nombre_completo: nombreCompleto({ nombres: fila.evaluador_nombres, apellidos: fila.evaluador_apellidos }),
    },
    puntaje_final: fila.puntaje_final,
    enviada_en: fila.enviada_en,
    compromisos: fila.compromisos,
  }));
}

// KAN-26: resultado de una evaluación enviada, visto por el colaborador evaluado. Es de solo lectura: el
// servicio no ofrece ninguna escritura al evaluado, y las del evaluador rechazan una evaluación enviada.
async function obtenerMiResultado(idEmpleado, idEvaluacion) {
  const evaluacion = UUID_RE.test(idEvaluacion)
    ? await modelo.obtenerEvaluacion(idEvaluacion.toLowerCase())
    : null;
  if (!evaluacion) throw new ErrorApp(404, "Evaluación no encontrada");
  if (evaluacion.id_empleado_evaluado !== idEmpleado) {
    throw new ErrorApp(403, "Solo puede consultar los resultados de sus propias evaluaciones.");
  }
  if (evaluacion.id_estado_evaluacion !== ESTADO_EVALUACION.ENVIADA) {
    throw new ErrorApp(409, "Los resultados estarán disponibles cuando su evaluador envíe la evaluación.");
  }

  const formulario = await cargarFormulario(evaluacion);
  return {
    id_evaluacion: evaluacion.id_evaluacion,
    estado_codigo: CODIGO_ESTADO_EVALUACION[ESTADO_EVALUACION.ENVIADA],
    editable: false,
    colaborador: describirColaborador(evaluacion),
    evaluador: describirEvaluador(evaluacion),
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
    resultado: { ...calcularResultado(formulario), puntaje_final: evaluacion.puntaje_final },
    retroalimentacion: describirRetroalimentacion(
      evaluacion,
      await modelo.listarCompromisos(evaluacion.id_evaluacion),
    ),
  };
}

module.exports = {
  guardarRetroalimentacion,
  listarMisResultados,
  obtenerMiResultado,
  listarEvaluaciones,
  listarCiclos,
  obtenerFormulario,
  guardarRespuestas,
  enviar,
};
