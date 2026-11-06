import { MemoryRouter, Route, Routes } from "react-router";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listarCiclosEvaluacion, listarEvaluaciones } from "../../api/evaluaciones";
import ProveedorAvisos from "../../components/ui/ProveedorAvisos";
import BandejaEvaluacionesPage from "./BandejaEvaluacionesPage";

vi.mock("../../api/evaluaciones");

const EVALUADOR = "f0000000-0000-4000-8000-000000000021";
const CICLO_S2 = "f0000000-0000-4000-8000-000000000111";
const CICLO_NUEVO = "f0000000-0000-4000-8000-000000000113";
const CICLO_S1 = "f0000000-0000-4000-8000-000000000112";

// Fechas lejanas o pasadas para que el plazo no dependa del día en que se corran las pruebas.
const futuro = "2099-12-31";
const pasado = "2020-01-15";

const progreso = (respondidas, obligatorias = 0) => ({ total: 6, respondidas, obligatorias_total: 5, obligatorias_respondidas: obligatorias });
const evaluacion = (id, nombre, cicloId, cicloNombre, fecha, estado, extra = {}) => ({
  id_evaluacion: id,
  colaborador: { id_empleado: `e-${id}`, nombre_completo: nombre, sucursal: "Sopocachi" },
  ciclo: { id_ciclo: cicloId, nombre: cicloNombre, fecha_limite: fecha },
  estado_codigo: estado,
  puntaje_final: null,
  progreso: progreso(0),
  ...extra,
});

const diego = evaluacion("ev-diego", "Diego Quispe Mamani", CICLO_NUEVO, "Evaluación de personal nuevo 2026", futuro, "PENDIENTE");
const lucia = evaluacion("ev-lucia", "Lucía Flores Choque", CICLO_S2, "Evaluación de desempeño 2026-S2", futuro, "BORRADOR", { progreso: progreso(3, 2) });
const carlos = evaluacion("ev-carlos", "Carlos Rojas Vargas", CICLO_S2, "Evaluación de desempeño 2026-S2", futuro, "PENDIENTE");
const enviada = evaluacion("ev-enviada", "Carlos Rojas Vargas", CICLO_S1, "Evaluación de desempeño 2026-S1", pasado, "ENVIADA", { puntaje_final: 87.78, progreso: progreso(5, 5) });
const vencida = evaluacion("ev-vencida", "Lucía Flores Choque", CICLO_S1, "Evaluación de desempeño 2026-S1", pasado, "VENCIDA");
const todas = [diego, lucia, carlos, enviada, vencida];

const ciclos = [
  { id_ciclo: CICLO_S2, nombre: "Evaluación de desempeño 2026-S2", fecha_limite: futuro, estado_codigo: "ACTIVO" },
  { id_ciclo: CICLO_NUEVO, nombre: "Evaluación de personal nuevo 2026", fecha_limite: futuro, estado_codigo: "ACTIVO" },
  { id_ciclo: CICLO_S1, nombre: "Evaluación de desempeño 2026-S1", fecha_limite: pasado, estado_codigo: "CERRADO" },
];

function abrir() {
  return render(
    <ProveedorAvisos>
      <MemoryRouter initialEntries={["/desempeno/evaluaciones"]}>
        <Routes>
          <Route path="/desempeno/evaluaciones/:idEvaluacion?" element={<BandejaEvaluacionesPage />} />
        </Routes>
      </MemoryRouter>
    </ProveedorAvisos>,
  );
}

const filasDeTabla = () => within(screen.getByRole("tabpanel")).getAllByRole("row").slice(1);
// Nombre de cada pestaña seguido de su contador (el espacio entre ambos es solo visual).
const pestanas = () => screen.getAllByRole("tab").map((pestana) => pestana.textContent);

beforeEach(() => {
  localStorage.setItem("rrhh.idEmpleado", EVALUADOR);
  listarEvaluaciones.mockImplementation(async (idEmpleado, { idCiclo } = {}) => (idCiclo ? todas.filter((e) => e.ciclo.id_ciclo === idCiclo) : todas));
  listarCiclosEvaluacion.mockResolvedValue(ciclos);
});

