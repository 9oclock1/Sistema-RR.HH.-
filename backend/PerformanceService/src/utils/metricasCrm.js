const { createHash } = require("node:crypto");
const { UUID_RE } = require("./formatos");
const { ORIGEN } = require("./mensajeria");

// Respuesta del CRM con las métricas de atención al cliente de cada colaborador (RF-07, criterio 3).
// Mensaje con encabezado origen B (CRM) → destino F (RRHH) y estos datos:
//   { id_ciclo, id_mensaje_solicitud?, periodo?: { nombre }, metricas: [{ id_empleado, cantidad_quejas,
//     cantidad_felicitaciones, minutos_resolucion_promedio }] }

const TIPO_RESPUESTA_METRICAS_CRM = "METRICAS_DESEMPENO_CRM";
const ORIGEN_CRM = { grupo: "B", modulo: "CRM" };
const VERSION_ESQUEMA = 1;

// Ids de CATALOGOS_ESTADO_MENSAJE (catalogos.sql).
const ESTADO_MENSAJE = { RECIBIDO: 1, PROCESADO: 2, EN_DLQ: 3 };
const CODIGO_ESTADO_MENSAJE = { 1: "RECIBIDO", 2: "PROCESADO", 3: "EN_DLQ" };

const MAX_ERRORES = 8;
const MAX_METRICAS = 5000;
const MAX_ENTERO = 1000000;
const MAX_MINUTOS = 99999999.99; // NUMERIC(10, 2)

// --- Configuración (variables de entorno, con valores por defecto) ---

// Mientras no exista la integración real con el CRM, el docente pide simular su respuesta: cuando la solicitud se
// publica bien, el sistema genera la respuesta, la muestra en la consola y la procesa como si hubiera llegado.
const numeroDeEntorno = (nombre, porDefecto) => {
  const texto = process.env[nombre];
  if (texto === undefined || texto.trim() === "") return porDefecto;
  const numero = Number(texto);
  return Number.isFinite(numero) && numero >= 0 ? numero : porDefecto;
};

const simulacionActiva = () => process.env.SIMULAR_CRM_ACTIVO !== "false";
const demoraRespuestaMs = () => numeroDeEntorno("SIMULAR_CRM_DEMORA_MS", 2000);
// Solo rotula la consola: el CRM publicaría en su propio tópico, pero aquí la respuesta se simula.
const topicoCrm = () => process.env.PUBSUB_TOPICO_CRM || "ucb-sis323-sub-b";

// Entregas del mismo mensaje antes de mandarlo a la cola de errores (DLQ), con espera creciente entre ellas.
const maximoIntentos = () => Math.max(1, Math.floor(numeroDeEntorno("CRM_MAXIMO_INTENTOS", 5)));
const esperaBaseMs = () => numeroDeEntorno("CRM_REINTENTO_BASE_MS", 1000);
const ESPERA_MAXIMA_MS = 60 * 1000;
const esperaReentrega = (intentos) => Math.min(esperaBaseMs() * 2 ** Math.max(intentos - 1, 0), ESPERA_MAXIMA_MS);

// --- Lectura y validación de lo que llega ---

const esObjeto = (valor) => valor !== null && typeof valor === "object" && !Array.isArray(valor);

function analizar(texto) {
  try {
    return JSON.parse(texto);
  } catch {
    return undefined;
  }
}

// Con qué identificador se guarda un mensaje entrante: el `id_mensaje` de su encabezado y, si no lo trae (JSON roto o
// sin encabezado), el hash del texto, así hasta un mensaje ilegible queda registrado y no se procesa dos veces.
function identificarMensaje(texto) {
  const cuerpo = analizar(texto);
  const id = cuerpo?.encabezado?.id_mensaje;
  const tipo = cuerpo?.encabezado?.tipo;
  return {
    cuerpo: cuerpo === undefined ? null : cuerpo,
    idExterno:
      typeof id === "string" && id.trim() !== "" && id.length <= 64
        ? id.trim()
        : createHash("sha256").update(String(texto)).digest("hex"),
    tipoEvento: typeof tipo === "string" && tipo.trim() !== "" ? tipo.trim().slice(0, 60) : null,
  };
}

function leerMetrica(metrica, indice) {
  const errores = [];
  const prefijo = `metricas[${indice}]`;
  if (!esObjeto(metrica)) return { errores: [`${prefijo} debe ser un objeto.`] };

  if (typeof metrica.id_empleado !== "string" || !UUID_RE.test(metrica.id_empleado)) {
    errores.push(`${prefijo}.id_empleado debe ser un identificador válido.`);
  }
  for (const campo of ["cantidad_quejas", "cantidad_felicitaciones"]) {
    const valor = metrica[campo];
    if (!Number.isInteger(valor) || valor < 0 || valor > MAX_ENTERO) {
      errores.push(`${prefijo}.${campo} debe ser un entero mayor o igual a 0.`);
    }
  }
  const minutos = metrica.minutos_resolucion_promedio;
  const sinCasos = minutos === null || minutos === undefined;
  if (!sinCasos && (typeof minutos !== "number" || !Number.isFinite(minutos) || minutos < 0 || minutos > MAX_MINUTOS)) {
    errores.push(`${prefijo}.minutos_resolucion_promedio debe ser un número mayor o igual a 0 (o null si no hubo casos).`);
  }
  if (errores.length > 0) return { errores };
  return {
    metrica: {
      idEmpleado: metrica.id_empleado.toLowerCase(),
      cantidadQuejas: metrica.cantidad_quejas,
      cantidadFelicitaciones: metrica.cantidad_felicitaciones,
      minutosResolucion: sinCasos ? null : Math.round(minutos * 100) / 100,
    },
  };
}

