// Script de pruebas para verificar RF-64, RF-65, RF-66 y RF-67
process.env.NODE_ENV = "test";
const assert = require("assert");
const servicio = require("./src/services/comunicaciones.service");
const { TIPO, ALCANCE } = require("./src/config/catalogos");

async function ejecutarPruebas() {
  console.log("Iniciando pruebas de aceptación para NotificationService...\n");

  const idAna = "4192f252-acf0-4522-a109-e051cad9a50b"; // Activa
  const idCarla = "d97320a7-c29b-4405-a33b-a48dc65c6090"; // Inactiva
  const idLuis = "cb7995a6-4b23-4738-ab8b-37d0b203d73b"; // Activo / Supervisor

  // ==========================================
  // RF-64: Comunicaciones Directas
  // ==========================================
  console.log("1. Probando RF-64: Comunicaciones Directas...");

  // Criterio 2: Si no tiene asunto o contenido, el sistema lo impide
  try {
    await servicio.enviarComunicacionDirecta({
      idUsuarioRemitente: idLuis,
      idEmpleadoDestinatario: idAna,
      asunto: "",
      contenido: "",
    });
    assert.fail("Debió fallar por campos vacíos");
  } catch (err) {
    assert.strictEqual(err.estado, 400);
    assert.strictEqual(err.detalles.length, 2);
    console.log("  ✓ Criterio 2 superado: Rechaza mensaje sin asunto o contenido.");
  }

  // Criterio 4: Si el destinatario no es un empleado activo, lo rechaza e indica motivo
  try {
    await servicio.enviarComunicacionDirecta({
      idUsuarioRemitente: idLuis,
      idEmpleadoDestinatario: idCarla,
      asunto: "Revisión de informe",
      contenido: "Favor revisar los datos adjuntos.",
    });
    assert.fail("Debió fallar porque Carla es inactiva");
  } catch (err) {
    assert.strictEqual(err.estado, 422);
    assert(err.message.includes("no es un empleado activo"));
    console.log("  ✓ Criterio 4 superado: Rechaza envío a empleado inactivo e indica motivo.");
  }

  // Criterio 1: Envío exitoso a empleado activo y entrega en su bandeja
  const envioDirecto = await servicio.enviarComunicacionDirecta({
    idUsuarioRemitente: idLuis,
    idEmpleadoDestinatario: idAna,
    asunto: "Reunión de coordinación semanal",
    contenido: "Estimada Ana, la reunión se llevará a cabo el martes a las 09:00.",
    requiereConfirmacion: false,
    remitenteNombre: "Luis Rojas (Supervisor)",
  });
  assert(envioDirecto.id_comunicacion);
  console.log("  ✓ Criterio 1 superado: Mensaje directo guardado y entregado al destinatario.");

  // Criterio 3: En enviados se visualiza con su destinatario y fecha
  const enviadosSupervisor = await servicio.consultarEnviados(idLuis, { rol: "supervisor" });
  const encontrado = enviadosSupervisor.find((e) => e.id_comunicacion === envioDirecto.id_comunicacion);
  assert(encontrado, "El mensaje enviado debe aparecer en enviados");
  assert(encontrado.fecha_envio);
  console.log("  ✓ Criterio 3 superado: En enviados se muestra el mensaje, destinatario y fecha.");

  // ==========================================
  // RF-65: Distribución Institucional
  // ==========================================
  console.log("\n2. Probando RF-65: Distribución Institucional...");

  // Criterio 3: Si el grupo no tiene empleados activos, informa y no registra
  const deptoSinActivos = "99999999-9999-4999-a999-999999999999"; // Auditoría Interna
  try {
    await servicio.emitirComunicadoInstitucional({
      idUsuarioRemitente: idLuis,
      tipoCodigo: TIPO.CIRCULAR,
      alcanceCodigo: ALCANCE.DEPARTAMENTO,
      idDepartamentoDestino: deptoSinActivos,
      asunto: "Procedimiento de arqueo",
      contenido: "Nueva circular para auditoría.",
    });
    assert.fail("Debió fallar por grupo sin activos");
  } catch (err) {
    assert.strictEqual(err.estado, 422);
    assert(err.message.includes("no cuenta con ningún empleado activo"));
    console.log("  ✓ Criterio 3 superado: Informa que no hay empleados activos y no registra el intento.");
  }

  // Criterio 1 y 2: Emisión general y cantidad de destinatarios alcanzados
  const emisionGeneral = await servicio.emitirComunicadoInstitucional({
    idUsuarioRemitente: idLuis,
    tipoCodigo: TIPO.COMUNICADO,
    alcanceCodigo: ALCANCE.GENERAL,
    asunto: "Horario de atención durante feriados",
    contenido: "Se comunica a todo el personal el nuevo esquema de turnos para feriados.",
    requiereConfirmacion: true,
  });
  assert(emisionGeneral.cantidad_destinatarios > 0);
  console.log(`  ✓ Criterio 1 y 2 superados: Entregado a ${emisionGeneral.cantidad_destinatarios} empleados activos.`);

  // Criterio 4: Empleado del grupo accede a su bandeja y ve el comunicado
  const bandejaAna = await servicio.consultarBandeja(idAna);
  const memoEnBandeja = bandejaAna.mensajes.find((m) => m.id_comunicacion === emisionGeneral.id_comunicacion);
  assert(memoEnBandeja, "El comunicado debe figurar en la bandeja del empleado");
  console.log("  ✓ Criterio 4 superado: El empleado ve el comunicado en su bandeja de entrada.");

  // ==========================================
  // RF-66: Visualización en Portal de Empleados
  // ==========================================
  console.log("\n3. Probando RF-66: Bandeja en Portal de Empleado...");

  // Criterio 1: Ordenados de más reciente a más antiguo
  for (let i = 0; i < bandejaAna.mensajes.length - 1; i++) {
    const actual = new Date(bandejaAna.mensajes[i].fecha_envio).getTime();
    const siguiente = new Date(bandejaAna.mensajes[i + 1].fecha_envio).getTime();
    assert(actual >= siguiente, "La lista debe estar ordenada del más reciente al más antiguo");
  }
  console.log("  ✓ Criterio 1 superado: Mensajes ordenados de más reciente a más antiguo.");

  // Criterio 2: Mensaje no abierto marcado como no leído
  assert.strictEqual(memoEnBandeja.estado_codigo, "NO_LEIDO");
  console.log("  ✓ Criterio 2 superado: Mensaje no abierto aparece marcado como no leído.");

  // Criterio 3: Al abrir el mensaje, se marca como leído y registra fecha de lectura
  const mensajeAbierto = await servicio.abrirMensaje(memoEnBandeja.id_destinatario, idAna);
  assert.strictEqual(mensajeAbierto.estado_codigo, "LEIDO");
  assert(mensajeAbierto.fecha_lectura);
  console.log("  ✓ Criterio 3 superado: Mensaje marcado como leído con fecha de lectura registrada.");

  // Criterio 4: Empleado sin mensajes recibe estado vacío (0 mensajes)
  const empleadoSinMensajes = "00000000-0000-0000-0000-000000000099";
  const bandejaVacia = await servicio.consultarBandeja(empleadoSinMensajes);
  assert.strictEqual(bandejaVacia.mensajes.length, 0);
  assert.strictEqual(bandejaVacia.total, 0);
  console.log("  ✓ Criterio 4 superado: Empleado sin mensajes recibe total 0 para estado vacío.");

  // ==========================================
  // RF-67: Auditoría y Confirmación de Recepción
  // ==========================================
  console.log("\n4. Probando RF-67: Auditoría y Confirmación de Recepción...");

  // Criterio 1: Comunicación obligatoria solicita confirmación explícita
  assert.strictEqual(mensajeAbierto.solicita_confirmacion, true);
  console.log("  ✓ Criterio 1 superado: Comunicación obligatoria solicita confirmación explícita.");

  // Criterio 4: Comunicación no obligatoria se marca leída sin solicitar confirmación
  const msgNoObligatorio = bandejaAna.mensajes.find((m) => m.id_comunicacion === envioDirecto.id_comunicacion);
  const abiertoNoOblig = await servicio.abrirMensaje(msgNoObligatorio.id_destinatario, idAna);
  assert.strictEqual(abiertoNoOblig.solicita_confirmacion, false);
  console.log("  ✓ Criterio 4 superado: Comunicación no obligatoria leída sin solicitar confirmación.");

  // Criterio 2 y 3: Confirmación de recepción y consulta de auditoría
  const confirmacion = await servicio.confirmarRecepcion(memoEnBandeja.id_destinatario, idAna);
  assert.strictEqual(confirmacion.exito, true);
  assert(confirmacion.fecha_confirmacion);

  // Auditoría por parte del administrador
  const auditoria = await servicio.consultarAuditoria(emisionGeneral.id_comunicacion);
  const confirmadoAna = auditoria.confirmados.find((c) => c.id_empleado === idAna);
  assert(confirmadoAna, "Ana debe figurar en la lista de confirmados");
  assert(confirmadoAna.fecha_confirmacion);
  console.log("  ✓ Criterio 2 superado: Administrador visualiza nombre y fecha de confirmación.");

  assert(auditoria.pendientes.length > 0, "Deben existir empleados pendientes");
  console.log(`  ✓ Criterio 3 superado: Administrador visualiza ${auditoria.pendientes.length} destinatarios pendientes.`);

  console.log("\n==========================================");
  console.log("¡TODAS LAS PRUEBAS DE ACEPTACIÓN PASARON CON ÉXITO!");
  console.log("==========================================");
}

ejecutarPruebas().catch((err) => {
  console.error("Error en pruebas:", err);
  process.exit(1);
});
