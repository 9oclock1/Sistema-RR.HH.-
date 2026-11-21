const modelo = require("../models/boletas.model");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const { armarContenido, calcularHash, validarIdentidad, puedeVer } = require("../utils/boletas");
const { aPdf, nombreMes } = require("./boletaPdf");

const noEncontrada = () => new ErrorApp(404, "Boleta de pago no encontrada");

// Emite las boletas de las planillas cerradas del colaborador que todavía no la tienen.
async function emitirPendientes(idEmpleado) {
  for (const fila of await modelo.pendientesDeEmitir(idEmpleado)) {
    await modelo.emitir(fila, calcularHash(armarContenido(fila)));
  }
}

const formatearResumen = (b) => ({
  id_boleta: b.id_boleta,
  periodo: b.periodo,
  emitida_en: b.emitida_en,
  cerrada_en: b.cerrada_en,
  descargas: b.descargas,
  ultima_descarga_en: b.ultima_descarga_en,
  totales: { total_ganado: b.total_ganado, total_descuentos: b.total_descuentos, liquido_pagable: b.liquido_pagable },
});

// Criterios 1 y 4: las boletas del colaborador, solo de planillas cerradas, de la más reciente a la más antigua.
async function listar(identidad) {
  const { idEmpleado } = validarIdentidad(identidad);
  await emitirPendientes(idEmpleado);
  return (await modelo.listar(idEmpleado)).map(formatearResumen);
}

// Criterio 3: solo el dueño (o RRHH) ve la boleta. El contenido se vuelve a calcular y debe coincidir con el
// hash guardado al emitirla.
async function obtenerVerificada(id, identidad) {
  const quien = validarIdentidad(identidad);
  const fila = UUID_RE.test(id ?? "") ? await modelo.obtener(id) : undefined;
  if (!fila || fila.estado !== "CERRADA") throw noEncontrada();
  if (!puedeVer(quien, fila)) {
    throw new ErrorApp(403, "Solo puede consultar sus propias boletas de pago.");
  }
  const contenido = armarContenido(fila);
  if (calcularHash(contenido) !== fila.hash_contenido) {
    console.error(`Boleta ${fila.id_boleta}: el contenido no coincide con el hash registrado al emitirla.`);
    throw new ErrorApp(
      409,
      `La boleta de ${nombreMes(fila.periodo).toLowerCase()} no coincide con la planilla cerrada: comuníquese con RRHH.`
    );
  }
  return {
    id_boleta: fila.id_boleta,
    codigo_verificacion: fila.hash_contenido,
    emitida_en: fila.emitida_en,
    cerrada_en: fila.cerrada_en,
    descargas: fila.descargas,
    ultima_descarga_en: fila.ultima_descarga_en,
    ...contenido,
  };
}

// Criterio 2: el PDF se arma con el mismo contenido verificado; cada descarga queda registrada.
async function descargarPdf(id, identidad) {
  const boleta = await obtenerVerificada(id, identidad);
  const archivo = await aPdf(boleta);
  await modelo.registrarDescarga(boleta.id_boleta);
  return archivo;
}

module.exports = { listar, obtener: obtenerVerificada, descargarPdf };
