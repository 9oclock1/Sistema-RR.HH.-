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

const noCerrado = (nombre) =>
  new ErrorApp(409, `${nombre} todavía está en borrador: genere el reporte contable cuando el periodo esté cerrado.`);

const MENSAJE_ROL = "Solo el Administrador de RRHH o el Contador pueden consultar el reporte contable.";

// El reporte expone sueldos y pasivos de toda la empresa: antes no pedía identidad ni rol (cualquiera con
// la URL lo veía, incluso sin cabeceras). Mismo mecanismo "temporal" que el resto del módulo (X-Empleado-Id
// y X-Rol), no autenticación real, pero ya no queda abierto a cualquiera.
async function autorizar(identidad) {
  const id = validarResponsable(identidad, MENSAJE_ROL);
  responsableEn(await externos.listarPersonal(), id);
}

// Criterio 1: el reporte contable consolidado de UNA planilla mensual, por cuenta contable y centro de
// costo. Se acepta con la planilla APROBADA o CERRADA, no solo CERRADA: el criterio 1 dice "periodo
// cerrado", pero el criterio 2 pide mostrar el estado de conciliación (registrado, pendiente o con error) de
// cada asiento, y una planilla CERRADA, por definición, ya tiene ambas confirmaciones en CONFIRMADA — nunca
// podría mostrar "pendiente" ni "con error". Aceptar APROBADA es lo que hace posible el criterio 2; en
// BORRADOR sí se rechaza, porque ahí los montos todavía pueden cambiar y no hay nada que conciliar.
async function generarPlanilla(periodo, identidad = {}) {
  await autorizar(identidad);
  if (!PERIODO_RE.test(periodo ?? "")) {
    throw new ErrorApp(400, "Filtros inválidos", [{ campo: "periodo", mensaje: "Use el formato AAAA-MM." }]);
  }
  const planilla = (await planillasModelo.listar(periodo))[0];
  if (!planilla) throw new ErrorApp(404, `No existe una planilla para el periodo ${periodo}.`);
  if (planilla.estado === "BORRADOR") throw noCerrado(`La planilla de ${periodo}`);
  const [filasConceptos, filasPasivos] = await Promise.all([
    planillasModelo.conceptosPorCentroDeCosto(pool, planilla.id_planilla),
    planillasModelo.pasivosPorCentroDeCosto(pool, planilla.id_planilla),
  ]);
  return construirReportePlanilla({ planilla, filasConceptos, filasPasivos });
}

async function generarAguinaldo(gestion, identidad = {}) {
  await autorizar(identidad);
  const gestionValidada = validarGestion(gestion);
  const aguinaldo = (await aguinaldoModelo.listar()).find((a) => a.gestion === gestionValidada);
  if (!aguinaldo) throw new ErrorApp(404, `No existe una planilla de aguinaldos para la gestión ${gestionValidada}.`);
  if (aguinaldo.estado === "BORRADOR") throw noCerrado(`La planilla de aguinaldos de la gestión ${gestionValidada}`);
  const filasPorCentro = await aguinaldoModelo.montosPorCentroDeCosto(pool, aguinaldo.id_aguinaldo);
  return construirReporteAguinaldo({ aguinaldo, filasPorCentro });
}

module.exports = { generarPlanilla, generarAguinaldo };
