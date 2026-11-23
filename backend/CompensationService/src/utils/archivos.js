const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c >>> 0;
  }
  return tabla;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = TABLA_CRC[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function fechaZip(fecha) {
  const hora = (fecha.getHours() << 11) | (fecha.getMinutes() << 5) | Math.floor(fecha.getSeconds() / 2);
  const dia = ((fecha.getFullYear() - 1980) << 9) | ((fecha.getMonth() + 1) << 5) | fecha.getDate();
  return { hora, dia };
}

function crearZip(archivos, ahora = new Date()) {
  const { hora, dia } = fechaZip(ahora);
  const locales = [];
  const centrales = [];
  let desplazamiento = 0;

  for (const archivo of archivos) {
    const nombre = Buffer.from(archivo.nombre, "utf8");
    const contenido = Buffer.isBuffer(archivo.contenido) ? archivo.contenido : Buffer.from(archivo.contenido, "utf8");
    const crc = crc32(contenido);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(hora, 10);
    local.writeUInt16LE(dia, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(contenido.length, 18);
    local.writeUInt32LE(contenido.length, 22);
    local.writeUInt16LE(nombre.length, 26);
    local.writeUInt16LE(0, 28);
    locales.push(local, nombre, contenido);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(hora, 12);
    central.writeUInt16LE(dia, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(contenido.length, 20);
    central.writeUInt32LE(contenido.length, 24);
    central.writeUInt16LE(nombre.length, 28);
    central.writeUInt32LE(desplazamiento, 42);
    centrales.push(central, nombre);

    desplazamiento += local.length + nombre.length + contenido.length;
  }

  const directorio = Buffer.concat(centrales);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(archivos.length, 8);
  fin.writeUInt16LE(archivos.length, 10);
  fin.writeUInt32LE(directorio.length, 12);
  fin.writeUInt32LE(desplazamiento, 16);
  return Buffer.concat([...locales, directorio, fin]);
}

const escaparXml = (texto) =>
  String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

const letraColumna = (indice) => {
  let numero = indice + 1;
  let letras = "";
  while (numero > 0) {
    const resto = (numero - 1) % 26;
    letras = String.fromCharCode(65 + resto) + letras;
    numero = Math.floor((numero - 1) / 26);
  }
  return letras;
};

const ESTILO = { NORMAL: 0, ENCABEZADO: 1, MONTO: 2, TOTAL: 3 };

function celda(columna, fila, valor, estilo) {
  const referencia = `${letraColumna(columna)}${fila}`;
  if (valor === null || valor === undefined || valor === "") return `<c r="${referencia}" s="${estilo}"/>`;
  if (typeof valor === "number") return `<c r="${referencia}" s="${estilo}"><v>${valor}</v></c>`;
  return `<c r="${referencia}" s="${estilo}" t="inlineStr"><is><t xml:space="preserve">${escaparXml(valor)}</t></is></c>`;
}

const ESTILOS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE9EAEC"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
</cellXfs>
</styleSheet>`;

function construirXlsx({ hoja, columnas, filas, pie = null }) {
  const nombreHoja = escaparXml(hoja.slice(0, 31).replace(/[\\/?*[\]:]/g, " "));
  const filasXml = [];
  filasXml.push(
    `<row r="1">${columnas.map((columna, i) => celda(i, 1, columna.titulo, ESTILO.ENCABEZADO)).join("")}</row>`
  );
  filas.forEach((fila, indice) => {
    const numero = indice + 2;
    const celdas = columnas.map((columna, i) => celda(i, numero, fila[columna.clave], columna.monto ? ESTILO.MONTO : ESTILO.NORMAL));
    filasXml.push(`<row r="${numero}">${celdas.join("")}</row>`);
  });
  if (pie) {
    const numero = filas.length + 3;
    const celdas = columnas.map((columna, i) => celda(i, numero, pie[columna.clave], columna.monto ? ESTILO.TOTAL : ESTILO.ENCABEZADO));
    filasXml.push(`<row r="${numero}">${celdas.join("")}</row>`);
  }

  const anchos = columnas.map((columna, i) => `<col min="${i + 1}" max="${i + 1}" width="${columna.ancho ?? 16}" customWidth="1"/>`).join("");
  const hojaXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${anchos}</cols><sheetData>${filasXml.join("")}</sheetData></worksheet>`;

  return crearZip([
    {
      nombre: "[Content_Types].xml",
      contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    },
    {
      nombre: "_rels/.rels",
      contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      nombre: "xl/workbook.xml",
      contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${nombreHoja}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      nombre: "xl/_rels/workbook.xml.rels",
      contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    { nombre: "xl/styles.xml", contenido: ESTILOS_XML },
    { nombre: "xl/worksheets/sheet1.xml", contenido: hojaXml },
  ]);
}

const limpiarCampoTxt = (valor) =>
  String(valor ?? "")
    .replace(/[|\r\n\t]+/g, " ")
    .trim();

function construirTxt({ columnas, filas, pie = null }) {
  const formatear = (columna, valor) => (typeof valor === "number" && columna.monto ? valor.toFixed(2) : limpiarCampoTxt(valor));
  const lineas = [columnas.map((columna) => columna.titulo.toUpperCase().replace(/\s+/g, "_")).join("|")];
  for (const fila of filas) lineas.push(columnas.map((columna) => formatear(columna, fila[columna.clave])).join("|"));
  if (pie) lineas.push(columnas.map((columna) => formatear(columna, pie[columna.clave])).join("|"));
  return Buffer.from(`${lineas.join("\r\n")}\r\n`, "utf8");
}

module.exports = { crc32, crearZip, construirXlsx, construirTxt, escaparXml, letraColumna };
