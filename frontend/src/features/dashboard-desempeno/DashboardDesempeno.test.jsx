import { MemoryRouter } from "react-router";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorApi } from "../../api/cliente";
import { obtenerDashboardDesempeno } from "../../api/dashboardDesempeno";
import ProveedorAvisos from "../../components/ui/ProveedorAvisos";
import { cambiarRol } from "../../context/sesion";
import DashboardDesempenoPage from "./DashboardDesempenoPage";
import { describirVariacion, estadoSemaforo, formatearDecimal, formatearPorcentaje, formatearRango, porcentajeEnEscala } from "./dashboardDesempeno";

vi.mock("../../api/dashboardDesempeno");

const ATENCION = "area-atencion";
const RRHH = "area-rrhh";
const SOPOCACHI = "suc-sopocachi";
const MIRAFLORES = "suc-miraflores";
const T2 = "ciclo-2";
const T3 = "ciclo-3";

const rangos = (cantidades) =>
  cantidades.map((cantidad, indice) => ({
    desde: 1 + indice * 0.5,
    hasta: 1.5 + indice * 0.5,
    etiqueta: `rango ${indice}`,
    cantidad,
    porcentaje: 0,
  }));

const puntaje = (valor, semaforoKpi, cambios = {}) => ({
  codigo: "KPI-07",
  nombre: "Puntaje promedio de desempeño",
  valor,
  escala: { minimo: 1, maximo: 5 },
  meta: 3.5,
  evaluaciones_cerradas: 8,
  puntaje_sobre_100: valor === null ? null : valor * 20,
  semaforo: semaforoKpi,
  ...cambios,
});

const cumplimiento = (valor, semaforoKpi, cambios = {}) => ({
  codigo: "KPI-08",
  nombre: "Cumplimiento de evaluaciones",
  valor,
  unidad: "%",
  meta: 90,
  evaluaciones_enviadas: 8,
  evaluaciones_asignadas: 9,
  evaluaciones_vencidas: 1,
  semaforo: semaforoKpi,
  ...cambios,
});

const grupo = (id, nombre, posicion, valor, cambios = {}) => ({
  id,
  nombre,
  posicion,
  puntaje: valor,
  puntaje_sobre_100: valor === null ? null : valor * 20,
  evaluaciones_enviadas: valor === null ? 0 : 3,
  evaluaciones_asignadas: 3,
  ...cambios,
});

const comparativo = (id, nombre, periodo, valor, variacion, tendencia, cambios = {}) => ({
  id_ciclo: id,
  nombre,
  periodo,
  cerrado_en: "2026-10-12T12:00:00.000Z",
  seleccionado: false,
  puntaje_promedio: valor,
  semaforo_puntaje: "VERDE",
  cumplimiento: 88.89,
  semaforo_cumplimiento: "AMARILLO",
  evaluaciones_enviadas: 8,
  evaluaciones_asignadas: 9,
  variacion,
  tendencia,
  ...cambios,
});

const TABLERO = {
  ciclo: {
    id_ciclo: T3,
    nombre: "Evaluación trimestral 2026-T3",
    periodo: { id_periodo: "p-3", nombre: "2026-T3" },
    cerrado_en: "2026-10-12T12:00:00.000Z",
  },
  filtros: { departamento: null, sucursal: null },
  opciones: {
    departamentos: [
      { id: ATENCION, nombre: "Atención al cliente" },
      { id: RRHH, nombre: "Recursos Humanos" },
    ],
    sucursales: [
      { id: MIRAFLORES, nombre: "Miraflores" },
      { id: SOPOCACHI, nombre: "Sopocachi" },
    ],
  },
  kpis: { puntaje_promedio: puntaje(3.57, "VERDE"), cumplimiento_evaluaciones: cumplimiento(88.89, "AMARILLO") },
  histograma: { escala: { minimo: 1, maximo: 5 }, total: 8, rangos: rangos([0, 0, 0, 3, 1, 2, 0, 2]) },
  ranking_areas: [grupo(ATENCION, "Atención al cliente", 1, 3.73), grupo(RRHH, "Recursos Humanos", 2, 2.5)],
  ranking_sucursales: [grupo(SOPOCACHI, "Sopocachi", 1, 3.97), grupo(MIRAFLORES, "Miraflores", 2, 2.92)],
  comparativo_ciclos: [
    comparativo(T2, "Evaluación trimestral 2026-T2", "2026-T2", 3.64, null, null),
    comparativo(T3, "Evaluación trimestral 2026-T3", "2026-T3", 3.57, -0.07, "BAJA", { seleccionado: true }),
  ],
};

