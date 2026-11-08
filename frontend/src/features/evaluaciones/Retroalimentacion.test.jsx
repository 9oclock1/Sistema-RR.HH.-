import { MemoryRouter, Route, Routes } from "react-router";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorApi } from "../../api/cliente";
import {
  enviarEvaluacion,
  guardarRespuestas,
  guardarRetroalimentacion,
  listarMisResultados,
  obtenerEvaluacion,
  obtenerMiResultado,
} from "../../api/evaluaciones";
import ProveedorAvisos from "../../components/ui/ProveedorAvisos";
import EvaluacionesPage from "./EvaluacionesPage";
import MisResultadosPage from "./MisResultadosPage";

vi.mock("../../api/evaluaciones");

const EMPLEADO = "f0000000-0000-4000-8000-000000000021";
const ID_EVALUACION = "f0000000-0000-4000-8000-000000000121";
const ESCALA = "00000000-0000-4000-8000-000000000001";
const P1 = "c0000000-0000-4000-8000-000000000001";
const P2 = "c0000000-0000-4000-8000-000000000002";
const nivelId = (valor) => `d0000000-0000-4000-8000-00000000000${valor}`;
const FUTURO = "2099-06-30";

const RETRO_VACIA = { fortalezas: null, aspectos_mejora: null, comentarios_generales: null, compromisos: [] };
const RETRO_GUARDADA = {
  fortalezas: "Atiende con amabilidad.",
  aspectos_mejora: "Mejorar el manejo de reclamos.",
  comentarios_generales: null,
  compromisos: [{ id_compromiso: "cp-1", descripcion: "Curso de reclamos complejos", fecha_objetivo: FUTURO }],
};
const resultado = {
  puntaje_final: 90,
  secciones: [{ id_seccion: "s-1", competencia: "Atención al cliente", peso_porcentual: 100, puntaje: 90, criterios: [] }],
};

const formulario = ({ respuestas = {}, ...cambios } = {}) => {
  const pregunta = (id, texto) => ({
    id_pregunta: id,
    texto,
    peso_porcentual: 50,
    es_obligatoria: true,
    orden: 1,
    id_escala: ESCALA,
    respuesta: respuestas[id] ? { id_nivel: nivelId(respuestas[id]), valor: respuestas[id] } : null,
  });
  return {
    id_evaluacion: ID_EVALUACION,
    estado_codigo: Object.keys(respuestas).length ? "BORRADOR" : "PENDIENTE",
    editable: true,
    colaborador: { nombre_completo: "Carlos Rojas Vargas", sucursal: "Sopocachi", departamento: "Atención al cliente" },
    ciclo: { id_ciclo: "ciclo-1", nombre: "Evaluación 2099-S2", fecha_limite: "2099-12-31" },
    plantilla: { nombre: "Personal de tienda", objetivo: "Medir la atención al cliente.", numero_version: 1 },
    puntaje_final: null,
    enviada_en: null,
    escalas: [
      {
        id_escala: ESCALA,
        nombre: "Likert",
        tipo: "CUANTITATIVA",
        valor_maximo: 5,
        niveles: [1, 2, 3, 4, 5].map((v) => ({ id_nivel: nivelId(v), valor: v, etiqueta: `Nivel ${v}` })),
      },
    ],
    secciones: [
      {
        id_seccion: "s-1",
        competencia: { nombre: "Atención al cliente", tipo: "COMPETENCIA_LABORAL" },
        criterios: [{ id_criterio: "cr-1", nombre: "Trato", preguntas: [pregunta(P1, "¿Saluda?"), pregunta(P2, "¿Resuelve dudas?")] }],
      },
    ],
    resultado: null,
    retroalimentacion: RETRO_VACIA,
    ...cambios,
  };
};
const completa = (cambios) => formulario({ respuestas: { [P1]: 5, [P2]: 4 }, ...cambios });

function abrirFormulario() {
  return render(
    <ProveedorAvisos>
      <MemoryRouter initialEntries={[`/desempeno/evaluaciones/${ID_EVALUACION}`]}>
        <Routes>
          <Route path="/desempeno/evaluaciones/:idEvaluacion?" element={<EvaluacionesPage />} />
        </Routes>
      </MemoryRouter>
    </ProveedorAvisos>,
  );
}

function abrirMisResultados(ruta = "/desempeno/mis-resultados") {
  return render(
    <ProveedorAvisos>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/desempeno/mis-resultados/:idEvaluacion?" element={<MisResultadosPage />} />
        </Routes>
      </MemoryRouter>
    </ProveedorAvisos>,
  );
}

const seccionFinal = () => screen.getByRole("heading", { level: 2, name: "Retroalimentación final" }).closest(".ev-retro");

