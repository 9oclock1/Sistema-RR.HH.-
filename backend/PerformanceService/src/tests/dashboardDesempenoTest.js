const { describe, it, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");

const desempenoModelo = require("../models/desempenoModel");
const servicio = require("../services/desempenoService");
const {
  armarRanking,
  calcularCumplimiento,
  calcularHistograma,
  calcularPuntajePromedio,
  compararCiclos,
  semaforo,
  validarFiltrosDashboard,
} = require("../utils/dashboardDesempeno");

afterEach(() => mock.restoreAll());

const ENVIADA = 3;
const VENCIDA = 4;
const PENDIENTE = 1;

const uuid = (grupo, n) => `d9400000-0000-4000-${grupo}000-${String(n).padStart(12, "0")}`;
const AREA = { ATENCION: uuid("a", 1), RRHH: uuid("a", 2) };
const SUCURSAL = { SOPOCACHI: uuid("b", 1), MIRAFLORES: uuid("b", 2) };
const NOMBRE_AREA = { [AREA.ATENCION]: "Atención al cliente", [AREA.RRHH]: "Recursos Humanos" };
const NOMBRE_SUCURSAL = { [SUCURSAL.SOPOCACHI]: "Sopocachi", [SUCURSAL.MIRAFLORES]: "Miraflores" };

let contador = 0;
const evaluacion = (idCiclo, area, sucursal, estado, puntaje = null) => ({
  id_ciclo: idCiclo,
  id_evaluacion: uuid("e", (contador += 1)),
  id_departamento: area,
  departamento: NOMBRE_AREA[area],
  id_sucursal: sucursal,
  sucursal: NOMBRE_SUCURSAL[sucursal],
  id_estado_evaluacion: estado,
  puntaje_final: puntaje,
});

const enviadas = (idCiclo, area, sucursal, puntajes) =>
  puntajes.map((puntaje) => evaluacion(idCiclo, area, sucursal, ENVIADA, puntaje));
const vencidas = (idCiclo, area, sucursal, cantidad) =>
  Array.from({ length: cantidad }, () => evaluacion(idCiclo, area, sucursal, VENCIDA));

const solo = (puntajes) => enviadas(uuid("c", 0), AREA.ATENCION, SUCURSAL.SOPOCACHI, puntajes);

describe("KPI-07: puntaje promedio de desempeño", () => {
  it("promedia el puntaje de las evaluaciones enviadas y lo lleva a la escala de 1 a 5", () => {
    const kpi = calcularPuntajePromedio(solo([80, 60, 40, 100]));

    assert.equal(kpi.codigo, "KPI-07");
    assert.equal(kpi.puntaje_sobre_100, 70);
    assert.equal(kpi.valor, 3.5);
    assert.equal(kpi.meta, 3.5);
    assert.deepEqual(kpi.escala, { minimo: 1, maximo: 5 });
    assert.equal(kpi.evaluaciones_cerradas, 4);
  });

  it("una evaluación de 100 puntos vale 5 y una de 20 vale 1", () => {
    assert.equal(calcularPuntajePromedio(solo([100])).valor, 5);
    assert.equal(calcularPuntajePromedio(solo([20])).valor, 1);
  });

  it("solo cuenta las evaluaciones enviadas: las vencidas y las pendientes no entran en el promedio", () => {
    const filas = [
      ...solo([80, 60]),
      ...vencidas(uuid("c", 0), AREA.ATENCION, SUCURSAL.SOPOCACHI, 2),
      evaluacion(uuid("c", 0), AREA.ATENCION, SUCURSAL.SOPOCACHI, PENDIENTE),
    ];
    const kpi = calcularPuntajePromedio(filas);

    assert.equal(kpi.evaluaciones_cerradas, 2);
    assert.equal(kpi.puntaje_sobre_100, 70);
    assert.equal(kpi.valor, 3.5);
  });

  it("acepta puntajes que llegan como texto desde la base de datos", () => {
    assert.equal(calcularPuntajePromedio(solo(["80.00", "60.00"])).puntaje_sobre_100, 70);
  });

  it("redondea a dos decimales: el ciclo 2026-T3 del seed da 71,49 sobre 100 y 3,57 sobre 5", () => {
    const kpi = calcularPuntajePromedio(solo([92, 78.89, 53, 55, 67, 97, 79, 50]));

    assert.equal(kpi.puntaje_sobre_100, 71.49);
    assert.equal(kpi.valor, 3.57);
  });

  it("sin evaluaciones enviadas no hay valor ni semáforo", () => {
    const kpi = calcularPuntajePromedio(vencidas(uuid("c", 0), AREA.ATENCION, SUCURSAL.SOPOCACHI, 2));

    assert.equal(kpi.valor, null);
    assert.equal(kpi.puntaje_sobre_100, null);
    assert.equal(kpi.semaforo, null);
    assert.equal(kpi.evaluaciones_cerradas, 0);
    assert.equal(calcularPuntajePromedio([]).valor, null);
  });

  it("semáforo: verde desde la meta (3,5), amarillo hasta 10 % por debajo (3,15) y rojo por debajo de eso", () => {
    assert.equal(semaforo(3.5, 3.5), "VERDE");
    assert.equal(semaforo(5, 3.5), "VERDE");
    assert.equal(semaforo(3.49, 3.5), "AMARILLO");
    assert.equal(semaforo(3.15, 3.5), "AMARILLO");
    assert.equal(semaforo(3.14, 3.5), "ROJO");
    assert.equal(semaforo(1, 3.5), "ROJO");
    assert.equal(semaforo(null, 3.5), null);
  });

  it("el semáforo del KPI sale del valor ya redondeado a dos decimales", () => {
    assert.equal(calcularPuntajePromedio(solo([70])).semaforo, "VERDE");
    assert.equal(calcularPuntajePromedio(solo([69.9])).semaforo, "VERDE", "3,495 se redondea a 3,50 y cumple");
    assert.equal(calcularPuntajePromedio(solo([69.8])).semaforo, "AMARILLO", "3,49");
    assert.equal(calcularPuntajePromedio(solo([63])).semaforo, "AMARILLO", "3,15");
    assert.equal(calcularPuntajePromedio(solo([62.9])).semaforo, "AMARILLO", "3,145 se redondea a 3,15");
    assert.equal(calcularPuntajePromedio(solo([62.8])).semaforo, "ROJO", "3,14");
  });
});

describe("KPI-08: cumplimiento de evaluaciones", () => {
  const ciclo = uuid("c", 0);
  const mezcla = (cuantasEnviadas, cuantasVencidas) => [
    ...enviadas(ciclo, AREA.ATENCION, SUCURSAL.SOPOCACHI, Array(cuantasEnviadas).fill(80)),
    ...vencidas(ciclo, AREA.ATENCION, SUCURSAL.SOPOCACHI, cuantasVencidas),
  ];

  it("es el porcentaje de evaluaciones enviadas sobre las asignadas", () => {
    const kpi = calcularCumplimiento(mezcla(8, 1));

    assert.equal(kpi.codigo, "KPI-08");
    assert.equal(kpi.valor, 88.89);
    assert.equal(kpi.evaluaciones_enviadas, 8);
    assert.equal(kpi.evaluaciones_asignadas, 9);
    assert.equal(kpi.evaluaciones_vencidas, 1);
    assert.equal(kpi.meta, 90);
    assert.equal(kpi.unidad, "%");
  });

  it("las vencidas y las pendientes cuentan como asignadas pero no como enviadas", () => {
    const filas = [...mezcla(1, 1), evaluacion(ciclo, AREA.RRHH, SUCURSAL.MIRAFLORES, PENDIENTE)];
    const kpi = calcularCumplimiento(filas);

    assert.equal(kpi.evaluaciones_asignadas, 3);
    assert.equal(kpi.evaluaciones_enviadas, 1);
    assert.equal(kpi.evaluaciones_vencidas, 1);
    assert.equal(kpi.valor, 33.33);
  });

  it("semáforo: 90 % cumple, 81 % está a menos de 10 % de la meta y 80 % no cumple", () => {
    assert.equal(calcularCumplimiento(mezcla(9, 1)).semaforo, "VERDE");
    assert.equal(calcularCumplimiento(mezcla(10, 0)).semaforo, "VERDE");
    assert.equal(calcularCumplimiento(mezcla(8, 1)).semaforo, "AMARILLO");
    assert.equal(calcularCumplimiento(mezcla(81, 19)).semaforo, "AMARILLO");
    assert.equal(calcularCumplimiento(mezcla(8, 2)).semaforo, "ROJO");
    assert.equal(calcularCumplimiento(mezcla(80, 20)).semaforo, "ROJO");
    assert.equal(semaforo(80.99, 90), "ROJO");
    assert.equal(semaforo(81, 90), "AMARILLO");
  });

  it("sin evaluaciones asignadas no hay valor ni semáforo", () => {
    const kpi = calcularCumplimiento([]);

    assert.equal(kpi.valor, null);
    assert.equal(kpi.semaforo, null);
    assert.equal(kpi.evaluaciones_asignadas, 0);
  });
});

describe("histograma de calificaciones", () => {
  const cantidades = (histograma) => histograma.rangos.map((rango) => rango.cantidad);

  it("reparte las evaluaciones enviadas en 8 rangos de medio punto entre 1 y 5", () => {
    const { rangos, escala, total } = calcularHistograma(solo([80, 60, 40, 100]));

    assert.deepEqual(escala, { minimo: 1, maximo: 5 });
    assert.equal(total, 4);
    assert.equal(rangos.length, 8);
    assert.deepEqual(
      rangos.map((rango) => [rango.desde, rango.hasta]),
      [[1, 1.5], [1.5, 2], [2, 2.5], [2.5, 3], [3, 3.5], [3.5, 4], [4, 4.5], [4.5, 5]],
    );
    assert.deepEqual([...rangos.map((rango) => rango.cantidad)], [0, 0, 1, 0, 1, 0, 1, 1]);
  });

  it("los límites pertenecen al rango superior, salvo el 5 que cierra el último", () => {
    assert.deepEqual(cantidades(calcularHistograma(solo([20]))), [1, 0, 0, 0, 0, 0, 0, 0], "1,0");
    assert.deepEqual(cantidades(calcularHistograma(solo([29.99]))), [1, 0, 0, 0, 0, 0, 0, 0], "1,4995");
    assert.deepEqual(cantidades(calcularHistograma(solo([30]))), [0, 1, 0, 0, 0, 0, 0, 0], "1,5");
    assert.deepEqual(cantidades(calcularHistograma(solo([50]))), [0, 0, 0, 1, 0, 0, 0, 0], "2,5");
    assert.deepEqual(cantidades(calcularHistograma(solo([70]))), [0, 0, 0, 0, 0, 1, 0, 0], "3,5");
    assert.deepEqual(cantidades(calcularHistograma(solo([90]))), [0, 0, 0, 0, 0, 0, 0, 1], "4,5");
    assert.deepEqual(cantidades(calcularHistograma(solo([100]))), [0, 0, 0, 0, 0, 0, 0, 1], "5,0");
  });

  it("un puntaje por debajo de 20 cae en el primer rango en vez de perderse", () => {
    assert.deepEqual(cantidades(calcularHistograma(solo([10]))), [1, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("calcula el porcentaje de cada rango sobre las evaluaciones enviadas", () => {
    const { rangos } = calcularHistograma(solo([80, 60, 40, 100]));

    assert.deepEqual(
      rangos.filter((rango) => rango.cantidad > 0).map((rango) => rango.porcentaje),
      [25, 25, 25, 25],
    );
    const tercio = calcularHistograma(solo([80, 80, 60])).rangos.find((rango) => rango.cantidad === 2);
    assert.equal(tercio.porcentaje, 66.67);
  });

  it("no cuenta las evaluaciones que no se enviaron", () => {
    const filas = [...solo([80]), ...vencidas(uuid("c", 0), AREA.ATENCION, SUCURSAL.SOPOCACHI, 3)];

    assert.equal(calcularHistograma(filas).total, 1);
  });

  it("sin evaluaciones enviadas devuelve los 8 rangos en cero", () => {
    const { rangos, total } = calcularHistograma([]);

    assert.equal(total, 0);
    assert.equal(rangos.length, 8);
    assert.ok(rangos.every((rango) => rango.cantidad === 0 && rango.porcentaje === 0));
  });

  it("cada rango trae su etiqueta, con el último cerrado en 5,0", () => {
    const { rangos } = calcularHistograma([]);

    assert.equal(rangos[0].etiqueta, "1.0 a <1.5");
    assert.equal(rangos[7].etiqueta, "4.5 a 5.0");
  });
});

describe("rankings de áreas y sucursales", () => {
  const ciclo = uuid("c", 0);
  const filas = [
    ...enviadas(ciclo, AREA.ATENCION, SUCURSAL.SOPOCACHI, [80, 60]),
    ...enviadas(ciclo, AREA.ATENCION, SUCURSAL.MIRAFLORES, [40]),
    ...enviadas(ciclo, AREA.RRHH, SUCURSAL.SOPOCACHI, [100]),
    ...vencidas(ciclo, AREA.RRHH, SUCURSAL.MIRAFLORES, 1),
  ];

  it("ordena las áreas de mayor a menor puntaje promedio con su posición", () => {
    const ranking = armarRanking(filas, "id_departamento", "departamento");

    assert.deepEqual(
      ranking.map((a) => [a.posicion, a.nombre, a.puntaje, a.puntaje_sobre_100]),
      [
        [1, "Recursos Humanos", 5, 100],
        [2, "Atención al cliente", 3, 60],
      ],
    );
  });

  it("cuenta las evaluaciones enviadas y las asignadas de cada grupo", () => {
    const ranking = armarRanking(filas, "id_departamento", "departamento");
    const rrhh = ranking.find((a) => a.id === AREA.RRHH);

    assert.equal(rrhh.evaluaciones_enviadas, 1);
    assert.equal(rrhh.evaluaciones_asignadas, 2);
  });

  it("ordena las sucursales con el mismo criterio", () => {
    const ranking = armarRanking(filas, "id_sucursal", "sucursal");

    assert.deepEqual(
      ranking.map((s) => [s.posicion, s.nombre, s.puntaje]),
      [
        [1, "Sopocachi", 4],
        [2, "Miraflores", 2],
      ],
    );
  });

  it("un grupo sin evaluaciones enviadas va al final, sin puntaje ni posición", () => {
    const sinEnviar = [
      ...enviadas(ciclo, AREA.ATENCION, SUCURSAL.SOPOCACHI, [60]),
      ...vencidas(ciclo, AREA.RRHH, SUCURSAL.SOPOCACHI, 2),
    ];
    const ranking = armarRanking(sinEnviar, "id_departamento", "departamento");

    assert.deepEqual(
      ranking.map((a) => [a.nombre, a.posicion, a.puntaje]),
      [
        ["Atención al cliente", 1, 3],
        ["Recursos Humanos", null, null],
      ],
    );
  });

  it("ante un empate ordena por nombre y las posiciones siguen consecutivas", () => {
    const empate = [
      ...enviadas(ciclo, AREA.RRHH, SUCURSAL.SOPOCACHI, [60]),
      ...enviadas(ciclo, AREA.ATENCION, SUCURSAL.SOPOCACHI, [60]),
    ];
    const ranking = armarRanking(empate, "id_departamento", "departamento");

    assert.deepEqual(
      ranking.map((a) => [a.posicion, a.nombre]),
      [
        [1, "Atención al cliente"],
        [2, "Recursos Humanos"],
      ],
    );
  });

  it("sin evaluaciones devuelve una lista vacía", () => {
    assert.deepEqual(armarRanking([], "id_departamento", "departamento"), []);
  });
});

describe("comparativo entre ciclos", () => {
  const C1 = uuid("c", 1);
  const C2 = uuid("c", 2);
  const C3 = uuid("c", 3);
  const CICLOS = [
    { id_ciclo: C1, nombre: "Ciclo 1", periodo: "2026-T1", cerrado_en: "2026-04-07T12:00:00.000Z" },
    { id_ciclo: C2, nombre: "Ciclo 2", periodo: "2026-T2", cerrado_en: "2026-07-07T12:00:00.000Z" },
    { id_ciclo: C3, nombre: "Ciclo 3", periodo: "2026-T3", cerrado_en: "2026-10-12T12:00:00.000Z" },
  ];
  const agrupar = (...filas) => {
    const mapa = new Map();
    for (const fila of filas.flat()) mapa.set(fila.id_ciclo, [...(mapa.get(fila.id_ciclo) ?? []), fila]);
    return mapa;
  };
  const por = (idCiclo, puntajes) => enviadas(idCiclo, AREA.ATENCION, SUCURSAL.SOPOCACHI, puntajes);

  it("calcula la variación del puntaje promedio respecto del ciclo anterior", () => {
    const resultado = compararCiclos(CICLOS, agrupar(por(C1, [60]), por(C2, [80]), por(C3, [70])), C3);

    assert.deepEqual(
      resultado.map((c) => [c.nombre, c.puntaje_promedio, c.variacion, c.tendencia]),
      [
        ["Ciclo 1", 3, null, null],
        ["Ciclo 2", 4, 1, "SUBE"],
        ["Ciclo 3", 3.5, -0.5, "BAJA"],
      ],
    );
  });

  it("marca como iguales los ciclos con el mismo puntaje", () => {
    const resultado = compararCiclos(CICLOS.slice(0, 2), agrupar(por(C1, [70]), por(C2, [70])), C2);

    assert.equal(resultado[1].variacion, 0);
    assert.equal(resultado[1].tendencia, "IGUAL");
  });

  it("un ciclo sin evaluaciones enviadas no corta la comparación: se compara con el último ciclo que sí tuvo datos", () => {
    const vacio = vencidas(C2, AREA.ATENCION, SUCURSAL.SOPOCACHI, 2);
    const resultado = compararCiclos(CICLOS, agrupar(por(C1, [60]), vacio, por(C3, [80])), C3);

    assert.equal(resultado[1].puntaje_promedio, null);
    assert.equal(resultado[1].variacion, null);
    assert.equal(resultado[1].semaforo_puntaje, null);
    assert.equal(resultado[2].variacion, 1);
    assert.equal(resultado[2].tendencia, "SUBE");
  });

  it("calcula la variación con los valores de 2 decimales, sin errores de coma flotante", () => {
    const resultado = compararCiclos(CICLOS.slice(0, 2), agrupar(por(C1, [61.8]), por(C2, [72.7])), C2);

    assert.equal(resultado[0].puntaje_promedio, 3.09);
    assert.equal(resultado[1].puntaje_promedio, 3.64);
    assert.equal(resultado[1].variacion, 0.55);
  });

  it("trae el semáforo y el cumplimiento de cada ciclo y marca el seleccionado", () => {
    const filas = agrupar(
      [...por(C1, [80, 80]), ...vencidas(C1, AREA.ATENCION, SUCURSAL.SOPOCACHI, 2)],
      por(C2, [60]),
    );
    const [uno, dos] = compararCiclos(CICLOS.slice(0, 2), filas, C2);

    assert.equal(uno.seleccionado, false);
    assert.equal(dos.seleccionado, true);
    assert.equal(uno.semaforo_puntaje, "VERDE");
    assert.equal(uno.cumplimiento, 50);
    assert.equal(uno.semaforo_cumplimiento, "ROJO");
    assert.equal(uno.evaluaciones_enviadas, 2);
    assert.equal(uno.evaluaciones_asignadas, 4);
    assert.equal(dos.semaforo_puntaje, "ROJO", "3,0 está por debajo de 3,15");
    assert.equal(dos.semaforo_cumplimiento, "VERDE");
  });

  it("un ciclo que no tiene ninguna evaluación aparece con valores nulos", () => {
    const [ciclo] = compararCiclos(CICLOS.slice(0, 1), new Map(), null);

    assert.equal(ciclo.puntaje_promedio, null);
    assert.equal(ciclo.cumplimiento, null);
    assert.equal(ciclo.evaluaciones_asignadas, 0);
  });
});

describe("filtros del dashboard", () => {
  it("sin filtros devuelve todo en nulo", () => {
    assert.deepEqual(validarFiltrosDashboard({}), { ciclo: null, departamento: null, sucursal: null });
    assert.deepEqual(validarFiltrosDashboard(), { ciclo: null, departamento: null, sucursal: null });
  });

  it("acepta identificadores con espacios o en mayúsculas y los normaliza", () => {
    const filtros = validarFiltrosDashboard({ ciclo: `  ${AREA.ATENCION.toUpperCase()} `, sucursal: SUCURSAL.MIRAFLORES });

    assert.equal(filtros.ciclo, AREA.ATENCION);
    assert.equal(filtros.sucursal, SUCURSAL.MIRAFLORES);
    assert.equal(filtros.departamento, null);
  });

  it("rechaza con 400 cada filtro que no sea un identificador válido y los nombra todos", () => {
    assert.throws(
      () => validarFiltrosDashboard({ ciclo: "x", departamento: "no-uuid", sucursal: 7 }),
      (error) => {
        assert.equal(error.estado, 400);
        assert.equal(error.message, "Filtros inválidos");
        assert.deepEqual(
          error.detalles.map((d) => d.campo),
          ["ciclo", "departamento", "sucursal"],
        );
        return true;
      },
    );
  });

  it("un filtro vacío también se rechaza", () => {
    assert.throws(() => validarFiltrosDashboard({ departamento: "" }), { estado: 400 });
  });
});

describe("servicio del dashboard de desempeño", () => {
  const T1 = uuid("c", 11);
  const T2 = uuid("c", 12);
  const T3 = uuid("c", 13);
  const ACTIVO = uuid("c", 14);

  const CERRADOS_DESC = [
    { id_ciclo: T3, nombre: "Evaluación trimestral 2026-T3", periodo: "2026-T3", id_periodo: uuid("f", 3), periodo_desde: "2026-07-01", periodo_hasta: "2026-09-30", cerrado_en: "2026-10-12T12:00:00.000Z", fecha_inicio: "2026-09-28", fecha_limite: "2026-10-10", umbral_brecha: 60, id_estado_ciclo: 3 },
    { id_ciclo: T2, nombre: "Evaluación trimestral 2026-T2", periodo: "2026-T2", id_periodo: uuid("f", 2), periodo_desde: "2026-04-01", periodo_hasta: "2026-06-30", cerrado_en: "2026-07-07T12:00:00.000Z", fecha_inicio: "2026-06-20", fecha_limite: "2026-07-05", umbral_brecha: 60, id_estado_ciclo: 3 },
    { id_ciclo: T1, nombre: "Evaluación trimestral 2026-T1", periodo: "2026-T1", id_periodo: uuid("f", 1), periodo_desde: "2026-01-01", periodo_hasta: "2026-03-31", cerrado_en: "2026-04-07T12:00:00.000Z", fecha_inicio: "2026-03-20", fecha_limite: "2026-04-05", umbral_brecha: 60, id_estado_ciclo: 3 },
  ];

  const EVALUACIONES = [
    ...enviadas(T1, AREA.ATENCION, SUCURSAL.SOPOCACHI, [65, 63.33, 67]),
    ...enviadas(T1, AREA.ATENCION, SUCURSAL.MIRAFLORES, [49, 51, 60]),
    ...enviadas(T1, AREA.RRHH, SUCURSAL.SOPOCACHI, [84, 72]),
    ...enviadas(T1, AREA.RRHH, SUCURSAL.MIRAFLORES, [45]),
    ...vencidas(T1, AREA.RRHH, SUCURSAL.SOPOCACHI, 1),

    ...enviadas(T2, AREA.ATENCION, SUCURSAL.SOPOCACHI, [92, 79, 97]),
    ...enviadas(T2, AREA.ATENCION, SUCURSAL.MIRAFLORES, [71, 66.67]),
    ...enviadas(T2, AREA.RRHH, SUCURSAL.SOPOCACHI, [58, 63]),
    ...enviadas(T2, AREA.RRHH, SUCURSAL.MIRAFLORES, [55]),
    ...vencidas(T2, AREA.ATENCION, SUCURSAL.MIRAFLORES, 1),
    ...vencidas(T2, AREA.RRHH, SUCURSAL.SOPOCACHI, 1),

    ...enviadas(T3, AREA.ATENCION, SUCURSAL.SOPOCACHI, [92, 78.89, 97, 79]),
    ...enviadas(T3, AREA.ATENCION, SUCURSAL.MIRAFLORES, [53, 55, 67]),
    ...enviadas(T3, AREA.RRHH, SUCURSAL.SOPOCACHI, [50]),
    ...vencidas(T3, AREA.ATENCION, SUCURSAL.MIRAFLORES, 1),
  ];

  const simular = ({ cerrados = CERRADOS_DESC, filas = EVALUACIONES, ciclos = {} } = {}) => {
    mock.method(desempenoModelo, "listarCiclosCerrados", async () => cerrados);
    mock.method(desempenoModelo, "listarEvaluacionesDeCiclosCerrados", async () => filas);
    mock.method(desempenoModelo, "obtenerCiclo", async (id) => ciclos[id] ?? cerrados.find((c) => c.id_ciclo === id) ?? null);
  };

  it("sin filtros muestra el último ciclo cerrado con sus KPI contra los resultados del ciclo", async () => {
    simular();
    const tablero = await servicio.obtenerDashboard({});

    assert.equal(tablero.ciclo.id_ciclo, T3);
    assert.equal(tablero.kpis.puntaje_promedio.valor, 3.57);
    assert.equal(tablero.kpis.puntaje_promedio.semaforo, "VERDE");
    assert.equal(tablero.kpis.cumplimiento_evaluaciones.valor, 88.89);
    assert.equal(tablero.kpis.cumplimiento_evaluaciones.semaforo, "AMARILLO");
  });

  it("un ciclo elegido devuelve sus propios KPI: T1 no cumple el puntaje y T2 no cumple el cumplimiento", async () => {
    simular();
    const t1 = await servicio.obtenerDashboard({ ciclo: T1 });
    const t2 = await servicio.obtenerDashboard({ ciclo: T2 });

    assert.deepEqual(
      [t1.kpis.puntaje_promedio.valor, t1.kpis.puntaje_promedio.semaforo, t1.kpis.cumplimiento_evaluaciones.valor, t1.kpis.cumplimiento_evaluaciones.semaforo],
      [3.09, "ROJO", 90, "VERDE"],
    );
    assert.deepEqual(
      [t2.kpis.puntaje_promedio.valor, t2.kpis.puntaje_promedio.semaforo, t2.kpis.cumplimiento_evaluaciones.valor, t2.kpis.cumplimiento_evaluaciones.semaforo],
      [3.64, "VERDE", 80, "ROJO"],
    );
  });

  it("el filtro de área recalcula los KPI y el histograma pero el ranking de áreas sigue mostrando todas", async () => {
    simular();
    const tablero = await servicio.obtenerDashboard({ ciclo: T1, departamento: AREA.RRHH });

    assert.equal(tablero.kpis.puntaje_promedio.puntaje_sobre_100, 67);
    assert.equal(tablero.kpis.puntaje_promedio.valor, 3.35);
    assert.equal(tablero.kpis.cumplimiento_evaluaciones.valor, 75);
    assert.equal(tablero.histograma.total, 3);
    assert.deepEqual(
      tablero.ranking_areas.map((a) => a.nombre).sort(),
      ["Atención al cliente", "Recursos Humanos"],
    );
    assert.deepEqual(
      tablero.ranking_sucursales.map((s) => s.nombre).sort(),
      ["Miraflores", "Sopocachi"],
    );
    assert.deepEqual(
      tablero.ranking_sucursales.map((s) => s.evaluaciones_asignadas),
      [3, 1],
      "solo las evaluaciones del área elegida",
    );
  });

  it("el filtro de sucursal recalcula los KPI y limita el ranking de áreas, no el de sucursales", async () => {
    simular();
    const tablero = await servicio.obtenerDashboard({ ciclo: T1, sucursal: SUCURSAL.MIRAFLORES });

    assert.equal(tablero.kpis.puntaje_promedio.puntaje_sobre_100, 51.25);
    assert.equal(tablero.kpis.cumplimiento_evaluaciones.valor, 100);
    assert.deepEqual(
      tablero.ranking_areas.map((a) => [a.nombre, a.evaluaciones_asignadas]),
      [
        ["Atención al cliente", 3],
        ["Recursos Humanos", 1],
      ],
    );
    assert.equal(tablero.ranking_sucursales.length, 2);
  });

  it("combinar área y sucursal sin evaluaciones devuelve valores nulos en vez de un error", async () => {
    simular();
    const tablero = await servicio.obtenerDashboard({ departamento: AREA.RRHH, sucursal: SUCURSAL.MIRAFLORES });

    assert.equal(tablero.kpis.puntaje_promedio.valor, null);
    assert.equal(tablero.kpis.puntaje_promedio.semaforo, null);
    assert.equal(tablero.kpis.cumplimiento_evaluaciones.valor, null);
    assert.equal(tablero.histograma.total, 0);
  });

  it("el comparativo lista los ciclos cerrados en orden cronológico con la variación entre ellos", async () => {
    simular();
    const { comparativo_ciclos: comparativo } = await servicio.obtenerDashboard({ ciclo: T2 });

    assert.deepEqual(
      comparativo.map((c) => [c.nombre.slice(-2), c.puntaje_promedio, c.variacion, c.tendencia, c.seleccionado]),
      [
        ["T1", 3.09, null, null, false],
        ["T2", 3.64, 0.55, "SUBE", true],
        ["T3", 3.57, -0.07, "BAJA", false],
      ],
    );
  });

  it("el comparativo aplica los mismos filtros de área y sucursal a todos los ciclos", async () => {
    simular();
    const { comparativo_ciclos: comparativo } = await servicio.obtenerDashboard({ departamento: AREA.RRHH });

    assert.deepEqual(
      comparativo.map((c) => c.puntaje_promedio),
      [3.35, 2.93, 2.5],
    );
    assert.deepEqual(
      comparativo.map((c) => c.evaluaciones_asignadas),
      [4, 4, 1],
    );
  });

  it("ofrece como opciones de filtro solo las áreas y sucursales del ciclo elegido, sin aplicar los filtros", async () => {
    const soloAtencion = EVALUACIONES.filter((f) => f.id_ciclo !== T3 || f.id_departamento === AREA.ATENCION);
    simular({ filas: soloAtencion });
    const tablero = await servicio.obtenerDashboard({ departamento: AREA.ATENCION });

    assert.deepEqual(
      tablero.opciones.departamentos.map((a) => a.nombre),
      ["Atención al cliente"],
    );
    assert.deepEqual(
      tablero.opciones.sucursales.map((s) => s.nombre),
      ["Miraflores", "Sopocachi"],
    );
    assert.deepEqual(tablero.filtros, { departamento: AREA.ATENCION, sucursal: null });
  });

  it("un ciclo que no existe responde 404 y uno que aún no cerró responde 409", async () => {
    simular({ ciclos: { [ACTIVO]: { id_ciclo: ACTIVO, id_estado_ciclo: 2 } } });

    await assert.rejects(servicio.obtenerDashboard({ ciclo: uuid("c", 99) }), { estado: 404 });
    await assert.rejects(servicio.obtenerDashboard({ ciclo: ACTIVO }), { estado: 409 });
  });

  it("un filtro inválido responde 400 sin consultar la base de datos", async () => {
    simular();

    await assert.rejects(servicio.obtenerDashboard({ ciclo: "x" }), { estado: 400 });
    assert.equal(desempenoModelo.listarCiclosCerrados.mock.callCount(), 0);
  });

  it("sin ningún ciclo cerrado devuelve el tablero vacío", async () => {
    simular({ cerrados: [], filas: [] });
    const tablero = await servicio.obtenerDashboard({});

    assert.equal(tablero.ciclo, null);
    assert.equal(tablero.kpis.puntaje_promedio.valor, null);
    assert.equal(tablero.kpis.cumplimiento_evaluaciones.valor, null);
    assert.equal(tablero.histograma.total, 0);
    assert.deepEqual(tablero.ranking_areas, []);
    assert.deepEqual(tablero.ranking_sucursales, []);
    assert.deepEqual(tablero.comparativo_ciclos, []);
    assert.deepEqual(tablero.opciones, { departamentos: [], sucursales: [] });
  });

  it("incluye los datos del ciclo elegido", async () => {
    simular();
    const { ciclo } = await servicio.obtenerDashboard({ ciclo: T1 });

    assert.equal(ciclo.nombre, "Evaluación trimestral 2026-T1");
    assert.deepEqual(ciclo.periodo, { id_periodo: uuid("f", 1), nombre: "2026-T1", desde: "2026-01-01", hasta: "2026-03-31" });
    assert.equal(ciclo.cerrado_en, "2026-04-07T12:00:00.000Z");
  });
});

describe("KPI-09: porcentaje de colaboradores de alto desempeño", () => {
  const { calcularAltoDesempeno } = require("../utils/dashboardDesempeno");
  const CICLO = uuid("c", 90);
  const de = (colaborador, puntaje, estado = ENVIADA) => ({
    ...evaluacion(CICLO, AREA.ATENCION, SUCURSAL.SOPOCACHI, estado, estado === ENVIADA ? puntaje : null),
    id_empleado_evaluado: uuid("d", colaborador),
  });

  it("cuenta los colaboradores con puntaje >= 4 sobre los colaboradores evaluados", () => {
    const kpi = calcularAltoDesempeno([de(1, 80), de(2, 95), de(3, 60), de(4, 70)]);

    assert.equal(kpi.codigo, "KPI-09");
    assert.equal(kpi.colaboradores_alto_desempeno, 2);
    assert.equal(kpi.colaboradores_evaluados, 4);
    assert.equal(kpi.valor, 50);
    assert.equal(kpi.meta, 25);
    assert.equal(kpi.semaforo, "VERDE");
  });

  it("el umbral de 4 se compara en la escala de 1 a 5 que ve el usuario: 79,90 vale 4,00 y 79,89 vale 3,99", () => {
    assert.equal(calcularAltoDesempeno([de(1, 79.9)]).colaboradores_alto_desempeno, 1);
    assert.equal(calcularAltoDesempeno([de(1, 79.89)]).colaboradores_alto_desempeno, 0);
  });

  it("un colaborador con varias evaluaciones cuenta una vez, con el promedio de sus evaluaciones enviadas", () => {
    // Colaborador 1: (90 + 70) / 2 = 80 -> 4,00 (alto). Colaborador 2: (85 + 70) / 2 = 77,5 -> 3,88 (no).
    const kpi = calcularAltoDesempeno([de(1, 90), de(1, 70), de(2, 85), de(2, 70)]);

    assert.equal(kpi.colaboradores_evaluados, 2);
    assert.equal(kpi.colaboradores_alto_desempeno, 1);
    assert.equal(kpi.valor, 50);
  });

  it("las evaluaciones pendientes o vencidas no cuentan como colaboradores evaluados", () => {
    const kpi = calcularAltoDesempeno([de(1, 90), de(2, null, PENDIENTE), de(3, null, VENCIDA), de(4, 50)]);

    assert.equal(kpi.colaboradores_evaluados, 2);
    assert.equal(kpi.valor, 50);
  });

  it("semáforo: verde desde 25 %, amarillo desde 22,5 % y rojo por debajo", () => {
    // 1 de 4 = 25 %; 2 de 9 = 22,22 %; 9 de 40 = 22,5 %.
    const cohorte = (altos, total) =>
      Array.from({ length: total }, (_, i) => de(100 + i, i < altos ? 90 : 50));
    assert.equal(calcularAltoDesempeno(cohorte(1, 4)).semaforo, "VERDE");
    assert.equal(calcularAltoDesempeno(cohorte(9, 40)).semaforo, "AMARILLO");
    assert.equal(calcularAltoDesempeno(cohorte(2, 9)).semaforo, "ROJO");
  });

  it("sin colaboradores evaluados no hay valor ni semáforo", () => {
    const kpi = calcularAltoDesempeno([de(1, null, PENDIENTE)]);

    assert.equal(kpi.valor, null);
    assert.equal(kpi.semaforo, null);
  });

  it("el dashboard lo incluye en los KPI y en el comparativo, y lo recalcula con los filtros de área y sucursal", async () => {
    const A = uuid("c", 91);
    const B = uuid("c", 92);
    const cerrados = [
      { id_ciclo: B, nombre: "Ciclo B", periodo: "2026-S2", id_periodo: uuid("f", 92), periodo_desde: "2026-07-01", periodo_hasta: "2026-12-31", cerrado_en: "2026-10-12T12:00:00.000Z", id_estado_ciclo: 3 },
      { id_ciclo: A, nombre: "Ciclo A", periodo: "2026-S1", id_periodo: uuid("f", 91), periodo_desde: "2026-01-01", periodo_hasta: "2026-06-30", cerrado_en: "2026-04-07T12:00:00.000Z", id_estado_ciclo: 3 },
    ];
    const fila = (ciclo, colaborador, area, sucursal, puntaje) => ({
      ...evaluacion(ciclo, area, sucursal, ENVIADA, puntaje),
      id_empleado_evaluado: uuid("d", colaborador),
    });
    const filas = [
      fila(A, 1, AREA.ATENCION, SUCURSAL.SOPOCACHI, 50),
      fila(A, 2, AREA.ATENCION, SUCURSAL.SOPOCACHI, 60),
      fila(A, 3, AREA.RRHH, SUCURSAL.MIRAFLORES, 70),
      fila(A, 4, AREA.RRHH, SUCURSAL.MIRAFLORES, 90),
      fila(B, 1, AREA.ATENCION, SUCURSAL.SOPOCACHI, 85),
      fila(B, 2, AREA.ATENCION, SUCURSAL.SOPOCACHI, 92),
      fila(B, 3, AREA.RRHH, SUCURSAL.MIRAFLORES, 40),
      fila(B, 4, AREA.RRHH, SUCURSAL.MIRAFLORES, 81),
    ];
    mock.method(desempenoModelo, "listarCiclosCerrados", async () => cerrados);
    mock.method(desempenoModelo, "listarEvaluacionesDeCiclosCerrados", async () => filas);
    mock.method(desempenoModelo, "obtenerCiclo", async (id) => cerrados.find((c) => c.id_ciclo === id) ?? null);

    const ultimo = await servicio.obtenerDashboard({});
    assert.equal(ultimo.kpis.alto_desempeno.valor, 75);
    assert.equal(ultimo.kpis.alto_desempeno.semaforo, "VERDE");
    assert.deepEqual(ultimo.ciclo.periodo, { id_periodo: uuid("f", 92), nombre: "2026-S2", desde: "2026-07-01", hasta: "2026-12-31" });
    assert.deepEqual(
      ultimo.comparativo_ciclos.map((c) => [c.nombre, c.alto_desempeno, c.semaforo_alto_desempeno]),
      [["Ciclo A", 25, "VERDE"], ["Ciclo B", 75, "VERDE"]],
    );

    const atencionA = await servicio.obtenerDashboard({ ciclo: A, departamento: AREA.ATENCION });
    assert.equal(atencionA.kpis.alto_desempeno.valor, 0);
    assert.equal(atencionA.kpis.alto_desempeno.semaforo, "ROJO");

    const miraflores = await servicio.obtenerDashboard({ ciclo: B, sucursal: SUCURSAL.MIRAFLORES });
    assert.equal(miraflores.kpis.alto_desempeno.valor, 50);
  });
});
