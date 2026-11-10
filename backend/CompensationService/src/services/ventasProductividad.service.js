const pool = require("../config/db");
const modelo = require("../models/ventasProductividad.model");
const pubsub = require("../config/pubsub");
const externos = require("./externos.service");
const { enTransaccion } = require("../config/transaccion");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const {
  MAXIMO_INTENTOS_ENTRADA,
  esperaNuevaEntrega,
  periodoAFecha,
  validarRegla,
  validarEdicionRegla,
  esEventoVentas,
  leerEventoVentas,
  montoDeRegla,
  cumpleUmbral,
} = require("../utils/ventasProductividad");

const ESTADOS_EVENTO = ["RECIBIDO", "PROCESADO", "IGNORADO", "FALLIDO"];
const LIMITE_CONSULTA = 100;
const REINTENTO_SUSCRIPCION_MS = 60 * 1000;

const noEncontrada = () => new ErrorApp(404, "Regla no encontrada");

const formatearRegla = (r) => ({
  id_regla: r.id_regla,
  periodo: r.periodo,
  tipo_meta: r.tipo_meta,
  umbral_cumplimiento: r.umbral_cumplimiento,
  forma_calculo: r.forma_calculo,
  valor: r.valor,
  esta_activa: r.esta_activa,
  creado_en: r.creado_en,
  actualizado_en: r.actualizado_en,
});

async function buscarRegla(id) {
  const regla = UUID_RE.test(id ?? "") ? await modelo.obtenerRegla(id) : undefined;
  if (!regla) throw noEncontrada();
  return regla;
}

// RF-51, criterio 1: la regla queda activa para el periodo con su umbral y su monto o porcentaje.
async function listarReglas({ periodo, tipo_meta } = {}) {
  const errores = [];
  if (periodo !== undefined && !periodoAFecha(periodo)) {
    errores.push({ campo: "periodo", mensaje: "Use el formato AAAA-MM." });
  }
  if (errores.length > 0) throw new ErrorApp(400, "Filtros inválidos", errores);
  const filas = await modelo.listarReglas({ periodo: periodo ? periodoAFecha(periodo) : undefined, tipo_meta });
  return filas.map(formatearRegla);
}

async function obtenerRegla(id) {
  return formatearRegla(await buscarRegla(id));
}

function traducirErrorBD(error) {
  if (error.code === "23505") {
    throw new ErrorApp(409, "Ya existe una regla activa de ese tipo de meta en el periodo", [
      { campo: "tipo_meta", mensaje: "Ya existe una regla para ese tipo de meta en el periodo." },
    ]);
  }
  throw error;
}

async function crearRegla(datos) {
  const regla = validarRegla(datos);
  const id = await modelo.crearRegla(regla).catch(traducirErrorBD);
  return obtenerRegla(id);
}

async function actualizarRegla(id, datos = {}) {
  const actual = await buscarRegla(id);
  const cambios = validarEdicionRegla(datos, actual);
  if (!(await modelo.actualizarRegla(id, cambios))) throw noEncontrada();
  return obtenerRegla(id);
}

async function cambiarEstadoRegla(id, { esta_activa } = {}) {
  if (!UUID_RE.test(id ?? "")) throw noEncontrada();
  if (typeof esta_activa !== "boolean") {
    throw new ErrorApp(400, "Datos inválidos", [{ campo: "esta_activa", mensaje: "Use true o false." }]);
  }
  if (!(await modelo.cambiarEstadoRegla(id, esta_activa))) throw noEncontrada();
  return obtenerRegla(id);
}

// Una regla que ya generó bonos queda referenciada por ellos: solo se puede inactivar.
async function eliminarRegla(id) {
  if (!UUID_RE.test(id ?? "")) throw noEncontrada();
  let eliminados;
  try {
    eliminados = await modelo.eliminarRegla(id);
  } catch (error) {
    if (error.code !== "23503") throw error;
    throw new ErrorApp(409, "La regla ya generó bonos de productividad: solo se puede inactivar.");
  }
  if (!eliminados) throw noEncontrada();
}

