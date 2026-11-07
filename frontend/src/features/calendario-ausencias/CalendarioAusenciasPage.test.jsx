// KAN-55 (RF-35), QA de la pantalla «Calendario de ausencias». Requiere el Vitest que trae KAN-54 (npm test).
import { MemoryRouter } from "react-router";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  consultarCalendarioAusencias,
  eliminarUmbralCobertura,
  guardarUmbralCobertura,
  listarUmbralesCobertura,
  obtenerAlcanceCalendario,
} from "../../api/calendarioAusencias";
import ProveedorAvisos from "../../components/ui/ProveedorAvisos";
import { cambiarRol } from "../../context/sesion";
import { guardarEmpleado, olvidarEmpleado } from "../marcaje/sesionEmpleado";
import CalendarioAusenciasPage from "./CalendarioAusenciasPage";
import { diasDelRango } from "./calendario";

vi.mock("../../api/calendarioAusencias");
vi.mock("../../api/marcajes", () => ({
  consultarJornada: vi.fn(async () => ({ empleado: { nombres: "Luis", apellidos: "Rojas" } })),
}));

const SUC = "11111111-1111-4111-8111-111111111111";
const PAN = "22222222-2222-4222-8222-222222222222";
const CAJ = "33333333-3333-4333-8333-333333333333";
const SUPERVISOR = "cb7995a6-4b23-4738-ab8b-37d0b203d73b";

const TIPOS = [
  { codigo: "VACACIONES", nombre: "Vacaciones", categoria: "VACACIONES" },
  { codigo: "MEDICA", nombre: "Licencia médica", categoria: "LICENCIA" },
  { codigo: "PERSONAL", nombre: "Permiso personal", categoria: "LICENCIA" },
];

const alcanceRrhh = {
  tipo: "RRHH",
  sucursal_fija: null,
  sucursales: [{ id_sucursal: SUC, nombre: "Central" }],
  areas: [{ id_departamento: PAN, nombre: "Panadería" }, { id_departamento: CAJ, nombre: "Cajas" }],
  tipos: TIPOS,
  umbral_predeterminado: { max_ausentes_porcentaje: 30, min_presentes: 1 },
  puede_configurar: true,
};
const alcanceSupervisor = { ...alcanceRrhh, tipo: "SUPERVISOR", sucursal_fija: SUC, puede_configurar: false };

const ANA = { id_empleado: "e-1", nombre_completo: "Ana Quispe", cargo: "Panadera", area: "Panadería", id_departamento: PAN };
const LUIS = { id_empleado: "e-2", nombre_completo: "Luis Rojas", cargo: "Cajero", area: "Cajas", id_departamento: CAJ };

const AUSENCIAS = [
  {
    clave: "VACACIONES-s-1", categoria: "VACACIONES", id_solicitud: "s-1", tipo: { codigo: "VACACIONES", nombre: "Vacaciones" },
    empleado: ANA, fecha_inicio: "2026-11-09", fecha_fin: "2026-11-13", dias: 5, con_goce_haberes: true,
  },
  {
    clave: "LICENCIA-s-2", categoria: "LICENCIA", id_solicitud: "s-2", tipo: { codigo: "MEDICA", nombre: "Licencia médica" },
    empleado: LUIS, fecha_inicio: "2026-11-10", fecha_fin: "2026-11-11", dias: 2, con_goce_haberes: true,
  },
];

const ALERTA = {
  id_departamento: PAN, area: "Panadería", programados: 3, ausentes: 2, presentes: 1,
  porcentaje_ausentes: 66.7, max_ausentes_porcentaje: 30, min_presentes: 1, motivos: ["PORCENTAJE"],
};

// Respuesta del servidor para el rango pedido; el martes 10 de noviembre hay baja cobertura.
function respuesta(filtros) {
  const dias = diasDelRango(filtros.desde, filtros.hasta).map((fecha) => ({
    fecha,
    laborable: true,
    feriado: fecha === "2026-11-02" ? "Todos Santos" : null,
    ausentes: fecha === "2026-11-10" ? 2 : 0,
    baja_cobertura: fecha === "2026-11-10",
    alertas: fecha === "2026-11-10" ? [ALERTA] : [],
  }));
  const deArea = filtros.id_departamento ? AUSENCIAS.filter((a) => a.empleado.id_departamento === filtros.id_departamento) : AUSENCIAS;
  return {
    filtros: { ...filtros, sucursal: { id_sucursal: SUC, nombre: "Central" }, area: null },
    equipo: { activos: 8 },
    ausencias: deArea,
    dias,
    resumen: { colaboradores_ausentes: deArea.length, dias_con_baja_cobertura: 1 },
  };
}

