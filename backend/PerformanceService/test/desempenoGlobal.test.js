/**
 * Levanta las rutas de desempeño en este mismo proceso contra la PerformanceDB de DATABASE_URL, con Pub/Sub y
 * EmployeeService simulados en memoria (nunca publica en el tópico real), y comprueba con SQL real: los promedios
 * por área, sucursal y competencia de un ciclo cerrado, las brechas contra el umbral, la solicitud de métricas al CRM
 * (reserva sin duplicados, reintentos, omisión y reintento manual), la respuesta simulada del CRM, los duplicados, los
 * reintentos y la cola de errores (DLQ). Crea sus propios datos en 2031 («c2700000-…») y al terminar borra solo esos.
 * Las pruebas se ejecutan en orden y comparten ese ciclo. Requiere db/init.sql y db/catalogos.sql; sin base, se omite.
 * Con el sistema en Docker:
 *   docker compose exec performance-service npm run test:kan27:integracion
 */
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});
const express = require("express");

const ID_BASE = "c2700000-0000-4000-8000-";
const id = (n) => `${ID_BASE}${String(n).padStart(12, "0")}`;

const AREA = { ATENCION: id(11), RRHH: id(12) };
const SUCURSAL = { SOPOCACHI: id(21), MIRAFLORES: id(22) };
const CREADOR = id(1);
const EVALUADOR_1 = id(2);
const EVALUADOR_2 = id(3);
const A = id(31); // Atención al cliente, Sopocachi, cajero: dos evaluadores
const B = id(32); // Atención al cliente, Miraflores, asesor
const C = id(33); // Recursos Humanos, Sopocachi, analista
const D = id(34); // Atención al cliente, Miraflores, cajero: evaluación vencida
const COMPETENCIA = { ATENCION: id(41), EQUIPO: id(42) };
const CARGO = { CAJERO: id(301), ASESOR: id(302), ANALISTA: id(303) };
const PERIODO = id(91);
const CICLO = id(101); // cerrado
const CICLO_ABIERTO = id(102); // activo
const CICLO_SOLO_RRHH = id(103); // cerrado, solo evaluó a una analista
const LIKERT = "00000000-0000-4000-8000-000000000001";

const ENTORNO = [
  "SIMULAR_CRM_ACTIVO",
  "SIMULAR_CRM_DEMORA_MS",
  "CRM_MAXIMO_INTENTOS",
  "CRM_REINTENTO_BASE_MS",
  "PUBSUB_TIMEOUT_MS",
];
const entornoOriginal = Object.fromEntries(
  ENTORNO.map((nombre) => [nombre, process.env[nombre]]),
);

let pool;
let servidor;
let base;
let disponible = false;
let hayOmitido = false;
let motivo = "";
let modulos = {};
const mensajesCreados = new Set();

const requiere = (t) => {
  if (!disponible) t.skip(motivo);
  return disponible;
};
const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));
const hasta = async (condicion, ms = 4000) => {
  const limite = Date.now() + ms;
  while (!(await condicion())) {
    assert.ok(
      Date.now() < limite,
      "tiempo agotado esperando que se cumpla la condición",
    );
    await esperar(20);
  }
};
const callar = async (trabajo) => {
  const originales = [console.log, console.error, console.warn];
  console.log = console.error = console.warn = () => {};
  try {
    return await trabajo();
  } finally {
    [console.log, console.error, console.warn] = originales;
  }
};

