const { describe, it, before, after, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const zlib = require("node:zlib");
const { PDFDocument } = require("pdf-lib");

const modelo = require("../models/dashboardQuejasModel");
const quejasModelo = require("../models/quejasModel");
const historialModelo = require("../models/historialQuejaModel");
const servicio = require("../services/dashboardQuejasService");
const { datosQuejasEjemplo, ESTADO, CATEGORIA, AREA, SUCURSAL } = require("../../db/seedQuejas");
const {
  agruparPor,
  calcularResumen,
  calcularTasaResolucion,
  calcularTendenciaMensual,
  calcularTiempoPromedio,
  leerFiltrosDashboard,
  listarMeses,
  primerDiaDeMes,
  semaforoMenorEsMejor,
} = require("../utils/dashboardQuejas");
const { semaforo } = require("../utils/dashboardDesempeno");

let zonaOriginal;
before(() => {
  zonaOriginal = process.env.QUEJAS_ZONA_HORARIA;
  delete process.env.QUEJAS_ZONA_HORARIA;
});
after(() => {
  if (zonaOriginal === undefined) delete process.env.QUEJAS_ZONA_HORARIA;
  else process.env.QUEJAS_ZONA_HORARIA = zonaOriginal;
});
afterEach(() => mock.restoreAll());

const ID_SUCURSAL = "a9200000-0000-4000-8000-000000000012";
const ID_OTRA_SUCURSAL = "a9200000-0000-4000-8000-000000000011";
const ID_AREA = "a9200000-0000-4000-8000-000000000001";
const ID_OTRA_AREA = "a9200000-0000-4000-8000-000000000002";

let contador = 0;
const fila = (cambios = {}) => ({
  id_queja: `a9200000-0000-4000-8000-${String((contador += 1)).padStart(12, "0")}`,
  es_anonima: false,
  id_estado_queja: 1,
  id_categoria_queja: 1,
  categoria: "Clima laboral",
  id_departamento: ID_AREA,
  departamento: "Atención al cliente",
  id_sucursal: ID_SUCURSAL,
  sucursal: "Miraflores",
  recibida_en_periodo: true,
  mes_recibida: "2026-06",
  resuelta_en_periodo: false,
  mes_resuelta: null,
  dias_resolucion: null,
  ...cambios,
});
const resuelta = (mes, dias, cambios = {}) =>
  fila({ id_estado_queja: 5, resuelta_en_periodo: true, mes_resuelta: mes, dias_resolucion: dias, ...cambios });
const soloResueltaEnPeriodo = (mes, dias, cambios = {}) => resuelta(mes, dias, { recibida_en_periodo: false, mes_recibida: "2026-01", ...cambios });

const AHORA = new Date("2026-11-22T21:00:00Z");

describe("filtros del dashboard de quejas", () => {
  it("sin filtros usa los últimos 6 meses hasta hoy", () => {
    const filtros = leerFiltrosDashboard({}, AHORA);

    assert.equal(filtros.desde, "2026-06-01");
    assert.equal(filtros.hasta, "2026-11-22");
    assert.equal(filtros.idCategoria, null);
    assert.equal(filtros.idSucursal, null);
    assert.equal(filtros.sinSucursal, false);
    assert.equal(filtros.zonaHoraria, "America/La_Paz");
  });

  it("«hoy» se calcula en la zona de Bolivia: a las 22:00 del 22 todavía es 22 aunque en UTC ya sea 23", () => {
    assert.equal(leerFiltrosDashboard({}, new Date("2026-11-23T02:00:00Z")).hasta, "2026-11-22");
    assert.equal(leerFiltrosDashboard({}, new Date("2026-11-22T02:00:00Z")).hasta, "2026-11-21");
  });

  it("cruza el cambio de año al retroceder los 6 meses", () => {
    const filtros = leerFiltrosDashboard({}, new Date("2026-02-10T15:00:00Z"));

    assert.equal(filtros.desde, "2025-09-01");
    assert.equal(filtros.hasta, "2026-02-10");
  });

  it("solo con «desde» llega hasta hoy; solo con «hasta» retrocede 6 meses desde ese mes", () => {
    assert.deepEqual(
      (({ desde, hasta }) => ({ desde, hasta }))(leerFiltrosDashboard({ desde: "2026-09-15" }, AHORA)),
      { desde: "2026-09-15", hasta: "2026-11-22" },
    );
    assert.deepEqual(
      (({ desde, hasta }) => ({ desde, hasta }))(leerFiltrosDashboard({ hasta: "2026-03-15" }, AHORA)),
      { desde: "2025-10-01", hasta: "2026-03-15" },
    );
  });

  it("respeta el periodo elegido", () => {
    const filtros = leerFiltrosDashboard({ desde: "2026-01-01", hasta: "2026-03-31" }, AHORA);

    assert.deepEqual([filtros.desde, filtros.hasta], ["2026-01-01", "2026-03-31"]);
  });

  it("rechaza con 400 las fechas que no existen o no tienen el formato AAAA-MM-DD", () => {
    for (const desde of ["2026-13-01", "2026-02-30", "01/06/2026", "2026-6-1", "ayer"]) {
      assert.throws(() => leerFiltrosDashboard({ desde }, AHORA), (error) => {
        assert.equal(error.estado, 400);
        assert.deepEqual(error.detalles.map((d) => d.campo), ["desde"]);
        return true;
      });
    }
  });

  it("rechaza un rango invertido señalando el campo «hasta»", () => {
    assert.throws(() => leerFiltrosDashboard({ desde: "2026-09-01", hasta: "2026-08-31" }, AHORA), (error) => {
      assert.equal(error.estado, 400);
      assert.deepEqual(error.detalles.map((d) => d.campo), ["hasta"]);
      return true;
    });
  });

  it("acepta un periodo de hasta 36 meses y rechaza uno mayor", () => {
    assert.doesNotThrow(() => leerFiltrosDashboard({ desde: "2023-12-01", hasta: "2026-11-30" }, AHORA));
    assert.throws(() => leerFiltrosDashboard({ desde: "2023-11-30", hasta: "2026-11-30" }, AHORA), { estado: 400 });
  });

  it("la categoría debe ser un entero positivo", () => {
    assert.equal(leerFiltrosDashboard({ categoria: "2" }, AHORA).idCategoria, 2);
    for (const categoria of ["0", "-1", "abc", "1.5"]) {
      assert.throws(() => leerFiltrosDashboard({ categoria }, AHORA), { estado: 400 }, categoria);
    }
  });

  it("la sucursal puede ser un identificador, «sin» o se rechaza", () => {
    assert.equal(leerFiltrosDashboard({ sucursal: ` ${ID_SUCURSAL.toUpperCase()} ` }, AHORA).idSucursal, ID_SUCURSAL);
    const sin = leerFiltrosDashboard({ sucursal: "sin" }, AHORA);
    assert.equal(sin.sinSucursal, true);
    assert.equal(sin.idSucursal, null);
    assert.throws(() => leerFiltrosDashboard({ sucursal: "zzz" }, AHORA), { estado: 400 });
  });

  it("informa todos los filtros inválidos a la vez", () => {
    assert.throws(() => leerFiltrosDashboard({ desde: "x", categoria: "y", sucursal: "z" }, AHORA), (error) => {
      assert.deepEqual(error.detalles.map((d) => d.campo), ["desde", "categoria", "sucursal"]);
      return true;
    });
  });
});

describe("meses del periodo", () => {
  it("primerDiaDeMes retrocede meses cruzando años", () => {
    assert.equal(primerDiaDeMes("2026-03-15", 0), "2026-03-01");
    assert.equal(primerDiaDeMes("2026-03-15", 5), "2025-10-01");
    assert.equal(primerDiaDeMes("2026-01-31", 1), "2025-12-01");
  });

  it("listarMeses incluye el mes inicial y el final", () => {
    assert.deepEqual(listarMeses("2025-11-15", "2026-02-01"), ["2025-11", "2025-12", "2026-01", "2026-02"]);
    assert.deepEqual(listarMeses("2026-05-10", "2026-05-20"), ["2026-05"]);
  });
});

describe("semáforos de los KPI de quejas", () => {
  it("KPI-01 (mayor es mejor, meta 85 %): verde desde 85, amarillo desde 76,5 y rojo por debajo", () => {
    assert.equal(semaforo(85, 85), "VERDE");
    assert.equal(semaforo(100, 85), "VERDE");
    assert.equal(semaforo(84.99, 85), "AMARILLO");
    assert.equal(semaforo(76.5, 85), "AMARILLO");
    assert.equal(semaforo(76.49, 85), "ROJO");
    assert.equal(semaforo(0, 85), "ROJO");
    assert.equal(semaforo(null, 85), null);
  });

  it("KPI-02 (menor es mejor, meta 10 días): verde hasta 10, amarillo hasta 11 y rojo por encima", () => {
    assert.equal(semaforoMenorEsMejor(0, 10), "VERDE");
    assert.equal(semaforoMenorEsMejor(10, 10), "VERDE");
    assert.equal(semaforoMenorEsMejor(10.01, 10), "AMARILLO");
    assert.equal(semaforoMenorEsMejor(11, 10), "AMARILLO");
    assert.equal(semaforoMenorEsMejor(11.01, 10), "ROJO");
    assert.equal(semaforoMenorEsMejor(30, 10), "ROJO");
    assert.equal(semaforoMenorEsMejor(null, 10), null);
  });
});

describe("KPI-01: tasa de resolución de quejas", () => {
  it("es el porcentaje de quejas resueltas sobre las recibidas en el periodo", () => {
    const filas = [...Array.from({ length: 8 }, () => resuelta("2026-06", 5)), ...Array.from({ length: 2 }, () => fila())];
    const kpi = calcularTasaResolucion(filas);

    assert.equal(kpi.codigo, "KPI-01");
    assert.equal(kpi.valor, 80);
    assert.equal(kpi.quejas_recibidas, 10);
    assert.equal(kpi.quejas_resueltas, 8);
    assert.equal(kpi.meta, 85);
    assert.equal(kpi.comparacion, "MAYOR_O_IGUAL");
    assert.equal(kpi.semaforo, "AMARILLO");
  });

  it("una queja desestimada cuenta como recibida pero no como resuelta", () => {
    const filas = [
      ...Array.from({ length: 3 }, () => resuelta("2026-06", 4)),
      fila({ id_estado_queja: 6 }),
      fila({ id_estado_queja: 3 }),
    ];
    const kpi = calcularTasaResolucion(filas);

    assert.equal(kpi.quejas_recibidas, 5);
    assert.equal(kpi.quejas_resueltas, 3);
    assert.equal(kpi.valor, 60);
    assert.equal(kpi.semaforo, "ROJO");
  });

  it("una queja resuelta en el periodo pero recibida antes suma al numerador y no al denominador, como pide la fórmula", () => {
    const filas = [resuelta("2026-06", 3), resuelta("2026-06", 5), soloResueltaEnPeriodo("2026-06", 40)];
    const kpi = calcularTasaResolucion(filas);

    assert.equal(kpi.quejas_recibidas, 2);
    assert.equal(kpi.quejas_resueltas, 3);
    assert.equal(kpi.valor, 150);
    assert.equal(kpi.semaforo, "VERDE");
  });

  it("una queja recibida en el periodo y resuelta después no cuenta como resuelta", () => {
    const filas = [fila({ id_estado_queja: 5, resuelta_en_periodo: false, mes_resuelta: "2026-12", dias_resolucion: 20 })];

    assert.equal(calcularTasaResolucion(filas).valor, 0);
  });

  it("redondea a dos decimales", () => {
    const filas = [resuelta("2026-06", 1), fila(), fila()];

    assert.equal(calcularTasaResolucion(filas).valor, 33.33);
  });

  it("sin quejas recibidas no hay tasa ni semáforo", () => {
    const kpi = calcularTasaResolucion([]);

    assert.equal(kpi.valor, null);
    assert.equal(kpi.semaforo, null);
    assert.equal(calcularTasaResolucion([soloResueltaEnPeriodo("2026-06", 3)]).valor, null);
  });
});

describe("KPI-02: tiempo promedio de resolución", () => {
  it("promedia los días entre el registro y la resolución de las quejas resueltas en el periodo", () => {
    const kpi = calcularTiempoPromedio([resuelta("2026-06", 3), resuelta("2026-06", 4.5), resuelta("2026-06", 6)]);

    assert.equal(kpi.codigo, "KPI-02");
    assert.equal(kpi.valor, 4.5);
    assert.equal(kpi.unidad, "días");
    assert.equal(kpi.meta, 10);
    assert.equal(kpi.comparacion, "MENOR_O_IGUAL");
    assert.equal(kpi.quejas_resueltas, 3);
    assert.equal(kpi.semaforo, "VERDE");
  });

  it("ignora las quejas que no se resolvieron en el periodo", () => {
    const kpi = calcularTiempoPromedio([resuelta("2026-06", 8), fila(), fila({ id_estado_queja: 6 })]);

    assert.equal(kpi.valor, 8);
    assert.equal(kpi.quejas_resueltas, 1);
  });

  it("incluye las resueltas en el periodo aunque se hayan recibido antes", () => {
    assert.equal(calcularTiempoPromedio([resuelta("2026-06", 4), soloResueltaEnPeriodo("2026-06", 14)]).valor, 9);
  });

  it("semáforo: 10 días cumple, 11 está a menos de 10 % de la meta y más de 11 no cumple", () => {
    assert.equal(calcularTiempoPromedio([resuelta("2026-06", 10)]).semaforo, "VERDE");
    assert.equal(calcularTiempoPromedio([resuelta("2026-06", 10), resuelta("2026-06", 12)]).semaforo, "AMARILLO");
    assert.equal(calcularTiempoPromedio([resuelta("2026-06", 10), resuelta("2026-06", 12.02)]).semaforo, "ROJO");
  });

  it("redondea a dos decimales", () => {
    assert.equal(calcularTiempoPromedio([resuelta("2026-06", 1), resuelta("2026-06", 1), resuelta("2026-06", 2)]).valor, 1.33);
  });

  it("sin quejas resueltas no hay valor ni semáforo", () => {
    const kpi = calcularTiempoPromedio([fila()]);

    assert.equal(kpi.valor, null);
    assert.equal(kpi.semaforo, null);
    assert.equal(kpi.quejas_resueltas, 0);
  });
});

describe("resumen y anonimato", () => {
  it("cuenta las quejas anónimas entre las recibidas sin identificar a nadie", () => {
    const filas = [
      fila({ es_anonima: true }),
      fila({ es_anonima: true }),
      fila(),
      resuelta("2026-06", 4),
      soloResueltaEnPeriodo("2026-06", 9, { es_anonima: true }),
    ];
    const resumen = calcularResumen(filas);

    assert.deepEqual(resumen, { quejas_recibidas: 4, quejas_resueltas: 2, quejas_anonimas: 2, quejas_identificadas: 2 });
  });

  it("las quejas anónimas entran en los indicadores igual que las identificadas", () => {
    const anonimas = [resuelta("2026-06", 6, { es_anonima: true }), fila({ es_anonima: true })];
    const identificadas = [resuelta("2026-06", 6), fila()];

    assert.deepEqual(calcularTasaResolucion(anonimas), calcularTasaResolucion(identificadas));
    assert.deepEqual(calcularTiempoPromedio(anonimas), calcularTiempoPromedio(identificadas));
  });

  it("la consulta del dashboard nunca selecciona la identidad del denunciante ni el texto cifrado de la queja", async () => {
    const consultas = [];
    const bd = { query: async (sql, parametros) => (consultas.push({ sql, parametros }), { rows: [] }) };
    await modelo.listarQuejasDelPeriodo(
      { desde: "2026-06-01", hasta: "2026-11-22", idCategoria: 2, idSucursal: ID_SUCURSAL, sinSucursal: false, zonaHoraria: "America/La_Paz" },
      bd,
    );

    assert.equal(consultas.length, 1);
    const { sql, parametros } = consultas[0];
    assert.doesNotMatch(sql, /denunciante/i);
    assert.doesNotMatch(sql, /\bq\.(asunto|descripcion|resolucion)\b/i);
    assert.doesNotMatch(sql, /\bSELECT\s+\*|\bq\.\*/i);
    assert.match(sql, /\bes_anonima\b/);
    assert.deepEqual(parametros, ["2026-06-01", "2026-11-22", 2, ID_SUCURSAL, false, "America/La_Paz"]);
  });

  it("la respuesta del servicio no trae ninguna llave que identifique a un denunciante ni texto de la queja", async () => {
    mock.method(modelo, "listarQuejasDelPeriodo", async () => [resuelta("2026-06", 5, { es_anonima: true }), fila()]);
    mock.method(quejasModelo, "listarCategorias", async () => [{ id_categoria_queja: 1, codigo: "CLIMA_LABORAL", nombre: "Clima laboral" }]);
    mock.method(historialModelo, "listarSucursales", async () => [{ id_sucursal: ID_SUCURSAL, nombre: "Miraflores" }]);
    const tablero = await servicio.obtenerDashboard({ desde: "2026-06-01", hasta: "2026-06-30" });
    const llaves = JSON.stringify(tablero).match(/"([a-z_]+)":/g).map((llave) => llave.replaceAll(/["':]/g, ""));

    for (const prohibida of ["id_empleado_denunciante", "denunciante", "asunto", "descripcion", "resolucion", "id_queja", "codigo_seguimiento"]) {
      assert.ok(!llaves.includes(prohibida), `la respuesta no debe incluir «${prohibida}»`);
    }
  });
});

describe("agrupaciones por categoría, área y sucursal", () => {
  const filas = [
    resuelta("2026-06", 4, { id_categoria_queja: 1, categoria: "Clima laboral" }),
    resuelta("2026-06", 8, { id_categoria_queja: 1, categoria: "Clima laboral" }),
    fila({ id_categoria_queja: 1, categoria: "Clima laboral" }),
    fila({ id_categoria_queja: 2, categoria: "Acoso", id_departamento: ID_OTRA_AREA, departamento: "Recursos Humanos" }),
    fila({ id_categoria_queja: 3, categoria: "Condiciones de trabajo", id_departamento: null, departamento: null, id_sucursal: null, sucursal: null }),
    fila({ id_categoria_queja: 3, categoria: "Condiciones de trabajo", id_departamento: null, departamento: null, id_sucursal: ID_OTRA_SUCURSAL, sucursal: "Sopocachi" }),
  ];

  it("ordena de más a menos quejas recibidas y calcula la tasa, el tiempo y la participación de cada grupo", () => {
    const grupos = agruparPor(filas, "id_categoria_queja", "categoria", "Sin categoría");

    assert.deepEqual(
      grupos.map((g) => [g.nombre, g.quejas_recibidas, g.quejas_resueltas, g.porcentaje_del_total, g.tasa_resolucion, g.tiempo_promedio_dias]),
      [
        ["Clima laboral", 3, 2, 50, 66.67, 6],
        ["Condiciones de trabajo", 2, 0, 33.33, 0, null],
        ["Acoso", 1, 0, 16.67, 0, null],
      ],
    );
  });

  it("agrupa lo que no tiene área en «Sin área» y lo que no tiene sucursal en «Sin sucursal»", () => {
    const porArea = agruparPor(filas, "id_departamento", "departamento", "Sin área");
    const porSucursal = agruparPor(filas, "id_sucursal", "sucursal", "Sin sucursal");

    assert.deepEqual(porArea.map((g) => [g.id, g.nombre, g.quejas_recibidas]), [
      [ID_AREA, "Atención al cliente", 3],
      [null, "Sin área", 2],
      [ID_OTRA_AREA, "Recursos Humanos", 1],
    ]);
    assert.deepEqual(porSucursal.map((g) => [g.nombre, g.quejas_recibidas]), [
      ["Miraflores", 4],
      ["Sin sucursal", 1],
      ["Sopocachi", 1],
    ]);
  });

  it("ante un empate ordena por nombre", () => {
    const empate = [fila({ id_departamento: ID_OTRA_AREA, departamento: "Recursos Humanos" }), fila()];

    assert.deepEqual(agruparPor(empate, "id_departamento", "departamento", "Sin área").map((g) => g.nombre), [
      "Atención al cliente",
      "Recursos Humanos",
    ]);
  });

  it("un grupo con quejas solo resueltas en el periodo no tiene tasa pero sí tiempo promedio", () => {
    const grupos = agruparPor([soloResueltaEnPeriodo("2026-06", 12)], "id_categoria_queja", "categoria", "Sin categoría");

    assert.equal(grupos[0].quejas_recibidas, 0);
    assert.equal(grupos[0].tasa_resolucion, null);
    assert.equal(grupos[0].tiempo_promedio_dias, 12);
  });

  it("sin quejas devuelve una lista vacía", () => {
    assert.deepEqual(agruparPor([], "id_categoria_queja", "categoria", "Sin categoría"), []);
  });
});

describe("tendencia mensual", () => {
  const filas = [
    fila({ mes_recibida: "2026-06" }),
    fila({ mes_recibida: "2026-06" }),
    resuelta("2026-06", 5, { mes_recibida: "2026-06" }),
    resuelta("2026-07", 8, { mes_recibida: "2026-06" }),
    soloResueltaEnPeriodo("2026-07", 12),
    fila({ mes_recibida: "2026-08" }),
  ];

  it("lista todos los meses del periodo, incluso los que no tuvieron quejas", () => {
    const meses = calcularTendenciaMensual([], "2026-06-01", "2026-09-30");

    assert.deepEqual(meses.map((m) => m.mes), ["2026-06", "2026-07", "2026-08", "2026-09"]);
    assert.ok(meses.every((m) => m.quejas_recibidas === 0 && m.tasa_resolucion === null && m.semaforo_tasa === null));
  });

  it("cuenta cada queja recibida en su mes de registro y cada resuelta en su mes de resolución", () => {
    const [junio, julio, agosto] = calcularTendenciaMensual(filas, "2026-06-01", "2026-08-31");

    assert.deepEqual([junio.quejas_recibidas, junio.quejas_resueltas, junio.tasa_resolucion, junio.semaforo_tasa], [4, 1, 25, "ROJO"]);
    assert.deepEqual([junio.tiempo_promedio_dias, junio.semaforo_tiempo], [5, "VERDE"]);
    assert.deepEqual([julio.quejas_recibidas, julio.quejas_resueltas, julio.tasa_resolucion, julio.semaforo_tasa], [0, 2, null, null]);
    assert.deepEqual([julio.tiempo_promedio_dias, julio.semaforo_tiempo], [10, "VERDE"]);
    assert.deepEqual([agosto.quejas_recibidas, agosto.quejas_resueltas, agosto.tasa_resolucion, agosto.semaforo_tasa], [1, 0, 0, "ROJO"]);
    assert.deepEqual([agosto.tiempo_promedio_dias, agosto.semaforo_tiempo], [null, null]);
  });

  it("la suma de los meses coincide con los totales del periodo", () => {
    const meses = calcularTendenciaMensual(filas, "2026-06-01", "2026-08-31");
    const resumen = calcularResumen(filas);

    assert.equal(meses.reduce((suma, m) => suma + m.quejas_recibidas, 0), resumen.quejas_recibidas);
    assert.equal(meses.reduce((suma, m) => suma + m.quejas_resueltas, 0), resumen.quejas_resueltas);
  });
});

describe("datos de ejemplo de quejas (KAN-489) contra las fórmulas", () => {
  const quejas = datosQuejasEjemplo(AHORA);
  const ZONA_MS = 4 * 3600 * 1000;
  const mesLocal = (fecha) => new Date(fecha.getTime() - ZONA_MS).toISOString().slice(0, 7);
  const cierreDe = (queja) => (queja.idEstado === ESTADO.RESUELTA ? queja.pasos[queja.pasos.length - 1][1] : null);
  const MESES = ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"];

  const comoFilas = (lista) =>
    lista.map((queja) => {
      const cierre = cierreDe(queja);
      return {
        id_queja: queja.id,
        es_anonima: queja.esAnonima,
        id_estado_queja: queja.idEstado,
        id_categoria_queja: queja.idCategoria,
        categoria: String(queja.idCategoria),
        id_departamento: queja.idDepartamento,
        departamento: queja.idDepartamento ? "Área" : null,
        id_sucursal: queja.idSucursal,
        sucursal: queja.idSucursal ? "Sucursal" : null,
        recibida_en_periodo: true,
        mes_recibida: mesLocal(queja.creadaEn),
        resuelta_en_periodo: Boolean(cierre),
        mes_resuelta: cierre ? mesLocal(cierre) : null,
        dias_resolucion: cierre ? (cierre - queja.creadaEn) / 86400000 : null,
      };
    });

  it("genera 62 quejas de 6 meses con códigos de seguimiento válidos y únicos", () => {
    assert.equal(quejas.length, 62);
    assert.equal(new Set(quejas.map((q) => q.id)).size, 62);
    assert.equal(new Set(quejas.map((q) => q.codigo)).size, 62);
    for (const queja of quejas) assert.match(queja.codigo, /^QJ-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    assert.deepEqual([...new Set(quejas.map((q) => mesLocal(q.creadaEn)))].sort(), MESES);
  });

  it("es determinista: el mismo día produce exactamente los mismos datos", () => {
    assert.deepEqual(datosQuejasEjemplo(AHORA), quejas);
  });

  it("cubre las 4 categorías, las dos sucursales y las dos áreas, con y sin dato, y quejas anónimas e identificadas", () => {
    assert.deepEqual([...new Set(quejas.map((q) => q.idCategoria))].sort(), Object.values(CATEGORIA).sort());
    assert.deepEqual(new Set(quejas.map((q) => q.idSucursal)), new Set([SUCURSAL.SOPOCACHI, SUCURSAL.MIRAFLORES, null]));
    assert.deepEqual(new Set(quejas.map((q) => q.idDepartamento)), new Set([AREA.ATENCION, AREA.RRHH, null]));
    assert.ok(quejas.some((q) => q.esAnonima) && quejas.some((q) => !q.esAnonima));
    assert.deepEqual([...new Set(quejas.map((q) => q.idEstado))].sort(), Object.values(ESTADO).sort());
  });

  it("respeta las restricciones del esquema: anonimato, resolución cifrable y estado final coherente con el historial", () => {
    for (const queja of quejas) {
      assert.equal(queja.esAnonima, queja.idDenunciante === null, "es_anonima ⇔ sin denunciante");
      assert.equal(queja.idEstado === ESTADO.RESUELTA, queja.resolucion !== null, "RESUELTA ⇔ con resolución");
      assert.equal(queja.pasos[queja.pasos.length - 1][0], queja.idEstado, "el último paso es el estado actual");
      assert.equal(queja.pasos[0][0], ESTADO.REGISTRADA);
      assert.equal(queja.pasos[0][1].getTime(), queja.creadaEn.getTime());
      const fechas = queja.pasos.map((paso) => paso[1].getTime());
      assert.deepEqual([...fechas].sort((a, b) => a - b), fechas, "las fechas del historial no retroceden");
      assert.ok(fechas.every((f) => f <= AHORA.getTime()), "ninguna fecha está en el futuro");
      assert.equal(queja.responsable !== null, queja.idEstado !== ESTADO.REGISTRADA);
    }
  });

  it("las tasas de resolución de junio a octubre son las documentadas: 90, 81,82, 60, 66,67 y 72,73 %", () => {
    const meses = calcularTendenciaMensual(comoFilas(quejas), "2026-06-01", "2026-11-22");

    assert.deepEqual(
      meses.slice(0, 5).map((m) => [m.mes, m.quejas_recibidas, m.quejas_resueltas, m.tasa_resolucion]),
      [
        ["2026-06", 10, 9, 90],
        ["2026-07", 11, 9, 81.82],
        ["2026-08", 10, 6, 60],
        ["2026-09", 12, 8, 66.67],
        ["2026-10", 11, 8, 72.73],
      ],
    );
  });

  it("los datos muestran los tres colores del semáforo de la tasa y también el tiempo promedio en rojo", () => {
    const meses = calcularTendenciaMensual(comoFilas(quejas), "2026-06-01", "2026-11-22");

    assert.deepEqual(new Set(meses.map((m) => m.semaforo_tasa)), new Set(["VERDE", "AMARILLO", "ROJO"]));
    assert.ok(meses.some((m) => m.semaforo_tiempo === "VERDE"));
    assert.ok(meses.some((m) => m.semaforo_tiempo === "ROJO"));
  });

  it("los totales mensuales coinciden con un conteo independiente de los datos", () => {
    const meses = calcularTendenciaMensual(comoFilas(quejas), "2026-06-01", "2026-11-22");

    for (const mes of meses) {
      const recibidas = quejas.filter((q) => mesLocal(q.creadaEn) === mes.mes);
      const resueltas = quejas.filter((q) => cierreDe(q) && mesLocal(cierreDe(q)) === mes.mes);
      assert.equal(mes.quejas_recibidas, recibidas.length, mes.mes);
      assert.equal(mes.quejas_resueltas, resueltas.length, mes.mes);
    }
    assert.equal(meses.reduce((suma, m) => suma + m.quejas_recibidas, 0), 62);
    assert.equal(meses.reduce((suma, m) => suma + m.quejas_resueltas, 0), quejas.filter((q) => q.idEstado === ESTADO.RESUELTA).length);
  });

  it("los KPI del periodo completo salen de esos mismos datos", () => {
    const filas = comoFilas(quejas);
    const resueltas = quejas.filter((q) => q.idEstado === ESTADO.RESUELTA);
    const dias = resueltas.map((q) => (cierreDe(q) - q.creadaEn) / 86400000);
    const esperado = Math.round((dias.reduce((a, b) => a + b, 0) / dias.length) * 100) / 100;

    assert.equal(calcularTasaResolucion(filas).valor, Math.round((resueltas.length / 62) * 10000) / 100);
    assert.equal(calcularTiempoPromedio(filas).valor, esperado);
    assert.equal(calcularResumen(filas).quejas_anonimas, quejas.filter((q) => q.esAnonima).length);
  });
});

describe("servicio del dashboard de quejas", () => {
  const CATEGORIAS = [
    { id_categoria_queja: 1, codigo: "CLIMA_LABORAL", nombre: "Clima laboral" },
    { id_categoria_queja: 2, codigo: "ACOSO", nombre: "Acoso" },
  ];
  const SUCURSALES = [
    { id_sucursal: ID_OTRA_SUCURSAL, nombre: "Sopocachi" },
    { id_sucursal: ID_SUCURSAL, nombre: "Miraflores" },
  ];

  const simular = (filas = []) => {
    const consultas = [];
    mock.method(modelo, "listarQuejasDelPeriodo", async (filtros) => (consultas.push(filtros), filas));
    mock.method(quejasModelo, "listarCategorias", async () => CATEGORIAS);
    mock.method(historialModelo, "listarSucursales", async () => SUCURSALES);
    return consultas;
  };

  const textoDelPdf = (contenido) => {
    const flujos = [];
    const binario = contenido.toString("latin1");
    for (const inicio of binario.matchAll(/stream\r?\n/g)) {
      const desde = inicio.index + inicio[0].length;
      try {
        flujos.push(zlib.inflateSync(contenido.subarray(desde, binario.indexOf("endstream", desde))).toString("latin1"));
      } catch {
        continue;
      }
    }
    return [...flujos.join("\n").matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)].map((m) => Buffer.from(m[1], "hex").toString("latin1")).join("\n");
  };

  it("arma el tablero con los KPI, el resumen, la tendencia, las tres agrupaciones y las opciones de filtro", async () => {
    simular([resuelta("2026-06", 5), fila(), fila({ es_anonima: true })]);
    const tablero = await servicio.obtenerDashboard({ desde: "2026-06-01", hasta: "2026-06-30" });

    assert.deepEqual(tablero.periodo, { desde: "2026-06-01", hasta: "2026-06-30" });
    assert.equal(tablero.kpis.tasa_resolucion.valor, 33.33);
    assert.equal(tablero.kpis.tasa_resolucion.semaforo, "ROJO");
    assert.equal(tablero.kpis.tiempo_promedio.valor, 5);
    assert.equal(tablero.kpis.tiempo_promedio.semaforo, "VERDE");
    assert.deepEqual(tablero.resumen, { quejas_recibidas: 3, quejas_resueltas: 1, quejas_anonimas: 1, quejas_identificadas: 2 });
    assert.equal(tablero.tendencia_mensual.length, 1);
    assert.equal(tablero.por_categoria[0].nombre, "Clima laboral");
    assert.equal(tablero.por_area[0].nombre, "Atención al cliente");
    assert.equal(tablero.por_sucursal[0].nombre, "Miraflores");
    assert.deepEqual(tablero.opciones.categorias.map((c) => [c.id, c.nombre]), [[1, "Clima laboral"], [2, "Acoso"]]);
    assert.deepEqual(tablero.opciones.sucursales.map((s) => s.nombre), ["Sopocachi", "Miraflores"]);
  });

  it("pasa los filtros validados al modelo y los devuelve para que la pantalla los muestre", async () => {
    const consultas = simular();
    const tablero = await servicio.obtenerDashboard({ desde: "2026-01-01", hasta: "2026-03-31", categoria: "2", sucursal: ID_SUCURSAL });

    assert.deepEqual(consultas[0], {
      desde: "2026-01-01",
      hasta: "2026-03-31",
      idCategoria: 2,
      idSucursal: ID_SUCURSAL,
      sinSucursal: false,
      zonaHoraria: "America/La_Paz",
    });
    assert.deepEqual(tablero.filtros, { categoria: 2, sucursal: ID_SUCURSAL });
    assert.equal(tablero.tendencia_mensual.length, 3);
  });

  it("el filtro «sin» se informa como «sin» y consulta solo las quejas sin sucursal", async () => {
    const consultas = simular();
    const tablero = await servicio.obtenerDashboard({ sucursal: "sin" });

    assert.equal(consultas[0].sinSucursal, true);
    assert.equal(tablero.filtros.sucursal, "sin");
  });

  it("un filtro inválido responde 400 sin consultar la base de datos", async () => {
    const consultas = simular();

    await assert.rejects(servicio.obtenerDashboard({ categoria: "abc" }), { estado: 400 });
    assert.equal(consultas.length, 0);
  });

  it("sin quejas devuelve el tablero vacío con todos los meses del periodo", async () => {
    simular([]);
    const tablero = await servicio.obtenerDashboard({ desde: "2026-06-01", hasta: "2026-08-31" });

    assert.equal(tablero.kpis.tasa_resolucion.valor, null);
    assert.equal(tablero.kpis.tiempo_promedio.valor, null);
    assert.deepEqual(tablero.resumen, { quejas_recibidas: 0, quejas_resueltas: 0, quejas_anonimas: 0, quejas_identificadas: 0 });
    assert.equal(tablero.tendencia_mensual.length, 3);
    assert.deepEqual([tablero.por_categoria, tablero.por_area, tablero.por_sucursal], [[], [], []]);
  });

  it("la exportación genera un PDF válido con el nombre del periodo", async () => {
    simular([resuelta("2026-06", 5), fila()]);
    const { nombreArchivo, contenido } = await servicio.exportarPdf({ desde: "2026-06-01", hasta: "2026-06-30" }, AHORA);

    assert.equal(nombreArchivo, "dashboard-quejas-2026-06-01_2026-06-30.pdf");
    assert.ok(Buffer.isBuffer(contenido));
    assert.equal(contenido.subarray(0, 5).toString("latin1"), "%PDF-");
    assert.ok(contenido.length > 1000);
  });

  it("el PDF trae los KPI, el periodo filtrado, los nombres de la categoría y la sucursal elegidas y la tendencia", async () => {
    simular([resuelta("2026-06", 5, { es_anonima: true }), fila()]);
    const { contenido } = await servicio.exportarPdf(
      { desde: "2026-06-01", hasta: "2026-06-30", categoria: "1", sucursal: ID_SUCURSAL },
      AHORA,
    );
    const texto = textoDelPdf(contenido);

    assert.match(texto, /Dashboard de quejas internas/);
    assert.match(texto, /Periodo: del 01\/06\/2026 al 30\/06\/2026/);
    assert.match(texto, /Categor.a: Clima laboral/);
    assert.match(texto, /Sucursal: Miraflores/);
    assert.match(texto, /KPI-01 Tasa de resoluci.n de quejas/);
    assert.match(texto, /50,00 %/);
    assert.match(texto, /KPI-02 Tiempo promedio de resoluci.n/);
    assert.match(texto, /5,00 d.as/);
    assert.match(texto, /No cumple la meta/);
    assert.match(texto, /Cumple la meta/);
    assert.match(texto, /jun 2026/);
    assert.match(texto, /Quejas por categor.a/);
    assert.match(texto, /An.nimas: 1/);
  });

  it("el PDF sin filtros dice «Todas» y el de «sin sucursal» lo nombra", async () => {
    simular([]);
    assert.match(textoDelPdf((await servicio.exportarPdf({ desde: "2026-06-01", hasta: "2026-06-30" }, AHORA)).contenido), /Categor.a: Todas.*Sucursal: Todas/);
    assert.match(textoDelPdf((await servicio.exportarPdf({ desde: "2026-06-01", hasta: "2026-06-30", sucursal: "sin" }, AHORA)).contenido), /Sucursal: Sin sucursal/);
  });

  it("el PDF de un periodo largo con muchos grupos pasa a una segunda página sin cortar contenido", async () => {
    const muchas = Array.from({ length: 30 }, (_, i) =>
      fila({ id_departamento: `a9200000-0000-4000-8000-0000000009${String(i).padStart(2, "0")}`, departamento: `Área ${i}` }),
    );
    simular(muchas);
    const { contenido } = await servicio.exportarPdf({ desde: "2024-01-01", hasta: "2026-11-30" }, AHORA);
    const paginas = (await PDFDocument.load(contenido)).getPageCount();

    assert.ok(paginas >= 2, `se esperaban al menos 2 páginas y hay ${paginas}`);
    assert.match(textoDelPdf(contenido), /Área 29/);
  });

  it("el PDF acepta nombres con caracteres fuera de Latin-1 sin fallar", async () => {
    simular([fila({ departamento: "Área ✓ 日本" })]);

    const { contenido } = await servicio.exportarPdf({ desde: "2026-06-01", hasta: "2026-06-30" }, AHORA);

    assert.equal(contenido.subarray(0, 5).toString("latin1"), "%PDF-");
  });
});
