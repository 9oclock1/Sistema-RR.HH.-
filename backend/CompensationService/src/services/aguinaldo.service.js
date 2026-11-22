const { randomUUID } = require("node:crypto");
const pool = require("../config/db");
const modelo = require("../models/aguinaldo.model");
const eventos = require("../models/eventos.model");
const { topicoPropio } = require("./eventos.service");
const confirmaciones = require("./confirmaciones.service");
const externos = require("./externos.service");
const { responsableEn } = require("./planillas.service");
const empleadosCliente = require("../clients/empleados.cliente");
const pubsub = require("../config/pubsub");
const mensajesPublicados = require("../utils/mensajesPublicados");
const { enTransaccion } = require("../config/transaccion");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const { hoyLaPaz } = require("../utils/fechas");
const { validarResponsable } = require("../utils/planillas");
const { atributosDe } = require("../utils/integraciones");
const {
  validarGestion,
  rangoGestion,
  calcularAguinaldo,
  DESTINOS_AGUINALDO,
  armarMensajeAguinaldo,
  armarAsientoAguinaldo,
  armarOrdenPagoAguinaldo,
  validarSimulacionConfirmacion,
  armarConfirmacionSimulada,
} = require("../utils/aguinaldo");

// Igual que la publicación real (eventos.service): sin tope, una llamada a Pub/Sub inalcanzable deja la
// petición HTTP de simular colgada.
const tiempoPublicacionMs = () => Number(process.env.PUBSUB_TIMEOUT_MS) || 15000;
const conLimiteDeTiempo = (promesa) =>
  Promise.race([
    promesa,
    new Promise((_, rechazar) =>
      setTimeout(() => rechazar(new Error("Pub/Sub no respondió a tiempo")), tiempoPublicacionMs()).unref()
    ),
  ]);

const noEncontrado = () => new ErrorApp(404, "Planilla de aguinaldos no encontrada");
const nombreGestion = (gestion) => `aguinaldos de la gestión ${gestion}`;
const yaAprobada = (gestion) =>
  new ErrorApp(409, `La planilla de ${nombreGestion(gestion)} ya fue aprobada: no se puede volver a generar ni modificar.`);

const formatearEnvio = (e) =>
  e
    ? {
        id_mensaje: e.id_evento,
        estado: e.estado,
        intentos: e.intentos,
        ultimo_error: e.ultimo_error,
        proximo_intento_en: e.estado === "PENDIENTE" ? e.proximo_intento_en : null,
        entregado_en: e.entregado_en,
        creado_en: e.creado_en,
      }
    : null;

const formatearIntegracion = (a, envio, campo) => ({
  estado: a[`estado_${campo}`],
  referencia: a[`referencia_${campo}`] ?? null,
  motivo: a[`motivo_${campo}`] ?? null,
  respondida_en: a[`respondida_${campo}_en`] ?? null,
  envio: formatearEnvio(envio),
});

const formatearAguinaldo = (a, envios = {}) => ({
  id_aguinaldo: a.id_aguinaldo,
  gestion: a.gestion,
  fecha_inicio: a.fecha_inicio,
  fecha_fin: a.fecha_fin,
  estado: a.estado,
  colaboradores: a.colaboradores,
  generada: { por: { id_empleado: a.generada_por, nombre_completo: a.generada_por_nombre }, en: a.generada_en },
  aprobada: a.aprobada_en
    ? { por: { id_empleado: a.aprobada_por, nombre_completo: a.aprobada_por_nombre }, en: a.aprobada_en }
    : null,
  integraciones: {
    contabilidad: formatearIntegracion(a, envios.CONTABILIDAD, "contabilidad"),
    pagos: formatearIntegracion(a, envios.PAGOS, "pagos"),
  },
  cerrada_en: a.cerrada_en,
});

const formatearEmpleado = (e) => ({
  id_aguinaldo_empleado: e.id_aguinaldo_empleado,
  empleado: {
    id_empleado: e.id_empleado,
    nombre_completo: e.nombre_empleado,
    numero_documento: e.numero_documento,
    cargo: e.cargo,
    area: e.area,
    sucursal: e.sucursal,
  },
  fecha_ingreso: e.fecha_ingreso,
  meses_trabajados: e.meses_trabajados,
  dias_trabajados: e.dias_trabajados,
  promedio_sueldo: e.promedio_sueldo,
  monto: e.monto,
  excluido: e.excluido,
  motivo_exclusion: e.motivo_exclusion,
});

function totalizar(empleados) {
  const incluidos = empleados.filter((e) => !e.excluido);
  return {
    colaboradores: empleados.length,
    excluidos: empleados.length - incluidos.length,
    total_aguinaldo: Math.round(incluidos.reduce((t, e) => t + e.monto, 0) * 100) / 100,
  };
}

