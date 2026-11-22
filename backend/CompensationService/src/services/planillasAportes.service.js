const pool = require("../config/db");
const { enTransaccion } = require("../config/transaccion");
const modelo = require("../models/planillasAportes.model");
const { ErrorApp } = require("../utils/errores");
const { validarResponsable } = require("../utils/planillas");
const { aDetalle, resumirPorEntidad, resumirTotales, separarRenglones } = require("../utils/aportesPlanilla");
const { construirTxt, construirXlsx, crearZip } = require("../utils/archivos");
const {
  FORMATOS,
  cargarPlanilla,
  cargarPlanillaCerrada,
  elegirFormato,
  exigirAdministrador,
  nombreDelResponsable,
  nombreMes,
  sinGenerar,
} = require("../utils/planillasFiscales");

const COLUMNAS_ARCHIVO = [
  { clave: "numero_documento", titulo: "Documento", ancho: 14 },
  { clave: "nombre_empleado", titulo: "Nombre", ancho: 30 },
  { clave: "codigo_concepto", titulo: "Concepto", ancho: 20 },
  { clave: "nombre_concepto", titulo: "Descripcion", ancho: 44 },
  { clave: "tipo", titulo: "Tipo", ancho: 11 },
  { clave: "base", titulo: "Base", ancho: 14, monto: true },
  { clave: "tasa", titulo: "Tasa", ancho: 9, monto: true },
  { clave: "monto", titulo: "Monto", ancho: 14, monto: true },
];

async function formatear({ cabecera, detalles }) {
  const entidades = await modelo.listarEntidades(pool);
  return {
    id_planilla_aportes: cabecera.id_planilla_aportes,
    id_planilla: cabecera.id_planilla,
    periodo: cabecera.periodo,
    totales: {
      cantidad_empleados: cabecera.cantidad_empleados,
      total_laboral: cabecera.total_laboral,
      total_patronal: cabecera.total_patronal,
      total: Math.round((cabecera.total_laboral + cabecera.total_patronal) * 100) / 100,
    },
    entidades: resumirPorEntidad(detalles, entidades),
    advertencias: cabecera.advertencias,
    generada_por: cabecera.generada_por,
    generada_por_nombre: cabecera.generada_por_nombre,
    generada_en: cabecera.generada_en,
    detalle: detalles,
  };
}

async function generar(idPlanilla, identidad) {
  const idResponsable = validarResponsable(identidad);
  const planilla = await cargarPlanillaCerrada(pool, idPlanilla);

  const entidades = await modelo.listarEntidades(pool);
  if (entidades.length === 0) {
    throw new ErrorApp(409, "No hay entidades de aporte configuradas: no se puede armar la planilla de aportes.", undefined, "SIN_ENTIDADES");
  }
  const renglones = await modelo.listarRenglones(pool, planilla.id_planilla);
  const { asignados, advertencias } = separarRenglones(renglones);
  if (asignados.length === 0) {
    throw new ErrorApp(
      409,
      `La planilla de ${nombreMes(planilla.periodo)} no tiene aportes de ley asociados a una entidad.`,
      undefined,
      "SIN_APORTES"
    );
  }
  const detalles = asignados.map(aDetalle);
  const responsable = { id: idResponsable, nombre: await nombreDelResponsable(idResponsable) };

  await enTransaccion((cliente) =>
    modelo.reemplazar(cliente, { planilla, totales: resumirTotales(detalles), advertencias, responsable, detalles })
  );
  return formatear(await modelo.obtenerGuardada(pool, planilla.id_planilla));
}

async function obtener(idPlanilla, identidad) {
  exigirAdministrador(identidad);
  const planilla = await cargarPlanilla(pool, idPlanilla);
  const guardada = await modelo.obtenerGuardada(pool, planilla.id_planilla);
  if (!guardada) throw sinGenerar("la planilla de aportes", planilla.periodo);
  return formatear(guardada);
}

function archivoDeEntidad(planilla, entidad, formato) {
  const filas = planilla.detalle.filter((fila) => fila.codigo_entidad === entidad.codigo);
  const total = Math.round(filas.reduce((suma, fila) => suma + Math.round(fila.monto * 100), 0)) / 100;
  const pie = { numero_documento: "", nombre_empleado: "TOTAL", monto: total };
  const contenido =
    formato === "xlsx"
      ? construirXlsx({ hoja: entidad.codigo.replace(/_/g, " "), columnas: COLUMNAS_ARCHIVO, filas, pie })
      : construirTxt({ columnas: COLUMNAS_ARCHIVO, filas, pie });
  return { nombreArchivo: `aportes-${entidad.codigo}-${planilla.periodo}.${FORMATOS[formato].extension}`, contenido, filas: filas.length };
}

async function exportar(idPlanilla, identidad, { entidad: codigo, formato: formatoPedido } = {}) {
  const planilla = await obtener(idPlanilla, identidad);

  if (codigo) {
    const entidad = planilla.entidades.find((e) => e.codigo === String(codigo).trim().toUpperCase());
    if (!entidad) {
      throw new ErrorApp(400, "La entidad indicada no existe.", [{ campo: "entidad", mensaje: "Entidad desconocida." }]);
    }
    const formato = elegirFormato(formatoPedido, entidad.formato_archivo.toLowerCase());
    const archivo = archivoDeEntidad(planilla, entidad, formato);
    return { nombreArchivo: archivo.nombreArchivo, tipo: FORMATOS[formato].tipo, contenido: archivo.contenido };
  }

  const archivos = planilla.entidades
    .filter((entidad) => entidad.empleados > 0)
    .map((entidad) => archivoDeEntidad(planilla, entidad, entidad.formato_archivo.toLowerCase()));
  if (archivos.length === 0) throw new ErrorApp(409, "La planilla de aportes no tiene datos para exportar.");
  return {
    nombreArchivo: `planilla-aportes-${planilla.periodo}.zip`,
    tipo: "application/zip",
    contenido: crearZip(archivos.map((archivo) => ({ nombre: archivo.nombreArchivo, contenido: archivo.contenido }))),
  };
}

module.exports = { generar, obtener, exportar, COLUMNAS_ARCHIVO };