async function api(ruta, { metodo = "GET", rol = "admin", cuerpo } = {}) {
  const respuesta = await fetch(`${base}${ruta}`, {
    method: metodo,
    headers: {
      ...(rol ? { "X-Rol": rol } : {}),
      ...(cuerpo !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const texto = await respuesta.text();
  let json = null;
  try {
    json = JSON.parse(texto);
  } catch {
    // Respuesta sin cuerpo JSON.
  }
  return { estado: respuesta.status, cuerpo: json };
}

// --- Pub/Sub y EmployeeService simulados ---
const publicados = [];
let modoPubSub = "ok";
const clienteFalso = {
  topic: (topico) => ({
    publishMessage: async (mensaje) => {
      if (modoPubSub === "red") throw new Error("ECONNRESET");
      if (modoPubSub === "permanente")
        throw Object.assign(new Error("NOT_FOUND"), { code: 5 });
      publicados.push({ topico, ...mensaje });
      return `pubsub-${publicados.length}`;
    },
  }),
};
const persona = (idEmpleado, nombre, cargo, sucursal) => ({
  id_empleado: idEmpleado,
  nombre_completo: nombre,
  id_cargo: cargo,
  id_sucursal: sucursal,
  sucursal: sucursal === SUCURSAL.SOPOCACHI ? "Sopocachi" : "Miraflores",
});
const PERSONAL = [
  persona(A, "Ana Cajera Prueba", CARGO.CAJERO, SUCURSAL.SOPOCACHI),
  persona(B, "Beto Asesor Prueba", CARGO.ASESOR, SUCURSAL.MIRAFLORES),
  persona(C, "Carla Analista Prueba", CARGO.ANALISTA, SUCURSAL.SOPOCACHI),
  persona(D, "Dario Cajero Prueba", CARGO.CAJERO, SUCURSAL.MIRAFLORES),
];
const CARGOS = [
  { id_cargo: CARGO.CAJERO, codigo: "ATC-CAJ", nombre: "Cajero" },
  { id_cargo: CARGO.ASESOR, codigo: "ATC-ASE", nombre: "Asesor de Atención" },
  {
    id_cargo: CARGO.ANALISTA,
    codigo: "RRHH-ANA",
    nombre: "Analista de Recursos Humanos",
  },
];

// Hace que una sentencia dentro de una TRANSACCIÓN falle (las `veces` primeras) para probar el rollback y los reintentos.
// Solo envuelve el cliente que entrega pool.connect() con un Proxy (el cliente real no se modifica) y respeta la forma con
// callback que pg-pool usa por dentro en pool.query(). Devuelve la función que lo deshace.
function inyectarFalla(patron, mensaje, veces = Infinity) {
  const conectar = pool.connect;
  let restantes = veces;
  pool.connect = function (callback) {
    if (typeof callback === "function") return conectar.call(this, callback);
    return conectar.call(this).then(
      (cliente) =>
        new Proxy(cliente, {
          get: (objetivo, propiedad) => {
            if (propiedad === "query") {
              return (sql, ...resto) => {
                if (
                  typeof sql === "string" &&
                  patron.test(sql) &&
                  restantes > 0
                ) {
                  restantes -= 1;
                  return Promise.reject(new Error(mensaje));
                }
                return objetivo.query(sql, ...resto);
              };
            }
            const valor = objetivo[propiedad];
            return typeof valor === "function" ? valor.bind(objetivo) : valor;
          },
        }),
    );
  };
  return () => {
    delete pool.connect;
  };
}

async function crearDatos() {
  const sql = (texto, parametros) => pool.query(texto, parametros);
  await sql(
    `INSERT INTO departamentos (id_departamento, nombre) VALUES ($1, '@KAN27 Atención al cliente'), ($2, '@KAN27 Recursos Humanos')`,
    [AREA.ATENCION, AREA.RRHH],
  );
  await sql(
    `INSERT INTO sucursales (id_sucursal, nombre) VALUES ($1, '@KAN27 Sopocachi'), ($2, '@KAN27 Miraflores')`,
    [SUCURSAL.SOPOCACHI, SUCURSAL.MIRAFLORES],
  );
  for (const [idEmpleado, nombres, apellidos] of [
    [CREADOR, "Admin", "Prueba"],
    [EVALUADOR_1, "Eva", "Evaluadora"],
    [EVALUADOR_2, "Evaristo", "Evaluador"],
    [A, "Ana", "Cajera Prueba"],
    [B, "Beto", "Asesor Prueba"],
    [C, "Carla", "Analista Prueba"],
    [D, "Dario", "Cajero Prueba"],
  ]) {
    await sql(
      "INSERT INTO empleados (id_empleado, nombres, apellidos) VALUES ($1, $2, $3)",
      [idEmpleado, nombres, apellidos],
    );
  }
  await sql(
    `INSERT INTO competencias (id_competencia, id_tipo_competencia, nombre) VALUES ($1, 1, '@KAN27 Atención'), ($2, 1, '@KAN27 Equipo')`,
    [COMPETENCIA.ATENCION, COMPETENCIA.EQUIPO],
  );
  await sql(
    `INSERT INTO plantillas_evaluacion (id_plantilla, id_departamento_destino, id_empleado_creador, nombre, objetivo, vigencia_desde, vigencia_hasta)
     VALUES ($1, $2, $3, '@KAN27 plantilla', 'Probar el consolidado', '2031-01-01', '2031-12-31')`,
    [id(51), AREA.ATENCION, CREADOR],
  );
  await sql(
    `INSERT INTO versiones_plantilla (id_version, id_plantilla, id_estado_version, id_empleado_publicador, numero_version, publicada_en) VALUES ($1, $2, 2, $3, 1, now())`,
    [id(52), id(51), CREADOR],
  );
  await sql(
    `INSERT INTO secciones_plantilla (id_seccion, id_version, id_competencia, orden) VALUES ($1, $3, $4, 1), ($2, $3, $5, 2)`,
    [id(61), id(62), id(52), COMPETENCIA.ATENCION, COMPETENCIA.EQUIPO],
  );
  await sql(
    `INSERT INTO criterios_evaluacion (id_criterio, id_seccion, nombre, orden) VALUES ($1, $3, 'Criterio de atención', 1), ($2, $4, 'Criterio de equipo', 1)`,
    [id(71), id(72), id(61), id(62)],
  );
  await sql(
    `INSERT INTO preguntas_evaluacion (id_pregunta, id_criterio, id_escala, texto, peso_porcentual, es_obligatoria, orden)
     VALUES ($1, $3, $5, '¿Atiende bien?', 60, TRUE, 1), ($2, $4, $5, '¿Trabaja en equipo?', 40, TRUE, 1)`,
    [id(81), id(82), id(71), id(72), LIKERT],
  );
  await sql(
    `INSERT INTO periodos_evaluacion (id_periodo, nombre, fecha_inicio, fecha_fin) VALUES ($1, '@KAN27-2031-T1', '2031-01-01', '2031-03-31')`,
    [PERIODO],
  );
  await sql(
    `INSERT INTO ciclos_evaluacion (id_ciclo, id_version, id_periodo, id_estado_ciclo, id_empleado_creador, nombre, fecha_inicio, fecha_limite, cerrado_en)
     VALUES ($1, $4, $5, 3, $6, '@KAN27 ciclo cerrado', '2031-03-01', '2031-04-10', '2031-04-12 08:00:00-04'),
            ($2, $4, $5, 2, $6, '@KAN27 ciclo abierto', '2031-03-01', '2031-12-31', NULL),
            ($3, $4, $5, 3, $6, '@KAN27 ciclo solo RRHH', '2031-03-01', '2031-04-10', '2031-04-12 08:00:00-04')`,
    [CICLO, CICLO_ABIERTO, CICLO_SOLO_RRHH, id(52), PERIODO, CREADOR],
  );

  const { rows: niveles } = await sql(
    "SELECT id_nivel, valor FROM niveles_escala WHERE id_escala = $1",
    [LIKERT],
  );
  const nivel = (valor) =>
    niveles.find((n) => Number(n.valor) === valor).id_nivel;
  // [n, ciclo, evaluado, evaluador, área, sucursal, estado, puntaje, respuestas q1, q2]
  const evaluaciones = [
    [
      201,
      CICLO,
      A,
      EVALUADOR_1,
      AREA.ATENCION,
      SUCURSAL.SOPOCACHI,
      3,
      92,
      5,
      4,
    ], // (60·100 + 40·80) / 100
    [
      202,
      CICLO,
      A,
      EVALUADOR_2,
      AREA.ATENCION,
      SUCURSAL.SOPOCACHI,
      3,
      80,
      4,
      4,
    ], // (60·80 + 40·80) / 100
    [
      203,
      CICLO,
      B,
      EVALUADOR_1,
      AREA.ATENCION,
      SUCURSAL.MIRAFLORES,
      3,
      60,
      3,
      3,
    ],
    [204, CICLO, C, EVALUADOR_1, AREA.RRHH, SUCURSAL.SOPOCACHI, 3, 48, 2, 3], // (60·40 + 40·60) / 100
    [
      205,
      CICLO,
      D,
      EVALUADOR_1,
      AREA.ATENCION,
      SUCURSAL.MIRAFLORES,
      4,
      null,
      null,
      null,
    ], // vencida
    [
      206,
      CICLO_ABIERTO,
      A,
      EVALUADOR_1,
      AREA.ATENCION,
      SUCURSAL.SOPOCACHI,
      1,
      null,
      null,
      null,
    ], // pendiente
    [
      207,
      CICLO_SOLO_RRHH,
      C,
      EVALUADOR_1,
      AREA.RRHH,
      SUCURSAL.SOPOCACHI,
      3,
      48,
      2,
      3,
    ],
  ];
  for (const [
    n,
    ciclo,
    evaluado,
    evaluador,
    area,
    sucursal,
    estado,
    puntaje,
    q1,
    q2,
  ] of evaluaciones) {
    await sql(
      `INSERT INTO evaluaciones (id_evaluacion, id_ciclo, id_empleado_evaluado, id_empleado_evaluador, id_departamento, id_sucursal, id_estado_evaluacion, puntaje_final, enviada_en)
       VALUES ($1, $2, $3, $4, $5, $6, $7::smallint, $8::numeric, CASE WHEN $7::smallint = 3 THEN now() END)`,
      [id(n), ciclo, evaluado, evaluador, area, sucursal, estado, puntaje],
    );
    if (q1 !== null) {
      await sql(
        `INSERT INTO respuestas_evaluacion (id_evaluacion, id_pregunta, id_nivel) VALUES ($1, $2, $3), ($1, $4, $5)`,
        [id(n), id(81), nivel(q1), id(82), nivel(q2)],
      );
    }
  }
}

async function borrarDatos() {
  const ciclos = [CICLO, CICLO_ABIERTO, CICLO_SOLO_RRHH];
  const evaluaciones = (
    await pool.query(
      "SELECT id_evaluacion FROM evaluaciones WHERE id_ciclo = ANY($1)",
      [ciclos],
    )
  ).rows.map((f) => f.id_evaluacion);
  const mensajes = (
    await pool.query(
      "SELECT DISTINCT id_mensaje FROM metricas_crm WHERE id_ciclo = ANY($1)",
      [ciclos],
    )
  ).rows.map((f) => f.id_mensaje);
  await pool.query("DELETE FROM metricas_crm WHERE id_ciclo = ANY($1)", [
    ciclos,
  ]);
  await pool.query(
    "DELETE FROM mensajes_entrantes WHERE id_mensaje = ANY($1) OR id_mensaje = ANY($2) OR carga LIKE $3",
    [mensajes, [...mensajesCreados], `%${ID_BASE}%`],
  );
  await pool.query("DELETE FROM eventos_salientes WHERE id_ciclo = ANY($1)", [
    ciclos,
  ]);
  await pool.query(
    "DELETE FROM respuestas_evaluacion WHERE id_evaluacion = ANY($1)",
    [evaluaciones],
  );
  await pool.query("DELETE FROM evaluaciones WHERE id_ciclo = ANY($1)", [
    ciclos,
  ]);
  await pool.query("DELETE FROM ciclos_evaluacion WHERE id_ciclo = ANY($1)", [
    ciclos,
  ]);
  await pool.query("DELETE FROM periodos_evaluacion WHERE id_periodo = $1", [
    PERIODO,
  ]);
  await pool.query(
    "DELETE FROM preguntas_evaluacion WHERE id_pregunta::text LIKE $1",
    [`${ID_BASE}%`],
  );
  await pool.query(
    "DELETE FROM criterios_evaluacion WHERE id_criterio::text LIKE $1",
    [`${ID_BASE}%`],
  );
  await pool.query(
    "DELETE FROM secciones_plantilla WHERE id_seccion::text LIKE $1",
    [`${ID_BASE}%`],
  );
  await pool.query(
    "DELETE FROM versiones_plantilla WHERE id_version::text LIKE $1",
    [`${ID_BASE}%`],
  );
  await pool.query(
    "DELETE FROM plantillas_evaluacion WHERE id_plantilla::text LIKE $1",
    [`${ID_BASE}%`],
  );
  await pool.query(
    "DELETE FROM competencias WHERE id_competencia::text LIKE $1",
    [`${ID_BASE}%`],
  );
  await pool.query("DELETE FROM empleados WHERE id_empleado::text LIKE $1", [
    `${ID_BASE}%`,
  ]);
  await pool.query("DELETE FROM sucursales WHERE id_sucursal::text LIKE $1", [
    `${ID_BASE}%`,
  ]);
  await pool.query(
    "DELETE FROM departamentos WHERE id_departamento::text LIKE $1",
    [`${ID_BASE}%`],
  );
}

const solicitudes = (idCiclo) =>
  pool
    .query(
      "SELECT e.*, c.codigo AS estado FROM eventos_salientes e JOIN catalogos_estado_evento c USING (id_estado_evento) WHERE id_ciclo = $1",
      [idCiclo],
    )
    .then((r) => r.rows[0]);
const metricas = (idCiclo = CICLO) =>
  pool
    .query(
      "SELECT id_empleado, id_mensaje, cantidad_quejas AS q, cantidad_felicitaciones AS f, minutos_resolucion_promedio AS m FROM metricas_crm WHERE id_ciclo = $1 ORDER BY id_empleado",
      [idCiclo],
    )
    .then((r) => r.rows);
const mensaje = (idMensaje) =>
  pool
    .query(
      "SELECT m.*, c.codigo AS estado FROM mensajes_entrantes m JOIN catalogos_estado_mensaje c USING (id_estado_mensaje) WHERE id_mensaje = $1",
      [idMensaje],
    )
    .then((r) => r.rows[0]);
const encabezado = (cambios = {}) => ({
  id_mensaje: `kan27-${Math.random().toString(16).slice(2)}`,
  origen: { grupo: "B", modulo: "CRM" },
  destino: { grupo: "F", modulo: "RRHH" },
  tipo: "METRICAS_DESEMPENO_CRM",
  fecha: new Date().toISOString(),
  version_esquema: 1,
  ...cambios,
});
const respuesta = ({
  ciclo = CICLO,
  periodo = "@KAN27-2031-T1",
  metricas: lista,
  cabecera,
} = {}) => ({
  encabezado: encabezado(cabecera),
  datos: { id_ciclo: ciclo, periodo: { nombre: periodo }, metricas: lista },
});
const metrica = (idEmpleado, quejas, felicitaciones, minutos) => ({
  id_empleado: idEmpleado,
  cantidad_quejas: quejas,
  cantidad_felicitaciones: felicitaciones,
  minutos_resolucion_promedio: minutos,
});

describe("KAN-27 (RF-07): consolidación de desempeño y métricas del CRM", () => {
  before(async () => {
    pool = require("../src/config/db");
    try {
      await pool.query("SELECT id_metrica FROM metricas_crm LIMIT 1");
      await pool.query("SELECT id_mensaje FROM mensajes_entrantes LIMIT 1");
      const { rows } = await pool.query(
        "SELECT id_estado_evento FROM catalogos_estado_evento",
      );
      if (rows.length < 3)
        throw new Error("sin los catálogos de db/catalogos.sql");
      hayOmitido = rows.some((fila) => fila.id_estado_evento === 4);
      const { rows: escala } = await pool.query(
        "SELECT 1 FROM niveles_escala WHERE id_escala = $1",
        [LIKERT],
      );
      if (escala.length === 0)
        throw new Error("sin la escala Likert de db/catalogos.sql");
      await borrarDatos(); // por si una corrida anterior quedó a medias
      await crearDatos();
    } catch (error) {
      motivo = `PerformanceDB no disponible o sin el esquema de KAN-27 (${error.message || error.code})`;
      return;
    }

    // Todo el servicio se carga después de elegir la base y de simular EmployeeService y Pub/Sub.
    modulos = {
      pubsub: require("../src/config/pubsub"),
      jerarquia: require("../src/services/jerarquiaExterna"),
      despacho: require("../src/services/despachoEventosService"),
      consumidor: require("../src/services/consumidorCrmService"),
      desempeno: require("../src/services/desempenoService"),
      metricasCrm: require("../src/utils/metricasCrm"),
    };
    modulos.original = {
      cliente: modulos.pubsub.obtenerCliente,
      personal: modulos.jerarquia.listarColaboradores,
      cargos: modulos.jerarquia.listarCargos,
    };
    modulos.pubsub.obtenerCliente = () => clienteFalso;
    modulos.jerarquia.listarColaboradores = async () => PERSONAL;
    modulos.jerarquia.listarCargos = async () => CARGOS;

    process.env.CRM_REINTENTO_BASE_MS = "0";
    process.env.CRM_MAXIMO_INTENTOS = "3";
    process.env.SIMULAR_CRM_ACTIVO = "false";
    process.env.SIMULAR_CRM_DEMORA_MS = "0";
    process.env.PUBSUB_TIMEOUT_MS = "1500";

    const app = express();
    app.use(express.json());
    app.use(require("../src/routes/desempenoRoutes"));
    app.use(require("../src/routes/mensajesPublicadosRoutes"));
    app.use(require("../src/middlewares/manejadorErrores"));
    servidor = await new Promise((resolver) => {
      const srv = app.listen(0, "127.0.0.1", () => resolver(srv));
    });
    base = `http://127.0.0.1:${servidor.address().port}`;
    disponible = true;
  });

  after(async () => {
    servidor?.close();
    if (disponible) {
      modulos.pubsub.obtenerCliente = modulos.original.cliente;
      modulos.jerarquia.listarColaboradores = modulos.original.personal;
      modulos.jerarquia.listarCargos = modulos.original.cargos;
    }
    for (const [nombre, valor] of Object.entries(entornoOriginal)) {
      if (valor === undefined) delete process.env[nombre];
      else process.env[nombre] = valor;
    }
    if (pool) {
      try {
        await borrarDatos();
      } finally {
        await pool.end();
      }
    }
  });

  describe("criterio 1: consolidado de un ciclo cerrado", () => {
    it("solo lista ciclos cerrados, con cuántas evaluaciones se enviaron y cuántas vencieron", async (t) => {
      if (!requiere(t)) return;
      const { estado, cuerpo } = await api("/desempeno/ciclos");
      const nuestros = cuerpo.filter((c) =>
        [CICLO, CICLO_ABIERTO, CICLO_SOLO_RRHH].includes(c.id_ciclo),
      );

      assert.equal(estado, 200);
      assert.deepEqual(
        nuestros.map((c) => c.id_ciclo).sort(),
        [CICLO, CICLO_SOLO_RRHH].sort(),
        "el ciclo activo no aparece",
      );
      assert.deepEqual(
        nuestros.find((c) => c.id_ciclo === CICLO).evaluaciones,
        { total: 5, enviadas: 4, vencidas: 1 },
      );
    });

    it("promedia por área contando una vez a cada colaborador, aunque tenga dos evaluadores", async (t) => {
      if (!requiere(t)) return;
      const { estado, cuerpo } = await api(
        `/desempeno/ciclos/${CICLO}/consolidado`,
      );

      assert.equal(estado, 200);
      // A: (92 + 80) / 2 = 86; B 60; C 48 → global (86 + 60 + 48) / 3 = 64,67.
      assert.equal(cuerpo.resumen.promedio_global, 64.67);
      assert.deepEqual(
        cuerpo.departamentos.map((g) => [g.nombre, g.puntaje]),
        [
          ["@KAN27 Recursos Humanos", 48],
          ["@KAN27 Atención al cliente", 73],
        ],
      );
      assert.deepEqual(
        cuerpo.sucursales.map((g) => [g.nombre, g.puntaje]),
        [
          ["@KAN27 Miraflores", 60],
          ["@KAN27 Sopocachi", 67],
        ],
      );
    });

    it("promedia por competencia con el mismo cálculo del evaluador", async (t) => {
      if (!requiere(t)) return;
      const { cuerpo } = await api(`/desempeno/ciclos/${CICLO}/consolidado`);

      // Atención: A (100 y 80 → 90), B 60, C 40. Equipo: A 80, B 60, C 60.
      assert.deepEqual(
        cuerpo.competencias.map((c) => [c.competencia, c.puntaje]),
        [
          ["@KAN27 Atención", 63.33],
          ["@KAN27 Equipo", 66.67],
        ],
      );
    });

    it("cuenta la cobertura y deja fuera la evaluación vencida de todos los promedios", async (t) => {
      if (!requiere(t)) return;
      const { cuerpo } = await api(`/desempeno/ciclos/${CICLO}/consolidado`);
      const atencion = cuerpo.departamentos.find((g) => g.id === AREA.ATENCION);

      assert.deepEqual(
        [
          cuerpo.resumen.asignados,
          cuerpo.resumen.evaluados,
          cuerpo.resumen.cobertura_porcentual,
        ],
        [4, 3, 75],
      );
      assert.deepEqual(
        [
          atencion.asignados,
          atencion.evaluados,
          atencion.evaluaciones_enviadas,
          atencion.evaluaciones_vencidas,
        ],
        [3, 2, 3, 1],
      );
    });

    it("un ciclo que sigue activo responde 409 y uno inexistente 404", async (t) => {
      if (!requiere(t)) return;
      assert.equal(
        (await api(`/desempeno/ciclos/${CICLO_ABIERTO}/consolidado`)).estado,
        409,
      );
      assert.equal(
        (await api(`/desempeno/ciclos/${id(999)}/consolidado`)).estado,
        404,
      );
      assert.equal(
        (await api("/desempeno/ciclos/no-es-un-id/consolidado")).estado,
        404,
      );
    });

    it("ordena a los colaboradores del menor al mayor puntaje y deja al final a quien no tiene", async (t) => {
      if (!requiere(t)) return;
      const { cuerpo } = await api(`/desempeno/ciclos/${CICLO}/colaboradores`);

      assert.deepEqual(
        cuerpo.colaboradores.map((c) => [
          c.nombre_completo,
          c.puntaje,
          c.bajo_umbral,
        ]),
        [
          ["Carla Analista Prueba", 48, true],
          ["Beto Asesor Prueba", 60, false],
          ["Ana Cajera Prueba", 86, false],
          ["Dario Cajero Prueba", null, false],
        ],
      );
    });

    it("filtra a los colaboradores por área y sucursal", async (t) => {
      if (!requiere(t)) return;
      const { cuerpo } = await api(
        `/desempeno/ciclos/${CICLO}/colaboradores?departamento=${AREA.ATENCION}&sucursal=${SUCURSAL.MIRAFLORES}`,
      );
      assert.deepEqual(
        cuerpo.colaboradores.map((c) => c.id_empleado).sort(),
        [B, D].sort(),
      );
      assert.equal(
        (await api(`/desempeno/ciclos/${CICLO}/colaboradores?sucursal=x`))
          .estado,
        400,
      );
    });
  });

  describe("criterio 5: brechas de productividad contra el umbral", () => {
    it("solo el área bajo el umbral es brecha; un promedio igual al umbral no lo es", async (t) => {
      if (!requiere(t)) return;
      const { cuerpo } = await api(`/desempeno/ciclos/${CICLO}/comparativa`);

      assert.deepEqual(cuerpo.brechas, [
        {
          id: AREA.RRHH,
          nombre: "@KAN27 Recursos Humanos",
          puntaje: 48,
          puntos_bajo_umbral: 12,
        },
      ]);
      const miraflores = (
        await api(`/desempeno/ciclos/${CICLO}/comparativa?por=sucursal`)
      ).cuerpo.grupos.find((g) => g.id === SUCURSAL.MIRAFLORES);
      assert.deepEqual(
        [miraflores.puntaje, miraflores.es_brecha],
        [60, false],
        "60 igual al umbral de 60",
      );
    });

    it("el administrador cambia el umbral y el resultado cambia con él", async (t) => {
      if (!requiere(t)) return;
      const cambio = await api(`/desempeno/ciclos/${CICLO}/umbral`, {
        metodo: "PUT",
        cuerpo: { umbral_brecha: 68 },
      });
      assert.deepEqual([cambio.estado, cambio.cuerpo.umbral_brecha], [200, 68]);

      const { cuerpo } = await api(`/desempeno/ciclos/${CICLO}/consolidado`);
      assert.deepEqual(
        cuerpo.sucursales
          .filter((g) => g.es_brecha)
          .map((g) => g.nombre)
          .sort(),
        ["@KAN27 Miraflores", "@KAN27 Sopocachi"],
      );
      assert.equal(
        cuerpo.resumen.departamentos_en_brecha,
        1,
        "Atención (73) sigue sobre 68",
      );

      await api(`/desempeno/ciclos/${CICLO}/umbral`, {
        metodo: "PUT",
        cuerpo: { umbral_brecha: 60 },
      });
    });

    it("rechaza umbrales inválidos sin cambiar el guardado", async (t) => {
      if (!requiere(t)) return;
      for (const valor of [-1, 101, 60.123, "60", null]) {
        assert.equal(
          (
            await api(`/desempeno/ciclos/${CICLO}/umbral`, {
              metodo: "PUT",
              cuerpo: { umbral_brecha: valor },
            })
          ).estado,
          400,
          String(valor),
        );
      }
      assert.equal(
        (
          await api(`/desempeno/ciclos/${id(999)}/umbral`, {
            metodo: "PUT",
            cuerpo: { umbral_brecha: 50 },
          })
        ).estado,
        404,
      );
      const { rows } = await pool.query(
        "SELECT umbral_brecha FROM ciclos_evaluacion WHERE id_ciclo = $1",
        [CICLO],
      );
      assert.equal(rows[0].umbral_brecha, 60);
    });

    it("el umbral admite los extremos 0 y 100 con dos decimales", async (t) => {
      if (!requiere(t)) return;
      for (const valor of [0, 100, 72.25]) {
        assert.equal(
          (
            await api(`/desempeno/ciclos/${CICLO}/umbral`, {
              metodo: "PUT",
              cuerpo: { umbral_brecha: valor },
            })
          ).cuerpo.umbral_brecha,
          valor,
        );
      }
      await api(`/desempeno/ciclos/${CICLO}/umbral`, {
        metodo: "PUT",
        cuerpo: { umbral_brecha: 60 },
      });
    });
  });

  describe("permisos: consultan RRHH (admin y gerente), solo el administrador modifica", () => {
    it("el gerente consulta; el empleado recibe 403 y sin rol 401", async (t) => {
      if (!requiere(t)) return;
      assert.equal(
        (
          await api(`/desempeno/ciclos/${CICLO}/consolidado`, {
            rol: "gerente",
          })
        ).estado,
        200,
      );
      assert.equal(
        (
          await api(`/desempeno/ciclos/${CICLO}/consolidado`, {
            rol: "empleado",
          })
        ).estado,
        403,
      );
      assert.equal(
        (await api(`/desempeno/ciclos/${CICLO}/consolidado`, { rol: null }))
          .estado,
        401,
      );
      assert.equal(
        (await api("/desempeno/mensajes-crm", { rol: "supervisor" })).estado,
        403,
      );
    });

    it("el gerente no puede cambiar el umbral, reintentar la solicitud, reprocesar ni simular", async (t) => {
      if (!requiere(t)) return;
      const reintento = await api(
        `/desempeno/ciclos/${CICLO}/solicitud-crm/reintentar`,
        { metodo: "POST", rol: "gerente" },
      );
      const reproceso = await api(
        `/desempeno/mensajes-crm/${id(1)}/reprocesar`,
        { metodo: "POST", rol: "gerente" },
      );
      const simulacion = await api("/desempeno/mensajes-crm/simulacion", {
        metodo: "POST",
        rol: "gerente",
        cuerpo: { mensaje: "{}" },
      });
      const umbral = await api(`/desempeno/ciclos/${CICLO}/umbral`, {
        metodo: "PUT",
        rol: "gerente",
        cuerpo: { umbral_brecha: 1 },
      });

      assert.deepEqual(
        [reintento.estado, reproceso.estado, simulacion.estado, umbral.estado],
        [403, 403, 403, 403],
      );
      const { rows } = await pool.query(
        "SELECT umbral_brecha FROM ciclos_evaluacion WHERE id_ciclo = $1",
        [CICLO],
      );
      assert.equal(rows[0].umbral_brecha, 60);
    });
  });

  describe("criterio 2: la solicitud de métricas llega al CRM con el periodo y los colaboradores", () => {
    const insertarEvento = (ciclo, empleados) =>
      pool.query(
        `INSERT INTO eventos_salientes (id_ciclo, id_modulo_destino, tipo_evento, carga) VALUES ($1, 1, 'SOLICITUD_METRICAS_CRM', $2::jsonb)`,
        [ciclo, JSON.stringify({ id_ciclo: ciclo, empleados })],
      );

    it("publica una sola vez aunque varias vueltas coincidan, con solo cajeros y asesores, F → B y el periodo", async (t) => {
      if (!requiere(t)) return;
      await insertarEvento(CICLO, [A, B, C, D]);
      const vueltas = await callar(() =>
        Promise.all([
          modulos.despacho.despachar(),
          modulos.despacho.despachar(),
          modulos.despacho.despachar(),
        ]),
      );

      assert.equal(
        vueltas.reduce((suma, n) => suma + n, 0),
        1,
        "una sola vuelta tomó el evento",
      );
      assert.equal(publicados.length, 1);
      const [{ topico, json, attributes }] = publicados;
      assert.equal(topico, "ucb-sis323-sub-f");
      assert.deepEqual(
        [
          json.encabezado.origen.grupo,
          json.encabezado.destino.grupo,
          json.encabezado.tipo,
        ],
        ["F", "B", "SOLICITUD_METRICAS_CRM"],
      );
      assert.deepEqual([attributes.origen, attributes.destino], ["F", "B"]);
      assert.deepEqual(json.datos.periodo, {
        id_periodo: PERIODO,
        nombre: "@KAN27-2031-T1",
        fecha_inicio: "2031-01-01",
        fecha_fin: "2031-03-31",
      });
      assert.deepEqual(
        json.datos.colaboradores.map((c) => [
          c.nombre_completo,
          c.cargo.codigo,
        ]),
        [
          ["Ana Cajera Prueba", "ATC-CAJ"],
          ["Beto Asesor Prueba", "ATC-ASE"],
          ["Dario Cajero Prueba", "ATC-CAJ"],
        ],
      );

      const evento = await solicitudes(CICLO);
      assert.deepEqual(
        [
          evento.estado,
          evento.intentos,
          evento.id_evento === json.encabezado.id_mensaje,
        ],
        ["ENTREGADO", 1, true],
      );
      assert.ok(evento.entregado_en);
    });

    it("una vuelta posterior no vuelve a publicar lo ya entregado", async (t) => {
      if (!requiere(t)) return;
      assert.equal(await callar(() => modulos.despacho.despachar()), 0);
      assert.equal(publicados.length, 1);
    });

    it("el consolidado informa la solicitud entregada", async (t) => {
      if (!requiere(t)) return;
      const { cuerpo } = await api(`/desempeno/ciclos/${CICLO}/consolidado`);
      assert.equal(cuerpo.crm.solicitud.estado, "ENTREGADO");
      assert.equal(cuerpo.crm.solicitud.intentos, 1);
    });

    it("con Pub/Sub caído reintenta con espera, y un error permanente la deja FALLIDA hasta el reintento manual", async (t) => {
      if (!requiere(t)) return;
      await pool.query("DELETE FROM eventos_salientes WHERE id_ciclo = $1", [
        CICLO,
      ]);
      await insertarEvento(CICLO, [A, B]);

      modoPubSub = "red";
      await callar(() => modulos.despacho.despachar());
      let evento = await solicitudes(CICLO);
      assert.deepEqual(
        [evento.estado, evento.intentos, evento.ultimo_error],
        ["PENDIENTE", 1, "No se pudo conectar con Pub/Sub"],
      );
      assert.ok(
        new Date(evento.proximo_intento_en) > new Date(),
        "queda esperando antes del siguiente intento",
      );
      assert.equal(
        await callar(() => modulos.despacho.despachar()),
        0,
        "no reintenta en caliente",
      );

      await pool.query(
        "UPDATE eventos_salientes SET proximo_intento_en = now() - interval '1 second' WHERE id_ciclo = $1",
        [CICLO],
      );
      modoPubSub = "permanente";
      await callar(() => modulos.despacho.despachar());
      evento = await solicitudes(CICLO);
      assert.equal(evento.estado, "FALLIDO");
      assert.match(evento.ultimo_error, /no existe en Pub\/Sub/);
      assert.equal(
        (await api(`/desempeno/ciclos/${CICLO}/consolidado`)).cuerpo.crm
          .solicitud.estado,
        "FALLIDO",
      );

      const reintento = await api(
        `/desempeno/ciclos/${CICLO}/solicitud-crm/reintentar`,
        { metodo: "POST" },
      );
      assert.deepEqual(
        [
          reintento.estado,
          reintento.cuerpo.estado,
          reintento.cuerpo.intentos,
          reintento.cuerpo.ultimo_error,
        ],
        [200, "PENDIENTE", 0, null],
      );
      assert.equal(
        (
          await api(`/desempeno/ciclos/${CICLO}/solicitud-crm/reintentar`, {
            metodo: "POST",
          })
        ).estado,
        409,
        "ya no está fallida",
      );

      modoPubSub = "ok";
      await callar(() => modulos.despacho.despachar());
      assert.equal((await solicitudes(CICLO)).estado, "ENTREGADO");
    });

    it("sin cajeros ni asesores no se publica nada y el evento queda omitido con el motivo", async (t) => {
      if (!requiere(t)) return;
      if (!hayOmitido)
        return t.skip(
          "la base no tiene el estado OMITIDO: vuelva a correr db/catalogos.sql",
        );
      const antes = publicados.length;
      await insertarEvento(CICLO_SOLO_RRHH, [C]);
      await callar(() => modulos.despacho.despachar());

      const evento = await solicitudes(CICLO_SOLO_RRHH);
      assert.equal(evento.estado, "OMITIDO");
      assert.match(evento.ultimo_error, /ATC-CAJ, ATC-ASE/);
      assert.equal(publicados.length, antes);
    });

    it("un ciclo sin solicitud responde 404 al reintento manual y uno abierto 409", async (t) => {
      if (!requiere(t)) return;
      await pool.query("DELETE FROM eventos_salientes WHERE id_ciclo = $1", [
        CICLO_SOLO_RRHH,
      ]);
      assert.equal(
        (
          await api(
            `/desempeno/ciclos/${CICLO_SOLO_RRHH}/solicitud-crm/reintentar`,
            { metodo: "POST" },
          )
        ).estado,
        404,
      );
      assert.equal(
        (
          await api(
            `/desempeno/ciclos/${CICLO_ABIERTO}/solicitud-crm/reintentar`,
            { metodo: "POST" },
          )
        ).estado,
        409,
      );
    });
  });

  describe("criterio 3: la respuesta del CRM (simulada) se asocia a cada colaborador", () => {
    it("tras publicar la solicitud se simula la respuesta, se muestra en la consola y las métricas quedan guardadas", async (t) => {
      if (!requiere(t)) return;
      await pool.query("DELETE FROM eventos_salientes WHERE id_ciclo = $1", [
        CICLO,
      ]);
      await pool.query("DELETE FROM metricas_crm WHERE id_ciclo = $1", [CICLO]);
      await pool.query(
        "INSERT INTO eventos_salientes (id_ciclo, id_modulo_destino, tipo_evento, carga) VALUES ($1, 1, 'SOLICITUD_METRICAS_CRM', $2::jsonb)",
        [CICLO, JSON.stringify({ empleados: [A, B, C, D] })],
      );
      process.env.SIMULAR_CRM_ACTIVO = "true";
      const antesConsola = (await api("/mensajes-publicados")).cuerpo.ultimo;
      const antesPublicados = publicados.length;
      await callar(() => modulos.despacho.despachar());
      const solicitud = publicados[antesPublicados].json;

      await hasta(async () => (await metricas()).length === 3);
      process.env.SIMULAR_CRM_ACTIVO = "false";
      const guardadas = await metricas();
      const esperadas = modulos.metricasCrm.generarMetricasSimuladas(
        solicitud.encabezado.id_mensaje,
        solicitud.datos.colaboradores,
      );

      assert.deepEqual(
        guardadas.map((f) => f.id_empleado).sort(),
        [A, B, D].sort(),
      );
      for (const esperada of esperadas) {
        const fila = guardadas.find(
          (f) => f.id_empleado === esperada.id_empleado,
        );
        const minutos =
          esperada.minutos_resolucion_promedio === null
            ? null
            : Math.round(esperada.minutos_resolucion_promedio * 100) / 100;
        assert.deepEqual(
          [fila.q, fila.f, fila.m],
          [esperada.cantidad_quejas, esperada.cantidad_felicitaciones, minutos],
        );
      }
      const recibido = await mensaje(guardadas[0].id_mensaje);
      mensajesCreados.add(recibido.id_mensaje);
      assert.deepEqual(
        [recibido.estado, recibido.intentos, recibido.ultimo_error],
        ["PROCESADO", 1, null],
      );
      assert.equal(
        recibido.id_mensaje_externo,
        modulos.metricasCrm.armarRespuestaCrm(solicitud).encabezado.id_mensaje,
      );

      const consola = (await api(`/mensajes-publicados?desde=${antesConsola}`))
        .cuerpo.mensajes;
      assert.deepEqual(
        consola.map((m) => m.direccion),
        ["publicado", "recibido"],
      );
      assert.deepEqual(
        [consola[1].atributos.origen, consola[1].atributos.destino],
        ["B", "F"],
      );
    });

    it("el consolidado y la lista de colaboradores traen las métricas como indicador objetivo", async (t) => {
      if (!requiere(t)) return;
      const guardadas = await metricas();
      const { cuerpo } = await api(`/desempeno/ciclos/${CICLO}/consolidado`);
      const lista = (await api(`/desempeno/ciclos/${CICLO}/colaboradores`))
        .cuerpo.colaboradores;

      assert.equal(cuerpo.crm.colaboradores_con_metricas, 3);
      assert.equal(
        cuerpo.crm.cantidad_quejas,
        guardadas.reduce((suma, f) => suma + f.q, 0),
      );
      assert.equal(
        lista.find((c) => c.id_empleado === C).crm,
        null,
        "la analista de RRHH no es medida por el CRM",
      );
      const deA = lista.find((c) => c.id_empleado === A).crm;
      assert.equal(
        deA.cantidad_quejas,
        guardadas.find((f) => f.id_empleado === A).q,
      );
    });

    it("un mensaje nuevo del mismo colaborador reemplaza sus métricas; sigue habiendo una fila por colaborador", async (t) => {
      if (!requiere(t)) return;
      const nuevo = await modulos.consumidor.recibirMensaje(
        JSON.stringify(respuesta({ metricas: [metrica(A, 7, 3, 70.5)] })),
      );
      mensajesCreados.add(nuevo.id_mensaje);
      assert.equal((await nuevo.terminado).estado, "PROCESADO");

      const guardadas = await metricas();
      assert.equal(guardadas.length, 3);
      const deA = guardadas.find((f) => f.id_empleado === A);
      assert.deepEqual(
        [deA.q, deA.f, deA.m, deA.id_mensaje],
        [7, 3, 70.5, nuevo.id_mensaje],
      );
    });

    it("los minutos sin casos se guardan como nulos", async (t) => {
      if (!requiere(t)) return;
      const r = await modulos.consumidor.recibirMensaje(
        JSON.stringify(respuesta({ metricas: [metrica(B, 0, 5, null)] })),
      );
      mensajesCreados.add(r.id_mensaje);
      await r.terminado;

      assert.equal((await metricas()).find((f) => f.id_empleado === B).m, null);
    });
  });

  describe("duplicados", () => {
    it("el mismo mensaje recibido dos veces se descarta sin tocar nada", async (t) => {
      if (!requiere(t)) return;
      const texto = JSON.stringify(
        respuesta({ metricas: [metrica(D, 2, 2, 20)] }),
      );
      const primero = await modulos.consumidor.recibirMensaje(texto);
      mensajesCreados.add(primero.id_mensaje);
      await primero.terminado;
      const antes = JSON.stringify(await metricas());
      const propios = () =>
        pool
          .query(
            "SELECT count(*)::int AS total FROM mensajes_entrantes WHERE carga LIKE $1",
            [`%${ID_BASE}%`],
          )
          .then((r) => r.rows[0].total);
      const mensajesAntes = await propios();

      const segundo = await callar(() =>
        modulos.consumidor.recibirMensaje(texto),
      );
      assert.deepEqual(
        [segundo.duplicado, segundo.estado, segundo.id_mensaje],
        [true, "PROCESADO", primero.id_mensaje],
      );
      assert.equal(JSON.stringify(await metricas()), antes);
      assert.equal(await propios(), mensajesAntes);
      assert.equal(
        (await mensaje(primero.id_mensaje)).intentos,
        1,
        "la repetición no cuenta como intento",
      );
    });

    it("el mismo mensaje llegando tres veces a la vez se registra y se procesa una sola vez", async (t) => {
      if (!requiere(t)) return;
      const texto = JSON.stringify(
        respuesta({ metricas: [metrica(D, 4, 4, 40)] }),
      );
      const llegadas = await callar(() =>
        Promise.all([
          modulos.consumidor.recibirMensaje(texto),
          modulos.consumidor.recibirMensaje(texto),
          modulos.consumidor.recibirMensaje(texto),
        ]),
      );
      llegadas.forEach((l) => mensajesCreados.add(l.id_mensaje));
      await Promise.all(llegadas.map((l) => l.terminado));

      assert.equal(llegadas.filter((l) => !l.duplicado).length, 1);
      assert.equal(new Set(llegadas.map((l) => l.id_mensaje)).size, 1);
      assert.equal((await mensaje(llegadas[0].id_mensaje)).estado, "PROCESADO");
    });
  });

  describe("criterio 4: fallos, reintentos y cola de errores (DLQ)", () => {
    const aDlq = async (texto) => {
      const r = await callar(() => modulos.consumidor.recibirMensaje(texto));
      mensajesCreados.add(r.id_mensaje);
      await r.terminado;
      return mensaje(r.id_mensaje);
    };

    it("un mensaje con datos inválidos agota los reintentos y queda en la cola de errores con el motivo", async (t) => {
      if (!requiere(t)) return;
      const antes = JSON.stringify(await metricas());
      const m = await aDlq(
        JSON.stringify(
          respuesta({ periodo: "2099-X", metricas: [metrica(A, 99, 99, 99)] }),
        ),
      );

      assert.deepEqual(
        [m.estado, m.intentos, m.procesado_en],
        ["EN_DLQ", 3, null],
      );
      assert.match(m.ultimo_error, /«2099-X» no corresponde al del ciclo/);
      assert.equal(
        JSON.stringify(await metricas()),
        antes,
        "no tocó las métricas",
      );
    });

    it("todo o nada: un colaborador válido y otro que no se evaluó no guardan a ninguno", async (t) => {
      if (!requiere(t)) return;
      const antes = JSON.stringify(await metricas());
      const m = await aDlq(
        JSON.stringify(
          respuesta({
            metricas: [metrica(A, 50, 50, 50), metrica(F_AJENO, 1, 1, 1)],
          }),
        ),
      );

      assert.equal(m.estado, "EN_DLQ");
      assert.match(
        m.ultimo_error,
        new RegExp(`no fueron evaluados en el ciclo: ${F_AJENO}`),
      );
      assert.equal(JSON.stringify(await metricas()), antes);
    });

    it("un texto que no es JSON también queda registrado y llega a la cola de errores", async (t) => {
      if (!requiere(t)) return;
      const m = await aDlq("{esto no es json");

      assert.equal(m.estado, "EN_DLQ");
      assert.match(m.ultimo_error, /no es un JSON válido/);
      assert.equal(m.carga, "{esto no es json");
      assert.match(m.id_mensaje_externo, /^[0-9a-f]{64}$/);
    });

    it("la cola de errores se puede revisar por API con el motivo y la carga de cada mensaje", async (t) => {
      if (!requiere(t)) return;
      const { estado, cuerpo } = await api(
        "/desempeno/mensajes-crm?estado=EN_DLQ",
        { rol: "gerente" },
      );
      const nuestros = cuerpo.filter(
        (m) => m.carga.includes(ID_BASE) || m.carga === "{esto no es json",
      );

      assert.equal(estado, 200);
      assert.ok(nuestros.length >= 3);
      assert.ok(
        nuestros.every(
          (m) => m.estado === "EN_DLQ" && m.intentos === 3 && m.ultimo_error,
        ),
      );
      assert.equal(
        (await api("/desempeno/mensajes-crm?estado=XX")).estado,
        400,
      );
    });

    it("con mensajes en la cola de errores el consolidado sigue funcionando", async (t) => {
      if (!requiere(t)) return;
      const { estado, cuerpo } = await api(
        `/desempeno/ciclos/${CICLO}/consolidado`,
      );
      assert.equal(estado, 200);
      assert.equal(cuerpo.resumen.promedio_global, 64.67);
    });

    it("una falla de la base a mitad del mensaje no deja métricas a medias (se deshace la transacción)", async (t) => {
      if (!requiere(t)) return;
      const antes = JSON.stringify(await metricas());
      const lista = [metrica(A, 31, 31, 31), metrica(B, 32, 32, 32)];
      // La última sentencia del mensaje (marcarlo procesado) falla: las métricas ya escritas deben deshacerse.
      const quitarFalla = inyectarFalla(
        /SET id_estado_mensaje = 2/,
        "falla simulada de la base",
      );
      try {
        const m = await aDlq(JSON.stringify(respuesta({ metricas: lista })));
        assert.equal(m.estado, "EN_DLQ");
        assert.match(m.ultimo_error, /falla simulada de la base/);
      } finally {
        quitarFalla();
      }
      assert.equal(
        JSON.stringify(await metricas()),
        antes,
        "ninguna métrica quedó escrita",
      );
    });

    it("una falla pasajera se recupera: se reintenta y termina procesado, sin pasar por la cola de errores", async (t) => {
      if (!requiere(t)) return;
      const quitarFalla = inyectarFalla(
        /INSERT INTO metricas_crm/,
        "la base no responde",
        2,
      );
      let m;
      try {
        m = await aDlq(
          JSON.stringify(respuesta({ metricas: [metrica(B, 8, 8, 80)] })),
        );
      } finally {
        quitarFalla();
      }

      assert.deepEqual(
        [m.estado, m.intentos, m.ultimo_error],
        ["PROCESADO", 3, null],
      );
      assert.equal((await metricas()).find((f) => f.id_empleado === B).q, 8);
    });

    it("reprocesar una vez corregido lo que fallaba lo deja procesado; si sigue fallando, responde 422", async (t) => {
      if (!requiere(t)) return;
      // Un ciclo todavía abierto no recibe métricas: el mensaje llega a la cola de errores.
      const m = await aDlq(
        JSON.stringify(
          respuesta({ ciclo: CICLO_ABIERTO, metricas: [metrica(A, 3, 3, 30)] }),
        ),
      );
      assert.equal(m.estado, "EN_DLQ");
      assert.match(m.ultimo_error, /aún no está cerrado/);

      const sigue = await api(
        `/desempeno/mensajes-crm/${m.id_mensaje}/reprocesar`,
        { metodo: "POST" },
      );
      assert.equal(sigue.estado, 422);
      assert.equal((await mensaje(m.id_mensaje)).estado, "EN_DLQ");

      await pool.query(
        "UPDATE ciclos_evaluacion SET id_estado_ciclo = 3, cerrado_en = now() WHERE id_ciclo = $1",
        [CICLO_ABIERTO],
      );
      const corregido = await api(
        `/desempeno/mensajes-crm/${m.id_mensaje}/reprocesar`,
        { metodo: "POST" },
      );
      assert.deepEqual(
        [
          corregido.estado,
          corregido.cuerpo.estado,
          corregido.cuerpo.ultimo_error,
          corregido.cuerpo.metricas,
        ],
        [200, "PROCESADO", null, 1],
      );
      assert.equal((await metricas(CICLO_ABIERTO)).length, 1);

      assert.equal(
        (
          await api(`/desempeno/mensajes-crm/${m.id_mensaje}/reprocesar`, {
            metodo: "POST",
          })
        ).estado,
        409,
        "ya no está en la cola",
      );
      assert.equal(
        (
          await api(`/desempeno/mensajes-crm/${id(998)}/reprocesar`, {
            metodo: "POST",
          })
        ).estado,
        404,
      );
    });

    it("un mensaje que quedó RECIBIDO (el servicio se reinició) se retoma y se procesa", async (t) => {
      if (!requiere(t)) return;
      const texto = JSON.stringify(
        respuesta({ metricas: [metrica(A, 1, 1, 10)] }),
      );
      const { rows } = await pool.query(
        `INSERT INTO mensajes_entrantes (id_modulo_origen, id_estado_mensaje, id_mensaje_externo, tipo_evento, carga, intentos, recibido_en)
         VALUES (1, 1, 'kan27-retomar', 'METRICAS_DESEMPENO_CRM', $1, 2, now() - interval '2 minutes') RETURNING id_mensaje`,
        [texto],
      );
      mensajesCreados.add(rows[0].id_mensaje);
      await callar(() => modulos.consumidor.reanudarRecibidos());
      await hasta(
        async () => (await mensaje(rows[0].id_mensaje)).estado === "PROCESADO",
      );

      assert.equal(
        (await mensaje(rows[0].id_mensaje)).intentos,
        3,
        "sigue la cuenta donde iba",
      );
    });
  });

  describe("simulación manual de mensajes del CRM", () => {
    before(() => {
      process.env.SIMULAR_CRM_ACTIVO = "true";
    });
    after(() => {
      process.env.SIMULAR_CRM_ACTIVO = "false";
    });

    it("acepta el mensaje, responde 202 y lo procesa; repetirlo responde 200 duplicado", async (t) => {
      if (!requiere(t)) return;
      const cuerpo = {
        mensaje: respuesta({ metricas: [metrica(D, 1, 6, 11)] }),
      };
      const primero = await api("/desempeno/mensajes-crm/simulacion", {
        metodo: "POST",
        cuerpo,
      });
      mensajesCreados.add(primero.cuerpo.id_mensaje);

      assert.deepEqual(
        [primero.estado, primero.cuerpo.estado, primero.cuerpo.duplicado],
        [202, "RECIBIDO", false],
      );
      await hasta(
        async () =>
          (await mensaje(primero.cuerpo.id_mensaje)).estado === "PROCESADO",
      );
      const repetido = await api("/desempeno/mensajes-crm/simulacion", {
        metodo: "POST",
        cuerpo,
      });
      assert.deepEqual(
        [repetido.estado, repetido.cuerpo.duplicado, repetido.cuerpo.estado],
        [200, true, "PROCESADO"],
      );
    });

    it("valida el cuerpo y se puede apagar con SIMULAR_CRM_ACTIVO=false", async (t) => {
      if (!requiere(t)) return;
      assert.equal(
        (
          await api("/desempeno/mensajes-crm/simulacion", {
            metodo: "POST",
            cuerpo: {},
          })
        ).estado,
        400,
      );
      process.env.SIMULAR_CRM_ACTIVO = "false";
      assert.equal(
        (
          await api("/desempeno/mensajes-crm/simulacion", {
            metodo: "POST",
            cuerpo: { mensaje: "{}" },
          })
        ).estado,
        403,
      );
    });
  });
});

const F_AJENO = id(35); // un colaborador que existe pero no se evaluó en el ciclo
