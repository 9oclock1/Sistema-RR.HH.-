const { test } = require("node:test");
const assert = require("node:assert/strict");
const { aDetalle, resumirPorEntidad, resumirTotales, separarRenglones } = require("../src/utils/aportesPlanilla");
const { crc32, crearZip, construirTxt, construirXlsx, escaparXml, letraColumna } = require("../src/utils/archivos");
const { FORMATOS, elegirFormato, exigirResponsable, nombreMes } = require("../src/utils/planillasFiscales");

const renglon = (extra) => ({
  id_empleado: "e1",
  nombre_empleado: "Ana Pérez",
  numero_documento: "123",
  codigo: "SIP-VEJEZ",
  nombre: "Aporte vejez",
  tipo: "DESCUENTO",
  codigo_entidad: "LARGO_PLAZO",
  id_vigencia: "v1",
  base: 1000,
  valor: 10,
  resultado: 100,
  ...extra,
});

const ENTIDADES = [
  { codigo: "LARGO_PLAZO", nombre: "Largo plazo", formato_archivo: "TXT" },
  { codigo: "CAJA_SALUD", nombre: "Caja de salud", formato_archivo: "XLSX" },
];

const preparar = (renglones) => separarRenglones(renglones).asignados.map(aDetalle);

test("los descuentos son aportes laborales y los aportes son patronales", () => {
  const { asignados } = separarRenglones([renglon(), renglon({ codigo: "CNS-SALUD", tipo: "APORTE", codigo_entidad: "CAJA_SALUD", resultado: 100 })]);
  assert.deepEqual(
    asignados.map((r) => r.tipo_aporte),
    ["LABORAL", "PATRONAL"],
  );
});

test("un concepto de ley sin entidad queda fuera de los archivos y se advierte una vez", () => {
  const sueltos = [
    renglon({ codigo: "OTRO", nombre: "Otro aporte", codigo_entidad: null, resultado: 12.5 }),
    renglon({ id_empleado: "e2", codigo: "OTRO", nombre: "Otro aporte", codigo_entidad: null, resultado: 7.25 }),
  ];
  const { asignados, advertencias } = separarRenglones([renglon(), ...sueltos]);
  assert.equal(asignados.length, 1);
  assert.equal(advertencias.length, 1);
  assert.match(advertencias[0], /OTRO/);
  assert.match(advertencias[0], /19\.75/);
});

test("el detalle conserva el porcentaje que se usó en el periodo", () => {
  const abril = aDetalle({ ...renglon({ valor: 10, resultado: 100 }), tipo_aporte: "LABORAL" });
  const mayo = aDetalle({ ...renglon({ valor: 11, resultado: 110, id_vigencia: "v2" }), tipo_aporte: "LABORAL" });
  assert.equal(abril.tasa, 10);
  assert.equal(abril.id_vigencia, "v1");
  assert.equal(mayo.tasa, 11);
  assert.equal(mayo.id_vigencia, "v2");
  assert.notEqual(abril.monto, mayo.monto);
});

test("los totales separan lo laboral de lo patronal y cuentan colaboradores", () => {
  const detalles = preparar([
    renglon({ resultado: 100.1 }),
    renglon({ codigo: "SIP-RIESGO", resultado: 17.1 }),
    renglon({ id_empleado: "e2", codigo: "CNS-SALUD", tipo: "APORTE", codigo_entidad: "CAJA_SALUD", resultado: 100.2 }),
  ]);
  const totales = resumirTotales(detalles);
  assert.equal(totales.cantidad_empleados, 2);
  assert.equal(totales.total_laboral, 117.2);
  assert.equal(totales.total_patronal, 100.2);
});

test("el resumen por entidad no mezcla los montos de otras entidades", () => {
  const detalles = preparar([
    renglon({ resultado: 100 }),
    renglon({ id_empleado: "e2", codigo: "CNS-SALUD", tipo: "APORTE", codigo_entidad: "CAJA_SALUD", resultado: 50 }),
    renglon({ id_empleado: "e3", codigo: "CNS-SALUD", tipo: "APORTE", codigo_entidad: "CAJA_SALUD", resultado: 30 }),
  ]);
  const [largo, caja] = resumirPorEntidad(detalles, ENTIDADES);
  assert.deepEqual([largo.empleados, largo.total_laboral, largo.total_patronal, largo.total], [1, 100, 0, 100]);
  assert.deepEqual([caja.empleados, caja.total_laboral, caja.total_patronal, caja.total], [2, 0, 80, 80]);
});

test("una entidad sin aportes aparece con ceros", () => {
  const [, caja] = resumirPorEntidad(preparar([renglon()]), ENTIDADES);
  assert.equal(caja.empleados, 0);
  assert.equal(caja.total, 0);
});

test("crc32 coincide con el valor de referencia", () => {
  assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926);
});

