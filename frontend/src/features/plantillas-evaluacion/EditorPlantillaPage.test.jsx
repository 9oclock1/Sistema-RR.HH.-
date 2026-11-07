import { RouterProvider, createMemoryRouter } from "react-router";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api/plantillasEvaluacion";
import departamentosApi from "../../api/departamentosApi";
import ProveedorAvisos from "../../components/ui/ProveedorAvisos";
import PlantillasEvaluacionPage from "./PlantillasEvaluacionPage";

vi.mock("../../api/plantillasEvaluacion");
vi.mock("../../api/departamentosApi", () => ({
  default: { listarActivas: vi.fn(), suscribirCambios: () => () => {} },
}));

const USUARIO = "f0000000-0000-4000-8000-000000000023";

const competencia = (n, nombre, tipo = "COMPETENCIA_LABORAL", extra = {}) => ({
  id_competencia: `c${n}`,
  nombre,
  descripcion: `Descripción de ${nombre}`,
  tipo_codigo: tipo,
  tipo_nombre: tipo,
  esta_activa: true,
  ...extra,
});
const ATENCION = competencia(1, "Atención al cliente");
const EQUIPO = competencia(2, "Trabajo en equipo");
const METAS = competencia(3, "Cumplimiento de metas", "FACTOR_OPERATIVO");
const ORDEN = competencia(4, "Orden y limpieza", "FACTOR_OPERATIVO");

const plantilla = (estado, extra = {}) => ({
  id_plantilla: "p1",
  nombre: "Evaluación de personal",
  objetivo: "Medir el desempeño del equipo.",
  area: { id_departamento: "d1", nombre: "Recursos Humanos" },
  vigencia_desde: "2099-01-01",
  vigencia_hasta: "2099-12-31",
  creador: { nombre_completo: "Andrea Salazar" },
  estado_codigo: estado,
  version_actual: { id_version: "v1", numero_version: 1 },
  secciones_total: 2,
  fue_publicada: estado !== "BORRADOR",
  versiones: [{ id_version: "v1", numero_version: 1, estado_codigo: estado }],
  ...extra,
});

const ESCALA = {
  id_escala: "e1",
  nombre: "Likert de 1 a 5",
  tipo: "CUANTITATIVA",
  niveles: [
    { valor: 1, etiqueta: "Muy deficiente" },
    { valor: 3, etiqueta: "Aceptable" },
    { valor: 5, etiqueta: "Excelente" },
  ],
};
const ESCALA_SI_NO = { id_escala: "e2", nombre: "Cumple / No cumple", tipo: "CUALITATIVA", niveles: [{ valor: 0, etiqueta: "No cumple" }, { valor: 1, etiqueta: "Cumple" }] };

// Reparte el 100 % entre las secciones, como lo haría un servidor con una estructura completa.
const reparto = (cantidad, indice) => {
  const base = Math.floor(10000 / cantidad);
  return (indice === cantidad - 1 ? 10000 - base * indice : base) / 100;
};

// Cada sección trae un criterio con una pregunta; los pesos suman 100 %.
const version = (estado, competencias, numero = 1, idVersion = "v1") => ({
  id_version: idVersion,
  numero_version: numero,
  estado_codigo: estado,
  editable: estado === "BORRADOR",
  secciones: competencias.map((c, i) => ({
    id_seccion: `s${i}`,
    orden: i + 1,
    competencia: c,
    criterios: [
      {
        id_criterio: `k${i}`,
        orden: 1,
        nombre: `Criterio de ${c.nombre}`,
        descripcion: null,
        preguntas: [
          {
            id_pregunta: `q${i}`,
            orden: 1,
            texto: `Pregunta de ${c.nombre}`,
            peso_porcentual: reparto(competencias.length, i),
            es_obligatoria: true,
            id_escala: "e1",
          },
        ],
      },
    ],
  })),
});

// Lo que se envía al guardar una sección tal como quedó en `version`.
const datosSeccion = (c, peso) => ({
  id_competencia: c.id_competencia,
  criterios: [
    {
      nombre: `Criterio de ${c.nombre}`,
      descripcion: "",
      preguntas: [{ texto: `Pregunta de ${c.nombre}`, peso_porcentual: peso, es_obligatoria: true, id_escala: "e1" }],
    },
  ],
});
const datosSeccionVacia = (c) => ({ id_competencia: c.id_competencia, criterios: [] });
const grupo = (nombre) => screen.getByRole("group", { name: `Criterios y preguntas de ${nombre}` });

function abrir(ruta = "/desempeno/plantillas/p1") {
  const router = createMemoryRouter(
    [
      { path: "/desempeno/plantillas/:idPlantilla?", element: <PlantillasEvaluacionPage /> },
      { path: "/otra", element: <p>otra página</p> },
    ],
    { initialEntries: [ruta] },
  );
  render(
    <ProveedorAvisos>
      <RouterProvider router={router} />
    </ProveedorAvisos>,
  );
  return router;
}

