const { ErrorApp } = require("./errores");
const { esFecha, diaAnterior, sumarMeses } = require("./fechas");

// Indicadores de rotación de personal (RF-75, KAN-95).
// Fechas como texto AAAA-MM-DD: compararlas como texto equivale a compararlas como fechas.

const PERIODO_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MESES_VENTANA = 12;
const DIAS_ROTACION_TEMPRANA = 90;
const ROLES_TODO = ["admin", "gerente"];
const ROL_SUPERVISOR = "supervisor";

const METAS = {
  "KPI-10": { nombre: "Tasa de rotación mensual", meta: 3, sentido: "menor" },
  "KPI-11": { nombre: "Tasa de retención", meta: 90, sentido: "mayor" },
  "KPI-12": { nombre: "Rotación temprana", meta: 15, sentido: "menor" },
};

const redondear = (valor, decimales = 1) => {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
};

const porcentaje = (parte, total) => (total > 0 ? redondear((parte / total) * 100) : null);

// Verde si cumple la meta; amarillo si no la cumple por menos del 10% de la meta; rojo en otro caso.
// Se evalúa el valor ya redondeado, el mismo que ve el usuario.
function semaforo(valor, { meta, sentido }) {
  if (valor === null || valor === undefined) return "sin_datos";
  if (sentido === "menor") {
    if (valor <= meta) return "verde";
    return valor <= redondear(meta * 1.1, 4) ? "amarillo" : "rojo";
  }
  if (valor >= meta) return "verde";
  return valor >= redondear(meta * 0.9, 4) ? "amarillo" : "rojo";
}

const finDeMes = (periodo) => diaAnterior(sumarMeses(`${periodo}-01`, 1));
const periodoDe = (fecha) => fecha.slice(0, 7);
const sumarPeriodos = (periodo, n) => periodoDe(sumarMeses(`${periodo}-01`, n));

function validarConsulta({ periodo, id_sucursal, id_departamento } = {}, hoy) {
  const detalles = [];
  const mesActual = periodoDe(hoy);
  let periodoFinal = mesActual;
  if (periodo !== undefined && periodo !== "") {
    if (typeof periodo !== "string" || !PERIODO_RE.test(periodo)) {
      detalles.push({ campo: "periodo", mensaje: "El periodo debe tener el formato AAAA-MM." });
    } else if (periodo > mesActual) {
      detalles.push({ campo: "periodo", mensaje: "El periodo no puede ser posterior al mes actual." });
    } else if (periodo < "2000-01") {
      detalles.push({ campo: "periodo", mensaje: "El periodo no puede ser anterior a 2000-01." });
    } else {
      periodoFinal = periodo;
    }
  }
  const uuid = (valor, campo, nombre) => {
    if (valor === undefined || valor === "") return null;
    if (typeof valor !== "string" || !UUID_RE.test(valor)) {
      detalles.push({ campo, mensaje: `${nombre} no es válida.` });
      return null;
    }
    return valor.toLowerCase();
  };
  const idSucursal = uuid(id_sucursal, "id_sucursal", "La sucursal");
  const idDepartamento = uuid(id_departamento, "id_departamento", "El área");
  if (detalles.length > 0) throw new ErrorApp(400, "Los filtros no son válidos.", detalles);
  return { periodo: periodoFinal, idSucursal, idDepartamento };
}

// Administrador y Gerente ven toda la cadena; el supervisor, solo su sucursal.
function resolverAlcance({ rol, idEmpleado } = {}, empleados, idSucursalPedida) {
  const normalizado = (rol ?? "").trim().toLowerCase();
  if (ROLES_TODO.includes(normalizado)) {
    return { rol: normalizado, sucursal_fija: false, id_sucursal: idSucursalPedida };
  }
  if (normalizado !== ROL_SUPERVISOR) {
    throw new ErrorApp(403, "Solo el Gerente de talento, el Administrador de RRHH o un supervisor pueden ver la rotación de personal.");
  }
  const id = (idEmpleado ?? "").trim().toLowerCase();
  const propio = UUID_RE.test(id) ? empleados.find((e) => e.id_empleado === id && e.activo) : null;
  if (!propio) throw new ErrorApp(403, "No se pudo identificar la sucursal del supervisor.");
  if (idSucursalPedida && idSucursalPedida !== propio.id_sucursal) {
    throw new ErrorApp(403, "Un supervisor solo puede ver los indicadores de su sucursal.");
  }
  return { rol: normalizado, sucursal_fija: true, id_sucursal: propio.id_sucursal };
}

