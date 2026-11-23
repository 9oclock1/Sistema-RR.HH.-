// RF-72/RF-73 (KAN-506): índice de quejas (KPI-03) y minutos de atraso promedio (KPI-06) por área y sucursal.
const { describe, it, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");

const quejasModelo = require("../models/dashboardConflictividadModel");
const asistenciaExterna = require("../services/asistenciaExterna");
const servicio = require("../services/dashboardConflictividadService");
const { leerFiltros, calcularKpi03, calcularKpi06 } = require("../utils/dashboardConflictividad");
const { ErrorApp } = require("../utils/errores");

const RRHH = { idEmpleado: null, rol: "admin" };
const SUPERVISOR = "c0000000-0000-4000-8000-000000000001";
const COMO_SUPERVISOR = { idEmpleado: SUPERVISOR, rol: "supervisor" };

const empleado = (n, extra = {}) => ({
  empleado: { id_empleado: `e${n}`, sucursal: "Central", area: "Cajas", activo: true, ...extra.empleado },
  minutos_retraso: extra.minutos_retraso ?? 0,
});

describe("RF-72/RF-73 (KAN-506): dashboard de conflictividad y puntualidad", () => {
  afterEach(() => mock.restoreAll());

  describe("leerFiltros", () => {
    it("por defecto, del primer día del mes en curso a hoy", () => {
      const filtros = leerFiltros({}, new Date("2026-11-19T12:00:00Z"));
      assert.deepEqual(filtros, { desde: "2026-11-01", hasta: "2026-11-19", idSucursal: null, idDepartamento: null });
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
  });

  describe("obtenerDashboard: combina Asistencia (atrasos) y las quejas locales", () => {
    it("criterio 1: calcula KPI-03 y KPI-06 del alcance con su semáforo", async () => {
      mock.method(asistenciaExterna, "obtenerReporteAsistencia", async () => ({
        filtros: { sucursal: null },
        alcance: { tipo: "RRHH", supervisor: null },
        empleados: [empleado(1, { minutos_retraso: 20 }), empleado(2, { minutos_retraso: 10 })],
      }));
      mock.method(quejasModelo, "contarQuejasPorAreaYSucursal", async () => [
        { id_departamento: "d1", departamento: "Cajas", id_sucursal: "s1", sucursal: "Central", quejas: 1 },
      ]);

      const dashboard = await servicio.obtenerDashboard({ desde: "2026-11-01", hasta: "2026-11-19" }, RRHH);

      // KPI-03: 1 queja / 2 activos * 100 = 50 (muy por encima de la meta de 2: rojo).
      assert.deepEqual(dashboard.kpis.indice_quejas.detalle, { quejas: 1, empleados_activos: 2 });
      assert.equal(dashboard.kpis.indice_quejas.valor, 50);
      assert.equal(dashboard.kpis.indice_quejas.semaforo, "ROJO");
      // KPI-06: 30 minutos / 2 activos = 15 (justo la meta: verde).
      assert.equal(dashboard.kpis.minutos_atraso.valor, 15);
      assert.equal(dashboard.kpis.minutos_atraso.semaforo, "VERDE");
    });

    it("criterio 2: el comparativo agrupa por sucursal y área, uniendo quejas con atrasos", async () => {
      mock.method(asistenciaExterna, "obtenerReporteAsistencia", async () => ({
        filtros: { sucursal: null },
        alcance: { tipo: "RRHH", supervisor: null },
        empleados: [
          { empleado: { sucursal: "Central", area: "Cajas", activo: true }, minutos_retraso: 0 },
          { empleado: { sucursal: "Norte", area: "Ventas", activo: true }, minutos_retraso: 0 },
        ],
      }));
      mock.method(quejasModelo, "contarQuejasPorAreaYSucursal", async () => [
        { departamento: "Cajas", sucursal: "Central", quejas: 2 },
      ]);

      const dashboard = await servicio.obtenerDashboard({ desde: "2026-11-01", hasta: "2026-11-19" }, RRHH);

      assert.deepEqual(
        dashboard.comparativo.map((g) => `${g.sucursal}|${g.area}`),
        ["Central|Cajas", "Norte|Ventas"],
      );
      const central = dashboard.comparativo.find((g) => g.sucursal === "Central");
      assert.equal(central.kpi_03.detalle.quejas, 2);
      const norte = dashboard.comparativo.find((g) => g.sucursal === "Norte");
      assert.equal(norte.kpi_03.detalle.quejas, 0);
    });

    it("criterio 3: reusa la sucursal que Asistencia ya resolvió para el supervisor, para acotar las quejas", async () => {
      const llamadasQuejas = [];
      mock.method(asistenciaExterna, "obtenerReporteAsistencia", async (filtros, identidad) => {
        assert.deepEqual(identidad, COMO_SUPERVISOR);
        return {
          filtros: { sucursal: { id_sucursal: "s1", nombre: "Central" } },
          alcance: { tipo: "SUPERVISOR", supervisor: { id_empleado: SUPERVISOR, nombre_completo: "Sofía" } },
          empleados: [empleado(1)],
        };
      });
      mock.method(quejasModelo, "contarQuejasPorAreaYSucursal", async (filtros) => {
        llamadasQuejas.push(filtros);
        return [];
      });

      const dashboard = await servicio.obtenerDashboard({}, COMO_SUPERVISOR);

      assert.equal(llamadasQuejas[0].idSucursal, "s1");
      assert.deepEqual(dashboard.alcance, { tipo: "SUPERVISOR", supervisor: { id_empleado: SUPERVISOR, nombre_completo: "Sofía" } });
    });

    it("propaga el error de Asistencia (por ejemplo, un rol sin acceso) en vez de uno genérico", async () => {
      mock.method(asistenciaExterna, "obtenerReporteAsistencia", async () => {
        throw new ErrorApp(403, "Los reportes de asistencia están disponibles para RRHH y supervisores.");
      });

      await assert.rejects(servicio.obtenerDashboard({}, { idEmpleado: null, rol: "empleado" }), { estado: 403 });
    });
  });
});