function leerZip(buffer) {
  const fin = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(fin >= 0, "falta el registro final del ZIP");
  const cantidad = buffer.readUInt16LE(fin + 10);
  let posicion = buffer.readUInt32LE(fin + 16);
  const entradas = [];
  for (let i = 0; i < cantidad; i += 1) {
    assert.equal(buffer.readUInt32LE(posicion), 0x02014b50);
    const crc = buffer.readUInt32LE(posicion + 16);
    const tamano = buffer.readUInt32LE(posicion + 24);
    const largoNombre = buffer.readUInt16LE(posicion + 28);
    const desplazamiento = buffer.readUInt32LE(posicion + 42);
    const nombre = buffer.subarray(posicion + 46, posicion + 46 + largoNombre).toString("utf8");
    const inicio = desplazamiento + 30 + buffer.readUInt16LE(desplazamiento + 26) + buffer.readUInt16LE(desplazamiento + 28);
    entradas.push({ nombre, crc, contenido: buffer.subarray(inicio, inicio + tamano) });
    posicion += 46 + largoNombre;
  }
  return entradas;
}

test("crearZip guarda cada archivo con su nombre, contenido y CRC", () => {
  const zip = crearZip([
    { nombre: "a.txt", contenido: "hola" },
    { nombre: "dir/ñ.txt", contenido: Buffer.from("mundo") },
  ]);
  const entradas = leerZip(zip);
  assert.deepEqual(
    entradas.map((e) => e.nombre),
    ["a.txt", "dir/ñ.txt"],
  );
  assert.equal(entradas[0].contenido.toString(), "hola");
  assert.equal(entradas[1].contenido.toString(), "mundo");
  for (const e of entradas) assert.equal(e.crc, crc32(e.contenido));
});

const COLUMNAS = [
  { clave: "nombre", titulo: "Nombre" },
  { clave: "monto", titulo: "Monto total", monto: true },
];

test("el TXT usa barras verticales, saltos CRLF, encabezado y total", () => {
  const txt = construirTxt({
    columnas: COLUMNAS,
    filas: [
      { nombre: "Ana|Pérez", monto: 100 },
      { nombre: "Luis", monto: 17.1 },
    ],
    pie: { nombre: "TOTAL", monto: 117.1 },
  }).toString("utf8");
  assert.equal(txt, "NOMBRE|MONTO_TOTAL\r\nAna Pérez|100.00\r\nLuis|17.10\r\nTOTAL|117.10\r\n");
});

test("el XLSX es un paquete válido con las filas y el total", () => {
  const xlsx = construirXlsx({
    hoja: "LARGO PLAZO",
    columnas: COLUMNAS,
    filas: [{ nombre: "Ana & <Co>", monto: 100 }],
    pie: { nombre: "TOTAL", monto: 100 },
  });
  const entradas = leerZip(xlsx);
  const nombres = entradas.map((e) => e.nombre);
  for (const requerido of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/styles.xml", "xl/worksheets/sheet1.xml"]) {
    assert.ok(nombres.includes(requerido), `falta ${requerido}`);
  }
  const hoja = entradas.find((e) => e.nombre === "xl/worksheets/sheet1.xml").contenido.toString();
  assert.match(hoja, /Ana &amp; &lt;Co&gt;/);
  assert.match(hoja, /<c r="B2" s="2"><v>100<\/v><\/c>/);
  assert.doesNotMatch(hoja, /<row r="3">/);
  assert.match(hoja, /<c r="B4" s="3"><v>100<\/v><\/c>/);
  assert.match(entradas.find((e) => e.nombre === "xl/workbook.xml").contenido.toString(), /name="LARGO PLAZO"/);
});

test("escaparXml y letraColumna", () => {
  assert.equal(escaparXml('a&b<c>"d"\u0001'), "a&amp;b&lt;c&gt;&quot;d&quot;");
  assert.deepEqual([0, 25, 26, 27, 701, 702].map(letraColumna), ["A", "Z", "AA", "AB", "ZZ", "AAA"]);
});

test("elegirFormato valida el formato pedido y usa el de la entidad por defecto", () => {
  assert.equal(elegirFormato(undefined, "txt"), "txt");
  assert.equal(elegirFormato("", "xlsx"), "xlsx");
  assert.equal(elegirFormato(" XLSX ", "txt"), "xlsx");
  assert.throws(() => elegirFormato("pdf", "txt"), (e) => e.estado === 400);
  assert.equal(FORMATOS.xlsx.extension, "xlsx");
});

test("solo el administrador de RRHH y el contador acceden a las planillas fiscales", () => {
  for (const rol of ["admin", "Contador", " contador "]) assert.doesNotThrow(() => exigirResponsable({ rol }));
  for (const rol of ["gerente", "supervisor", "empleado", "auditor", "", undefined]) {
    assert.throws(() => exigirResponsable({ rol }), (e) => e.estado === 403);
  }
  assert.throws(() => exigirResponsable(), (e) => e.estado === 403);
});

test("nombreMes escribe el mes en español", () => {
  assert.match(nombreMes("2026-05"), /mayo/i);
});