// RF-51, criterio 3: aplica las reglas activas del periodo a sus métricas y reemplaza los bonos anteriores.
// Se llama tanto al terminar de registrar un cierre de ventas como al reprocesar manualmente el periodo.
async function aplicarReglas(cliente, periodo) {
  const [reglas, metricas] = await Promise.all([
    modelo.reglasActivasDelPeriodo(cliente, periodo),
    modelo.metricasDelPeriodo(cliente, periodo),
  ]);
  const metricasPorTipo = { VENTAS: metricas }; // Puntualidad y desempeño en caja: sin fuente de métricas aún.
  const bonos = [];
  for (const regla of reglas) {
    for (const metrica of metricasPorTipo[regla.tipo_meta] ?? []) {
      if (!cumpleUmbral(regla, metrica)) continue;
      bonos.push({
        id_empleado: metrica.id_empleado,
        id_regla: regla.id_regla,
        id_metrica: metrica.id_metrica,
        porcentaje_cumplimiento: metrica.porcentaje_cumplimiento,
        valor: regla.valor,
        monto: montoDeRegla(regla),
        regla,
      });
    }
  }
  await modelo.reemplazarBonosDelPeriodo(cliente, periodo, bonos);
  return bonos;
}

// Bonos del periodo en el formato que espera planillas.service/consolidarPlanilla (igual que condiciones.procesar).
function comoNovedad(b) {
  return {
    empleado: { id_empleado: b.id_empleado },
    origen: "PRODUCTIVIDAD",
    condicion: { codigo: "BONO-PRODUCTIVIDAD", nombre: "Bono de productividad", forma_calculo: b.regla.forma_calculo },
    cantidad: 1,
    factor: 1,
    cumplimiento: b.porcentaje_cumplimiento,
    valor: b.valor,
    monto: b.monto,
    id_vigencia: null,
  };
}

// Se vuelve a procesar el periodo (por ejemplo, tras cambiar una regla) y entrega los bonos listos para la
// planilla. Volver a procesar reemplaza los bonos anteriores del periodo.
async function procesar({ periodo } = {}) {
  const fecha = periodoAFecha(periodo);
  if (!fecha) throw new ErrorApp(400, "Periodo inválido", [{ campo: "periodo", mensaje: "Use el formato AAAA-MM." }]);
  const bonos = await enTransaccion((cliente) => aplicarReglas(cliente, fecha));
  return { periodo: fecha, bonos: bonos.map(comoNovedad) };
}

// ---- Resultados por colaborador (RF-51), para la pantalla de configuración ----

const formatearBono = (b, nombre) => ({
  id_bono: b.id_bono,
  empleado: { id_empleado: b.id_empleado, nombre_completo: nombre ?? "Colaborador no registrado" },
  regla: {
    id_regla: b.id_regla,
    tipo_meta: b.tipo_meta,
    umbral_cumplimiento: b.umbral_cumplimiento,
    forma_calculo: b.regla_forma_calculo,
  },
  metrica: { rol: b.rol, monto_ventas: b.monto_ventas, cuota_asignada: b.cuota_asignada },
  porcentaje_cumplimiento: b.porcentaje_cumplimiento,
  valor: b.valor,
  monto: b.monto,
  generado_en: b.generado_en,
});

