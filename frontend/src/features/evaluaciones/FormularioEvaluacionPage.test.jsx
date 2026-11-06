import { MemoryRouter, Route, Routes } from "react-router";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorApi } from "../../api/cliente";
import { enviarEvaluacion, guardarRespuestas, listarCiclosEvaluacion, listarEvaluaciones, obtenerEvaluacion } from "../../api/evaluaciones";
import ProveedorAvisos from "../../components/ui/ProveedorAvisos";
import EvaluacionesPage from "./EvaluacionesPage";
import { RETRASO_AUTOGUARDADO_MS } from "./useAutoguardado";

vi.mock("../../api/evaluaciones");

const EVALUADOR = "f0000000-0000-4000-8000-000000000021";
const ID_EVALUACION = "f0000000-0000-4000-8000-000000000121";
const ESCALA = "00000000-0000-4000-8000-000000000001";
const P1 = "c0000000-0000-4000-8000-000000000001";
const P2 = "c0000000-0000-4000-8000-000000000002";
const P3 = "c0000000-0000-4000-8000-000000000003";
const nivelId = (valor) => `d0000000-0000-4000-8000-00000000000${valor}`;

const ETIQUETAS = ["Muy deficiente", "Deficiente", "Aceptable", "Bueno", "Excelente"];
const escala = {
  id_escala: ESCALA,
  nombre: "Likert de 1 a 5",
  tipo: "CUANTITATIVA",
  valor_maximo: 5,
  niveles: ETIQUETAS.map((etiqueta, i) => ({ id_nivel: nivelId(i + 1), valor: i + 1, etiqueta })),
};

const pregunta = (id, texto, obligatoria, respuestas) => {
  const valor = respuestas[id] ?? null;
  return {
    id_pregunta: id,
    texto,
    peso_porcentual: 20,
    es_obligatoria: obligatoria,
    orden: 1,
    id_escala: ESCALA,
    respuesta: valor ? { id_nivel: nivelId(valor), valor } : null,
  };
};

// Formulario como lo devuelve el servicio: 2 competencias, 3 preguntas (la tercera es opcional).
const formulario = (cambios = {}, respuestas = {}) => {
  const preguntas = [
    pregunta(P1, "¿Saluda y atiende al cliente con cortesía?", true, respuestas),
    pregunta(P2, "¿Resuelve las dudas del cliente con claridad?", true, respuestas),
    pregunta(P3, "¿Comparte información útil con el equipo?", false, respuestas),
  ];
  const respondidas = preguntas.filter((p) => p.respuesta).length;
  const obligatorias = preguntas.filter((p) => p.es_obligatoria && p.respuesta).length;
  return {
    id_evaluacion: ID_EVALUACION,
    estado_codigo: respondidas > 0 ? "BORRADOR" : "PENDIENTE",
    editable: true,
    colaborador: { id_empleado: "e-1", nombres: "Carlos", apellidos: "Rojas Vargas", nombre_completo: "Carlos Rojas Vargas", sucursal: "Sopocachi", departamento: "Atención al cliente" },
    ciclo: { id_ciclo: "ciclo-1", nombre: "Evaluación de desempeño 2099-S2", fecha_limite: "2099-12-31" },
    plantilla: { nombre: "Evaluación de personal de tienda", objetivo: "Medir la atención al cliente y el trabajo en equipo.", numero_version: 1 },
    puntaje_final: null,
    enviada_en: null,
    actualizado_en: "2030-12-01T10:00:00.000Z",
    progreso: { total: 3, respondidas, obligatorias_total: 2, obligatorias_respondidas: obligatorias },
    escalas: [escala],
    secciones: [
      {
        id_seccion: "s-1",
        orden: 1,
        competencia: { id_competencia: "c-1", nombre: "Atención al cliente", descripcion: "Trato al cliente", tipo: "COMPETENCIA_LABORAL" },
        criterios: [{ id_criterio: "cr-1", nombre: "Trato al cliente", descripcion: null, orden: 1, preguntas: [preguntas[0], preguntas[1]] }],
      },
      {
        id_seccion: "s-2",
        orden: 2,
        competencia: { id_competencia: "c-2", nombre: "Trabajo en equipo", descripcion: null, tipo: "COMPETENCIA_LABORAL" },
        criterios: [{ id_criterio: "cr-2", nombre: "Colaboración", descripcion: null, orden: 1, preguntas: [preguntas[2]] }],
      },
    ],
    resultado: null,
    ...cambios,
  };
};