describe("Bandeja de evaluaciones: identificación", () => {
  it("sin usuario de prueba lo pide y no consulta nada", async () => {
    localStorage.clear();
    abrir();

    expect(await screen.findByText("Elija su usuario de prueba")).toBeInTheDocument();
    expect(listarEvaluaciones).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Actualizar" })).not.toBeInTheDocument();
  });

  it("consulta con el empleado elegido como evaluador", async () => {
    abrir();
    await screen.findByText("Diego Quispe Mamani");
    expect(listarEvaluaciones).toHaveBeenCalledWith(EVALUADOR, { idCiclo: "" });
    expect(listarCiclosEvaluacion).toHaveBeenCalledWith(EVALUADOR);
  });
});

describe("Criterio 1: la bandeja muestra colaborador, ciclo y fecha límite", () => {
  it("lista las evaluaciones pendientes y los borradores con sus datos", async () => {
    abrir();
    await screen.findByText("Diego Quispe Mamani");

    const filas = filasDeTabla();
    expect(filas).toHaveLength(3);
    const primera = within(filas[0]);
    expect(primera.getByText("Diego Quispe Mamani")).toBeInTheDocument();
    expect(primera.getByText("Sopocachi")).toBeInTheDocument();
    expect(primera.getByText("Evaluación de personal nuevo 2026")).toBeInTheDocument();
    expect(primera.getByText(/31 dic.* 2099/)).toBeInTheDocument();
    expect(primera.getByText(/Vence en \d+ días/)).toBeInTheDocument();
    expect(primera.getByText("Pendiente")).toBeInTheDocument();
    expect(primera.getByText("Sin respuestas")).toBeInTheDocument();

    expect(within(filas[1]).getByText("Borrador")).toBeInTheDocument();
    expect(within(filas[1]).getByText("2 de 5 obligatorias")).toBeInTheDocument();
  });

  it("las pestañas llevan el conteo de cada estado (los borradores cuentan como pendientes)", async () => {
    abrir();
    await screen.findByText("Diego Quispe Mamani");

    expect(pestanas()).toEqual(["Pendientes3", "Enviadas1", "Vencidas1", "Todas5"]);
  });

  it("Enviadas muestra el puntaje y no un plazo; Vencidas dice cuánto hace que venció", async () => {
    const usuario = userEvent.setup();
    abrir();
    await screen.findByText("Diego Quispe Mamani");

    await usuario.click(screen.getByRole("tab", { name: /Enviadas/ }));
    const filaEnviada = filasDeTabla()[0];
    expect(within(filaEnviada).getByText("Puntaje 87,78")).toBeInTheDocument();
    expect(within(filaEnviada).queryByText(/Vence|Venció/)).not.toBeInTheDocument();

    await usuario.click(screen.getByRole("tab", { name: /Vencidas/ }));
    expect(within(filasDeTabla()[0]).getByText(/Venció hace \d+ años?|Venció hace \d+ días/)).toBeInTheDocument();
  });

  it("la pestaña «Todas» muestra las 5", async () => {
    const usuario = userEvent.setup();
    abrir();
    await screen.findByText("Diego Quispe Mamani");
    await usuario.click(screen.getByRole("tab", { name: /Todas/ }));
    expect(filasDeTabla()).toHaveLength(5);
  });
});

