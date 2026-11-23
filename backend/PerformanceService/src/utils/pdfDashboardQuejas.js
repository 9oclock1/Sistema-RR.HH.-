const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

const ANCHO = 595.28;
const ALTO = 841.89;
const MARGEN = 48;
const ANCHO_UTIL = ANCHO - MARGEN * 2;
const TAMANO = 9;
const INTERLINEADO = 14;

const COLOR_TEXTO = rgb(0.16, 0.16, 0.18);
const COLOR_SUTIL = rgb(0.42, 0.43, 0.46);
const COLOR_LINEA = rgb(0.83, 0.84, 0.86);
const COLOR_ENCABEZADO = rgb(0.94, 0.95, 0.96);
const COLORES_SEMAFORO = {
  VERDE: rgb(0.13, 0.63, 0.42),
  AMARILLO: rgb(0.5, 0.37, 0.0),
  ROJO: rgb(0.68, 0.18, 0.14),
};
const TEXTOS_SEMAFORO = { VERDE: "Cumple la meta", AMARILLO: "Cerca de la meta", ROJO: "No cumple la meta" };
const NOMBRES_MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const decimales = new Intl.NumberFormat("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatear = (valor) => (valor === null || valor === undefined ? "—" : decimales.format(valor));
const formatearPorcentaje = (valor) => (valor === null || valor === undefined ? "—" : `${decimales.format(valor)} %`);
const formatearDias = (valor) => (valor === null || valor === undefined ? "—" : `${decimales.format(valor)} días`);

const limpiar = (texto) =>
  Array.from(String(texto ?? ""))
    .map((caracter) => (caracter === "—" ? "-" : caracter.charCodeAt(0) <= 255 ? caracter : "?"))
    .join("");

const etiquetaMes = (mes) => `${NOMBRES_MES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`;

const formatearFecha = (fecha) => fecha.split("-").reverse().join("/");

async function construirPdfDashboardQuejas(tablero, { generadoEn, categoria, sucursal }) {
  const documento = await PDFDocument.create();
  const normal = await documento.embedFont(StandardFonts.Helvetica);
  const negrita = await documento.embedFont(StandardFonts.HelveticaBold);
  documento.setTitle("Dashboard de quejas internas");
  documento.setCreator("Sistema de RR. HH.");

  let pagina = documento.addPage([ANCHO, ALTO]);
  let y = ALTO - MARGEN;

  const asegurarEspacio = (alto) => {
    if (y - alto >= MARGEN) return;
    pagina = documento.addPage([ANCHO, ALTO]);
    y = ALTO - MARGEN;
  };

  const texto = (contenido, { x = MARGEN, tamano = TAMANO, fuente = normal, color = COLOR_TEXTO } = {}) => {
    pagina.drawText(limpiar(contenido), { x, y, size: tamano, font: fuente, color });
  };

  const lineaDeTexto = (contenido, opciones = {}) => {
    asegurarEspacio(INTERLINEADO);
    texto(contenido, opciones);
    y -= opciones.tamano ? opciones.tamano + 5 : INTERLINEADO;
  };

  const titulo = (contenido) => {
    asegurarEspacio(34);
    y -= 12;
    texto(contenido, { tamano: 12, fuente: negrita });
    y -= 6;
    pagina.drawLine({ start: { x: MARGEN, y }, end: { x: ANCHO - MARGEN, y }, thickness: 0.75, color: COLOR_LINEA });
    y -= 14;
  };

  const tabla = (columnas, filas) => {
    const total = columnas.reduce((suma, columna) => suma + columna.ancho, 0);
    const anchos = columnas.map((columna) => (columna.ancho / total) * ANCHO_UTIL);
    const dibujarFila = (celdas, { encabezado = false } = {}) => {
      asegurarEspacio(INTERLINEADO + 6);
      if (encabezado) {
        pagina.drawRectangle({ x: MARGEN, y: y - 4, width: ANCHO_UTIL, height: INTERLINEADO, color: COLOR_ENCABEZADO });
      }
      let x = MARGEN;
      celdas.forEach((celda, indice) => {
        const fuente = encabezado ? negrita : normal;
        const disponible = anchos[indice] - 8;
        let contenido = limpiar(celda.texto ?? celda);
        if (fuente.widthOfTextAtSize(contenido, TAMANO) > disponible) {
          while (contenido.length > 1 && fuente.widthOfTextAtSize(`${contenido}...`, TAMANO) > disponible) {
            contenido = contenido.slice(0, -1);
          }
          contenido = `${contenido}...`;
        }
        const anchoTexto = fuente.widthOfTextAtSize(contenido, TAMANO);
        pagina.drawText(contenido, {
          x: columnas[indice].alinear === "fin" ? x + anchos[indice] - anchoTexto - 4 : x + 4,
          y,
          size: TAMANO,
          font: fuente,
          color: celda.color ?? COLOR_TEXTO,
        });
        x += anchos[indice];
      });
      y -= INTERLINEADO;
      pagina.drawLine({ start: { x: MARGEN, y: y + 6 }, end: { x: ANCHO - MARGEN, y: y + 6 }, thickness: 0.4, color: COLOR_LINEA });
    };
    dibujarFila(columnas.map((columna) => columna.titulo), { encabezado: true });
    for (const fila of filas) dibujarFila(fila);
    y -= 4;
  };

  const celdaSemaforo = (codigo) => ({ texto: TEXTOS_SEMAFORO[codigo] ?? "Sin datos", color: COLORES_SEMAFORO[codigo] ?? COLOR_SUTIL });

  texto("Dashboard de quejas internas", { tamano: 18, fuente: negrita });
  y -= 22;
  lineaDeTexto(`Periodo: del ${formatearFecha(tablero.periodo.desde)} al ${formatearFecha(tablero.periodo.hasta)}`, { color: COLOR_SUTIL });
  lineaDeTexto(`Categoría: ${categoria ?? "Todas"}   ·   Sucursal: ${sucursal ?? "Todas"}`, { color: COLOR_SUTIL });
  lineaDeTexto(`Generado el ${generadoEn}`, { color: COLOR_SUTIL });

  titulo("Indicadores del periodo");
  const { tasa_resolucion: tasa, tiempo_promedio: tiempo } = tablero.kpis;
  tabla(
    [
      { titulo: "Indicador", ancho: 40 },
      { titulo: "Valor", ancho: 15, alinear: "fin" },
      { titulo: "Meta", ancho: 15, alinear: "fin" },
      { titulo: "Semáforo", ancho: 30 },
    ],
    [
      [`${tasa.codigo} ${tasa.nombre}`, formatearPorcentaje(tasa.valor), `>= ${formatearPorcentaje(tasa.meta)}`, celdaSemaforo(tasa.semaforo)],
      [`${tiempo.codigo} ${tiempo.nombre}`, formatearDias(tiempo.valor), `<= ${formatearDias(tiempo.meta)}`, celdaSemaforo(tiempo.semaforo)],
    ],
  );
  const { resumen } = tablero;
  lineaDeTexto(
    `Quejas recibidas: ${resumen.quejas_recibidas}   ·   Resueltas: ${resumen.quejas_resueltas}   ·   Anónimas: ${resumen.quejas_anonimas}   ·   Identificadas: ${resumen.quejas_identificadas}`,
    { color: COLOR_SUTIL },
  );

  titulo("Tendencia mensual");
  tabla(
    [
      { titulo: "Mes", ancho: 16 },
      { titulo: "Recibidas", ancho: 14, alinear: "fin" },
      { titulo: "Resueltas", ancho: 14, alinear: "fin" },
      { titulo: "Tasa de resolución", ancho: 20, alinear: "fin" },
      { titulo: "Tiempo promedio", ancho: 20, alinear: "fin" },
    ],
    tablero.tendencia_mensual.map((mes) => [
      etiquetaMes(mes.mes),
      String(mes.quejas_recibidas),
      String(mes.quejas_resueltas),
      { texto: formatearPorcentaje(mes.tasa_resolucion), color: COLORES_SEMAFORO[mes.semaforo_tasa] },
      { texto: formatearDias(mes.tiempo_promedio_dias), color: COLORES_SEMAFORO[mes.semaforo_tiempo] },
    ]),
  );

  const tablaPorGrupo = (nombre, columna, grupos) => {
    titulo(nombre);
    if (grupos.length === 0) {
      lineaDeTexto("Sin quejas en el periodo.", { color: COLOR_SUTIL });
      return;
    }
    tabla(
      [
        { titulo: columna, ancho: 34 },
        { titulo: "Recibidas", ancho: 14, alinear: "fin" },
        { titulo: "% del total", ancho: 14, alinear: "fin" },
        { titulo: "Resueltas", ancho: 14, alinear: "fin" },
        { titulo: "Tasa", ancho: 12, alinear: "fin" },
        { titulo: "Días prom.", ancho: 12, alinear: "fin" },
      ],
      grupos.map((grupo) => [
        grupo.nombre,
        String(grupo.quejas_recibidas),
        formatearPorcentaje(grupo.porcentaje_del_total),
        String(grupo.quejas_resueltas),
        formatearPorcentaje(grupo.tasa_resolucion),
        formatear(grupo.tiempo_promedio_dias),
      ]),
    );
  };
  tablaPorGrupo("Quejas por categoría", "Categoría", tablero.por_categoria);
  tablaPorGrupo("Quejas por área", "Área", tablero.por_area);
  tablaPorGrupo("Quejas por sucursal", "Sucursal", tablero.por_sucursal);

  y -= 6;
  lineaDeTexto("Las quejas anónimas se cuentan sin identificar a la persona denunciante.", { color: COLOR_SUTIL, tamano: 8 });
  lineaDeTexto("La resolución se mide hasta la fecha de la resolución registrada en el historial de la queja.", {
    color: COLOR_SUTIL,
    tamano: 8,
  });

  return documento.save();
}

module.exports = { construirPdfDashboardQuejas, etiquetaMes };