async function listar() {
  return (await modelo.listar()).map(formatearAguinaldo);
}

async function obtener(id) {
  const aguinaldo = UUID_RE.test(id ?? "") ? await modelo.obtener(pool, id) : undefined;
  if (!aguinaldo) throw noEncontrado();
  const [filas, envios] = await Promise.all([modelo.listarEmpleados(id), eventos.ultimosDeAguinaldo(pool, id)]);
  const empleados = filas.map(formatearEmpleado);
  return { ...formatearAguinaldo(aguinaldo, envios), totales: totalizar(empleados), empleados };
}

// Criterio 3: mensaje del aguinaldo aprobado para un destino. Se guarda en la bandeja de salida (la misma de
// la planilla mensual) dentro de la misma transacción que la aprobación.
async function registrarEnvio(cliente, id, destino) {
  const aguinaldo = await modelo.obtener(cliente, id);
  const empleados = await modelo.empleadosDeIntegracion(cliente, id);
  const datos =
    destino === "CONTABILIDAD"
      ? armarAsientoAguinaldo({ aguinaldo, empleados, glosa: `Aguinaldo de la gestión ${aguinaldo.gestion}` })
      : armarOrdenPagoAguinaldo({ aguinaldo, empleados, concepto: `Pago de aguinaldo de la gestión ${aguinaldo.gestion}` });
  const idEvento = randomUUID();
  await eventos.registrar(cliente, {
    idEvento,
    topico: topicoPropio(),
    tipoEvento: DESTINOS_AGUINALDO[destino].tipo,
    idAguinaldo: id,
    destino,
    carga: armarMensajeAguinaldo({ idMensaje: idEvento, destino, fecha: new Date().toISOString(), datos }),
  });
}

// EmployeeService no guarda una fecha de baja explícita: para un colaborador inactivo, se usa el fin de su
// última versión de contrato (si no se renovó) como aproximación de cuándo dejó de trabajar; sin esa fecha,
// o si sigue activo, el fin efectivo es hoy (o el fin de la gestión, lo que sea antes).
function finEfectivoDe(persona, versiones, rango, hoy) {
  const finGestionOHoy = hoy < rango.hasta ? hoy : rango.hasta;
  if (persona.activo === false) {
    const fechasFin = versiones.map((v) => v.vigente_hasta).filter(Boolean);
    if (fechasFin.length > 0) {
      const ultimaSalida = fechasFin.reduce((max, f) => (f > max ? f : max));
      if (ultimaSalida < finGestionOHoy) return ultimaSalida;
    }
  }
  return finGestionOHoy;
}

async function fechasDeIngreso(empleados) {
  const resultados = await Promise.allSettled(empleados.map((e) => empleadosCliente.obtenerEmpleado(e.id_empleado)));
  return new Map(
    empleados.map((e, i) => [e.id_empleado, resultados[i].status === "fulfilled" ? resultados[i].value?.fecha_ingreso ?? null : null])
  );
}

// El historial de contrato se pide por colaborador (no por rango): /contratos/vigentes tiene un tope de 92
// días y la gestión del aguinaldo cubre 12 meses.
async function historialesDeContrato(empleados) {
  const resultados = await Promise.allSettled(empleados.map((e) => empleadosCliente.listarContratosDe(e.id_empleado)));
  return new Map(
    empleados.map((e, i) => [String(e.id_empleado).toLowerCase(), resultados[i].status === "fulfilled" ? resultados[i].value : []])
  );
}

