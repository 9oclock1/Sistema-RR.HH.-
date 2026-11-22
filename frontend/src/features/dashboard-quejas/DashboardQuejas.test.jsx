import { MemoryRouter } from "react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorApi } from "../../api/cliente";
import { exportarDashboardQuejas, obtenerDashboardQuejas } from "../../api/dashboardQuejas";
import ProveedorAvisos from "../../components/ui/ProveedorAvisos";
import { cambiarRol } from "../../context/sesion";
import { SECCIONES } from "../../router/modulos";
import { puedeAcceder } from "../../utils/permisos";
import DashboardQuejasPage from "./DashboardQuejasPage";
import {
  RUTA_DASHBOARD_QUEJAS,
  escalaMedidor,
  etiquetaMes,
  etiquetaMesCorta,
  formatearDias,
  hayFiltrosActivos,
  nombreArchivoPdf,
  pluralQuejas,
  validarRango,
} from "./dashboardQuejas";

vi.mock("../../api/dashboardQuejas");

const MIRAFLORES = "suc-miraflores";
const SOPOCACHI = "suc-sopocachi";

const kpiTasa = (valor, semaforo, cambios = {}) => ({
  codigo: "KPI-01",
  nombre: "Tasa de resolución de quejas",
  valor,
  unidad: "%",
  meta: 85,
  comparacion: "MAYOR_O_IGUAL",
  quejas_recibidas: 62,
  quejas_resueltas: 46,
  semaforo,
  ...cambios,
});

const kpiTiempo = (valor, semaforo, cambios = {}) => ({
  codigo: "KPI-02",
  nombre: "Tiempo promedio de resolución",
  valor,
  unidad: "días",
  meta: 10,
  comparacion: "MENOR_O_IGUAL",
  quejas_resueltas: 46,
  semaforo,
  ...cambios,
});

const mes = (clave, recibidas, resueltas, tasa, semaforoTasa, tiempo, semaforoTiempo) => ({
  mes: clave,
  quejas_recibidas: recibidas,
  quejas_resueltas: resueltas,
  tasa_resolucion: tasa,
  semaforo_tasa: semaforoTasa,
  tiempo_promedio_dias: tiempo,
  semaforo_tiempo: semaforoTiempo,
});

const grupo = (id, nombre, recibidas, resueltas, porcentaje, tasa, tiempo) => ({
  id,
  nombre,
  quejas_recibidas: recibidas,
  quejas_resueltas: resueltas,
  porcentaje_del_total: porcentaje,
  tasa_resolucion: tasa,
  tiempo_promedio_dias: tiempo,
});

const TABLERO = {
  periodo: { desde: "2026-06-01", hasta: "2026-11-22" },
  filtros: { categoria: null, sucursal: null },
  opciones: {
    categorias: [
      { id: 1, codigo: "CLIMA_LABORAL", nombre: "Clima laboral" },
      { id: 2, codigo: "ACOSO", nombre: "Acoso" },
    ],
    sucursales: [
      { id: MIRAFLORES, nombre: "Miraflores" },
      { id: SOPOCACHI, nombre: "Sopocachi" },
    ],
  },
  kpis: { tasa_resolucion: kpiTasa(74.19, "ROJO"), tiempo_promedio: kpiTiempo(8.35, "VERDE") },
  resumen: { quejas_recibidas: 62, quejas_resueltas: 46, quejas_anonimas: 14, quejas_identificadas: 48 },
  tendencia_mensual: [
    mes("2026-06", 10, 9, 90, "VERDE", 6.11, "VERDE"),
    mes("2026-07", 11, 9, 81.82, "AMARILLO", 6.78, "VERDE"),
    mes("2026-10", 1, 0, 0, "ROJO", 12.75, "ROJO"),
  ],
  por_categoria: [grupo(1, "Clima laboral", 26, 18, 41.94, 69.23, 7.17), grupo(2, "Acoso", 13, 9, 20.97, 69.23, 10.67)],
  por_area: [grupo("a1", "Atención al cliente", 40, 31, 64.52, 77.5, 8.61), grupo(null, "Sin área", 10, 7, 16.13, 70, 8)],
  por_sucursal: [grupo(MIRAFLORES, "Miraflores", 30, 23, 48.39, 76.67, 8.91)],
};

