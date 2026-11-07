// KAN-34 (RF-14.7): pruebas unitarias de las transiciones de etapa del postulante.
// Reglas puras, validación del cuerpo, identificación del reclutador y el servicio con la base simulada.
const { describe, it, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

// La transacción se reemplaza por una que entrega un cliente falso: el servicio se prueba sin PostgreSQL.
const clienteFalso = { query: async () => ({ rows: [] }) };
const rutaTransaccion = require.resolve(path.join(__dirname, "../utils/transaction"));
require.cache[rutaTransaccion] = {
  id: rutaTransaccion,
  filename: rutaTransaccion,
  loaded: true,
  exports: { withTransaction: async (trabajo) => trabajo(clienteFalso) },
};

const { ETAPA, verificarCambioEtapa } = require("../utils/etapas");
const { validarCambioEtapa } = require("../validators/etapaValidator");
const identificarReclutador = require("../middlewares/identificarReclutador");
const modelo = require("../models/etapaPostulacionModel");
const integracionService = require("../services/integracionService");
const servicio = require("../services/etapaPostulacionService");

const USUARIO = { id: "44444444-4444-4444-8444-444444444444", nombre: "María Pérez", rol: "reclutador" };
const ID_POSTULACION = "33333333-3333-4333-8333-000000000001";

const etapa = (id_etapa, nombre, extra = {}) => ({ id_etapa, nombre, codigo: nombre.toUpperCase(), esta_activa: true, ...extra });
const postulacionEn = (id_etapa, extra = {}) => ({
  id_postulacion: ID_POSTULACION,
  id_convocatoria: "11111111-1111-4111-8111-111111111111",
  id_etapa,
  nombre_etapa: `Etapa ${id_etapa}`,
  codigo_etapa: `E${id_etapa}`,
  es_final: false,
  esta_archivada: false,
  ...extra,
});
const transicion = (extra = {}) => ({ solicita_motivo: false, requiere_cargo: false, ...extra });
const CAJERO = { id_cargo_operativo: 1, codigo: "CAJERO", nombre: "Cajero", codigo_destino: "MARKETPLACE_POS" };

// Devuelve el error que lanza la función (o null) para revisar estado y mensaje.
const capturar = (fn) => {
  try {
    fn();
    return null;
  } catch (error) {
    return error;
  }
};

describe("RF-14.7: reglas de transición de etapa (verificarCambioEtapa)", () => {
  it("permite un avance definido en el flujo", () => {
    assert.equal(
      capturar(() =>
        verificarCambioEtapa({ postulacion: postulacionEn(1), destino: etapa(2, "En revisión"), transicion: transicion() }),
      ),
      null,
    );
  });

  it("rechaza una etapa inexistente con 400", () => {
    const error = capturar(() => verificarCambioEtapa({ postulacion: postulacionEn(1), destino: null, transicion: null }));
    assert.equal(error.status, 400);
    assert.deepEqual(error.detalles.errores[0].campo, "id_etapa");
  });

  it("rechaza una etapa inactiva (FINALISTA) con 400", () => {
    const error = capturar(() =>
      verificarCambioEtapa({
        postulacion: postulacionEn(1),
        destino: etapa(5, "Finalista", { esta_activa: false }),
        transicion: null,
      }),
    );
    assert.equal(error.status, 400);
    assert.match(error.message, /ya no se usa/);
  });

  it("no admite cambios en una postulación cerrada (contratada o rechazada)", () => {
    for (const cerrada of [postulacionEn(6, { es_final: true }), postulacionEn(7, { es_final: true, esta_archivada: true })]) {
      const error = capturar(() =>
        verificarCambioEtapa({ postulacion: cerrada, destino: etapa(2, "En revisión"), transicion: transicion() }),
      );
      assert.equal(error.status, 409);
      assert.match(error.message, /cerrada/);
    }
  });

  it("rechaza mover a la misma etapa con 409", () => {
    const error = capturar(() =>
      verificarCambioEtapa({ postulacion: postulacionEn(2), destino: etapa(2, "En revisión"), transicion: null }),
    );
    assert.equal(error.status, 409);
    assert.match(error.message, /ya se encuentra/);
  });

  it("rechaza un salto no permitido e informa las etapas a las que sí puede pasar", () => {
    const permitidas = [etapa(2, "En revisión"), etapa(7, "Rechazado")];
    const error = capturar(() =>
      verificarCambioEtapa({ postulacion: postulacionEn(1), destino: etapa(4, "Apto"), transicion: null, permitidas }),
    );
    assert.equal(error.status, 409);
    assert.match(error.message, /solo puede pasar a: En revisión, Rechazado/);
    assert.deepEqual(error.detalles.etapas_permitidas, permitidas);
  });

  it("exige el cargo operativo al contratar", () => {
    const error = capturar(() =>
      verificarCambioEtapa({
        postulacion: postulacionEn(4),
        destino: etapa(ETAPA.CONTRATADO, "Contratado"),
        transicion: transicion({ requiere_cargo: true }),
      }),
    );
    assert.equal(error.status, 400);
    assert.deepEqual(error.detalles.campos_faltantes, ["id_cargo_operativo"]);
  });

  it("rechaza un cargo operativo inexistente", () => {
    const error = capturar(() =>
      verificarCambioEtapa({
        postulacion: postulacionEn(4),
        destino: etapa(ETAPA.CONTRATADO, "Contratado"),
        transicion: transicion({ requiere_cargo: true }),
        idCargoOperativo: 99,
        cargo: null,
      }),
    );
    assert.equal(error.status, 400);
    assert.match(error.message, /no existe/);
  });

  it("no acepta cargo operativo fuera de la contratación", () => {
    const error = capturar(() =>
      verificarCambioEtapa({
        postulacion: postulacionEn(2),
        destino: etapa(3, "Entrevista técnica"),
        transicion: transicion(),
        idCargoOperativo: 1,
        cargo: CAJERO,
      }),
    );
    assert.equal(error.status, 400);
    assert.match(error.message, /solo se asigna al contratar/);
  });

  it("no contrata por encima de las vacantes de la convocatoria", () => {
    const contratar = (contratados) =>
      capturar(() =>
        verificarCambioEtapa({
          postulacion: postulacionEn(4),
          destino: etapa(ETAPA.CONTRATADO, "Contratado"),
          transicion: transicion({ requiere_cargo: true }),
          idCargoOperativo: 1,
          cargo: CAJERO,
          vacantes: { cantidad: 2, contratados },
        }),
      );
    assert.equal(contratar(1), null);
    const error = contratar(2);
    assert.equal(error.status, 409);
    assert.match(error.message, /cubrió sus 2 vacante/);
  });

  it("permite rechazar con motivo opcional", () => {
    assert.equal(
      capturar(() =>
        verificarCambioEtapa({
          postulacion: postulacionEn(3),
          destino: etapa(ETAPA.RECHAZADO, "Rechazado"),
          transicion: transicion({ solicita_motivo: true }),
        }),
      ),
      null,
    );
  });
});

describe("RF-14.7: validación del cuerpo del cambio de etapa", () => {
  it("acepta id_etapa o codigo_etapa y normaliza el código", () => {
    assert.deepEqual(validarCambioEtapa({ id_etapa: 2 }), {
      id_etapa: 2,
      codigo_etapa: null,
      motivo: null,
      id_cargo_operativo: null,
    });
    assert.equal(validarCambioEtapa({ codigo_etapa: " en_revision " }).codigo_etapa, "EN_REVISION");
    assert.equal(validarCambioEtapa({ id_etapa: "6", id_cargo_operativo: "1" }).id_cargo_operativo, 1);
  });

  it("exige la etapa destino", () => {
    const error = capturar(() => validarCambioEtapa({ motivo: "x" }));
    assert.equal(error.status, 400);
    assert.deepEqual(error.detalles.campos_faltantes, ["id_etapa"]);
  });

  it("rechaza ids no enteros y motivos demasiado largos", () => {
    const error = capturar(() => validarCambioEtapa({ id_etapa: 1.5, id_cargo_operativo: -1, motivo: "a".repeat(1001) }));
    assert.equal(error.status, 400);
    assert.deepEqual(error.detalles.errores.map((e) => e.campo).sort(), ["id_cargo_operativo", "id_etapa", "motivo"]);
  });

  it("recorta el motivo y lo deja en null si está vacío", () => {
    assert.equal(validarCambioEtapa({ id_etapa: 7, motivo: "  Vacante cubierta  " }).motivo, "Vacante cubierta");
    assert.equal(validarCambioEtapa({ id_etapa: 7, motivo: "   " }).motivo, null);
  });
});

describe("RF-14.7: usuario responsable del cambio (identificarReclutador)", () => {
  const pedir = (cabeceras) => {
    const req = { get: (nombre) => cabeceras[nombre] };
    let siguiente = false;
    const error = capturar(() => identificarReclutador(req, {}, () => (siguiente = true)));
    return { req, error, siguiente };
  };

  it("exige un rol de reclutamiento", () => {
    assert.equal(pedir({}).error.status, 401);
    assert.equal(pedir({ "X-Rol": "empleado", "X-Usuario-Id": USUARIO.id }).error.status, 403);
  });

  it("exige el usuario responsable", () => {
    const { error } = pedir({ "X-Rol": "reclutador" });
    assert.equal(error.status, 401);
    assert.deepEqual(error.detalles.campos_faltantes, ["X-Usuario-Id"]);
    assert.equal(pedir({ "X-Rol": "reclutador", "X-Usuario-Id": "abc" }).error.status, 400);
  });

  it("deja en la petición al usuario con su nombre decodificado", () => {
    const { req, siguiente } = pedir({
      "X-Rol": "Reclutador",
      "X-Usuario-Id": USUARIO.id.toUpperCase(),
      "X-Usuario-Nombre": encodeURIComponent("María Pérez"),
    });
    assert.ok(siguiente);
    assert.deepEqual(req.usuario, USUARIO);
  });
});

describe("RF-14.7: servicio de cambio de etapa (base simulada)", () => {
  let llamadas;

  // Simula el modelo para una postulación en `idEtapaActual` y una transición permitida hacia `destino`.
  const simular = ({ idEtapaActual, destino, transicionPermitida = transicion(), cargo = null, vacantes = null }) => {
    llamadas = { actualizar: [], historial: [], altas: [] };
    mock.method(modelo, "bloquearPostulacion", async () => postulacionEn(idEtapaActual));
    mock.method(modelo, "obtenerEtapa", async () => destino);
    mock.method(modelo, "obtenerTransicion", async () => transicionPermitida);
    mock.method(modelo, "listarDestinosPermitidos", async () => [etapa(2, "En revisión")]);
    mock.method(modelo, "obtenerCargoOperativo", async () => cargo);
    mock.method(modelo, "contarVacantes", async () => vacantes);
    mock.method(modelo, "actualizarEtapa", async (cliente, datos) => {
      llamadas.actualizar.push(datos);
      return { id_postulacion: ID_POSTULACION, id_etapa: datos.idEtapa, contratado_en: "2026-10-20T15:00:00.000Z" };
    });
    mock.method(modelo, "registrarHistorial", async (cliente, datos) => {
      llamadas.historial.push(datos);
      return { id_historial: "h-1", ...datos };
    });
    mock.method(integracionService, "registrarAltaContratacion", async (cliente, datos) => {
      llamadas.altas.push(datos);
      return [{ id_evento: "ev-1", codigo_destino: "CONTABILIDAD" }, { id_evento: "ev-2", codigo_destino: "MARKETPLACE_POS" }];
    });
  };

  beforeEach(() => mock.restoreAll());

  it("registra el cambio con la etapa anterior, el usuario responsable y el motivo", async () => {
    simular({ idEtapaActual: 1, destino: etapa(2, "En revisión") });
    const resultado = await servicio.cambiarEtapa(
      ID_POSTULACION,
      { id_etapa: 2, codigo_etapa: null, motivo: "CV completo", id_cargo_operativo: null },
      USUARIO,
    );
    assert.deepEqual(llamadas.historial, [
      { idPostulacion: ID_POSTULACION, idEtapaAnterior: 1, idEtapa: 2, usuario: USUARIO, motivo: "CV completo" },
    ]);
    assert.equal(llamadas.actualizar[0].idEtapa, 2);
    assert.equal(llamadas.altas.length, 0, "solo la contratación genera altas");
    assert.equal(resultado.postulacion.etapa_anterior.id_etapa, 1);
    assert.deepEqual(resultado.integraciones, []);
  });

  it("al contratar valida vacantes y registra el alta en la misma transacción", async () => {
    simular({
      idEtapaActual: 4,
      destino: etapa(ETAPA.CONTRATADO, "Contratado"),
      transicionPermitida: transicion({ requiere_cargo: true }),
      cargo: CAJERO,
      vacantes: { cantidad: 1, contratados: 0 },
    });
    const resultado = await servicio.cambiarEtapa(
      ID_POSTULACION,
      { id_etapa: 6, codigo_etapa: null, motivo: null, id_cargo_operativo: 1 },
      USUARIO,
    );
    assert.equal(modelo.contarVacantes.mock.callCount(), 1);
    assert.equal(llamadas.altas.length, 1);
    assert.equal(llamadas.altas[0].cargo, CAJERO);
    assert.equal(llamadas.altas[0].usuario, USUARIO);
    assert.equal(resultado.integraciones.length, 2);
  });

  it("si la regla falla no actualiza la etapa ni escribe historial", async () => {
    simular({ idEtapaActual: 1, destino: etapa(4, "Apto"), transicionPermitida: null });
    await assert.rejects(
      servicio.cambiarEtapa(ID_POSTULACION, { id_etapa: 4, codigo_etapa: null, motivo: null, id_cargo_operativo: null }, USUARIO),
      { status: 409 },
    );
    assert.equal(llamadas.actualizar.length, 0);
    assert.equal(llamadas.historial.length, 0);
  });

  it("devuelve 404 si la postulación no existe", async () => {
    simular({ idEtapaActual: 1, destino: etapa(2, "En revisión") });
    mock.method(modelo, "bloquearPostulacion", async () => null);
    await assert.rejects(
      servicio.cambiarEtapa(ID_POSTULACION, { id_etapa: 2, codigo_etapa: null, motivo: null, id_cargo_operativo: null }, USUARIO),
      { status: 404 },
    );
  });

  it("si falla el registro del alta, el error sube y la transacción no se confirma", async () => {
    simular({
      idEtapaActual: 4,
      destino: etapa(ETAPA.CONTRATADO, "Contratado"),
      transicionPermitida: transicion({ requiere_cargo: true }),
      cargo: CAJERO,
      vacantes: { cantidad: 1, contratados: 0 },
    });
    mock.method(integracionService, "registrarAltaContratacion", async () => {
      throw new Error("fallo al insertar el evento");
    });
    await assert.rejects(
      servicio.cambiarEtapa(ID_POSTULACION, { id_etapa: 6, codigo_etapa: null, motivo: null, id_cargo_operativo: 1 }, USUARIO),
      /fallo al insertar el evento/,
    );
  });
});
