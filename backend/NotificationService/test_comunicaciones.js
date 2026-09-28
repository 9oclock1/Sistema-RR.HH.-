// Script de pruebas para verificar RF-64, RF-65, RF-66, RF-67 y resolución de blockers
process.env.NODE_ENV = "test";
process.env.EMPLEADOS_SIMULADOS = "true";

const assert = require("assert");
const http = require("http");
const app = require("./index");
const servicio = require("./src/services/comunicaciones.service");
const { TIPO, ALCANCE } = require("./src/config/catalogos");
const pool = require("./src/config/db");

async function ejecutarPruebas() {
  console.log("=================================================================");
  console.log("INICIANDO SUITE DE PRUEBAS PARA NOTIFICATION SERVICE (RF-64..RF-67)");
  console.log("=================================================================\n");

  const idAna = "4192f252-acf0-4522-a109-e051cad9a50b"; // Activa
  const idCarla = "d97320a7-c29b-4405-a33b-a48dc65c6090"; // Inactiva
  const idLuis = "cb7995a6-4b23-4738-ab8b-37d0b203d73b"; // Activo / Supervisor

  // ==============================================================
  // BLOQUE 1: VALIDACIONES DE IDENTIDAD Y SEGURIDAD (BLOCKERS)
  // ==============================================================
  console.log("1. Probando Validaciones de Identidad y Bloqueo de Fallbacks Silenciosos...");

  // 1.1 Remitente obligatorio en comunicación directa (sin fallback silencioso al destinatario)
  try {
    await servicio.enviarComunicacionDirecta({
      idUsuarioRemitente: null,
      idEmpleadoDestinatario: idAna,
      asunto: "Prueba sin remitente",
      contenido: "Contenido de prueba",
    });
    assert.fail("Debió fallar por remitente ausente");
  } catch (err) {
    assert.strictEqual(err.estado, 401);
    console.log("  ✓ Superado: Rechaza mensaje directo sin identidad de remitente (401).");
  }

  // 1.2 Remitente obligatorio en comunicado institucional (sin fallback al primer empleado)
  try {
    await servicio.emitirComunicadoInstitucional({
      idUsuarioRemitente: null,
      tipoCodigo: TIPO.COMUNICADO,
      alcanceCodigo: ALCANCE.GENERAL,
      asunto: "Comunicado general",
      contenido: "Contenido comunicado",
    });
    assert.fail("Debió fallar por remitente ausente");
  } catch (err) {
    assert.strictEqual(err.estado, 401);
    console.log("  ✓ Superado: Rechaza comunicado institucional sin identidad de remitente (401).");
  }

  // 1.3 Validación estricta de alcance (sin fallback silencioso a GENERAL si está mal escrito)
  try {
    await servicio.emitirComunicadoInstitucional({
      idUsuarioRemitente: idLuis,
      tipoCodigo: TIPO.COMUNICADO,
      alcanceCodigo: "DEPARTAMENT0", // Error tipográfico
      asunto: "Comunicado con scope erróneo",
      contenido: "No debe enviarse a toda la organización por error",
    });
    assert.fail("Debió rechazar alcance mal tipado");
  } catch (err) {
    assert.strictEqual(err.estado, 400);
    assert(err.message.includes("DEPARTAMENT0"));
    console.log("  ✓ Superado: Rechaza alcance mal tipado (DEPARTAMENT0) con 400 sin enviar a toda la empresa.");
  }

  // 1.4 Validación estricta de tipo de comunicación (sin fallback silencioso a COMUNICADO)
  try {
    await servicio.emitirComunicadoInstitucional({
      idUsuarioRemitente: idLuis,
      tipoCodigo: "TIPO_INEXISTENTE",
      alcanceCodigo: ALCANCE.GENERAL,
      asunto: "Comunicado con tipo erróneo",
      contenido: "No debe convertirse silenciosamente a Comunicado",
    });
    assert.fail("Debió rechazar tipo inexistente");
  } catch (err) {
    assert.strictEqual(err.estado, 400);
    assert(err.message.includes("TIPO_INEXISTENTE"));
    console.log("  ✓ Superado: Rechaza tipo de comunicación inválido con 400 sin fallback silencioso.");
  }

  // 1.5 Validación de formato UUID en identificadores
  try {
    await servicio.enviarComunicacionDirecta({
      idUsuarioRemitente: "no-es-uuid",
      idEmpleadoDestinatario: idAna,
      asunto: "Asunto válido",
      contenido: "Contenido válido",
    });
    assert.fail("Debió fallar por UUID inválido");
  } catch (err) {
    assert.strictEqual(err.estado, 400);
    assert(err.message.includes("UUID válido"));
    console.log("  ✓ Superado: Rechaza UUID inválido de remitente con 400 (evita 500 de PostgreSQL).");
  }

  // ==============================================================
  // BLOQUE 2: CRITERIOS DE NEGOCIO (RF-64 & RF-65)
  // ==============================================================
  console.log("\n2. Probando Criterios de Negocio RF-64 y RF-65...");

  // 2.1 Validación de campos obligatorios (asunto y contenido)
  try {
    await servicio.enviarComunicacionDirecta({
      idUsuarioRemitente: idLuis,
      idEmpleadoDestinatario: idAna,
      asunto: "   ",
      contenido: "",
    });
    assert.fail("Debió fallar por campos obligatorios vacíos");
  } catch (err) {
    assert.strictEqual(err.estado, 400);
    assert.strictEqual(err.detalles.length, 2);
    console.log("  ✓ RF-64 Criterio 2 superado: Rechaza mensaje sin asunto o contenido.");
  }

  // 2.2 Validación de destinatario inactivo (RF-64 Criterio 4)
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
    console.log("  ✓ RF-64 Criterio 4 superado: Rechaza envío a empleado inactivo con 422 e indica motivo.");
  }

  // 2.3 Grupo sin empleados activos (RF-65 Criterio 3)
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
    console.log("  ✓ RF-65 Criterio 3 superado: Informa grupo sin empleados activos (422) y no registra.");
  }

  // ==============================================================
  // BLOQUE 3: CAPA HTTP EXPRESS (RUTAS, ROLES Y ERRORES 404/400)
  // ==============================================================
  console.log("\n3. Probando Capa HTTP Express (Rutas, Roles y Manejo de Errores)...");

  // Iniciar servidor en puerto efímero
  const servidor = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const puerto = servidor.address().port;
  const baseUrl = `http://127.0.0.1:${puerto}`;

  try {
    // 3.1 Rutas desconocidas retornan JSON 404 (no HTML)
    const res404 = await fetch(`${baseUrl}/api/ruta-que-no-existe-en-el-sistema`);
    assert.strictEqual(res404.status, 404);
    assert.strictEqual(res404.headers.get("content-type")?.includes("application/json"), true);
    const json404 = await res404.json();
    assert.strictEqual(json404.exito, false);
    assert(json404.error.includes("Ruta no encontrada"));
    console.log("  ✓ Superado: Rutas desconocidas retornan JSON 404 en vez de HTML.");

    // 3.2 Identificador no UUID en la URL retorna 400 (no 500)
    const resIdInvalido = await fetch(`${baseUrl}/comunicaciones/mensaje/no-es-uuid`, {
      headers: {
        "X-Empleado-Id": idAna,
      },
    });
    assert.strictEqual(resIdInvalido.status, 400);
    const jsonIdInvalido = await resIdInvalido.json();
    assert(jsonIdInvalido.error.includes("UUID válido"));
    console.log("  ✓ Superado: Parámetro de ruta con ID no-UUID retorna HTTP 400 en vez de 500.");

    // 3.3 Cabecera X-Empleado-Id con formato no UUID retorna 400 (no 500)
    const resHeaderInvalido = await fetch(`${baseUrl}/comunicaciones/bandeja`, {
      headers: {
        "X-Empleado-Id": "12345",
      },
    });
    assert.strictEqual(resHeaderInvalido.status, 400);
    const jsonHeaderInvalido = await resHeaderInvalido.json();
    assert(jsonHeaderInvalido.error.includes("X-Empleado-Id"));
    console.log("  ✓ Superado: Encabezado X-Empleado-Id no-UUID retorna HTTP 400 en vez de 500.");

    // 3.4 Control de roles: Empleado común NO puede emitir comunicado institucional
    const resRolEmpleado = await fetch(`${baseUrl}/comunicaciones/institucional`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Usuario-Id": idAna,
        "X-Rol": "empleado",
      },
      body: JSON.stringify({
        asunto: "Comunicado no autorizado",
        contenido: "Intentando emitir como empleado común",
      }),
    });
    assert.strictEqual(resRolEmpleado.status, 403);
    const jsonRolEmpleado = await resRolEmpleado.json();
    assert(jsonRolEmpleado.error.includes("Acceso restringido"));
    console.log("  ✓ Superado: Empleado común recibe 403 Forbidden al intentar emitir comunicados.");

    // 3.5 Control de roles: Supervisor NO puede emitir comunicados institucionales (reservado a RRHH)
    const resRolSupervisor = await fetch(`${baseUrl}/comunicaciones/institucional`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Usuario-Id": idLuis,
        "X-Rol": "supervisor",
      },
      body: JSON.stringify({
        asunto: "Comunicado de supervisor",
        contenido: "Intentando emitir como supervisor",
      }),
    });
    assert.strictEqual(resRolSupervisor.status, 403);
    console.log("  ✓ Superado: Supervisor recibe 403 Forbidden al intentar emitir comunicados generales.");

    // 3.6 Auditoría sin autenticación es rechazada (401/403)
    const resAuditSinAuth = await fetch(`${baseUrl}/comunicaciones/${idAna}/auditoria`);
    assert(resAuditSinAuth.status === 401 || resAuditSinAuth.status === 403);
    console.log("  ✓ Superado: Endpoint de auditoría exige autenticación y rol autorizado.");

  } finally {
    servidor.close();
  }

  // ==============================================================
  // BLOQUE 4: VERIFICACIÓN DE BASE DE DATOS Y FLUJO COMPLETO
  // ==============================================================
  console.log("\n4. Verificando Persistencia en PostgreSQL...");

  let dbDisponible = false;
  try {
    const resDb = await pool.query("SELECT 1;");
    dbDisponible = resDb.rows.length > 0;
  } catch (err) {
    dbDisponible = false;
  }

  if (!dbDisponible) {
    console.log("  ℹ PostgreSQL no se encuentra en ejecución en este entorno local.");
    console.log("  ✓ Verificación de política: Sin DB, el microservicio no opera con tienda RAM simulada.");
    try {
      await servicio.enviarComunicacionDirecta({
        idUsuarioRemitente: idLuis,
        idEmpleadoDestinatario: idAna,
        asunto: "Test DB",
        contenido: "Test DB",
      });
      assert.fail("Debió fallar con 503 por desconexión de BD");
    } catch (err) {
      assert.strictEqual(err.estado, 503);
      console.log("  ✓ Superado: Operación devuelve 503 Service Unavailable y no 201 'entregado' en RAM.");
    }
  } else {
    console.log("  ✓ PostgreSQL conectado. Ejecutando flujo completo de extremo a extremo...");

    // Enviar mensaje directo con supervisor como remitente real
    const envioDirecto = await servicio.enviarComunicacionDirecta({
      idUsuarioRemitente: idLuis,
      idEmpleadoDestinatario: idAna,
      asunto: "Coordinación de inventario",
      contenido: "Favor revisar los ítems de almacén.",
      requiereConfirmacion: false,
    });
    assert(envioDirecto.id_comunicacion);
    console.log("  ✓ RF-64 Criterio 1: Mensaje directo persistido en PostgreSQL.");

    // Consultar bandeja de Ana: el remitente debe ser Luis Rojas y no 'Administración de RRHH'
    const bandejaAna = await servicio.consultarBandeja(idAna);
    const mensajeEnBandeja = bandejaAna.mensajes.find((m) => m.id_comunicacion === envioDirecto.id_comunicacion);
    assert(mensajeEnBandeja, "El mensaje debe estar en la bandeja");
    assert(mensajeEnBandeja.remitente_nombre.includes("Luis Rojas"), `El remitente debe ser Luis Rojas, valor actual: ${mensajeEnBandeja.remitente_nombre}`);
    console.log(`  ✓ Remitente resuelto: "${mensajeEnBandeja.remitente_nombre}" en la bandeja del destinatario.`);

    // Consultar enviados del supervisor: el mensaje debe figurar con el nombre del destinatario
    const enviadosSupervisor = await servicio.consultarEnviados(idLuis, { rol: "supervisor" });
    const enviadoEncontrado = enviadosSupervisor.find((e) => e.id_comunicacion === envioDirecto.id_comunicacion);
    assert(enviadoEncontrado, "El mensaje debe aparecer en enviados del supervisor");
    assert(enviadoEncontrado.nombre_destinatario_directo.includes("Ana"), "Debe mostrar el nombre del destinatario");
    console.log(`  ✓ Enviados del supervisor: Destinatario "${enviadoEncontrado.nombre_destinatario_directo}".`);

    // Intentar confirmar mensaje no obligatorio: debe fallar con 400
    try {
      await servicio.confirmarRecepcion(mensajeEnBandeja.id_destinatario, idAna);
      assert.fail("No debió permitir confirmar mensaje no obligatorio");
    } catch (err) {
      assert.strictEqual(err.estado, 400);
      console.log("  ✓ Confirmaciones: Rechaza confirmar mensaje no obligatorio con 400.");
    }
  }

  console.log("\n=================================================================");
  console.log("¡TODAS LAS PRUEBAS Y VERIFICACIONES DE BLOCKERS PASARON EXITOSAMENTE!");
  console.log("=================================================================\n");
}

ejecutarPruebas()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ ERROR EN SUITE DE PRUEBAS:", err);
    process.exit(1);
  });
