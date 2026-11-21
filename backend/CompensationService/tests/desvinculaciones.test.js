const { test, describe, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");

const pool = require("../src/config/db");
const modelo = require("../src/models/desvinculacionesModel");
const empleadosCliente = require("../src/clients/empleados.cliente");
const servicio = require("../src/services/desvinculacionesService");
const { ErrorApp } = require("../src/utils/errores");
const { validarDatosDesvinculacion } = require("../src/utils/desvinculaciones");
const { hoyLaPaz, sumarDias } = require("../src/utils/fechas");

const ID_EMPLEADO = "11111111-1111-1111-1111-111111111111";
const ID_ADMIN = "22222222-2222-2222-2222-222222222222";
const ID_PROCESO = "33333333-3333-3333-3333-333333333333";
const IDENTIDAD_ADMIN = { idEmpleado: ID_ADMIN, rol: "admin" };

const ARCHIVO_PDF = {
  originalname: "respaldo.pdf",
  mimetype: "application/pdf",
  size: 128,
  buffer: Buffer.from("%PDF-1.4\n"),
};

const EMPLEADO_ACTIVO = {
  id_empleado: ID_EMPLEADO,
  nombres: "Ana",
  apellidos: "Torrez Villca",
  fecha_ingreso: "2023-03-01",
  activo: true,
};

const CAUSALES = {
  RENUNCIA: { codigo: "RENUNCIA", nombre: "Renuncia voluntaria", corresponde_desahucio: false, esta_activo: true },
  CONCLUSION_CONTRATO: { codigo: "CONCLUSION_CONTRATO", nombre: "Conclusión de contrato", corresponde_desahucio: false, esta_activo: true },
  DESPIDO_LEGAL: { codigo: "DESPIDO_LEGAL", nombre: "Despido legal (causa justificada)", corresponde_desahucio: false, esta_activo: true },
  DESAHUCIO: { codigo: "DESAHUCIO", nombre: "Desahucio", corresponde_desahucio: true, esta_activo: true },
};

function crearClienteFalso() {
  const comandos = [];
  return {
    comandos,
    async query(sql) {
      comandos.push(String(sql).trim());
      return { rows: [] };
    },
    release() {},
  };
}

function datosValidos(extras = {}) {
  return {
    id_empleado: ID_EMPLEADO,
    codigo_causal: "RENUNCIA",
    fecha_retiro: hoyLaPaz(),
    observaciones: "Entrega de carta firmada",
    ...extras,
  };
}

afterEach(() => {
  mock.restoreAll();
});

describe("validarDatosDesvinculacion", () => {
  test("sin datos marca todos los obligatorios", () => {
    try {
      validarDatosDesvinculacion({}, null);
      assert.fail("debía lanzar error 400");
    } catch (error) {
      assert.equal(error.estado, 400);
      const campos = error.detalles.map((d) => d.campo).sort();
      assert.deepEqual(campos, ["codigo_causal", "documento", "fecha_retiro", "id_empleado"]);
    }
  });

  test("rechaza UUID inválido, fecha inválida, observaciones > 500 y falta de documento", () => {
    try {
      validarDatosDesvinculacion(
        {
          id_empleado: "no-es-uuid",
          codigo_causal: "RENUNCIA",
          fecha_retiro: "2026-99-99",
          observaciones: "x".repeat(501),
        },
        null
      );
      assert.fail("debía lanzar error 400");
    } catch (error) {
      assert.equal(error.estado, 400);
      const campos = error.detalles.map((d) => d.campo).sort();
      assert.deepEqual(campos, ["documento", "fecha_retiro", "id_empleado", "observaciones"]);
    }
  });
});

describe("desvinculacionesService.registrar", () => {
  for (const [codigo, esperadoDesahucio] of [
    ["RENUNCIA", false],
    ["CONCLUSION_CONTRATO", false],
    ["DESPIDO_LEGAL", false],
    ["DESAHUCIO", true],
  ]) {
    test(`registra proceso INICIADO para causal ${codigo} (desahucio=${esperadoDesahucio}) y da de baja en EmployeeService`, async () => {
      const clienteFalso = crearClienteFalso();
      mock.method(pool, "connect", async () => clienteFalso);
      mock.method(modelo, "obtenerCausalActiva", async () => CAUSALES[codigo]);
      mock.method(empleadosCliente, "obtenerEmpleado", async () => EMPLEADO_ACTIVO);
      mock.method(modelo, "obtenerProcesoAbiertoPorEmpleado", async () => null);

      let procesoInsertado = null;
      mock.method(modelo, "crearProceso", async (_cliente, datos) => {
        procesoInsertado = datos;
        return ID_PROCESO;
      });
      mock.method(modelo, "crearDocumento", async () => {});
      const bajaMock = mock.method(empleadosCliente, "darDeBaja", async () => ({ id_empleado: ID_EMPLEADO }));
      mock.method(modelo, "obtenerProceso", async () => ({
        id_proceso: ID_PROCESO,
        id_empleado: ID_EMPLEADO,
        nombre_empleado: "Ana Torrez Villca",
        fecha_ingreso: EMPLEADO_ACTIVO.fecha_ingreso,
        causal: { codigo, nombre: CAUSALES[codigo].nombre },
        fecha_retiro: hoyLaPaz(),
        corresponde_desahucio: esperadoDesahucio,
        estado: "INICIADO",
        observaciones: "Entrega de carta firmada",
        documento: { nombre_archivo: ARCHIVO_PDF.originalname, tipo_mime: ARCHIVO_PDF.mimetype, tamano_bytes: ARCHIVO_PDF.size },
        registrado_por: ID_ADMIN,
        creado_en: new Date().toISOString(),
      }));

      const resultado = await servicio.registrar(datosValidos({ codigo_causal: codigo }), ARCHIVO_PDF, IDENTIDAD_ADMIN);

      assert.equal(resultado.estado, "INICIADO");
      assert.equal(resultado.corresponde_desahucio, esperadoDesahucio);
      assert.equal(procesoInsertado.corresponde_desahucio, esperadoDesahucio);
      assert.equal(bajaMock.mock.callCount(), 1);
      assert.deepEqual(bajaMock.mock.calls[0].arguments, [ID_EMPLEADO]);
      assert.ok(clienteFalso.comandos.includes("BEGIN"));
      assert.ok(clienteFalso.comandos.includes("COMMIT"));
      assert.ok(!clienteFalso.comandos.includes("ROLLBACK"));
    });
  }

  test("rechaza causal inexistente o inactiva con 400 CAUSAL_INVALIDA", async () => {
    mock.method(modelo, "obtenerCausalActiva", async () => null);
    await assert.rejects(
      () => servicio.registrar(datosValidos({ codigo_causal: "INEXISTENTE" }), ARCHIVO_PDF, IDENTIDAD_ADMIN),
      (err) => err.estado === 400 && err.codigo === "CAUSAL_INVALIDA"
    );
  });

  test("rechaza colaborador inexistente con 404", async () => {
    mock.method(modelo, "obtenerCausalActiva", async () => CAUSALES.RENUNCIA);
    mock.method(empleadosCliente, "obtenerEmpleado", async () => null);
    await assert.rejects(
      () => servicio.registrar(datosValidos(), ARCHIVO_PDF, IDENTIDAD_ADMIN),
      (err) => err.estado === 404
    );
  });

  test("rechaza colaborador inactivo con 409 COLABORADOR_INACTIVO", async () => {
    mock.method(modelo, "obtenerCausalActiva", async () => CAUSALES.RENUNCIA);
    mock.method(empleadosCliente, "obtenerEmpleado", async () => ({ ...EMPLEADO_ACTIVO, activo: false }));
    await assert.rejects(
      () => servicio.registrar(datosValidos(), ARCHIVO_PDF, IDENTIDAD_ADMIN),
      (err) => err.estado === 409 && err.codigo === "COLABORADOR_INACTIVO"
    );
  });

  test("rechaza fecha_retiro anterior al ingreso o posterior a hoy con 400 en fecha_retiro", async () => {
    mock.method(modelo, "obtenerCausalActiva", async () => CAUSALES.RENUNCIA);
    mock.method(empleadosCliente, "obtenerEmpleado", async () => EMPLEADO_ACTIVO);

    await assert.rejects(
      () => servicio.registrar(datosValidos({ fecha_retiro: "2023-02-28" }), ARCHIVO_PDF, IDENTIDAD_ADMIN),
      (err) => err.estado === 400 && err.detalles?.[0]?.campo === "fecha_retiro"
    );

    await assert.rejects(
      () => servicio.registrar(datosValidos({ fecha_retiro: sumarDias(hoyLaPaz(), 1) }), ARCHIVO_PDF, IDENTIDAD_ADMIN),
      (err) => err.estado === 400 && err.detalles?.[0]?.campo === "fecha_retiro"
    );
  });

  test("si darDeBaja falla con 503, la transacción hace ROLLBACK y no COMMIT", async () => {
    const clienteFalso = crearClienteFalso();
    mock.method(pool, "connect", async () => clienteFalso);
    mock.method(modelo, "obtenerCausalActiva", async () => CAUSALES.RENUNCIA);
    mock.method(empleadosCliente, "obtenerEmpleado", async () => EMPLEADO_ACTIVO);
    mock.method(modelo, "obtenerProcesoAbiertoPorEmpleado", async () => null);
    mock.method(modelo, "crearProceso", async () => ID_PROCESO);
    mock.method(modelo, "crearDocumento", async () => {});
    mock.method(empleadosCliente, "darDeBaja", async () => {
      throw new ErrorApp(503, "EmployeeService no disponible");
    });

    await assert.rejects(
      () => servicio.registrar(datosValidos(), ARCHIVO_PDF, IDENTIDAD_ADMIN),
      (err) => err.estado === 503
    );

    assert.ok(clienteFalso.comandos.includes("BEGIN"));
    assert.ok(clienteFalso.comandos.includes("ROLLBACK"));
    assert.ok(!clienteFalso.comandos.includes("COMMIT"));
  });

  test("bloquea duplicados si existe proceso abierto (INICIADO o EN_CURSO) con 409 PROCESO_ABIERTO", async () => {
    mock.method(modelo, "obtenerCausalActiva", async () => CAUSALES.RENUNCIA);
    mock.method(empleadosCliente, "obtenerEmpleado", async () => EMPLEADO_ACTIVO);
    mock.method(modelo, "obtenerProcesoAbiertoPorEmpleado", async () => ({ id_proceso: ID_PROCESO, estado: "INICIADO" }));
    const crearMock = mock.method(modelo, "crearProceso", async () => ID_PROCESO);

    await assert.rejects(
      () => servicio.registrar(datosValidos(), ARCHIVO_PDF, IDENTIDAD_ADMIN),
      (err) => err.estado === 409 && err.codigo === "PROCESO_ABIERTO"
    );
    assert.equal(crearMock.mock.callCount(), 0);
  });

  test("permite registrar si el proceso anterior fue CERRADO o ANULADO (obtenerProcesoAbiertoPorEmpleado devuelve null)", async () => {
    const clienteFalso = crearClienteFalso();
    mock.method(pool, "connect", async () => clienteFalso);
    mock.method(modelo, "obtenerCausalActiva", async () => CAUSALES.RENUNCIA);
    mock.method(empleadosCliente, "obtenerEmpleado", async () => EMPLEADO_ACTIVO);
    mock.method(modelo, "obtenerProcesoAbiertoPorEmpleado", async () => null);
    mock.method(modelo, "crearProceso", async () => ID_PROCESO);
    mock.method(modelo, "crearDocumento", async () => {});
    mock.method(empleadosCliente, "darDeBaja", async () => ({ id_empleado: ID_EMPLEADO }));
    mock.method(modelo, "obtenerProceso", async () => ({ id_proceso: ID_PROCESO, estado: "INICIADO" }));

    const res = await servicio.registrar(datosValidos(), ARCHIVO_PDF, IDENTIDAD_ADMIN);
    assert.equal(res.estado, "INICIADO");
  });

  test("convierte error 23505 de PostgreSQL en 409 PROCESO_ABIERTO y revierte la transacción", async () => {
    const clienteFalso = crearClienteFalso();
    mock.method(pool, "connect", async () => clienteFalso);
    mock.method(modelo, "obtenerCausalActiva", async () => CAUSALES.RENUNCIA);
    mock.method(empleadosCliente, "obtenerEmpleado", async () => EMPLEADO_ACTIVO);
    mock.method(modelo, "obtenerProcesoAbiertoPorEmpleado", async () => null);
    mock.method(modelo, "crearProceso", async () => {
      const errorPg = new Error("duplicate key value violates unique constraint");
      errorPg.code = "23505";
      throw errorPg;
    });

    await assert.rejects(
      () => servicio.registrar(datosValidos(), ARCHIVO_PDF, IDENTIDAD_ADMIN),
      (err) => err.estado === 409 && err.codigo === "PROCESO_ABIERTO"
    );
    assert.ok(clienteFalso.comandos.includes("ROLLBACK"));
  });

  test("rechaza con 403 si falta X-Rol o si el rol no es admin", async () => {
    await assert.rejects(
      () => servicio.listar({}, { rol: null }),
      (err) => err.estado === 403
    );
    await assert.rejects(
      () => servicio.registrar(datosValidos(), ARCHIVO_PDF, { rol: "supervisor" }),
      (err) => err.estado === 403
    );
    await assert.rejects(
      () => servicio.listarCausales({ rol: "empleado" }),
      (err) => err.estado === 403
    );
  });
});
