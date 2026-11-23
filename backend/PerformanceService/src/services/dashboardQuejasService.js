const modelo = require("../models/dashboardQuejasModel");
const quejasModelo = require("../models/quejasModel");
const historialModelo = require("../models/historialQuejaModel");
const { construirPdfDashboardQuejas } = require("../utils/pdfDashboardQuejas");
const {
  agruparPor,
  calcularResumen,
  calcularTasaResolucion,
  calcularTendenciaMensual,
  calcularTiempoPromedio,
  leerFiltrosDashboard,
} = require("../utils/dashboardQuejas");

async function armarTablero(consulta) {
  const filtros = leerFiltrosDashboard(consulta);
  const [filas, categorias, sucursales] = await Promise.all([
    modelo.listarQuejasDelPeriodo(filtros),
    quejasModelo.listarCategorias(),
    historialModelo.listarSucursales(),
  ]);

  return {
    filtros,
    tablero: {
      periodo: { desde: filtros.desde, hasta: filtros.hasta },
      filtros: {
        categoria: filtros.idCategoria,
        sucursal: filtros.sinSucursal ? "sin" : filtros.idSucursal,
      },
      opciones: {
        categorias: categorias.map((c) => ({ id: c.id_categoria_queja, codigo: c.codigo, nombre: c.nombre })),
        sucursales: sucursales.map((s) => ({ id: s.id_sucursal, nombre: s.nombre })),
      },
      kpis: {
        tasa_resolucion: calcularTasaResolucion(filas),
        tiempo_promedio: calcularTiempoPromedio(filas),
      },
      resumen: calcularResumen(filas),
      tendencia_mensual: calcularTendenciaMensual(filas, filtros.desde, filtros.hasta),
      por_categoria: agruparPor(filas, "id_categoria_queja", "categoria", "Sin categoría"),
      por_area: agruparPor(filas, "id_departamento", "departamento", "Sin área"),
      por_sucursal: agruparPor(filas, "id_sucursal", "sucursal", "Sin sucursal"),
    },
    categorias,
    sucursales,
  };
}

async function obtenerDashboard(consulta) {
  const { tablero } = await armarTablero(consulta);
  return tablero;
}

const fechaDeGeneracion = (ahora, zona) =>
  new Intl.DateTimeFormat("es-BO", { timeZone: zona, dateStyle: "short", timeStyle: "short" }).format(ahora);

async function exportarPdf(consulta, ahora = new Date()) {
  const { tablero, filtros, categorias, sucursales } = await armarTablero(consulta);
  const categoria = categorias.find((c) => c.id_categoria_queja === filtros.idCategoria)?.nombre ?? null;
  const sucursal = filtros.sinSucursal
    ? "Sin sucursal"
    : (sucursales.find((s) => s.id_sucursal === filtros.idSucursal)?.nombre ?? null);
  const contenido = await construirPdfDashboardQuejas(tablero, {
    generadoEn: fechaDeGeneracion(ahora, filtros.zonaHoraria),
    categoria,
    sucursal,
  });
  return {
    nombreArchivo: `dashboard-quejas-${filtros.desde}_${filtros.hasta}.pdf`,
    contenido: Buffer.from(contenido),
  };
}

module.exports = { obtenerDashboard, exportarPdf };
