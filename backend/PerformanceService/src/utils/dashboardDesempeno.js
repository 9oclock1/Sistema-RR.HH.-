const { ErrorApp } = require("./errores");
const { UUID_RE } = require("./formatos");
const { ESTADO_EVALUACION } = require("./evaluaciones");
const { promediar } = require("./historialDesempeno");

const META_PUNTAJE_PROMEDIO = 3.5;
const META_CUMPLIMIENTO = 90;
// KPI-09: colaboradores con puntaje >= 4 (escala 1 a 5) sobre los colaboradores evaluados. Meta: >= 25 %.
const META_ALTO_DESEMPENO = 25;
const UMBRAL_ALTO_DESEMPENO = 4;
const ESCALA = { minimo: 1, maximo: 5 };
const DIVISOR_ESCALA = 20;
const ANCHO_RANGO = 0.5;
const RANGOS = (ESCALA.maximo - ESCALA.minimo) / ANCHO_RANGO;

const centesimas = (numero) => Math.round(numero * 100);
const aNumero = (valor) => valor / 100;

const enEscala = (puntaje) =>
  puntaje === null || puntaje === undefined
    ? null
    : aNumero(Math.round(centesimas(puntaje) / DIVISOR_ESCALA));

const semaforo = (valor, meta) => {
  if (valor === null || valor === undefined) return null;
  const actual = centesimas(valor);
  const objetivo = centesimas(meta);
  if (actual >= objetivo) return "VERDE";
  if (actual * 10 >= objetivo * 9) return "AMARILLO";
  return "ROJO";
};

const diferencia = (a, b) =>
  a === null || b === null ? null : aNumero(centesimas(a) - centesimas(b));

const tendencia = (variacion) => {
  if (variacion === null) return null;
  if (variacion > 0) return "SUBE";
  if (variacion < 0) return "BAJA";
  return "IGUAL";
};

const esEnviada = (fila) =>
  fila.id_estado_evaluacion === ESTADO_EVALUACION.ENVIADA &&
  fila.puntaje_final !== null &&
  fila.puntaje_final !== undefined;

const enviadasDe = (filas) => filas.filter(esEnviada);

function leerIdentificador(valor, campo, errores) {
  if (valor === undefined) return null;
  const id = typeof valor === "string" ? valor.trim().toLowerCase() : "";
  if (UUID_RE.test(id)) return id;
  errores.push({ campo, mensaje: "Debe ser un identificador válido." });
  return null;
}

function validarFiltrosDashboard({ ciclo, departamento, sucursal } = {}) {
  const errores = [];
  const filtros = {
    ciclo: leerIdentificador(ciclo, "ciclo", errores),
    departamento: leerIdentificador(departamento, "departamento", errores),
    sucursal: leerIdentificador(sucursal, "sucursal", errores),
  };
  if (errores.length > 0) throw new ErrorApp(400, "Filtros inválidos", errores);
  return filtros;
}

const aplicarFiltros = (filas, { departamento, sucursal }) =>
  filas.filter(
    (fila) =>
      (!departamento || fila.id_departamento === departamento) &&
      (!sucursal || fila.id_sucursal === sucursal),
  );

function calcularPuntajePromedio(filas) {
  const enviadas = enviadasDe(filas);
  const puntaje = promediar(enviadas.map((fila) => fila.puntaje_final));
  const valor = enEscala(puntaje);
  return {
    codigo: "KPI-07",
    nombre: "Puntaje promedio de desempeño",
    valor,
    escala: ESCALA,
    meta: META_PUNTAJE_PROMEDIO,
    evaluaciones_cerradas: enviadas.length,
    puntaje_sobre_100: puntaje,
    semaforo: semaforo(valor, META_PUNTAJE_PROMEDIO),
  };
}

function calcularCumplimiento(filas) {
  const enviadas = enviadasDe(filas).length;
  const valor =
    filas.length === 0
      ? null
      : aNumero(Math.round((enviadas * 10000) / filas.length));
  return {
    codigo: "KPI-08",
    nombre: "Cumplimiento de evaluaciones",
    valor,
    unidad: "%",
    meta: META_CUMPLIMIENTO,
    evaluaciones_enviadas: enviadas,
    evaluaciones_asignadas: filas.length,
    evaluaciones_vencidas: filas.filter(
      (fila) => fila.id_estado_evaluacion === ESTADO_EVALUACION.VENCIDA,
    ).length,
    semaforo: semaforo(valor, META_CUMPLIMIENTO),
  };
}

// KPI-09. Un colaborador evaluado es el que tiene al menos una evaluación enviada en el ciclo; si tiene varias
// (por ejemplo, de dos evaluadores) cuenta una sola vez, con el promedio de sus evaluaciones enviadas. Su puntaje se
// lleva a la escala 1 a 5 igual que el KPI-07, así el umbral de 4 es el mismo que ve el usuario en pantalla.
function calcularAltoDesempeno(filas) {
  const porColaborador = new Map();
  for (const fila of enviadasDe(filas)) {
    const clave = fila.id_empleado_evaluado ?? fila.id_evaluacion;
    if (!porColaborador.has(clave)) porColaborador.set(clave, []);
    porColaborador.get(clave).push(fila.puntaje_final);
  }
  const evaluados = porColaborador.size;
  const altos = [...porColaborador.values()].filter(
    (puntajes) => centesimas(enEscala(promediar(puntajes))) >= centesimas(UMBRAL_ALTO_DESEMPENO),
  ).length;
  const valor = evaluados === 0 ? null : aNumero(Math.round((altos * 10000) / evaluados));
  return {
    codigo: "KPI-09",
    nombre: "Colaboradores de alto desempeño",
    valor,
    unidad: "%",
    meta: META_ALTO_DESEMPENO,
    umbral_puntaje: UMBRAL_ALTO_DESEMPENO,
    colaboradores_alto_desempeno: altos,
    colaboradores_evaluados: evaluados,
    semaforo: semaforo(valor, META_ALTO_DESEMPENO),
  };
}