const resultado = {
  puntaje_final: 85.56,
  secciones: [
    { id_seccion: "s-1", competencia: "Atención al cliente", peso_porcentual: 40, puntaje: 90, criterios: [] },
    { id_seccion: "s-2", competencia: "Trabajo en equipo", peso_porcentual: 20, puntaje: 80, criterios: [] },
  ],
};
const enviadaFormulario = () =>
  formulario({ estado_codigo: "ENVIADA", editable: false, puntaje_final: 85.56, enviada_en: "2030-12-01T14:30:00.000Z", resultado }, { [P1]: 5, [P2]: 4 });

const respuestaDeEnvio = { id_evaluacion: ID_EVALUACION, estado_codigo: "ENVIADA", puntaje_final: 85.56, enviada_en: "2030-12-01T14:30:00.000Z", resultado };

function abrir(id = ID_EVALUACION) {
  return render(
    <ProveedorAvisos>
      <MemoryRouter initialEntries={[`/desempeno/evaluaciones/${id}`]}>
        <Routes>
          <Route path="/desempeno/evaluaciones/:idEvaluacion?" element={<EvaluacionesPage />} />
        </Routes>
      </MemoryRouter>
    </ProveedorAvisos>,
  );
}

const grupo = (patron) => screen.getByRole("group", { name: patron });
const opcion = (patronGrupo, etiqueta) => within(grupo(patronGrupo)).getByRole("radio", { name: etiqueta });
// Un fieldset deshabilitado bloquea sus radios (:disabled) aunque la propiedad disabled de cada input siga en false.
const radiosEditables = () => screen.queryAllByRole("radio").filter((radio) => !radio.matches(":disabled"));
const botonesEnviar = () => screen.getAllByRole("button", { name: "Enviar evaluación" });
const estadoGuardado = () => document.querySelector(".ev-guardado__texto").textContent;
const SALUDA = /Saluda y atiende/;
const RESUELVE = /Resuelve las dudas/;

beforeEach(() => {
  localStorage.setItem("rrhh.idEmpleado", EVALUADOR);
  obtenerEvaluacion.mockResolvedValue(formulario());
  guardarRespuestas.mockResolvedValue({ id_evaluacion: ID_EVALUACION, estado_codigo: "BORRADOR", actualizado_en: "2030-12-01T10:05:00.000Z", progreso: {} });
  enviarEvaluacion.mockResolvedValue(respuestaDeEnvio);
  listarEvaluaciones.mockResolvedValue([]);
  listarCiclosEvaluacion.mockResolvedValue([]);
});

