import { MemoryRouter, Route, Routes } from "react-router";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorApi } from "../../api/cliente";
import { listarMisResultados, obtenerHistorialDesempeno } from "../../api/evaluaciones";
import ProveedorAvisos from "../../components/ui/ProveedorAvisos";
import { cambiarRol } from "../../context/sesion";
import { describirVariacion, posicionX } from "./formato";
import MisResultadosPage from "./MisResultadosPage";

vi.mock("../../api/evaluaciones");

const EMPLEADO = "f0000000-0000-4000-8000-000000000031";
const retro = (cambios = {}) => ({ fortalezas: null, aspectos_mejora: null, comentarios_generales: null, compromisos: [], ...cambios });

const HISTORIAL = {
  colaborador: { id_empleado: EMPLEADO, nombre_completo: "Carlos Rojas" },
  resumen: { puntaje_actual: 86.39, variacion: 14.17, promedio_historico: 79.31, cantidad_ciclos: 2 },
  evolucion: [
    { id_periodo: "p-1", nombre: "2025-S2", puntaje: 72.22, variacion: null, cantidad_ciclos: 1 },
    { id_periodo: "p-2", nombre: "2026-S1", puntaje: 86.39, variacion: 14.17, cantidad_ciclos: 1 },
  ],
  ciclos: [
    {
      id_ciclo: "c-2",
      nombre: "Evaluación de desempeño 2026-S1",
      cerrado_en: "2026-07-05T12:00:00.000Z",
      periodo: { id_periodo: "p-2", nombre: "2026-S1" },
      cantidad_evaluaciones: 2,
      puntaje_final: 86.39,
      competencias: [
        { id_competencia: "co-1", competencia: "Atención al cliente", peso_porcentual: 50, puntaje: 85 },
        { id_competencia: "co-2", competencia: "Trabajo en equipo", peso_porcentual: 30, puntaje: 90 },
      ],
      evaluaciones: [
        {
          id_evaluacion: "e-1",
          evaluador: { nombre_completo: "Marcela Quiroga" },
          puntaje_final: 87.78,
          enviada_en: "2026-07-02T19:30:00.000Z",
          retroalimentacion: retro({
            fortalezas: "Atiende con amabilidad.",
            compromisos: [{ id_compromiso: "cp-1", descripcion: "Curso de reclamos", fecha_objetivo: "2026-09-30" }],
          }),
        },
        {
          id_evaluacion: "e-2",
          evaluador: { nombre_completo: "Luis Mamani" },
          puntaje_final: 85,
          enviada_en: "2026-07-01T21:00:00.000Z",
          retroalimentacion: retro(),
        },
      ],
    },
    {
      id_ciclo: "c-1",
      nombre: "Evaluación de desempeño 2025-S2",
      cerrado_en: "2025-12-22T12:00:00.000Z",
      periodo: { id_periodo: "p-1", nombre: "2025-S2" },
      cantidad_evaluaciones: 1,
      puntaje_final: 72.22,
      competencias: [],
      evaluaciones: [],
    },
  ],
};

const abrir = () =>
  render(
    <ProveedorAvisos>
      <MemoryRouter initialEntries={["/desempeno/mis-resultados"]}>
        <Routes>
          <Route path="/desempeno/mis-resultados/:idEvaluacion?" element={<MisResultadosPage />} />
        </Routes>
      </MemoryRouter>
    </ProveedorAvisos>,
  );

beforeEach(() => {
  localStorage.setItem("rrhh.idEmpleado", EMPLEADO);
  cambiarRol("empleado");
  listarMisResultados.mockResolvedValue([]);
  obtenerHistorialDesempeno.mockResolvedValue(HISTORIAL);
});

describe("Criterio 1: puntaje final, desglose por competencia y retroalimentación de cada ciclo", () => {
  it("consulta solo su propio historial", async () => {
    abrir();
    await screen.findByRole("heading", { name: "Resultados consolidados por ciclo" });
    expect(obtenerHistorialDesempeno).toHaveBeenCalledWith(EMPLEADO, "empleado");
  });

  it("muestra el puntaje consolidado, el desglose por competencia y la retroalimentación de cada evaluador", async () => {
    abrir();
    const ciclo = within((await screen.findByRole("heading", { name: "Evaluación de desempeño 2026-S1" })).closest(".ds-tarjeta"));
    expect(ciclo.getByText("86,39")).toBeInTheDocument();
    expect(ciclo.getByText("Promedio de 2 evaluadores")).toBeInTheDocument();
    const competencias = ciclo.getByRole("table", { name: /Puntaje por competencia/ });
    expect(within(competencias).getByText("Atención al cliente")).toBeInTheDocument();
    expect(within(competencias).getByText("90")).toBeInTheDocument();
    expect(ciclo.getByText("Marcela Quiroga")).toBeInTheDocument();
    expect(ciclo.getByText("Atiende con amabilidad.")).toBeInTheDocument();
    expect(ciclo.getByText("Curso de reclamos")).toBeInTheDocument();
    expect(ciclo.getByText("El evaluador no registró comentarios cualitativos.")).toBeInTheDocument();
    expect(ciclo.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("sin ciclos cerrados lo explica", async () => {
    obtenerHistorialDesempeno.mockResolvedValue({ resumen: {}, evolucion: [], ciclos: [] });
    abrir();
    expect(await screen.findByText("Aún no tiene ciclos cerrados")).toBeInTheDocument();
  });
});

describe("Criterio 2: evolución del puntaje en un gráfico por periodo", () => {
  it("dibuja un punto por periodo con su puntaje y variación", async () => {
    abrir();
    expect(await screen.findByRole("heading", { name: "Evolución del puntaje por periodo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^2025-S2: 72,22 de 100\. Primer periodo/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^2026-S1: 86,39 de 100\. \+14,17 respecto/ })).toBeInTheDocument();
  });

  it("muestra el detalle al pasar sobre un punto y ofrece la vista de tabla", async () => {
    const usuario = userEvent.setup();
    abrir();
    await usuario.hover(await screen.findByRole("button", { name: /^2026-S1/ }));
    expect(document.querySelector(".ev-grafico__tooltip")).toHaveTextContent("2026-S1Puntaje 86,39 de 100+14,17 respecto al periodo anterior");
    await usuario.click(screen.getByRole("button", { name: "Ver como tabla" }));
    const tabla = screen.getByRole("table", { name: "Puntaje consolidado por periodo" });
    expect(within(tabla).getByText("+14,17")).toBeInTheDocument();
  });

  it("reparte los periodos en el ancho y centra uno solo", () => {
    expect(posicionX(0, 1)).toBe(50);
    expect([posicionX(0, 3), posicionX(1, 3), posicionX(2, 3)]).toEqual([8, 50, 92]);
    expect(describirVariacion(-2.5)).toBe("−2,5 respecto al periodo anterior");
  });
});

describe("Criterio 3: el servicio rechaza la consulta de otra persona (RBAC)", () => {
  it("muestra el rechazo sin ofrecer reintentar", async () => {
    obtenerHistorialDesempeno.mockRejectedValue(new ErrorApi(403, "Su rol no le permite consultar las evaluaciones de otro colaborador."));
    abrir();
    expect(await screen.findByText(/no le permite consultar/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
  });
});
