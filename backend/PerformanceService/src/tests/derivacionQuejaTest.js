const { describe, it, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

process.env.EMPLOYEE_SERVICE_URL = "http://empleados.prueba";
process.env.NOTIFICATION_SERVICE_URL = "http://notificaciones.prueba";
process.env.QUEJAS_AREAS_RRHH = "RRHH";

const clienteFalso = { query: async () => ({ rows: [] }) };
const rutaTransaccion = require.resolve(path.join(__dirname, "../config/transaccion"));
require.cache[rutaTransaccion] = {
  id: rutaTransaccion,
  filename: rutaTransaccion,
  loaded: true,
  exports: { enTransaccion: async (trabajo) => trabajo(clienteFalso) },
};

const modelo = require("../models/casosQuejaModel");
const quejasModelo = require("../models/quejasModel");
const servicio = require("../services/casosQuejaService");
const { ErrorApp } = require("../utils/errores");

const id = (n) => `c0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const QUEJA = id(1);
const ADMIN = id(10);
const RRHH = id(11);
const SUPERVISOR = id(12);
const CAJERO = id(13);
const RRHH_INACTIVO = id(14);
const DENUNCIANTE = id(15);
const AREA_RRHH = id(20);
const AREA_CAJAS = id(21);
const CARGO_JEFE = id(30);
const CARGO_CAJERO = id(31);
const ASIGNACION = id(40);
const DERIVADA_EN = new Date("2026-11-07T15:20:00.000Z");

const ASUNTO = "Gritos del encargado en cajas";
const DESCRIPCION = "El encargado del turno tarde grita a las cajeras frente a los clientes casi todos los días.";

const EMPLEADOS = [
  { id_empleado: RRHH, nombre_completo: "Rosa Rojas", id_departamento: AREA_RRHH, id_cargo: id(32), activo: true },
  { id_empleado: SUPERVISOR, nombre_completo: "Saúl Pérez", id_departamento: AREA_CAJAS, id_cargo: CARGO_JEFE, activo: true },
  { id_empleado: CAJERO, nombre_completo: "Carla Choque", id_departamento: AREA_CAJAS, id_cargo: CARGO_CAJERO, activo: true },
  { id_empleado: RRHH_INACTIVO, nombre_completo: "Iván Ibáñez", id_departamento: AREA_RRHH, id_cargo: id(33), activo: false },
  { id_empleado: DENUNCIANTE, nombre_completo: "Diana Durán", id_departamento: AREA_RRHH, id_cargo: id(34), activo: true },
];
const NOMBRES = {
  [ADMIN]: { nombres: "Ana", apellidos: "Administradora" },
  [RRHH]: { nombres: "Rosa", apellidos: "Rojas" },
  [SUPERVISOR]: { nombres: "Saúl", apellidos: "Pérez" },
  [DENUNCIANTE]: { nombres: "Diana", apellidos: "Durán" },
};

const respuestaJson = (estado, cuerpo) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { "Content-Type": "application/json" } });

describe("RF-69: clasificación y derivación de quejas (base simulada)", () => {
  let llamadas;
  let queja;

  const simular = ({ aviso = () => respuestaJson(201, { mensaje: "ok" }), involucrados = [], vigente = null } = {}) => {
    llamadas = { avisos: [], asignaciones: [], historial: [], actualizaciones: [], notificaciones: [], sincronizados: [] };
    mock.method(globalThis, "fetch", async (url, opciones = {}) => {
      const ruta = String(url);
      if (ruta.startsWith("http://notificaciones.prueba")) {
        llamadas.avisos.push({ ruta, cabeceras: opciones.headers, cuerpo: JSON.parse(opciones.body) });
        return aviso();
      }
      if (ruta === "http://empleados.prueba/empleados") return respuestaJson(200, EMPLEADOS);
      if (ruta === "http://empleados.prueba/departamentos") {
        return respuestaJson(200, [
          { id_departamento: AREA_RRHH, codigo: "RRHH", nombre: "Recursos Humanos" },
          { id_departamento: AREA_CAJAS, codigo: "CAJ", nombre: "Cajas" },
        ]);
      }
      if (ruta === "http://empleados.prueba/jerarquia/cargos") {
        return respuestaJson(200, [{ id_cargo: CARGO_CAJERO, id_cargo_superior: CARGO_JEFE }]);
      }
      const idEmpleado = ruta.split("/").pop();
      return NOMBRES[idEmpleado] ? respuestaJson(200, NOMBRES[idEmpleado]) : respuestaJson(404, {});
    });
    mock.method(quejasModelo, "listarCategorias", async () =>
      [1, 2, 3, 4].map((n) => ({ id_categoria_queja: n, codigo: `C${n}`, nombre: `Categoría ${n}` })),
    );
    mock.method(quejasModelo, "obtenerEstado", async (idEstado) =>
      idEstado === 2 ? { codigo: "ASIGNADA", nombre: "Asignada" } : { codigo: "REGISTRADA", nombre: "Registrada" },
    );
    mock.method(quejasModelo, "sincronizarEmpleado", async (db, datos) => llamadas.sincronizados.push(datos));
    mock.method(modelo, "listarPrioridades", async () =>
      ["BAJA", "MEDIA", "ALTA", "CRITICA"].map((codigo, i) => ({ id_prioridad_queja: i + 1, codigo, nombre: codigo })),
    );
    mock.method(modelo, "bloquearQueja", async () => queja);
    mock.method(modelo, "esInvolucrado", async (db, idQueja, idEmpleado) => involucrados.includes(idEmpleado));
    mock.method(modelo, "obtenerResponsableVigente", async () => vigente);
    mock.method(modelo, "actualizarQueja", async (db, datos) => {
      llamadas.actualizaciones.push(datos);
      return {
        id_categoria_queja: datos.idCategoria ?? queja.id_categoria_queja,
        id_prioridad_queja: datos.idPrioridad ?? queja.id_prioridad_queja,
        id_estado_queja: datos.idEstado ?? queja.id_estado_queja,
        actualizado_en: DERIVADA_EN,
      };
    });
    mock.method(modelo, "insertarAsignacion", async (db, datos) => {
      llamadas.asignaciones.push(datos);
      return { id_asignacion: ASIGNACION, asignada_en: DERIVADA_EN };
    });
    mock.method(modelo, "insertarHistorial", async (db, datos) => llamadas.historial.push(datos));
    mock.method(modelo, "obtenerDatosAviso", async () => ({
      id_empleado_responsable: llamadas.asignaciones.at(-1)?.idResponsable ?? RRHH,
      asignada_en: DERIVADA_EN,
      codigo_seguimiento: "QJ-7K3M-9XQ2",
      categoria: "Acoso",
      prioridad_codigo: "CRITICA",
      prioridad_nombre: "Crítica",
    }));
    mock.method(modelo, "registrarNotificacion", async (idAsignacion, idEstado) => {
      llamadas.notificaciones.push({ idAsignacion, idEstado });
      return { notificada_en: idEstado === 2 ? DERIVADA_EN : null };
    });
  };

  beforeEach(() => {
    queja = {
      id_queja: QUEJA,
      id_empleado_denunciante: null,
      id_categoria_queja: 1,
      id_prioridad_queja: null,
      id_estado_queja: 1,
      es_final: false,
    };
    mock.method(console, "error", () => {});
  });

  afterEach(() => mock.restoreAll());

  const derivar = (cuerpo) =>
    servicio.derivar({
      idQueja: QUEJA,
      idAdministrador: ADMIN,
      cuerpo: { id_categoria_queja: 2, id_prioridad_queja: 4, id_empleado_responsable: RRHH, ...cuerpo },
    });

  const rechazo = (estado, verificar) => (error) => {
    assert.ok(error instanceof ErrorApp);
    assert.equal(error.estado, estado);
    verificar?.(error);
    return true;
  };

  describe("Criterio 1: clasificar una queja nueva", () => {
    it("guarda la categoría (reclasifica) y la prioridad sin cambiar el estado", async () => {
      simular();
      const resultado = await servicio.clasificar({
        idQueja: QUEJA,
        cuerpo: { id_categoria_queja: "3", id_prioridad_queja: "2" },
      });
      assert.deepEqual(llamadas.actualizaciones, [{ idQueja: QUEJA, idCategoria: 3, idPrioridad: 2 }]);
      assert.equal(resultado.id_categoria_queja, 3);
      assert.equal(resultado.id_prioridad_queja, 2);
      assert.equal(llamadas.historial.length, 0);
    });

    it("rechaza categoría o prioridad que no existen", async () => {
      simular();
      await assert.rejects(
        servicio.clasificar({ idQueja: QUEJA, cuerpo: { id_categoria_queja: 9, id_prioridad_queja: "" } }),
        rechazo(400, (e) =>
          assert.deepEqual(
            e.detalles.map((d) => d.campo),
            ["id_categoria_queja", "id_prioridad_queja"],
          ),
        ),
      );
      assert.equal(llamadas.actualizaciones.length, 0);
    });

    it("no modifica una queja cerrada ni una inexistente", async () => {
      simular();
      queja.es_final = true;
      await assert.rejects(
        servicio.clasificar({ idQueja: QUEJA, cuerpo: { id_categoria_queja: 1, id_prioridad_queja: 1 } }),
        rechazo(409),
      );
      await assert.rejects(servicio.clasificar({ idQueja: "no-es-uuid", cuerpo: {} }), rechazo(404));
    });

    it("la derivación asigna categoría, prioridad y responsable, pasa a ASIGNADA y registra quién lo hizo", async () => {
      simular();
      const resultado = await derivar({ comentario: "  Revisar con el área de cajas  " });

      assert.deepEqual(llamadas.actualizaciones, [{ idQueja: QUEJA, idCategoria: 2, idPrioridad: 4, idEstado: 2 }]);
      assert.deepEqual(llamadas.asignaciones, [
        { idQueja: QUEJA, idResponsable: RRHH, idAsignador: ADMIN, comentario: "Revisar con el área de cajas" },
      ]);
      assert.deepEqual(llamadas.historial, [{ idQueja: QUEJA, idEstadoAnterior: 1, idEstado: 2, idEmpleado: ADMIN }]);
      assert.deepEqual(
        llamadas.sincronizados.map((s) => s.idEmpleado),
        [ADMIN, RRHH],
      );
      assert.deepEqual(resultado.estado, { codigo: "ASIGNADA", nombre: "Asignada" });
      assert.deepEqual(resultado.responsable, { id_empleado: RRHH, nombre_completo: "Rosa Rojas" });
    });

    it("una reasignación agrega la derivación sin repetir el historial de estados", async () => {
      simular({ vigente: SUPERVISOR });
      queja.id_estado_queja = 2;
      queja.id_prioridad_queja = 3;
      await derivar({ id_categoria_queja: "", id_prioridad_queja: "" });
      assert.equal(llamadas.asignaciones.length, 1);
      assert.equal(llamadas.historial.length, 0);
      assert.equal(llamadas.actualizaciones[0].idEstado, null);
    });

    it("exige una prioridad antes de derivar", async () => {
      simular();
      await assert.rejects(
        derivar({ id_prioridad_queja: undefined }),
        rechazo(422, (e) => assert.equal(e.detalles[0].campo, "id_prioridad_queja")),
      );
      assert.equal(llamadas.asignaciones.length, 0);
    });

    it("solo acepta como responsable a personal de RRHH o supervisores activos", async () => {
      simular();
      for (const persona of [CAJERO, RRHH_INACTIVO]) {
        await assert.rejects(derivar({ id_empleado_responsable: persona }), rechazo(422));
      }
      await derivar({ id_empleado_responsable: SUPERVISOR });
      assert.equal(llamadas.asignaciones[0].idResponsable, SUPERVISOR);
    });

    it("lista los candidatos con el motivo por el que pueden atender quejas", async () => {
      simular();
      const candidatos = await servicio.listarResponsables();
      assert.deepEqual(
        candidatos.map((c) => [c.id_empleado, c.motivo]),
        [
          [RRHH, "RRHH"],
          [SUPERVISOR, "SUPERVISOR"],
          [DENUNCIANTE, "RRHH"],
        ],
      );
    });
  });

  describe("Criterio 3: conflicto de interés", () => {
    it("rechaza con 409 CONFLICTO_INTERES si el responsable figura entre los involucrados", async () => {
      simular({ involucrados: [SUPERVISOR] });
      await assert.rejects(
        derivar({ id_empleado_responsable: SUPERVISOR }),
        rechazo(409, (e) => {
          assert.equal(e.detalles[0].codigo, "CONFLICTO_INTERES");
          assert.equal(e.detalles[0].campo, "id_empleado_responsable");
          assert.match(e.message, /conflicto de interés/i);
        }),
      );
      assert.equal(llamadas.asignaciones.length, 0);
      assert.equal(llamadas.historial.length, 0);
      assert.equal(llamadas.avisos.length, 0);
    });

    it("en una queja identificada, tampoco deriva al propio denunciante", async () => {
      simular();
      queja.id_empleado_denunciante = DENUNCIANTE;
      await assert.rejects(
        derivar({ id_empleado_responsable: DENUNCIANTE }),
        rechazo(409, (e) => assert.equal(e.detalles[0].codigo, "CONFLICTO_INTERES")),
      );
    });

    it("sin conflicto, deriva a otra persona aunque la queja tenga involucrados", async () => {
      simular({ involucrados: [SUPERVISOR] });
      const resultado = await derivar({ id_empleado_responsable: RRHH });
      assert.equal(resultado.responsable.id_empleado, RRHH);
    });

    it("no vuelve a derivar a quien ya es el responsable vigente", async () => {
      simular({ vigente: RRHH });
      queja.id_estado_queja = 2;
      await assert.rejects(derivar({ id_empleado_responsable: RRHH }), rechazo(409));
    });
  });

  describe("Criterio 2: el responsable recibe el aviso con el caso", () => {
    it("envía código, categoría, prioridad y fecha, sin asunto, descripción ni datos del denunciante", async () => {
      simular();
      queja.id_empleado_denunciante = DENUNCIANTE;
      const resultado = await derivar({ comentario: "Revisar con Diana Durán" });

      assert.equal(llamadas.avisos.length, 1);
      const { ruta, cabeceras, cuerpo } = llamadas.avisos[0];
      assert.equal(ruta, "http://notificaciones.prueba/comunicaciones/directa");
      assert.equal(cabeceras["X-Empleado-Id"], ADMIN);
      assert.equal(cabeceras["X-Rol"], "admin");
      assert.equal(cuerpo.id_empleado_destinatario, RRHH);
      assert.equal(cuerpo.prioridad, "ALTA");
      assert.match(cuerpo.asunto, /QJ-7K3M-9XQ2/);
      assert.match(cuerpo.contenido, /Código: QJ-7K3M-9XQ2/);
      assert.match(cuerpo.contenido, /Categoría: Acoso/);
      assert.match(cuerpo.contenido, /Prioridad: Crítica/);
      assert.match(cuerpo.contenido, /Fecha de derivación: 07\/11\/2026, 11:20/);

      const enviado = JSON.stringify(cuerpo);
      for (const prohibido of [ASUNTO, DESCRIPCION, DENUNCIANTE, "Diana", "Durán", "Revisar"]) {
        assert.ok(!enviado.includes(prohibido), `el aviso no debe incluir «${prohibido}»`);
      }
      assert.deepEqual(resultado.notificacion, { estado: "ENTREGADO", notificada_en: DERIVADA_EN });
      assert.deepEqual(llamadas.notificaciones, [{ idAsignacion: ASIGNACION, idEstado: 2 }]);
    });

    it("en una queja anónima el aviso solo lleva el código y la clasificación", async () => {
      simular();
      await derivar();
      const claves = Object.keys(llamadas.avisos[0].cuerpo).sort();
      assert.deepEqual(claves, [
        "asunto",
        "contenido",
        "id_empleado_destinatario",
        "notificar_correo",
        "prioridad",
        "remitente_nombre",
      ]);
      assert.equal(
        llamadas.avisos[0].cuerpo.contenido.split("\n").filter((linea) => linea.includes(":")).length,
        4,
      );
    });

    it("si NotificationService falla, la derivación queda hecha y el aviso como FALLIDO", async () => {
      simular({ aviso: () => respuestaJson(503, { error: "caído" }) });
      const resultado = await derivar();
      assert.equal(llamadas.asignaciones.length, 1);
      assert.deepEqual(resultado.notificacion, { estado: "FALLIDO", notificada_en: null });
      assert.deepEqual(llamadas.notificaciones, [{ idAsignacion: ASIGNACION, idEstado: 3 }]);
    });

    it("si NotificationService no responde, tampoco falla la derivación", async () => {
      simular({
        aviso: () => {
          throw new TypeError("fetch failed");
        },
      });
      const resultado = await derivar();
      assert.equal(resultado.notificacion.estado, "FALLIDO");
    });

    it("el reintento vuelve a enviar el aviso de la derivación vigente", async () => {
      simular();
      mock.method(modelo, "obtenerUltimaAsignacion", async () => ({ id_asignacion: ASIGNACION, id_estado_notificacion: 3 }));
      const resultado = await servicio.reintentarAviso({ idQueja: QUEJA, idAdministrador: ADMIN });
      assert.equal(resultado.estado, "ENTREGADO");
      assert.equal(llamadas.avisos.length, 1);
    });

    it("no reintenta un aviso ya entregado ni una queja sin derivar", async () => {
      simular();
      mock.method(modelo, "obtenerUltimaAsignacion", async () => ({ id_asignacion: ASIGNACION, id_estado_notificacion: 2 }));
      await assert.rejects(servicio.reintentarAviso({ idQueja: QUEJA, idAdministrador: ADMIN }), rechazo(409));
      mock.method(modelo, "obtenerUltimaAsignacion", async () => null);
      await assert.rejects(servicio.reintentarAviso({ idQueja: QUEJA, idAdministrador: ADMIN }), rechazo(404));
      assert.equal(llamadas.avisos.length, 0);
    });
  });
});