// Une el personal de EmployeeService con las bajas registradas (una por colaborador, la de retiro más reciente).
// Un colaborador en BAJA sin proceso de desvinculación no tiene fecha de retiro: queda fuera de los cálculos.
function construirTrayectorias(empleados, bajas) {
  const bajaPorEmpleado = new Map();
  for (const baja of bajas) {
    const previa = bajaPorEmpleado.get(baja.id_empleado);
    if (!previa || baja.fecha_retiro > previa.fecha_retiro) bajaPorEmpleado.set(baja.id_empleado, baja);
  }
  const trayectorias = [];
  const sinRegistro = [];
  for (const empleado of empleados) {
    const baja = bajaPorEmpleado.get(empleado.id_empleado);
    const ingreso = empleado.fecha_ingreso || baja?.fecha_ingreso;
    if (!esFecha(ingreso)) continue;
    if (!baja && empleado.estado_codigo === "BAJA") {
      sinRegistro.push(empleado);
      continue;
    }
    trayectorias.push({
      id_empleado: empleado.id_empleado,
      id_sucursal: empleado.id_sucursal,
      id_departamento: empleado.id_departamento,
      ingreso,
      retiro: baja ? baja.fecha_retiro : null,
      codigo_causal: baja ? baja.codigo_causal : null,
    });
  }
  return { trayectorias, sinRegistro };
}

const filtrar = (trayectorias, { idSucursal, idDepartamento }) =>
  trayectorias.filter(
    (t) => (!idSucursal || t.id_sucursal === idSucursal) && (!idDepartamento || t.id_departamento === idDepartamento)
  );

// En planilla al cierre del día `fecha`: ya ingresó y su último día de trabajo no es anterior ni igual a esa fecha.
const enPlantillaAlCierre = (t, fecha) => t.ingreso <= fecha && (t.retiro === null || t.retiro > fecha);

// Movimiento de un tramo [desde, hasta]. La plantilla inicial es la del cierre del día anterior, así
// final = inicial + ingresos - bajas.
function movimiento(trayectorias, desde, hasta) {
  const antes = diaAnterior(desde);
  let inicial = 0;
  let final = 0;
  let bajas = 0;
  let ingresos = 0;
  for (const t of trayectorias) {
    if (enPlantillaAlCierre(t, antes)) inicial += 1;
    if (enPlantillaAlCierre(t, hasta)) final += 1;
    if (t.retiro !== null && t.retiro >= desde && t.retiro <= hasta) bajas += 1;
    if (t.ingreso >= desde && t.ingreso <= hasta) ingresos += 1;
  }
  return { inicial, final, bajas, ingresos };
}

function rotacionMensual(trayectorias, periodo, corte) {
  const desde = `${periodo}-01`;
  const hasta = finDeMes(periodo) < corte ? finDeMes(periodo) : corte;
  const m = movimiento(trayectorias, desde, hasta);
  const promedio = (m.inicial + m.final) / 2;
  return {
    valor: porcentaje(m.bajas, promedio),
    detalle: {
      bajas: m.bajas,
      ingresos: m.ingresos,
      plantilla_inicio: m.inicial,
      plantilla_final: m.final,
      plantilla_promedio: redondear(promedio),
    },
  };
}

// Retención: de quienes estaban en planilla al iniciar la ventana, cuántos siguen al cerrarla.
function retencion(trayectorias, desde, hasta) {
  const antes = diaAnterior(desde);
  const grupo = trayectorias.filter((t) => enPlantillaAlCierre(t, antes));
  const siguen = grupo.filter((t) => enPlantillaAlCierre(t, hasta)).length;
  return { valor: porcentaje(siguen, grupo.length), detalle: { empleados_inicio: grupo.length, siguen_activos: siguen } };
}