// Solo las secciones: los criterios y las preguntas son listas anidadas dentro de cada una.
const nombresSecciones = () =>
  Array.from(screen.getByRole("list", { name: "Secciones de la plantilla" }).children).map(
    (fila) => fila.querySelector(".pl-celda__principal").textContent,
  );

// Espera a que el editor termine de cargar la versión con la cantidad de secciones indicada.
const cargado = (cantidad) => waitFor(() => expect(nombresSecciones()).toHaveLength(cantidad));
const guardarComoPrincipal = () => screen.getByRole("button", { name: "Guardar estructura" });

beforeEach(() => {
  localStorage.setItem("rrhh.idEmpleado", USUARIO);
  departamentosApi.listarActivas.mockResolvedValue([{ id_departamento: "d1", nombre: "Recursos Humanos" }]);
  api.obtenerPlantilla.mockResolvedValue(plantilla("BORRADOR"));
  api.obtenerVersion.mockResolvedValue(version("BORRADOR", [ATENCION, EQUIPO]));
  api.listarCompetencias.mockResolvedValue([ATENCION, EQUIPO, METAS, ORDEN]);
  api.listarEscalas.mockResolvedValue([ESCALA, ESCALA_SI_NO]);
});

describe("Editor de la plantilla: lectura", () => {
  it("muestra los datos base, el estado y las secciones con su tipo, en orden", async () => {
    abrir();
    expect(await screen.findByRole("heading", { level: 1, name: "Evaluación de personal" })).toBeInTheDocument();
    await cargado(2);
    expect(nombresSecciones()).toEqual(["Atención al cliente", "Trabajo en equipo"]);
    expect(screen.getByText("Recursos Humanos")).toBeInTheDocument();
    expect(screen.getByText("Medir el desempeño del equipo.")).toBeInTheDocument();
    expect(screen.getByText("Andrea Salazar")).toBeInTheDocument();
    expect(screen.getAllByText("Competencia laboral").length).toBeGreaterThan(0);
    expect(screen.getByText("2 competencias laborales")).toBeInTheDocument();
    expect(api.obtenerPlantilla).toHaveBeenCalledWith(USUARIO, "p1");
    expect(api.obtenerVersion).toHaveBeenCalledWith(USUARIO, "p1", "v1");
  });

  it("las migas llevan de vuelta al listado", async () => {
    abrir();
    await cargado(2);
    expect(screen.getByRole("link", { name: "Plantillas de evaluación" })).toHaveAttribute("href", "/desempeno/plantillas");
  });

  it("una versión sin secciones lo explica", async () => {
    api.obtenerVersion.mockResolvedValue(version("BORRADOR", []));
    abrir();
    expect(await screen.findByText("Esta versión aún no tiene secciones")).toBeInTheDocument();
  });

  it("si la plantilla no existe lo dice y ofrece volver al listado", async () => {
    api.obtenerPlantilla.mockRejectedValue(Object.assign(new Error("no existe"), { estado: 404 }));
    abrir("/desempeno/plantillas/inexistente");
    expect(await screen.findByText("La plantilla no existe")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver al listado" })).toHaveAttribute("href", "/desempeno/plantillas");
  });

  it("si falla la carga muestra el motivo y permite reintentar", async () => {
    api.obtenerPlantilla.mockRejectedValueOnce(Object.assign(new Error("Sin conexión"), { estado: 0 }));
    abrir();
    expect(await screen.findByText("No se pudo cargar la plantilla")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await cargado(2);
  });

  it("si falla la carga de la versión permite reintentar solo esa parte", async () => {
    api.obtenerVersion.mockRejectedValueOnce(new Error("Error del servidor"));
    abrir();
    expect(await screen.findByText("No se pudo cargar la versión")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await cargado(2);
  });

  it("sin un usuario de prueba elegido pide elegirlo", () => {
    localStorage.clear();
    abrir();
    expect(screen.getByText("Elija su usuario de prueba")).toBeInTheDocument();
    expect(api.obtenerPlantilla).not.toHaveBeenCalled();
  });
});

describe("Editor de la plantilla: configurar secciones", () => {
  it("al inicio todo está guardado y no hay nada que guardar", async () => {
    abrir();
    await cargado(2);
    expect(screen.getByText("Todo guardado.")).toBeInTheDocument();
    expect(guardarComoPrincipal()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Descartar" })).toBeDisabled();
  });

  it("agrega una sección desde el catálogo, que ya no se ofrece de nuevo", async () => {
    abrir();
    await cargado(2);
    const selector = screen.getByLabelText("Agregar sección");
    expect(within(selector).queryByRole("option", { name: "Atención al cliente" })).not.toBeInTheDocument();

    await userEvent.selectOptions(selector, "c3");

    expect(nombresSecciones()).toEqual(["Atención al cliente", "Trabajo en equipo", "Cumplimiento de metas"]);
    expect(within(screen.getByLabelText("Agregar sección")).queryByRole("option", { name: "Cumplimiento de metas" })).not.toBeInTheDocument();
    expect(screen.getByText("Hay cambios sin guardar.")).toBeInTheDocument();
    expect(screen.getByText("2 competencias laborales · 1 factor operativo")).toBeInTheDocument();
  });

  it("agrupa el catálogo por tipo en el selector", async () => {
    abrir();
    await cargado(2);
    const selector = screen.getByLabelText("Agregar sección");
    expect(selector.querySelector("optgroup[label='Factores operativos']")).not.toBeNull();
    expect(selector.querySelector("optgroup[label='Competencias laborales']")).toBeNull();
  });

  it("reordena con los botones de subir y bajar, que se deshabilitan en los extremos", async () => {
    abrir();
    await cargado(2);
    expect(screen.getByLabelText("Subir Atención al cliente")).toBeDisabled();
    expect(screen.getByLabelText("Bajar Trabajo en equipo")).toBeDisabled();

    await userEvent.click(screen.getByLabelText("Bajar Atención al cliente"));

    expect(nombresSecciones()).toEqual(["Trabajo en equipo", "Atención al cliente"]);
    await userEvent.click(screen.getByLabelText("Subir Atención al cliente"));
    expect(nombresSecciones()).toEqual(["Atención al cliente", "Trabajo en equipo"]);
    expect(screen.getByText("Todo guardado.")).toBeInTheDocument();
  });

  it("quitar una sección y descartar devuelve lo guardado", async () => {
    abrir();
    await cargado(2);
    await userEvent.click(screen.getByLabelText("Quitar Trabajo en equipo"));
    expect(nombresSecciones()).toEqual(["Atención al cliente"]);

    await userEvent.click(screen.getByRole("button", { name: "Descartar" }));

    expect(nombresSecciones()).toEqual(["Atención al cliente", "Trabajo en equipo"]);
  });

  it("guarda las secciones en el orden en pantalla y vuelve a mostrar todo guardado", async () => {
    abrir();
    await cargado(2);
    await userEvent.selectOptions(screen.getByLabelText("Agregar sección"), "c3");
    await userEvent.click(screen.getByLabelText("Subir Cumplimiento de metas"));
    api.guardarEstructura.mockResolvedValue(version("BORRADOR", [ATENCION, METAS, EQUIPO]));

    await userEvent.click(guardarComoPrincipal());

    await waitFor(() =>
      expect(api.guardarEstructura).toHaveBeenCalledWith(USUARIO, "p1", "v1", [
        datosSeccion(ATENCION, 50),
        datosSeccionVacia(METAS),
        datosSeccion(EQUIPO, 50),
      ]),
    );
    expect(await screen.findByText("Estructura guardada")).toBeInTheDocument();
    expect(await screen.findByText("Todo guardado.")).toBeInTheDocument();
    expect(nombresSecciones()).toEqual(["Atención al cliente", "Cumplimiento de metas", "Trabajo en equipo"]);
  });

  it("al quitar una sección ya guardada pide confirmar antes de guardar", async () => {
    abrir();
    await cargado(2);
    await userEvent.click(screen.getByLabelText("Quitar Trabajo en equipo"));
    api.guardarEstructura.mockResolvedValue(version("BORRADOR", [ATENCION]));

    await userEvent.click(guardarComoPrincipal());

    expect(await screen.findByText("¿Quitar secciones de la versión?")).toBeInTheDocument();
    expect(screen.getByText(/Sus criterios y preguntas \(1 en total\) también se eliminarán/)).toBeInTheDocument();
    expect(api.guardarEstructura).not.toHaveBeenCalled();
    await userEvent.click(await screen.findByRole("button", { name: "Guardar y quitar" }));
    await waitFor(() => expect(api.guardarEstructura).toHaveBeenCalledWith(USUARIO, "p1", "v1", [datosSeccion(ATENCION, 50)]));
  });

  it("quitar una sección que se agregó hace un momento no pide confirmación", async () => {
    abrir();
    await cargado(2);
    await userEvent.selectOptions(screen.getByLabelText("Agregar sección"), "c3");
    await userEvent.click(screen.getByLabelText("Quitar Cumplimiento de metas"));
    await userEvent.selectOptions(screen.getByLabelText("Agregar sección"), "c4");
    api.guardarEstructura.mockResolvedValue(version("BORRADOR", [ATENCION, EQUIPO, ORDEN]));

    await userEvent.click(guardarComoPrincipal());

    await waitFor(() =>
      expect(api.guardarEstructura).toHaveBeenCalledWith(USUARIO, "p1", "v1", [
        datosSeccion(ATENCION, 50),
        datosSeccion(EQUIPO, 50),
        datosSeccionVacia(ORDEN),
      ]),
    );
  });

  it("si el servidor rechaza el guardado muestra los motivos y conserva los cambios", async () => {
    abrir();
    await cargado(2);
    await userEvent.selectOptions(screen.getByLabelText("Agregar sección"), "c3");
    api.guardarEstructura.mockRejectedValue(
      Object.assign(new Error("Datos inválidos"), { estado: 422, detalles: [{ campo: "secciones[2].id_competencia", mensaje: "La competencia está desactivada." }] }),
    );

    await userEvent.click(guardarComoPrincipal());

    expect(await screen.findByText("No se pudo guardar la estructura")).toBeInTheDocument();
    // En la alerta y junto a la sección que lo causó.
    expect(screen.getAllByText("La competencia está desactivada.")).toHaveLength(2);
    expect(nombresSecciones()).toHaveLength(3);
    expect(screen.getByText("Hay cambios sin guardar.")).toBeInTheDocument();
  });

  it("crea una competencia nueva y la agrega a la lista", async () => {
    abrir();
    await cargado(2);
    await userEvent.click(screen.getByRole("button", { name: "Nueva competencia" }));
    const dialogo = screen.getByRole("dialog");
    await userEvent.type(within(dialogo).getByLabelText(/Nombre/), "Orden y limpieza");
    await userEvent.selectOptions(within(dialogo).getByLabelText(/Tipo/), "FACTOR_OPERATIVO");
    api.crearCompetencia.mockResolvedValue(competencia(9, "Orden y limpieza", "FACTOR_OPERATIVO"));

    await userEvent.click(within(dialogo).getByRole("button", { name: "Crear y agregar" }));

    await waitFor(() =>
      expect(api.crearCompetencia).toHaveBeenCalledWith(USUARIO, { nombre: "Orden y limpieza", tipo: "FACTOR_OPERATIVO", descripcion: "" }),
    );
    await waitFor(() => expect(nombresSecciones()).toEqual(["Atención al cliente", "Trabajo en equipo", "Orden y limpieza"]));
    expect(screen.getByText("Competencia creada")).toBeInTheDocument();
  });

  it("la competencia nueva no se envía sin nombre ni tipo", async () => {
    abrir();
    await cargado(2);
    await userEvent.click(screen.getByRole("button", { name: "Nueva competencia" }));
    const dialogo = screen.getByRole("dialog");

    await userEvent.click(within(dialogo).getByRole("button", { name: "Crear y agregar" }));

    expect((await within(dialogo).findAllByText("El nombre es obligatorio.")).length).toBeGreaterThan(0);
    expect(api.crearCompetencia).not.toHaveBeenCalled();
  });

  it("avisa que ya existe una competencia con el mismo nombre", async () => {
    abrir();
    await cargado(2);
    await userEvent.click(screen.getByRole("button", { name: "Nueva competencia" }));
    const dialogo = screen.getByRole("dialog");
    await userEvent.type(within(dialogo).getByLabelText(/Nombre/), "Trabajo en equipo");
    await userEvent.selectOptions(within(dialogo).getByLabelText(/Tipo/), "COMPETENCIA_LABORAL");
    api.crearCompetencia.mockRejectedValue(
      Object.assign(new Error("Ya existe una competencia o factor con ese nombre."), {
        estado: 409,
        detalles: [{ campo: "nombre", mensaje: "Ya existe una competencia o factor con ese nombre." }],
      }),
    );

    await userEvent.click(within(dialogo).getByRole("button", { name: "Crear y agregar" }));

    expect(await within(dialogo).findByText("Ya existe esa competencia")).toBeInTheDocument();
    expect(nombresSecciones()).toHaveLength(2);
  });

  it("marca una competencia desactivada que quedó en la versión", async () => {
    api.obtenerVersion.mockResolvedValue(version("BORRADOR", [ATENCION, competencia(5, "Competencia vieja", "COMPETENCIA_LABORAL", { esta_activa: false })]));
    abrir();
    await cargado(2);
    expect(screen.getByText("Desactivada")).toBeInTheDocument();
    expect(screen.getByText(/La competencia «Competencia vieja» está desactivada/)).toBeInTheDocument();
  });

  it("edita los datos base mientras la plantilla no se haya publicado", async () => {
    abrir();
    await cargado(2);
    await userEvent.click(screen.getByRole("button", { name: "Editar datos" }));
    const dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByLabelText(/Nombre/)).toHaveValue("Evaluación de personal");
    api.actualizarPlantilla.mockResolvedValue({});

    await userEvent.click(within(dialogo).getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(api.actualizarPlantilla).toHaveBeenCalledWith(USUARIO, "p1", expect.objectContaining({ nombre: "Evaluación de personal", id_departamento: "d1" })));
    expect(await screen.findByText("Plantilla actualizada")).toBeInTheDocument();
  });
});

describe("Editor de la plantilla: criterios, preguntas y pesos", () => {
  it("muestra cada sección con sus criterios, preguntas, peso y escala, y el balance en 100 %", async () => {
    abrir();
    await cargado(2);
    const atencion = within(grupo("Atención al cliente"));
    expect(atencion.getByRole("textbox", { name: /^Criterio/ })).toHaveValue("Criterio de Atención al cliente");
    expect(atencion.getByRole("textbox", { name: /^Pregunta/ })).toHaveValue("Pregunta de Atención al cliente");
    expect(atencion.getByRole("spinbutton", { name: /Peso/ })).toHaveValue(50);
    expect(atencion.getByRole("combobox", { name: /Escala/ })).toHaveValue("e1");
    expect(screen.getByText("Balanceado")).toBeInTheDocument();
    expect(screen.getAllByText("1 criterio · 1 pregunta · 50 % del total")).toHaveLength(2);
  });

  it("al elegir la escala se ven las etiquetas de cada nivel, como las verá el evaluador", async () => {
    abrir();
    await cargado(2);
    const atencion = within(grupo("Atención al cliente"));
    expect(atencion.getByText("Muy deficiente")).toBeInTheDocument();
    expect(atencion.getByText("Excelente")).toBeInTheDocument();

    await userEvent.selectOptions(atencion.getByRole("combobox", { name: /Escala/ }), "e2");

    expect(atencion.getByText("No cumple")).toBeInTheDocument();
    expect(atencion.queryByText("Muy deficiente")).not.toBeInTheDocument();
  });

  it("agrega un criterio con su primera pregunta y una pregunta más a un criterio", async () => {
    abrir();
    await cargado(2);
    const atencion = within(grupo("Atención al cliente"));

    await userEvent.click(screen.getByLabelText("Agregar criterio a Atención al cliente"));

    expect(atencion.getAllByRole("textbox", { name: /^Criterio/ })).toHaveLength(2);
    expect(atencion.getAllByRole("textbox", { name: /^Pregunta/ })).toHaveLength(2);
    // La pregunta nueva parte con la primera escala del catálogo.
    expect(atencion.getAllByRole("combobox", { name: /Escala/ })[1]).toHaveValue("e1");
    expect(screen.getByText("Hay cambios sin guardar.")).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Agregar pregunta al criterio 1 de Atención al cliente"));
    expect(atencion.getAllByRole("textbox", { name: /^Pregunta/ })).toHaveLength(3);
  });

  it("quita una pregunta o un criterio y el balance se recalcula", async () => {
    abrir();
    await cargado(2);
    await userEvent.click(within(grupo("Atención al cliente")).getByLabelText("Eliminar pregunta 1"));
    expect(within(grupo("Atención al cliente")).queryByRole("textbox", { name: /^Pregunta/ })).not.toBeInTheDocument();
    expect(await screen.findByText("Faltan 50 %")).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Eliminar el criterio 1 de Atención al cliente"));
    expect(within(grupo("Atención al cliente")).queryByRole("textbox", { name: /^Criterio/ })).not.toBeInTheDocument();
    expect(within(grupo("Atención al cliente")).getByText(/Sin criterios todavía/)).toBeInTheDocument();
  });

  it("si los pesos no suman 100 % lo muestra y no deja publicar", async () => {
    abrir();
    await cargado(2);
    const peso = within(grupo("Atención al cliente")).getByRole("spinbutton", { name: /Peso/ });

    await userEvent.clear(peso);
    await userEvent.type(peso, "60");

    expect(await screen.findByText("Sobran 10 %")).toBeInTheDocument();
    expect(screen.getByText(/La suma de pesos es 110 %: sobran 10 %/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publicar" })).toBeDisabled();
  });

  it("los pesos con decimales suman en centésimas: 33,33 + 33,33 + 33,34 balancea", async () => {
    api.obtenerVersion.mockResolvedValue(version("BORRADOR", [ATENCION, EQUIPO, METAS]));
    abrir();
    await cargado(3);
    expect(screen.getByText("Balanceado")).toBeInTheDocument();
    expect(screen.queryByText("Antes de publicar esta versión")).not.toBeInTheDocument();
  });

  it("pide criterios en cada sección y preguntas en cada criterio antes de publicar", async () => {
    abrir();
    await cargado(2);
    await userEvent.selectOptions(screen.getByLabelText("Agregar sección"), "c3");
    expect(screen.getByText("La sección «Cumplimiento de metas» no tiene criterios: agregue al menos uno.")).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Agregar criterio a Cumplimiento de metas"));
    await userEvent.click(within(grupo("Cumplimiento de metas")).getByLabelText("Eliminar pregunta 1"));

    expect(screen.getByText(/no tiene preguntas: agregue al menos una/)).toBeInTheDocument();
  });

  it("guarda los criterios y preguntas editados con su peso, escala y obligatoriedad", async () => {
    abrir();
    await cargado(2);
    const atencion = within(grupo("Atención al cliente"));
    const criterio = atencion.getByRole("textbox", { name: /^Criterio/ });
    await userEvent.clear(criterio);
    await userEvent.type(criterio, "Trato");
    const pregunta = atencion.getByRole("textbox", { name: /^Pregunta/ });
    await userEvent.clear(pregunta);
    await userEvent.type(pregunta, "¿Saluda?");
    await userEvent.selectOptions(atencion.getByRole("combobox", { name: /Escala/ }), "e2");
    await userEvent.click(atencion.getByRole("checkbox", { name: /obligatoria/ }));
    api.guardarEstructura.mockResolvedValue(version("BORRADOR", [ATENCION, EQUIPO]));

    await userEvent.click(guardarComoPrincipal());

    await waitFor(() =>
      expect(api.guardarEstructura).toHaveBeenCalledWith(USUARIO, "p1", "v1", [
        {
          id_competencia: "c1",
          criterios: [
            { nombre: "Trato", descripcion: "", preguntas: [{ texto: "¿Saluda?", peso_porcentual: 50, es_obligatoria: false, id_escala: "e2" }] },
          ],
        },
        datosSeccion(EQUIPO, 50),
      ]),
    );
  });

  it("marca cada campo que el servidor rechaza, con su mensaje, y lo limpia al seguir editando", async () => {
    abrir();
    await cargado(2);
    api.guardarEstructura.mockRejectedValue(
      Object.assign(new Error("Datos de plantilla inválidos"), {
        estado: 400,
        detalles: [
          { campo: "secciones[0].criterios[0].preguntas[0].peso_porcentual", mensaje: "Ingrese un porcentaje mayor a 0." },
          { campo: "secciones[1].criterios[0].nombre", mensaje: "Ingrese un nombre de hasta 120 caracteres." },
        ],
      }),
    );
    await userEvent.click(screen.getByLabelText("Agregar pregunta al criterio 1 de Atención al cliente"));

    await userEvent.click(guardarComoPrincipal());

    expect(await within(grupo("Atención al cliente")).findByText("Ingrese un porcentaje mayor a 0.")).toBeInTheDocument();
    expect(within(grupo("Trabajo en equipo")).getByText("Ingrese un nombre de hasta 120 caracteres.")).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Agregar pregunta al criterio 1 de Atención al cliente"));
    // La alerta superior conserva la lista de motivos; la marca junto al campo desaparece.
    expect(within(grupo("Atención al cliente")).queryByText("Ingrese un porcentaje mayor a 0.")).not.toBeInTheDocument();
  });

  it("sin escalas en el catálogo avisa dónde crearlas", async () => {
    api.listarEscalas.mockResolvedValue([]);
    abrir();
    await cargado(2);
    expect(await screen.findByText("Todavía no hay escalas de valoración")).toBeInTheDocument();
  });

  it("si falla la carga de las escalas permite reintentar", async () => {
    api.listarEscalas.mockRejectedValueOnce(new Error("Sin conexión"));
    abrir();
    await cargado(2);
    expect(await screen.findByText("No se pudo cargar el catálogo de escalas de valoración")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(screen.queryByText("No se pudo cargar el catálogo de escalas de valoración")).not.toBeInTheDocument());
  });

  it("una versión publicada muestra su estructura sin poder modificarla", async () => {
    api.obtenerPlantilla.mockResolvedValue(plantilla("PUBLICADA"));
    api.obtenerVersion.mockResolvedValue(version("PUBLICADA", [ATENCION, EQUIPO]));
    abrir();
    await cargado(2);
    const atencion = within(grupo("Atención al cliente"));
    expect(atencion.getByRole("textbox", { name: /^Criterio/ })).toBeDisabled();
    expect(atencion.getByRole("textbox", { name: /^Pregunta/ })).toBeDisabled();
    expect(atencion.getByRole("spinbutton", { name: /Peso/ })).toBeDisabled();
    expect(screen.queryByLabelText("Agregar criterio a Atención al cliente")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Eliminar pregunta 1")).not.toBeInTheDocument();
  });
});

describe("Editor de la plantilla: publicación y estados", () => {
  it("con la vigencia terminada no ofrece una nueva versión y explica qué hacer", async () => {
    api.obtenerPlantilla.mockResolvedValue(plantilla("PUBLICADA", { vigencia_hasta: "2020-12-31" }));
    api.obtenerVersion.mockResolvedValue(version("PUBLICADA", [ATENCION, EQUIPO]));
    abrir();
    await cargado(2);
    expect(screen.queryByRole("button", { name: "Crear nueva versión" })).not.toBeInTheDocument();
    expect(screen.getByText(/cree una plantilla nueva/)).toBeInTheDocument();
  });

  it("una versión sin secciones lista el pendiente y no se puede publicar", async () => {
    api.obtenerVersion.mockResolvedValue(version("BORRADOR", []));
    abrir();
    expect(await screen.findByText("Antes de publicar esta versión")).toBeInTheDocument();
    expect(screen.getByText("Agregue al menos una sección de competencia o factor operativo.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publicar" })).toBeDisabled();
  });

  it("con una vigencia ya terminada lo indica y no deja publicar", async () => {
    api.obtenerPlantilla.mockResolvedValue(plantilla("BORRADOR", { vigencia_hasta: "2020-12-31" }));
    abrir();
    await cargado(2);
    expect(screen.getByText(/La vigencia terminó el/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publicar" })).toBeDisabled();
  });

  it("con cambios sin guardar no se puede publicar", async () => {
    abrir();
    await cargado(2);
    expect(screen.getByRole("button", { name: "Publicar" })).toBeEnabled();

    await userEvent.click(screen.getByLabelText("Bajar Atención al cliente"));

    expect(screen.getByRole("button", { name: "Publicar" })).toBeDisabled();
  });

  it("pide confirmación antes de publicar y no publica si se cancela", async () => {
    abrir();
    await cargado(2);
    await userEvent.click(screen.getByRole("button", { name: "Publicar" }));
    const confirmacion = await screen.findByRole("dialog", { name: "¿Publicar la plantilla?" });
    expect(within(confirmacion).getByText(/estructura base se bloqueará/)).toBeInTheDocument();

    await userEvent.click(within(confirmacion).getByRole("button", { name: "Cancelar" }));

    expect(api.publicarVersion).not.toHaveBeenCalled();
  });

  it("publica al confirmar: la versión queda en solo lectura y se ofrece crear una nueva", async () => {
    abrir();
    await cargado(2);
    await userEvent.click(screen.getByRole("button", { name: "Publicar" }));
    const confirmacion = await screen.findByRole("dialog", { name: "¿Publicar la plantilla?" });
    api.publicarVersion.mockResolvedValue(version("PUBLICADA", [ATENCION, EQUIPO]));
    api.obtenerPlantilla.mockResolvedValue(plantilla("PUBLICADA"));

    await userEvent.click(within(confirmacion).getByRole("button", { name: "Publicar" }));

    await waitFor(() => expect(api.publicarVersion).toHaveBeenCalledWith(USUARIO, "p1", "v1"));
    expect(await screen.findByText("Plantilla publicada")).toBeInTheDocument();
    expect(await screen.findByText(/ya está publicada: su estructura base no se puede modificar/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear nueva versión" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publicar" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Quitar Atención al cliente")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Agregar sección")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar datos" })).not.toBeInTheDocument();
    expect(nombresSecciones()).toEqual(["Atención al cliente", "Trabajo en equipo"]);
  });

  it("si el servidor encuentra pendientes al publicar los muestra todos", async () => {
    abrir();
    await cargado(2);
    await userEvent.click(screen.getByRole("button", { name: "Publicar" }));
    const confirmacion = await screen.findByRole("dialog", { name: "¿Publicar la plantilla?" });
    api.publicarVersion.mockRejectedValue(
      Object.assign(new Error("La plantilla no se puede publicar todavía."), {
        estado: 422,
        detalles: [
          { campo: "secciones", mensaje: "Primer pendiente del servidor." },
          { campo: "vigencia_hasta", mensaje: "Segundo pendiente del servidor." },
        ],
      }),
    );

    await userEvent.click(within(confirmacion).getByRole("button", { name: "Publicar" }));

    expect(await screen.findByText("No se pudo publicar la plantilla")).toBeInTheDocument();
    expect(screen.getByText("Primer pendiente del servidor.")).toBeInTheDocument();
    expect(screen.getByText("Segundo pendiente del servidor.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publicar" })).toBeEnabled();
  });

  it("una versión publicada se muestra en solo lectura con la opción de crear una nueva", async () => {
    api.obtenerPlantilla.mockResolvedValue(plantilla("PUBLICADA"));
    api.obtenerVersion.mockResolvedValue(version("PUBLICADA", [ATENCION, EQUIPO]));
    abrir();
    await cargado(2);
    expect(screen.getByText(/ya está publicada/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear nueva versión" })).toBeInTheDocument();
    expect(screen.queryByText("Todo guardado.")).not.toBeInTheDocument();
  });

  it("crea una nueva versión desde la publicada y pasa a editarla", async () => {
    api.obtenerPlantilla.mockResolvedValue(plantilla("PUBLICADA"));
    api.obtenerVersion.mockImplementation(async (empleado, idPlantilla, idVersion) =>
      idVersion === "v2" ? version("BORRADOR", [ATENCION], 2, "v2") : version("PUBLICADA", [ATENCION]),
    );
    abrir();
    await userEvent.click(await screen.findByRole("button", { name: "Crear nueva versión" }));
    api.crearVersion.mockResolvedValue(version("BORRADOR", [ATENCION], 2, "v2"));
    api.obtenerPlantilla.mockResolvedValue(
      plantilla("BORRADOR", {
        version_actual: { id_version: "v2", numero_version: 2 },
        fue_publicada: true,
        versiones: [
          { id_version: "v2", numero_version: 2, estado_codigo: "BORRADOR" },
          { id_version: "v1", numero_version: 1, estado_codigo: "PUBLICADA" },
        ],
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Crear nueva versión" }));

    await waitFor(() => expect(api.crearVersion).toHaveBeenCalledWith(USUARIO, "p1"));
    expect(await screen.findByText("Nueva versión en borrador (versión 2)")).toBeInTheDocument();
    expect(screen.getByText(/La versión 1 sigue publicada y vigente/)).toBeInTheDocument();
    expect(await screen.findByLabelText("Quitar Atención al cliente")).toBeInTheDocument();
    expect(screen.getByLabelText("Versión")).toBeInTheDocument();
  });

  it("si no se puede crear la nueva versión muestra el motivo", async () => {
    api.obtenerPlantilla.mockResolvedValue(plantilla("PUBLICADA"));
    api.obtenerVersion.mockResolvedValue(version("PUBLICADA", [ATENCION]));
    api.crearVersion.mockRejectedValue(new Error("La plantilla ya tiene una versión en borrador."));
    abrir();

    await userEvent.click(await screen.findByRole("button", { name: "Crear nueva versión" }));

    expect(await screen.findByText("No se pudo crear la nueva versión")).toBeInTheDocument();
    expect(screen.getByText("La plantilla ya tiene una versión en borrador.")).toBeInTheDocument();
  });

  it("con varias versiones permite consultar cada una, y una archivada es de solo lectura", async () => {
    api.obtenerPlantilla.mockResolvedValue(
      plantilla("PUBLICADA", {
        version_actual: { id_version: "v2", numero_version: 2 },
        versiones: [
          { id_version: "v2", numero_version: 2, estado_codigo: "PUBLICADA" },
          { id_version: "v1", numero_version: 1, estado_codigo: "ARCHIVADA" },
        ],
      }),
    );
    api.obtenerVersion.mockImplementation(async (empleado, idPlantilla, idVersion) =>
      idVersion === "v1" ? version("ARCHIVADA", [ATENCION], 1, "v1") : version("PUBLICADA", [ATENCION, EQUIPO], 2, "v2"),
    );
    abrir();
    await cargado(2);

    await userEvent.selectOptions(screen.getByLabelText("Versión"), "v1");

    await waitFor(() => expect(nombresSecciones()).toEqual(["Atención al cliente"]));
    expect(screen.getByText(/quedó archivada/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Crear nueva versión" })).not.toBeInTheDocument();
  });

  it("no se cambia de versión mientras haya cambios sin guardar", async () => {
    api.obtenerPlantilla.mockResolvedValue(
      plantilla("BORRADOR", {
        version_actual: { id_version: "v2", numero_version: 2 },
        fue_publicada: true,
        versiones: [
          { id_version: "v2", numero_version: 2, estado_codigo: "BORRADOR" },
          { id_version: "v1", numero_version: 1, estado_codigo: "PUBLICADA" },
        ],
      }),
    );
    api.obtenerVersion.mockResolvedValue(version("BORRADOR", [ATENCION, EQUIPO], 2, "v2"));
    abrir();
    await cargado(2);
    expect(screen.getByLabelText("Versión")).toBeEnabled();

    await userEvent.click(screen.getByLabelText("Quitar Trabajo en equipo"));

    expect(screen.getByLabelText("Versión")).toBeDisabled();
  });
});

describe("Editor de la plantilla: salir con cambios sin guardar", () => {
  it("pregunta antes de salir y permite quedarse", async () => {
    const router = abrir();
    await cargado(2);
    await userEvent.click(screen.getByLabelText("Quitar Trabajo en equipo"));

    router.navigate("/otra");

    expect(await screen.findByText("¿Salir sin guardar?")).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    expect(screen.queryByText("otra página")).not.toBeInTheDocument();
    expect(nombresSecciones()).toEqual(["Atención al cliente"]);
  });

  it("permite salir y perder los cambios si se confirma", async () => {
    const router = abrir();
    await cargado(2);
    await userEvent.click(screen.getByLabelText("Quitar Trabajo en equipo"));

    router.navigate("/otra");
    await screen.findByText("¿Salir sin guardar?");
    await userEvent.click(await screen.findByRole("button", { name: "Salir sin guardar" }));

    expect(await screen.findByText("otra página")).toBeInTheDocument();
  });

  it("sin cambios se sale directamente", async () => {
    const router = abrir();
    await cargado(2);

    router.navigate("/otra");

    expect(await screen.findByText("otra página")).toBeInTheDocument();
  });
});