describe("Formulario: se arma desde la plantilla", () => {
  it("sin usuario de prueba lo pide y no consulta la evaluación", async () => {
    localStorage.clear();
    abrir();
    expect(await screen.findByText("Elija su usuario de prueba")).toBeInTheDocument();
    expect(obtenerEvaluacion).not.toHaveBeenCalled();
  });

  it("muestra una tarjeta por competencia, con sus criterios y preguntas", async () => {
    abrir();
    expect(await screen.findByRole("heading", { level: 1, name: "Evaluación de Carlos Rojas Vargas" })).toBeInTheDocument();

    expect(obtenerEvaluacion).toHaveBeenCalledWith(EVALUADOR, ID_EVALUACION);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(expect.arrayContaining(["Atención al cliente", "Trabajo en equipo"]));
    expect(screen.getByRole("heading", { level: 3, name: "Trato al cliente" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Colaboración" })).toBeInTheDocument();
    expect(screen.getAllByRole("group")).toHaveLength(3);
  });

  it("cada pregunta ofrece los niveles de su escala con su valor, y marca cuáles son obligatorias", async () => {
    const { container } = abrir();
    await screen.findByRole("heading", { level: 1 });

    const niveles = within(grupo(SALUDA)).getAllByRole("radio").map((r) => r.closest("label").textContent);
    expect(niveles).toEqual(["1 · Muy deficiente", "2 · Deficiente", "3 · Aceptable", "4 · Bueno", "5 · Excelente"]);
    expect(container.querySelectorAll(".ds-radios__requerido")).toHaveLength(2);
    expect(screen.getAllByText("(opcional)")).toHaveLength(1);
  });

  it("resume al colaborador, el ciclo, el estado y el avance", async () => {
    abrir();
    await screen.findByRole("heading", { level: 1 });
    const resumen = document.querySelector(".ev-resumen");

    expect(within(resumen).getByText("Sopocachi · Atención al cliente")).toBeInTheDocument();
    expect(within(resumen).getByText("Evaluación de desempeño 2099-S2")).toBeInTheDocument();
    expect(within(resumen).getByText("Pendiente")).toBeInTheDocument();
    expect(within(resumen).getByText(/0 de 2 obligatorias · 0 de 3 en total/)).toBeInTheDocument();
  });

  it("al volver a abrir un borrador aparecen las respuestas ya guardadas", async () => {
    obtenerEvaluacion.mockResolvedValue(formulario({}, { [P1]: 5 }));
    abrir();
    await screen.findByRole("heading", { level: 1 });

    expect(opcion(SALUDA, "5 · Excelente")).toBeChecked();
    expect(opcion(RESUELVE, "5 · Excelente")).not.toBeChecked();
    expect(screen.getByText("Borrador")).toBeInTheDocument();
    expect(within(document.querySelector(".ev-resumen")).getByText(/1 de 2 obligatorias/)).toBeInTheDocument();
  });
});

describe("Criterio 2: autoguardado como borrador", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  const esperarRetraso = () => act(async () => vi.advanceTimersByTimeAsync(RETRASO_AUTOGUARDADO_MS + 50));
  const configurar = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

  it("junta lo que el evaluador marca y lo guarda solo cuando se detiene, sin enviar la evaluación", async () => {
    const usuario = configurar();
    abrir();
    await screen.findByRole("heading", { level: 1 });

    await usuario.click(opcion(SALUDA, "3 · Aceptable"));
    await usuario.click(opcion(SALUDA, "4 · Bueno"));
    await usuario.click(opcion(RESUELVE, "2 · Deficiente"));
    expect(estadoGuardado()).toMatch(/Cambios sin guardar/);
    expect(guardarRespuestas).not.toHaveBeenCalled();

    await esperarRetraso();
    await waitFor(() => expect(estadoGuardado()).toMatch(/Guardado a las \d\d:\d\d/));
    expect(guardarRespuestas).toHaveBeenCalledTimes(1);
    expect(guardarRespuestas).toHaveBeenCalledWith(EVALUADOR, ID_EVALUACION, [
      { id_pregunta: P1, id_nivel: nivelId(4) },
      { id_pregunta: P2, id_nivel: nivelId(2) },
    ]);
    expect(enviarEvaluacion).not.toHaveBeenCalled();
    expect(screen.getByText("Borrador")).toBeInTheDocument();
  });

  it("el avance se actualiza al instante, antes de que termine el guardado", async () => {
    const usuario = configurar();
    abrir();
    await screen.findByRole("heading", { level: 1 });

    await usuario.click(opcion(SALUDA, "5 · Excelente"));
    expect(within(document.querySelector(".ev-resumen")).getByText(/1 de 2 obligatorias · 1 de 3 en total/)).toBeInTheDocument();
  });

  it("«Borrar respuesta» quita la elección y también se autoguarda", async () => {
    obtenerEvaluacion.mockResolvedValue(formulario({}, { [P1]: 5 }));
    const usuario = configurar();
    abrir();
    await screen.findByRole("heading", { level: 1 });

    await usuario.click(screen.getByRole("button", { name: /Borrar la respuesta de: ¿Saluda y atiende/ }));
    expect(opcion(SALUDA, "5 · Excelente")).not.toBeChecked();
    expect(screen.queryByRole("button", { name: /Borrar la respuesta/ })).not.toBeInTheDocument();

    await esperarRetraso();
    expect(guardarRespuestas).toHaveBeenCalledWith(EVALUADOR, ID_EVALUACION, [{ id_pregunta: P1, id_nivel: null }]);
  });

  it("si el guardado falla avisa, no pierde lo elegido y «Reintentar» lo vuelve a enviar", async () => {
    guardarRespuestas.mockRejectedValueOnce(new ErrorApi(500, "Error interno del servidor"));
    const usuario = configurar();
    abrir();
    await screen.findByRole("heading", { level: 1 });

    await usuario.click(opcion(SALUDA, "4 · Bueno"));
    await esperarRetraso();
    await waitFor(() => expect(estadoGuardado()).toMatch(/No se pudo guardar/));
    expect(opcion(SALUDA, "4 · Bueno")).toBeChecked();

    await usuario.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(estadoGuardado()).toMatch(/Guardado a las/));
    expect(guardarRespuestas).toHaveBeenCalledTimes(2);
    expect(guardarRespuestas).toHaveBeenLastCalledWith(EVALUADOR, ID_EVALUACION, [{ id_pregunta: P1, id_nivel: nivelId(4) }]);
  });

  it("si la evaluación ya no se puede modificar (409) recarga en solo lectura y explica el motivo", async () => {
    guardarRespuestas.mockRejectedValue(new ErrorApi(409, "La evaluación ya fue enviada y no se puede modificar."));
    obtenerEvaluacion.mockResolvedValueOnce(formulario()).mockResolvedValue(enviadaFormulario());
    const usuario = configurar();
    abrir();
    await screen.findByRole("heading", { level: 1 });

    await usuario.click(opcion(SALUDA, "1 · Muy deficiente"));
    await esperarRetraso();

    expect(await screen.findByText("La evaluación ya no se puede modificar")).toBeInTheDocument();
    expect(screen.getAllByText(/ya fue enviada y no se puede modificar/).length).toBeGreaterThan(0);
    expect(obtenerEvaluacion).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(radiosEditables()).toHaveLength(0));
    expect(opcion(SALUDA, "5 · Excelente")).toBeChecked();
  });
});