const SIN_DATOS = {
  ...TABLERO,
  kpis: {
    puntaje_promedio: puntaje(null, null, { evaluaciones_cerradas: 0 }),
    cumplimiento_evaluaciones: cumplimiento(null, null, { evaluaciones_enviadas: 0, evaluaciones_asignadas: 0, evaluaciones_vencidas: 0 }),
  },
  histograma: { escala: { minimo: 1, maximo: 5 }, total: 0, rangos: rangos([0, 0, 0, 0, 0, 0, 0, 0]) },
  ranking_areas: [],
  ranking_sucursales: [],
};

const montar = () =>
  render(
    <MemoryRouter>
      <ProveedorAvisos>
        <DashboardDesempenoPage />
      </ProveedorAvisos>
    </MemoryRouter>,
  );

const tarjetasKpi = () => screen.getByRole("list", { name: "Indicadores del ciclo" });

describe("Dashboard de desempeño", () => {
  beforeEach(() => {
    cambiarRol("gerente");
  });

  describe("indicadores", () => {
    it("muestra el KPI-07 y el KPI-08 con su valor, su meta y su semáforo en texto", async () => {
      obtenerDashboardDesempeno.mockResolvedValue(TABLERO);
      montar();

      await screen.findByText(/Puntaje promedio de desempeño/);
      const kpis = within(tarjetasKpi());
      expect(kpis.getByText("3,57")).toBeTruthy();
      expect(kpis.getByText("88,89 %")).toBeTruthy();
      expect(kpis.getByText("Cumple la meta")).toBeTruthy();
      expect(kpis.getByText("Cerca de la meta")).toBeTruthy();
      expect(kpis.getByText("Meta: ≥ 3,50")).toBeTruthy();
      expect(kpis.getByText("Meta: ≥ 90,00 %")).toBeTruthy();
      expect(kpis.getByText("8 de 9 enviadas · 1 vencidas")).toBeTruthy();
    });

    it("un KPI que no cumple la meta se marca como «No cumple la meta»", async () => {
      obtenerDashboardDesempeno.mockResolvedValue({
        ...TABLERO,
        kpis: { puntaje_promedio: puntaje(3.09, "ROJO"), cumplimiento_evaluaciones: cumplimiento(80, "ROJO") },
      });
      montar();

      await screen.findByText("3,09");
      expect(within(tarjetasKpi()).getAllByText("No cumple la meta")).toHaveLength(2);
    });

    it("sin evaluaciones enviadas muestra guiones y «Sin datos» en vez de ceros", async () => {
      obtenerDashboardDesempeno.mockResolvedValue(SIN_DATOS);
      montar();

      await screen.findByText("Sin calificaciones para mostrar");
      const kpis = within(tarjetasKpi());
      expect(kpis.getAllByText("—")).toHaveLength(2);
      expect(kpis.getAllByText("Sin datos").length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText("Sin datos para el ranking")).toHaveLength(2);
    });
  });

  describe("histograma y rankings", () => {
    it("el histograma pinta los 8 rangos y describe cada columna para los lectores de pantalla", async () => {
      obtenerDashboardDesempeno.mockResolvedValue(TABLERO);
      montar();

      await screen.findByText(/Puntaje promedio de desempeño/);
      const histograma = screen.getByRole("list", { name: /Distribución de calificaciones/ });
      expect(within(histograma).getAllByRole("listitem")).toHaveLength(8);
      const descripciones = within(histograma).getAllByRole("img").map((el) => el.getAttribute("aria-label"));
      expect(descripciones[3]).toBe("De 2,50 a menos de 3,00: 3 evaluaciones (0,00 %)");
      expect(descripciones[7]).toBe("De 4,50 a 5,00: 2 evaluaciones (0,00 %)");
    });

    it("el ranking de áreas lista el puesto, el puntaje y marca lo que está bajo la meta con texto", async () => {
      obtenerDashboardDesempeno.mockResolvedValue(TABLERO);
      montar();

      await screen.findByText(/Puntaje promedio de desempeño/);
      const areas = within(screen.getByRole("list", { name: "Áreas ordenadas por puntaje promedio" }));
      const filas = areas.getAllByRole("listitem");
      expect(filas[0].textContent).toContain("Atención al cliente");
      expect(filas[0].textContent).toContain("3,73");
      expect(filas[0].textContent).not.toContain("Bajo la meta");
      expect(filas[1].textContent).toContain("Recursos Humanos");
      expect(filas[1].textContent).toContain("Bajo la meta");
      const sucursales = within(screen.getByRole("list", { name: "Sucursales ordenadas por puntaje promedio" }));
      expect(sucursales.getAllByRole("listitem")[0].textContent).toContain("Sopocachi");
    });
  });

  describe("comparativo entre ciclos", () => {
    it("muestra el puntaje de cada ciclo, su variación y el ciclo seleccionado", async () => {
      obtenerDashboardDesempeno.mockResolvedValue(TABLERO);
      montar();

      await screen.findByText(/Puntaje promedio de desempeño/);
      const tabla = screen.getByRole("table", { name: /Comparativo/ });
      expect(within(tabla).getAllByRole("row")).toHaveLength(3);
      expect(tabla.textContent).toContain("Primer ciclo con datos");
      expect(tabla.textContent).toContain("−0,07");
      expect(tabla.textContent).toContain("Baja");
      expect(tabla.textContent).toContain("Ciclo seleccionado");
    });
  });

  describe("filtros", () => {
    it("la primera carga no aplica filtros y pide los datos con el rol de la sesión", async () => {
      obtenerDashboardDesempeno.mockResolvedValue(TABLERO);
      montar();

      await screen.findByText(/Puntaje promedio de desempeño/);
      expect(obtenerDashboardDesempeno).toHaveBeenCalledWith("gerente", { ciclo: "", departamento: "", sucursal: "" });
      expect(screen.queryByRole("button", { name: "Limpiar filtros" })).toBeNull();
    });

    it("el selector de ciclo ofrece los ciclos cerrados del más nuevo al más antiguo y marca el actual", async () => {
      obtenerDashboardDesempeno.mockResolvedValue(TABLERO);
      montar();

      await screen.findByText(/Puntaje promedio de desempeño/);
      const selector = screen.getByLabelText("Ciclo cerrado");
      expect(selector.value).toBe(T3);
      expect([...selector.options].map((o) => o.textContent)).toEqual([
        "Evaluación trimestral 2026-T3 · 2026-T3",
        "Evaluación trimestral 2026-T2 · 2026-T2",
      ]);
    });

    it("al elegir una sucursal vuelve a pedir los datos y aparece «Limpiar filtros»", async () => {
      obtenerDashboardDesempeno.mockResolvedValue(TABLERO);
      montar();

      await screen.findByText(/Puntaje promedio de desempeño/);
      await userEvent.selectOptions(screen.getByLabelText("Sucursal"), SOPOCACHI);

      await waitFor(() =>
        expect(obtenerDashboardDesempeno).toHaveBeenLastCalledWith("gerente", { ciclo: "", departamento: "", sucursal: SOPOCACHI }),
      );
      expect(await screen.findByRole("button", { name: "Limpiar filtros" })).toBeTruthy();
    });

    it("al elegir un ciclo y un área los pide juntos y «Limpiar filtros» los quita", async () => {
      obtenerDashboardDesempeno.mockResolvedValue(TABLERO);
      montar();

      await screen.findByText(/Puntaje promedio de desempeño/);
      await userEvent.selectOptions(screen.getByLabelText("Ciclo cerrado"), T2);
      await userEvent.selectOptions(screen.getByLabelText("Área"), RRHH);
      await waitFor(() =>
        expect(obtenerDashboardDesempeno).toHaveBeenLastCalledWith("gerente", { ciclo: T2, departamento: RRHH, sucursal: "" }),
      );

      await userEvent.click(await screen.findByRole("button", { name: "Limpiar filtros" }));
      await waitFor(() =>
        expect(obtenerDashboardDesempeno).toHaveBeenLastCalledWith("gerente", { ciclo: "", departamento: "", sucursal: "" }),
      );
    });
  });

  describe("estados de la pantalla", () => {
    it("sin ciclos cerrados explica que el dashboard se calcula con ciclos terminados", async () => {
      obtenerDashboardDesempeno.mockResolvedValue({ ...TABLERO, ciclo: null, comparativo_ciclos: [] });
      montar();

      expect(await screen.findByText("Aún no hay ciclos cerrados")).toBeTruthy();
      expect(screen.queryByLabelText("Ciclo cerrado")).toBeNull();
    });

    it("si falla la carga muestra el error y permite reintentar", async () => {
      obtenerDashboardDesempeno.mockRejectedValueOnce(new ErrorApi(0, "No se pudo conectar con el servidor")).mockResolvedValue(TABLERO);
      montar();

      expect(await screen.findByText("No se pudo cargar el dashboard")).toBeTruthy();
      expect(screen.getByText("No se pudo conectar con el servidor")).toBeTruthy();

      await userEvent.click(screen.getAllByRole("button", { name: "Reintentar" })[0]);
      await screen.findByText(/Puntaje promedio de desempeño/);
      expect(screen.queryByText("No se pudo cargar el dashboard")).toBeNull();
    });

    it("«Actualizar» vuelve a pedir los datos con los filtros vigentes", async () => {
      obtenerDashboardDesempeno.mockResolvedValue(TABLERO);
      montar();

      await screen.findByText(/Puntaje promedio de desempeño/);
      const antes = obtenerDashboardDesempeno.mock.calls.length;
      await userEvent.click(screen.getByRole("button", { name: "Actualizar" }));

      await waitFor(() => expect(obtenerDashboardDesempeno.mock.calls.length).toBe(antes + 1));
    });
  });
});

