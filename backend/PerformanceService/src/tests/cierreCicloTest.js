const { describe, it, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

// La transacción entrega un cliente falso y cuenta cuántas se abrieron: el servicio se prueba sin PostgreSQL.
const transacciones = { abiertas: 0 };
const clienteFalso = { query: async () => ({ rows: [] }) };
const rutaTransaccion = require.resolve(path.join(__dirname, "../config/transaccion"));
require.cache[rutaTransaccion] = {
  id: rutaTransaccion,
  filename: rutaTransaccion,
  loaded: true,
  exports: {
    enTransaccion: async (trabajo) => {
      transacciones.abiertas += 1;
      return trabajo(clienteFalso);
    },
  },
};

const pool = require("../config/db");
const modelo = require("../models/procesoCiclosModel");
const evaluacionesModelo = require("../models/evaluacionesModel");
const proceso = require("../services/procesoCiclosService");
const evaluacionesServicio = require("../services/evaluacionesService");
const ayudas = require("./ayudas/plantillaEvaluacion");
const { ESTADO_EVALUACION, ESTADO_CICLO } = require("../utils/evaluaciones");

const id = (n) => `d0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const HOY = "2026-11-08";
const CICLO = id(117);

afterEach(() => mock.restoreAll());

// Cliente de base de datos falso que responde según la sentencia y guarda lo que se le pidió.
function baseFalsa({ cicloAbierto = true, vencidas = 2, evaluados = [id(31), id(32), id(33)] } = {}) {
  const consultas = [];
  const db = {
    query: async (sql, parametros) => {
      const texto = sql.replace(/\s+/g, " ").trim();
      consultas.push({ sql: texto, parametros });
      if (texto.startsWith("UPDATE ciclos_evaluacion")) {
        return {
          rows: cicloAbierto
            ? [{ id_ciclo: CICLO, nombre: "Evaluación de temporada baja", id_periodo: id(42), fecha_inicio: "2026-09-29", fecha_limite: "2026-11-07", cerrado_en: "2026-11-08T12:00:00.000Z" }]
            : [],
        };
      }
      if (texto.startsWith("UPDATE evaluaciones")) return { rows: [], rowCount: vencidas };
      if (texto.startsWith("SELECT DISTINCT")) return { rows: evaluados.map((idEmpleado) => ({ id_empleado_evaluado: idEmpleado })) };
      return { rows: [], rowCount: 1 };
    },
  };
  return { db, consultas };
}

describe("RF-03, criterio 4: cierre del ciclo al vencer la fecha límite", () => {
  describe("activación de ciclos programados", () => {
    it("pasa a activo el ciclo programado cuya fecha de inicio llegó", async () => {
      const { db, consultas } = baseFalsa();
      await modelo.activarCiclos(HOY, db);
      assert.match(consultas[0].sql, /SET id_estado_ciclo = 2/);
      assert.match(consultas[0].sql, /WHERE id_estado_ciclo = 1 AND fecha_inicio <= \$1::date/);
      assert.deepEqual(consultas[0].parametros, [HOY]);
    });
  });

  describe("cuándo vence un ciclo", () => {
    it("solo los ciclos activos cuya fecha límite ya pasó: el último día del plazo todavía se puede responder", async () => {
      const { db, consultas } = baseFalsa();
      await modelo.listarCiclosVencidos(HOY, db);
      assert.match(consultas[0].sql, /id_estado_ciclo = 2/);
      assert.match(consultas[0].sql, /fecha_limite < \$1::date/, "estrictamente menor: el día de la fecha límite no cierra");
      assert.deepEqual(consultas[0].parametros, [HOY]);
    });
  });

  describe("cierre de un ciclo (modelo)", () => {
    it("deja el ciclo cerrado con su fecha de cierre, solo si seguía activo", async () => {
      const { db, consultas } = baseFalsa();
      await modelo.cerrarCiclo(db, CICLO);
      assert.match(consultas[0].sql, /SET id_estado_ciclo = 3, cerrado_en = CURRENT_TIMESTAMP/);
      assert.match(consultas[0].sql, /WHERE id_ciclo = \$1 AND id_estado_ciclo = 2/);
      assert.deepEqual(consultas[0].parametros, [CICLO]);
    });

    it("marca como vencidas las evaluaciones pendientes y en borrador, y no toca las enviadas", async () => {
      const { db, consultas } = baseFalsa({ vencidas: 2 });
      const resultado = await modelo.cerrarCiclo(db, CICLO);
      const vencer = consultas[1];
      assert.match(vencer.sql, /SET id_estado_evaluacion = 4/);
      assert.match(vencer.sql, /id_estado_evaluacion IN \(1, 2\)/, "solo PENDIENTE y BORRADOR: la ENVIADA (3) queda como está");
      assert.deepEqual(vencer.parametros, [CICLO]);
      assert.deepEqual(resultado, { id_ciclo: CICLO, nombre: "Evaluación de temporada baja", evaluaciones_vencidas: 2 });
    });

    it("registra en EVENTOS_SALIENTES la solicitud de métricas para el CRM, dentro del mismo cierre", async () => {
      const { db, consultas } = baseFalsa();
      await modelo.cerrarCiclo(db, CICLO);
      const evento = consultas.at(-1);
      assert.match(evento.sql, /INSERT INTO eventos_salientes/);
      assert.match(evento.sql, /VALUES \(\$1, 1, 'SOLICITUD_METRICAS_CRM', \$2::jsonb\)/, "destino 1 = CRM");
      assert.match(evento.sql, /ON CONFLICT ON CONSTRAINT uq_evento_ciclo_destino_tipo DO NOTHING/, "no repite el evento del ciclo");
      assert.equal(evento.parametros[0], CICLO);
      assert.deepEqual(JSON.parse(evento.parametros[1]), {
        id_ciclo: CICLO,
        nombre: "Evaluación de temporada baja",
        fecha_inicio: "2026-09-29",
        fecha_limite: "2026-11-07",
        cerrado_en: "2026-11-08T12:00:00.000Z",
        empleados: [id(31), id(32), id(33)],
      });
    });

    it("hace todo en orden: cierra el ciclo, vence las evaluaciones y registra el evento", async () => {
      const { db, consultas } = baseFalsa();
      await modelo.cerrarCiclo(db, CICLO);
      assert.deepEqual(
        consultas.map((c) => c.sql.split(" ").slice(0, 2).join(" ")),
        ["UPDATE ciclos_evaluacion", "UPDATE evaluaciones", "SELECT DISTINCT", "INSERT INTO"],
      );
    });

    it("si otro proceso ya lo cerró no hace nada más y devuelve null", async () => {
      const { db, consultas } = baseFalsa({ cicloAbierto: false });
      assert.equal(await modelo.cerrarCiclo(db, CICLO), null);
      assert.equal(consultas.length, 1, "ni vence evaluaciones ni crea el evento");
    });
  });

  describe("cierre de los ciclos vencidos (servicio)", () => {
    beforeEach(() => {
      transacciones.abiertas = 0;
      mock.method(console, "error", () => {});
    });
    const vencidos = [
      { id_ciclo: id(1), nombre: "Ciclo uno" },
      { id_ciclo: id(2), nombre: "Ciclo dos" },
      { id_ciclo: id(3), nombre: "Ciclo tres" },
    ];

    it("cierra cada ciclo en su propia transacción", async () => {
      mock.method(modelo, "listarCiclosVencidos", async () => vencidos);
      mock.method(modelo, "cerrarCiclo", async (db, idCiclo) => ({ id_ciclo: idCiclo, nombre: `Cerrado ${idCiclo.slice(-1)}`, evaluaciones_vencidas: 1 }));
      const { cerrados, fallidos } = await proceso.cerrar(HOY);
      assert.equal(transacciones.abiertas, 3);
      assert.equal(cerrados.length, 3);
      assert.deepEqual(fallidos, []);
    });

    it("si un ciclo falla, los demás se cierran igual y el fallo se informa", async () => {
      mock.method(modelo, "listarCiclosVencidos", async () => vencidos);
      mock.method(modelo, "cerrarCiclo", async (db, idCiclo) => {
        if (idCiclo === id(2)) throw new Error("conexión perdida");
        return { id_ciclo: idCiclo, nombre: "ok", evaluaciones_vencidas: 0 };
      });
      const { cerrados, fallidos } = await proceso.cerrar(HOY);
      assert.deepEqual(cerrados.map((c) => c.id_ciclo), [id(1), id(3)]);
      assert.deepEqual(fallidos, ["Ciclo dos"]);
    });

    it("un ciclo que otro proceso ya cerró no se cuenta como cerrado", async () => {
      mock.method(modelo, "listarCiclosVencidos", async () => [vencidos[0]]);
      mock.method(modelo, "cerrarCiclo", async () => null);
      assert.deepEqual(await proceso.cerrar(HOY), { cerrados: [], fallidos: [] });
    });

    it("sin ciclos vencidos no abre ninguna transacción", async () => {
      mock.method(modelo, "listarCiclosVencidos", async () => []);
      assert.deepEqual(await proceso.cerrar(HOY), { cerrados: [], fallidos: [] });
      assert.equal(transacciones.abiertas, 0);
    });
  });

  describe("vuelta completa del proceso", () => {
    let orden;
    let sesion;

    // pool.connect entrega el cliente que toma el bloqueo; pool.query responde la fecha de hoy.
    const simular = ({ bloqueoLibre = true, activados = [], recordatorios = [], vencidos = () => [] } = {}) => {
      orden = [];
      sesion = { consultas: [], liberado: false };
      mock.method(console, "error", () => {});
      mock.method(pool, "query", async (sql) => {
        orden.push("hoy");
        sesion.consultaHoy = sql;
        return { rows: [{ hoy: HOY }] };
      });
      mock.method(pool, "connect", async () => ({
        query: async (sql) => {
          sesion.consultas.push(sql);
          return { rows: [{ obtenido: bloqueoLibre }] };
        },
        release: () => {
          sesion.liberado = true;
        },
      }));
      mock.method(modelo, "activarCiclos", async (dia) => {
        orden.push(["activar", dia]);
        return activados;
      });
      mock.method(modelo, "listarRecordatoriosPendientes", async (dia, dias) => {
        orden.push(["recordar", dia, dias]);
        return recordatorios;
      });
      mock.method(modelo, "listarCiclosVencidos", async (dia) => {
        orden.push(["vencidos", dia]);
        return vencidos();
      });
      mock.method(modelo, "cerrarCiclo", async (db, idCiclo) => {
        orden.push(["cerrar", idCiclo]);
        return { id_ciclo: idCiclo, nombre: "Ciclo", evaluaciones_vencidas: 2 };
      });
    };

    beforeEach(() => {
      mock.restoreAll();
      transacciones.abiertas = 0;
    });

    it("activa, recuerda y cierra, en ese orden y con la fecha de hoy", async () => {
      simular({ activados: [{ id_ciclo: id(1), nombre: "Ciclo activado" }], vencidos: () => [{ id_ciclo: CICLO, nombre: "Ciclo" }] });
      const resultado = await proceso.procesar();

      assert.deepEqual(orden, ["hoy", ["activar", HOY], ["recordar", HOY, 3], ["vencidos", HOY], ["cerrar", CICLO]]);
      assert.equal(resultado.fecha, HOY);
      assert.deepEqual(resultado.activados, ["Ciclo activado"]);
      assert.deepEqual(resultado.recordatorios, { evaluadores: 0, enviados: 0, fallidos: 0, evaluaciones_marcadas: 0 });
      assert.deepEqual(resultado.cerrados, [{ id_ciclo: CICLO, nombre: "Ciclo", evaluaciones_vencidas: 2 }]);
      assert.deepEqual(resultado.cierres_fallidos, []);
    });

    it("calcula «hoy» con el día de La Paz, no con el del servidor de la base", async () => {
      simular();
      await proceso.procesar();
      assert.match(sesion.consultaHoy, /America\/La_Paz/);
    });

    it("un ciclo programado que nunca llegó a activarse y ya venció se activa y se cierra en la misma vuelta", async () => {
      let activado = false;
      simular({ vencidos: () => (activado ? [{ id_ciclo: CICLO, nombre: "Ciclo olvidado" }] : []) });
      mock.method(modelo, "activarCiclos", async () => {
        activado = true;
        return [{ id_ciclo: CICLO, nombre: "Ciclo olvidado" }];
      });
      const resultado = await proceso.procesar();
      assert.deepEqual(resultado.activados, ["Ciclo olvidado"]);
      assert.equal(resultado.cerrados.length, 1);
    });

    it("toma un bloqueo para que dos vueltas no corran a la vez y lo libera al terminar", async () => {
      simular();
      await proceso.procesar();
      assert.match(sesion.consultas[0], /pg_try_advisory_lock/);
      assert.match(sesion.consultas[1], /pg_advisory_unlock/);
      assert.equal(sesion.liberado, true, "devuelve la conexión al pool");
    });

    it("si otra vuelta tiene el bloqueo, no hace nada y devuelve null", async () => {
      simular({ bloqueoLibre: false });
      assert.equal(await proceso.procesar(), null);
      assert.deepEqual(orden, [], "no consulta ni activa ni recuerda ni cierra");
      assert.equal(sesion.liberado, true);
    });

    it("libera el bloqueo aunque un paso falle", async () => {
      simular();
      mock.method(modelo, "activarCiclos", async () => {
        throw new Error("base caída");
      });
      await assert.rejects(() => proceso.procesar(), /base caída/);
      assert.match(sesion.consultas.at(-1), /pg_advisory_unlock/);
      assert.equal(sesion.liberado, true);
    });
  });

  describe("las evaluaciones vencidas ya no se pueden editar (el bloqueo de KAN-24 con el estado que deja el cierre)", () => {
    const { EVALUADOR, ID_EVALUACION } = ayudas;
    const respuestaNueva = { respuestas: [{ id_pregunta: ayudas.idPregunta(1), id_nivel: ayudas.nivelDe(1, 5) }] };
    let escrituras;

    // La evaluación llega tal como la dejó el job: ciclo CERRADO y evaluación VENCIDA guardada en la base.
    const simular = (cambios) => {
      escrituras = { respuestas: 0, envios: 0, estados: [] };
      mock.method(evaluacionesModelo, "obtenerEvaluacion", async () => ayudas.evaluacion(cambios));
      mock.method(evaluacionesModelo, "listarEstructura", async () => ayudas.filas());
      mock.method(evaluacionesModelo, "listarNiveles", async () => ayudas.NIVELES);
      mock.method(evaluacionesModelo, "guardarRespuestas", async () => {
        escrituras.respuestas += 1;
      });
      mock.method(evaluacionesModelo, "borrarRespuestas", async () => {});
      mock.method(evaluacionesModelo, "contarRespuestas", async () => 1);
      mock.method(evaluacionesModelo, "marcarEnviada", async () => {
        escrituras.envios += 1;
        return "2026-11-08T10:00:00.000Z";
      });
      mock.method(evaluacionesModelo, "cambiarEstadoAbierta", async (idEvaluacion, estado) => {
        escrituras.estados.push(estado);
        return "2026-11-08T10:00:00.000Z";
      });
    };
    const rechazo = async (accion) => {
      try {
        await accion();
      } catch (error) {
        return error;
      }
      return assert.fail("debía rechazar la operación");
    };
    const cerradaPorElJob = { id_estado_ciclo: ESTADO_CICLO.CERRADO, id_estado_evaluacion: ESTADO_EVALUACION.VENCIDA, fecha_limite: "2026-11-07", hoy: HOY };

    beforeEach(() => mock.restoreAll());

    it("no deja guardar respuestas y avisa que el ciclo está cerrado", async () => {
      simular(cerradaPorElJob);
      const error = await rechazo(() => evaluacionesServicio.guardarRespuestas(EVALUADOR, ID_EVALUACION, respuestaNueva));
      assert.equal(error.estado, 409);
      assert.match(error.message, /cerrado/);
      assert.equal(escrituras.respuestas, 0);
    });

    it("no deja enviar la evaluación", async () => {
      simular(cerradaPorElJob);
      const error = await rechazo(() => evaluacionesServicio.enviar(EVALUADOR, ID_EVALUACION));
      assert.equal(error.estado, 409);
      assert.equal(escrituras.envios, 0);
    });

    it("el formulario se muestra como vencido y de solo lectura", async () => {
      simular(cerradaPorElJob);
      const formulario = await evaluacionesServicio.obtenerFormulario(EVALUADOR, ID_EVALUACION);
      assert.equal(formulario.estado_codigo, "VENCIDA");
      assert.equal(formulario.editable, false);
    });

    it("una evaluación ya enviada sigue enviada y tampoco se puede modificar", async () => {
      simular({ id_estado_ciclo: ESTADO_CICLO.CERRADO, id_estado_evaluacion: ESTADO_EVALUACION.ENVIADA, puntaje_final: 87.78, enviada_en: "2026-11-02T15:00:00.000Z", fecha_limite: "2026-11-07", hoy: HOY });
      const formulario = await evaluacionesServicio.obtenerFormulario(EVALUADOR, ID_EVALUACION);
      assert.equal(formulario.estado_codigo, "ENVIADA");
      assert.equal(formulario.editable, false);
      const error = await rechazo(() => evaluacionesServicio.guardarRespuestas(EVALUADOR, ID_EVALUACION, respuestaNueva));
      assert.equal(error.estado, 409);
      assert.match(error.message, /ya fue enviada/);
      assert.equal(escrituras.respuestas, 0);
    });

    it("aunque el job todavía no haya corrido, pasada la fecha límite ya no se puede editar y queda marcada como vencida", async () => {
      simular({ id_estado_ciclo: ESTADO_CICLO.ACTIVO, id_estado_evaluacion: ESTADO_EVALUACION.BORRADOR, fecha_limite: "2026-11-07", hoy: HOY });
      const error = await rechazo(() => evaluacionesServicio.guardarRespuestas(EVALUADOR, ID_EVALUACION, respuestaNueva));
      assert.equal(error.estado, 409);
      assert.match(error.message, /venció/);
      assert.equal(escrituras.respuestas, 0);
      assert.deepEqual(escrituras.estados, [ESTADO_EVALUACION.VENCIDA]);
    });

    it("el último día del plazo todavía se puede responder", async () => {
      simular({ id_estado_ciclo: ESTADO_CICLO.ACTIVO, id_estado_evaluacion: ESTADO_EVALUACION.PENDIENTE, fecha_limite: HOY, hoy: HOY });
      const resultado = await evaluacionesServicio.guardarRespuestas(EVALUADOR, ID_EVALUACION, respuestaNueva);
      assert.equal(resultado.estado_codigo, "BORRADOR");
      assert.equal(escrituras.respuestas, 1);
    });
  });
});
