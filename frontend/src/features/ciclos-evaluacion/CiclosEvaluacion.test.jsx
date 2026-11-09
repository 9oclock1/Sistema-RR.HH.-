import { MemoryRouter, Route, Routes } from "react-router";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  crearCiclo,
  listarAreasCiclo,
  listarCiclos,
  listarColaboradoresCiclo,
  listarOpcionesCiclo,
  listarSucursalesCiclo,
  obtenerCiclo,
  previsualizarAsignaciones,
} from "../../api/ciclosEvaluacion";
import { ErrorApi } from "../../api/cliente";
import ProveedorAvisos from "../../components/ui/ProveedorAvisos";
import { cambiarUsuario } from "../../context/sesion";
import CiclosEvaluacionPage from "./CiclosEvaluacionPage";

vi.mock("../../api/ciclosEvaluacion");

// El recorrido completo del asistente escribe en varios campos: se deja margen para equipos con carga.
vi.setConfig({ testTimeout: 15000 });

const ADMIN = "f0000000-0000-4000-8000-000000000023";
const AREA1 = "a1";
const AREA2 = "a2";
const SUC1 = "s1";
const VERSION = "v1";
const PERIODO = "p1";

const opciones = {
  versiones: [
    {
      id_version: VERSION,
      numero_version: 1,
      plantilla: "Evaluación de personal de tienda",
      id_departamento_destino: AREA1,
      area: "Atención al cliente",
      vigencia_desde: "2026-01-01",
      vigencia_hasta: "2026-12-31",
      publicada_en: "2026-01-10T13:00:00.000Z",
    },
  ],
  periodos: [{ id_periodo: PERIODO, nombre: "2026-S2", fecha_inicio: "2026-07-01", fecha_fin: "2026-12-31" }],
};
const empleado = (id, nombre, area, suc) => ({
  id_empleado: id,
  nombre_completo: nombre,
  cargo: "Cajero",
  id_departamento: area,
  area: area === AREA1 ? "Atención al cliente" : "Recursos Humanos",
  id_sucursal: suc,
  sucursal: "Sopocachi",
  activo: true,
});
const empleados = [
  empleado("e1", "Beto Cajero", AREA1, SUC1),
  empleado("e2", "Carla Cajera", AREA1, SUC1),
  empleado("e3", "Gabo OtraArea", AREA2, SUC1),
];
const vistaPrevia = {
  total: 2,
  asignaciones: [
    {
      evaluado: { id_empleado: "e1", nombre_completo: "Beto Cajero", cargo: "Cajero", area: "Atención al cliente", sucursal: "Sopocachi" },
      evaluador: { id_empleado: "j1", nombre_completo: "Ana Jefa", cargo: "Jefe de tienda" },
    },
    {
      evaluado: { id_empleado: "e2", nombre_completo: "Carla Cajera", cargo: "Cajero", area: "Atención al cliente", sucursal: "Sopocachi" },
      evaluador: { id_empleado: "j1", nombre_completo: "Ana Jefa", cargo: "Jefe de tienda" },
    },
  ],
  omitidos: [{ id_empleado: "e9", nombre_completo: "Dani Cajero", codigo: "SIN_EVALUADOR_EN_SUCURSAL", motivo: "Nadie ocupa el cargo superior «Jefe de tienda» en su sucursal." }],
  advertencias: [],
};

function abrir(ruta = "/desempeno/ciclos/nuevo") {
  return render(
    <ProveedorAvisos>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/desempeno/ciclos/:idCiclo?" element={<CiclosEvaluacionPage />} />
        </Routes>
      </MemoryRouter>
    </ProveedorAvisos>,
  );
}

const siguiente = (usuario) => usuario.click(screen.getByRole("button", { name: "Siguiente" }));

beforeEach(() => {
  vi.resetAllMocks();
  cambiarUsuario(ADMIN);
  listarOpcionesCiclo.mockResolvedValue(opciones);
  listarAreasCiclo.mockResolvedValue([
    { id_departamento: AREA1, nombre: "Atención al cliente" },
    { id_departamento: AREA2, nombre: "Recursos Humanos" },
  ]);
  listarSucursalesCiclo.mockResolvedValue([{ id_sucursal: SUC1, nombre: "Sopocachi" }]);
  listarColaboradoresCiclo.mockResolvedValue(empleados);
  previsualizarAsignaciones.mockResolvedValue(vistaPrevia);
});

