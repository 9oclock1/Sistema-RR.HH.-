const { lanzarSiHayErrores } = require('../validators/comunes');

// KPI-12 (RF-75, épica 13): rotación temprana = bajas con menos de 90 días de antigüedad / ingresos del periodo x 100.
// Meta: <= 15 %. A diferencia de los KPI de desempeño, aquí un valor MENOR es mejor.
const META_ROTACION_TEMPRANA = 15;
const DIAS_ANTIGUEDAD_TEMPRANA = 90;
const MAXIMO_DIAS_PERIODO = 366 * 5;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

const centesimas = (numero) => Math.round(numero * 100);

const esFechaValida = (texto) => {
  if (typeof texto !== 'string' || !FECHA_RE.test(texto)) return false;
  const fecha = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === texto;
};

const diasEntre = (desde, hasta) =>
  Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000);

// Semáforo para una meta de "a lo sumo": verde si no supera la meta, amarillo si la supera por menos del 10 %
// de la meta (15 % -> hasta 16,5 %), rojo en otro caso.
const semaforoMaximo = (valor, meta) => {
  if (valor === null || valor === undefined) return null;
  const actual = centesimas(valor);
  const objetivo = centesimas(meta);
  if (actual <= objetivo) return 'VERDE';
  if (actual * 10 <= objetivo * 11) return 'AMARILLO';
  return 'ROJO';
};

function validarFiltrosRotacion({ desde, hasta, departamento, sucursal } = {}) {
  const errores = [];
  const fecha = (valor, campo) => {
    if (valor === undefined || valor === '') {
      errores.push({ campo, tipo: 'faltante', mensaje: `El campo '${campo}' es obligatorio (AAAA-MM-DD).` });
      return null;
    }
    if (!esFechaValida(valor)) {
      errores.push({ campo, tipo: 'invalido', mensaje: 'Use una fecha válida con el formato AAAA-MM-DD.' });
      return null;
    }
    return valor;
  };
  const uuid = (valor, campo) => {
    if (valor === undefined || valor === '') return null;
    const id = typeof valor === 'string' ? valor.trim().toLowerCase() : '';
    if (UUID_RE.test(id)) return id;
    errores.push({ campo, tipo: 'invalido', mensaje: 'Debe ser un identificador válido.' });
    return null;
  };

  const filtros = {
    desde: fecha(desde, 'desde'),
    hasta: fecha(hasta, 'hasta'),
    departamento: uuid(departamento, 'departamento'),
    sucursal: uuid(sucursal, 'sucursal'),
  };
  if (filtros.desde && filtros.hasta) {
    if (filtros.hasta < filtros.desde) {
      errores.push({ campo: 'hasta', tipo: 'invalido', mensaje: "'hasta' no puede ser anterior a 'desde'." });
    } else if (diasEntre(filtros.desde, filtros.hasta) > MAXIMO_DIAS_PERIODO) {
      errores.push({ campo: 'hasta', tipo: 'invalido', mensaje: 'El periodo no puede superar los 5 años.' });
    }
  }
  lanzarSiHayErrores(errores);
  return filtros;
}

// Una baja es temprana si el colaborador dejó la empresa antes de cumplir 90 días desde su ingreso.
const esBajaTemprana = (baja) => diasEntre(baja.fecha_ingreso, baja.fecha_baja) < DIAS_ANTIGUEDAD_TEMPRANA;

// `ingresos`: colaboradores que ingresaron dentro del periodo. `bajas`: colaboradores dados de baja dentro del
// periodo (con su fecha de ingreso, que puede ser anterior al periodo). Ambos ya filtrados por área y sucursal.
function calcularRotacionTemprana({ ingresos, bajas }, { desde, hasta }) {
  const tempranas = bajas
    .map((baja) => ({ ...baja, dias_antiguedad: diasEntre(baja.fecha_ingreso, baja.fecha_baja) }))
    .filter(esBajaTemprana)
    .sort((a, b) => a.fecha_baja.localeCompare(b.fecha_baja) || a.nombre_completo.localeCompare(b.nombre_completo, 'es'));
  const valor = ingresos.length === 0 ? null : Math.round((tempranas.length * 10000) / ingresos.length) / 100;
  return {
    codigo: 'KPI-12',
    nombre: 'Rotación temprana',
    valor,
    unidad: '%',
    meta: META_ROTACION_TEMPRANA,
    sentido_meta: 'MAXIMO',
    dias_antiguedad_temprana: DIAS_ANTIGUEDAD_TEMPRANA,
    periodo: { desde, hasta },
    ingresos_periodo: ingresos.length,
    bajas_periodo: bajas.length,
    bajas_tempranas: tempranas.length,
    semaforo: semaforoMaximo(valor, META_ROTACION_TEMPRANA),
    detalle_bajas_tempranas: tempranas.map((b) => ({
      id_empleado: b.id_empleado,
      nombre_completo: b.nombre_completo,
      area: b.area,
      sucursal: b.sucursal,
      fecha_ingreso: b.fecha_ingreso,
      fecha_baja: b.fecha_baja,
      dias_antiguedad: b.dias_antiguedad,
    })),
  };
}

module.exports = {
  META_ROTACION_TEMPRANA,
  DIAS_ANTIGUEDAD_TEMPRANA,
  semaforoMaximo,
  validarFiltrosRotacion,
  esBajaTemprana,
  calcularRotacionTemprana,
};