// Criterio 1: duodécimas del promedio de los tres últimos sueldos, por los meses y días trabajados en la
// gestión. Criterio 2: menos de tres meses de servicio en la gestión queda excluido con el motivo.
async function generar(datos = {}, identidad = {}) {
  const idResponsable = validarResponsable(identidad);
  const gestion = validarGestion(datos.gestion);
  const rango = rangoGestion(gestion);
  const hoy = hoyLaPaz();
  if (rango.hasta > hoy) {
    throw new ErrorApp(409, `La gestión ${gestion} todavía no termina (cierra el 30 de noviembre): no se puede generar su aguinaldo.`);
  }
  const existente = (await modelo.listar()).find((a) => a.gestion === gestion);
  if (existente && existente.estado !== "BORRADOR") throw yaAprobada(gestion);

  const personal = await externos.listarPersonal();
  const nombreResponsable = responsableEn(personal, idResponsable);
  const [fechasIngreso, versionesDe] = await Promise.all([fechasDeIngreso(personal), historialesDeContrato(personal)]);

  const empleados = [];
  for (const persona of personal) {
    const id = String(persona.id_empleado).toLowerCase();
    const fechaIngreso = fechasIngreso.get(persona.id_empleado);
    if (!fechaIngreso) continue; // Sin fecha de ingreso registrada: no se puede ubicar en la gestión.
    const versiones = versionesDe.get(id) ?? [];
    const fechaFinEfectiva = finEfectivoDe(persona, versiones, rango, hoy);
    const resultado = calcularAguinaldo({ fechaIngreso, fechaFinEfectiva, versionesContrato: versiones }, rango);
    if (!resultado) continue; // Ningún día de la relación laboral cae dentro de la gestión.
    empleados.push({
      id_empleado: id,
      nombre_empleado: persona.nombre_completo,
      numero_documento: persona.numero_documento ?? null,
      cargo: persona.cargo ?? null,
      area: persona.area ?? null,
      sucursal: persona.sucursal ?? null,
      fecha_ingreso: fechaIngreso,
      ...resultado,
    });
  }

  const cabecera = {
    gestion,
    fecha_inicio: rango.desde,
    fecha_fin: rango.hasta,
    generada_por: idResponsable,
    generada_por_nombre: nombreResponsable,
  };

  const { id, creado } = await enTransaccion(async (cliente) => {
    const actual = await modelo.bloquearGestion(cliente, gestion);
    if (actual && actual.estado !== "BORRADOR") throw yaAprobada(gestion);
    const idAguinaldo = actual ? actual.id_aguinaldo : await modelo.crear(cliente, cabecera);
    if (actual && !(await modelo.reemplazar(cliente, idAguinaldo, cabecera))) throw yaAprobada(gestion);
    await modelo.guardarEmpleados(cliente, idAguinaldo, empleados);
    return { id: idAguinaldo, creado: !actual };
  });

  return { creado, aguinaldo: await obtener(id) };
}

async function descartar(id, identidad = {}) {
  const idResponsable = validarResponsable(identidad);
  if (!UUID_RE.test(id ?? "")) throw noEncontrado();
  responsableEn(await externos.listarPersonal(), idResponsable);
  await enTransaccion(async (cliente) => {
    const aguinaldo = await modelo.bloquear(cliente, id);
    if (!aguinaldo) throw noEncontrado();
    const noSeDescarta = () =>
      new ErrorApp(409, `La planilla de ${nombreGestion(aguinaldo.gestion)} ya fue aprobada: no se puede descartar.`);
    if (aguinaldo.estado !== "BORRADOR" || !(await modelo.eliminar(cliente, id))) throw noSeDescarta();
  });
}

// Criterio 3: el Contador o el Administrador aprueba el borrador; queda bloqueado y se publica el evento
// hacia Contabilidad y Pagos.
async function aprobar(id, identidad = {}) {
  const idResponsable = validarResponsable(identidad);
  if (!UUID_RE.test(id ?? "")) throw noEncontrado();
  const nombre = responsableEn(await externos.listarPersonal(), idResponsable);
  await enTransaccion(async (cliente) => {
    const aguinaldo = await modelo.bloquear(cliente, id);
    if (!aguinaldo) throw noEncontrado();
    const gestion = nombreGestion(aguinaldo.gestion);
    if (aguinaldo.estado !== "BORRADOR") throw new ErrorApp(409, `La planilla de ${gestion} ya fue aprobada.`);
    if ((await modelo.contarEmpleados(cliente, id)) === 0) {
      throw new ErrorApp(409, `La planilla de ${gestion} no tiene colaboradores con derecho a aguinaldo: no se puede aprobar.`);
    }
    if (!(await modelo.aprobar(cliente, id, { idEmpleado: idResponsable, nombre }))) {
      throw new ErrorApp(409, `La planilla de ${gestion} ya fue aprobada.`);
    }
    for (const destino of Object.keys(DESTINOS_AGUINALDO)) await registrarEnvio(cliente, id, destino);
  });
  return obtener(id);
}

const DESTINO_RUTA = { contabilidad: "CONTABILIDAD", pagos: "PAGOS" };
const NOMBRE_DESTINO = { CONTABILIDAD: "Contabilidad", PAGOS: "Pagos" };

