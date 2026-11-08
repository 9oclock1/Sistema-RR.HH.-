import { MemoryRouter } from "react-router";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  actualizarPlantilla,
  crearPlantilla,
  eliminarPlantilla,
  listarPlantillas,
} from "../../api/plantillasEvaluacion";
import departamentosApi from "../../api/departamentosApi";
import ProveedorAvisos from "../../components/ui/ProveedorAvisos";
import PlantillasPage from "./PlantillasPage";

vi.mock("../../api/plantillasEvaluacion");
vi.mock("../../api/departamentosApi", () => ({
  default: { listarActivas: vi.fn(), suscribirCambios: () => () => {} },
}));

const USUARIO = "f0000000-0000-4000-8000-000000000023";
const AREA = "f0000000-0000-4000-8000-000000000001";
const OTRA_AREA = "f0000000-0000-4000-8000-000000000002";

const plantilla = (id, nombre, estado, extra = {}) => ({
  id_plantilla: id,
  nombre,
  objetivo: "Medir la atención al cliente.",
  area: { id_departamento: AREA, nombre: "Atención al cliente" },
  vigencia_desde: "2027-01-01",
  vigencia_hasta: "2027-12-31",
  estado_codigo: estado,
  version_actual: { id_version: `v-${id}`, numero_version: 1 },
  secciones_total: 3,
  fue_publicada: estado !== "BORRADOR",
  ...extra,
});

const borrador = plantilla("a", "Plantilla en borrador", "BORRADOR");
const publicada = plantilla("b", "Plantilla publicada", "PUBLICADA");

// El servidor responde a su manera: aquí solo se simula el filtro de estado, que sí se pide al servidor.
const servidor = (todas) => async (idEmpleado, { estado } = {}) =>
  todas.filter((p) => !estado || p.estado_codigo === estado);

function abrir() {
  return render(
    <ProveedorAvisos>
      <MemoryRouter>
        <PlantillasPage />
      </MemoryRouter>
    </ProveedorAvisos>,
  );
}

const botonNueva = () => screen.getAllByRole("button", { name: "Nueva plantilla" })[0];

async function llenarFormulario(dialogo, valores = {}) {
  const v = {
    nombre: "Evaluación de tienda",
    area: AREA,
    objetivo: "Medir la atención.",
    desde: "2027-01-01",
    hasta: "2027-12-31",
    ...valores,
  };
  await userEvent.type(within(dialogo).getByLabelText(/Nombre/), v.nombre);
  await userEvent.selectOptions(within(dialogo).getByLabelText(/Área destino/), v.area);
  await userEvent.type(within(dialogo).getByLabelText(/Objetivo/), v.objetivo);
  await userEvent.type(within(dialogo).getByLabelText(/Vigente desde/), v.desde);
  await userEvent.type(within(dialogo).getByLabelText(/Vigente hasta/), v.hasta);
}

beforeEach(() => {
  localStorage.setItem("rrhh.idEmpleado", USUARIO);
  departamentosApi.listarActivas.mockResolvedValue([
    { id_departamento: AREA, nombre: "Atención al cliente" },
    { id_departamento: OTRA_AREA, nombre: "Recursos Humanos" },
  ]);
  listarPlantillas.mockImplementation(servidor([borrador, publicada]));
});

