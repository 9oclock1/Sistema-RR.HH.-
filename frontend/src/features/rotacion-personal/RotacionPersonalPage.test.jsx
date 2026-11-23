import { MemoryRouter } from "react-router";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorApi } from "../../api/cliente";
import { obtenerTableroRotacion } from "../../api/rotacion";
import { getSucursales } from "../../api/sucursalesApi";
import departamentosApi from "../../api/departamentosApi";
import { fijarSesion } from "../../context/sesion";
import RotacionPersonalPage from "./RotacionPersonalPage";

vi.mock("../../api/rotacion");
vi.mock("../../api/sucursalesApi");
vi.mock("../../api/departamentosApi", () => ({ default: { listarActivas: vi.fn() } }));

const SOP = "aaaaaaaa-0000-4000-8000-000000000001";
const MIR = "aaaaaaaa-0000-4000-8000-000000000002";
const RRHH = "bbbbbbbb-0000-4000-8000-000000000002";

const kpi = (codigo, nombre, valor, estado, meta, sentido, detalle) => ({ codigo, nombre, valor, estado, meta, sentido, unidad: "%", detalle });
const tablero = (cambios = {}) => ({
  periodo: "2026-11",
  corte: "2026-11-22",
  ventana: { desde: "2025-12", hasta: "2026-11" },
  kpis: [
    kpi("KPI-10", "Tasa de rotación mensual", 3.4, "rojo", 3, "menor", { bajas: 2, plantilla_promedio: 59 }),
    kpi("KPI-11", "Tasa de retención", 91, "verde", 90, "mayor", { siguen_activos: 50, empleados_inicio: 55 }),
    kpi("KPI-12", "Rotación temprana", 15.8, "amarillo", 15, "menor", { bajas_tempranas: 3, ingresos: 19 }),
  ],
  tendencia: Array.from({ length: 12 }, (_, i) => ({
    periodo: `${i === 0 ? "2025-12" : `2026-${String(i).padStart(2, "0")}`}`,
    valor: i === 11 ? 3.4 : 1.5,
    estado: i === 11 ? "rojo" : "verde",
    bajas: 1,
    ingresos: 1,
    plantilla_promedio: 60,
  })),
  motivos: {
    total: 4,
    items: [
      { codigo: "RENUNCIA", nombre: "Renuncia voluntaria", cantidad: 2, porcentaje: 50 },
      { codigo: "CONCLUSION_CONTRATO", nombre: "Conclusión de contrato", cantidad: 1, porcentaje: 25 },
      { codigo: "DESPIDO_LEGAL", nombre: "Despido legal", cantidad: 1, porcentaje: 25 },
      { codigo: "DESAHUCIO", nombre: "Desahucio", cantidad: 0, porcentaje: 0 },
    ],
  },
  avisos: { bajas_sin_registro: 0 },
  filtros: { id_sucursal: null, id_departamento: null },
  alcance: { rol: "gerente", sucursal_fija: false },
  ...cambios,
});

const GERENTE = "cccccccc-0000-4000-8000-000000000002";
const SUPERVISOR = "cccccccc-0000-4000-8000-000000000001";
const sesionDe = (id_empleado, rol) => fijarSesion({ id_empleado, correo: `${rol}@correo.test`, rol });

const renderizar = () =>
  render(
    <MemoryRouter>
      <RotacionPersonalPage />
    </MemoryRouter>
  );

beforeEach(() => {
  sesionDe(GERENTE, "gerente");
  getSucursales.mockResolvedValue([
    { id_sucursal: SOP, nombre: "Sopocachi" },
    { id_sucursal: MIR, nombre: "Miraflores" },
  ]);
  departamentosApi.listarActivas.mockResolvedValue([{ id_departamento: RRHH, nombre: "Recursos Humanos" }]);
  obtenerTableroRotacion.mockResolvedValue(tablero());
});

