const { ErrorApp } = require("./errores");
const { UUID_RE } = require("./formatos");
const { semaforo } = require("./dashboardDesempeno");
const { promediar } = require("./historialDesempeno");

const META_TASA_RESOLUCION = 85;
const META_TIEMPO_RESOLUCION = 10;
const MESES_POR_DEFECTO = 6;
const MESES_MAXIMOS = 36;
const SIN_SUCURSAL = "sin";
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

const vacio = (valor) => valor === undefined || valor === null || valor === "";

const zonaHoraria = () => process.env.QUEJAS_ZONA_HORARIA || "America/La_Paz";

const centesimas = (numero) => Math.round(numero * 100);
const aNumero = (valor) => valor / 100;

function fechaValida(texto) {
  if (!FECHA_RE.test(texto)) return false;
  const fecha = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === texto;
}

const hoyEnZona = (ahora, zona) => new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(ahora);

function primerDiaDeMes(fecha, mesesAtras = 0) {
  const [anio, mes] = fecha.split("-").map(Number);
  const indice = anio * 12 + (mes - 1) - mesesAtras;
  return `${Math.floor(indice / 12)}-${String((indice % 12) + 1).padStart(2, "0")}-01`;
}

const mesesEntre = (desde, hasta) => {
  const [a1, m1] = desde.split("-").map(Number);
  const [a2, m2] = hasta.split("-").map(Number);
  return (a2 - a1) * 12 + (m2 - m1) + 1;
};

function listarMeses(desde, hasta) {
  return Array.from({ length: mesesEntre(desde, hasta) }, (_, i) => primerDiaDeMes(primerDiaDeMes(desde), -i).slice(0, 7));
}

function leerFiltrosDashboard(consulta = {}, ahora = new Date()) {
  const errores = [];
  const zona = zonaHoraria();
  const fecha = (campo, valor) => {
    if (vacio(valor)) return null;
    if (typeof valor !== "string" || !fechaValida(valor)) {
      errores.push({ campo, mensaje: "Use una fecha válida (AAAA-MM-DD)." });
      return null;
    }
    return valor;
  };

  let desde = fecha("desde", consulta.desde);
  let hasta = fecha("hasta", consulta.hasta);

  let idCategoria = null;
  if (!vacio(consulta.categoria)) {
    const numero = Number(consulta.categoria);
    if (Number.isInteger(numero) && numero > 0) idCategoria = numero;
    else errores.push({ campo: "categoria", mensaje: "Filtro inválido." });
  }

  const sinSucursal = consulta.sucursal === SIN_SUCURSAL;
  let idSucursal = null;
  if (!sinSucursal && !vacio(consulta.sucursal)) {
    if (typeof consulta.sucursal === "string" && UUID_RE.test(consulta.sucursal.trim())) {
      idSucursal = consulta.sucursal.trim().toLowerCase();
    } else {
      errores.push({ campo: "sucursal", mensaje: "Filtro inválido." });
    }
  }

  if (errores.length === 0) {
    if (!hasta) hasta = desde && desde > hoyEnZona(ahora, zona) ? desde : hoyEnZona(ahora, zona);
    if (!desde) desde = primerDiaDeMes(hasta, MESES_POR_DEFECTO - 1);
    if (desde > hasta) errores.push({ campo: "hasta", mensaje: "La fecha final no puede ser anterior a la inicial." });
    else if (mesesEntre(desde, hasta) > MESES_MAXIMOS) {
      errores.push({ campo: "hasta", mensaje: `El periodo no puede abarcar más de ${MESES_MAXIMOS} meses.` });
    }
  }
  if (errores.length) throw new ErrorApp(400, "Revise los filtros del dashboard.", errores);
  return { desde, hasta, idCategoria, idSucursal, sinSucursal, zonaHoraria: zona };
}

const semaforoMenorEsMejor = (valor, meta) => {
  if (valor === null || valor === undefined) return null;
  const actual = centesimas(valor);
  const objetivo = centesimas(meta);
  if (actual <= objetivo) return "VERDE";
  if (actual * 10 <= objetivo * 11) return "AMARILLO";
  return "ROJO";
};

const porcentaje = (parte, total) => (total === 0 ? null : aNumero(Math.round((parte * 10000) / total)));

