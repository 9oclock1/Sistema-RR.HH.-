const { calcularPuntaje } = require("./puntajePonderado");

// Arma el formulario de una evaluación desde las filas planas de la plantilla:
//   { escalas: [...], secciones: [{ competencia, criterios: [{ preguntas: [...] }] }] }
// Cada pregunta trae su respuesta guardada (o null), de modo que el mismo objeto sirve para pintar el
// formulario, medir el avance, detectar lo que falta y calcular el puntaje.
//
// filas: una por pregunta, ordenadas por sección, criterio y pregunta.
// niveles: los niveles de las escalas usadas, con id_escala, id_nivel, valor y etiqueta.
function armarFormulario(filas, niveles) {
  const escalas = new Map();
  for (const fila of filas) {
    if (!escalas.has(fila.id_escala)) {
      escalas.set(fila.id_escala, {
        id_escala: fila.id_escala,
        nombre: fila.escala,
        tipo: fila.tipo_escala,
        valor_maximo: 0,
        niveles: [],
      });
    }
  }
  for (const nivel of niveles) {
    const escala = escalas.get(nivel.id_escala);
    if (!escala) continue;
    escala.niveles.push({ id_nivel: nivel.id_nivel, valor: nivel.valor, etiqueta: nivel.etiqueta });
    escala.valor_maximo = Math.max(escala.valor_maximo, nivel.valor);
  }
  for (const escala of escalas.values()) escala.niveles.sort((a, b) => a.valor - b.valor);

  const secciones = [];
  const porSeccion = new Map();
  const porCriterio = new Map();

  for (const fila of filas) {
    let seccion = porSeccion.get(fila.id_seccion);
    if (!seccion) {
      seccion = {
        id_seccion: fila.id_seccion,
        orden: fila.orden_seccion,
        competencia: {
          id_competencia: fila.id_competencia,
          nombre: fila.competencia,
          descripcion: fila.competencia_descripcion,
          tipo: fila.tipo_competencia,
        },
        criterios: [],
      };
      porSeccion.set(fila.id_seccion, seccion);
      secciones.push(seccion);
    }

    let criterio = porCriterio.get(fila.id_criterio);
    if (!criterio) {
      criterio = {
        id_criterio: fila.id_criterio,
        nombre: fila.criterio,
        descripcion: fila.criterio_descripcion,
        orden: fila.orden_criterio,
        preguntas: [],
      };
      porCriterio.set(fila.id_criterio, criterio);
      seccion.criterios.push(criterio);
    }

    criterio.preguntas.push({
      id_pregunta: fila.id_pregunta,
      texto: fila.texto,
      peso_porcentual: fila.peso_porcentual,
      es_obligatoria: fila.es_obligatoria,
      orden: fila.orden_pregunta,
      id_escala: fila.id_escala,
      respuesta: fila.id_nivel_respondido ? { id_nivel: fila.id_nivel_respondido, valor: fila.valor_respondido } : null,
    });
  }

  return { escalas: [...escalas.values()], secciones };
}

const preguntasDe = (formulario) =>
  formulario.secciones.flatMap((seccion) => seccion.criterios.flatMap((criterio) => criterio.preguntas));

function resumirProgreso(formulario) {
  const preguntas = preguntasDe(formulario);
  const obligatorias = preguntas.filter((pregunta) => pregunta.es_obligatoria);
  return {
    total: preguntas.length,
    respondidas: preguntas.filter((pregunta) => pregunta.respuesta).length,
    obligatorias_total: obligatorias.length,
    obligatorias_respondidas: obligatorias.filter((pregunta) => pregunta.respuesta).length,
  };
}

// Preguntas obligatorias sin respuesta, con el formato de detalles de error del servicio.
function buscarFaltantes(formulario) {
  return preguntasDe(formulario)
    .filter((pregunta) => pregunta.es_obligatoria && !pregunta.respuesta)
    .map((pregunta) => ({
      campo: pregunta.id_pregunta,
      id_pregunta: pregunta.id_pregunta,
      mensaje: `Falta responder la pregunta obligatoria «${pregunta.texto}».`,
    }));
}

// Puntaje final y desglose por competencia y por criterio, todos con la misma fórmula (ver puntajePonderado.js).
function calcularResultado(formulario) {
  const maximos = new Map(formulario.escalas.map((escala) => [escala.id_escala, escala.valor_maximo]));
  const comoItems = (preguntas) =>
    preguntas
      .filter((pregunta) => pregunta.respuesta)
      .map((pregunta) => ({
        peso: pregunta.peso_porcentual,
        valor: pregunta.respuesta.valor,
        maximo: maximos.get(pregunta.id_escala),
      }));
  const sumarPesos = (preguntas) => Math.round(preguntas.reduce((total, p) => total + p.peso_porcentual * 100, 0)) / 100;

  return {
    puntaje_final: calcularPuntaje(comoItems(preguntasDe(formulario))),
    secciones: formulario.secciones.map((seccion) => {
      const preguntasSeccion = seccion.criterios.flatMap((criterio) => criterio.preguntas);
      return {
        id_seccion: seccion.id_seccion,
        competencia: seccion.competencia.nombre,
        peso_porcentual: sumarPesos(preguntasSeccion),
        puntaje: calcularPuntaje(comoItems(preguntasSeccion)),
        criterios: seccion.criterios.map((criterio) => ({
          id_criterio: criterio.id_criterio,
          nombre: criterio.nombre,
          peso_porcentual: sumarPesos(criterio.preguntas),
          puntaje: calcularPuntaje(comoItems(criterio.preguntas)),
        })),
      };
    }),
  };
}

module.exports = { armarFormulario, preguntasDe, resumirProgreso, buscarFaltantes, calcularResultado };
