const { ErrorApp } = require("./errores");
const { UUID_RE } = require("./formatos");
const { semaforoMenorEsMejor } = require("./dashboardQuejas");

// RF-72/RF-73 (KAN-506): KPI-03 (índice de quejas) y KPI-06 (minutos de atraso), ambos "menor es mejor" —
// mismo semáforo (verde/amarillo a menos del 10 % de la meta/rojo) que ya usa el dashboard de quejas.
const META_INDICE_QUEJAS = 2; // quejas por cada 100 empleados
const META_MINUTOS_ATRASO = 15; // minutos de atraso promedio por empleado, al mes

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const vacio = (valor) => valor === undefined || valor === null || valor === "";
const zonaHoraria = () => process.env.QUEJAS_ZONA_HORARIA || "America/La_Paz";
const hoyEnZona = (ahora, zona) => new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(ahora);
const primerDiaDeMes = (fecha) => `${fecha.slice(0, 7)}-01`;

function fechaValida(texto) {
  if (!FECHA_RE.test(texto)) return false;
  const fecha = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === texto;
}

// Criterio 2: filtros por periodo (desde/hasta), sucursal y área. Por defecto, el mes en curso hasta hoy.
function leerFiltros(consulta = {}, ahora = new Date()) {
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

  const idUuid = (campo, valor) => {
    if (vacio(valor)) return null;
    if (typeof valor === "string" && UUID_RE.test(valor.trim())) return valor.trim().toLowerCase();
    errores.push({ campo, mensaje: "Filtro inválido." });
    return null;
  };
  const idSucursal = idUuid("id_sucursal", consulta.id_sucursal);
  const idDepartamento = idUuid("id_departamento", consulta.id_departamento);

  if (errores.length === 0) {
    if (!hasta) hasta = hoyEnZona(ahora, zona);
    if (!desde) desde = primerDiaDeMes(hasta);
    if (desde > hasta) errores.push({ campo: "hasta", mensaje: "La fecha final no puede ser anterior a la inicial." });
  }
  if (errores.length > 0) throw new ErrorApp(400, "Revise los filtros del dashboard.", errores);
  return { desde, hasta, idSucursal, idDepartamento };
}

const redondear1 = (valor) => Math.round(valor * 10) / 10;

// KPI-03 = quejas del periodo / plantilla * 100. "Plantilla" se simplifica a los empleados activos del alcance
// (RF-75 sí calcula un promedio real con la trayectoria de ingresos/bajas, pero esa infraestructura no existe
// para quejas/atrasos y la Historia solo pide comparar áreas y sucursales, no una cifra de rotación): si el
// negocio necesita el promedio real, el cambio es aquí, no en el resto del dashboard.
function calcularKpi03({ quejas, empleadosActivos }) {
  const valor = empleadosActivos > 0 ? redondear1((quejas / empleadosActivos) * 100) : null;
  return {
    codigo: "KPI-03",
    nombre: "Índice de quejas por cada 100 empleados",
    valor,
    meta: META_INDICE_QUEJAS,
    semaforo: semaforoMenorEsMejor(valor, META_INDICE_QUEJAS),
    detalle: { quejas, empleados_activos: empleadosActivos },
  };
}

// KPI-06 = minutos de atraso del periodo / empleados activos.
function calcularKpi06({ minutosAtraso, empleadosActivos }) {
  const valor = empleadosActivos > 0 ? redondear1(minutosAtraso / empleadosActivos) : null;
  return {
    codigo: "KPI-06",
    nombre: "Minutos de atraso promedio por empleado",
    valor,
    meta: META_MINUTOS_ATRASO,
    semaforo: semaforoMenorEsMejor(valor, META_MINUTOS_ATRASO),
    detalle: { minutos_atraso: minutosAtraso, empleados_activos: empleadosActivos },
  };
}

module.exports = { META_INDICE_QUEJAS, META_MINUTOS_ATRASO, leerFiltros, calcularKpi03, calcularKpi06 };