const SIN_QUEJAS = {
  ...TABLERO,
  kpis: {
    tasa_resolucion: kpiTasa(null, null, { quejas_recibidas: 0, quejas_resueltas: 0 }),
    tiempo_promedio: kpiTiempo(null, null, { quejas_resueltas: 0 }),
  },
  resumen: { quejas_recibidas: 0, quejas_resueltas: 0, quejas_anonimas: 0, quejas_identificadas: 0 },
  tendencia_mensual: [mes("2026-06", 0, 0, null, null, null, null)],
  por_categoria: [],
  por_area: [],
  por_sucursal: [],
};

const montar = () =>
  render(
    <MemoryRouter>
      <ProveedorAvisos>
        <DashboardQuejasPage />
      </ProveedorAvisos>
    </MemoryRouter>,
  );

const indicadores = () => within(screen.getByRole("list", { name: "Indicadores del periodo" }));
const esperarCarga = () => screen.findByText(/Tasa de resolución de quejas/);

describe("Dashboard de quejas internas", () => {
  beforeEach(() => {
    cambiarRol("admin");
    obtenerDashboardQuejas.mockResolvedValue(TABLERO);
  });

  describe("indicadores", () => {
    it("muestra el KPI-01 y el KPI-02 con su valor, su meta y su semáforo en texto", async () => {
      montar();
      await esperarCarga();

      expect(indicadores().getByText("74,19 %")).toBeInTheDocument();
      expect(indicadores().getByText("8,35 días")).toBeInTheDocument();
      expect(indicadores().getByText("No cumple la meta")).toBeInTheDocument();
      expect(indicadores().getByText("Cumple la meta")).toBeInTheDocument();
      expect(indicadores().getByText("Meta: ≥ 85,00 %")).toBeInTheDocument();
      expect(indicadores().getByText("Meta: ≤ 10,00 días")).toBeInTheDocument();
      expect(indicadores().getByText("46 quejas resueltas de 62 quejas recibidas")).toBeInTheDocument();
      expect(indicadores().getByText("Promedio de 46 quejas resueltas")).toBeInTheDocument();
    });

    it("el tiempo promedio que supera la meta se marca como «No cumple la meta» y el de 11 días como «Cerca de la meta»", async () => {
      obtenerDashboardQuejas.mockResolvedValue({ ...TABLERO, kpis: { tasa_resolucion: kpiTasa(80, "AMARILLO"), tiempo_promedio: kpiTiempo(12.5, "ROJO") } });
      montar();
      await esperarCarga();

      expect(indicadores().getByText("Cerca de la meta")).toBeInTheDocument();
      expect(indicadores().getByText("No cumple la meta")).toBeInTheDocument();
      expect(indicadores().getByText("12,50 días")).toBeInTheDocument();
    });

    it("el resumen muestra las quejas recibidas, resueltas, anónimas e identificadas y avisa que el anonimato se respeta", async () => {
      montar();
      await esperarCarga();

      const resumen = within(document.querySelector(".dq-resumen"));
      expect(resumen.getByText("Recibidas").nextSibling).toHaveTextContent("62");
      expect(resumen.getByText("Resueltas").nextSibling).toHaveTextContent("46");
      expect(resumen.getByText("Anónimas").nextSibling).toHaveTextContent("14");
      expect(resumen.getByText("Identificadas").nextSibling).toHaveTextContent("48");
      expect(screen.getByText(/sin identificar a quien las presentó/)).toBeInTheDocument();
    });

    it("sin quejas muestra guiones y mensajes claros en vez de ceros", async () => {
      obtenerDashboardQuejas.mockResolvedValue(SIN_QUEJAS);
      montar();

      expect(await screen.findByText("Sin quejas en el periodo")).toBeInTheDocument();
      expect(indicadores().getAllByText("—")).toHaveLength(2);
      expect(indicadores().getAllByText("Sin datos")).toHaveLength(2);
      expect(indicadores().getByText("No se recibieron quejas en el periodo con estos filtros")).toBeInTheDocument();
      expect(indicadores().getByText("No se resolvió ninguna queja en el periodo con estos filtros")).toBeInTheDocument();
      expect(screen.getByText("Sin quejas recibidas")).toBeInTheDocument();
    });
  });

  describe("tendencia mensual", () => {
    it("dibuja una columna por mes y la describe para los lectores de pantalla", async () => {
      montar();
      await esperarCarga();

      const meses = screen.getByRole("list", { name: "Quejas recibidas y resueltas por mes" });
      expect(within(meses).getAllByRole("listitem")).toHaveLength(3);
      const descripciones = within(meses).getAllByRole("img").map((el) => el.getAttribute("aria-label"));
      expect(descripciones[0]).toBe("jun 2026: 10 quejas recibidas y 9 quejas resueltas");
      expect(descripciones[2]).toBe("oct 2026: 1 queja recibidas y 0 quejas resueltas");
    });

    it("la tabla trae la tasa y el tiempo de cada mes con su semáforo en texto", async () => {
      montar();
      await esperarCarga();

      const tabla = screen.getByRole("table", { name: /Detalle mensual/ });
      const filas = within(tabla).getAllByRole("row");
      expect(filas).toHaveLength(4);
      expect(filas[1]).toHaveTextContent("jun 2026");
      expect(filas[1]).toHaveTextContent("90,00 %");
      expect(filas[1]).toHaveTextContent("6,11 días");
      expect(filas[2]).toHaveTextContent("81,82 %");
      expect(filas[2]).toHaveTextContent("Cerca de la meta");
      expect(filas[3]).toHaveTextContent("No cumple");
    });
  });

  describe("incidencia por categoría, área y sucursal", () => {
    it("empieza por las categorías, de más a menos quejas, con su detalle", async () => {
      montar();
      await esperarCarga();

      const categorias = screen.getByRole("list", { name: "Quejas por categoría" });
      const filas = within(categorias).getAllByRole("listitem");
      expect(filas[0]).toHaveTextContent("Clima laboral");
      expect(filas[0]).toHaveTextContent("26");
      expect(filas[0]).toHaveTextContent("41,94 % del total");
      expect(filas[0]).toHaveTextContent("Resueltas: 18 · Tasa: 69,23 % · Tiempo: 7,17 días");
      expect(filas[1]).toHaveTextContent("Acoso");
    });

    it("las pestañas cambian entre categorías, áreas y sucursales", async () => {
      const usuario = userEvent.setup();
      montar();
      await esperarCarga();

      await usuario.click(screen.getByRole("tab", { name: "Áreas" }));
      const areas = screen.getByRole("list", { name: "Quejas por área" });
      expect(within(areas).getAllByRole("listitem")[0]).toHaveTextContent("Atención al cliente");
      expect(within(areas).getAllByRole("listitem")[1]).toHaveTextContent("Sin área");

      await usuario.click(screen.getByRole("tab", { name: "Sucursales" }));
      expect(within(screen.getByRole("list", { name: "Quejas por sucursal" })).getByText("Miraflores")).toBeInTheDocument();
    });
  });

  describe("filtros", () => {
    it("la primera carga pide los datos sin filtros y con el rol de la sesión, y muestra el periodo que aplicó el servidor", async () => {
      montar();
      await esperarCarga();

      expect(obtenerDashboardQuejas).toHaveBeenCalledWith("admin", { desde: "", hasta: "", categoria: "", sucursal: "" });
      expect(screen.getByLabelText("Desde")).toHaveValue("2026-06-01");
      expect(screen.getByLabelText("Hasta")).toHaveValue("2026-11-22");
      expect(screen.queryByRole("button", { name: "Limpiar filtros" })).toBeNull();
    });

    it("ofrece las categorías y las sucursales, incluida «Sin sucursal»", async () => {
      montar();
      await esperarCarga();

      expect([...screen.getByLabelText("Categoría").options].map((o) => o.textContent)).toEqual(["Todas las categorías", "Clima laboral", "Acoso"]);
      expect([...screen.getByLabelText("Sucursal").options].map((o) => o.textContent)).toEqual([
        "Todas las sucursales",
        "Sin sucursal",
        "Miraflores",
        "Sopocachi",
      ]);
    });

    it("al elegir una categoría y una sucursal vuelve a pedir los datos con esos filtros", async () => {
      const usuario = userEvent.setup();
      montar();
      await esperarCarga();

      await usuario.selectOptions(screen.getByLabelText("Categoría"), "2");
      await usuario.selectOptions(screen.getByLabelText("Sucursal"), SOPOCACHI);

      await waitFor(() =>
        expect(obtenerDashboardQuejas).toHaveBeenLastCalledWith("admin", { desde: "", hasta: "", categoria: "2", sucursal: SOPOCACHI }),
      );
      expect(await screen.findByRole("button", { name: "Limpiar filtros" })).toBeInTheDocument();
    });

    it("«Sin sucursal» envía el valor «sin»", async () => {
      const usuario = userEvent.setup();
      montar();
      await esperarCarga();

      await usuario.selectOptions(screen.getByLabelText("Sucursal"), "sin");

      await waitFor(() => expect(obtenerDashboardQuejas).toHaveBeenLastCalledWith("admin", { desde: "", hasta: "", categoria: "", sucursal: "sin" }));
    });

    it("al cambiar las fechas pide el periodo elegido", async () => {
      montar();
      await esperarCarga();

      fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-08-01" } });

      await waitFor(() =>
        expect(obtenerDashboardQuejas).toHaveBeenLastCalledWith("admin", expect.objectContaining({ desde: "2026-08-01" })),
      );
    });

    it("una fecha final anterior a la inicial muestra el error y no consulta al servidor", async () => {
      montar();
      await esperarCarga();
      fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-08-01" } });
      await waitFor(() => expect(obtenerDashboardQuejas).toHaveBeenLastCalledWith("admin", expect.objectContaining({ desde: "2026-08-01" })));
      const llamadas = obtenerDashboardQuejas.mock.calls.length;

      fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-05-01" } });

      expect(await screen.findByText("La fecha final no puede ser anterior a la inicial.")).toBeInTheDocument();
      expect(obtenerDashboardQuejas.mock.calls.length).toBe(llamadas);
      expect(screen.getByRole("button", { name: "Exportar PDF" })).toBeDisabled();
    });

    it("«Limpiar filtros» vuelve al periodo por defecto sin categoría ni sucursal", async () => {
      const usuario = userEvent.setup();
      montar();
      await esperarCarga();
      await usuario.selectOptions(screen.getByLabelText("Categoría"), "1");
      await usuario.click(await screen.findByRole("button", { name: "Limpiar filtros" }));

      await waitFor(() => expect(obtenerDashboardQuejas).toHaveBeenLastCalledWith("admin", { desde: "", hasta: "", categoria: "", sucursal: "" }));
      expect(screen.getByLabelText("Categoría")).toHaveValue("");
    });
  });

  describe("exportación a PDF", () => {
    beforeEach(() => {
      URL.createObjectURL = vi.fn(() => "blob:dashboard");
      URL.revokeObjectURL = vi.fn();
      exportarDashboardQuejas.mockResolvedValue(new Blob(["%PDF-1.7"], { type: "application/pdf" }));
    });

    it("exporta con los mismos filtros de la pantalla y confirma la descarga", async () => {
      const usuario = userEvent.setup();
      montar();
      await esperarCarga();
      await usuario.selectOptions(screen.getByLabelText("Categoría"), "1");
      await waitFor(() => expect(screen.getByRole("button", { name: "Exportar PDF" })).toBeEnabled());
      await usuario.click(screen.getByRole("button", { name: "Exportar PDF" }));

      await waitFor(() =>
        expect(exportarDashboardQuejas).toHaveBeenCalledWith("admin", { desde: "", hasta: "", categoria: "1", sucursal: "" }),
      );
      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(await screen.findByText("Dashboard exportado")).toBeInTheDocument();
    });

    it("si falla la generación muestra el error en la pantalla sin perder los datos", async () => {
      exportarDashboardQuejas.mockRejectedValue(new ErrorApi(500, "Error al descargar el archivo"));
      const usuario = userEvent.setup();
      montar();
      await esperarCarga();
      await usuario.click(screen.getByRole("button", { name: "Exportar PDF" }));

      expect(await screen.findByText("No se pudo exportar el dashboard")).toBeInTheDocument();
      expect(screen.getByText("No se pudo generar el PDF. Intente nuevamente.")).toBeInTheDocument();
      expect(indicadores().getByText("74,19 %")).toBeInTheDocument();
    });

    it("si el rol ya no tiene permiso lo dice con el mensaje del permiso", async () => {
      exportarDashboardQuejas.mockRejectedValue(new ErrorApi(403, "Error al descargar el archivo"));
      const usuario = userEvent.setup();
      montar();
      await esperarCarga();
      await usuario.click(screen.getByRole("button", { name: "Exportar PDF" }));

      expect(await screen.findByText("Solo el Administrador de RRHH puede consultar el dashboard de quejas.")).toBeInTheDocument();
    });
  });

  describe("estados de la pantalla", () => {
    it("si falla la carga muestra el error y permite reintentar", async () => {
      obtenerDashboardQuejas.mockRejectedValueOnce(new ErrorApi(0, "No se pudo conectar con el servidor")).mockResolvedValue(TABLERO);
      const usuario = userEvent.setup();
      montar();

      expect(await screen.findByText("No se pudo cargar el dashboard")).toBeInTheDocument();
      expect(screen.getByText("No se pudo conectar con el servidor")).toBeInTheDocument();
      await usuario.click(screen.getAllByRole("button", { name: "Reintentar" })[0]);

      await esperarCarga();
      expect(screen.queryByText("No se pudo cargar el dashboard")).toBeNull();
    });

    it("sin permiso explica quién puede verlo y no ofrece reintentar", async () => {
      obtenerDashboardQuejas.mockRejectedValue(new ErrorApi(403, "Solo el Administrador de RRHH puede consultar el dashboard de quejas."));
      montar();

      expect(await screen.findByText("Acceso restringido")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
    });

    it("«Actualizar» vuelve a pedir los datos con los filtros vigentes", async () => {
      const usuario = userEvent.setup();
      montar();
      await esperarCarga();
      const antes = obtenerDashboardQuejas.mock.calls.length;

      await usuario.click(screen.getByRole("button", { name: "Actualizar" }));

      await waitFor(() => expect(obtenerDashboardQuejas.mock.calls.length).toBe(antes + 1));
    });
  });
});

describe("módulo de dashboards", () => {
  const modulos = SECCIONES.flatMap((seccion) => seccion.modulos.map((modulo) => ({ ...modulo, seccion: seccion.titulo })));
  const modulo = modulos.find((m) => m.ruta === RUTA_DASHBOARD_QUEJAS);

  it("el dashboard de quejas está en la sección Dashboards y solo lo ve el Administrador de RRHH", () => {
    expect(modulo.seccion).toBe("Dashboards");
    expect(puedeAcceder("admin", modulo.roles)).toBe(true);
    for (const rol of ["gerente", "auditor", "supervisor", "reclutador", "empleado"]) {
      expect(puedeAcceder(rol, modulo.roles)).toBe(false);
    }
  });

  it("ninguna ruta de los módulos es prefijo de otra, para que la barra lateral no marque dos a la vez", () => {
    const rutas = modulos.map((m) => m.ruta);
    for (const ruta of rutas) {
      expect(rutas.filter((otra) => otra !== ruta && otra.startsWith(`${ruta}/`))).toEqual([]);
    }
    expect(new Set(rutas).size).toBe(rutas.length);
  });
});

describe("utilidades del dashboard de quejas", () => {
  it("dan formato a los días con dos decimales y coma", () => {
    expect(formatearDias(8.35)).toBe("8,35 días");
    expect(formatearDias(10)).toBe("10,00 días");
    expect(formatearDias(null)).toBe("—");
  });

  it("nombran los meses en español, completos y abreviados", () => {
    expect(etiquetaMes("2026-06")).toBe("jun 2026");
    expect(etiquetaMes("2026-12")).toBe("dic 2026");
    expect(etiquetaMesCorta("2026-01")).toBe("ene 26");
  });

  it("validan que la fecha final no sea anterior a la inicial", () => {
    expect(validarRango({ desde: "2026-06-01", hasta: "2026-05-31" })).toEqual({ hasta: "La fecha final no puede ser anterior a la inicial." });
    expect(validarRango({ desde: "2026-06-01", hasta: "2026-06-01" })).toEqual({});
    expect(validarRango({ desde: "", hasta: "2026-06-01" })).toEqual({});
  });

  it("detectan los filtros activos, arman el nombre del archivo y conjugan «queja»", () => {
    expect(hayFiltrosActivos({ desde: "", hasta: "", categoria: "", sucursal: "" })).toBe(false);
    expect(hayFiltrosActivos({ desde: "", hasta: "", categoria: "2", sucursal: "" })).toBe(true);
    expect(nombreArchivoPdf({ desde: "2026-06-01", hasta: "2026-11-22" })).toBe("dashboard-quejas-2026-06-01_2026-11-22.pdf");
    expect(pluralQuejas(1)).toBe("1 queja");
    expect(pluralQuejas(0)).toBe("0 quejas");
    expect(pluralQuejas(5)).toBe("5 quejas");
  });

  it("la escala del medidor deja la meta en el centro cuando el valor es menor y crece si la supera", () => {
    expect(escalaMedidor(8, 10)).toBe(20);
    expect(escalaMedidor(35, 10)).toBe(35);
    expect(escalaMedidor(null, 10)).toBe(20);
    expect(escalaMedidor(74, 85, 100)).toBe(100);
  });
});
