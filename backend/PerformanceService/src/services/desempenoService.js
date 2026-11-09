const modelo = require("../models/desempenoModel");
const evaluaciones = require("../models/evaluacionesModel");
const { ErrorApp } = require("../utils/errores");
const { ESTADO_CICLO, ESTADO_EVALUACION } = require("../utils/evaluaciones");
const { armarFormulario, calcularResultado } = require("../utils/formulario");
const {
  validarIdCiclo,
  validarAgrupacion,
  validarUmbral,
  validarFiltrosColaboradores,
  armarColaboradores,
  promedioGlobal,
  resumirCompetencias,
  resumirGrupos,
  resumirCiclo,
  resumirCrm,
  listarColaboradores,
} = require("../utils/desempeno");

const describirCiclo = (ciclo) => ({
  id_ciclo: ciclo.id_ciclo,
  nombre: ciclo.nombre,
  periodo: { id_periodo: ciclo.id_periodo, nombre: ciclo.periodo },
  fecha_inicio: ciclo.fecha_inicio,
  fecha_limite: ciclo.fecha_limite,
  cerrado_en: ciclo.cerrado_en,
  umbral_brecha: ciclo.umbral_brecha,
});

// El consolidado solo existe cuando el ciclo ya cerró: mientras siga activo otro evaluador todavía puede enviar
// y los promedios cambiarían.
async function obtenerCicloCerrado(idPedido) {
  const idCiclo = validarIdCiclo(idPedido);
  const ciclo = await modelo.obtenerCiclo(idCiclo);
  if (!ciclo) throw new ErrorApp(404, "Ciclo no encontrado");
  if (ciclo.id_estado_ciclo !== ESTADO_CICLO.CERRADO) {
    throw new ErrorApp(409, "El ciclo aún no está cerrado: el consolidado se genera cuando termina el plazo de evaluación.");
  }
  return ciclo;
}

const agruparPorEvaluacion = (filas) => {
  const grupos = new Map();
  for (const fila of filas) {
    if (!grupos.has(fila.id_evaluacion)) grupos.set(fila.id_evaluacion, []);
    grupos.get(fila.id_evaluacion).push(fila);
  }
  return grupos;
};

// Puntaje por competencia de cada evaluación enviada, con la misma fórmula que ve el evaluador (KAN-24 y KAN-26).
async function calcularResultados(filas) {
  const ids = filas.filter((f) => f.id_estado_evaluacion === ESTADO_EVALUACION.ENVIADA).map((f) => f.id_evaluacion);
  const estructura = await evaluaciones.listarEstructuraDeEvaluaciones(ids);
  const niveles = await evaluaciones.listarNiveles([...new Set(estructura.map((fila) => fila.id_escala))]);
  return new Map(
    [...agruparPorEvaluacion(estructura)].map(([id, filasEvaluacion]) => [
      id,
      calcularResultado(armarFormulario(filasEvaluacion, niveles)),
    ]),
  );
}

// Reúne lo que necesitan todas las consultas de un ciclo cerrado: sus colaboradores con puntaje y métricas del CRM.
async function reunirCiclo(idPedido) {
  const ciclo = await obtenerCicloCerrado(idPedido);
  const [filas, metricas] = await Promise.all([
    modelo.listarEvaluacionesDelCiclo(ciclo.id_ciclo),
    modelo.listarMetricasCrm(ciclo.id_ciclo),
  ]);
  const resultados = await calcularResultados(filas);
  const colaboradores = armarColaboradores(filas, resultados, metricas);
  return { ciclo, colaboradores, metricas };
}

async function listarCiclos() {
  const ciclos = await modelo.listarCiclosCerrados();
  return ciclos.map((ciclo) => ({
    ...describirCiclo(ciclo),
    evaluaciones: { total: ciclo.evaluaciones, enviadas: ciclo.enviadas, vencidas: ciclo.vencidas },
  }));
}

// Resultados globales del ciclo: promedios por área, sucursal y competencia, con las brechas resaltadas.
async function obtenerConsolidado(idPedido) {
  const { ciclo, colaboradores, metricas } = await reunirCiclo(idPedido);
  const umbral = ciclo.umbral_brecha;
  const global = promedioGlobal(colaboradores);
  const departamentos = resumirGrupos(colaboradores, "departamento", umbral, global);
  const sucursales = resumirGrupos(colaboradores, "sucursal", umbral, global);

  const solicitud = await modelo.obtenerSolicitudCrm(ciclo.id_ciclo);
  return {
    ciclo: describirCiclo(ciclo),
    resumen: resumirCiclo(colaboradores, departamentos, sucursales),
    departamentos,
    sucursales,
    competencias: resumirCompetencias(colaboradores, umbral),
    crm: {
      solicitud: solicitud && {
        estado: solicitud.estado,
        intentos: solicitud.intentos,
        ultimo_error: solicitud.ultimo_error,
        entregado_en: solicitud.entregado_en,
        creado_en: solicitud.creado_en,
      },
      metricas_recibidas: metricas.length,
      ...resumirCrm(colaboradores),
    },
  };
}

// Comparativa entre áreas (o sucursales): de la más baja a la más alta, con la diferencia respecto del promedio global.
async function obtenerComparativa(idPedido, { por } = {}) {
  const agrupacion = validarAgrupacion(por);
  const { ciclo, colaboradores } = await reunirCiclo(idPedido);
  const global = promedioGlobal(colaboradores);
  const grupos = resumirGrupos(colaboradores, agrupacion, ciclo.umbral_brecha, global);
  return {
    ciclo: describirCiclo(ciclo),
    por: agrupacion,
    umbral_brecha: ciclo.umbral_brecha,
    promedio_global: global,
    grupos,
    brechas: grupos
      .filter((grupo) => grupo.es_brecha)
      .map(({ id, nombre, puntaje, puntos_bajo_umbral: puntosBajoUmbral }) => ({
        id,
        nombre,
        puntaje,
        puntos_bajo_umbral: puntosBajoUmbral,
      })),
  };
}

// Colaboradores del ciclo con su puntaje y, como indicador objetivo, las métricas que llegaron del CRM.
async function obtenerColaboradores(idPedido, filtros = {}) {
  const parametros = validarFiltrosColaboradores(filtros);
  const { ciclo, colaboradores } = await reunirCiclo(idPedido);
  return {
    ciclo: describirCiclo(ciclo),
    umbral_brecha: ciclo.umbral_brecha,
    colaboradores: listarColaboradores(colaboradores, parametros, ciclo.umbral_brecha),
  };
}

// El administrador ajusta el umbral por debajo del cual un área se considera brecha en este ciclo.
async function actualizarUmbral(idPedido, datos) {
  const idCiclo = validarIdCiclo(idPedido);
  const umbral = validarUmbral(datos);
  const ciclo = await modelo.actualizarUmbral(idCiclo, umbral);
  if (!ciclo) throw new ErrorApp(404, "Ciclo no encontrado");
  return ciclo;
}

module.exports = { listarCiclos, obtenerConsolidado, obtenerComparativa, obtenerColaboradores, actualizarUmbral };
