const { describe, it, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

// La transacción entrega un cliente falso: el consumidor se prueba sin PostgreSQL.
const clienteFalso = { query: async () => ({ rows: [] }) };
const rutaTransaccion = require.resolve(
  path.join(__dirname, "../config/transaccion"),
);
require.cache[rutaTransaccion] = {
  id: rutaTransaccion,
  filename: rutaTransaccion,
  loaded: true,
  exports: { enTransaccion: async (trabajo) => trabajo(clienteFalso) },
};

const mensajesModelo = require("../models/mensajesEntrantesModel");
const desempenoModelo = require("../models/desempenoModel");
const crm = require("../services/consumidorCrmService");
const mensajesPublicados = require("../utils/mensajesPublicados");
const {
  ESTADO_MENSAJE,
  CODIGO_ESTADO_MENSAJE,
  TIPO_RESPUESTA_METRICAS_CRM,
  identificarMensaje,
  leerMensajeCrm,
  uuidDeterministico,
  generarMetricasSimuladas,
  armarRespuestaCrm,
  esperaReentrega,
  maximoIntentos,
  simulacionActiva,
  demoraRespuestaMs,
} = require("../utils/metricasCrm");
const { armarSolicitudMetricasCrm } = require("../utils/mensajeria");
const { uuid, baseFalsa } = require("./ayudas/consolidadoDesempeno");

const CICLO = uuid("1", 1);
const PERIODO = "2026-S1";
const E = (n) => uuid("4", n);

const ENTORNO = [
  "SIMULAR_CRM_ACTIVO",
  "SIMULAR_CRM_DEMORA_MS",
  "CRM_MAXIMO_INTENTOS",
  "CRM_REINTENTO_BASE_MS",
];
const entornoOriginal = Object.fromEntries(
  ENTORNO.map((nombre) => [nombre, process.env[nombre]]),
);

beforeEach(() => {
  mock.method(console, "log", () => {});
  mock.method(console, "error", () => {});
  process.env.CRM_REINTENTO_BASE_MS = "0";
  process.env.SIMULAR_CRM_DEMORA_MS = "0";
  delete process.env.CRM_MAXIMO_INTENTOS;
  delete process.env.SIMULAR_CRM_ACTIVO;
});

afterEach(() => {
  mock.restoreAll();
  for (const [nombre, valor] of Object.entries(entornoOriginal)) {
    if (valor === undefined) delete process.env[nombre];
    else process.env[nombre] = valor;
  }
});

const encabezado = (cambios = {}) => ({
  id_mensaje: uuid("9", Math.floor(Math.random() * 1e9)),
  origen: { grupo: "B", modulo: "CRM" },
  destino: { grupo: "F", modulo: "RRHH" },
  tipo: TIPO_RESPUESTA_METRICAS_CRM,
  fecha: "2026-07-06T12:00:00.000Z",
  version_esquema: 1,
  ...cambios,
});
const metrica = (n, quejas = 1, felicitaciones = 2, minutos = 12.5) => ({
  id_empleado: E(n),
  cantidad_quejas: quejas,
  cantidad_felicitaciones: felicitaciones,
  minutos_resolucion_promedio: minutos,
});
const mensaje = ({ cabecera, datos, metricas = [metrica(31)] } = {}) => ({
  encabezado: encabezado(cabecera),
  datos: { id_ciclo: CICLO, periodo: { nombre: PERIODO }, metricas, ...datos },
});
const texto = (m) => JSON.stringify(m);

// Base de datos en memoria con el mismo comportamiento que las consultas reales: un mensaje por id externo,
// intentos que se cuentan, estados que cambian y una fila de métricas por ciclo y colaborador.
function entorno({
  ciclo = {
    id_ciclo: CICLO,
    nombre: "Evaluación de desempeño 2026-S1",
    id_estado_ciclo: 3,
    periodo: PERIODO,
  },
  evaluados = [E(31), E(32), E(33)],
} = {}) {
  const e = {
    ciclo,
    evaluados,
    mensajes: new Map(),
    porExterno: new Map(),
    metricas: new Map(),
    fallarAlGuardar: 0,
  };
  let n = 0;
  const vista = (m) => ({
    ...m,
    estado: CODIGO_ESTADO_MENSAJE[m.id_estado_mensaje],
    metricas: [...e.metricas.values()].filter(
      (x) => x.id_mensaje === m.id_mensaje,
    ).length,
  });

  e.espias = {
    registrar: mock.method(
      mensajesModelo,
      "registrar",
      async ({ idExterno, tipoEvento, carga }) => {
        if (e.porExterno.has(idExterno))
          return {
            fila: vista(e.mensajes.get(e.porExterno.get(idExterno))),
            duplicado: true,
          };
        const id = uuid("a", ++n);
        e.mensajes.set(id, {
          id_mensaje: id,
          id_mensaje_externo: idExterno,
          tipo_evento: tipoEvento,
          carga,
          intentos: 0,
          ultimo_error: null,
          recibido_en: "2026-07-06T12:00:00.000Z",
          procesado_en: null,
          id_estado_mensaje: ESTADO_MENSAJE.RECIBIDO,
        });
        e.porExterno.set(idExterno, id);
        return { fila: vista(e.mensajes.get(id)), duplicado: false };
      },
    ),
    obtener: mock.method(mensajesModelo, "obtener", async (id) =>
      e.mensajes.has(id) ? vista(e.mensajes.get(id)) : null,
    ),
    bloquear: mock.method(
      mensajesModelo,
      "bloquear",
      async (id) => e.mensajes.get(id) ?? null,
    ),
    marcarProcesado: mock.method(
      mensajesModelo,
      "marcarProcesado",
      async (id) => {
        const m = e.mensajes.get(id);
        if (m.id_estado_mensaje !== ESTADO_MENSAJE.RECIBIDO) return;
        Object.assign(m, {
          id_estado_mensaje: ESTADO_MENSAJE.PROCESADO,
          procesado_en: "2026-07-06T12:00:01.000Z",
          intentos: m.intentos + 1,
          ultimo_error: null,
        });
      },
    ),
    registrarFallo: mock.method(
      mensajesModelo,
      "registrarFallo",
      async (id, error) => {
        const m = e.mensajes.get(id);
        if (m.id_estado_mensaje !== ESTADO_MENSAJE.RECIBIDO) return null;
        m.intentos += 1;
        m.ultimo_error = error.slice(0, 255);
        return m.intentos;
      },
    ),
    enviarADlq: mock.method(mensajesModelo, "enviarADlq", async (id) => {
      const m = e.mensajes.get(id);
      if (m.id_estado_mensaje === ESTADO_MENSAJE.RECIBIDO)
        m.id_estado_mensaje = ESTADO_MENSAJE.EN_DLQ;
    }),
    reabrir: mock.method(mensajesModelo, "reabrir", async (id) => {
      const m = e.mensajes.get(id);
      if (m?.id_estado_mensaje !== ESTADO_MENSAJE.EN_DLQ) return false;
      Object.assign(m, {
        id_estado_mensaje: ESTADO_MENSAJE.RECIBIDO,
        intentos: 0,
        ultimo_error: null,
      });
      return true;
    }),
    listar: mock.method(mensajesModelo, "listar", async ({ idEstado }) =>
      [...e.mensajes.values()]
        .filter((m) => !idEstado || m.id_estado_mensaje === idEstado)
        .map(vista),
    ),
    antiguos: mock.method(mensajesModelo, "listarRecibidosAntiguos", async () =>
      [...e.mensajes.values()].filter(
        (m) => m.id_estado_mensaje === ESTADO_MENSAJE.RECIBIDO,
      ),
    ),
    evaluados: mock.method(
      mensajesModelo,
      "listarEvaluadosDelCiclo",
      async () => e.evaluados,
    ),
    guardar: mock.method(
      mensajesModelo,
      "guardarMetricas",
      async (idCiclo, idMensaje, metricas) => {
        if (e.fallarAlGuardar > 0) {
          e.fallarAlGuardar -= 1;
          throw new Error("la base no responde");
        }
        for (const m of metricas)
          e.metricas.set(`${idCiclo}:${m.idEmpleado}`, {
            id_mensaje: idMensaje,
            quejas: m.cantidadQuejas,
            felicitaciones: m.cantidadFelicitaciones,
            minutos: m.minutosResolucion,
          });
      },
    ),
    ciclo: mock.method(desempenoModelo, "obtenerCiclo", async (id) =>
      e.ciclo && id === e.ciclo.id_ciclo ? e.ciclo : null,
    ),
  };
  e.metrica = (n) => e.metricas.get(`${CICLO}:${E(n)}`);
  e.unico = () => [...e.mensajes.values()].at(-1);
  return e;
}

const recibir = async (m) => {
  const recibido = await crm.recibirMensaje(
    typeof m === "string" ? m : texto(m),
  );
  return { ...recibido, fin: await recibido.terminado };
};

describe("lectura de la respuesta del CRM", () => {
  describe("un mensaje válido", () => {
    it("se lee con el ciclo, el periodo y las métricas de cada colaborador", () => {
      const lectura = leerMensajeCrm(
        texto(
          mensaje({
            metricas: [metrica(31, 3, 4, 20), metrica(32, 0, 7, null)],
          }),
        ),
      );

      assert.equal(lectura.errores, undefined);
      assert.deepEqual(lectura.mensaje, {
        idCiclo: CICLO,
        periodo: PERIODO,
        metricas: [
          {
            idEmpleado: E(31),
            cantidadQuejas: 3,
            cantidadFelicitaciones: 4,
            minutosResolucion: 20,
          },
          {
            idEmpleado: E(32),
            cantidadQuejas: 0,
            cantidadFelicitaciones: 7,
            minutosResolucion: null,
          },
        ],
      });
    });

    it("el periodo es opcional, y los minutos ausentes son «sin casos»", () => {
      const m = mensaje({
        datos: { periodo: undefined },
        metricas: [
          {
            id_empleado: E(31),
            cantidad_quejas: 0,
            cantidad_felicitaciones: 0,
          },
        ],
      });
      const { mensaje: leido } = leerMensajeCrm(texto(m));

      assert.equal(leido.periodo, null);
      assert.equal(leido.metricas[0].minutosResolucion, null);
    });

    it("normaliza los identificadores a minúsculas y redondea los minutos a 2 decimales", () => {
      const { mensaje: leido } = leerMensajeCrm(
        texto(
          mensaje({
            datos: { id_ciclo: CICLO.toUpperCase() },
            metricas: [
              {
                ...metrica(31),
                id_empleado: E(31).toUpperCase(),
                minutos_resolucion_promedio: 12.345,
              },
            ],
          }),
        ),
      );

      assert.equal(leido.idCiclo, CICLO);
      assert.equal(leido.metricas[0].idEmpleado, E(31));
      assert.equal(leido.metricas[0].minutosResolucion, 12.35);
    });
  });

  describe("un mensaje que no sirve", () => {
    const casos = [
      ["un JSON roto", "{esto no es json", /no es un JSON válido/],
      ["un texto vacío", "", /no es un JSON válido/],
      ["una lista en vez de un objeto", "[]", /debe ser un objeto JSON/],
      ["un número", "5", /debe ser un objeto JSON/],
      [
        "sin encabezado",
        texto({ datos: mensaje().datos }),
        /Falta el encabezado/,
      ],
      [
        "de otro tipo",
        texto(mensaje({ cabecera: { tipo: "SOLICITUD_COMPRA" } })),
        /El tipo debe ser METRICAS_DESEMPENO_CRM/,
      ],
      [
        "que no viene del CRM",
        texto(
          mensaje({ cabecera: { origen: { grupo: "C", modulo: "Compras" } } }),
        ),
        /El origen debe ser el grupo B/,
      ],
      [
        "dirigido a otro grupo",
        texto(
          mensaje({ cabecera: { destino: { grupo: "E", modulo: "Ventas" } } }),
        ),
        /El destino debe ser el grupo F/,
      ],
      ["sin datos", texto({ encabezado: encabezado() }), /Faltan los datos/],
      [
        "con un ciclo inválido",
        texto(mensaje({ datos: { id_ciclo: "no-es-uuid" } })),
        /id_ciclo debe ser un identificador válido/,
      ],
      [
        "sin ciclo",
        texto(mensaje({ datos: { id_ciclo: undefined } })),
        /id_ciclo/,
      ],
      [
        "con métricas que no son una lista",
        texto(mensaje({ datos: { metricas: "x" } })),
        /datos\.metricas debe ser una lista/,
      ],
      [
        "sin ninguna métrica",
        texto(mensaje({ metricas: [] })),
        /al menos un colaborador/,
      ],
      [
        "con una métrica que no es un objeto",
        texto(mensaje({ metricas: [5] })),
        /metricas\[0\] debe ser un objeto/,
      ],
      [
        "con un colaborador inválido",
        texto(mensaje({ metricas: [{ ...metrica(31), id_empleado: "x" }] })),
        /metricas\[0\]\.id_empleado/,
      ],
      [
        "con quejas negativas",
        texto(mensaje({ metricas: [metrica(31, -1)] })),
        /cantidad_quejas debe ser un entero mayor o igual a 0/,
      ],
      [
        "con felicitaciones decimales",
        texto(mensaje({ metricas: [metrica(31, 1, 2.5)] })),
        /cantidad_felicitaciones/,
      ],
      [
        "con quejas como texto",
        texto(mensaje({ metricas: [metrica(31, "3")] })),
        /cantidad_quejas/,
      ],
      [
        "con quejas desmesuradas",
        texto(mensaje({ metricas: [metrica(31, 1e9)] })),
        /cantidad_quejas/,
      ],
      [
        "con minutos negativos",
        texto(mensaje({ metricas: [metrica(31, 1, 1, -5)] })),
        /minutos_resolucion_promedio/,
      ],
      [
        "con minutos como texto",
        texto(mensaje({ metricas: [metrica(31, 1, 1, "12")] })),
        /minutos_resolucion_promedio/,
      ],
      [
        "con minutos que no caben en la base",
        texto(mensaje({ metricas: [metrica(31, 1, 1, 1e9)] })),
        /minutos_resolucion_promedio/,
      ],
      [
        "con un colaborador repetido",
        texto(mensaje({ metricas: [metrica(31), metrica(31, 5, 5, 5)] })),
        /metricas\[1\] repite al colaborador/,
      ],
    ];
    for (const [nombre, entrada, patron] of casos) {
      it(`rechaza ${nombre}`, () => {
        const lectura = leerMensajeCrm(entrada);
        assert.equal(lectura.mensaje, undefined);
        assert.match(lectura.errores.join(" "), patron);
      });
    }

    it("informa varios errores a la vez en lugar de uno solo", () => {
      const { errores } = leerMensajeCrm(
        texto(
          mensaje({
            cabecera: {
              tipo: "X",
              origen: { grupo: "C" },
              destino: { grupo: "E" },
            },
            datos: { id_ciclo: "x" },
          }),
        ),
      );
      assert.ok(errores.length >= 4, errores.join(" | "));
    });

    it("con demasiados errores muestra los primeros y cuenta el resto", () => {
      const malas = Array.from({ length: 20 }, (_, i) => ({
        ...metrica(i + 1),
        id_empleado: "x",
      }));
      const { errores } = leerMensajeCrm(texto(mensaje({ metricas: malas })));

      assert.equal(errores.length, 9);
      assert.equal(errores.at(-1), "…y 12 error(es) más.");
    });
  });

  describe("cómo se identifica un mensaje entrante", () => {
    it("usa el id_mensaje de su encabezado", () => {
      const identidad = identificarMensaje(
        texto(mensaje({ cabecera: { id_mensaje: "  abc-123 " } })),
      );
      assert.deepEqual(
        [identidad.idExterno, identidad.tipoEvento],
        ["abc-123", TIPO_RESPUESTA_METRICAS_CRM],
      );
    });

    it("un texto ilegible se identifica por su hash, así igual queda registrado y no se procesa dos veces", () => {
      const uno = identificarMensaje("{roto");
      assert.match(uno.idExterno, /^[0-9a-f]{64}$/);
      assert.equal(uno.cuerpo, null);
      assert.equal(uno.tipoEvento, null);
      assert.equal(
        identificarMensaje("{roto").idExterno,
        uno.idExterno,
        "el mismo texto, el mismo id",
      );
      assert.notEqual(identificarMensaje("{roto2").idExterno, uno.idExterno);
    });

    it("sin id en el encabezado, o con uno que no cabe en la base, también usa el hash", () => {
      assert.match(
        identificarMensaje(texto({ encabezado: {} })).idExterno,
        /^[0-9a-f]{64}$/,
      );
      assert.match(
        identificarMensaje(
          texto(mensaje({ cabecera: { id_mensaje: "x".repeat(65) } })),
        ).idExterno,
        /^[0-9a-f]{64}$/,
      );
      assert.match(
        identificarMensaje(texto(mensaje({ cabecera: { id_mensaje: 42 } })))
          .idExterno,
        /^[0-9a-f]{64}$/,
      );
    });

    it("el tipo se recorta a lo que cabe en la columna", () => {
      assert.equal(
        identificarMensaje(
          texto(mensaje({ cabecera: { tipo: "T".repeat(100) } })),
        ).tipoEvento.length,
        60,
      );
    });
  });
});

describe("respuesta simulada del CRM", () => {
  const colaboradores = [E(31), E(32), E(33)].map((id) => ({
    id_empleado: id,
  }));
  const solicitud = armarSolicitudMetricasCrm({
    idMensaje: uuid("5", 1),
    fecha: "2026-07-05T12:01:00.000Z",
    ciclo: {
      id_ciclo: CICLO,
      nombre: "C",
      fecha_inicio: "2026-06-01",
      fecha_limite: "2026-07-03",
      cerrado_en: null,
      id_periodo: uuid("6", 1),
      periodo: PERIODO,
      periodo_fecha_inicio: "2026-01-01",
      periodo_fecha_fin: "2026-06-30",
    },
    colaboradores,
  });

  it("el UUID determinístico es estable, tiene forma de UUID v5 y cambia con el texto", () => {
    const id = uuidDe("a");
    assert.equal(id, uuidDe("a"));
    assert.notEqual(id, uuidDe("b"));
    assert.match(
      id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    function uuidDe(t) {
      return uuidDeterministico(t);
    }
  });

  it("las métricas simuladas se repiten para la misma solicitud y colaborador, y respetan los rangos", () => {
    const uno = generarMetricasSimuladas(uuid("5", 1), colaboradores);
    assert.deepEqual(
      uno,
      generarMetricasSimuladas(uuid("5", 1), colaboradores),
    );
    assert.notDeepEqual(
      uno,
      generarMetricasSimuladas(uuid("5", 2), colaboradores),
    );
    for (const m of generarMetricasSimuladas(
      uuid("5", 3),
      Array.from({ length: 200 }, (_, i) => ({ id_empleado: E(i + 1) })),
    )) {
      assert.ok(m.cantidad_quejas >= 0 && m.cantidad_quejas <= 9);
      assert.ok(
        m.cantidad_felicitaciones >= 0 && m.cantidad_felicitaciones <= 8,
      );
      if (m.cantidad_quejas === 0)
        assert.equal(
          m.minutos_resolucion_promedio,
          null,
          "sin quejas no hay tiempo de resolución",
        );
      else
        assert.ok(
          m.minutos_resolucion_promedio >= 10 &&
            m.minutos_resolucion_promedio <= 60,
        );
    }
  });

  it("la respuesta va del CRM a RRHH, responde a la solicitud y cubre a los mismos colaboradores", () => {
    const respuesta = armarRespuestaCrm(solicitud, "2026-07-05T12:05:00.000Z");

    assert.deepEqual(respuesta.encabezado, {
      id_mensaje: uuidDeterministico(`respuesta-crm:${uuid("5", 1)}`),
      origen: { grupo: "B", modulo: "CRM" },
      destino: { grupo: "F", modulo: "RRHH" },
      tipo: "METRICAS_DESEMPENO_CRM",
      fecha: "2026-07-05T12:05:00.000Z",
      version_esquema: 1,
    });
    assert.equal(respuesta.datos.id_ciclo, CICLO);
    assert.equal(respuesta.datos.id_mensaje_solicitud, uuid("5", 1));
    assert.deepEqual(respuesta.datos.periodo, { nombre: PERIODO });
    assert.deepEqual(
      respuesta.datos.metricas.map((m) => m.id_empleado),
      [E(31), E(32), E(33)],
    );
  });

  it("la respuesta simulada es válida para el propio consumidor", () => {
    const lectura = leerMensajeCrm(
      JSON.stringify(armarRespuestaCrm(solicitud)),
    );
    assert.equal(lectura.errores, undefined, lectura.errores?.join(" "));
    assert.equal(lectura.mensaje.metricas.length, 3);
  });

  it("una solicitud republicada produce la misma respuesta con el mismo id (se descartará como duplicado)", () => {
    const a = armarRespuestaCrm(solicitud, "2026-07-05T12:05:00.000Z");
    const b = armarRespuestaCrm(solicitud, "2026-07-06T09:00:00.000Z");
    assert.equal(a.encabezado.id_mensaje, b.encabezado.id_mensaje);
    assert.deepEqual(a.datos, b.datos);
  });

  it("la simulación se puede apagar y su demora configurar", () => {
    assert.equal(simulacionActiva(), true);
    process.env.SIMULAR_CRM_ACTIVO = "false";
    assert.equal(simulacionActiva(), false);
    process.env.SIMULAR_CRM_DEMORA_MS = "1500";
    assert.equal(demoraRespuestaMs(), 1500);
    process.env.SIMULAR_CRM_DEMORA_MS = "abc";
    assert.equal(
      demoraRespuestaMs(),
      2000,
      "un valor inválido vuelve al valor por defecto",
    );
  });
});

describe("Las métricas del CRM se asocian a cada colaborador", () => {
  it("guarda quejas, felicitaciones y tiempo de resolución de cada colaborador y deja el mensaje procesado", async () => {
    const e = entorno();
    const { fin, duplicado, estado } = await recibir(
      mensaje({ metricas: [metrica(31, 9, 1, 48.5), metrica(32, 0, 8, null)] }),
    );

    assert.equal(
      estado,
      "RECIBIDO",
      "responde enseguida; se procesa en segundo plano",
    );
    assert.equal(duplicado, false);
    assert.equal(fin.estado, "PROCESADO");
    assert.deepEqual(e.metrica(31), {
      id_mensaje: e.unico().id_mensaje,
      quejas: 9,
      felicitaciones: 1,
      minutos: 48.5,
    });
    assert.deepEqual(e.metrica(32), {
      id_mensaje: e.unico().id_mensaje,
      quejas: 0,
      felicitaciones: 8,
      minutos: null,
    });
    assert.equal(
      e.metrica(33),
      undefined,
      "quien no vino en el mensaje no tiene métricas",
    );
  });

  it("anota en el mensaje que se procesó: una entrega, sin error y con su fecha", async () => {
    const e = entorno();
    await recibir(mensaje());

    assert.deepEqual(
      [e.unico().intentos, e.unico().ultimo_error, e.unico().id_estado_mensaje],
      [1, null, ESTADO_MENSAJE.PROCESADO],
    );
    assert.ok(e.unico().procesado_en);
  });

  it("guarda todas las métricas en una sola operación", async () => {
    const e = entorno();
    await recibir(
      mensaje({ metricas: [metrica(31), metrica(32), metrica(33)] }),
    );

    assert.equal(e.espias.guardar.mock.callCount(), 1);
    assert.equal(e.espias.guardar.mock.calls[0].arguments[2].length, 3);
  });

  it("un mensaje nuevo del mismo colaborador reemplaza sus métricas y deja las de los demás", async () => {
    const e = entorno();
    await recibir(
      mensaje({ metricas: [metrica(31, 1, 1, 10), metrica(32, 2, 2, 20)] }),
    );
    const primero = e.unico().id_mensaje;
    await recibir(mensaje({ metricas: [metrica(31, 7, 0, 70)] }));

    assert.deepEqual(e.metrica(31), {
      id_mensaje: e.unico().id_mensaje,
      quejas: 7,
      felicitaciones: 0,
      minutos: 70,
    });
    assert.equal(
      e.metrica(32).id_mensaje,
      primero,
      "B conserva las del primer mensaje",
    );
    assert.equal(
      [...e.metricas.keys()].length,
      2,
      "sigue habiendo una fila por ciclo y colaborador",
    );
  });

  it("acepta el periodo cuando coincide con el del ciclo y también cuando no se informa", async () => {
    entorno();
    assert.equal((await recibir(mensaje())).fin.estado, "PROCESADO");
    assert.equal(
      (await recibir(mensaje({ datos: { periodo: undefined } }))).fin.estado,
      "PROCESADO",
    );
  });

  it("muestra el mensaje recibido en la consola del navegador, de B hacia F", async () => {
    entorno();
    const antes = mensajesPublicados.listarDesde(0).ultimo;
    await recibir(mensaje());
    const [registrado] = mensajesPublicados.listarDesde(antes).mensajes;

    assert.equal(registrado.direccion, "recibido");
    assert.equal(registrado.topico, "ucb-sis323-sub-b");
    assert.match(registrado.id_pubsub, /^simulado-/);
    assert.deepEqual(
      [
        registrado.atributos.origen,
        registrado.atributos.destino,
        registrado.atributos.tipo,
      ],
      ["B", "F", TIPO_RESPUESTA_METRICAS_CRM],
    );
  });

  it("un mensaje ilegible igual se muestra en la consola, solo que sin atributos", async () => {
    entorno();
    const antes = mensajesPublicados.listarDesde(0).ultimo;
    await recibir("{roto");
    const [registrado] = mensajesPublicados.listarDesde(antes).mensajes;

    assert.deepEqual(registrado.atributos, {});
    assert.equal(registrado.mensaje, "{roto");
  });

  it("procesa la respuesta simulada a una solicitud publicada, con las métricas que generó", async () => {
    const e = entorno();
    const solicitud = armarSolicitudMetricasCrm({
      idMensaje: uuid("5", 1),
      fecha: "2026-07-05T12:01:00.000Z",
      ciclo: {
        id_ciclo: CICLO,
        nombre: "C",
        fecha_inicio: "2026-06-01",
        fecha_limite: "2026-07-03",
        cerrado_en: null,
        id_periodo: uuid("6", 1),
        periodo: PERIODO,
        periodo_fecha_inicio: "2026-01-01",
        periodo_fecha_fin: "2026-06-30",
      },
      colaboradores: [31, 32, 33].map((n) => ({
        id_empleado: E(n),
        nombre_completo: `C${n}`,
        cargo: { codigo: "ATC-CAJ", nombre: "Cajero" },
        id_sucursal: uuid("e", 1),
        sucursal: "Sopocachi",
      })),
    });
    const recibido = await crm.simularRespuesta(solicitud);
    assert.equal(await recibido.terminado.then((r) => r.estado), "PROCESADO");

    for (const esperada of generarMetricasSimuladas(
      uuid("5", 1),
      [E(31), E(32), E(33)].map((id) => ({ id_empleado: id })),
    )) {
      const guardada = e.metricas.get(`${CICLO}:${esperada.id_empleado}`);
      assert.equal(guardada.quejas, esperada.cantidad_quejas);
      assert.equal(guardada.felicitaciones, esperada.cantidad_felicitaciones);
    }
  });
});

describe("duplicados", () => {
  it("el mismo mensaje recibido dos veces se procesa una sola vez", async () => {
    const e = entorno();
    const m = mensaje({ metricas: [metrica(31, 4, 4, 40)] });
    await recibir(m);
    const repetido = await recibir(m);

    assert.equal(repetido.duplicado, true);
    assert.equal(repetido.estado, "PROCESADO");
    assert.equal(e.mensajes.size, 1);
    assert.equal(e.espias.guardar.mock.callCount(), 1);
    assert.equal(
      e.unico().intentos,
      1,
      "la segunda entrega no cuenta como intento",
    );
  });

  it("un duplicado no pisa métricas más nuevas", async () => {
    const e = entorno();
    const viejo = mensaje({ metricas: [metrica(31, 1, 1, 10)] });
    await recibir(viejo);
    await recibir(mensaje({ metricas: [metrica(31, 9, 9, 90)] }));
    await recibir(viejo);

    assert.equal(e.metrica(31).quejas, 9);
  });

  it("el duplicado de un mensaje que fue a la cola de errores no se vuelve a procesar", async () => {
    const e = entorno();
    const malo = mensaje({ datos: { id_ciclo: uuid("1", 99) } });
    await recibir(malo);
    const repetido = await recibir(malo);

    assert.equal(repetido.duplicado, true);
    assert.equal(repetido.estado, "EN_DLQ");
    assert.equal(e.unico().intentos, maximoIntentos(), "no sumó más intentos");
  });

  it("el mismo contenido con otro id es un mensaje nuevo", async () => {
    const e = entorno();
    const base = mensaje();
    await recibir(base);
    await recibir({
      ...base,
      encabezado: { ...base.encabezado, id_mensaje: uuid("9", 777) },
    });

    assert.equal(e.mensajes.size, 2);
  });

  it("el mismo mensaje llegando varias veces a la vez se registra y se procesa una sola vez", async () => {
    const e = entorno();
    const m = texto(mensaje());
    const recibidos = await Promise.all([
      crm.recibirMensaje(m),
      crm.recibirMensaje(m),
      crm.recibirMensaje(m),
    ]);
    await Promise.all(recibidos.map((r) => r.terminado));

    assert.equal(recibidos.filter((r) => !r.duplicado).length, 1);
    assert.equal(e.mensajes.size, 1);
    assert.equal(e.espias.guardar.mock.callCount(), 1);
  });

  it("un mensaje ilegible repetido tampoco se registra dos veces", async () => {
    const e = entorno();
    await recibir("{roto");
    const repetido = await recibir("{roto");

    assert.equal(repetido.duplicado, true);
    assert.equal(e.mensajes.size, 1);
  });
});

describe("Fallos, reintentos y cola de errores (DLQ)", () => {
  describe("un mensaje que no se puede procesar", () => {
    const casos = [
      ["un JSON roto", () => "{esto no es json", /no es un JSON válido/],
      [
        "un encabezado equivocado",
        () =>
          mensaje({
            cabecera: {
              destino: { grupo: "C", modulo: "Compras" },
              tipo: "OTRO",
            },
          }),
        /tipo debe ser METRICAS_DESEMPENO_CRM/,
      ],
      [
        "un ciclo que no existe",
        () => mensaje({ datos: { id_ciclo: uuid("1", 99) } }),
        /ciclo indicado no existe/,
      ],
      [
        "un periodo que no es el del ciclo",
        () => mensaje({ datos: { periodo: { nombre: "2030-S1" } } }),
        /«2030-S1» no corresponde al del ciclo \(«2026-S1»\)/,
      ],
      [
        "un colaborador que no se evaluó en el ciclo",
        () => mensaje({ metricas: [metrica(31), metrica(77)] }),
        new RegExp(`no fueron evaluados en el ciclo: ${E(77)}`),
      ],
      [
        "cantidades negativas",
        () => mensaje({ metricas: [metrica(31, -3)] }),
        /cantidad_quejas/,
      ],
    ];

    for (const [nombre, armar, patron] of casos) {
      it(`con ${nombre}: reintenta y al agotar los intentos queda en la cola de errores con el motivo`, async () => {
        const e = entorno();
        const { fin } = await recibir(armar());
        const guardado = e.unico();

        assert.equal(fin.estado, "EN_DLQ");
        assert.match(fin.error, patron);
        assert.equal(guardado.id_estado_mensaje, ESTADO_MENSAJE.EN_DLQ);
        assert.equal(guardado.intentos, 5, "cinco entregas antes de rendirse");
        assert.match(guardado.ultimo_error, patron);
        assert.equal(guardado.procesado_en, null);
        assert.equal(e.espias.registrarFallo.mock.callCount(), 5);
        assert.equal(e.espias.enviarADlq.mock.callCount(), 1);
        assert.equal(
          e.espias.guardar.mock.callCount(),
          0,
          "no guardó ninguna métrica",
        );
        assert.equal(e.metricas.size, 0);
      });
    }

    it("un ciclo que todavía no está cerrado no recibe métricas", async () => {
      const e = entorno({
        ciclo: {
          id_ciclo: CICLO,
          nombre: "Ciclo abierto",
          id_estado_ciclo: 2,
          periodo: PERIODO,
        },
      });
      const { fin } = await recibir(mensaje());

      assert.equal(fin.estado, "EN_DLQ");
      assert.match(fin.error, /aún no está cerrado/);
      assert.equal(e.espias.guardar.mock.callCount(), 0);
    });

    it("todo o nada: un mensaje con un colaborador válido y otro ajeno no guarda a ninguno", async () => {
      const e = entorno();
      const { fin } = await recibir(
        mensaje({ metricas: [metrica(31, 9, 9, 9), metrica(77)] }),
      );

      assert.equal(fin.estado, "EN_DLQ");
      assert.equal(e.metricas.size, 0);
      assert.equal(e.espias.guardar.mock.callCount(), 0);
    });

    it("lo que falla no toca las métricas que ya estaban guardadas", async () => {
      const e = entorno();
      await recibir(mensaje({ metricas: [metrica(31, 2, 3, 30)] }));
      const antes = { ...e.metrica(31) };
      await recibir(
        mensaje({ metricas: [metrica(31, 99, 99, 99), metrica(77)] }),
      );

      assert.deepEqual(e.metrica(31), antes);
    });

    it("un mensaje malo no impide procesar a los buenos que llegan al mismo tiempo", async () => {
      const e = entorno();
      const [malo, bueno] = await Promise.all([
        recibir("{roto"),
        recibir(mensaje({ metricas: [metrica(32, 5, 5, 50)] })),
      ]);

      assert.equal(malo.fin.estado, "EN_DLQ");
      assert.equal(bueno.fin.estado, "PROCESADO");
      assert.equal(e.metrica(32).quejas, 5);
    });
  });

  describe("cuántas veces se reintenta", () => {
    it("el máximo de entregas sale de CRM_MAXIMO_INTENTOS (por defecto 5)", async () => {
      assert.equal(maximoIntentos(), 5);
      process.env.CRM_MAXIMO_INTENTOS = "2";
      assert.equal(maximoIntentos(), 2);
      const e = entorno();
      const { fin } = await recibir("{roto");

      assert.equal(fin.estado, "EN_DLQ");
      assert.equal(e.unico().intentos, 2);
    });

    it("con un valor inválido se usa el mínimo de un intento, sin reintentos", () => {
      process.env.CRM_MAXIMO_INTENTOS = "0";
      assert.equal(maximoIntentos(), 1);
      process.env.CRM_MAXIMO_INTENTOS = "abc";
      assert.equal(maximoIntentos(), 5);
    });

    it("la espera entre entregas se duplica desde CRM_REINTENTO_BASE_MS hasta un minuto", () => {
      process.env.CRM_REINTENTO_BASE_MS = "1000";
      assert.deepEqual(
        [1, 2, 3, 4, 5].map(esperaReentrega),
        [1000, 2000, 4000, 8000, 16000],
      );
      assert.equal(esperaReentrega(30), 60000);
      process.env.CRM_REINTENTO_BASE_MS = "0";
      assert.equal(esperaReentrega(3), 0);
    });

    it("una falla pasajera se recupera: reintenta y termina procesado, sin pasar por la cola de errores", async () => {
      const e = entorno();
      e.fallarAlGuardar = 2;
      const { fin } = await recibir(
        mensaje({ metricas: [metrica(31, 6, 6, 60)] }),
      );

      assert.equal(fin.estado, "PROCESADO");
      assert.equal(e.unico().intentos, 3, "dos fallidas y la que sí se aplicó");
      assert.equal(
        e.unico().ultimo_error,
        null,
        "al procesarse se limpia el error",
      );
      assert.equal(e.espias.enviarADlq.mock.callCount(), 0);
      assert.equal(e.metrica(31).quejas, 6);
    });

    it("si la falla pasajera dura más que los intentos, termina en la cola de errores con el motivo", async () => {
      const e = entorno();
      e.fallarAlGuardar = 99;
      const { fin } = await recibir(mensaje());

      assert.equal(fin.estado, "EN_DLQ");
      assert.equal(e.unico().ultimo_error, "la base no responde");
    });

    it("el error guardado cabe en la columna (255 caracteres)", async () => {
      const e = entorno();
      e.fallarAlGuardar = 99;
      e.espias.guardar.mock.mockImplementation(async () => {
        throw new Error("x".repeat(500));
      });
      await recibir(mensaje());

      assert.equal(e.unico().ultimo_error.length, 255);
    });
  });

  describe("retomar lo que quedó a medias", () => {
    it("un mensaje que quedó RECIBIDO (el servicio se reinició) se vuelve a entregar", async () => {
      const e = entorno();
      e.mensajes.set("m-1", {
        id_mensaje: "m-1",
        id_mensaje_externo: "x",
        tipo_evento: TIPO_RESPUESTA_METRICAS_CRM,
        carga: texto(mensaje({ metricas: [metrica(33, 2, 2, 20)] })),
        intentos: 2,
        ultimo_error: "error previo",
        recibido_en: "2026-07-06T11:00:00.000Z",
        procesado_en: null,
        id_estado_mensaje: ESTADO_MENSAJE.RECIBIDO,
      });
      await crm.reanudarRecibidos();
      for (
        let i = 0;
        i < 50 &&
        e.mensajes.get("m-1").id_estado_mensaje === ESTADO_MENSAJE.RECIBIDO;
        i += 1
      )
        await new Promise((r) => setTimeout(r, 5));

      assert.equal(
        e.mensajes.get("m-1").id_estado_mensaje,
        ESTADO_MENSAJE.PROCESADO,
      );
      assert.equal(
        e.mensajes.get("m-1").intentos,
        3,
        "continúa la cuenta donde iba",
      );
      assert.equal(e.metrica(33).quejas, 2);
    });

    it("no retoma lo que ya está en la cola de errores ni lo ya procesado", async () => {
      const e = entorno();
      await recibir("{roto");
      await recibir(mensaje());
      const llamadas = e.espias.bloquear.mock.callCount();
      await crm.reanudarRecibidos();
      await new Promise((r) => setTimeout(r, 20));

      assert.equal(e.espias.bloquear.mock.callCount(), llamadas);
    });

    it("si no puede consultar los pendientes, lo registra y sigue", async () => {
      const e = entorno();
      e.espias.antiguos.mock.mockImplementation(async () => {
        throw new Error("sin base");
      });
      await assert.doesNotReject(crm.reanudarRecibidos());
    });
  });
});

describe("revisión y reproceso de la cola de errores", () => {
  const enDlq = async (e, cambios = {}) => {
    const { id_mensaje: id } = await recibir(
      mensaje({ datos: { id_ciclo: CICLO, ...cambios } }),
    ).then(() => e.unico());
    return id;
  };

  it("lista los mensajes con su estado, intentos, motivo y la carga para revisarla", async () => {
    const e = entorno();
    await recibir("{roto");
    await recibir(mensaje());
    const todos = await crm.listarMensajes();
    const dlq = await crm.listarMensajes({ estado: "EN_DLQ" });

    assert.equal(todos.length, 2);
    assert.equal(dlq.length, 1);
    assert.deepEqual(
      {
        estado: dlq[0].estado,
        intentos: dlq[0].intentos,
        ultimo_error: dlq[0].ultimo_error,
        carga: dlq[0].carga,
        metricas: dlq[0].metricas,
      },
      {
        estado: "EN_DLQ",
        intentos: 5,
        ultimo_error: "El mensaje no es un JSON válido.",
        carga: "{roto",
        metricas: 0,
      },
    );
    assert.equal(
      (await crm.listarMensajes({ estado: "PROCESADO" }))[0].metricas,
      1,
    );
    assert.equal(e.espias.listar.mock.callCount(), 3);
  });

  it("rechaza un estado que no existe", async () => {
    entorno();
    await assert.rejects(
      crm.listarMensajes({ estado: "XX" }),
      (err) => err.estado === 400 && err.detalles[0].campo === "estado",
    );
  });

  it("reprocesa un mensaje de la cola cuando ya se corrigió lo que fallaba", async () => {
    const e = entorno({
      ciclo: {
        id_ciclo: CICLO,
        nombre: "Ciclo",
        id_estado_ciclo: 2,
        periodo: PERIODO,
      },
    });
    const id = await enDlq(e, { id_ciclo: CICLO });
    assert.equal(e.mensajes.get(id).id_estado_mensaje, ESTADO_MENSAJE.EN_DLQ);

    e.ciclo.id_estado_ciclo = 3; // el ciclo se cerró
    const resultado = await crm.reprocesarMensaje(id);

    assert.equal(resultado.estado, "PROCESADO");
    assert.equal(resultado.ultimo_error, null);
    assert.equal(resultado.intentos, 1, "el reproceso empieza de cero");
    assert.equal(e.metrica(31).quejas, 1);
  });

  it("si vuelve a fallar responde 422 y el mensaje sigue en la cola con el motivo actualizado", async () => {
    const e = entorno({
      ciclo: {
        id_ciclo: CICLO,
        nombre: "Ciclo",
        id_estado_ciclo: 2,
        periodo: PERIODO,
      },
    });
    const id = await enDlq(e);
    e.ciclo.nombre = "Ciclo";

    await assert.rejects(
      crm.reprocesarMensaje(id),
      (err) => err.estado === 422 && /aún no está cerrado/.test(err.message),
    );
    assert.equal(e.mensajes.get(id).id_estado_mensaje, ESTADO_MENSAJE.EN_DLQ);
    assert.equal(
      e.mensajes.get(id).intentos,
      1,
      "un solo intento en el reproceso",
    );
    assert.equal(e.metricas.size, 0);
  });

  it("solo se reprocesan los mensajes de la cola: uno procesado responde 409", async () => {
    const e = entorno();
    await recibir(mensaje());

    await assert.rejects(
      crm.reprocesarMensaje(e.unico().id_mensaje),
      (err) => err.estado === 409 && /cola de errores/.test(err.message),
    );
    assert.equal(e.espias.guardar.mock.callCount(), 1, "no se aplicó otra vez");
  });

  it("un mensaje inexistente o un id inválido responden 404", async () => {
    entorno();
    await assert.rejects(
      crm.reprocesarMensaje(uuid("a", 999)),
      (err) => err.estado === 404,
    );
    await assert.rejects(
      crm.reprocesarMensaje("x"),
      (err) => err.estado === 404,
    );
    await assert.rejects(
      crm.reprocesarMensaje(undefined),
      (err) => err.estado === 404,
    );
  });

  describe("simulación manual de un mensaje del CRM", () => {
    it("registra el mensaje y responde enseguida, sin esperar a que termine de procesarse", async () => {
      const e = entorno();
      const respuesta = await crm.simularLlegada({ mensaje: mensaje() });

      assert.deepEqual(Object.keys(respuesta).sort(), [
        "duplicado",
        "estado",
        "id_mensaje",
      ]);
      assert.equal(respuesta.duplicado, false);
      assert.equal(respuesta.estado, "RECIBIDO");
      for (
        let i = 0;
        i < 50 &&
        e.mensajes.get(respuesta.id_mensaje).id_estado_mensaje ===
          ESTADO_MENSAJE.RECIBIDO;
        i += 1
      )
        await new Promise((r) => setTimeout(r, 5));
      assert.equal(
        e.mensajes.get(respuesta.id_mensaje).id_estado_mensaje,
        ESTADO_MENSAJE.PROCESADO,
      );
    });

    it("acepta el texto tal cual, incluso uno roto, que termina en la cola de errores", async () => {
      const e = entorno();
      const { id_mensaje: id } = await crm.simularLlegada({ mensaje: "{roto" });
      for (
        let i = 0;
        i < 100 &&
        e.mensajes.get(id).id_estado_mensaje === ESTADO_MENSAJE.RECIBIDO;
        i += 1
      )
        await new Promise((r) => setTimeout(r, 5));

      assert.equal(e.mensajes.get(id).id_estado_mensaje, ESTADO_MENSAJE.EN_DLQ);
    });

    it("enviar el mismo mensaje dos veces informa el duplicado", async () => {
      entorno();
      const m = mensaje();
      const primero = await crm.simularLlegada({ mensaje: m });
      const segundo = await crm.simularLlegada({ mensaje: texto(m) });

      assert.equal(primero.duplicado, false);
      assert.equal(segundo.duplicado, true);
      assert.equal(segundo.id_mensaje, primero.id_mensaje);
    });

    for (const [nombre, cuerpo] of [
      ["sin cuerpo", undefined],
      ["sin mensaje", {}],
      ["con el mensaje nulo", { mensaje: null }],
      ["con texto en blanco", { mensaje: "   " }],
    ]) {
      it(`rechaza una simulación ${nombre}`, async () => {
        const e = entorno();
        await assert.rejects(
          crm.simularLlegada(cuerpo),
          (err) => err.estado === 400 && err.detalles[0].campo === "mensaje",
        );
        assert.equal(e.mensajes.size, 0);
      });
    }

    it("con SIMULAR_CRM_ACTIVO=false responde 403 y no registra nada", async () => {
      const e = entorno();
      process.env.SIMULAR_CRM_ACTIVO = "false";

      await assert.rejects(
        crm.simularLlegada({ mensaje: mensaje() }),
        (err) => err.estado === 403,
      );
      assert.equal(e.mensajes.size, 0);
    });
  });
});

describe("consultas SQL de los mensajes entrantes", () => {
  const ID = uuid("a", 1);

  it("registra el mensaje como RECIBIDO del CRM y descarta el que ya existe por su id externo", async () => {
    const { db, consultas } = baseFalsa([{ id_mensaje: ID }]);
    await mensajesModelo.registrar(
      { idExterno: "abc", tipoEvento: "T", carga: "{}" },
      db,
    );

    assert.match(
      consultas[0].sql,
      /INSERT INTO mensajes_entrantes \(id_modulo_origen, id_estado_mensaje, id_mensaje_externo, tipo_evento, carga\)/,
    );
    assert.match(consultas[0].sql, /VALUES \(1, 1, \$1, \$2, \$3\)/);
    assert.match(
      consultas[0].sql,
      /ON CONFLICT ON CONSTRAINT uq_mensaje_origen_externo DO NOTHING/,
    );
    assert.deepEqual(consultas[0].parametros, ["abc", "T", "{}"]);
  });

  it("si el insert no devolvió fila, busca el mensaje original y lo marca duplicado", async () => {
    const respuestas = [
      [],
      [{ id_mensaje: ID }],
      [{ id_mensaje: ID, estado: "PROCESADO" }],
    ];
    const consultas = [];
    const db = {
      query: async (sql, p) => (
        consultas.push({ sql: sql.replace(/\s+/g, " "), p }),
        { rows: respuestas.shift() ?? [] }
      ),
    };
    const { duplicado, fila } = await mensajesModelo.registrar(
      { idExterno: "abc", tipoEvento: null, carga: "x" },
      db,
    );

    assert.equal(duplicado, true);
    assert.equal(fila.estado, "PROCESADO");
    assert.match(
      consultas[1].sql,
      /WHERE id_modulo_origen = 1 AND id_mensaje_externo = \$1/,
    );
  });

  it("un mensaje trae también cuántas métricas dejó, sea que se consulte solo o en la lista", async () => {
    const solo = baseFalsa([
      { id_mensaje: ID, estado: "PROCESADO", metricas: 3 },
    ]);
    const lista = baseFalsa([]);
    const unico = await mensajesModelo.obtener(ID, solo.db);
    await mensajesModelo.listar({}, lista.db);

    assert.equal(unico.metricas, 3);
    const conteo =
      "(SELECT count(*)::int FROM metricas_crm mc WHERE mc.id_mensaje = m.id_mensaje) AS metricas";
    assert.ok(
      solo.consultas[0].sql.includes(conteo),
      "obtener cuenta las métricas del mensaje",
    );
    assert.ok(lista.consultas[0].sql.includes(conteo), "listar también");
  });

  it("bloquea la fila mientras se procesa para que dos procesos no apliquen el mismo mensaje", async () => {
    const { db, consultas } = baseFalsa();
    await mensajesModelo.bloquear(ID, db);
    assert.match(consultas[0].sql, /WHERE id_mensaje = \$1 FOR UPDATE/);
  });

  it("solo procesa lo que seguía RECIBIDO, cuenta la entrega y limpia el error", async () => {
    const { db, consultas } = baseFalsa();
    await mensajesModelo.marcarProcesado(ID, db);

    assert.match(
      consultas[0].sql,
      /SET id_estado_mensaje = 2, procesado_en = CURRENT_TIMESTAMP,\s*intentos = intentos \+ 1, ultimo_error = NULL/,
    );
    assert.match(consultas[0].sql, /AND id_estado_mensaje = 1/);
  });

  it("cuenta el fallo y recorta el error a 255; devuelve los intentos o null si ya no estaba RECIBIDO", async () => {
    const con = baseFalsa([{ intentos: 3 }]);
    assert.equal(await mensajesModelo.registrarFallo(ID, "x", con.db), 3);
    assert.match(
      con.consultas[0].sql,
      /SET intentos = intentos \+ 1, ultimo_error = left\(\$2, 255\)/,
    );
    assert.match(con.consultas[0].sql, /AND id_estado_mensaje = 1/);
    assert.equal(
      await mensajesModelo.registrarFallo(ID, "x", baseFalsa([]).db),
      null,
    );
  });

  it("envía a la cola de errores solo lo que seguía RECIBIDO", async () => {
    const { db, consultas } = baseFalsa();
    await mensajesModelo.enviarADlq(ID, db);
    assert.match(
      consultas[0].sql,
      /SET id_estado_mensaje = 3\s+WHERE id_mensaje = \$1 AND id_estado_mensaje = 1/,
    );
  });

  it("solo reabre lo que está en la cola de errores y vuelve el contador a cero", async () => {
    const { db, consultas } = baseFalsa();
    await mensajesModelo.reabrir(ID, db);
    assert.match(
      consultas[0].sql,
      /SET id_estado_mensaje = 1, intentos = 0, ultimo_error = NULL/,
    );
    assert.match(
      consultas[0].sql,
      /WHERE id_mensaje = \$1 AND id_estado_mensaje = 3/,
    );
  });

  it("lista del más reciente al más antiguo, con filtro opcional por estado y tope", async () => {
    const { db, consultas } = baseFalsa();
    await mensajesModelo.listar({ idEstado: 3, limite: 50 }, db);

    assert.match(
      consultas[0].sql,
      /\(\$1::smallint IS NULL OR m\.id_estado_mensaje = \$1\)/,
    );
    assert.match(consultas[0].sql, /ORDER BY m\.recibido_en DESC/);
    assert.match(consultas[0].sql, /LIMIT \$2/);
    assert.deepEqual(consultas[0].parametros, [3, 50]);
  });

  it("busca los RECIBIDO que llevan más de N segundos sin resolverse", async () => {
    const { db, consultas } = baseFalsa();
    await mensajesModelo.listarRecibidosAntiguos(30, db);

    assert.match(consultas[0].sql, /m\.id_estado_mensaje = 1/);
    assert.match(
      consultas[0].sql,
      /m\.recibido_en < CURRENT_TIMESTAMP - make_interval\(secs => \$1\)/,
    );
    assert.deepEqual(consultas[0].parametros, [30]);
  });

  it("acepta métricas solo de quienes fueron evaluados en el ciclo", async () => {
    const { db, consultas } = baseFalsa([{ id_empleado_evaluado: E(31) }]);
    assert.deepEqual(await mensajesModelo.listarEvaluadosDelCiclo(CICLO, db), [
      E(31),
    ]);
    assert.match(
      consultas[0].sql,
      /SELECT DISTINCT id_empleado_evaluado FROM evaluaciones WHERE id_ciclo = \$1/,
    );
  });

  it("guarda una fila por ciclo y colaborador: si ya existe, la actualiza con el mensaje nuevo", async () => {
    const { db, consultas } = baseFalsa();
    await mensajesModelo.guardarMetricas(
      CICLO,
      ID,
      [
        {
          idEmpleado: E(31),
          cantidadQuejas: 1,
          cantidadFelicitaciones: 2,
          minutosResolucion: null,
        },
        {
          idEmpleado: E(32),
          cantidadQuejas: 0,
          cantidadFelicitaciones: 0,
          minutosResolucion: 5,
        },
      ],
      db,
    );
    const { sql, parametros } = consultas[0];

    assert.match(sql, /INSERT INTO metricas_crm/);
    assert.match(
      sql,
      /unnest\(\$3::uuid\[\], \$4::int\[\], \$5::int\[\], \$6::numeric\[\]\)/,
    );
    assert.match(
      sql,
      /ON CONFLICT ON CONSTRAINT uq_metrica_ciclo_empleado DO UPDATE/,
    );
    assert.match(sql, /id_mensaje = EXCLUDED\.id_mensaje/);
    assert.deepEqual(parametros, [
      CICLO,
      ID,
      [E(31), E(32)],
      [1, 0],
      [2, 0],
      [null, 5],
    ]);
  });
});