function abrir() {
  return render(
    <ProveedorAvisos>
      <MemoryRouter>
        <CalendarioAusenciasPage />
      </MemoryRouter>
    </ProveedorAvisos>
  );
}

async function elegirSucursal(usuario) {
  await usuario.selectOptions(await screen.findByLabelText("Sucursal"), SUC);
  await screen.findByRole("grid");
}

beforeEach(() => {
  // Solo se simula la fecha; los temporizadores reales siguen para que las esperas de la prueba funcionen.
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-18T15:00:00Z") });
  localStorage.clear();
  cambiarRol("admin");
  obtenerAlcanceCalendario.mockResolvedValue(alcanceRrhh);
  consultarCalendarioAusencias.mockImplementation(async (filtros) => respuesta(filtros));
  listarUmbralesCobertura.mockResolvedValue({ predeterminado: alcanceRrhh.umbral_predeterminado, umbrales: [] });
});

afterEach(() => {
  vi.useRealTimers();
  olvidarEmpleado();
  cambiarRol("admin");
});

describe("Calendario de ausencias", () => {
  it("criterio 1: al elegir sucursal pide el mes completo y dibuja la cuadrícula con las ausencias aprobadas", async () => {
    const usuario = userEvent.setup({ advanceTimers: () => {} });
    abrir();
    await elegirSucursal(usuario);

    // Noviembre de 2026 se muestra con las semanas completas que lo cubren.
    expect(consultarCalendarioAusencias).toHaveBeenLastCalledWith(
      { id_sucursal: SUC, id_departamento: "", desde: "2026-10-26", hasta: "2026-12-06" },
      { idEmpleado: null, rol: "admin" }
    );
    expect(screen.getByRole("heading", { name: "Noviembre de 2026" })).toBeInTheDocument();
    expect(screen.getAllByRole("gridcell")).toHaveLength(42);
    // Ana está de vacaciones del 9 al 13: cinco bloques; Luis, dos días de licencia.
    expect(screen.getAllByRole("button", { name: /Ana Quispe, Vacaciones/ })).toHaveLength(5);
    expect(screen.getAllByRole("button", { name: /Luis Rojas, Licencia médica/ })).toHaveLength(2);
    expect(screen.getByText("2 colaboradores ausentes de 8 en el periodo")).toBeInTheDocument();
  });

  it("criterio 2: cada tipo lleva su propio color y el tipo escrito; la leyenda lo explica", async () => {
    const usuario = userEvent.setup({ advanceTimers: () => {} });
    abrir();
    await elegirSucursal(usuario);

    const vacaciones = screen.getAllByRole("button", { name: /Ana Quispe, Vacaciones/ })[0];
    const medica = screen.getAllByRole("button", { name: /Luis Rojas, Licencia médica/ })[0];
    expect(vacaciones).toHaveClass("cal-tipo--vacaciones");
    expect(medica).toHaveClass("cal-tipo--medica");
    expect(vacaciones).toHaveTextContent("Vac.");
    expect(medica).toHaveTextContent("Méd.");
    const leyenda = screen.getByRole("group", { name: /Tipos de ausencia/ });
    expect(within(leyenda).getAllByRole("button")).toHaveLength(3);
  });

  it("criterio 2: filtrar por departamento vuelve a pedir el calendario de esa área", async () => {
    const usuario = userEvent.setup({ advanceTimers: () => {} });
    abrir();
    await elegirSucursal(usuario);

    await usuario.selectOptions(screen.getByLabelText("Departamento"), PAN);

    await waitFor(() => expect(consultarCalendarioAusencias).toHaveBeenLastCalledWith(expect.objectContaining({ id_departamento: PAN }), expect.anything()));
    await waitFor(() => expect(screen.queryByRole("button", { name: /Luis Rojas/ })).not.toBeInTheDocument());
    expect(screen.getAllByRole("button", { name: /Ana Quispe/ })).toHaveLength(5);
  });

  it("criterio 3: el día con baja cobertura muestra una advertencia visual y su explicación", async () => {
    const usuario = userEvent.setup({ advanceTimers: () => {} });
    abrir();
    await elegirSucursal(usuario);

    const celda = document.querySelector('[data-fecha="2026-11-10"]');
    expect(celda).toHaveClass("cal-celda--baja");
    expect(within(celda).getByText(/Baja cobertura\. Panadería: 2 de 3 ausentes; falta el 66.7 % \(tolera 30 %\)/)).toBeInTheDocument();
    expect(document.querySelector('[data-fecha="2026-11-09"]')).not.toHaveClass("cal-celda--baja");
    expect(screen.getByText(/1 día con baja cobertura/)).toBeInTheDocument();
  });

  it("criterio 4: al hacer clic en un bloque se ve el colaborador, su cargo, el tipo y el período aprobado", async () => {
    const usuario = userEvent.setup({ advanceTimers: () => {} });
    abrir();
    await elegirSucursal(usuario);

    await usuario.click(screen.getAllByRole("button", { name: /Ana Quispe, Vacaciones/ })[0]);

    const detalle = await screen.findByRole("dialog");
    expect(within(detalle).getByText("Ana Quispe", { selector: "dd" })).toBeInTheDocument();
    expect(within(detalle).getByText("Panadera")).toBeInTheDocument();
    expect(within(detalle).getByText("Vacaciones", { selector: "span *, span" })).toBeInTheDocument();
    expect(within(detalle).getByText(/Del .*9 nov.* 2026 al .*13 nov.* 2026/)).toBeInTheDocument();
    expect(within(detalle).getByText("5 días hábiles")).toBeInTheDocument();
  });

  it("apagar un tipo en la leyenda lo oculta del calendario", async () => {
    const usuario = userEvent.setup({ advanceTimers: () => {} });
    abrir();
    await elegirSucursal(usuario);

    await usuario.click(within(screen.getByRole("group", { name: /Tipos de ausencia/ })).getByRole("button", { name: "Licencia médica" }));

    expect(screen.queryByRole("button", { name: /Luis Rojas/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Ana Quispe/ })).toHaveLength(5);
  });

  it("navega al mes siguiente y vuelve a hoy", async () => {
    const usuario = userEvent.setup({ advanceTimers: () => {} });
    abrir();
    await elegirSucursal(usuario);

    await usuario.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(await screen.findByRole("heading", { name: "Diciembre de 2026" })).toBeInTheDocument();
    expect(consultarCalendarioAusencias).toHaveBeenLastCalledWith(expect.objectContaining({ desde: "2026-11-30", hasta: "2027-01-03" }), expect.anything());

    await usuario.click(screen.getByRole("button", { name: "Hoy" }));
    expect(await screen.findByRole("heading", { name: "Noviembre de 2026" })).toBeInTheDocument();
  });

  it("la vista semanal pide lunes a domingo y la diaria, un día con el detalle de la baja cobertura", async () => {
    const usuario = userEvent.setup({ advanceTimers: () => {} });
    abrir();
    await elegirSucursal(usuario);

    await usuario.click(screen.getByRole("button", { name: "Semana" }));
    await waitFor(() => expect(consultarCalendarioAusencias).toHaveBeenLastCalledWith(expect.objectContaining({ desde: "2026-11-16", hasta: "2026-11-22" }), expect.anything()));

    // Desde el mes, el número del día abre la vista diaria de ese día.
    await usuario.click(screen.getByRole("button", { name: "Mes" }));
    await usuario.click(await screen.findByRole("button", { name: /Martes, 10 de noviembre de 2026: 2 ausencias, baja cobertura/ }));
    await waitFor(() => expect(consultarCalendarioAusencias).toHaveBeenLastCalledWith(expect.objectContaining({ desde: "2026-11-10", hasta: "2026-11-10" }), expect.anything()));
    expect(await screen.findByRole("alert")).toHaveTextContent("Panadería: 2 de 3 ausentes");
    expect(screen.getByText("2 ausencias aprobadas")).toBeInTheDocument();
  });

  it("muestra el feriado en su celda", async () => {
    const usuario = userEvent.setup({ advanceTimers: () => {} });
    abrir();
    await elegirSucursal(usuario);

    expect(within(document.querySelector('[data-fecha="2026-11-02"]')).getByText("Feriado")).toBeInTheDocument();
  });

  it("un error del servidor se informa con la opción de reintentar", async () => {
    const usuario = userEvent.setup({ advanceTimers: () => {} });
    consultarCalendarioAusencias.mockRejectedValueOnce(new Error("No se pudo conectar con el servidor"));
    abrir();
    await usuario.selectOptions(await screen.findByLabelText("Sucursal"), SUC);

    expect(await screen.findByText("No se pudo cargar el calendario")).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("grid")).toBeInTheDocument();
  });

  it("RRHH ve el botón de umbrales; el supervisor no, y debe identificarse con su sucursal fija", async () => {
    abrir();
    expect(await screen.findByRole("button", { name: "Umbrales de cobertura" })).toBeInTheDocument();
    expect(obtenerAlcanceCalendario).toHaveBeenCalledWith({ idEmpleado: null, rol: "admin" });
  });

  it("el supervisor se identifica, no elige sucursal y el calendario sale de la suya", async () => {
    cambiarRol("supervisor");
    obtenerAlcanceCalendario.mockResolvedValue(alcanceSupervisor);
    guardarEmpleado(SUPERVISOR);
    abrir();

    const sucursal = await screen.findByLabelText("Sucursal");
    expect(sucursal).toBeDisabled();
    expect(await screen.findByRole("grid")).toBeInTheDocument();
    expect(obtenerAlcanceCalendario).toHaveBeenCalledWith({ idEmpleado: SUPERVISOR, rol: "supervisor" });
    expect(consultarCalendarioAusencias).toHaveBeenLastCalledWith(expect.objectContaining({ id_sucursal: SUC }), { idEmpleado: SUPERVISOR, rol: "supervisor" });
    expect(screen.queryByRole("button", { name: "Umbrales de cobertura" })).not.toBeInTheDocument();
  });

  it("sin identificar, el supervisor ve el formulario de identificación y no se consulta nada", async () => {
    cambiarRol("supervisor");
    abrir();

    expect(await screen.findByLabelText(/identificador/i)).toBeInTheDocument();
    expect(obtenerAlcanceCalendario).not.toHaveBeenCalled();
    expect(consultarCalendarioAusencias).not.toHaveBeenCalled();
  });

  it("RRHH configura un umbral y el calendario se vuelve a consultar", async () => {
    const usuario = userEvent.setup({ advanceTimers: () => {} });
    guardarUmbralCobertura.mockResolvedValue({});
    abrir();
    await elegirSucursal(usuario);
    const llamadasAntes = consultarCalendarioAusencias.mock.calls.length;

    await usuario.click(screen.getByRole("button", { name: "Umbrales de cobertura" }));
    const dialogo = await screen.findByRole("dialog", { name: "Umbrales de cobertura" });
    await usuario.selectOptions(within(dialogo).getByLabelText("Área"), PAN);
    await usuario.clear(within(dialogo).getByLabelText(/Ausentes tolerados/));
    await usuario.type(within(dialogo).getByLabelText(/Ausentes tolerados/), "50");
    await usuario.click(within(dialogo).getByRole("button", { name: "Guardar umbral" }));

    await waitFor(() =>
      expect(guardarUmbralCobertura).toHaveBeenCalledWith(
        { id_sucursal: undefined, id_departamento: PAN, max_ausentes_porcentaje: "50", min_presentes: "1" },
        { idEmpleado: null, rol: "admin" }
      )
    );
    await waitFor(() => expect(consultarCalendarioAusencias.mock.calls.length).toBeGreaterThan(llamadasAntes));
  });

  it("los umbrales existentes se listan y se pueden eliminar", async () => {
    const usuario = userEvent.setup({ advanceTimers: () => {} });
    listarUmbralesCobertura.mockResolvedValue({
      predeterminado: alcanceRrhh.umbral_predeterminado,
      umbrales: [{ id_umbral: "u-1", id_sucursal: null, id_departamento: PAN, max_ausentes_porcentaje: 20, min_presentes: 2 }],
    });
    eliminarUmbralCobertura.mockResolvedValue({ eliminado: true });
    abrir();
    await elegirSucursal(usuario);

    await usuario.click(screen.getByRole("button", { name: "Umbrales de cobertura" }));
    const dialogo = await screen.findByRole("dialog", { name: "Umbrales de cobertura" });
    expect(await within(dialogo).findByText("20 %")).toBeInTheDocument();

    await usuario.click(within(dialogo).getByRole("button", { name: /Eliminar el umbral de Panadería en Todas las sucursales/ }));

    await waitFor(() => expect(eliminarUmbralCobertura).toHaveBeenCalledWith("u-1", { idEmpleado: null, rol: "admin" }));
  });
});

// Evita la advertencia de act() de los temporizadores del aviso.
afterEach(async () => {
  await act(async () => {});
});