beforeEach(() => {
  localStorage.setItem("rrhh.idEmpleado", EMPLEADO);
  guardarRespuestas.mockResolvedValue({ estado_codigo: "BORRADOR", progreso: {} });
  guardarRetroalimentacion.mockImplementation(async (id, idEv, cuerpo) => ({
    id_evaluacion: idEv,
    actualizado_en: "2030-12-01T10:05:00.000Z",
    retroalimentacion: {
      ...cuerpo,
      compromisos: cuerpo.compromisos.map((c, i) => ({ id_compromiso: `cp-${i}`, ...c })),
    },
  }));
  enviarEvaluacion.mockResolvedValue({ estado_codigo: "ENVIADA", puntaje_final: 90, enviada_en: "2030-12-01T14:30:00.000Z", resultado });
});

describe("Criterio 1: sección final con fortalezas, aspectos de mejora y comentarios", () => {
  it("queda bloqueada mientras faltan puntajes obligatorios", async () => {
    obtenerEvaluacion.mockResolvedValue(formulario({ respuestas: { [P1]: 5 } }));
    abrirFormulario();
    await screen.findByRole("heading", { level: 2, name: "Retroalimentación final" });
    expect(within(seccionFinal()).getByText(/Responda la pregunta obligatoria que falta/)).toBeInTheDocument();
    expect(within(seccionFinal()).queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("con los puntajes completos permite registrar los tres textos y los guarda", async () => {
    const usuario = userEvent.setup();
    obtenerEvaluacion.mockResolvedValue(completa());
    abrirFormulario();

    await usuario.type(await screen.findByRole("textbox", { name: "Fortalezas" }), "Atiende con amabilidad.");
    await usuario.type(screen.getByRole("textbox", { name: "Aspectos de mejora" }), "Reclamos complejos.");
    await usuario.type(screen.getByRole("textbox", { name: "Comentarios generales" }), "Buen semestre.");
    expect(screen.getByText("Cambios sin guardar")).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Guardar retroalimentación" }));

    await waitFor(() =>
      expect(guardarRetroalimentacion).toHaveBeenCalledWith(EMPLEADO, ID_EVALUACION, {
        fortalezas: "Atiende con amabilidad.",
        aspectos_mejora: "Reclamos complejos.",
        comentarios_generales: "Buen semestre.",
        compromisos: [],
      }),
    );
    await waitFor(() => expect(screen.queryByText("Cambios sin guardar")).not.toBeInTheDocument());
  });
});

describe("Criterio 2: cada compromiso con descripción y fecha objetivo", () => {
  it("agrega un compromiso y lo guarda con su descripción y su fecha", async () => {
    const usuario = userEvent.setup();
    obtenerEvaluacion.mockResolvedValue(completa());
    abrirFormulario();

    await usuario.click(await screen.findByRole("button", { name: "Agregar compromiso" }));
    await usuario.type(screen.getByRole("textbox", { name: /Compromiso 1/ }), "Curso de reclamos");
    await usuario.type(screen.getByLabelText(/Fecha objetivo/), FUTURO);
    await usuario.click(screen.getByRole("button", { name: "Guardar retroalimentación" }));

    await waitFor(() => expect(guardarRetroalimentacion).toHaveBeenCalled());
    expect(guardarRetroalimentacion.mock.calls[0][2].compromisos).toEqual([{ descripcion: "Curso de reclamos", fecha_objetivo: FUTURO }]);
  });

  it("sin descripción ni fecha no guarda y señala ambos campos", async () => {
    const usuario = userEvent.setup();
    obtenerEvaluacion.mockResolvedValue(completa());
    abrirFormulario();

    await usuario.click(await screen.findByRole("button", { name: "Agregar compromiso" }));
    await usuario.click(screen.getByRole("button", { name: "Guardar retroalimentación" }));

    expect(screen.getByText("Describa el compromiso.")).toBeInTheDocument();
    expect(screen.getByText("Indique la fecha objetivo.")).toBeInTheDocument();
    expect(guardarRetroalimentacion).not.toHaveBeenCalled();
  });

  it("muestra los errores que devuelve el servicio en su campo", async () => {
    const usuario = userEvent.setup();
    obtenerEvaluacion.mockResolvedValue(completa({ retroalimentacion: RETRO_GUARDADA }));
    guardarRetroalimentacion.mockRejectedValueOnce(
      new ErrorApi(400, "Datos inválidos", [{ campo: "compromisos[0].fecha_objetivo", mensaje: "La fecha objetivo no puede ser anterior a hoy." }]),
    );
    abrirFormulario();

    await usuario.type(await screen.findByRole("textbox", { name: "Comentarios generales" }), "x");
    await usuario.click(screen.getByRole("button", { name: "Guardar retroalimentación" }));
    expect(await screen.findByText("La fecha objetivo no puede ser anterior a hoy.")).toBeInTheDocument();
  });

  it("al enviar la evaluación guarda antes la retroalimentación pendiente", async () => {
    const usuario = userEvent.setup();
    obtenerEvaluacion.mockResolvedValue(completa());
    abrirFormulario();

    await usuario.type(await screen.findByRole("textbox", { name: "Fortalezas" }), "Puntual");
    await usuario.click(screen.getAllByRole("button", { name: "Enviar evaluación" })[0]);
    await waitFor(() => expect(guardarRetroalimentacion).toHaveBeenCalled());
    const dialogo = await screen.findByRole("dialog");
    await usuario.click(within(dialogo).getByRole("button", { name: "Enviar evaluación" }));
    await waitFor(() => expect(enviarEvaluacion).toHaveBeenCalled());
    expect(guardarRetroalimentacion.mock.invocationCallOrder[0]).toBeLessThan(enviarEvaluacion.mock.invocationCallOrder[0]);
  });
});

describe("Criterio 3: tras el envío la retroalimentación es de solo lectura", () => {
  it("el evaluador la ve sin campos para editarla", async () => {
    obtenerEvaluacion.mockResolvedValue(
      completa({ estado_codigo: "ENVIADA", editable: false, puntaje_final: 90, enviada_en: "2030-12-01T14:30:00.000Z", resultado, retroalimentacion: RETRO_GUARDADA }),
    );
    abrirFormulario();
    await screen.findByRole("heading", { level: 2, name: "Retroalimentación final" });
    const seccion = within(seccionFinal());
    expect(seccion.getByText("Atiende con amabilidad.")).toBeInTheDocument();
    expect(seccion.getByText("Curso de reclamos complejos")).toBeInTheDocument();
    expect(seccion.getByText("Solo lectura")).toBeInTheDocument();
    expect(seccion.queryByRole("textbox")).not.toBeInTheDocument();
    expect(seccion.queryByRole("button")).not.toBeInTheDocument();
  });

  it("el colaborador lista sus evaluaciones enviadas", async () => {
    listarMisResultados.mockResolvedValue([
      {
        id_evaluacion: ID_EVALUACION,
        ciclo: { id_ciclo: "c-1", nombre: "Evaluación 2099-S1" },
        plantilla: { nombre: "Personal de tienda" },
        evaluador: { nombre_completo: "Ana Pérez" },
        puntaje_final: 87.78,
        enviada_en: "2030-07-02T19:30:00.000Z",
        compromisos: 1,
      },
    ]);
    abrirMisResultados();
    expect(await screen.findByText("Evaluación 2099-S1")).toBeInTheDocument();
    expect(listarMisResultados).toHaveBeenCalledWith(EMPLEADO);
    expect(screen.getByText("Ana Pérez")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver el resultado/ })).toHaveAttribute("href", `/desempeno/mis-resultados/${ID_EVALUACION}`);
  });

  it("el colaborador ve su retroalimentación y compromisos sin posibilidad de editarlos", async () => {
    obtenerMiResultado.mockResolvedValue({
      id_evaluacion: ID_EVALUACION,
      editable: false,
      evaluador: { nombre_completo: "Ana Pérez" },
      ciclo: { nombre: "Evaluación 2099-S1" },
      plantilla: { nombre: "Personal de tienda", objetivo: "Medir la atención." },
      puntaje_final: 87.78,
      enviada_en: "2030-07-02T19:30:00.000Z",
      resultado,
      retroalimentacion: RETRO_GUARDADA,
    });
    abrirMisResultados(`/desempeno/mis-resultados/${ID_EVALUACION}`);

    await screen.findByRole("heading", { level: 2, name: "Retroalimentación final" });
    expect(obtenerMiResultado).toHaveBeenCalledWith(EMPLEADO, ID_EVALUACION);
    const seccion = within(seccionFinal());
    expect(seccion.getByText("Mejorar el manejo de reclamos.")).toBeInTheDocument();
    expect(seccion.getByText("Sin registrar")).toBeInTheDocument();
    expect(seccion.getByText("Curso de reclamos complejos")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Guardar/ })).not.toBeInTheDocument();
    expect(guardarRetroalimentacion).not.toHaveBeenCalled();
  });

  it("si la evaluación aún no se envió lo explica", async () => {
    obtenerMiResultado.mockRejectedValue(new ErrorApi(409, "Los resultados estarán disponibles cuando su evaluador envíe la evaluación."));
    abrirMisResultados(`/desempeno/mis-resultados/${ID_EVALUACION}`);
    expect(await screen.findByText(/estarán disponibles cuando su evaluador/)).toBeInTheDocument();
  });
});