describe("Listado de plantillas de evaluación", () => {
  it("lista las plantillas con su estado, versión, vigencia y número de secciones", async () => {
    abrir();
    expect(await screen.findByText("Plantilla en borrador")).toBeInTheDocument();
    expect(screen.getByText("Plantilla publicada")).toBeInTheDocument();
    const tabla = within(screen.getByRole("table"));
    expect(tabla.getByText("Borrador")).toBeInTheDocument();
    expect(tabla.getByText("Publicada")).toBeInTheDocument();
    expect(tabla.getAllByText("Versión 1")).toHaveLength(2);
    expect(tabla.getAllByText("Atención al cliente")).toHaveLength(2);
    expect(tabla.getAllByText("3")).toHaveLength(2);
    expect(screen.getByText("2 de 2 plantillas")).toBeInTheDocument();
    expect(listarPlantillas).toHaveBeenCalledWith(USUARIO, { estado: "", idDepartamento: "" });
  });

  it("el nombre lleva al editor de la plantilla", async () => {
    abrir();
    const enlace = await screen.findByRole("link", { name: "Plantilla en borrador" });
    expect(enlace).toHaveAttribute("href", "/desempeno/plantillas/a");
  });

  it("solo permite editar y eliminar las que nunca se publicaron; las demás solo se consultan", async () => {
    abrir();
    await screen.findByText("Plantilla en borrador");
    expect(screen.getByLabelText("Editar Plantilla en borrador")).toBeInTheDocument();
    expect(screen.getByLabelText("Eliminar Plantilla en borrador")).toBeInTheDocument();
    expect(screen.getByLabelText("Configurar secciones de Plantilla en borrador")).toBeInTheDocument();
    expect(screen.queryByLabelText("Editar Plantilla publicada")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Eliminar Plantilla publicada")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Ver estructura de Plantilla publicada")).toBeInTheDocument();
  });

  it("avisa cuando una plantilla tiene un borrador nuevo y una versión publicada", async () => {
    listarPlantillas.mockImplementation(servidor([plantilla("c", "Con nueva versión", "BORRADOR", { fue_publicada: true, version_actual: { id_version: "v", numero_version: 2 } })]));
    abrir();
    expect(await screen.findByText(/Versión 2 · hay una publicada/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Editar Con nueva versión")).not.toBeInTheDocument();
  });

  it("filtra por estado pidiéndolo al servidor, y por texto en la propia pantalla", async () => {
    abrir();
    await screen.findByText("Plantilla en borrador");

    await userEvent.type(screen.getByLabelText("Buscar"), "publicada");
    expect(screen.getByText("1 de 2 plantillas")).toBeInTheDocument();
    expect(screen.queryByText("Plantilla en borrador")).not.toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText("Buscar"));

    await userEvent.selectOptions(screen.getByLabelText("Estado"), "BORRADOR");
    await waitFor(() => expect(listarPlantillas).toHaveBeenLastCalledWith(USUARIO, { estado: "BORRADOR", idDepartamento: "" }));
    await waitFor(() => expect(screen.queryByText("Plantilla publicada")).not.toBeInTheDocument());
    expect(screen.getByText("Plantilla en borrador")).toBeInTheDocument();
  });

  it("filtra por área pidiéndolo al servidor", async () => {
    abrir();
    await screen.findByText("Plantilla en borrador");
    await userEvent.selectOptions(screen.getByLabelText("Área destino"), OTRA_AREA);
    await waitFor(() => expect(listarPlantillas).toHaveBeenLastCalledWith(USUARIO, { estado: "", idDepartamento: OTRA_AREA }));
  });

  it("si ningún resultado coincide ofrece limpiar los filtros", async () => {
    abrir();
    await screen.findByText("Plantilla en borrador");
    await userEvent.type(screen.getByLabelText("Buscar"), "zzz");
    expect(screen.getByText("Ninguna plantilla coincide con los filtros")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(screen.getByText("Plantilla en borrador")).toBeInTheDocument();
  });

  it("sin plantillas invita a crear la primera", async () => {
    listarPlantillas.mockResolvedValue([]);
    abrir();
    expect(await screen.findByText("Aún no hay plantillas de evaluación")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Nueva plantilla" }).length).toBeGreaterThan(1);
  });

  it("si falla la carga muestra el motivo y permite reintentar", async () => {
    listarPlantillas.mockRejectedValueOnce(new Error("No se pudo conectar con el servidor"));
    abrir();
    expect(await screen.findByText("No se pudieron cargar las plantillas")).toBeInTheDocument();
    expect(screen.getByText("No se pudo conectar con el servidor")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Plantilla en borrador")).toBeInTheDocument();
  });

  it("sin un usuario de prueba elegido pide elegirlo y no consulta nada", () => {
    localStorage.clear();
    abrir();
    expect(screen.getByText("Elija su usuario de prueba")).toBeInTheDocument();
    expect(listarPlantillas).not.toHaveBeenCalled();
  });
});

describe("Formulario de registro de la plantilla", () => {
  it("no envía nada y marca cada campo obligatorio cuando está vacío", async () => {
    abrir();
    await screen.findByText("Plantilla en borrador");
    await userEvent.click(botonNueva());
    const dialogo = screen.getByRole("dialog");

    await userEvent.click(within(dialogo).getByRole("button", { name: "Guardar" }));

    expect(await within(dialogo).findByText("Revise los campos marcados.")).toBeInTheDocument();
    for (const mensaje of [
      "El nombre es obligatorio.",
      "Seleccione el área destino.",
      "El objetivo es obligatorio.",
      "Indique desde cuándo rige la plantilla.",
      "Indique hasta cuándo rige la plantilla.",
    ]) {
      expect(within(dialogo).getAllByText(mensaje).length).toBeGreaterThan(0);
    }
    expect(crearPlantilla).not.toHaveBeenCalled();
  });

  it("el error de un campo desaparece al corregirlo", async () => {
    abrir();
    await screen.findByText("Plantilla en borrador");
    await userEvent.click(botonNueva());
    const dialogo = screen.getByRole("dialog");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Guardar" }));
    await within(dialogo).findByText("Revise los campos marcados.");

    await userEvent.type(within(dialogo).getByLabelText(/Nombre/), "A");
    expect(within(dialogo).queryAllByText("El nombre es obligatorio.")).toHaveLength(0);
    expect(within(dialogo).getAllByText("El objetivo es obligatorio.").length).toBeGreaterThan(0);
  });

  it("rechaza una vigencia que termina antes de empezar", async () => {
    abrir();
    await screen.findByText("Plantilla en borrador");
    await userEvent.click(botonNueva());
    const dialogo = screen.getByRole("dialog");
    await llenarFormulario(dialogo, { desde: "2027-06-01", hasta: "2027-05-31" });

    await userEvent.click(within(dialogo).getByRole("button", { name: "Guardar" }));

    expect((await within(dialogo).findAllByText("La fecha de fin no puede ser anterior a la de inicio.")).length).toBeGreaterThan(0);
    expect(crearPlantilla).not.toHaveBeenCalled();
  });

  it("registra la plantilla como borrador, cierra el formulario, recarga la lista y avisa", async () => {
    abrir();
    await screen.findByText("Plantilla en borrador");
    await userEvent.click(botonNueva());
    const dialogo = screen.getByRole("dialog");
    await llenarFormulario(dialogo);
    crearPlantilla.mockResolvedValue({});

    await userEvent.click(within(dialogo).getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(crearPlantilla).toHaveBeenCalledWith(USUARIO, {
        nombre: "Evaluación de tienda",
        id_departamento: AREA,
        objetivo: "Medir la atención.",
        vigencia_desde: "2027-01-01",
        vigencia_hasta: "2027-12-31",
      }),
    );
    expect(await screen.findByText("Plantilla creada como borrador")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(listarPlantillas.mock.calls.length).toBeGreaterThan(1));
  });

  it("muestra la alerta de duplicidad con el motivo del servidor y mantiene el formulario abierto", async () => {
    abrir();
    await screen.findByText("Plantilla en borrador");
    await userEvent.click(botonNueva());
    const dialogo = screen.getByRole("dialog");
    await llenarFormulario(dialogo);
    crearPlantilla.mockRejectedValueOnce(
      Object.assign(new Error("Ya existe una plantilla con ese nombre para el área y el periodo indicados."), {
        estado: 409,
        detalles: [{ campo: "nombre", mensaje: "«Evaluación de tienda» ya está vigente del 2027-01-01 al 2027-12-31 en esta área." }],
      }),
    );

    await userEvent.click(within(dialogo).getByRole("button", { name: "Guardar" }));

    expect(await within(dialogo).findByText("Ya existe una plantilla igual")).toBeInTheDocument();
    expect(within(dialogo).getAllByText(/Ya existe una plantilla con ese nombre/).length).toBeGreaterThan(0);
    expect(within(dialogo).getAllByText(/ya está vigente del 2027-01-01/).length).toBeGreaterThan(0);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByText("Plantilla creada como borrador")).not.toBeInTheDocument();
  });

  it("tras la alerta se puede corregir el nombre y guardar de nuevo", async () => {
    abrir();
    await screen.findByText("Plantilla en borrador");
    await userEvent.click(botonNueva());
    const dialogo = screen.getByRole("dialog");
    await llenarFormulario(dialogo);
    crearPlantilla.mockRejectedValueOnce(
      Object.assign(new Error("Ya existe"), { estado: 409, detalles: [{ campo: "nombre", mensaje: "Repetido." }] }),
    );
    await userEvent.click(within(dialogo).getByRole("button", { name: "Guardar" }));
    await within(dialogo).findByText("Ya existe una plantilla igual");

    crearPlantilla.mockResolvedValue({});
    await userEvent.type(within(dialogo).getByLabelText(/Nombre/), " 2");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(crearPlantilla).toHaveBeenCalledTimes(2));
    expect(crearPlantilla.mock.calls[1][1].nombre).toBe("Evaluación de tienda 2");
  });

  it("otro error del servidor aparece como alerta general", async () => {
    abrir();
    await screen.findByText("Plantilla en borrador");
    await userEvent.click(botonNueva());
    const dialogo = screen.getByRole("dialog");
    await llenarFormulario(dialogo);
    crearPlantilla.mockRejectedValueOnce(Object.assign(new Error("No se pudo consultar el servicio de empleados."), { estado: 503, detalles: [] }));

    await userEvent.click(within(dialogo).getByRole("button", { name: "Guardar" }));

    expect(await within(dialogo).findByText("No se pudo consultar el servicio de empleados.")).toBeInTheDocument();
  });

  it("editar abre el formulario con los datos actuales y guarda los cambios", async () => {
    abrir();
    await screen.findByText("Plantilla en borrador");
    await userEvent.click(screen.getByLabelText("Editar Plantilla en borrador"));
    const dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByLabelText(/Nombre/)).toHaveValue("Plantilla en borrador");
    expect(within(dialogo).getByLabelText(/Área destino/)).toHaveValue(AREA);
    expect(within(dialogo).getByLabelText(/Vigente desde/)).toHaveValue("2027-01-01");
    actualizarPlantilla.mockResolvedValue({});

    await userEvent.clear(within(dialogo).getByLabelText(/Objetivo/));
    await userEvent.type(within(dialogo).getByLabelText(/Objetivo/), "Nuevo objetivo.");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(actualizarPlantilla).toHaveBeenCalledWith(USUARIO, "a", expect.objectContaining({ objetivo: "Nuevo objetivo.", id_departamento: AREA })),
    );
    expect(await screen.findByText("Plantilla actualizada")).toBeInTheDocument();
  });
});

