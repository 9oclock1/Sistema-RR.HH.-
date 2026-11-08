const modelo = require("../models/conceptos.model");
const { enTransaccion } = require("../config/transaccion");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const { esFecha, hoyLaPaz } = require("../utils/fechas");
const { TIPOS, validarConcepto, validarEdicion, validarVigencia, cierreDeUltima } = require("../utils/conceptos");

const noEncontrado = () => new ErrorApp(404, "Concepto no encontrado");

// BONO-ANTIGUEDAD no admite vigencias manuales: su porcentaje depende exclusivamente del tramo de
// TRAMOS_ANTIGUEDAD vigente para los años de servicio del colaborador (ver antiguedad.service.js).
// Permitir una vigencia aquí dejaría un valor "fantasma" en la pantalla de Conceptos que nunca se usa
// para calcular el bono, contradiciendo la escala legal.
const CODIGOS_CON_PORCENTAJE_EXTERNO = new Set(["BONO-ANTIGUEDAD"]);

function traducirErrorBD(error) {
  if (error.code === "23505") {
    throw new ErrorApp(409, "Ya existe un concepto con ese código", [
      { campo: "codigo", mensaje: "Ya existe un concepto con ese código." },
    ]);
  }
  if (error.code === "23P01") {
    throw new ErrorApp(409, "La vigencia se cruza con otra del mismo concepto", [
      { campo: "vigente_desde", mensaje: "Se cruza con otra vigencia del concepto." },
    ]);
  }
  throw error;
}

const formatear = ({ id_vigencia, valor, vigente_desde, vigente_hasta, proximo_valor, proximo_desde, ...c }) => ({
  ...c,
  vigencia: id_vigencia ? { id_vigencia, valor, vigente_desde, vigente_hasta } : null,
  proxima_vigencia: proximo_desde ? { valor: proximo_valor, vigente_desde: proximo_desde } : null,
});

async function buscar(id) {
  const concepto = UUID_RE.test(id) ? await modelo.obtener(id, hoyLaPaz()) : undefined;
  if (!concepto) throw noEncontrado();
  return concepto;
}

// vigentes_en: solo los conceptos activos con valor en esa fecha, con su cuenta contable (para planillas).
async function listar({ tipo, activo, vigentes_en } = {}) {
  const errores = [];
  if (tipo !== undefined && !TIPOS.includes(tipo)) {
    errores.push({ campo: "tipo", mensaje: "Use INGRESO, DESCUENTO o APORTE." });
  }
  if (activo !== undefined && activo !== "true" && activo !== "false") {
    errores.push({ campo: "activo", mensaje: "Use true o false." });
  }
  if (vigentes_en !== undefined && !esFecha(vigentes_en)) {
    errores.push({ campo: "vigentes_en", mensaje: "Use el formato AAAA-MM-DD." });
  }
  if (errores.length > 0) throw new ErrorApp(400, "Filtros inválidos", errores);

  const filas = await modelo.listar({
    fecha: vigentes_en ?? hoyLaPaz(),
    tipo,
    activo: vigentes_en ? true : activo === undefined ? undefined : activo === "true",
    soloVigentes: Boolean(vigentes_en),
  });
  return filas.map(formatear);
}

async function obtener(id) {
  const concepto = await buscar(id);
  return { ...formatear(concepto), vigencias: await modelo.listarVigencias(id) };
}

async function crear(datos) {
  const { concepto, vigencia } = validarConcepto(datos);
  const id = await enTransaccion(async (cliente) => {
    const nuevo = await modelo.crear(cliente, concepto);
    await modelo.crearVigencia(cliente, nuevo, vigencia);
    return nuevo;
  }).catch(traducirErrorBD);
  return obtener(id);
}

async function actualizar(id, datos = {}) {
  const actual = await buscar(id);
  const errores = [];
  for (const campo of ["tipo", "forma_calculo"]) {
    if (datos[campo] !== undefined && datos[campo] !== actual[campo]) {
      errores.push({ campo, mensaje: "No se puede cambiar después de crear el concepto." });
    }
  }
  if (errores.length > 0) throw new ErrorApp(400, "Datos del concepto inválidos", errores);

  const cambios = validarEdicion(datos, actual.forma_calculo);
  const editados = await modelo.actualizar(id, cambios).catch(traducirErrorBD);
  if (!editados) throw noEncontrado();
  return obtener(id);
}

async function cambiarEstado(id, { esta_activo } = {}) {
  if (!UUID_RE.test(id)) throw noEncontrado();
  if (typeof esta_activo !== "boolean") {
    throw new ErrorApp(400, "Datos inválidos", [{ campo: "esta_activo", mensaje: "Use true o false." }]);
  }
  if (!(await modelo.cambiarEstado(id, esta_activo))) throw noEncontrado();
  return obtener(id);
}

// Un concepto usado en una planilla queda referenciado por ella: solo se puede inactivar.
async function eliminar(id) {
  if (!UUID_RE.test(id)) throw noEncontrado();
  let eliminados;
  try {
    eliminados = await modelo.eliminar(id);
  } catch (error) {
    if (error.code !== "23503") throw error;
    throw new ErrorApp(409, "El concepto ya se usó en una planilla: solo se puede inactivar.");
  }
  if (!eliminados) throw noEncontrado();
}

async function agregarVigencia(id, datos) {
  if (!UUID_RE.test(id)) throw noEncontrado();
  await enTransaccion(async (cliente) => {
    const concepto = await modelo.bloquear(cliente, id);
    if (!concepto) throw noEncontrado();
    if (CODIGOS_CON_PORCENTAJE_EXTERNO.has(concepto.codigo)) {
      throw new ErrorApp(409, "Este concepto no admite vigencias manuales", [
        {
          campo: "valor",
          mensaje: "El porcentaje del bono de antigüedad depende de la escala legal vigente. Adminístrelo desde la pantalla de Antigüedad.",
        },
      ]);
    }
    const vigencia = validarVigencia(datos, concepto.forma_calculo);
    const ultima = await modelo.ultimaVigencia(cliente, id);
    const cierre = cierreDeUltima(ultima, vigencia);
    if (cierre) await modelo.cerrarVigencia(cliente, ultima.id_vigencia, cierre);
    await modelo.crearVigencia(cliente, id, vigencia);
  }).catch(traducirErrorBD);
  return obtener(id);
}

module.exports = {
  traducirErrorBD,
  formatear,
  listar,
  obtener,
  crear,
  actualizar,
  cambiarEstado,
  eliminar,
  agregarVigencia,
};
