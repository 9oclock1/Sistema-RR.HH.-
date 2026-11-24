const pool = require("../config/db");
const planillasModelo = require("../models/planillas.model");
const aguinaldoModelo = require("../models/aguinaldo.model");
const externos = require("./externos.service");
const { responsableEn } = require("./planillas.service");
const { ErrorApp } = require("../utils/errores");
const { validarGestion } = require("../utils/aguinaldo");
const { validarResponsable } = require("../utils/planillas");
const { construirReportePlanilla, construirReporteAguinaldo } = require("../utils/reporteContable");

const PERIODO_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// Regla de negocio para el criterio 1 ("periodo cerrado"): APROBADA o CERRADA. Restringir solo a CERRADA
// (como se intentó antes) hacía que el criterio 2 ("pendiente"/"con error") nunca se pudiera demostrar: una
// CERRADA, por definición, ya tiene ambas confirmaciones en CONFIRMADA, así que el reporte siempre mostraba
// "registrado". Con APROBADA también permitida, el Contador puede consultar el reporte apenas se envía el
// asiento (y la orden de pago), con la conciliación todavía "pendiente" o, si algún destino la rechazó, "con
// error" — que es justamente lo que el criterio 2 pide poder mostrar. Lo único que sigue bloqueado es
// BORRADOR, porque ahí no se envió nada: no hay asiento que conciliar.
const ESTADOS_PERMITIDOS = ["APROBADA", "CERRADA"];

// codigo "EN_BORRADOR": así el frontend sabe que no hay nada que simular (todavía no se envió el asiento).
const enBorrador = (nombre) =>
  new ErrorApp(
    409,
    `${nombre} está en borrador: el reporte contable se genera recién al aprobarla, cuando se envía el asiento a Contabilidad y la orden a Pagos.`,
    undefined,
    "EN_BORRADOR"
  );

const MENSAJE_ROL = "Solo el Administrador de RRHH o el Contador pueden consultar el reporte contable.";

// El reporte expone sueldos y pasivos de toda la empresa: antes no pedía identidad ni rol (cualquiera con
// la URL lo veía, incluso sin cabeceras). Mismo mecanismo "temporal" que el resto del módulo (X-Empleado-Id
// y X-Rol), no autenticación real, pero ya no queda abierto a cualquiera.
async function autorizar(identidad) {
  const id = validarResponsable(identidad, MENSAJE_ROL);
  responsableEn(await externos.listarPersonal(), id);
}

// Último día del mes de `periodo` (AAAA-MM), para acotar la búsqueda del aguinaldo cerrado ese mes.
function finDeMes(periodo) {
  const [anio, mes] = periodo.split("-").map(Number);
  const dias = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return `${periodo}-${String(dias).padStart(2, "0")}`;
}

// Criterio 1: el reporte contable consolidado de UNA planilla mensual, por cuenta contable y centro de
// costo. Con el periodo APROBADA o CERRADA (ver ESTADOS_PERMITIDOS). El criterio también pide incluir "aguinaldos":
// si una planilla de aguinaldos se cerró dentro de este mismo mes, se funde en el mismo consolidado (ver
// aguinaldoModelo.obtenerCerradoEnMes y utils/reporteContable#combinarCentros) en vez de quedar visible solo
// en el reporte de aguinaldos por gestión.
async function generarPlanilla(periodo, identidad = {}) {
  await autorizar(identidad);
  if (!PERIODO_RE.test(periodo ?? "")) {
    throw new ErrorApp(400, "Filtros inválidos", [{ campo: "periodo", mensaje: "Use el formato AAAA-MM." }]);
  }
  const planilla = (await planillasModelo.listar(periodo))[0];
  if (!planilla) throw new ErrorApp(404, `No existe una planilla para el periodo ${periodo}.`);
  if (!ESTADOS_PERMITIDOS.includes(planilla.estado)) throw enBorrador(`La planilla de ${periodo}`);
  const [filasConceptos, filasPasivos, aguinaldo] = await Promise.all([
    planillasModelo.conceptosPorCentroDeCosto(pool, planilla.id_planilla),
    planillasModelo.pasivosPorCentroDeCosto(pool, planilla.id_planilla),
    aguinaldoModelo.obtenerCerradoEnMes(pool, `${periodo}-01`, finDeMes(periodo)),
  ]);
  const filasAguinaldo = aguinaldo ? await aguinaldoModelo.montosPorCentroDeCosto(pool, aguinaldo.id_aguinaldo) : null;
  return construirReportePlanilla({ planilla, filasConceptos, filasPasivos, aguinaldo, filasAguinaldo });
}

async function generarAguinaldo(gestion, identidad = {}) {
  await autorizar(identidad);
  const gestionValidada = validarGestion(gestion);
  const aguinaldo = (await aguinaldoModelo.listar()).find((a) => a.gestion === gestionValidada);
  if (!aguinaldo) throw new ErrorApp(404, `No existe una planilla de aguinaldos para la gestión ${gestionValidada}.`);
  if (!ESTADOS_PERMITIDOS.includes(aguinaldo.estado)) {
    throw enBorrador(`La planilla de aguinaldos de la gestión ${gestionValidada}`);
  }
  const filasPorCentro = await aguinaldoModelo.montosPorCentroDeCosto(pool, aguinaldo.id_aguinaldo);
  return construirReporteAguinaldo({ aguinaldo, filasPorCentro });
}

module.exports = { generarPlanilla, generarAguinaldo, ESTADOS_PERMITIDOS };