describe("utilidades del dashboard", () => {
  it("formatean los números con dos decimales y coma", () => {
    expect(formatearDecimal(3.5)).toBe("3,50");
    expect(formatearDecimal(0)).toBe("0,00");
    expect(formatearDecimal(null)).toBe("—");
    expect(formatearPorcentaje(88.89)).toBe("88,89 %");
    expect(formatearPorcentaje(undefined)).toBe("—");
    expect(formatearRango({ desde: 4.5, hasta: 5 })).toBe("4,5–5,0");
  });

  it("describen la variación con signo y sin signo cuando no hay cambio", () => {
    expect(describirVariacion(0.55)).toBe("+0,55");
    expect(describirVariacion(-0.07)).toBe("−0,07");
    expect(describirVariacion(0)).toBe("0,00");
    expect(describirVariacion(null)).toBe("—");
  });

  it("traducen cada semáforo a su texto y usan «Sin datos» para lo desconocido", () => {
    expect(estadoSemaforo("VERDE").texto).toBe("Cumple la meta");
    expect(estadoSemaforo("AMARILLO").texto).toBe("Cerca de la meta");
    expect(estadoSemaforo("ROJO").texto).toBe("No cumple la meta");
    expect(estadoSemaforo(null).texto).toBe("Sin datos");
  });

  it("ubican un valor dentro de su escala sin salirse de 0 a 100 %", () => {
    expect(porcentajeEnEscala(3, 1, 5)).toBe(50);
    expect(porcentajeEnEscala(1, 1, 5)).toBe(0);
    expect(porcentajeEnEscala(7, 1, 5)).toBe(100);
    expect(porcentajeEnEscala(-2, 1, 5)).toBe(0);
    expect(porcentajeEnEscala(null, 1, 5)).toBe(0);
  });
});