describe("Criterio 4: faltan obligatorias → resalta e impide el envío", () => {
  it("no envía nada, indica cuántas faltan y resalta cada pregunta pendiente", async () => {
    const usuario = userEvent.setup();
    abrir();
    await screen.findByRole("heading", { level: 1 });

    await usuario.click(botonesEnviar()[0]);

    const alerta = await screen.findByRole("alert");
    expect(within(alerta).getByText("Faltan 2 preguntas obligatorias por responder")).toBeInTheDocument();
    expect(within(alerta).getByText("¿Saluda y atiende al cliente con cortesía?")).toBeInTheDocument();
    expect(within(alerta).getByText("¿Resuelve las dudas del cliente con claridad?")).toBeInTheDocument();
    expect(screen.getAllByText("Esta pregunta es obligatoria.")).toHaveLength(2);
    expect(alerta).toHaveFocus();
    expect(enviarEvaluacion).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("la pregunta opcional nunca se señala como pendiente", async () => {
    const usuario = userEvent.setup();
    abrir();
    await screen.findByRole("heading", { level: 1 });
    await usuario.click(botonesEnviar()[0]);

    const alerta = await screen.findByRole("alert");
    expect(within(alerta).queryByText(/Comparte información útil/)).not.toBeInTheDocument();
  });

  it("cada enlace del resumen lleva el foco a su pregunta", async () => {
    const usuario = userEvent.setup();
    abrir();
    await screen.findByRole("heading", { level: 1 });
    await usuario.click(botonesEnviar()[0]);

    await usuario.click(within(await screen.findByRole("alert")).getByRole("link", { name: /Resuelve las dudas/ }));
    expect(grupo(RESUELVE).contains(document.activeElement)).toBe(true);
  });

  it("al responder una pendiente deja de señalarse y el conteo baja", async () => {
    const usuario = userEvent.setup();
    abrir();
    await screen.findByRole("heading", { level: 1 });
    await usuario.click(botonesEnviar()[0]);
    await screen.findByRole("alert");

    await usuario.click(opcion(SALUDA, "4 · Bueno"));
    const alerta = screen.getByRole("alert");
    expect(within(alerta).getByText("Faltan 1 pregunta obligatoria por responder")).toBeInTheDocument();
    expect(screen.getAllByText("Esta pregunta es obligatoria.")).toHaveLength(1);
  });

  it("si el servidor también las rechaza (422), las resalta igual", async () => {
    obtenerEvaluacion.mockResolvedValue(formulario({}, { [P1]: 5, [P2]: 4 }));
    enviarEvaluacion.mockRejectedValue(new ErrorApi(422, "Faltan 1 pregunta(s) obligatoria(s) por responder.", [{ campo: P2, id_pregunta: P2, mensaje: "Falta" }]));
    const usuario = userEvent.setup();
    abrir();
    await screen.findByRole("heading", { level: 1 });

    await usuario.click(botonesEnviar()[0]);
    await usuario.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Enviar evaluación" }));

    const alerta = await screen.findByRole("alert");
    expect(within(alerta).getByText("Faltan 1 pregunta obligatoria por responder")).toBeInTheDocument();
    expect(within(alerta).getByText("¿Resuelve las dudas del cliente con claridad?")).toBeInTheDocument();
  });
});

describe("Criterio 3: envío, puntaje y bloqueo", () => {
  beforeEach(() => obtenerEvaluacion.mockResolvedValue(formulario({}, { [P1]: 5, [P2]: 4 })));

  it("antes de enviar pide confirmación; «Cancelar» no envía nada", async () => {
    const usuario = userEvent.setup();
    abrir();
    await screen.findByRole("heading", { level: 1 });

    await usuario.click(botonesEnviar()[0]);
    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText("¿Enviar la evaluación?")).toBeInTheDocument();
    expect(within(dialogo).getByText(/quedará bloqueada/)).toBeInTheDocument();

    await usuario.click(within(dialogo).getByRole("button", { name: "Cancelar" }));
    expect(enviarEvaluacion).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("al confirmar envía, muestra el puntaje final con su desglose y bloquea la edición", async () => {
    const usuario = userEvent.setup();
    abrir();
    await screen.findByRole("heading", { level: 1 });

    await usuario.click(botonesEnviar()[0]);
    await usuario.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Enviar evaluación" }));

    expect(enviarEvaluacion).toHaveBeenCalledWith(EVALUADOR, ID_EVALUACION);
    const confirmacion = await screen.findByText("Evaluación enviada", { selector: ".ds-alerta__titulo" });
    expect(confirmacion.closest(".ds-alerta")).toHaveTextContent("85,56");
    expect(screen.getByRole("table", { name: "Puntaje por competencia" })).toHaveTextContent("Atención al cliente");

    // Bloqueo: ningún control para seguir editando ni para enviar de nuevo.
    expect(radiosEditables()).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Enviar evaluación" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Borrar la respuesta/ })).not.toBeInTheDocument();
    expect(opcion(SALUDA, "5 · Excelente")).toBeChecked();
    expect(screen.getByText(/Puntaje 90/)).toBeInTheDocument();
  });

  it("antes de confirmar guarda lo que quedaba pendiente, y nunca envía antes de guardar", async () => {
    obtenerEvaluacion.mockResolvedValue(formulario({}, { [P1]: 5 }));
    const usuario = userEvent.setup();
    abrir();
    await screen.findByRole("heading", { level: 1 });

    await usuario.click(opcion(RESUELVE, "4 · Bueno"));
    expect(guardarRespuestas).not.toHaveBeenCalled();
    await usuario.click(botonesEnviar()[0]);

    await screen.findByRole("dialog");
    expect(guardarRespuestas).toHaveBeenCalledWith(EVALUADOR, ID_EVALUACION, [{ id_pregunta: P2, id_nivel: nivelId(4) }]);
    expect(enviarEvaluacion).not.toHaveBeenCalled();

    await usuario.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Enviar evaluación" }));
    await waitFor(() => expect(enviarEvaluacion).toHaveBeenCalledTimes(1));
    expect(guardarRespuestas.mock.invocationCallOrder[0]).toBeLessThan(enviarEvaluacion.mock.invocationCallOrder[0]);
  });

  it("si no se pudo guardar lo pendiente, no envía y lo explica", async () => {
    obtenerEvaluacion.mockResolvedValue(formulario({}, { [P1]: 5 }));
    guardarRespuestas.mockRejectedValue(new ErrorApi(500, "Error interno del servidor"));
    const usuario = userEvent.setup();
    abrir();
    await screen.findByRole("heading", { level: 1 });

    await usuario.click(opcion(RESUELVE, "4 · Bueno"));
    await usuario.click(botonesEnviar()[0]);

    expect(await screen.findByText("No se pudieron guardar sus respuestas, por eso la evaluación no se envió. Inténtelo de nuevo.")).toBeInTheDocument();
    expect(enviarEvaluacion).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("si el envío falla por otro motivo lo muestra y la evaluación sigue editable", async () => {
    enviarEvaluacion.mockRejectedValue(new ErrorApi(500, "Error interno del servidor"));
    const usuario = userEvent.setup();
    abrir();
    await screen.findByRole("heading", { level: 1 });

    await usuario.click(botonesEnviar()[0]);
    await usuario.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Enviar evaluación" }));

    const alerta = await screen.findByRole("alert");
    expect(within(alerta).getByText("No se pudo enviar la evaluación")).toBeInTheDocument();
    expect(within(alerta).getByText("Error interno del servidor")).toBeInTheDocument();
    expect(botonesEnviar().length).toBeGreaterThan(0);
  });

  it("si otra sesión ya la envió (409) recarga en solo lectura con el motivo", async () => {
    enviarEvaluacion.mockRejectedValue(new ErrorApi(409, "La evaluación ya fue enviada y no se puede modificar."));
    obtenerEvaluacion.mockResolvedValueOnce(formulario({}, { [P1]: 5, [P2]: 4 })).mockResolvedValue(enviadaFormulario());
    const usuario = userEvent.setup();
    abrir();
    await screen.findByRole("heading", { level: 1 });

    await usuario.click(botonesEnviar()[0]);
    await usuario.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Enviar evaluación" }));

    expect(await screen.findByText("La evaluación ya no se puede modificar")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("button", { name: "Enviar evaluación" })).not.toBeInTheDocument());
  });
});

describe("Solo lectura: evaluaciones enviadas y vencidas", () => {
  it("una evaluación enviada se abre con su resultado y sin posibilidad de cambiarla", async () => {
    obtenerEvaluacion.mockResolvedValue(enviadaFormulario());
    abrir();
    await screen.findByRole("heading", { level: 1 });

    expect(screen.getByText("Evaluación enviada", { selector: ".ds-alerta__titulo" }).closest(".ds-alerta")).toHaveTextContent("85,56");
    expect(radiosEditables()).toHaveLength(0);
    expect(opcion(SALUDA, "5 · Excelente")).toBeChecked();
    expect(opcion(RESUELVE, "4 · Bueno")).toBeChecked();
    expect(screen.queryByRole("button", { name: "Enviar evaluación" })).not.toBeInTheDocument();
    expect(document.querySelector(".ev-guardado")).toBeNull();
  });

  it("una evaluación vencida avisa que ya no se puede responder y no ofrece enviarla", async () => {
    obtenerEvaluacion.mockResolvedValue(formulario({ estado_codigo: "VENCIDA", editable: false }, { [P1]: 3 }));
    abrir();
    await screen.findByRole("heading", { level: 1 });

    expect(screen.getByText("Esta evaluación venció")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar evaluación" })).not.toBeInTheDocument();
    expect(radiosEditables()).toHaveLength(0);
    expect(opcion(SALUDA, "3 · Aceptable")).toBeChecked();
  });
});

describe("Acceso y errores al abrir la evaluación", () => {
  it("la evaluación de otro evaluador (403) muestra el motivo y solo ofrece volver", async () => {
    obtenerEvaluacion.mockRejectedValue(new ErrorApi(403, "Esta evaluación está asignada a otro evaluador."));
    abrir();

    const alerta = await screen.findByRole("alert");
    expect(within(alerta).getByText("No se pudo abrir la evaluación")).toBeInTheDocument();
    expect(within(alerta).getByText("Esta evaluación está asignada a otro evaluador.")).toBeInTheDocument();
    expect(within(alerta).queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
    expect(within(alerta).getByRole("link", { name: "Volver a las evaluaciones" })).toHaveAttribute("href", "/desempeno/evaluaciones");
  });

  it("una evaluación inexistente (404) lo dice claramente", async () => {
    obtenerEvaluacion.mockRejectedValue(new ErrorApi(404, "Evaluación no encontrada"));
    abrir();
    expect(await screen.findByText("No se encontró la evaluación")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
  });

  it("un fallo del servidor (500) permite reintentar", async () => {
    obtenerEvaluacion.mockRejectedValueOnce(new ErrorApi(500, "Error interno del servidor"));
    const usuario = userEvent.setup();
    abrir();

    await usuario.click(await screen.findByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Evaluación de Carlos Rojas Vargas" })).toBeInTheDocument();
    expect(obtenerEvaluacion).toHaveBeenCalledTimes(2);
  });

  it("«Volver a las evaluaciones» regresa a la bandeja", async () => {
    const usuario = userEvent.setup();
    abrir();
    await screen.findByRole("heading", { level: 1, name: "Evaluación de Carlos Rojas Vargas" });

    await usuario.click(screen.getAllByRole("link", { name: "Volver a las evaluaciones" })[0]);
    expect(await screen.findByRole("heading", { level: 1, name: "Evaluaciones" })).toBeInTheDocument();
    expect(listarEvaluaciones).toHaveBeenCalled();
  });
});
