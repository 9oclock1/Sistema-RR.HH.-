const { ErrorApp } = require("./errores");
const { UUID_RE } = require("./formatos");
const { PAGINA } = require("./casosQueja");

const SIN_SUCURSAL = "sin";
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const SEPARADOR = ";";
const BOM = "﻿";
const INICIO_PELIGROSO = /^[=+\-@\t\r]/;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

const ENCABEZADOS = [
  "Código",
  "Tipo",
  "Categoría",
  "Prioridad",
  "Sucursal",
  "Responsable",
  "Fecha de registro",
  "Fecha de derivación",
  "Fecha de cierre",
  "Duración de atención (días)",
  "Estado final",
  "Acciones registradas",
];

const vacio = (valor) => valor === undefined || valor === null || valor === "";

const zonaHoraria = () => process.env.QUEJAS_ZONA_HORARIA || "America/La_Paz";

function fechaValida(texto) {
  if (!FECHA_RE.test(texto)) return false;
  const fecha = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === texto;
}

function enteroPositivo(valor) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

function leerFiltrosHistorial(consulta = {}, { paginar = true } = {}) {
  const errores = [];
  const fecha = (campo, valor) => {
    if (vacio(valor)) return null;
    if (typeof valor !== "string" || !fechaValida(valor)) {
      errores.push({ campo, mensaje: "Use una fecha válida (AAAA-MM-DD)." });
      return null;
    }
    return valor;
  };
  const entero = (campo, valor) => {
    if (vacio(valor)) return null;
    const id = enteroPositivo(valor);
    if (!id) errores.push({ campo, mensaje: "Filtro inválido." });
    return id;
  };

  const desde = fecha("desde", consulta.desde);
  const hasta = fecha("hasta", consulta.hasta);
  if (desde && hasta && desde > hasta) {
    errores.push({ campo: "hasta", mensaje: "La fecha final no puede ser anterior a la inicial." });
  }

  const sinSucursal = consulta.sucursal === SIN_SUCURSAL;
  let idSucursal = null;
  if (!sinSucursal && !vacio(consulta.sucursal)) {
    if (typeof consulta.sucursal === "string" && UUID_RE.test(consulta.sucursal.trim())) {
      idSucursal = consulta.sucursal.trim().toLowerCase();
    } else {
      errores.push({ campo: "sucursal", mensaje: "Filtro inválido." });
    }
  }

  const filtros = {
    desde,
    hasta,
    idCategoria: entero("categoria", consulta.categoria),
    idSucursal,
    sinSucursal,
    zonaHoraria: zonaHoraria(),
  };
  if (paginar) {
    filtros.pagina = vacio(consulta.pagina) ? 1 : entero("pagina", consulta.pagina);
    filtros.limite = vacio(consulta.limite) ? PAGINA.LIMITE : entero("limite", consulta.limite);
  }
  if (errores.length) throw new ErrorApp(400, "Revise los filtros del historial.", errores);
  if (paginar) filtros.limite = Math.min(filtros.limite, PAGINA.LIMITE_MAXIMO);
  return filtros;
}

function duracionDias(desde, hasta) {
  if (!desde || !hasta) return null;
  const dias = (new Date(hasta) - new Date(desde)) / MS_POR_DIA;
  return Math.max(0, Math.round(dias * 10) / 10);
}

function neutralizarCelda(valor) {
  if (valor === null || valor === undefined) return "";
  const texto = String(valor);
  return INICIO_PELIGROSO.test(texto) ? `'${texto}` : texto;
}

const celdaCsv = (valor) => `"${neutralizarCelda(valor).replace(/"/g, '""')}"`;

const filaCsv = (valores) => valores.map(celdaCsv).join(SEPARADOR);

function partesFecha(valor) {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: zonaHoraria(),
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(valor));
  return Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
}

function fechaCsv(valor) {
  if (!valor) return "";
  const p = partesFecha(valor);
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

function sufijoArchivo(valor = new Date()) {
  const p = partesFecha(valor);
  return `${p.year}${p.month}${p.day}`;
}

const numeroCsv = (valor) => (valor === null || valor === undefined ? "" : String(valor).replace(".", ","));

function armarCsv(casos) {
  const lineas = casos.map((caso) =>
    filaCsv([
      caso.codigo_seguimiento,
      caso.es_anonima ? "Anónima" : "Identificada",
      caso.categoria.nombre,
      caso.prioridad?.nombre ?? "Sin prioridad",
      caso.sucursal?.nombre ?? "Sin sucursal",
      caso.responsable?.nombre_completo ?? "Sin responsable",
      fechaCsv(caso.registrada_en),
      fechaCsv(caso.derivada_en),
      fechaCsv(caso.cerrada_en),
      numeroCsv(caso.duracion_dias),
      caso.estado.nombre,
      caso.total_acciones,
    ]),
  );
  return `${BOM}${[filaCsv(ENCABEZADOS), ...lineas].join("\r\n")}\r\n`;
}

module.exports = {
  SIN_SUCURSAL,
  ENCABEZADOS,
  SEPARADOR,
  BOM,
  leerFiltrosHistorial,
  duracionDias,
  neutralizarCelda,
  armarCsv,
  fechaCsv,
  sufijoArchivo,
};