const diasEntre = (desde, hasta) => Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000);

// Rotación temprana: bajas con menos de 90 días de antigüedad sobre los ingresos del mismo tramo.
function rotacionTemprana(trayectorias, desde, hasta) {
  let tempranas = 0;
  let ingresos = 0;
  for (const t of trayectorias) {
    if (t.ingreso >= desde && t.ingreso <= hasta) ingresos += 1;
    if (t.retiro !== null && t.retiro >= desde && t.retiro <= hasta && diasEntre(t.ingreso, t.retiro) < DIAS_ROTACION_TEMPRANA) {
      tempranas += 1;
    }
  }
  return { valor: porcentaje(tempranas, ingresos), detalle: { bajas_tempranas: tempranas, ingresos } };
}

// Distribución de las bajas del tramo por causal; se listan todas las causales del catálogo, aun sin bajas.
function motivosDeBaja(trayectorias, causales, desde, hasta) {
  const conteo = new Map();
  let total = 0;
  for (const t of trayectorias) {
    if (t.retiro === null || t.retiro < desde || t.retiro > hasta) continue;
    conteo.set(t.codigo_causal, (conteo.get(t.codigo_causal) || 0) + 1);
    total += 1;
  }
  const items = causales.map((c) => ({ codigo: c.codigo, nombre: c.nombre, cantidad: conteo.get(c.codigo) || 0 }));
  for (const [codigo, cantidad] of conteo) {
    if (!items.some((i) => i.codigo === codigo)) items.push({ codigo, nombre: codigo, cantidad });
  }
  return {
    total,
    items: items.map((i) => ({ ...i, porcentaje: total > 0 ? redondear((i.cantidad / total) * 100) : 0 })),
  };
}

const kpi = (codigo, { valor, detalle }, tramo) => ({
  codigo,
  ...METAS[codigo],
  unidad: "%",
  valor,
  estado: semaforo(valor, METAS[codigo]),
  tramo,
  detalle,
});

// Calcula el tablero completo para el periodo (mes) y la ventana de 12 meses que termina en él.
// `hoy` acota el mes en curso: sus cifras son al corte de hoy.
function calcularTablero({ empleados, bajas, causales, periodo, idSucursal, idDepartamento, hoy }) {
  const { trayectorias, sinRegistro } = construirTrayectorias(empleados, bajas);
  const filtradas = filtrar(trayectorias, { idSucursal, idDepartamento });
  const corte = finDeMes(periodo) < hoy ? finDeMes(periodo) : hoy;
  const primerPeriodo = sumarPeriodos(periodo, -(MESES_VENTANA - 1));
  const desdeVentana = `${primerPeriodo}-01`;
  const tramoMes = { desde: `${periodo}-01`, hasta: corte };
  const tramoVentana = { desde: desdeVentana, hasta: corte };

  const tendencia = [];
  for (let i = 0; i < MESES_VENTANA; i += 1) {
    const mes = sumarPeriodos(primerPeriodo, i);
    const { valor, detalle } = rotacionMensual(filtradas, mes, corte);
    tendencia.push({ periodo: mes, valor, estado: semaforo(valor, METAS["KPI-10"]), ...detalle });
  }

  return {
    periodo,
    corte,
    ventana: { desde: primerPeriodo, hasta: periodo },
    kpis: [
      kpi("KPI-10", rotacionMensual(filtradas, periodo, corte), tramoMes),
      kpi("KPI-11", retencion(filtradas, desdeVentana, corte), tramoVentana),
      kpi("KPI-12", rotacionTemprana(filtradas, desdeVentana, corte), tramoVentana),
    ],
    tendencia,
    motivos: motivosDeBaja(filtradas, causales, desdeVentana, corte),
    avisos: { bajas_sin_registro: filtrar(sinRegistro, { idSucursal, idDepartamento }).length },
  };
}

module.exports = {
  METAS,
  semaforo,
  validarConsulta,
  resolverAlcance,
  construirTrayectorias,
  movimiento,
  rotacionMensual,
  retencion,
  rotacionTemprana,
  motivosDeBaja,
  calcularTablero,
  finDeMes,
  sumarPeriodos,
};
