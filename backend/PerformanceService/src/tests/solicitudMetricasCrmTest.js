const { describe, it, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");

const pubsub = require("../config/pubsub");
const eventosModelo = require("../models/eventosSalientesModel");
const mensajesEntrantes = require("../models/mensajesEntrantesModel");
const desempenoModelo = require("../models/desempenoModel");
const jerarquia = require("../services/jerarquiaExterna");
const despacho = require("../services/despachoEventosService");
const servicio = require("../services/desempenoService");
const mensajesPublicados = require("../utils/mensajesPublicados");
const { ErrorApp } = require("../utils/errores");
const { iniciarDespachoEventos } = require("../jobs/despachoEventosJob");
const {
  ESTADO_EVENTO,
  armarSolicitudMetricasCrm,
  atributosDe,
  seleccionarColaboradoresCrm,
  esperaReintento,
  errorDePublicacion,
  MAXIMO_INTENTOS,
} = require("../utils/mensajeria");
const ayudas = require("./ayudas/consolidadoDesempeno");

const { uuid, baseFalsa } = ayudas;

const ID_EVENTO = uuid("5", 1);
const CICLO_ID = ayudas.CICLO_CERRADO;
const E = (n) => uuid("4", n);
const CARGO = {
  CAJERO: uuid("7", 1),
  ASESOR: uuid("7", 2),
  SUPERVISOR: uuid("7", 3),
  ANALISTA: uuid("7", 4),
};

// Lo que responde EmployeeService (GET /empleados y GET /jerarquia/cargos).
const persona = (n, nombre, cargo, sucursal = "Sopocachi") => ({
  id_empleado: E(n),
  nombre_completo: nombre,
  id_cargo: cargo,
  id_sucursal: uuid("e", sucursal === "Sopocachi" ? 1 : 2),
  sucursal,
});
const PERSONAL = [
  persona(31, "Carlos Rojas Vargas", CARGO.CAJERO),
  persona(32, "Lucía Flores Choque", CARGO.CAJERO),
  persona(33, "Diego Quispe Mamani", CARGO.CAJERO, "Miraflores"),
  persona(34, "Paola Gutiérrez Limachi", CARGO.ASESOR, "Miraflores"),
  persona(24, "Rosa Mendoza Ticona", CARGO.SUPERVISOR),
  persona(26, "Sofía Condori Mamani", CARGO.ANALISTA),
  persona(40, "Persona fuera del ciclo", CARGO.CAJERO),
];
const CARGOS = [
  { id_cargo: CARGO.CAJERO, codigo: "ATC-CAJ", nombre: "Cajero" },
  { id_cargo: CARGO.ASESOR, codigo: "ATC-ASE", nombre: "Asesor de Atención" },
  {
    id_cargo: CARGO.SUPERVISOR,
    codigo: "ATC-SUP",
    nombre: "Supervisor de Cajas",
  },
  {
    id_cargo: CARGO.ANALISTA,
    codigo: "RRHH-ANA",
    nombre: "Analista de Recursos Humanos",
  },
];

const CICLO = {
  id_ciclo: CICLO_ID,
  nombre: "Evaluación de desempeño 2026-S1",
  fecha_inicio: "2026-06-01",
  fecha_limite: "2026-07-03",
  cerrado_en: "2026-07-05T12:00:00.000Z",
  id_periodo: uuid("6", 1),
  periodo: "2026-S1",
  periodo_fecha_inicio: "2026-01-01",
  periodo_fecha_fin: "2026-06-30",
};

const evento = (cambios = {}) => ({
  id_evento: ID_EVENTO,
  id_ciclo: CICLO_ID,
  tipo_evento: "SOLICITUD_METRICAS_CRM",
  carga: { id_ciclo: CICLO_ID, empleados: [31, 32, 33, 34, 24, 26].map(E) },
  intentos: 0,
  ...cambios,
});

const ENTORNO = [
  "PUBSUB_TOPICO",
  "PUBSUB_TIMEOUT_MS",
  "CRM_CARGOS_METRICAS",
  "SIMULAR_CRM_ACTIVO",
  "SIMULAR_CRM_DEMORA_MS",
  "DESPACHO_EVENTOS_ACTIVO",
];
const entornoOriginal = Object.fromEntries(
  ENTORNO.map((nombre) => [nombre, process.env[nombre]]),
);

beforeEach(() => {
  mock.method(console, "log", () => {});
  mock.method(console, "warn", () => {});
  mock.method(console, "error", () => {});
  process.env.SIMULAR_CRM_ACTIVO = "false";
});

afterEach(() => {
  mock.restoreAll();
  for (const [nombre, valor] of Object.entries(entornoOriginal)) {
    if (valor === undefined) delete process.env[nombre];
    else process.env[nombre] = valor;
  }
});

// Pub/Sub falso en memoria: nada sale a la red.
function clienteFalso({ falla, colgado = false } = {}) {
  const publicados = [];
  return {
    publicados,
    topic: (topico) => ({
      publishMessage: async (mensaje) => {
        if (colgado) return new Promise(() => {});
        if (falla) throw falla;
        publicados.push({ topico, ...mensaje });
        return `pubsub-${publicados.length}`;
      },
    }),
  };
}

// Sustituye modelos y servicios externos. Devuelve los espías para comprobar qué se hizo.
function simular({
  eventos = [evento()],
  ciclo = CICLO,
  cliente = clienteFalso(),
  personal = PERSONAL,
  cargos = CARGOS,
} = {}) {
  const espias = {
    cliente,
    reservar: mock.method(
      eventosModelo,
      "reservarPendientes",
      async () => eventos,
    ),
    ciclo: mock.method(
      eventosModelo,
      "obtenerCicloConPeriodo",
      async () => ciclo,
    ),
    entregado: mock.method(eventosModelo, "marcarEntregado", async () => true),
    omitido: mock.method(eventosModelo, "marcarOmitido", async () => {}),
    error: mock.method(eventosModelo, "marcarError", async () => {}),
    personal: mock.method(
      jerarquia,
      "listarColaboradores",
      async () => personal,
    ),
    cargos: mock.method(jerarquia, "listarCargos", async () => cargos),
  };
  mock.method(pubsub, "obtenerCliente", () => cliente);
  return espias;
}

const argumentosDeError = (espias, n = 0) =>
  espias.error.mock.calls[n].arguments;

describe("Solicitud de métricas al CRM al cerrar el ciclo", () => {
  describe("el mensaje que recibe el CRM", () => {
    const colaboradores = seleccionarColaboradoresCrm(
      evento().carga.empleados,
      PERSONAL,
      CARGOS,
    );
    const mensaje = armarSolicitudMetricasCrm({
      idMensaje: ID_EVENTO,
      fecha: "2026-07-05T12:01:00.000Z",
      ciclo: CICLO,
      colaboradores,
    });

    it("va de RRHH (grupo F) al CRM (grupo B) con el tipo de solicitud de métricas", () => {
      assert.deepEqual(mensaje.encabezado, {
        id_mensaje: ID_EVENTO,
        origen: { grupo: "F", modulo: "RRHH" },
        destino: { grupo: "B", modulo: "CRM" },
        tipo: "SOLICITUD_METRICAS_CRM",
        fecha: "2026-07-05T12:01:00.000Z",
        version_esquema: 1,
      });
    });

    it("lleva el periodo y el ciclo que se cerró", () => {
      assert.equal(mensaje.datos.id_ciclo, CICLO_ID);
      assert.deepEqual(mensaje.datos.periodo, {
        id_periodo: uuid("6", 1),
        nombre: "2026-S1",
        fecha_inicio: "2026-01-01",
        fecha_fin: "2026-06-30",
      });
      assert.deepEqual(mensaje.datos.ciclo, {
        nombre: "Evaluación de desempeño 2026-S1",
        fecha_inicio: "2026-06-01",
        fecha_limite: "2026-07-03",
        cerrado_en: "2026-07-05T12:00:00.000Z",
      });
    });

    it("lleva a cada colaborador con su cargo y su sucursal", () => {
      assert.deepEqual(mensaje.datos.colaboradores[0], {
        id_empleado: E(31),
        nombre_completo: "Carlos Rojas Vargas",
        cargo: { codigo: "ATC-CAJ", nombre: "Cajero" },
        id_sucursal: uuid("e", 1),
        sucursal: "Sopocachi",
      });
    });

    it("repite el encabezado como atributos de Pub/Sub para que cada grupo filtre por destino sin leer el cuerpo", () => {
      assert.deepEqual(atributosDe(mensaje), {
        id_mensaje: ID_EVENTO,
        origen: "F",
        origen_modulo: "RRHH",
        destino: "B",
        destino_modulo: "CRM",
        tipo: "SOLICITUD_METRICAS_CRM",
        version_esquema: "1",
      });
    });

    it("se puede serializar a JSON sin perder nada", () => {
      assert.deepEqual(JSON.parse(JSON.stringify(mensaje)), mensaje);
    });
  });

  describe("a quién se le piden métricas: atención al cliente y cajeros", () => {
    const evaluados = evento().carga.empleados;

    it("solo a los cajeros y asesores de atención que se evaluaron en el ciclo", () => {
      const lista = seleccionarColaboradoresCrm(evaluados, PERSONAL, CARGOS);

      assert.deepEqual(
        lista.map((c) => [c.nombre_completo, c.cargo.codigo]),
        [
          ["Carlos Rojas Vargas", "ATC-CAJ"],
          ["Diego Quispe Mamani", "ATC-CAJ"],
          ["Lucía Flores Choque", "ATC-CAJ"],
          ["Paola Gutiérrez Limachi", "ATC-ASE"],
        ],
      );
    });

    it("deja fuera a supervisores y a otras áreas, que el CRM no mide", () => {
      const ids = seleccionarColaboradoresCrm(evaluados, PERSONAL, CARGOS).map(
        (c) => c.id_empleado,
      );

      assert.ok(!ids.includes(E(24)), "supervisor de cajas");
      assert.ok(!ids.includes(E(26)), "analista de RRHH");
    });

    it("no incluye a quien no se evaluó en el ciclo, aunque tenga un cargo de atención", () => {
      const ids = seleccionarColaboradoresCrm(evaluados, PERSONAL, CARGOS).map(
        (c) => c.id_empleado,
      );
      assert.ok(!ids.includes(E(40)));
    });

    it("ordena por nombre para que el mensaje sea siempre el mismo", () => {
      const invertido = seleccionarColaboradoresCrm(
        evaluados,
        [...PERSONAL].reverse(),
        CARGOS,
      );
      assert.deepEqual(
        invertido,
        seleccionarColaboradoresCrm(evaluados, PERSONAL, CARGOS),
      );
    });

    it("ignora a quien tiene un cargo que ya no aparece en la jerarquía", () => {
      const sinCajero = CARGOS.filter((c) => c.codigo !== "ATC-CAJ");
      assert.deepEqual(
        seleccionarColaboradoresCrm(evaluados, PERSONAL, sinCajero).map(
          (c) => c.cargo.codigo,
        ),
        ["ATC-ASE"],
      );
    });

    it("los cargos que mide el CRM se pueden cambiar con CRM_CARGOS_METRICAS, sin importar mayúsculas", () => {
      process.env.CRM_CARGOS_METRICAS = " atc-sup , rrhh-ana ";
      const lista = seleccionarColaboradoresCrm(evaluados, PERSONAL, CARGOS);

      assert.deepEqual(lista.map((c) => c.cargo.codigo).sort(), [
        "ATC-SUP",
        "RRHH-ANA",
      ]);
    });

    it("una variable vacía vuelve a los cargos por defecto", () => {
      process.env.CRM_CARGOS_METRICAS = " , ";
      assert.equal(
        seleccionarColaboradoresCrm(evaluados, PERSONAL, CARGOS).length,
        4,
      );
    });
  });

  describe("publicación en el tópico único de RRHH", () => {
    it("publica una vez la solicitud y deja el evento entregado", async () => {
      const espias = simular();

      assert.equal(await despacho.despachar(), 1);
      assert.equal(espias.cliente.publicados.length, 1);
      assert.equal(espias.entregado.mock.callCount(), 1);
      assert.deepEqual(espias.entregado.mock.calls[0].arguments, [ID_EVENTO]);
      assert.equal(espias.error.mock.callCount(), 0);
      assert.equal(espias.omitido.mock.callCount(), 0);
    });

    it("usa el tópico ucb-sis323-sub-f y el encabezado F → B con solo cajeros y asesores", async () => {
      const espias = simular();
      await despacho.despachar();
      const [publicado] = espias.cliente.publicados;

      assert.equal(publicado.topico, "ucb-sis323-sub-f");
      assert.equal(
        publicado.json.encabezado.id_mensaje,
        ID_EVENTO,
        "el id del evento es el id del mensaje",
      );
      assert.deepEqual(
        [
          publicado.json.encabezado.origen.grupo,
          publicado.json.encabezado.destino.grupo,
        ],
        ["F", "B"],
      );
      assert.equal(publicado.attributes.destino, "B");
      assert.equal(publicado.json.datos.colaboradores.length, 4);
      assert.equal(publicado.json.datos.periodo.nombre, "2026-S1");
    });

    it("el tópico se puede cambiar con PUBSUB_TOPICO", async () => {
      process.env.PUBSUB_TOPICO = "otro-topico";
      const espias = simular();
      await despacho.despachar();

      assert.equal(espias.cliente.publicados[0].topico, "otro-topico");
    });

    it("deja el mensaje en la consola del navegador con el id que devolvió Pub/Sub", async () => {
      simular();
      const antes = mensajesPublicados.listarDesde(0).ultimo;
      await despacho.despachar();
      const { mensajes } = mensajesPublicados.listarDesde(antes);

      assert.equal(mensajes.length, 1);
      assert.equal(mensajes[0].servicio, "PerformanceService");
      assert.equal(mensajes[0].direccion, "publicado");
      assert.equal(mensajes[0].topico, "ucb-sis323-sub-f");
      assert.equal(mensajes[0].id_pubsub, "pubsub-1");
      assert.equal(mensajes[0].atributos.tipo, "SOLICITUD_METRICAS_CRM");
      assert.equal(mensajes[0].mensaje.encabezado.id_mensaje, ID_EVENTO);
    });

    it("no publica un evento que ya no está pendiente: solo toma lo que la base le reserva", async () => {
      const espias = simular({ eventos: [] });

      assert.equal(await despacho.despachar(), 0);
      assert.equal(espias.cliente.publicados.length, 0);
    });

    it("pide a EmployeeService la lista de personal una sola vez por vuelta, aunque haya varios eventos", async () => {
      const otro = evento({ id_evento: uuid("5", 2), id_ciclo: uuid("1", 2) });
      const espias = simular({ eventos: [evento(), otro] });
      await despacho.despachar();

      assert.equal(espias.cliente.publicados.length, 2);
      assert.equal(espias.personal.mock.callCount(), 1);
      assert.equal(espias.cargos.mock.callCount(), 1);
    });

    it("sin Pub/Sub configurado no toca los eventos: esperan pendientes en la base", async () => {
      const espias = simular({ cliente: null });

      assert.equal(await despacho.despachar(), 0);
      assert.equal(espias.reservar.mock.callCount(), 0);
      assert.equal(espias.error.mock.callCount(), 0);
    });
  });

  describe("cuando no hay a quién pedirle métricas", () => {
    it("no publica nada y deja el evento omitido con el motivo", async () => {
      const espias = simular({
        eventos: [evento({ carga: { empleados: [E(24), E(26)] } })],
      });
      await despacho.despachar();

      assert.equal(espias.cliente.publicados.length, 0);
      assert.equal(espias.entregado.mock.callCount(), 0);
      assert.equal(espias.omitido.mock.callCount(), 1);
      const [idEvento, motivo] = espias.omitido.mock.calls[0].arguments;
      assert.equal(idEvento, ID_EVENTO);
      assert.match(motivo, /ATC-CAJ, ATC-ASE/);
    });

    it("un evento sin lista de evaluados también se omite", async () => {
      const espias = simular({ eventos: [evento({ carga: {} })] });
      await despacho.despachar();

      assert.equal(espias.omitido.mock.callCount(), 1);
      assert.equal(espias.cliente.publicados.length, 0);
    });
  });

  describe("reintentos cuando algo falla", () => {
    it("si EmployeeService no responde, el evento sigue pendiente con espera de 30 s", async () => {
      const espias = simular();
      mock.method(jerarquia, "listarColaboradores", async () => {
        throw new ErrorApp(
          503,
          "No se pudo consultar al personal y la jerarquía.",
        );
      });
      await despacho.despachar();

      const [idEvento, datos] = argumentosDeError(espias);
      assert.equal(idEvento, ID_EVENTO);
      assert.deepEqual(datos, {
        error: "No se pudo consultar al personal y la jerarquía.",
        esperaMs: 30000,
        fallido: false,
      });
      assert.equal(espias.cliente.publicados.length, 0);
    });

    it("un error de red al publicar es pasajero: se reintenta con espera creciente", async () => {
      const espias = simular({
        cliente: clienteFalso({ falla: new Error("ECONNRESET") }),
      });
      await despacho.despachar();

      assert.deepEqual(argumentosDeError(espias)[1], {
        error: "No se pudo conectar con Pub/Sub",
        esperaMs: 30000,
        fallido: false,
      });
      assert.equal(espias.entregado.mock.callCount(), 0);
    });

    it("la espera se duplica en cada intento", async () => {
      const espias = simular({
        eventos: [
          evento({ intentos: 1 }),
          evento({ id_evento: uuid("5", 2), intentos: 2 }),
        ],
        cliente: clienteFalso({ falla: new Error("ECONNRESET") }),
      });
      await despacho.despachar();

      assert.equal(
        argumentosDeError(espias, 0)[1].esperaMs,
        60000,
        "segundo intento",
      );
      assert.equal(
        argumentosDeError(espias, 1)[1].esperaMs,
        120000,
        "tercer intento",
      );
    });

    it("al octavo intento fallido el evento queda FALLIDO hasta un reintento manual", async () => {
      const espias = simular({
        eventos: [evento({ intentos: MAXIMO_INTENTOS - 1 })],
        cliente: clienteFalso({ falla: new Error("ECONNRESET") }),
      });
      await despacho.despachar();

      assert.equal(argumentosDeError(espias)[1].fallido, true);
    });

    it("el séptimo intento todavía no agota los reintentos", async () => {
      const espias = simular({
        eventos: [evento({ intentos: MAXIMO_INTENTOS - 2 })],
        cliente: clienteFalso({ falla: new Error("ECONNRESET") }),
      });
      await despacho.despachar();

      assert.equal(argumentosDeError(espias)[1].fallido, false);
    });

    it("un tópico inexistente es un error permanente: falla de inmediato", async () => {
      const espias = simular({
        cliente: clienteFalso({
          falla: Object.assign(new Error("NOT_FOUND"), { code: 5 }),
        }),
      });
      await despacho.despachar();

      const [, datos] = argumentosDeError(espias);
      assert.equal(datos.fallido, true);
      assert.match(
        datos.error,
        /El tópico ucb-sis323-sub-f no existe en Pub\/Sub/,
      );
    });

    it("que Pub/Sub rechace las credenciales no es permanente: se arregla y se reintenta", async () => {
      const espias = simular({
        cliente: clienteFalso({
          falla: Object.assign(new Error("PERMISSION_DENIED"), { code: 7 }),
        }),
      });
      await despacho.despachar();

      assert.deepEqual(argumentosDeError(espias)[1], {
        error: "Pub/Sub rechazó las credenciales",
        esperaMs: 30000,
        fallido: false,
      });
    });

    it("si Pub/Sub no responde a tiempo corta la espera y reintenta", async () => {
      process.env.PUBSUB_TIMEOUT_MS = "20";
      const espias = simular({ cliente: clienteFalso({ colgado: true }) });
      await despacho.despachar();

      assert.deepEqual(argumentosDeError(espias)[1], {
        error: "Pub/Sub no respondió a tiempo",
        esperaMs: 30000,
        fallido: false,
      });
    });

    it("si el ciclo del evento ya no existe, falla de inmediato", async () => {
      const espias = simular({ ciclo: null });
      await despacho.despachar();

      const [, datos] = argumentosDeError(espias);
      assert.equal(datos.fallido, true);
      assert.equal(datos.error, "El ciclo del evento ya no existe");
    });

    it("un evento que falla no impide publicar el siguiente", async () => {
      const espias = simular({
        eventos: [
          evento({ carga: { empleados: [E(31)] } }),
          evento({ id_evento: uuid("5", 2) }),
        ],
      });
      let llamadas = 0;
      mock.method(eventosModelo, "obtenerCicloConPeriodo", async () => {
        llamadas += 1;
        if (llamadas === 1) throw new Error("la base no responde");
        return CICLO;
      });
      await despacho.despachar();

      assert.equal(espias.error.mock.callCount(), 1);
      assert.equal(argumentosDeError(espias)[1].error, "la base no responde");
      assert.equal(espias.cliente.publicados.length, 1);
      assert.equal(
        espias.cliente.publicados[0].json.encabezado.id_mensaje,
        uuid("5", 2),
      );
    });

    it("la espera entre reintentos crece de 30 s a un máximo de 1 hora", () => {
      assert.deepEqual(
        [1, 2, 3, 4, 5, 6, 7, 8].map((n) => esperaReintento(n) / 1000),
        [30, 60, 120, 240, 480, 960, 1920, 3600],
      );
      assert.equal(esperaReintento(20), 3600 * 1000);
      assert.equal(
        esperaReintento(0),
        30 * 1000,
        "un contador raro no da una espera negativa",
      );
    });

    it("distingue los errores de Pub/Sub que no se arreglan reintentando", () => {
      assert.equal(
        errorDePublicacion({ code: 5 }, "t").permanente,
        true,
        "tópico inexistente",
      );
      assert.equal(
        errorDePublicacion({ code: 3 }, "t").permanente,
        true,
        "mensaje inválido",
      );
      for (const code of [7, 16, "ENOENT", 14, undefined]) {
        assert.equal(
          errorDePublicacion({ code }, "t").permanente,
          false,
          `código ${code}`,
        );
      }
      assert.equal(errorDePublicacion(undefined, "t").permanente, false);
      assert.match(
        errorDePublicacion({ code: "ENOENT" }, "t").mensaje,
        /llave de la cuenta de servicio/,
      );
    });
  });

  describe("la respuesta del CRM se simula cuando la publicación se confirma", () => {
    const hasta = async (condicion, ms = 1000) => {
      const limite = Date.now() + ms;
      while (!condicion()) {
        assert.ok(
          Date.now() < limite,
          "tiempo agotado esperando la respuesta simulada",
        );
        await new Promise((resolver) => setTimeout(resolver, 5));
      }
    };

    beforeEach(() => {
      process.env.SIMULAR_CRM_ACTIVO = "true";
      process.env.SIMULAR_CRM_DEMORA_MS = "0";
    });

    it("entrega al consumidor la respuesta B → F con métricas de los mismos colaboradores", async () => {
      const espias = simular();
      const registrar = mock.method(
        mensajesEntrantes,
        "registrar",
        async () => ({
          fila: { id_mensaje: "m-1", estado: "PROCESADO" },
          duplicado: true,
        }),
      );
      await despacho.despachar();
      await hasta(() => registrar.mock.callCount() === 1);

      const { idExterno, tipoEvento, carga } =
        registrar.mock.calls[0].arguments[0];
      const respuesta = JSON.parse(carga);
      const solicitados =
        espias.cliente.publicados[0].json.datos.colaboradores.map(
          (c) => c.id_empleado,
        );

      assert.equal(tipoEvento, "METRICAS_DESEMPENO_CRM");
      assert.equal(idExterno, respuesta.encabezado.id_mensaje);
      assert.deepEqual(
        [respuesta.encabezado.origen.grupo, respuesta.encabezado.destino.grupo],
        ["B", "F"],
      );
      assert.equal(respuesta.datos.id_ciclo, CICLO_ID);
      assert.equal(respuesta.datos.id_mensaje_solicitud, ID_EVENTO);
      assert.deepEqual(
        respuesta.datos.metricas.map((m) => m.id_empleado),
        solicitados,
      );
    });

    it("la respuesta también aparece en la consola del navegador, marcada como recibida", async () => {
      simular();
      mock.method(mensajesEntrantes, "registrar", async () => ({
        fila: { id_mensaje: "m-1", estado: "PROCESADO" },
        duplicado: true,
      }));
      const antes = mensajesPublicados.listarDesde(0).ultimo;
      await despacho.despachar();
      await hasta(
        () => mensajesPublicados.listarDesde(antes).mensajes.length === 2,
      );

      const [publicado, recibido] =
        mensajesPublicados.listarDesde(antes).mensajes;
      assert.equal(publicado.direccion, "publicado");
      assert.equal(recibido.direccion, "recibido");
      assert.equal(recibido.atributos.origen, "B");
      assert.equal(recibido.atributos.destino, "F");
      assert.equal(recibido.atributos.tipo, "METRICAS_DESEMPENO_CRM");
    });

    it("si la simulación falla, la publicación sigue entregada: no se deshace lo que Pub/Sub confirmó", async () => {
      const espias = simular();
      const registrar = mock.method(
        mensajesEntrantes,
        "registrar",
        async () => {
          throw new Error("la base no responde");
        },
      );
      await despacho.despachar();
      await hasta(() => registrar.mock.callCount() === 1);
      await new Promise((resolver) => setTimeout(resolver, 20));

      assert.equal(espias.entregado.mock.callCount(), 1);
      assert.equal(espias.error.mock.callCount(), 0);
    });

    it("con SIMULAR_CRM_ACTIVO=false se publica la solicitud y no se genera ninguna respuesta", async () => {
      process.env.SIMULAR_CRM_ACTIVO = "false";
      const espias = simular();
      const registrar = mock.method(
        mensajesEntrantes,
        "registrar",
        async () => ({ fila: {}, duplicado: true }),
      );
      await despacho.despachar();
      await new Promise((resolver) => setTimeout(resolver, 30));

      assert.equal(espias.cliente.publicados.length, 1);
      assert.equal(registrar.mock.callCount(), 0);
    });

    it("una publicación fallida no genera respuesta: no hay nada a qué responder", async () => {
      simular({ cliente: clienteFalso({ falla: new Error("ECONNRESET") }) });
      const registrar = mock.method(
        mensajesEntrantes,
        "registrar",
        async () => ({ fila: {}, duplicado: true }),
      );
      await despacho.despachar();
      await new Promise((resolver) => setTimeout(resolver, 30));

      assert.equal(registrar.mock.callCount(), 0);
    });
  });
});

describe("reintento manual de una solicitud fallida", () => {
  const cerrado = () =>
    mock.method(desempenoModelo, "obtenerCiclo", async () => ({
      id_ciclo: CICLO_ID,
      id_estado_ciclo: 3,
    }));
  const solicitud = (estado) => ({
    id_evento: ID_EVENTO,
    estado,
    intentos: 8,
    ultimo_error: "No se pudo conectar con Pub/Sub",
    entregado_en: null,
    creado_en: "2026-07-05T12:00:00.000Z",
  });

  it("devuelve la solicitud fallida a pendiente con el contador en cero", async () => {
    cerrado();
    let consultas = 0;
    mock.method(desempenoModelo, "obtenerSolicitudCrm", async () =>
      consultas++ === 0
        ? solicitud("FALLIDO")
        : { ...solicitud("PENDIENTE"), intentos: 0, ultimo_error: null },
    );
    const reencolar = mock.method(eventosModelo, "reencolar", async () => true);
    const resultado = await servicio.reintentarSolicitudCrm(CICLO_ID);

    assert.deepEqual(reencolar.mock.calls[0].arguments, [ID_EVENTO]);
    assert.equal(resultado.estado, "PENDIENTE");
    assert.equal(resultado.intentos, 0);
    assert.equal(resultado.ultimo_error, null);
    assert.equal(resultado.id_mensaje, ID_EVENTO);
  });

  for (const estado of ["ENTREGADO", "PENDIENTE", "OMITIDO"]) {
    it(`una solicitud ${estado} no se reintenta: 409`, async () => {
      cerrado();
      mock.method(desempenoModelo, "obtenerSolicitudCrm", async () =>
        solicitud(estado),
      );
      mock.method(eventosModelo, "reencolar", async () => false);

      await assert.rejects(
        servicio.reintentarSolicitudCrm(CICLO_ID),
        (e) =>
          e.estado === 409 &&
          e.detalles[0].mensaje === `La solicitud está ${estado}.`,
      );
    });
  }

  it("un ciclo sin solicitud responde 404", async () => {
    cerrado();
    mock.method(desempenoModelo, "obtenerSolicitudCrm", async () => null);
    await assert.rejects(
      servicio.reintentarSolicitudCrm(CICLO_ID),
      (e) => e.estado === 404,
    );
  });

  it("un ciclo que no está cerrado responde 409 y un id inválido 404", async () => {
    mock.method(desempenoModelo, "obtenerCiclo", async () => ({
      id_ciclo: CICLO_ID,
      id_estado_ciclo: 2,
    }));
    await assert.rejects(
      servicio.reintentarSolicitudCrm(CICLO_ID),
      (e) => e.estado === 409,
    );
    await assert.rejects(
      servicio.reintentarSolicitudCrm("x"),
      (e) => e.estado === 404,
    );
  });
});

describe("consultas SQL de los eventos salientes", () => {
  it("reserva solo los pendientes del CRM y salta los que otro proceso ya tomó", async () => {
    const { db, consultas } = baseFalsa();
    await eventosModelo.reservarPendientes(10, 60, db);
    const { sql, parametros } = consultas[0];

    assert.match(sql, /e\.id_estado_evento = 1/, "solo pendientes");
    assert.match(sql, /e\.id_modulo_destino = 1/, "solo el CRM");
    assert.match(sql, /e\.tipo_evento = 'SOLICITUD_METRICAS_CRM'/);
    assert.match(
      sql,
      /e\.proximo_intento_en <= CURRENT_TIMESTAMP/,
      "respeta la espera entre reintentos",
    );
    assert.match(
      sql,
      /FOR UPDATE SKIP LOCKED/,
      "dos vueltas simultáneas no toman el mismo evento",
    );
    assert.match(
      sql,
      /SET proximo_intento_en = CURRENT_TIMESTAMP \+ make_interval\(secs => \$2\)/,
      "lo reserva unos segundos",
    );
    assert.deepEqual(parametros, [10, 60]);
  });

  it("solo marca como entregado lo que seguía pendiente", async () => {
    const { db, consultas } = baseFalsa();
    await eventosModelo.marcarEntregado(ID_EVENTO, db);

    assert.match(
      consultas[0].sql,
      /id_estado_evento = 2, entregado_en = CURRENT_TIMESTAMP,\s*intentos = intentos \+ 1, ultimo_error = NULL/,
    );
    assert.match(
      consultas[0].sql,
      /WHERE id_evento = \$1 AND id_estado_evento = 1/,
    );
  });

  it("cuenta el intento, guarda el error truncado y solo pasa a FALLIDO si se pide", async () => {
    const { db, consultas } = baseFalsa();
    await eventosModelo.marcarError(
      ID_EVENTO,
      { error: "x", esperaMs: 30000, fallido: true },
      db,
    );

    assert.match(
      consultas[0].sql,
      /intentos = intentos \+ 1, ultimo_error = left\(\$2, 255\)/,
    );
    assert.match(
      consultas[0].sql,
      /CASE WHEN \$4 THEN 3::smallint ELSE id_estado_evento END/,
    );
    assert.match(
      consultas[0].sql,
      /id_estado_evento = 1$/,
      "un evento ya cerrado no se pisa",
    );
    assert.deepEqual(consultas[0].parametros, [ID_EVENTO, "x", 30, true]);
  });

  it("solo reencola lo que está FALLIDO", async () => {
    const { db, consultas } = baseFalsa();
    await eventosModelo.reencolar(ID_EVENTO, db);

    assert.match(
      consultas[0].sql,
      /SET id_estado_evento = 1, intentos = 0, ultimo_error = NULL/,
    );
    assert.match(
      consultas[0].sql,
      /WHERE id_evento = \$1 AND id_estado_evento = 3/,
    );
  });

  it("el omitido guarda el motivo y solo aplica a un evento pendiente", async () => {
    const { db, consultas } = baseFalsa();
    await eventosModelo.marcarOmitido(ID_EVENTO, "sin colaboradores", db);

    assert.match(
      consultas[0].sql,
      /SET id_estado_evento = 4, ultimo_error = left\(\$2, 255\)/,
    );
    assert.match(consultas[0].sql, /id_estado_evento = 1/);
  });

  it("los estados del código coinciden con el catálogo de la base", () => {
    assert.deepEqual(ESTADO_EVENTO, {
      PENDIENTE: 1,
      ENTREGADO: 2,
      FALLIDO: 3,
      OMITIDO: 4,
    });
  });
});

describe("despachador de eventos salientes", () => {
  it("se puede desactivar con DESPACHO_EVENTOS_ACTIVO=false", () => {
    process.env.DESPACHO_EVENTOS_ACTIVO = "false";
    assert.equal(iniciarDespachoEventos(), null);
  });

  it("al activarse corre una vuelta enseguida y se programa de nuevo sin mantener vivo el proceso", async () => {
    delete process.env.DESPACHO_EVENTOS_ACTIVO;
    const reservar = mock.method(
      eventosModelo,
      "reservarPendientes",
      async () => [],
    );
    mock.method(pubsub, "obtenerCliente", () => clienteFalso());
    mock.method(mensajesEntrantes, "listarRecibidosAntiguos", async () => []);
    const tarea = iniciarDespachoEventos();
    try {
      await new Promise((resolver) => setTimeout(resolver, 20));
      assert.ok(tarea, "devuelve el temporizador");
      assert.equal(tarea.hasRef(), false, "no impide que el proceso termine");
      assert.equal(reservar.mock.callCount(), 1);
    } finally {
      clearInterval(tarea);
    }
  });
});