// Devuelve { errores } si el mensaje no sirve, o { mensaje } listo para guardar. Un mensaje se acepta completo o no
// se acepta: nunca se guardan solo algunas de sus métricas.
function leerMensajeCrm(texto) {
  const cuerpo = analizar(texto);
  if (cuerpo === undefined) return { errores: ["El mensaje no es un JSON válido."] };
  if (!esObjeto(cuerpo)) return { errores: ["El mensaje debe ser un objeto JSON."] };

  const errores = [];
  const encabezado = cuerpo.encabezado;
  if (!esObjeto(encabezado)) {
    errores.push("Falta el encabezado del mensaje.");
  } else {
    if (encabezado.tipo !== TIPO_RESPUESTA_METRICAS_CRM) errores.push(`El tipo debe ser ${TIPO_RESPUESTA_METRICAS_CRM}.`);
    if (encabezado.origen?.grupo !== ORIGEN_CRM.grupo) errores.push("El origen debe ser el grupo B (CRM).");
    if (encabezado.destino?.grupo !== ORIGEN.grupo) errores.push("El destino debe ser el grupo F (RRHH).");
  }

  const datos = cuerpo.datos;
  if (!esObjeto(datos)) {
    errores.push("Faltan los datos del mensaje.");
    return { errores };
  }
  if (typeof datos.id_ciclo !== "string" || !UUID_RE.test(datos.id_ciclo)) {
    errores.push("datos.id_ciclo debe ser un identificador válido.");
  }
  if (!Array.isArray(datos.metricas) || datos.metricas.length === 0) {
    errores.push("datos.metricas debe ser una lista con al menos un colaborador.");
  } else if (datos.metricas.length > MAX_METRICAS) {
    errores.push(`datos.metricas no puede superar ${MAX_METRICAS} colaboradores.`);
  }

  const metricas = [];
  const vistos = new Set();
  if (Array.isArray(datos.metricas) && datos.metricas.length <= MAX_METRICAS) {
    datos.metricas.forEach((cruda, indice) => {
      const lectura = leerMetrica(cruda, indice);
      if (lectura.errores) return errores.push(...lectura.errores);
      if (vistos.has(lectura.metrica.idEmpleado)) {
        return errores.push(`metricas[${indice}] repite al colaborador ${lectura.metrica.idEmpleado}.`);
      }
      vistos.add(lectura.metrica.idEmpleado);
      metricas.push(lectura.metrica);
    });
  }

  if (errores.length > 0) {
    const resto = errores.length - MAX_ERRORES;
    return { errores: resto > 0 ? [...errores.slice(0, MAX_ERRORES), `…y ${resto} error(es) más.`] : errores };
  }
  return {
    mensaje: {
      idCiclo: datos.id_ciclo.toLowerCase(),
      periodo: typeof datos.periodo?.nombre === "string" ? datos.periodo.nombre : null,
      metricas,
    },
  };
}

// --- Respuesta simulada del CRM ---

// UUID estable a partir de un texto: la misma solicitud siempre produce la misma respuesta con el mismo id, así una
// solicitud publicada dos veces genera un duplicado que se descarta y no métricas distintas.
function uuidDeterministico(texto) {
  const bytes = createHash("sha1").update(texto).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Métricas de ejemplo repetibles (no al azar): derivadas de la solicitud y del colaborador. Quien no tuvo quejas no
// tiene tiempo de resolución, igual que en el CRM real.
function generarMetricasSimuladas(idSolicitud, colaboradores) {
  return colaboradores.map(({ id_empleado: idEmpleado }) => {
    const b = createHash("sha256").update(`${idSolicitud}:${idEmpleado}`).digest();
    const quejas = b[0] % 10;
    return {
      id_empleado: idEmpleado,
      cantidad_quejas: quejas,
      cantidad_felicitaciones: b[1] % 9,
      minutos_resolucion_promedio: quejas === 0 ? null : 10 + ((b[2] * 256 + b[3]) % 5001) / 100,
    };
  });
}

// La respuesta del CRM a una solicitud de métricas ya publicada.
function armarRespuestaCrm(solicitud, fecha = new Date().toISOString()) {
  const { encabezado, datos } = solicitud;
  return {
    encabezado: {
      id_mensaje: uuidDeterministico(`respuesta-crm:${encabezado.id_mensaje}`),
      origen: ORIGEN_CRM,
      destino: ORIGEN,
      tipo: TIPO_RESPUESTA_METRICAS_CRM,
      fecha,
      version_esquema: VERSION_ESQUEMA,
    },
    datos: {
      id_ciclo: datos.id_ciclo,
      id_mensaje_solicitud: encabezado.id_mensaje,
      periodo: { nombre: datos.periodo.nombre },
      metricas: generarMetricasSimuladas(encabezado.id_mensaje, datos.colaboradores),
    },
  };
}

module.exports = {
  TIPO_RESPUESTA_METRICAS_CRM,
  ORIGEN_CRM,
  ESTADO_MENSAJE,
  CODIGO_ESTADO_MENSAJE,
  simulacionActiva,
  demoraRespuestaMs,
  topicoCrm,
  maximoIntentos,
  esperaReentrega,
  identificarMensaje,
  leerMensajeCrm,
  uuidDeterministico,
  generarMetricasSimuladas,
  armarRespuestaCrm,
};
