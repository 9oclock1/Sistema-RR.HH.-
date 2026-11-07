// KAN-35 (RF-15.6): pruebas unitarias del agendamiento de entrevistas.
// Fechas en hora de La Paz, validación del cuerpo, reglas de agenda (etapa, evaluador, solapamiento) y el servicio
// de agendar, reprogramar y cancelar con la base simulada.
const { describe, it, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

// La transacción entrega un cliente falso: el servicio se prueba sin PostgreSQL.
const clienteFalso = { query: async () => ({ rows: [] }) };
const rutaTransaccion = require.resolve(path.join(__dirname, "../utils/transaction"));
require.cache[rutaTransaccion] = {
  id: rutaTransaccion,
  filename: rutaTransaccion,
  loaded: true,
  exports: { withTransaction: async (trabajo) => trabajo(clienteFalso) },
};

const { aInstante } = require("../utils/fechas");
const { ETAPA } = require("../utils/etapas");
const { ESTADO_ENTREVISTA, TIPO_NOTIFICACION, verificarProgramacion, verificarCitaActiva } = require("../utils/entrevistas");
const {
  validarProgramacion,
  validarReprogramacion,
  validarCancelacion,
  validarFiltroAgenda,
} = require("../validators/entrevistaValidator");
const modelo = require("../models/entrevistaModel");
const employeeService = require("../services/employeeServiceClient");
const notificaciones = require("../services/notificacionEntrevistaService");
const servicio = require("../services/entrevistaService");

const USUARIO = { id: "44444444-4444-4444-8444-444444444444", nombre: "María Pérez", rol: "reclutador" };
const ID_POSTULACION = "33333333-3333-4333-8333-000000000001";
const ID_ENTREVISTA = "55555555-5555-4555-8555-000000000001";
const EVALUADOR = "11111111-1111-4111-8111-111111111111";
const OTRO_EVALUADOR = "22222222-2222-4222-8222-222222222222";
const FUTURO = "2030-03-15T10:00";

const capturar = (fn) => {
  try {
    fn();
    return null;
  } catch (error) {
    return error;
  }
};

const cuerpoValido = (cambios = {}) => ({
  fecha_hora_programada: FUTURO,
  duracion_minutos: 45,
  modalidad: "virtual",
  lugar_enlace: "https://meet.google.com/abc-defg-hij",
  id_entrevistador_empleado: EVALUADOR,
  ...cambios,
});

describe("RF-15.6: fecha y hora de la cita en hora de La Paz (aInstante)", () => {
  it("interpreta la hora sin zona como hora local (UTC-4)", () => {
    assert.equal(aInstante("2030-03-15T10:00").toISOString(), "2030-03-15T14:00:00.000Z");
    assert.equal(aInstante("2030-03-15 23:30:00").toISOString(), "2030-03-16T03:30:00.000Z");
  });

  it("respeta la zona cuando viene indicada", () => {
    assert.equal(aInstante("2030-03-15T10:00Z").toISOString(), "2030-03-15T10:00:00.000Z");
    assert.equal(aInstante("2030-03-15T10:00-05:00").toISOString(), "2030-03-15T15:00:00.000Z");
  });

  it("rechaza fechas inexistentes o mal escritas", () => {
    for (const texto of ["2030-02-31T10:00", "2030-03-15T25:00", "15/03/2030 10:00", "mañana", "2030-03-15"]) {
      assert.equal(aInstante(texto), null, texto);
    }
  });
});

describe("RF-15.6: validación del formulario de entrevista", () => {
  it("normaliza una programación válida y aplica la duración por defecto", () => {
    const datos = validarProgramacion(cuerpoValido({ duracion_minutos: undefined, confirmar_solapamiento: true }));
    assert.equal(datos.modalidad, "VIRTUAL");
    assert.equal(datos.duracion_minutos, 60);
    assert.equal(datos.confirmar_solapamiento, true);
    assert.equal(datos.fecha_hora_programada.toISOString(), "2030-03-15T14:00:00.000Z");
  });

  it("indica todos los datos que faltan: fecha, hora, modalidad, lugar y evaluador", () => {
    const error = capturar(() => validarProgramacion({}));
    assert.equal(error.status, 400);
    assert.deepEqual(error.detalles.campos_faltantes.sort(), [
      "fecha_hora_programada",
      "id_entrevistador_empleado",
      "lugar_enlace",
      "modalidad",
    ]);
  });

  it("una entrevista virtual exige el enlace de la reunión", () => {
    const error = capturar(() => validarProgramacion(cuerpoValido({ lugar_enlace: "Sala 3" })));
    assert.equal(error.status, 400);
    assert.equal(error.detalles.errores[0].campo, "lugar_enlace");
    assert.equal(capturar(() => validarProgramacion(cuerpoValido({ modalidad: "PRESENCIAL", lugar_enlace: "Sala 3" }))), null);
  });

  it("rechaza modalidad, duración y confirmación inválidas", () => {
    const error = capturar(() =>
      validarProgramacion(cuerpoValido({ modalidad: "telefónica", duracion_minutos: 5, confirmar_solapamiento: "sí" })),
    );
    assert.deepEqual(error.detalles.errores.map((e) => e.campo).sort(), ["confirmar_solapamiento", "duracion_minutos", "modalidad"]);
  });

  it("al reprogramar exige algún cambio y que modalidad y lugar vayan juntos", () => {
    assert.equal(capturar(() => validarReprogramacion({ motivo: "Viaje" })).status, 400);
    assert.deepEqual(capturar(() => validarReprogramacion({ modalidad: "PRESENCIAL" })).detalles.campos_faltantes, ["lugar_enlace"]);
    const datos = validarReprogramacion({ fecha_hora_programada: FUTURO, motivo: "  Viaje  " });
    assert.equal(datos.motivo, "Viaje");
    assert.equal(datos.modalidad, null);
  });

  it("la cancelación exige un motivo", () => {
    assert.deepEqual(capturar(() => validarCancelacion({ motivo: "  " })).detalles.campos_faltantes, ["motivo"]);
    assert.deepEqual(validarCancelacion({ motivo: "Vacante cubierta" }), { motivo: "Vacante cubierta" });
  });

  it("la agenda acepta un rango de hasta 92 días", () => {
    const filtro = validarFiltroAgenda({ desde: "2030-03-01T00:00", hasta: "2030-03-08T00:00", incluir_canceladas: "true" });
    assert.equal(filtro.incluir_canceladas, true);
    assert.equal(capturar(() => validarFiltroAgenda({ desde: "2030-03-01T00:00", hasta: "2030-07-01T00:00" })).status, 400);
    assert.equal(capturar(() => validarFiltroAgenda({ desde: "2030-03-08T00:00", hasta: "2030-03-01T00:00" })).status, 400);
    const porDefecto = validarFiltroAgenda({});
    assert.equal(porDefecto.hasta - porDefecto.desde, 30 * 86400000);
  });
});

describe("RF-15.6: reglas de agenda (verificarProgramacion)", () => {
  const base = {
    postulacion: { id_etapa: ETAPA.APTO, nombre_etapa: "Apto", esta_archivada: false },
    inicio: new Date("2030-03-15T14:00:00Z"),
    ahora: new Date("2030-03-01T00:00:00Z"),
    evaluador: { activo: true },
  };

  it("criterio 1: solo se agenda a postulantes en «Entrevista técnica» o «Apto»", () => {
    assert.equal(capturar(() => verificarProgramacion(base)), null);
    const tecnica = { ...base, postulacion: { ...base.postulacion, id_etapa: ETAPA.ENTREVISTA_TECNICA } };
    assert.equal(capturar(() => verificarProgramacion(tecnica)), null);
    for (const idEtapa of [ETAPA.POSTULADO, ETAPA.EN_REVISION, ETAPA.CONTRATADO, ETAPA.RECHAZADO]) {
      const error = capturar(() => verificarProgramacion({ ...base, postulacion: { id_etapa: idEtapa, nombre_etapa: "X" } }));
      assert.equal(error.status, 409, `etapa ${idEtapa}`);
    }
    const archivada = { ...base, postulacion: { ...base.postulacion, esta_archivada: true } };
    assert.equal(capturar(() => verificarProgramacion(archivada)).status, 409);
  });

  it("la cita debe ser futura y el evaluador existir y estar activo", () => {
    assert.equal(capturar(() => verificarProgramacion({ ...base, inicio: base.ahora })).status, 400);
    assert.equal(capturar(() => verificarProgramacion({ ...base, evaluador: null })).status, 400);
    assert.equal(capturar(() => verificarProgramacion({ ...base, evaluador: { activo: false } })).status, 409);
  });

  it("criterio 3: advierte el solapamiento del evaluador salvo que se confirme", () => {
    const solapamientos = [{ id_entrevista: "otra" }];
    const error = capturar(() => verificarProgramacion({ ...base, solapamientos }));
    assert.equal(error.status, 409);
    assert.equal(error.detalles.solapamiento, true);
    assert.deepEqual(error.detalles.entrevistas_solapadas, solapamientos);
    assert.equal(capturar(() => verificarProgramacion({ ...base, solapamientos, confirmarSolapamiento: true })), null);
  });

  it("solo una cita programada o reprogramada se puede cambiar", () => {
    const cita = (id) => ({ id_estado_entrevista: id, nombre_estado: "Estado" });
    assert.equal(capturar(() => verificarCitaActiva(cita(ESTADO_ENTREVISTA.PROGRAMADA), "cancelar")), null);
    assert.equal(capturar(() => verificarCitaActiva(cita(ESTADO_ENTREVISTA.REPROGRAMADA), "cancelar")), null);
    assert.equal(capturar(() => verificarCitaActiva(cita(ESTADO_ENTREVISTA.CANCELADA), "reprogramar")).status, 409);
    assert.equal(capturar(() => verificarCitaActiva(cita(ESTADO_ENTREVISTA.REALIZADA), "reprogramar")).status, 409);
  });
});

describe("RF-15.6: servicio de agenda (base simulada)", () => {
  let llamadas;
  const citaActual = (cambios = {}) => ({
    id_entrevista: ID_ENTREVISTA,
    id_postulacion: ID_POSTULACION,
    fecha_hora_programada: new Date("2030-03-15T14:00:00Z"),
    duracion_minutos: 60,
    modalidad: "VIRTUAL",
    lugar_enlace: "https://meet.google.com/abc",
    id_entrevistador_empleado: EVALUADOR,
    nombre_entrevistador: "Ana Quispe",
    id_estado_entrevista: ESTADO_ENTREVISTA.PROGRAMADA,
    nombre_estado: "Programada",
    id_etapa: ETAPA.APTO,
    nombre_etapa: "Apto",
    esta_archivada: false,
    correo_electronico: "luis@test.com",
    ...cambios,
  });

  const simular = ({ solapamientos = [], empleado = { nombres: "Ana", apellidos: "Quispe", activo: true }, actual = citaActual() } = {}) => {
    llamadas = { insertar: [], actualizar: [], historial: [], encolar: [], solapes: [], bloqueos: [] };
    mock.method(employeeService, "obtenerEmpleado", async () => empleado);
    mock.method(modelo, "bloquearPostulacion", async () => ({
      id_postulacion: ID_POSTULACION,
      id_etapa: ETAPA.ENTREVISTA_TECNICA,
      nombre_etapa: "Entrevista técnica",
      esta_archivada: false,
      correo_electronico: "luis@test.com",
    }));
    mock.method(modelo, "bloquearEntrevista", async () => actual);
    mock.method(modelo, "bloquearAgendaEvaluador", async (cliente, id) => llamadas.bloqueos.push(id));
    mock.method(modelo, "buscarSolapamientos", async (cliente, filtro) => {
      llamadas.solapes.push(filtro);
      return solapamientos;
    });
    mock.method(modelo, "insertarEntrevista", async (cliente, datos) => {
      llamadas.insertar.push(datos);
      return ID_ENTREVISTA;
    });
    mock.method(modelo, "actualizarEntrevista", async (cliente, id, datos) => llamadas.actualizar.push(datos));
    mock.method(modelo, "registrarHistorial", async (cliente, datos) => {
      llamadas.historial.push(datos);
      return { id_historial: "h-1", fecha_hora_anterior: datos.fechaHoraAnterior ?? null, motivo: datos.motivo ?? null };
    });
    mock.method(modelo, "obtenerEntrevista", async () => ({ id_entrevista: ID_ENTREVISTA, correo_electronico: "luis@test.com" }));
    mock.method(notificaciones, "encolar", async (cliente, datos) => {
      llamadas.encolar.push(datos);
      return { id_notificacion: "n-1", tipo_notificacion: datos.tipo, correo_destino: "luis@test.com" };
    });
  };

  beforeEach(() => mock.restoreAll());

  it("criterios 1 y 2: registra la cita con el evaluador, su historial y el correo al candidato", async () => {
    simular();
    const resultado = await servicio.agendar(ID_POSTULACION, validarProgramacion(cuerpoValido()), USUARIO);
    assert.equal(llamadas.insertar.length, 1);
    assert.equal(llamadas.insertar[0].cita.nombre_entrevistador, "Ana Quispe");
    assert.equal(llamadas.insertar[0].usuario, USUARIO);
    assert.deepEqual(llamadas.bloqueos, [EVALUADOR]);
    assert.equal(llamadas.historial[0].idEstado, ESTADO_ENTREVISTA.PROGRAMADA);
    assert.equal(llamadas.encolar[0].tipo, TIPO_NOTIFICACION.PROGRAMACION);
    assert.equal(resultado.notificacion.tipo_notificacion, TIPO_NOTIFICACION.PROGRAMACION);
  });

  it("criterio 3: con solapamiento no guarda nada hasta que el reclutador confirme", async () => {
    simular({ solapamientos: [{ id_entrevista: "otra" }] });
    await assert.rejects(servicio.agendar(ID_POSTULACION, validarProgramacion(cuerpoValido()), USUARIO), { status: 409 });
    assert.equal(llamadas.insertar.length, 0);
    assert.equal(llamadas.encolar.length, 0);

    const resultado = await servicio.agendar(
      ID_POSTULACION,
      validarProgramacion(cuerpoValido({ confirmar_solapamiento: true })),
      USUARIO,
    );
    assert.equal(llamadas.insertar.length, 1);
    assert.equal(resultado.entrevistas_solapadas.length, 1);
  });

  it("un evaluador inexistente no consulta la agenda ni guarda la cita", async () => {
    simular({ empleado: null });
    await assert.rejects(servicio.agendar(ID_POSTULACION, validarProgramacion(cuerpoValido()), USUARIO), { status: 400 });
    assert.equal(llamadas.solapes.length, 0);
    assert.equal(llamadas.insertar.length, 0);
  });

  it("criterio 4: reprogramar actualiza el calendario, guarda la fecha anterior y avisa al candidato", async () => {
    simular();
    await servicio.reprogramar(
      ID_ENTREVISTA,
      validarReprogramacion({ fecha_hora_programada: "2030-03-16T09:00", id_entrevistador_empleado: OTRO_EVALUADOR, motivo: "Viaje" }),
      USUARIO,
    );
    assert.equal(llamadas.solapes[0].excluirId, ID_ENTREVISTA, "la propia cita no cuenta como solapamiento");
    assert.equal(llamadas.solapes[0].idEntrevistador, OTRO_EVALUADOR);
    assert.equal(llamadas.actualizar[0].idEstado, ESTADO_ENTREVISTA.REPROGRAMADA);
    assert.equal(llamadas.actualizar[0].cita.fecha_hora_programada.toISOString(), "2030-03-16T13:00:00.000Z");
    assert.equal(llamadas.historial[0].fechaHoraAnterior.toISOString(), "2030-03-15T14:00:00.000Z");
    assert.equal(llamadas.historial[0].motivo, "Viaje");
    assert.equal(llamadas.encolar[0].tipo, TIPO_NOTIFICACION.REPROGRAMACION);
  });

  it("reprogramar con los mismos datos no cambia nada", async () => {
    simular();
    await assert.rejects(
      servicio.reprogramar(ID_ENTREVISTA, validarReprogramacion({ fecha_hora_programada: "2030-03-15T10:00" }), USUARIO),
      { status: 400 },
    );
    assert.equal(llamadas.actualizar.length, 0);
  });

  it("criterio 4: cancelar libera la agenda y avisa; una cita cancelada ya no cambia", async () => {
    simular();
    await servicio.cancelar(ID_ENTREVISTA, { motivo: "Vacante cubierta" }, USUARIO);
    assert.equal(llamadas.actualizar[0].idEstado, ESTADO_ENTREVISTA.CANCELADA);
    assert.equal(llamadas.historial[0].motivo, "Vacante cubierta");
    assert.equal(llamadas.encolar[0].tipo, TIPO_NOTIFICACION.CANCELACION);

    simular({ actual: citaActual({ id_estado_entrevista: ESTADO_ENTREVISTA.CANCELADA, nombre_estado: "Cancelada" }) });
    await assert.rejects(servicio.cancelar(ID_ENTREVISTA, { motivo: "otra vez" }, USUARIO), { status: 409 });
    assert.equal(llamadas.encolar.length, 0);
  });

  it("devuelve 404 si la postulación o la entrevista no existen", async () => {
    simular();
    mock.method(modelo, "bloquearPostulacion", async () => null);
    mock.method(modelo, "bloquearEntrevista", async () => null);
    await assert.rejects(servicio.agendar(ID_POSTULACION, validarProgramacion(cuerpoValido()), USUARIO), { status: 404 });
    await assert.rejects(servicio.cancelar(ID_ENTREVISTA, { motivo: "x" }, USUARIO), { status: 404 });
  });
});
