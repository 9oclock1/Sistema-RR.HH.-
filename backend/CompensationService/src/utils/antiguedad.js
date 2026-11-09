const { ErrorApp } = require("./errores");
const { esFecha, diaAnterior } = require("./fechas");

const MAX_TRAMOS = 20;
const MAX_ANIOS = 80;

function lanzarSiHayErrores(mensaje, errores) {
  if (errores.length > 0) throw new ErrorApp(400, mensaje, errores);
}

function validarPorcentaje(valor) {
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0 || valor > 100) {
    return "Ingrese un porcentaje mayor a 0 y hasta 100.";
  }
  if (!/^\d+(\.\d{1,2})?$/.test(String(valor))) return "Use hasta 2 decimales.";
  return null;
}

// Normaliza y valida un tramo suelto; el orden y la continuidad de la escala se revisan en validarTramos.
function validarTramo(tramo = {}, indice, errores) {
  const agregar = (campo, mensaje) => errores.push({ campo: `tramos[${indice}].${campo}`, mensaje });
  const { anios_desde, anios_hasta = null, porcentaje } = tramo;

  if (!Number.isInteger(anios_desde) || anios_desde < 0 || anios_desde > MAX_ANIOS) {
    agregar("anios_desde", "Ingrese un número entero de años, entre 0 y 80.");
  }
  if (anios_hasta !== null && (!Number.isInteger(anios_hasta) || anios_hasta < 0 || anios_hasta > MAX_ANIOS)) {
    agregar("anios_hasta", "Ingrese un número entero de años, entre 0 y 80, o deje vacío si no tiene tope.");
  } else if (anios_hasta !== null && Number.isInteger(anios_desde) && anios_hasta < anios_desde) {
    agregar("anios_hasta", "Debe ser igual o mayor al inicio del tramo.");
  }
  const errorPorcentaje = validarPorcentaje(porcentaje);
  if (errorPorcentaje) agregar("porcentaje", errorPorcentaje);

  return { anios_desde, anios_hasta, porcentaje };
}

// La escala debe cubrir los años sin huecos ni cruces: cada tramo empieza donde terminó el anterior, y solo
// el último puede quedar sin tope (anios_hasta NULL).
function validarTramos(tramos) {
  const errores = [];
  if (!Array.isArray(tramos) || tramos.length === 0) {
    throw new ErrorApp(400, "Datos de la escala inválidos", [
      { campo: "tramos", mensaje: "Registre al menos un tramo." },
    ]);
  }
  if (tramos.length > MAX_TRAMOS) {
    throw new ErrorApp(400, "Datos de la escala inválidos", [
      { campo: "tramos", mensaje: `Use hasta ${MAX_TRAMOS} tramos.` },
    ]);
  }

  const normalizados = tramos.map((tramo, indice) => validarTramo(tramo, indice, errores));
  lanzarSiHayErrores("Datos de la escala inválidos", errores);

  const ordenados = [...normalizados].sort((a, b) => a.anios_desde - b.anios_desde);
  ordenados.forEach((tramo, indice) => {
    const esUltimo = indice === ordenados.length - 1;
    if (!esUltimo && tramo.anios_hasta === null) {
      errores.push({ campo: `tramos[${indice}].anios_hasta`, mensaje: "Solo el último tramo puede quedar sin tope." });
    }
    if (indice > 0) {
      const anterior = ordenados[indice - 1];
      if (anterior.anios_hasta === null || tramo.anios_desde !== anterior.anios_hasta + 1) {
        errores.push({
          campo: `tramos[${indice}].anios_desde`,
          mensaje: `Debe continuar justo después del tramo anterior (año ${anterior.anios_hasta + 1}).`,
        });
      }
    }
  });
  lanzarSiHayErrores("Datos de la escala inválidos", errores);

  return ordenados;
}

function validarVigenciaEscala(datos = {}) {
  const errores = [];
  const { vigente_desde, motivo } = datos;
  if (!esFecha(vigente_desde)) errores.push({ campo: "vigente_desde", mensaje: "Ingrese una fecha válida." });
  const motivoTexto = typeof motivo === "string" ? motivo.trim() : "";
  if (motivoTexto.length > 250) errores.push({ campo: "motivo", mensaje: "Use hasta 250 caracteres." });
  lanzarSiHayErrores("Datos de la vigencia inválidos", errores);

  return { vigente_desde, motivo: motivoTexto || null, tramos: validarTramos(datos.tramos) };
}

// Misma regla que las vigencias de concepto (ver utils/conceptos.js): la nueva vigencia debe empezar
// después de la última; si la última sigue abierta o se cruza, se cierra el día anterior sin tocar sus
// tramos, así los bonos ya calculados conservan el porcentaje histórico (RF-50, criterio 3).
function cierreDeUltimaVigencia(ultima, nuevaDesde) {
  if (!ultima) return null;
  if (nuevaDesde <= ultima.vigente_desde) {
    throw new ErrorApp(400, "Datos de la vigencia inválidos", [
      {
        campo: "vigente_desde",
        mensaje: `Debe ser posterior al inicio de la vigencia actual (${ultima.vigente_desde}).`,
      },
    ]);
  }
  const seCruza = ultima.vigente_hasta === null || ultima.vigente_hasta >= nuevaDesde;
  return seCruza ? diaAnterior(nuevaDesde) : null;
}

// El tramo cuyo rango de años contiene la antigüedad del colaborador, o undefined si la escala no la cubre.
function tramoParaAnios(tramos, anios) {
  return tramos.find((t) => anios >= t.anios_desde && (t.anios_hasta === null || anios <= t.anios_hasta));
}

// Años desde los que empieza a aplicar el primer tramo de la escala (hoy, 2). Permite distinguir "todavía
// no llega a la antigüedad mínima" (estado de negocio esperado) de un hueco real en la escala.
function pisoBono(tramos) {
  return Math.min(...tramos.map((t) => t.anios_desde));
}

const redondear = (valor) => Math.round(valor * 100) / 100;

module.exports = { validarVigenciaEscala, cierreDeUltimaVigencia, tramoParaAnios, pisoBono, redondear };