async function listarBonos({ periodo } = {}) {
  const fecha = periodoAFecha(periodo);
  if (!fecha) throw new ErrorApp(400, "Periodo inválido", [{ campo: "periodo", mensaje: "Use el formato AAAA-MM." }]);
  const bonos = await modelo.listarBonosDelPeriodo(fecha);
  const personal = bonos.length > 0 ? await externos.listarPersonal() : [];
  const nombres = new Map(personal.map((e) => [String(e.id_empleado).toLowerCase(), e.nombre_completo]));
  const formateados = bonos.map((b) => formatearBono(b, nombres.get(String(b.id_empleado).toLowerCase())));
  return {
    periodo: fecha,
    bonos: formateados,
    totales: {
      bonos: formateados.length,
      colaboradores: new Set(formateados.map((b) => b.empleado.id_empleado)).size,
      monto_fijo: Math.round(formateados.reduce((total, b) => total + (b.monto ?? 0), 0) * 100) / 100,
    },
  };
}

// ---- Consumidor del cierre de ventas del periodo (RF-51, criterios 2 y 4) ----

// Procesa una entrega de Pub/Sub. Devuelve { ack: true } o { ack: false, esperaMs } para que vuelva a entregarse.
async function procesarEventoVentas({ idMensaje, topico, cuerpo }) {
  if (!esEventoVentas(cuerpo)) return { ack: true, ignorado: true };
  const registro = {
    idMensaje: String(cuerpo.encabezado.id_mensaje ?? idMensaje).slice(0, 100),
    topico,
    tipoEvento: cuerpo.encabezado.tipo,
    carga: cuerpo,
  };
  try {
    return await enTransaccion(async (cliente) => {
      const fila = await modelo.reclamar(cliente, registro);
      // Pub/Sub puede entregar dos veces el mismo mensaje: el duplicado no cambia nada (criterio 4).
      if (fila.estado !== "RECIBIDO") return { ack: true, duplicado: true };

      const lectura = leerEventoVentas(cuerpo);
      if (lectura.errores) {
        await modelo.cerrar(cliente, fila.id_evento_entrante, { estado: "FALLIDO", detalle: lectura.errores.join(" ") });
        return { ack: true };
      }
      await modelo.guardarMetricas(cliente, fila.id_evento_entrante, lectura.periodo, lectura.metricas);
      // Criterio 3: el motor de bonos se ejecuta en la misma transacción, con las métricas recién registradas.
      await aplicarReglas(cliente, lectura.periodo);
      // Un colaborador con datos inválidos no descarta el mensaje: queda aquí para que Ventas lo revise,
      // mientras los demás colaboradores sí reciben su bono.
      const detalle = lectura.omitidos?.length
        ? `${lectura.omitidos.length} colaborador(es) omitido(s): ${lectura.omitidos.map((o) => `[${o.indice}] ${o.motivo}`).join(" ")}`.slice(0, 255)
        : null;
      await modelo.cerrar(cliente, fila.id_evento_entrante, { estado: "PROCESADO", periodo: lectura.periodo, detalle });
      return { ack: true, omitidos: lectura.omitidos };
    });
  } catch (error) {
    console.error(`Error al procesar el cierre de ventas ${registro.idMensaje}:`, error.message);
    try {
      const fila = await modelo.registrarFallo({ ...registro, detalle: error.message, maximo: MAXIMO_INTENTOS_ENTRADA });
      if (!fila || fila.estado === "FALLIDO") return { ack: true };
      return { ack: false, esperaMs: esperaNuevaEntrega(fila.intentos) };
    } catch {
      return { ack: false, esperaMs: esperaNuevaEntrega(MAXIMO_INTENTOS_ENTRADA) };
    }
  }
}

async function manejar(mensaje, topico) {
  let cuerpo;
  try {
    cuerpo = JSON.parse(mensaje.data.toString("utf8"));
  } catch {
    mensaje.ack(); // No es JSON: no es un cierre de ventas para RRHH.
    return;
  }
  const resultado = await procesarEventoVentas({ idMensaje: mensaje.id, topico, cuerpo });
  if (resultado.ack) mensaje.ack();
  else setTimeout(() => mensaje.nack(), resultado.esperaMs).unref();
}

function topicoDeVentas() {
  return process.env.PUBSUB_TOPICO_VENTAS || "ucb-sis323-sub-e";
}

