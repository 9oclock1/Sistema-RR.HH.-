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
const modelo = require("../models/ciclosModel");
const empleadosService = require("../services/empleadosService");
const jerarquia = require("../services/jerarquiaExterna");
const servicio = require("../services/ciclosService");
const { ErrorApp } = require("../utils/errores");
const { resolverAsignaciones, MOTIVO } = require("../utils/asignacionCiclo");
const { validarCiclo, validarVistaPrevia, verificarFechas } = require("../utils/ciclos");

// Los mocks de una prueba no deben filtrarse a la siguiente.
afterEach(() => mock.restoreAll());

// Cambia un método que simular() ya reemplazó: primero restaura el anterior para que restoreAll lo deje como estaba.
const sustituir = (objeto, nombre, implementacion) => {
  objeto[nombre].mock?.restore();
  return mock.method(objeto, nombre, implementacion);
};

const id = (n) => `b0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const AREA_A = id(1);
const AREA_B = id(2);
const SUC_1 = id(11);
const SUC_2 = id(12);
const SUC_3 = id(13);
const CARGO_JEFE = id(901);
const CARGO_CAJERO = id(902);
const CARGO_SUELTO = id(903);
const VERSION = id(701);
const PERIODO = id(801);
const ADMIN = id(5);
const HOY = "2026-11-08";

const SUCURSALES = { [SUC_1]: "Sopocachi", [SUC_2]: "Miraflores", [SUC_3]: "Obrajes" };
const AREAS = { [AREA_A]: "Atención al cliente", [AREA_B]: "Recursos Humanos" };

const colaborador = (n, nombre, cargo, sucursal, area = AREA_A, activo = true) => ({
  id_empleado: id(n),
  nombre_completo: nombre,
  id_cargo: cargo,
  cargo: cargo === CARGO_JEFE ? "Jefe de tienda" : "Cajero",
  id_sucursal: sucursal,
  sucursal: SUCURSALES[sucursal],
  id_departamento: area,
  area: AREAS[area],
  activo,
});

const ANA = colaborador(10, "Ana Jefa", CARGO_JEFE, SUC_1);
const HUGO = colaborador(17, "Hugo Segundo", CARGO_JEFE, SUC_1);
const ZOE = colaborador(20, "Zoe Jefa", CARGO_JEFE, SUC_2);
const BETO = colaborador(11, "Beto Cajero", CARGO_CAJERO, SUC_1);
const CARLA = colaborador(12, "Carla Cajera", CARGO_CAJERO, SUC_1);
const DANI = colaborador(13, "Dani Cajero", CARGO_CAJERO, SUC_2);
const EVA = colaborador(14, "Eva Suelta", CARGO_SUELTO, SUC_1);
const FEDE = colaborador(15, "Fede Inactivo", CARGO_CAJERO, SUC_1, AREA_A, false);
const GABO = colaborador(16, "Gabo OtraArea", CARGO_CAJERO, SUC_1, AREA_B);
const SOLO = colaborador(18, "Sol Sola", CARGO_CAJERO, SUC_3);

const EMPLEADOS = [ANA, HUGO, ZOE, BETO, CARLA, DANI, EVA, FEDE, GABO, SOLO];
const CARGOS = [
  { id_cargo: CARGO_JEFE, nombre: "Jefe de tienda", id_cargo_superior: null, superior_nombre: null },
  { id_cargo: CARGO_CAJERO, nombre: "Cajero", id_cargo_superior: CARGO_JEFE, superior_nombre: "Jefe de tienda" },
  { id_cargo: CARGO_SUELTO, nombre: "Suelto", id_cargo_superior: null, superior_nombre: null },
];
const alcance = (cambios = {}) => ({ areas: [], sucursales: [], colaboradores: [], ...cambios });

const pares = ({ asignaciones }) =>
  asignaciones.map(({ evaluado, evaluador }) => `${evaluado.nombre_completo} -> ${evaluador.nombre_completo}`);
const motivos = ({ omitidos }) => Object.fromEntries(omitidos.map((o) => [o.nombre_completo, o.codigo]));
const resolver = (cambios) => resolverAsignaciones({ empleados: EMPLEADOS, cargos: CARGOS, ...cambios });

describe("RF-03, criterio 2: asignaciones evaluador–evaluado según la jerarquía", () => {
  describe("alcance", () => {
    it("un área genera una asignación por cada colaborador activo que tenga jefe directo", () => {
      const resultado = resolver({ alcance: alcance({ areas: [AREA_A] }) });
      assert.deepEqual(pares(resultado).sort(), [
        "Beto Cajero -> Ana Jefa",
        "Carla Cajera -> Ana Jefa",
        "Dani Cajero -> Zoe Jefa",
      ]);
    });

    it("área y sucursal juntas se combinan como intersección", () => {
      const resultado = resolver({ alcance: alcance({ areas: [AREA_A], sucursales: [SUC_1] }) });
      assert.deepEqual(pares(resultado).sort(), ["Beto Cajero -> Ana Jefa", "Carla Cajera -> Ana Jefa"]);
    });

    it("una sucursal sola incluye a todas las áreas de esa sucursal", () => {
      const resultado = resolver({ alcance: alcance({ sucursales: [SUC_1] }) });
      assert.deepEqual(pares(resultado).sort(), [
        "Beto Cajero -> Ana Jefa",
        "Carla Cajera -> Ana Jefa",
        "Gabo OtraArea -> Ana Jefa",
      ]);
    });

    it("los colaboradores elegidos uno por uno se suman sin repetirse", () => {
      const resultado = resolver({ alcance: alcance({ areas: [AREA_A], sucursales: [SUC_1], colaboradores: [BETO.id_empleado, GABO.id_empleado] }) });
      assert.deepEqual(pares(resultado).sort(), [
        "Beto Cajero -> Ana Jefa",
        "Carla Cajera -> Ana Jefa",
        "Gabo OtraArea -> Ana Jefa",
      ]);
    });

    it("un colaborador inexistente o inactivo no se evalúa y se informa", () => {
      const resultado = resolver({ alcance: alcance({ colaboradores: [FEDE.id_empleado, id(999)] }) });
      assert.equal(resultado.asignaciones.length, 0);
      assert.deepEqual(
        resultado.omitidos.map((o) => [o.id_empleado, o.codigo]),
        [
          [FEDE.id_empleado, MOTIVO.NO_DISPONIBLE],
          [id(999), MOTIVO.NO_DISPONIBLE],
        ],
      );
    });

    it("los colaboradores inactivos nunca entran por área ni por sucursal", () => {
      const resultado = resolver({ alcance: alcance({ areas: [AREA_A] }) });
      assert.ok(!JSON.stringify(resultado).includes("Fede Inactivo"));
    });

    it("no distingue mayúsculas en los identificadores", () => {
      const resultado = resolver({ alcance: alcance({ areas: [AREA_A.toUpperCase()], sucursales: [SUC_1.toUpperCase()] }) });
      assert.equal(resultado.asignaciones.length, 2);
    });
  });

  describe("evaluador", () => {
    it("es quien ocupa el cargo jefe directo en la MISMA sucursal del evaluado, no cualquier jefe", () => {
      const resultado = resolver({ alcance: alcance({ areas: [AREA_A] }) });
      const dani = resultado.asignaciones.find((a) => a.evaluado.nombre_completo === "Dani Cajero");
      assert.equal(dani.evaluador.id_empleado, ZOE.id_empleado, "Dani trabaja en Miraflores: su jefe es el de Miraflores");
      const beto = resultado.asignaciones.find((a) => a.evaluado.nombre_completo === "Beto Cajero");
      assert.equal(beto.evaluador.id_empleado, ANA.id_empleado);
    });

    it("si hay varios jefes en la sucursal toma siempre el primero por nombre, sin importar el orden de la lista", () => {
      const normal = resolver({ alcance: alcance({ sucursales: [SUC_1] }) });
      const invertida = resolverAsignaciones({
        empleados: [...EMPLEADOS].reverse(),
        cargos: CARGOS,
        alcance: alcance({ sucursales: [SUC_1] }),
      });
      assert.equal(normal.asignaciones[0].evaluador.nombre_completo, "Ana Jefa");
      assert.deepEqual(pares(invertida).sort(), pares(normal).sort());
    });

    it("un colaborador cuyo cargo no tiene cargo superior se omite con su motivo", () => {
      const resultado = resolver({ alcance: alcance({ colaboradores: [EVA.id_empleado, ANA.id_empleado] }) });
      assert.deepEqual(motivos(resultado), {
        "Eva Suelta": MOTIVO.SIN_CARGO_SUPERIOR,
        "Ana Jefa": MOTIVO.SIN_CARGO_SUPERIOR,
      });
    });

    it("si nadie ocupa el cargo superior en su sucursal se omite y se nombra el cargo faltante", () => {
      const resultado = resolver({ alcance: alcance({ colaboradores: [SOLO.id_empleado] }) });
      assert.equal(resultado.asignaciones.length, 0);
      assert.equal(resultado.omitidos[0].codigo, MOTIVO.SIN_EVALUADOR_EN_SUCURSAL);
      assert.match(resultado.omitidos[0].motivo, /Jefe de tienda/);
      assert.match(resultado.omitidos[0].motivo, /sucursal/);
    });

    it("un cargo que no aparece en la jerarquía activa se trata como sin cargo superior", () => {
      const resultado = resolverAsignaciones({
        empleados: [BETO],
        cargos: [],
        alcance: alcance({ colaboradores: [BETO.id_empleado] }),
      });
      assert.deepEqual(motivos(resultado), { "Beto Cajero": MOTIVO.SIN_CARGO_SUPERIOR });
    });

    it("nadie se evalúa a sí mismo aunque su cargo sea su propio cargo superior", () => {
      const cargosCirculares = [{ id_cargo: CARGO_CAJERO, nombre: "Cajero", id_cargo_superior: CARGO_CAJERO, superior_nombre: "Cajero" }];
      const resultado = resolverAsignaciones({
        empleados: [SOLO, BETO, CARLA],
        cargos: cargosCirculares,
        alcance: alcance({ sucursales: [SUC_3, SUC_1] }),
      });
      assert.deepEqual(motivos(resultado), { "Sol Sola": MOTIVO.SIN_EVALUADOR_EN_SUCURSAL });
      for (const { evaluado, evaluador } of resultado.asignaciones) {
        assert.notEqual(evaluado.id_empleado, evaluador.id_empleado);
      }
    });
  });

  describe("advertencias", () => {
    it("avisa de los colaboradores de un área distinta de la plantilla, sin quitarlos", () => {
      const resultado = resolver({
        alcance: alcance({ areas: [AREA_A], colaboradores: [GABO.id_empleado] }),
        idDepartamentoPlantilla: AREA_A,
      });
      assert.ok(pares(resultado).includes("Gabo OtraArea -> Ana Jefa"));
      assert.equal(resultado.advertencias.length, 1);
      assert.equal(resultado.advertencias[0].codigo, "OTRA_AREA");
      assert.deepEqual(resultado.advertencias[0].empleados, [GABO.id_empleado]);
    });

    it("sin colaboradores de otra área, o sin área de plantilla, no hay advertencias", () => {
      assert.deepEqual(resolver({ alcance: alcance({ areas: [AREA_A] }), idDepartamentoPlantilla: AREA_A }).advertencias, []);
      assert.deepEqual(resolver({ alcance: alcance({ sucursales: [SUC_1] }) }).advertencias, []);
    });
  });
});

describe("RF-03: validación del cuerpo de la solicitud", () => {
  const cuerpoValido = (cambios = {}) => ({
    id_version: VERSION.toUpperCase(),
    id_periodo: PERIODO,
    nombre: "  Evaluación de fin de año  ",
    fecha_inicio: "2026-12-01",
    fecha_limite: "2026-12-31",
    alcance: { areas: [AREA_A, AREA_A], sucursales: [SUC_1], colaboradores: [] },
    ...cambios,
  });
  const camposInvalidos = (accion) => {
    try {
      accion();
    } catch (error) {
      assert.ok(error instanceof ErrorApp);
      assert.equal(error.estado, 400);
      return error.detalles.map((d) => d.campo);
    }
    assert.fail("debía rechazar el cuerpo");
  };

  it("normaliza los datos: recorta el nombre, pasa los id a minúsculas y quita repetidos", () => {
    const datos = validarCiclo(cuerpoValido());
    assert.equal(datos.nombre, "Evaluación de fin de año");
    assert.equal(datos.idVersion, VERSION);
    assert.deepEqual(datos.alcance.areas, [AREA_A]);
  });

  it("un cuerpo vacío señala todos los campos obligatorios", () => {
    assert.deepEqual(camposInvalidos(() => validarCiclo({})).sort(), [
      "alcance",
      "fecha_inicio",
      "fecha_limite",
      "id_periodo",
      "id_version",
      "nombre",
    ]);
    assert.ok(camposInvalidos(() => validarCiclo(null)).length > 0);
  });

  it("rechaza fechas que no existen en el calendario y un límite anterior al inicio", () => {
    assert.deepEqual(camposInvalidos(() => validarCiclo(cuerpoValido({ fecha_inicio: "2026-02-30" }))), ["fecha_inicio"]);
    assert.deepEqual(camposInvalidos(() => validarCiclo(cuerpoValido({ fecha_limite: "2026-11-30" }))), ["fecha_limite"]);
    assert.doesNotThrow(() => validarCiclo(cuerpoValido({ fecha_limite: "2026-12-01" })), "el límite puede ser el mismo día");
  });

  it("limita el nombre a 120 caracteres", () => {
    assert.deepEqual(camposInvalidos(() => validarCiclo(cuerpoValido({ nombre: "x".repeat(121) }))), ["nombre"]);
    assert.doesNotThrow(() => validarCiclo(cuerpoValido({ nombre: "x".repeat(120) })));
  });

  it("exige al menos un área, una sucursal o un colaborador", () => {
    assert.deepEqual(camposInvalidos(() => validarCiclo(cuerpoValido({ alcance: { areas: [] } }))), ["alcance"]);
    assert.deepEqual(camposInvalidos(() => validarCiclo(cuerpoValido({ alcance: undefined }))), ["alcance"]);
  });

  it("señala la posición del identificador inválido dentro del alcance", () => {
    const campos = camposInvalidos(() => validarCiclo(cuerpoValido({ alcance: { colaboradores: [BETO.id_empleado, "no-es-uuid"] } })));
    assert.deepEqual(campos, ["alcance.colaboradores[1]"]);
    assert.deepEqual(camposInvalidos(() => validarCiclo(cuerpoValido({ alcance: { areas: "todas" } }))), ["alcance.areas", "alcance"]);
  });

  it("limita el alcance a 500 elementos por lista", () => {
    const muchos = Array.from({ length: 501 }, (_, i) => id(10000 + i));
    assert.ok(camposInvalidos(() => validarCiclo(cuerpoValido({ alcance: { colaboradores: muchos } }))).includes("alcance.colaboradores"));
  });

  it("la vista previa solo necesita el alcance; la versión es opcional pero debe ser válida", () => {
    assert.deepEqual(validarVistaPrevia({ alcance: { areas: [AREA_A] } }).idVersion, null);
    assert.equal(validarVistaPrevia({ id_version: VERSION, alcance: { areas: [AREA_A] } }).idVersion, VERSION);
    assert.deepEqual(camposInvalidos(() => validarVistaPrevia({ id_version: "x", alcance: { areas: [AREA_A] } })), ["id_version"]);
    assert.deepEqual(camposInvalidos(() => validarVistaPrevia({})), ["alcance"]);
  });

  describe("fechas frente al periodo y a hoy", () => {
    const periodo = { nombre: "2026-S2", fecha_inicio: "2026-07-01", fecha_fin: "2026-12-31" };
    const campos = (fechas) => verificarFechas(fechas, periodo, HOY).map((e) => e.campo);

    it("acepta un inicio desde hoy y un límite que supera el fin del periodo", () => {
      assert.deepEqual(campos({ fechaInicio: HOY, fechaLimite: "2027-01-15" }), []);
    });

    it("rechaza un inicio anterior a hoy", () => {
      assert.deepEqual(campos({ fechaInicio: "2026-11-07", fechaLimite: "2026-12-31" }), ["fecha_inicio"]);
    });

    it("rechaza un inicio anterior al inicio del periodo", () => {
      const errores = verificarFechas({ fechaInicio: "2026-06-01", fechaLimite: "2026-12-31" }, { ...periodo, fecha_inicio: "2026-12-01" }, "2026-05-01");
      assert.deepEqual(errores.map((e) => e.campo), ["fecha_inicio"]);
      assert.match(errores[0].mensaje, /2026-S2/);
    });

    it("rechaza un límite que ya pasó", () => {
      assert.deepEqual(campos({ fechaInicio: "2026-11-07", fechaLimite: "2026-11-07" }), ["fecha_inicio", "fecha_limite"]);
    });
  });
});

describe("RF-03, criterio 1: servicio de creación de ciclos (base simulada)", () => {
  let escrituras;

  const versionPublicada = { id_version: VERSION, id_estado_version: 2, numero_version: 3, plantilla: "Evaluación de personal de tienda", id_departamento_destino: AREA_A };
  const periodo = { id_periodo: PERIODO, nombre: "2026-S2", fecha_inicio: "2026-07-01", fecha_fin: "2026-12-31" };
  const cuerpo = (cambios = {}) => ({
    id_version: VERSION,
    id_periodo: PERIODO,
    nombre: "Evaluación de fin de año",
    fecha_inicio: "2026-12-01",
    fecha_limite: "2026-12-31",
    alcance: { areas: [AREA_A], sucursales: [SUC_1] },
    ...cambios,
  });

  const simular = ({ version = versionPublicada, periodoEncontrado = periodo, colaboradores = EMPLEADOS, crearCiclo } = {}) => {
    escrituras = { ciclos: [], evaluaciones: [], empleados: [], departamentos: [], sucursales: [] };
    mock.method(pool, "query", async () => ({ rows: [{ hoy: HOY }] }));
    mock.method(modelo, "obtenerVersion", async () => version);
    mock.method(modelo, "obtenerPeriodo", async () => periodoEncontrado);
    mock.method(empleadosService, "obtenerEmpleado", async (idEmpleado) => ({
      id_empleado: idEmpleado,
      nombres: `Nombre ${idEmpleado.slice(-3)}`,
      apellidos: `Apellido ${idEmpleado.slice(-3)}`,
    }));
    mock.method(jerarquia, "listarColaboradores", async () => colaboradores);
    mock.method(jerarquia, "listarCargos", async () => CARGOS);
    mock.method(modelo, "replicarEmpleado", async (db, persona) => escrituras.empleados.push(persona.id_empleado));
    mock.method(modelo, "replicarDepartamentos", async (db, lista) => escrituras.departamentos.push(...lista));
    mock.method(modelo, "replicarSucursales", async (db, lista) => escrituras.sucursales.push(...lista));
    mock.method(modelo, "crearCiclo", crearCiclo ?? (async (db, datos, creador) => {
      escrituras.ciclos.push({ datos, creador });
      return id(601);
    }));
    mock.method(modelo, "insertarEvaluaciones", async (db, idCiclo, filas) => {
      escrituras.evaluaciones.push({ idCiclo, filas });
      return filas.length;
    });
    mock.method(modelo, "listarCiclos", async (idCiclo) => [{ id_ciclo: idCiclo, nombre: "Evaluación de fin de año", estado_codigo: "PROGRAMADO", total: 2, pendientes: 2 }]);
  };

  const fallo = async (accion) => {
    try {
      await accion();
    } catch (error) {
      return error;
    }
    return assert.fail("debía rechazar la solicitud");
  };

  beforeEach(() => {
    mock.restoreAll();
    transacciones.abiertas = 0;
  });

  it("registra el ciclo y una evaluación pendiente por cada asignación, en una sola transacción", async () => {
    simular();
    const resultado = await servicio.crear(ADMIN, cuerpo());

    assert.equal(transacciones.abiertas, 1);
    assert.equal(escrituras.ciclos.length, 1);
    assert.equal(escrituras.ciclos[0].creador, ADMIN);
    assert.deepEqual(escrituras.ciclos[0].datos, {
      idVersion: VERSION,
      idPeriodo: PERIODO,
      nombre: "Evaluación de fin de año",
      fechaInicio: "2026-12-01",
      fechaLimite: "2026-12-31",
      alcance: { areas: [AREA_A], sucursales: [SUC_1], colaboradores: [] },
    });
    assert.equal(escrituras.evaluaciones.length, 1);
    assert.equal(escrituras.evaluaciones[0].idCiclo, id(601));
    assert.deepEqual(
      escrituras.evaluaciones[0].filas.map((f) => [f.idEvaluado, f.idEvaluador, f.idDepartamento, f.idSucursal]).sort(),
      [
        [BETO.id_empleado, ANA.id_empleado, AREA_A, SUC_1],
        [CARLA.id_empleado, ANA.id_empleado, AREA_A, SUC_1],
      ],
    );
    assert.equal(resultado.total_asignaciones, 2);
    assert.equal(resultado.ciclo.estado_codigo, "PROGRAMADO");
    assert.deepEqual(
      resultado.omitidos.map((o) => o.nombre_completo).sort(),
      ["Ana Jefa", "Eva Suelta", "Hugo Segundo"],
    );
    assert.deepEqual(resultado.advertencias, []);
  });

  it("replica antes el creador, los evaluados, los evaluadores, las áreas y las sucursales", async () => {
    simular();
    await servicio.crear(ADMIN, cuerpo());

    assert.deepEqual(
      [...escrituras.empleados].sort(),
      [ADMIN, ANA.id_empleado, BETO.id_empleado, CARLA.id_empleado].sort(),
    );
    assert.deepEqual(escrituras.departamentos, [{ id_departamento: AREA_A, nombre: "Atención al cliente" }]);
    assert.deepEqual(escrituras.sucursales, [{ id_sucursal: SUC_1, nombre: "Sopocachi" }]);
  });

  it("devuelve la advertencia cuando el alcance incluye a otra área distinta de la plantilla", async () => {
    simular();
    const resultado = await servicio.crear(ADMIN, cuerpo({ alcance: { sucursales: [SUC_1] } }));
    assert.equal(resultado.advertencias[0].codigo, "OTRA_AREA");
    assert.equal(resultado.total_asignaciones, 3);
  });

  describe("rechazos: no se escribe nada", () => {
    const sinEscrituras = () => {
      assert.equal(transacciones.abiertas, 0);
      assert.equal(escrituras.ciclos.length, 0);
      assert.equal(escrituras.evaluaciones.length, 0);
    };

    it("una versión que no está publicada responde 422", async () => {
      simular({ version: { ...versionPublicada, id_estado_version: 1 } });
      const error = await fallo(() => servicio.crear(ADMIN, cuerpo()));
      assert.equal(error.estado, 422);
      assert.match(error.message, /no está publicada/);
      sinEscrituras();
    });

    it("una versión o un periodo inexistentes responden 400 con el campo", async () => {
      simular({ version: null, periodoEncontrado: null });
      const error = await fallo(() => servicio.crear(ADMIN, cuerpo()));
      assert.equal(error.estado, 400);
      assert.deepEqual(error.detalles.map((d) => d.campo), ["id_version", "id_periodo"]);
      sinEscrituras();
    });

    it("un inicio anterior a hoy responde 400", async () => {
      simular();
      const error = await fallo(() => servicio.crear(ADMIN, cuerpo({ fecha_inicio: "2026-11-01" })));
      assert.equal(error.estado, 400);
      assert.equal(error.detalles[0].campo, "fecha_inicio");
      sinEscrituras();
    });

    it("un alcance que no genera ninguna asignación responde 422 con los omitidos", async () => {
      simular();
      const error = await fallo(() => servicio.crear(ADMIN, cuerpo({ alcance: { colaboradores: [EVA.id_empleado] } })));
      assert.equal(error.estado, 422);
      assert.equal(error.detalles[0].codigo, MOTIVO.SIN_CARGO_SUPERIOR);
      sinEscrituras();
    });

    it("si EmployeeService no responde, responde 503 y no queda un ciclo a medias", async () => {
      simular();
      sustituir(jerarquia, "listarColaboradores", async () => {
        throw new ErrorApp(503, "No se pudo consultar al personal y la jerarquía. Intente nuevamente en unos minutos.");
      });
      const error = await fallo(() => servicio.crear(ADMIN, cuerpo()));
      assert.equal(error.estado, 503);
      sinEscrituras();
    });

    it("si no se pueden consultar los nombres de los colaboradores, responde 503", async () => {
      simular();
      sustituir(empleadosService, "obtenerEmpleado", async (idEmpleado) =>
        idEmpleado === BETO.id_empleado ? null : { id_empleado: idEmpleado, nombres: "N", apellidos: "A" },
      );
      const error = await fallo(() => servicio.crear(ADMIN, cuerpo()));
      assert.equal(error.estado, 503);
      sinEscrituras();
    });

    it("un creador que no es un empleado registrado responde 403", async () => {
      simular();
      sustituir(empleadosService, "obtenerEmpleado", async () => null);
      const error = await fallo(() => servicio.crear(ADMIN, cuerpo()));
      assert.equal(error.estado, 403);
      sinEscrituras();
    });

    it("un cuerpo inválido responde 400 sin consultar nada", async () => {
      simular();
      const error = await fallo(() => servicio.crear(ADMIN, {}));
      assert.equal(error.estado, 400);
      assert.equal(modelo.obtenerVersion.mock.callCount(), 0);
      sinEscrituras();
    });
  });

  it("un nombre repetido en el periodo responde 409", async () => {
    simular({
      crearCiclo: async () => {
        throw Object.assign(new Error("duplicate key"), { code: "23505", constraint: "uq_ciclo_periodo_nombre" });
      },
    });
    const error = await fallo(() => servicio.crear(ADMIN, cuerpo()));
    assert.equal(error.estado, 409);
    assert.match(error.message, /Ya existe un ciclo «Evaluación de fin de año»/);
    assert.equal(error.detalles[0].campo, "nombre");
  });

  it("cualquier otro error de base de datos se propaga sin disfrazarse", async () => {
    const original = Object.assign(new Error("conexión perdida"), { code: "57P01" });
    simular({ crearCiclo: async () => { throw original; } });
    assert.equal(await fallo(() => servicio.crear(ADMIN, cuerpo())), original);
  });

  it("la vista previa calcula las asignaciones sin escribir nada", async () => {
    simular();
    const vista = await servicio.vistaPrevia({ id_version: VERSION, alcance: { areas: [AREA_A], sucursales: [SUC_1] } });
    assert.equal(vista.total, 2);
    assert.equal(vista.asignaciones.length, 2);
    assert.equal(transacciones.abiertas, 0);
    assert.equal(modelo.crearCiclo.mock.callCount(), 0);
    assert.equal(modelo.replicarEmpleado.mock.callCount(), 0);
  });

  it("el listado y el detalle devuelven 404 para un ciclo que no existe o un identificador inválido", async () => {
    simular();
    sustituir(modelo, "listarCiclos", async () => []);
    assert.equal((await fallo(() => servicio.obtener(id(999)))).estado, 404);
    assert.equal((await fallo(() => servicio.obtener("no-es-uuid"))).estado, 404);
  });
});

describe("RF-03: consultas del ciclo a PerformanceDB", () => {
  const registrar = () => {
    const consultas = [];
    return {
      consultas,
      db: {
        query: async (sql, parametros) => {
          consultas.push({ sql: sql.replace(/\s+/g, " "), parametros });
          return { rows: [{ id_ciclo: id(601) }], rowCount: 2 };
        },
      },
    };
  };

  it("el ciclo se inserta sin indicar estado: la columna lo deja PROGRAMADO por defecto", async () => {
    const { consultas, db } = registrar();
    await modelo.crearCiclo(db, { idVersion: VERSION, idPeriodo: PERIODO, nombre: "N", fechaInicio: "2026-12-01", fechaLimite: "2026-12-31" }, ADMIN);
    assert.doesNotMatch(consultas[0].sql, /id_estado_ciclo/);
    assert.deepEqual(consultas[0].parametros, [VERSION, PERIODO, ADMIN, "N", "2026-12-01", "2026-12-31"]);
  });

  it("las evaluaciones se insertan de una vez con unnest y sin indicar estado (nacen pendientes)", async () => {
    const { consultas, db } = registrar();
    const filas = [
      { idEvaluado: BETO.id_empleado, idEvaluador: ANA.id_empleado, idDepartamento: AREA_A, idSucursal: SUC_1 },
      { idEvaluado: CARLA.id_empleado, idEvaluador: ANA.id_empleado, idDepartamento: AREA_A, idSucursal: SUC_1 },
    ];
    const cantidad = await modelo.insertarEvaluaciones(db, id(601), filas);
    assert.equal(consultas.length, 1);
    assert.match(consultas[0].sql, /unnest/);
    assert.doesNotMatch(consultas[0].sql, /id_estado_evaluacion/);
    assert.deepEqual(consultas[0].parametros, [
      id(601),
      [BETO.id_empleado, CARLA.id_empleado],
      [ANA.id_empleado, ANA.id_empleado],
      [AREA_A, AREA_A],
      [SUC_1, SUC_1],
    ]);
    assert.equal(cantidad, 2);
  });

  it("solo se pueden programar versiones publicadas", async () => {
    const { consultas, db } = registrar();
    await modelo.listarVersionesPublicadas(db);
    assert.match(consultas[0].sql, /v\.id_estado_version = 2/);
  });
});

describe("RF-03: lectura de personal y jerarquía desde EmployeeService", () => {
  let respuesta;
  const responder = (estado, cuerpo) => {
    respuesta = async () => ({ ok: estado < 400, status: estado, json: async () => cuerpo });
  };

  beforeEach(() => {
    mock.restoreAll();
    mock.method(console, "error", () => {});
    mock.method(globalThis, "fetch", async () => respuesta());
  });

  it("pide los colaboradores y los cargos a las rutas de EmployeeService", async () => {
    responder(200, [{ id_empleado: id(1) }]);
    assert.deepEqual(await jerarquia.listarColaboradores(), [{ id_empleado: id(1) }]);
    await jerarquia.listarCargos();
    const rutas = globalThis.fetch.mock.calls.map((llamada) => new URL(llamada.arguments[0]).pathname);
    assert.deepEqual(rutas, ["/empleados", "/jerarquia/cargos"]);
  });

  it("si responde con error, no responde una lista o no se puede conectar, falla con 503", async () => {
    responder(500, {});
    assert.equal((await jerarquia.listarCargos().catch((e) => e)).estado, 503);
    responder(200, { no: "es una lista" });
    assert.equal((await jerarquia.listarColaboradores().catch((e) => e)).estado, 503);
    respuesta = async () => {
      throw new TypeError("fetch failed");
    };
    assert.equal((await jerarquia.listarColaboradores().catch((e) => e)).estado, 503);
  });
});