describe("asistente de programación", () => {
  it("recorre los 4 pasos y programa el ciclo", async () => {
    const usuario = userEvent.setup();
    crearCiclo.mockResolvedValue({ ciclo: { id_ciclo: "c1", nombre: "Ciclo prueba" }, total_asignaciones: 2, omitidos: [], advertencias: [] });
    obtenerCiclo.mockResolvedValue({
      id_ciclo: "c1", nombre: "Ciclo prueba", estado_codigo: "PROGRAMADO", plantilla: "X", numero_version: 1, periodo: "2026-S2",
      fecha_inicio: "2099-01-01", fecha_limite: "2099-02-01", total: 2, pendientes: 2, en_borrador: 0, enviadas: 0, vencidas: 0, asignaciones: [],
    });
    abrir();

    // Paso 1
    expect(await screen.findByRole("heading", { name: "Elija la plantilla y el periodo" })).toBeInTheDocument();
    await siguiente(usuario);
    expect(screen.getByText("Seleccione la plantilla publicada que se usará.")).toBeInTheDocument();
    expect(screen.getByText("Seleccione el periodo de evaluación.")).toBeInTheDocument();
    await usuario.selectOptions(screen.getByLabelText(/Plantilla publicada/), VERSION);
    expect(screen.getByRole("list", { hidden: true, name: "Pasos del asistente" })).toBeInTheDocument();
    expect(screen.getByText("Atención al cliente")).toBeInTheDocument(); // área destino
    await usuario.selectOptions(screen.getByLabelText(/Periodo de evaluación/), PERIODO);
    await siguiente(usuario);

    // Paso 2: validaciones
    expect(screen.getByRole("heading", { name: "Indique el nombre y las fechas" })).toBeInTheDocument();
    await siguiente(usuario);
    expect(screen.getByText(/Ingrese un nombre de hasta 120/)).toBeInTheDocument();
    expect(screen.getByText("Ingrese la fecha de inicio.")).toBeInTheDocument();
    await usuario.type(screen.getByLabelText(/Nombre del ciclo/), "Ciclo prueba");
    await usuario.type(screen.getByLabelText(/Fecha de inicio/), "2020-01-01");
    await usuario.type(screen.getByLabelText(/Fecha límite/), "2099-02-01");
    await siguiente(usuario);
    expect(screen.getByText("La fecha de inicio no puede ser anterior a hoy.")).toBeInTheDocument();
    await usuario.clear(screen.getByLabelText(/Fecha de inicio/));
    await usuario.type(screen.getByLabelText(/Fecha de inicio/), "2099-01-01");
    await siguiente(usuario);

    // Paso 3: el área de la plantilla viene marcada
    expect(screen.getByRole("heading", { name: "Elija a quiénes se evalúa" })).toBeInTheDocument();
    expect(screen.getByLabelText("Atención al cliente")).toBeChecked();
    expect(screen.getByLabelText("Recursos Humanos")).not.toBeChecked();
    expect(screen.getByText(/2 colaboradores activos/)).toBeInTheDocument();
    // Sumar un colaborador de otra área avisa pero no bloquea
    await usuario.click(screen.getByLabelText(/Gabo OtraArea/));
    expect(screen.getByText("Hay colaboradores de otra área")).toBeInTheDocument();
    expect(screen.getByText(/3 colaboradores activos/)).toBeInTheDocument();
    await usuario.click(screen.getByLabelText(/Gabo OtraArea/));
    // Buscar
    await usuario.type(screen.getByLabelText("Buscar colaborador"), "carla");
    expect(screen.queryByLabelText(/Beto Cajero/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Carla Cajera/)).toBeInTheDocument();
    await siguiente(usuario);

    // Paso 4: vista previa
    expect(await screen.findByRole("heading", { name: "Revise y programe el ciclo" })).toBeInTheDocument();
    expect(await screen.findByText("Beto Cajero")).toBeInTheDocument();
    expect(screen.getAllByText("Ana Jefa")).toHaveLength(2);
    expect(screen.getByText("1 colaborador no se evaluará en este ciclo")).toBeInTheDocument();
    expect(previsualizarAsignaciones).toHaveBeenCalledWith(
      { rol: "admin", idEmpleado: ADMIN },
      { idVersion: VERSION, alcance: { areas: [AREA1], sucursales: [], colaboradores: [] } },
    );
    const programar = screen.getByRole("button", { name: "Programar ciclo" });
    await waitFor(() => expect(programar).toBeEnabled());
    await usuario.click(programar);

    expect(crearCiclo).toHaveBeenCalledWith(
      { rol: "admin", idEmpleado: ADMIN },
      { idVersion: VERSION, idPeriodo: PERIODO, nombre: "Ciclo prueba", fechaInicio: "2099-01-01", fechaLimite: "2099-02-01", alcance: { areas: [AREA1], sucursales: [], colaboradores: [] } },
    );
    // Navega al detalle del ciclo creado
    expect(await screen.findByRole("heading", { name: "Ciclo prueba", level: 1 })).toBeInTheDocument();
  });

  it("no deja programar si el alcance no genera asignaciones", async () => {
    const usuario = userEvent.setup();
    previsualizarAsignaciones.mockResolvedValue({ total: 0, asignaciones: [], omitidos: [], advertencias: [] });
    abrir();
    await screen.findByRole("heading", { name: "Elija la plantilla y el periodo" });
    await usuario.selectOptions(screen.getByLabelText(/Plantilla publicada/), VERSION);
    await usuario.selectOptions(screen.getByLabelText(/Periodo de evaluación/), PERIODO);
    await siguiente(usuario);
    await usuario.type(screen.getByLabelText(/Nombre del ciclo/), "Ciclo vacío");
    await usuario.type(screen.getByLabelText(/Fecha de inicio/), "2099-01-01");
    await usuario.type(screen.getByLabelText(/Fecha límite/), "2099-02-01");
    await siguiente(usuario);
    await usuario.click(screen.getByLabelText("Atención al cliente")); // quita el área de partida
    await siguiente(usuario);
    expect(screen.getByText("Seleccione al menos un área, una sucursal o un colaborador.")).toBeInTheDocument();
    await usuario.click(screen.getByLabelText("Recursos Humanos"));
    await siguiente(usuario);
    expect(await screen.findByText("El alcance elegido no genera ninguna asignación")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Programar ciclo" })).toBeDisabled();
  });

  it("si el servidor rechaza el nombre repetido vuelve al paso de fechas con el error", async () => {
    const usuario = userEvent.setup();
    crearCiclo.mockRejectedValue(new ErrorApi(409, "Ya existe un ciclo «Ciclo prueba» en ese periodo.", [{ campo: "nombre", mensaje: "Elija otro nombre o escoja otro periodo." }]));
    abrir();
    await screen.findByRole("heading", { name: "Elija la plantilla y el periodo" });
    await usuario.selectOptions(screen.getByLabelText(/Plantilla publicada/), VERSION);
    await usuario.selectOptions(screen.getByLabelText(/Periodo de evaluación/), PERIODO);
    await siguiente(usuario);
    await usuario.type(screen.getByLabelText(/Nombre del ciclo/), "Ciclo prueba");
    await usuario.type(screen.getByLabelText(/Fecha de inicio/), "2099-01-01");
    await usuario.type(screen.getByLabelText(/Fecha límite/), "2099-02-01");
    await siguiente(usuario);
    await siguiente(usuario);
    const programar = await screen.findByRole("button", { name: "Programar ciclo" });
    await waitFor(() => expect(programar).toBeEnabled());
    await usuario.click(programar);
    expect(await screen.findByRole("heading", { name: "Indique el nombre y las fechas" })).toBeInTheDocument();
    expect(screen.getByText("Elija otro nombre o escoja otro periodo.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Ya existe un ciclo «Ciclo prueba» en ese periodo.");
  });

  it("sin usuario de prueba no permite programar", async () => {
    cambiarUsuario(null);
    abrir();
    expect(await screen.findByText("Elija su usuario de prueba")).toBeInTheDocument();
  });
});

describe("lista y detalle", () => {
  const ciclo = (extra = {}) => ({
    id_ciclo: "c1", nombre: "Ciclo prueba", estado_codigo: "ACTIVO", plantilla: "Plantilla", numero_version: 1, periodo: "2026-S2",
    fecha_inicio: "2026-11-01", fecha_limite: "2099-02-01", total: 4, pendientes: 1, en_borrador: 1, enviadas: 2, vencidas: 0, ...extra,
  });

  it("lista los ciclos y filtra por estado", async () => {
    const usuario = userEvent.setup();
    listarCiclos.mockResolvedValue([ciclo(), ciclo({ id_ciclo: "c2", nombre: "Ciclo viejo", estado_codigo: "CERRADO", vencidas: 2 })]);
    abrir("/desempeno/ciclos");
    expect(await screen.findByText("Ciclo prueba")).toBeInTheDocument();
    expect(screen.getByText("Ciclo viejo")).toBeInTheDocument();
    expect(screen.getAllByText("2 de 4 enviadas", { exact: false })).toHaveLength(2);
    await usuario.selectOptions(screen.getByLabelText("Estado"), "CERRADO");
    expect(screen.queryByText("Ciclo prueba")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Programar ciclo" })).toHaveAttribute("href", "/desempeno/ciclos/nuevo");
  });

  it("muestra el detalle con sus asignaciones", async () => {
    obtenerCiclo.mockResolvedValue({
      ...ciclo({ estado_codigo: "CERRADO", cerrado_en: "2026-11-08T04:00:00.000Z" }),
      asignaciones: [
        { id_evaluacion: "ev1", evaluado: { nombre_completo: "Beto Cajero" }, evaluador: { nombre_completo: "Ana Jefa" }, area: "Atención", sucursal: "Sopocachi", estado_codigo: "VENCIDA", estado_nombre: "Vencida", recordatorio_enviado_en: "2026-11-05T12:00:00.000Z" },
      ],
    });
    abrir("/desempeno/ciclos/c1");
    expect(await screen.findByRole("heading", { name: "Ciclo prueba", level: 1 })).toBeInTheDocument();
    const fila = screen.getAllByRole("row")[1];
    expect(within(fila).getByText("Beto Cajero")).toBeInTheDocument();
    expect(within(fila).getByText("Vencida")).toBeInTheDocument();
  });

  it("avisa cuando el ciclo no existe", async () => {
    obtenerCiclo.mockRejectedValue(new ErrorApi(404, "Ciclo de evaluación no encontrado"));
    abrir("/desempeno/ciclos/zzz");
    expect(await screen.findByText("No se encontró el ciclo")).toBeInTheDocument();
  });
});