describe("Filtro por ciclo", () => {
  it("ofrece los ciclos del evaluador y marca el cerrado", async () => {
    abrir();
    await screen.findByText("Diego Quispe Mamani");

    const selector = screen.getByLabelText("Ciclo");
    await waitFor(() => expect(selector).toBeEnabled());
    const opciones = within(selector).getAllByRole("option").map((o) => o.textContent);
    expect(opciones).toEqual([
      "Todos los ciclos",
      "Evaluación de desempeño 2026-S2",
      "Evaluación de personal nuevo 2026",
      "Evaluación de desempeño 2026-S1 (cerrado)",
    ]);
  });

  it("al elegir un ciclo pide solo ese ciclo y los conteos lo siguen", async () => {
    const usuario = userEvent.setup();
    abrir();
    await screen.findByText("Diego Quispe Mamani");
    await waitFor(() => expect(screen.getByLabelText("Ciclo")).toBeEnabled());

    await usuario.selectOptions(screen.getByLabelText("Ciclo"), CICLO_NUEVO);

    await waitFor(() => expect(filasDeTabla()).toHaveLength(1));
    expect(listarEvaluaciones).toHaveBeenLastCalledWith(EVALUADOR, { idCiclo: CICLO_NUEVO });
    expect(pestanas()).toEqual(["Pendientes1", "Enviadas0", "Vencidas0", "Todas1"]);
  });

  it("si el ciclo elegido no tiene nada en la pestaña, explica cómo seguir", async () => {
    const usuario = userEvent.setup();
    abrir();
    await screen.findByText("Diego Quispe Mamani");
    await waitFor(() => expect(screen.getByLabelText("Ciclo")).toBeEnabled());

    await usuario.selectOptions(screen.getByLabelText("Ciclo"), CICLO_NUEVO);
    await waitFor(() => expect(filasDeTabla()).toHaveLength(1));
    await usuario.click(screen.getByRole("tab", { name: /Enviadas/ }));

    expect(screen.getByText("No hay evaluaciones en esta vista")).toBeInTheDocument();
    expect(screen.getByText("Pruebe con otra pestaña u otro ciclo.")).toBeInTheDocument();
  });
});

describe("Acceso al formulario", () => {
  it("cada fila ofrece Responder, Continuar o Ver según su estado y lleva a su formulario", async () => {
    const usuario = userEvent.setup();
    abrir();
    await screen.findByText("Diego Quispe Mamani");
    await usuario.click(screen.getByRole("tab", { name: /Todas/ }));

    const enlace = (nombre) => screen.getByRole("link", { name: nombre });
    expect(enlace("Responder la evaluación de Diego Quispe Mamani")).toHaveAttribute("href", "/desempeno/evaluaciones/ev-diego");
    expect(enlace("Continuar la evaluación de Lucía Flores Choque")).toHaveAttribute("href", "/desempeno/evaluaciones/ev-lucia");
    expect(screen.getAllByRole("link", { name: /^Ver la evaluación de/ })).toHaveLength(2);
  });
});

describe("Estados de carga, vacío y error", () => {
  it("sin evaluaciones asignadas muestra un estado vacío con una explicación", async () => {
    listarEvaluaciones.mockResolvedValue([]);
    abrir();
    expect(await screen.findByText("No tiene evaluaciones pendientes")).toBeInTheDocument();
    expect(screen.getByText(/Cuando RR\.HH\. le asigne la evaluación/)).toBeInTheDocument();
  });

  it("si el servicio falla muestra el motivo y «Reintentar» vuelve a consultar", async () => {
    const usuario = userEvent.setup();
    listarEvaluaciones.mockRejectedValueOnce(new Error("Error interno del servidor"));
    abrir();

    const alerta = await screen.findByRole("alert");
    expect(within(alerta).getByText("No se pudieron cargar las evaluaciones")).toBeInTheDocument();
    expect(within(alerta).getByText("Error interno del servidor")).toBeInTheDocument();

    await usuario.click(within(alerta).getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Diego Quispe Mamani")).toBeInTheDocument();
  });

  it("si no se pueden cargar los ciclos, la tabla igual funciona (solo falta el filtro)", async () => {
    listarCiclosEvaluacion.mockRejectedValue(new Error("sin conexión"));
    abrir();
    expect(await screen.findByText("Diego Quispe Mamani")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Ciclo")).toBeEnabled());
    expect(within(screen.getByLabelText("Ciclo")).getAllByRole("option")).toHaveLength(1);
  });

  it("«Actualizar» vuelve a pedir la bandeja", async () => {
    const usuario = userEvent.setup();
    abrir();
    await screen.findByText("Diego Quispe Mamani");
    const antes = listarEvaluaciones.mock.calls.length;

    await usuario.click(screen.getByRole("button", { name: "Actualizar" }));
    await waitFor(() => expect(listarEvaluaciones.mock.calls.length).toBeGreaterThan(antes));
  });
});
