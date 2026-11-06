import { describe, expect, it } from "vitest";
import {
  ACCIONES_EVALUACION,
  describirAvance,
  describirPlazo,
  esAbierta,
  ESTADOS_EVALUACION,
  formatearPuntaje,
  hoyEnBolivia,
  idCampoPregunta,
  TIPOS_COMPETENCIA,
} from "./formato";
import { RUTA_EVALUACIONES, rutaEvaluacion } from "./ruta";

describe("Fecha de hoy en Bolivia (hoyEnBolivia)", () => {
  it("usa la hora de La Paz (UTC-4), no la del servidor ni la del navegador", () => {
    // 02:00 UTC del 1 de diciembre todavía es 22:00 del 30 de noviembre en Bolivia.
    expect(hoyEnBolivia(new Date("2030-12-01T02:00:00Z"))).toBe("2030-11-30");
    expect(hoyEnBolivia(new Date("2030-12-01T12:00:00Z"))).toBe("2030-12-01");
  });

  it("devuelve el mismo formato AAAA-MM-DD en que llegan las fechas límite", () => {
    expect(hoyEnBolivia(new Date("2031-01-05T15:30:00Z"))).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });
});

describe("Plazo restante hasta la fecha límite (describirPlazo)", () => {
  const HOY = "2030-12-01";

  it("el día de la fecha límite avisa «Vence hoy» y al día siguiente «Vence mañana»", () => {
    expect(describirPlazo("2030-12-01", HOY)).toEqual({
      texto: "Vence hoy",
      tono: "corto",
    });
    expect(describirPlazo("2030-12-02", HOY)).toEqual({
      texto: "Vence mañana",
      tono: "corto",
    });
  });

  it("resalta el plazo cuando quedan 3 días o menos, como el recordatorio del servicio", () => {
    expect(describirPlazo("2030-12-04", HOY)).toEqual({
      texto: "Vence en 3 días",
      tono: "corto",
    });
    expect(describirPlazo("2030-12-05", HOY)).toEqual({
      texto: "Vence en 4 días",
      tono: "normal",
    });
    expect(describirPlazo("2030-12-31", HOY)).toEqual({
      texto: "Vence en 30 días",
      tono: "normal",
    });
  });

  it("pasada la fecha cuenta cuántos días hace que venció", () => {
    expect(describirPlazo("2030-11-30", HOY)).toEqual({
      texto: "Venció hace 1 día",
      tono: "vencido",
    });
    expect(describirPlazo("2030-11-28", HOY)).toEqual({
      texto: "Venció hace 3 días",
      tono: "vencido",
    });
  });

  it("cuenta bien entre meses y años", () => {
    expect(describirPlazo("2031-01-02", "2030-12-31")).toEqual({
      texto: "Vence en 2 días",
      tono: "corto",
    });
    expect(describirPlazo("2030-12-30", "2031-01-02")).toEqual({
      texto: "Venció hace 3 días",
      tono: "vencido",
    });
  });
});

describe("Avance de una evaluación (describirAvance)", () => {
  const abierta = (progreso) => ({
    estado_codigo: "BORRADOR",
    puntaje_final: null,
    progreso,
  });

  it("sin respuestas lo dice así", () => {
    expect(
      describirAvance(
        abierta({
          total: 6,
          respondidas: 0,
          obligatorias_total: 5,
          obligatorias_respondidas: 0,
        }),
      ),
    ).toBe("Sin respuestas");
  });

  it("muestra cuántas obligatorias lleva respondidas", () => {
    expect(
      describirAvance(
        abierta({
          total: 6,
          respondidas: 3,
          obligatorias_total: 5,
          obligatorias_respondidas: 2,
        }),
      ),
    ).toBe("2 de 5 obligatorias");
  });

  it("si la plantilla no tiene obligatorias cuenta las preguntas", () => {
    expect(
      describirAvance(
        abierta({
          total: 4,
          respondidas: 1,
          obligatorias_total: 0,
          obligatorias_respondidas: 0,
        }),
      ),
    ).toBe("1 de 4 preguntas");
  });

  it("una evaluación enviada muestra su puntaje con coma decimal", () => {
    const enviada = {
      estado_codigo: "ENVIADA",
      puntaje_final: 87.78,
      progreso: {
        total: 6,
        respondidas: 5,
        obligatorias_total: 5,
        obligatorias_respondidas: 5,
      },
    };
    expect(describirAvance(enviada)).toBe("Puntaje 87,78");
  });
});

describe("Puntaje, estados y acciones", () => {
  it("formatea el puntaje con hasta 2 decimales y sin ceros sobrantes", () => {
    expect(formatearPuntaje(87.78)).toBe("87,78");
    expect(formatearPuntaje(85.5)).toBe("85,5");
    expect(formatearPuntaje(100)).toBe("100");
  });

  it("solo las pendientes y los borradores se pueden responder", () => {
    expect(esAbierta({ estado_codigo: "PENDIENTE" })).toBe(true);
    expect(esAbierta({ estado_codigo: "BORRADOR" })).toBe(true);
    expect(esAbierta({ estado_codigo: "ENVIADA" })).toBe(false);
    expect(esAbierta({ estado_codigo: "VENCIDA" })).toBe(false);
  });

  it("cada estado tiene su etiqueta y su botón: Responder, Continuar o Ver", () => {
    expect(Object.keys(ESTADOS_EVALUACION)).toEqual([
      "PENDIENTE",
      "BORRADOR",
      "ENVIADA",
      "VENCIDA",
    ]);
    expect(ACCIONES_EVALUACION.PENDIENTE).toEqual({
      texto: "Responder",
      principal: true,
    });
    expect(ACCIONES_EVALUACION.BORRADOR).toEqual({
      texto: "Continuar",
      principal: true,
    });
    expect(ACCIONES_EVALUACION.ENVIADA).toEqual({
      texto: "Ver",
      principal: false,
    });
    expect(ACCIONES_EVALUACION.VENCIDA).toEqual({
      texto: "Ver",
      principal: false,
    });
  });

  it("traduce los tipos de competencia y arma los identificadores y rutas", () => {
    expect(TIPOS_COMPETENCIA.COMPETENCIA_LABORAL).toBe("Competencia laboral");
    expect(TIPOS_COMPETENCIA.FACTOR_OPERATIVO).toBe("Factor operativo");
    expect(idCampoPregunta("abc")).toBe("ev-pregunta-abc");
    expect(rutaEvaluacion("123")).toBe(`${RUTA_EVALUACIONES}/123`);
  });
});