describe("Dashboard de rotación de personal", () => {
  it("muestra los tres KPI con su semáforo en texto, no solo en color (criterio 1)", async () => {
    renderizar();
    const rotacion = (await screen.findByRole("heading", { name: "Tasa de rotación mensual" })).closest(".rp-kpi");
    expect(within(rotacion).getByText("3,4%")).toBeInTheDocument();
    expect(within(rotacion).getByText("No cumple la meta")).toBeInTheDocument();
    expect(within(rotacion).getByText(/Meta: ≤ 3%/)).toBeInTheDocument();
    const retencion = screen.getByRole("heading", { name: "Tasa de retención" }).closest(".rp-kpi");
    expect(within(retencion).getByText("Cumple la meta")).toBeInTheDocument();
    const temprana = screen.getByRole("heading", { name: "Rotación temprana" }).closest(".rp-kpi");
    expect(within(temprana).getByText("Cerca de la meta")).toBeInTheDocument();
    // Quién consulta va en la cookie de sesión: la página solo envía los filtros.
    expect(obtenerTableroRotacion).toHaveBeenCalledWith(expect.objectContaining({ id_sucursal: "", id_departamento: "" }));
  });

  it("al filtrar por sucursal, área o periodo vuelve a consultar (criterio 2)", async () => {
    const usuario = userEvent.setup();
    renderizar();
    await screen.findByRole("heading", { name: "Tasa de rotación mensual" });
    await screen.findByRole("option", { name: "Miraflores" });
    await usuario.selectOptions(screen.getByLabelText("Sucursal"), MIR);
    await waitFor(() => expect(obtenerTableroRotacion).toHaveBeenLastCalledWith(expect.objectContaining({ id_sucursal: MIR })));
    await usuario.selectOptions(screen.getByLabelText("Área"), RRHH);
    await waitFor(() =>
      expect(obtenerTableroRotacion).toHaveBeenLastCalledWith(expect.objectContaining({ id_sucursal: MIR, id_departamento: RRHH }))
    );
    const periodo = screen.getByLabelText("Periodo");
    await usuario.selectOptions(periodo, periodo.options[1].value);
    await waitFor(() =>
      expect(obtenerTableroRotacion).toHaveBeenLastCalledWith(expect.objectContaining({ periodo: periodo.options[1].value }))
    );
  });

  it("muestra la distribución de motivos con su porcentaje (criterio 3) y la tendencia como tabla", async () => {
    renderizar();
    expect(await screen.findByRole("img", { name: /Motivos de baja, 4 en total/ })).toBeInTheDocument();
    expect(screen.getByText("Renuncia voluntaria").closest("li")).toHaveTextContent("50%");
    expect(screen.getByRole("img", { name: /Rotación mensual de diciembre 2025 a noviembre 2026/ })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Rotación mensual de los últimos 12 meses/ })).toBeInTheDocument();
  });

  it("sin bajas en el rango muestra un estado vacío en lugar del anillo", async () => {
    obtenerTableroRotacion.mockResolvedValue(tablero({ motivos: { total: 0, items: [] } }));
    renderizar();
    expect(await screen.findByText("Sin bajas")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Motivos de baja/ })).not.toBeInTheDocument();
  });

  it("al supervisor le fija su sucursal", async () => {
    sesionDe(SUPERVISOR, "supervisor");
    obtenerTableroRotacion.mockResolvedValue(
      tablero({ filtros: { id_sucursal: SOP, id_departamento: null }, alcance: { rol: "supervisor", sucursal_fija: true } })
    );
    renderizar();
    await screen.findByRole("heading", { name: "Tasa de rotación mensual" });
    const sucursal = screen.getByLabelText("Sucursal");
    await waitFor(() => expect(sucursal).toHaveValue(SOP));
    expect(sucursal).toBeDisabled();
    expect(screen.getByText("Como supervisor, ve solo su sucursal.")).toBeInTheDocument();
  });

  it("sin sesión real pide iniciar sesión y no consulta los indicadores", async () => {
    fijarSesion(null);
    renderizar();
    expect(screen.getByText("Inicie sesión para ver la rotación de personal")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeInTheDocument();
    expect(obtenerTableroRotacion).not.toHaveBeenCalled();
  });

  it("si la sesión vence (401) vuelve a pedir inicio de sesión", async () => {
    obtenerTableroRotacion.mockRejectedValue(new ErrorApi(401, "Su sesión no es válida o venció. Inicie sesión otra vez."));
    renderizar();
    expect(await screen.findByText("Inicie sesión para ver la rotación de personal")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("avisa las bajas sin proceso registrado", async () => {
    obtenerTableroRotacion.mockResolvedValue(tablero({ avisos: { bajas_sin_registro: 2 } }));
    renderizar();
    expect(await screen.findByText(/2 colaboradores están dados de baja sin proceso/)).toBeInTheDocument();
  });

  it("sin acceso muestra el motivo y no ofrece reintentar", async () => {
    obtenerTableroRotacion.mockRejectedValue(new ErrorApi(403, "No se pudo identificar la sucursal del supervisor."));
    renderizar();
    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("Acceso restringido");
    expect(within(alerta).queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
  });

  it("si el servicio falla permite reintentar", async () => {
    const usuario = userEvent.setup();
    obtenerTableroRotacion.mockRejectedValueOnce(new ErrorApi(503, "EmployeeService no responde."));
    renderizar();
    const alerta = await screen.findByRole("alert");
    await usuario.click(within(alerta).getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("heading", { name: "Tasa de rotación mensual" })).toBeInTheDocument();
    expect(obtenerTableroRotacion).toHaveBeenCalledTimes(2);
  });
});