describe("Eliminar plantillas", () => {
  it("pide confirmación y no elimina si se cancela", async () => {
    abrir();
    await screen.findByText("Plantilla en borrador");
    await userEvent.click(screen.getByLabelText("Eliminar Plantilla en borrador"));
    expect(await screen.findByText("¿Eliminar la plantilla?")).toBeInTheDocument();

    await userEvent.click(await screen.findByRole("button", { name: "Cancelar" }));

    expect(eliminarPlantilla).not.toHaveBeenCalled();
  });

  it("elimina al confirmar, recarga la lista y avisa", async () => {
    abrir();
    await screen.findByText("Plantilla en borrador");
    await userEvent.click(screen.getByLabelText("Eliminar Plantilla en borrador"));
    eliminarPlantilla.mockResolvedValue({});

    await userEvent.click(await screen.findByRole("button", { name: "Eliminar" }));

    await waitFor(() => expect(eliminarPlantilla).toHaveBeenCalledWith(USUARIO, "a"));
    expect(await screen.findByText("Plantilla eliminada")).toBeInTheDocument();
  });

  it("si el servidor no deja eliminarla muestra el motivo", async () => {
    abrir();
    await screen.findByText("Plantilla en borrador");
    await userEvent.click(screen.getByLabelText("Eliminar Plantilla en borrador"));
    eliminarPlantilla.mockRejectedValue(new Error("La plantilla ya fue publicada y no se puede eliminar."));

    await userEvent.click(await screen.findByRole("button", { name: "Eliminar" }));

    expect(await screen.findByText("No se pudo eliminar «Plantilla en borrador»")).toBeInTheDocument();
    expect(screen.getByText("La plantilla ya fue publicada y no se puede eliminar.")).toBeInTheDocument();
  });
});
