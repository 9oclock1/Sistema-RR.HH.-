// RF-72/RF-73 (KAN-506): índice de quejas (KPI-03) y minutos de atraso promedio (KPI-06) por área y sucursal.
const { describe, it, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");

const quejasModelo = require("../models/dashboardConflictividadModel");
const asistenciaExterna = require("../services/asistenciaExterna");
const empleadosExternos = require("../services/empleadosExternos");
const servicio = require("../services/dashboardConflictividadService");
const { leerFiltros, mesesDelPeriodo, calcularKpi03, calcularKpi06 } = require("../utils/dashboardConflictividad");
const { ErrorApp } = require("../utils/errores");

const RRHH = { idEmpleado: null, rol: "admin" };
const SUPERVISOR = "c0000000-0000-4000-8000-000000000001";
const COMO_SUPERVISOR = { idEmpleado: SUPERVISOR, rol: "supervisor" };
const NOVIEMBRE = { desde: "2026-11-01", hasta: "2026-11-19" };

const empleado = (n, extra = {}) => ({
  empleado: { id_empleado: `e${n}`, sucursal: "Central", area: "Cajas", activo: true, ...extra.empleado },
  minutos_retraso: extra.minutos_retraso ?? 0,
});

// Plantilla de EmployeeService (denominador de KPI-03) con la misma forma que GET /empleados.
const enPlantilla = (sucursal, area, activo = true) => ({ sucursal, area, activo });
const plantillaDe = (filas) => filas.map((f) => enPlantilla(f.empleado.sucursal, f.empleado.area, f.empleado.activo));

// Simula Asistencia, la plantilla y las quejas; devuelve lo que recibió cada una.
function simular({ asistencia, plantilla = plantillaDe(asistencia.empleados), quejas = [] }) {
  const llamadas = { asistencia: [], plantilla: [], quejas: [] };
  mock.method(asistenciaExterna, "obtenerReporteAsistencia", async (filtros, identidad) => {
    llamadas.asistencia.push({ filtros, identidad });
    return { filtros: { sucursal: null }, alcance: { tipo: "RRHH", supervisor: null }, ...asistencia };
  });
  mock.method(empleadosExternos, "listarPlantilla", async (filtros) => {
    llamadas.plantilla.push(filtros);
    return plantilla;
  });
  mock.method(quejasModelo, "contarQuejasPorAreaYSucursal", async (filtros) => {
    llamadas.quejas.push(filtros);
    return quejas;
  });
  return llamadas;
}

describe("RF-72/RF-73 (KAN-506): dashboard de conflictividad y puntualidad", () => {
  afterEach(() => mock.restoreAll());

  describe("leerFiltros", () => {
    it("por defecto, del primer día del mes en curso a hoy, con la zona horaria para el modelo", () => {
      const filtros = leerFiltros({}, new Date("2026-11-19T12:00:00Z"));
      assert.deepEqual(filtros, {
        desde: "2026-11-01",
        hasta: "2026-11-19",
        idSucursal: null,
        idDepartamento: null,
        zonaHoraria: "America/La_Paz",
      });
    });

    it("rechaza una fecha final anterior a la inicial", () => {
      assert.throws(() => leerFiltros({ desde: "2026-11-15", hasta: "2026-11-01" }), (error) => {
        assert.ok(error instanceof ErrorApp);
        assert.equal(error.estado, 400);
        return true;
      });
    });

    it("rechaza un id_sucursal que no es un UUID", () => {
      assert.throws(() => leerFiltros({ id_sucursal: "abc" }), { estado: 400 });
    });
  });

  describe("modelo de quejas", () => {
    it("convierte el periodo con la zona horaria de los filtros (con NULL no contaba ninguna queja)", async () => {
      let parametros;
      const db = { query: async (sql, params) => ((parametros = params), { rows: [] }) };
      await quejasModelo.contarQuejasPorAreaYSucursal(leerFiltros(NOVIEMBRE), db);
      assert.deepEqual(parametros, ["2026-11-01", "2026-11-19", null, null, "America/La_Paz"]);
    });
  });

  describe("fórmulas de KPI-03 y KPI-06", () => {
    it("KPI-03: 2 quejas sobre 100 activos da exactamente la meta (verde)", () => {
      const kpi = calcularKpi03({ quejas: 2, empleadosActivos: 100 });
      assert.equal(kpi.valor, 2);
      assert.equal(kpi.semaforo, "VERDE");
    });

    it("KPI-03: a menos del 10 % sobre la meta es amarillo; más, rojo", () => {
      assert.equal(calcularKpi03({ quejas: 22, empleadosActivos: 1000 }).semaforo, "AMARILLO"); // 2.2
      assert.equal(calcularKpi03({ quejas: 30, empleadosActivos: 1000 }).semaforo, "ROJO"); // 3.0
    });

    it("KPI-03: sin empleados activos, el valor queda null en vez de dividir por cero", () => {
      assert.equal(calcularKpi03({ quejas: 0, empleadosActivos: 0 }).valor, null);
    });

    it("KPI-06: 15 minutos sobre 10 empleados da la meta exacta (verde)", () => {
      const kpi = calcularKpi06({ minutosAtraso: 150, empleadosActivos: 10 });
      assert.equal(kpi.valor, 15);
      assert.equal(kpi.semaforo, "VERDE");
    });

    it("KPI-06: por encima de la meta pero a menos del 10 % es amarillo", () => {
      assert.equal(calcularKpi06({ minutosAtraso: 160, empleadosActivos: 10 }).semaforo, "AMARILLO"); // 16
      assert.equal(calcularKpi06({ minutosAtraso: 200, empleadosActivos: 10 }).semaforo, "ROJO"); // 20
    });

    it("metas mensuales: hasta 31 días se compara tal cual; un periodo más largo se lleva a su equivalente mensual", () => {
      assert.equal(mesesDelPeriodo("2026-11-01", "2026-11-19"), 1);
      assert.equal(mesesDelPeriodo("2026-10-01", "2026-10-31"), 1);
      assert.equal(mesesDelPeriodo("2026-01-01", "2026-03-31"), 2.96);
      // 40 minutos por empleado en un trimestre son ~13,5 al mes: cumple la meta de 15.
      const trimestral = calcularKpi06({ minutosAtraso: 400, empleadosActivos: 10, meses: 2.96 });
      assert.equal(trimestral.valor, 13.5);
      assert.equal(trimestral.semaforo, "VERDE");
      assert.equal(calcularKpi03({ quejas: 6, empleadosActivos: 100, meses: 3 }).valor, 2);
    });
  });

  describe("obtenerDashboard: combina Asistencia (atrasos), la plantilla y las quejas locales", () => {
    it("criterio 1: calcula KPI-03 y KPI-06 del alcance con su semáforo", async () => {
      const llamadas = simular({
        asistencia: { empleados: [empleado(1, { minutos_retraso: 20 }), empleado(2, { minutos_retraso: 10 })] },
        quejas: [{ id_departamento: "d1", departamento: "Cajas", id_sucursal: "s1", sucursal: "Central", quejas: 1 }],
      });

      const dashboard = await servicio.obtenerDashboard(NOVIEMBRE, RRHH);

      assert.equal(llamadas.quejas[0].zonaHoraria, "America/La_Paz");
      // KPI-03: 1 queja / 2 activos * 100 = 50 (muy por encima de la meta de 2: rojo).
      assert.deepEqual(dashboard.kpis.indice_quejas.detalle, { quejas: 1, empleados_activos: 2, meses_periodo: 1 });
      assert.equal(dashboard.kpis.indice_quejas.valor, 50);
      assert.equal(dashboard.kpis.indice_quejas.semaforo, "ROJO");
      // KPI-06: 30 minutos / 2 activos = 15 (justo la meta: verde).
      assert.equal(dashboard.kpis.minutos_atraso.valor, 15);
      assert.equal(dashboard.kpis.minutos_atraso.semaforo, "VERDE");
    });

    it("KPI-06 solo suma los minutos de los empleados activos", async () => {
      simular({
        asistencia: {
          empleados: [
            empleado(1, { minutos_retraso: 20 }),
            empleado(2, { minutos_retraso: 10 }),
            empleado(3, { minutos_retraso: 300, empleado: { activo: false } }),
          ],
        },
      });

      const { kpis } = await servicio.obtenerDashboard(NOVIEMBRE, RRHH);

      assert.deepEqual(kpis.minutos_atraso.detalle, { minutos_atraso: 30, empleados_activos: 2, meses_periodo: 1 });
      assert.equal(kpis.minutos_atraso.valor, 15);
      assert.equal(kpis.indice_quejas.detalle.empleados_activos, 2);
    });

    it("criterio 2: el comparativo agrupa por sucursal y área, uniendo plantilla, quejas y atrasos", async () => {
      const llamadas = simular({
        asistencia: {
          empleados: [
            { empleado: { sucursal: "Central", area: "Cajas", activo: true }, minutos_retraso: 0 },
            { empleado: { sucursal: "Norte", area: "Ventas", activo: true }, minutos_retraso: 0 },
          ],
        },
        quejas: [{ departamento: "Cajas", sucursal: "Central", quejas: 2 }],
      });

      const filtro = { ...NOVIEMBRE, id_departamento: "c0000000-0000-4000-8000-0000000000d1" };
      const dashboard = await servicio.obtenerDashboard(filtro, RRHH);

      assert.equal(llamadas.plantilla[0].idDepartamento, filtro.id_departamento);
      assert.equal(llamadas.quejas[0].idDepartamento, filtro.id_departamento);
      assert.deepEqual(
        dashboard.comparativo.map((g) => `${g.sucursal}|${g.area}`),
        ["Central|Cajas", "Norte|Ventas"],
      );
      const central = dashboard.comparativo.find((g) => g.sucursal === "Central");
      assert.equal(central.kpi_03.detalle.quejas, 2);
      const norte = dashboard.comparativo.find((g) => g.sucursal === "Norte");
      assert.equal(norte.kpi_03.detalle.quejas, 0);
    });

    it("criterio 3: el supervisor ve su sucursal, y KPI-03 usa toda la plantilla de esa sucursal, no solo sus subordinados", async () => {
      const llamadas = simular({
        asistencia: {
          filtros: { sucursal: { id_sucursal: "s1", nombre: "Central" } },
          alcance: { tipo: "SUPERVISOR", supervisor: { id_empleado: SUPERVISOR, nombre_completo: "Sofía" } },
          // Asistencia devuelve solo a quien depende del supervisor.
          empleados: [empleado(1, { minutos_retraso: 12 })],
        },
        // La sucursal tiene 4 activos (y una baja que no cuenta).
        plantilla: [
          enPlantilla("Central", "Cajas"),
          enPlantilla("Central", "Cajas"),
          enPlantilla("Central", "Cajas"),
          enPlantilla("Central", "Cajas"),
          enPlantilla("Central", "Cajas", false),
        ],
        quejas: [{ departamento: "Cajas", sucursal: "Central", quejas: 1 }],
      });

      const dashboard = await servicio.obtenerDashboard({}, COMO_SUPERVISOR);

      assert.deepEqual(llamadas.asistencia[0].identidad, COMO_SUPERVISOR);
      assert.equal(llamadas.quejas[0].idSucursal, "s1");
      assert.equal(llamadas.plantilla[0].idSucursal, "s1");
      assert.deepEqual(dashboard.alcance, { tipo: "SUPERVISOR", supervisor: { id_empleado: SUPERVISOR, nombre_completo: "Sofía" } });
      // 1 queja / 4 activos de la sucursal * 100 = 25 (antes daba 100: 1 queja / 1 subordinado).
      assert.equal(dashboard.kpis.indice_quejas.valor, 25);
      assert.equal(dashboard.kpis.minutos_atraso.valor, 12);
    });

    it("propaga el error de Asistencia (por ejemplo, un rol sin acceso) en vez de uno genérico", async () => {
      mock.method(asistenciaExterna, "obtenerReporteAsistencia", async () => {
        throw new ErrorApp(403, "Los reportes de asistencia están disponibles para RRHH y supervisores.");
      });

      await assert.rejects(servicio.obtenerDashboard({}, { idEmpleado: null, rol: "empleado" }), { estado: 403 });
    });

    it("si EmployeeService no responde, informa 503 en vez de un índice sin plantilla", async () => {
      mock.method(asistenciaExterna, "obtenerReporteAsistencia", async () => ({
        filtros: { sucursal: null },
        alcance: { tipo: "RRHH", supervisor: null },
        empleados: [],
      }));
      mock.method(quejasModelo, "contarQuejasPorAreaYSucursal", async () => []);
      mock.method(global, "fetch", async () => {
        throw new Error("connect ECONNREFUSED");
      });

      await assert.rejects(servicio.obtenerDashboard(NOVIEMBRE, RRHH), { estado: 503 });
    });
  });
});
