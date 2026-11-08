const { ErrorApp } = require("./errores");
const { UUID_RE } = require("./formatos");
const { nombreCompleto } = require("./evaluaciones");
const { describirRetroalimentacion } = require("./retroalimentacion");

// Consulta de evaluaciones individuales: resultados consolidados por ciclo y evolución histórica por periodo.

// Roles que pueden consultar el historial de otro colaborador (RRHH). Los demás solo ven el propio.
const ROLES_CONSULTA_GLOBAL = ["admin", "gerente"];

// RBAC: el colaborador consulta su propio historial; el de otra persona solo lo ve RRHH.
function autorizarConsulta({ idSolicitante, rol, idColaborador }) {
  const id = typeof idColaborador === "string" ? idColaborador.trim().toLowerCase() : "";
  if (!UUID_RE.test(id)) {
    throw new ErrorApp(400, "Datos inválidos", [
      { campo: "idEmpleado", mensaje: "El colaborador debe ser un identificador válido." },
    ]);
  }
  if (id === idSolicitante) return { idColaborador: id, propio: true };
  if (!ROLES_CONSULTA_GLOBAL.includes(rol)) {
    throw new ErrorApp(
      403,
      "Su rol no le permite consultar las evaluaciones de otro colaborador. Solo puede ver las suyas.",
    );
  }
  return { idColaborador: id, propio: false };
}

// Promedio con 2 decimales, calculado en centésimas para no arrastrar errores de coma flotante.
function promediar(valores) {
  const numeros = valores.filter((v) => v !== null && v !== undefined).map(Number);
  if (numeros.length === 0) return null;
  const centesimas = numeros.reduce((total, v) => total + Math.round(v * 100), 0);
  return Math.round(centesimas / numeros.length) / 100;
}

// Desglose por competencia del ciclo: promedio del puntaje de cada competencia entre sus evaluadores.
function consolidarCompetencias(resultados) {
  const porCompetencia = new Map();
  for (const resultado of resultados) {
    for (const seccion of resultado.secciones) {
      const clave = seccion.id_competencia ?? seccion.competencia;
      if (!porCompetencia.has(clave)) {
        porCompetencia.set(clave, {
          id_competencia: seccion.id_competencia ?? null,
          competencia: seccion.competencia,
          pesos: [],
          puntajes: [],
        });
      }
      const acumulado = porCompetencia.get(clave);
      acumulado.pesos.push(seccion.peso_porcentual);
      acumulado.puntajes.push(seccion.puntaje);
    }
  }
  return [...porCompetencia.values()].map(({ id_competencia, competencia, pesos, puntajes }) => ({
    id_competencia,
    competencia,
    peso_porcentual: promediar(pesos),
    puntaje: promediar(puntajes),
  }));
}

const describirPeriodo = (fila) => ({
  id_periodo: fila.id_periodo,
  nombre: fila.periodo,
  fecha_inicio: fila.periodo_fecha_inicio,
  fecha_fin: fila.periodo_fecha_fin,
});

// evaluaciones: filas del modelo (enviadas de ciclos cerrados).
// resultados: Map id_evaluacion -> calcularResultado(formulario).
// compromisos: Map id_evaluacion -> [compromisos].
function consolidarHistorial(evaluaciones, resultados, compromisos) {
  const ciclos = new Map();
  for (const fila of evaluaciones) {
    if (!ciclos.has(fila.id_ciclo)) {
      ciclos.set(fila.id_ciclo, {
        id_ciclo: fila.id_ciclo,
        nombre: fila.ciclo,
        fecha_inicio: fila.fecha_inicio,
        fecha_limite: fila.fecha_limite,
        cerrado_en: fila.cerrado_en,
        periodo: describirPeriodo(fila),
        filas: [],
      });
    }
    ciclos.get(fila.id_ciclo).filas.push(fila);
  }

  const consolidados = [...ciclos.values()].map(({ filas, ...ciclo }) => ({
    ...ciclo,
    cantidad_evaluaciones: filas.length,
    puntaje_final: promediar(filas.map((f) => f.puntaje_final)),
    competencias: consolidarCompetencias(filas.map((f) => resultados.get(f.id_evaluacion)).filter(Boolean)),
    evaluaciones: filas.map((f) => ({
      id_evaluacion: f.id_evaluacion,
      plantilla: { nombre: f.plantilla },
      evaluador: {
        nombre_completo: nombreCompleto({ nombres: f.evaluador_nombres ?? "", apellidos: f.evaluador_apellidos ?? "" }),
      },
      puntaje_final: f.puntaje_final === null ? null : Number(f.puntaje_final),
      enviada_en: f.enviada_en,
      retroalimentacion: describirRetroalimentacion(f, compromisos.get(f.id_evaluacion) ?? []),
    })),
  }));

  // Más reciente primero para la lista; la evolución va en orden cronológico.
  const fechaDe = (ciclo) => String(ciclo.periodo.fecha_inicio ?? "") + String(ciclo.fecha_limite ?? "");
  consolidados.sort((a, b) => fechaDe(b).localeCompare(fechaDe(a)));

  const periodos = new Map();
  for (const ciclo of consolidados) {
    const { id_periodo: idPeriodo } = ciclo.periodo;
    if (!periodos.has(idPeriodo)) periodos.set(idPeriodo, { ...ciclo.periodo, puntajes: [], ciclos: 0 });
    const periodo = periodos.get(idPeriodo);
    periodo.puntajes.push(ciclo.puntaje_final);
    periodo.ciclos += 1;
  }
  let anterior = null;
  const evolucion = [...periodos.values()]
    .sort((a, b) => String(a.fecha_inicio).localeCompare(String(b.fecha_inicio)))
    .map(({ puntajes, ciclos: cantidadCiclos, ...periodo }) => {
      const puntaje = promediar(puntajes);
      const variacion = anterior === null || puntaje === null ? null : Math.round((puntaje - anterior) * 100) / 100;
      anterior = puntaje;
      return { ...periodo, cantidad_ciclos: cantidadCiclos, puntaje, variacion };
    });

  const ultimo = evolucion.at(-1) ?? null;
  return {
    resumen: {
      puntaje_actual: ultimo?.puntaje ?? null,
      variacion: ultimo?.variacion ?? null,
      promedio_historico: promediar(consolidados.map((c) => c.puntaje_final)),
      cantidad_ciclos: consolidados.length,
    },
    evolucion,
    ciclos: consolidados,
  };
}

module.exports = { ROLES_CONSULTA_GLOBAL, autorizarConsulta, promediar, consolidarCompetencias, consolidarHistorial };