// Criterio 5: reenvía a un destino tras un rechazo, o el mismo mensaje si Pub/Sub lo rechazó de forma
// permanente. El aguinaldo sigue aprobado.
async function reenviar(id, destinoRuta, identidad = {}) {
  const idResponsable = validarResponsable(identidad);
  const destino = DESTINO_RUTA[destinoRuta];
  if (!UUID_RE.test(id ?? "") || !destino) throw noEncontrado();
  responsableEn(await externos.listarPersonal(), idResponsable);
  await enTransaccion(async (cliente) => {
    const aguinaldo = await modelo.bloquear(cliente, id);
    if (!aguinaldo) throw noEncontrado();
    const gestion = nombreGestion(aguinaldo.gestion);
    if (aguinaldo.estado === "BORRADOR") {
      throw new ErrorApp(409, `La planilla de ${gestion} está en borrador: se envía al aprobarla.`);
    }
    if (aguinaldo.estado === "CERRADA") throw new ErrorApp(409, `La planilla de ${gestion} ya está cerrada.`);
    const envio = (await eventos.ultimosDeAguinaldo(cliente, id))[destino];
    if (envio?.estado === "FALLIDO" && (await eventos.reencolar(cliente, envio.id_evento))) return;
    if (await modelo.reabrirIntegracion(cliente, id, destino)) {
      await registrarEnvio(cliente, id, destino);
      return;
    }
    throw new ErrorApp(
      409,
      `${NOMBRE_DESTINO[destino]} no rechazó la planilla de ${gestion} y su envío no falló: no hace falta reenviarla.`
    );
  });
  return obtener(id);
}

// Contabilidad y Pagos no existen en este sistema: en vez de esperar su confirmación de verdad, el
// Administrador la simula desde la pantalla. Pero el transporte sí es real: se construye el mismo mensaje
// que ese sistema enviaría (con el id_mensaje_origen del último envío real a ese destino) y se PUBLICA en
// el tópico propio de ese destino (ucb-sis323-sub-d o -a); la suscripción real que ya mantiene abierta
// confirmaciones.service.iniciarConsumidor() es la que la recibe y la aplica (misma validación, mismo
// registro en EVENTOS_ENTRANTES que una confirmación genuina). Por eso esta llamada no devuelve el
// aguinaldo actualizado: el cierre ocurre poco después, de forma asíncrona, cuando esa suscripción procesa
// el mensaje.
async function simularConfirmacion(id, destinoRuta, datos = {}, identidad = {}) {
  const idResponsable = validarResponsable(identidad);
  const destino = DESTINO_RUTA[destinoRuta];
  if (!UUID_RE.test(id ?? "") || !destino) throw noEncontrado();
  responsableEn(await externos.listarPersonal(), idResponsable);
  const aguinaldo = await modelo.obtener(pool, id);
  if (!aguinaldo) throw noEncontrado();
  const gestion = nombreGestion(aguinaldo.gestion);
  if (aguinaldo.estado === "BORRADOR") {
    throw new ErrorApp(409, `La planilla de ${gestion} está en borrador: todavía no se envió a ${NOMBRE_DESTINO[destino]}.`);
  }
  const envio = (await eventos.ultimosDeAguinaldo(pool, id))[destino];
  if (!envio) {
    throw new ErrorApp(409, `Todavía no se registró el envío a ${NOMBRE_DESTINO[destino]}: no hay nada que confirmar.`);
  }
  const clientePubSub = pubsub.obtenerCliente();
  if (!clientePubSub) {
    throw new ErrorApp(
      503,
      "Pub/Sub no está configurado en este ambiente: no se puede simular la confirmación. Configure el emulador o las credenciales."
    );
  }
  const { resultado, referencia, motivo } = validarSimulacionConfirmacion(datos);
  const idMensaje = randomUUID();
  const cuerpo = armarConfirmacionSimulada({
    idMensaje,
    idAguinaldo: id,
    idMensajeOrigen: envio.id_evento,
    destino,
    resultado,
    referencia,
    motivo,
  });
  const topico = confirmaciones.topicoDeDestino(destino);
  const atributos = atributosDe(cuerpo);
  await confirmaciones.asegurarTopicoEnEmulador(clientePubSub, topico);
  let idPubSub;
  try {
    idPubSub = await conLimiteDeTiempo(clientePubSub.topic(topico).publishMessage({ json: cuerpo, attributes: atributos }));
  } catch (error) {
    throw new ErrorApp(503, `No se pudo publicar la confirmación simulada en ${topico}: ${error.message}`);
  }
  mensajesPublicados.registrar({ topico, idPubSub, atributos, cuerpo });
  return {
    simulado: true,
    topico,
    id_pubsub: idPubSub,
    mensaje: `Se publicó en ${topico} la confirmación simulada de ${NOMBRE_DESTINO[destino]}; se aplicará en unos segundos cuando RRHH la reciba por su suscripción.`,
  };
}

module.exports = { listar, obtener, generar, descartar, aprobar, reenviar, simularConfirmacion };