function calcularHistograma(filas) {
  const enviadas = enviadasDe(filas);
  const rangos = Array.from({ length: RANGOS }, (_, indice) => {
    const desde = ESCALA.minimo + indice * ANCHO_RANGO;
    const hasta = desde + ANCHO_RANGO;
    return {
      desde,
      hasta,
      etiqueta:
        indice === RANGOS - 1
          ? `${desde.toFixed(1)} a ${hasta.toFixed(1)}`
          : `${desde.toFixed(1)} a <${hasta.toFixed(1)}`,
      cantidad: 0,
      porcentaje: 0,
    };
  });
  const puntosPorRango = centesimas(ANCHO_RANGO * DIVISOR_ESCALA);
  for (const fila of enviadas) {
    const posicion =
      Math.floor(centesimas(Number(fila.puntaje_final)) / puntosPorRango) -
      ESCALA.minimo / ANCHO_RANGO;
    rangos[Math.min(RANGOS - 1, Math.max(0, posicion))].cantidad += 1;
  }
  for (const rango of rangos) {
    rango.porcentaje =
      enviadas.length === 0
        ? 0
        : aNumero(Math.round((rango.cantidad * 10000) / enviadas.length));
  }
  return { escala: ESCALA, total: enviadas.length, rangos };
}

function armarRanking(filas, claveId, claveNombre) {
  const grupos = new Map();
  for (const fila of filas) {
    if (!grupos.has(fila[claveId])) {
      grupos.set(fila[claveId], {
        id: fila[claveId],
        nombre: fila[claveNombre],
        filas: [],
      });
    }
    grupos.get(fila[claveId]).filas.push(fila);
  }
  const lista = [...grupos.values()].map(({ filas: miembros, ...grupo }) => {
    const puntaje = promediar(enviadasDe(miembros).map((f) => f.puntaje_final));
    return {
      ...grupo,
      puntaje: enEscala(puntaje),
      puntaje_sobre_100: puntaje,
      evaluaciones_enviadas: enviadasDe(miembros).length,
      evaluaciones_asignadas: miembros.length,
    };
  });
  lista.sort((a, b) => {
    if (a.puntaje === null || b.puntaje === null) {
      return (a.puntaje === null) - (b.puntaje === null) || a.nombre.localeCompare(b.nombre, "es");
    }
    return b.puntaje_sobre_100 - a.puntaje_sobre_100 || a.nombre.localeCompare(b.nombre, "es");
  });
  let posicion = 0;
  return lista.map((grupo) => ({
    ...grupo,
    posicion: grupo.puntaje === null ? null : (posicion += 1),
  }));
}

function compararCiclos(ciclos, filasPorCiclo, idSeleccionado) {
  let anterior = null;
  return ciclos.map((ciclo) => {
    const filas = filasPorCiclo.get(ciclo.id_ciclo) ?? [];
    const puntaje = calcularPuntajePromedio(filas);
    const cumplimiento = calcularCumplimiento(filas);
    const altoDesempeno = calcularAltoDesempeno(filas);
    const variacion = diferencia(puntaje.valor, anterior);
    if (puntaje.valor !== null) anterior = puntaje.valor;
    return {
      id_ciclo: ciclo.id_ciclo,
      nombre: ciclo.nombre,
      periodo: ciclo.periodo,
      cerrado_en: ciclo.cerrado_en,
      seleccionado: ciclo.id_ciclo === idSeleccionado,
      puntaje_promedio: puntaje.valor,
      semaforo_puntaje: puntaje.semaforo,
      cumplimiento: cumplimiento.valor,
      semaforo_cumplimiento: cumplimiento.semaforo,
      alto_desempeno: altoDesempeno.valor,
      semaforo_alto_desempeno: altoDesempeno.semaforo,
      evaluaciones_enviadas: cumplimiento.evaluaciones_enviadas,
      evaluaciones_asignadas: cumplimiento.evaluaciones_asignadas,
      variacion,
      tendencia: tendencia(variacion),
    };
  });
}

function listarOpciones(filas, claveId, claveNombre) {
  const vistos = new Map();
  for (const fila of filas) vistos.set(fila[claveId], fila[claveNombre]);
  return [...vistos]
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

function agruparPorCiclo(filas) {
  const grupos = new Map();
  for (const fila of filas) {
    if (!grupos.has(fila.id_ciclo)) grupos.set(fila.id_ciclo, []);
    grupos.get(fila.id_ciclo).push(fila);
  }
  return grupos;
}

module.exports = {
  META_PUNTAJE_PROMEDIO,
  META_CUMPLIMIENTO,
  META_ALTO_DESEMPENO,
  UMBRAL_ALTO_DESEMPENO,
  ESCALA,
  enEscala,
  semaforo,
  validarFiltrosDashboard,
  aplicarFiltros,
  calcularPuntajePromedio,
  calcularCumplimiento,
  calcularAltoDesempeno,
  calcularHistograma,
  armarRanking,
  compararCiclos,
  listarOpciones,
  agruparPorCiclo,
};