async function escuchar(clientePubSub, topico) {
  const nombre = `${topico}${process.env.PUBSUB_SUFIJO_SUSCRIPCION_VENTAS || "-rrhh-productividad"}`;
  const volverAIntentar = () => setTimeout(() => escuchar(clientePubSub, topico), REINTENTO_SUSCRIPCION_MS).unref();
  try {
    const suscripcion = clientePubSub.subscription(nombre);
    const [existe] = await suscripcion.exists();
    if (!existe) await clientePubSub.topic(topico).createSubscription(nombre);
    suscripcion.on("message", (mensaje) => manejar(mensaje, topico));
    suscripcion.on("error", (error) => {
      console.error(`Error en la suscripción ${nombre}:`, error.message);
      suscripcion.removeAllListeners();
      suscripcion.close().catch(() => {});
      volverAIntentar();
    });
    console.log(`Escuchando el cierre de ventas del periodo en ${nombre}`);
  } catch (error) {
    console.error(`No se pudo abrir la suscripción ${nombre}:`, error.message);
    volverAIntentar();
  }
}

// Sin Pub/Sub configurado (sin PUBSUB_EMULATOR_HOST ni GOOGLE_APPLICATION_CREDENTIALS) el consumidor no se
// inicia; los endpoints de reglas y resultados siguen funcionando igual.
function iniciarConsumidor() {
  const clientePubSub = pubsub.obtenerCliente();
  if (!clientePubSub) return;
  escuchar(clientePubSub, topicoDeVentas());
}

const formatearEvento = (f) => ({
  id_evento_entrante: f.id_evento_entrante,
  id_mensaje: f.id_mensaje,
  topico: f.topico,
  tipo_evento: f.tipo_evento,
  periodo: f.periodo,
  estado: f.estado,
  intentos: f.intentos,
  detalle: f.detalle,
  recibido_en: f.recibido_en,
  procesado_en: f.procesado_en,
  carga: f.carga,
});

// Mensajes de cierre de ventas recibidos; con ?estado=FALLIDO, la cola de mensajes fallidos.
async function listarEventos({ estado } = {}) {
  if (estado !== undefined && !ESTADOS_EVENTO.includes(estado)) {
    throw new ErrorApp(400, "Filtros inválidos", [{ campo: "estado", mensaje: `Use uno de: ${ESTADOS_EVENTO.join(", ")}.` }]);
  }
  return (await modelo.listarEventos({ estado: estado ?? null, limite: LIMITE_CONSULTA })).map(formatearEvento);
}

// Vuelve a procesar un mensaje fallido (por ejemplo, tras corregir el dato que faltaba en Ventas).
async function reprocesarEvento(id) {
  const actual = UUID_RE.test(id ?? "") ? await modelo.obtenerEvento(pool, id) : undefined;
  if (!actual) throw new ErrorApp(404, "Mensaje no encontrado");
  const fila = await modelo.reabrirEvento(id);
  if (!fila) throw new ErrorApp(409, "Solo se reprocesan los mensajes fallidos.");
  const resultado = await procesarEventoVentas({ idMensaje: fila.id_mensaje, topico: fila.topico, cuerpo: fila.carga });
  if (!resultado.ack) {
    const tras = await modelo.obtenerEvento(pool, id);
    await modelo.devolverEventoAFallido(id, tras.detalle ?? "No se pudo procesar.");
    throw new ErrorApp(503, `No se pudo reprocesar el mensaje: ${tras.detalle ?? "error al procesar"}. Intente más tarde.`);
  }
  return formatearEvento(await modelo.obtenerEvento(pool, id));
}

module.exports = {
  listarReglas,
  obtenerRegla,
  crearRegla,
  actualizarRegla,
  cambiarEstadoRegla,
  eliminarRegla,
  procesar,
  listarBonos,
  procesarEventoVentas,
  iniciarConsumidor,
  listarEventos,
  reprocesarEvento,
};
