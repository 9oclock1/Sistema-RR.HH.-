import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorApi } from "../../api/cliente";
import { calcularSaldosProporcionales, obtenerSaldosProporcionales } from "../../api/desvinculaciones";
import SaldosProporcionalesModal from "./SaldosProporcionalesModal";

vi.mock("../../api/desvinculaciones");

const PROCESO = {
  id_proceso: "33333333-3333-3333-3333-333333333333",
  nombre_empleado: "Elena Paredes Gómez",
  causal: { nombre: "Despido legal" },
  fecha_retiro: "2026-10-15",
  estado: "INICIADO",
};

const SALDOS = {
  id_proceso: PROCESO.id_proceso,
  promedio: 6000,
  salario_diario: 200,
  aguinaldo: { gestion: 2026, desde: "2025-12-01", hasta: "2026-10-15", meses: 10, dias: 15, monto: 5250 },
  vacaciones: {
    anios_servicio: 7,
    dias_acumulados: 110,
    dias_gozados: 95,
    dias_pendientes: 15,
    monto_pendientes: 3000,
    anio_en_curso: { desde: "2026-03-01", hasta: "2026-10-15", meses: 7, dias: 15 },
    dias_escala: 20,
    dias_duodecima: 12.5,
    monto_duodecima: 2500,
  },
  total: 10750,
  observaciones: ["5 días de vacación en proceso de goce se pagan como no gozados: con el retiro ya no se gozarán."],
  calculado_en: "2026-11-23T14:00:00Z",
};

const sinCalculo = () => new ErrorApi(404, "Aún no se calcularon", [], "SALDOS_NO_CALCULADOS");

const montar = (props = {}) =>
  render(<SaldosProporcionalesModal proceso={PROCESO} identidad={{ rol: "admin" }} onCerrar={() => {}} {...props} />);

describe("KAN-77: saldos proporcionales del finiquito (pantalla)", () => {
  afterEach(() => vi.clearAllMocks());

  it("muestra el total y el desglose de aguinaldo, vacaciones no gozadas y duodécima de vacaciones", async () => {
    obtenerSaldosProporcionales.mockResolvedValue(SALDOS);
    montar();
    expect(await screen.findByText("Duodécimas de aguinaldo")).toBeInTheDocument();
    expect(screen.getByText("Vacaciones no gozadas")).toBeInTheDocument();
    expect(screen.getByText("Duodécima de vacaciones")).toBeInTheDocument();
    expect(screen.getByText(/Escala de 20 días/)).toBeInTheDocument();
    expect(screen.getByText(/15 días pendientes/)).toBeInTheDocument();
    expect(screen.getByText(/en proceso de goce/)).toBeInTheDocument();
  });

  it("el Administrador calcula cuando todavía no hay cálculo", async () => {
    obtenerSaldosProporcionales.mockRejectedValue(sinCalculo());
    calcularSaldosProporcionales.mockResolvedValue(SALDOS);
    const onCalculado = vi.fn();
    montar({ onCalculado });
    await userEvent.click(await screen.findByRole("button", { name: "Calcular saldos" }));
    expect(calcularSaldosProporcionales).toHaveBeenCalledWith(PROCESO.id_proceso, { rol: "admin" });
    expect(await screen.findByText("Duodécimas de aguinaldo")).toBeInTheDocument();
    expect(onCalculado).toHaveBeenCalled();
  });

  it("el Contador solo consulta: no ve el botón de calcular", async () => {
    obtenerSaldosProporcionales.mockRejectedValue(sinCalculo());
    montar({ identidad: { rol: "contador" }, puedeCalcular: false });
    expect(await screen.findByText(/Podrá consultarlos cuando el Administrador/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Calcular saldos" })).not.toBeInTheDocument();
  });

  it("muestra el error del cálculo, por ejemplo sin planillas cerradas", async () => {
    obtenerSaldosProporcionales.mockRejectedValue(sinCalculo());
    calcularSaldosProporcionales.mockRejectedValue(new ErrorApi(409, "El colaborador no tiene planillas cerradas hasta 2026-10."));
    montar();
    await userEvent.click(await screen.findByRole("button", { name: "Calcular saldos" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("no tiene planillas cerradas");
  });
});