const resueltasDe = (filas) => filas.filter((fila) => fila.resuelta_en_periodo);
const recibidasDe = (filas) => filas.filter((fila) => fila.recibida_en_periodo);

const tiempoPromedio = (resueltas) => promediar(resueltas.map((fila) => fila.dias_resolucion));

function calcularTasaResolucion(filas) {
  const recibidas = recibidasDe(filas).length;
  const resueltas = resueltasDe(filas).length;
  const valor = porcentaje(resueltas, recibidas);
  return {
    codigo: "KPI-01",
    nombre: "Tasa de resolución de quejas",
    valor,
    unidad: "%",
    meta: META_TASA_RESOLUCION,
    comparacion: "MAYOR_O_IGUAL",
    quejas_recibidas: recibidas,
    quejas_resueltas: resueltas,
    semaforo: semaforo(valor, META_TASA_RESOLUCION),
  };
}

function calcularTiempoPromedio(filas) {
  const resueltas = resueltasDe(filas);
  const valor = tiempoPromedio(resueltas);
  return {
    codigo: "KPI-02",
    nombre: "Tiempo promedio de resolución",
    valor,
    unidad: "días",
    meta: META_TIEMPO_RESOLUCION,
    comparacion: "MENOR_O_IGUAL",
    quejas_resueltas: resueltas.length,
    semaforo: semaforoMenorEsMejor(valor, META_TIEMPO_RESOLUCION),
  };
}

function calcularResumen(filas) {
  const recibidas = recibidasDe(filas);
  const anonimas = recibidas.filter((fila) => fila.es_anonima).length;
  return {
    quejas_recibidas: recibidas.length,
    quejas_resueltas: resueltasDe(filas).length,
    quejas_anonimas: anonimas,
    quejas_identificadas: recibidas.length - anonimas,
  };
}

function agruparPor(filas, claveId, claveNombre, nombreVacio) {
  const grupos = new Map();
  const obtener = (fila) => {
    const id = fila[claveId] ?? null;
    if (!grupos.has(id)) grupos.set(id, { id, nombre: fila[claveNombre] ?? nombreVacio, filas: [] });
    return grupos.get(id);
  };
  for (const fila of filas) obtener(fila).filas.push(fila);

  const totalRecibidas = recibidasDe(filas).length;
  return [...grupos.values()]
    .map(({ filas: miembros, ...grupo }) => {
      const recibidas = recibidasDe(miembros).length;
      const resueltas = resueltasDe(miembros);
      return {
        ...grupo,
        quejas_recibidas: recibidas,
        quejas_resueltas: resueltas.length,
        porcentaje_del_total: porcentaje(recibidas, totalRecibidas),
        tasa_resolucion: porcentaje(resueltas.length, recibidas),
        tiempo_promedio_dias: tiempoPromedio(resueltas),
      };
    })
    .sort((a, b) => b.quejas_recibidas - a.quejas_recibidas || String(a.nombre).localeCompare(String(b.nombre), "es"));
}

function calcularTendenciaMensual(filas, desde, hasta) {
  return listarMeses(desde, hasta).map((mes) => {
    const recibidas = filas.filter((fila) => fila.recibida_en_periodo && fila.mes_recibida === mes);
    const resueltas = filas.filter((fila) => fila.resuelta_en_periodo && fila.mes_resuelta === mes);
    const tasa = porcentaje(resueltas.length, recibidas.length);
    const tiempo = tiempoPromedio(resueltas);
    return {
      mes,
      quejas_recibidas: recibidas.length,
      quejas_resueltas: resueltas.length,
      tasa_resolucion: tasa,
      semaforo_tasa: semaforo(tasa, META_TASA_RESOLUCION),
      tiempo_promedio_dias: tiempo,
      semaforo_tiempo: semaforoMenorEsMejor(tiempo, META_TIEMPO_RESOLUCION),
    };
  });
}

module.exports = {
  META_TASA_RESOLUCION,
  META_TIEMPO_RESOLUCION,
  MESES_POR_DEFECTO,
  MESES_MAXIMOS,
  SIN_SUCURSAL,
  leerFiltrosDashboard,
  primerDiaDeMes,
  listarMeses,
  semaforoMenorEsMejor,
  calcularTasaResolucion,
  calcularTiempoPromedio,
  calcularResumen,
  agruparPor,
  calcularTendenciaMensual,
};
