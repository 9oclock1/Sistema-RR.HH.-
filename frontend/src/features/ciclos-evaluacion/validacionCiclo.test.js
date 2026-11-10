import { describe, expect, it } from "vitest";
import {
  NOMBRE_MAX,
  PASOS,
  pasoDelCampo,
  validarAlcanceCiclo,
  validarNombreYFechas,
  validarPlantillaYPeriodo,
} from "./validacionCiclo";

const HOY = "2026-11-08";
const periodo = { nombre: "2026-S2", fecha_inicio: "2026-07-01", fecha_fin: "2026-12-31" };
const datos = (cambios = {}) => ({ nombre: "Evaluación de fin de año", fechaInicio: "2026-12-01", fechaLimite: "2026-12-31", ...cambios });
const validar = (cambios, opciones = {}) => validarNombreYFechas(datos(cambios), { periodo, hoy: HOY, ...opciones });

describe("pasos del asistente", () => {
  it("son cuatro, en el orden plantilla, fechas, alcance y revisión", () => {
    expect(PASOS.map((paso) => paso.id)).toEqual(["plantilla", "fechas", "alcance", "revision"]);
  });

  it("cada campo del servicio se asocia al paso donde se corrige", () => {
    expect(pasoDelCampo("id_version")).toBe("plantilla");
    expect(pasoDelCampo("id_periodo")).toBe("plantilla");
    expect(pasoDelCampo("nombre")).toBe("fechas");
    expect(pasoDelCampo("fecha_inicio")).toBe("fechas");
    expect(pasoDelCampo("fecha_limite")).toBe("fechas");
    expect(pasoDelCampo("alcance")).toBe("alcance");
    expect(pasoDelCampo("alcance.areas[0]")).toBe("alcance");
    expect(pasoDelCampo("alcance.colaboradores[3]")).toBe("alcance");
  });

  it("un campo desconocido no pertenece a ningún paso", () => {
    expect(pasoDelCampo("otro")).toBeNull();
    expect(pasoDelCampo(undefined)).toBeNull();
  });
});

describe("paso 1: plantilla y periodo", () => {
  it("exige las dos elecciones", () => {
    expect(validarPlantillaYPeriodo({ idVersion: "", idPeriodo: "" })).toEqual({
      id_version: "Seleccione la plantilla publicada que se usará.",
      id_periodo: "Seleccione el periodo de evaluación.",
    });
  });

  it("sin errores cuando ambas están elegidas", () => {
    expect(validarPlantillaYPeriodo({ idVersion: "v1", idPeriodo: "p1" })).toEqual({});
  });
});

describe("paso 2: nombre y fechas (criterio 1)", () => {
  it("acepta un nombre y fechas válidas", () => {
    expect(validar({})).toEqual({});
  });

  it("exige el nombre y lo limita a 120 caracteres", () => {
    expect(validar({ nombre: "   " }).nombre).toMatch(/hasta 120/);
    expect(validar({ nombre: "x".repeat(NOMBRE_MAX + 1) }).nombre).toMatch(/hasta 120/);
    expect(validar({ nombre: "x".repeat(NOMBRE_MAX) })).toEqual({});
  });

  it("exige las dos fechas", () => {
    expect(validar({ fechaInicio: "", fechaLimite: "" })).toEqual({
      fecha_inicio: "Ingrese la fecha de inicio.",
      fecha_limite: "Ingrese la fecha límite.",
    });
  });

  it("el inicio puede ser hoy, pero no un día anterior", () => {
    expect(validar({ fechaInicio: HOY })).toEqual({});
    expect(validar({ fechaInicio: "2026-11-07" }).fecha_inicio).toBe("La fecha de inicio no puede ser anterior a hoy.");
  });

  it("el inicio no puede ser anterior al inicio del periodo y el mensaje nombra el periodo", () => {
    const antes = validar({ fechaInicio: "2026-12-01" }, { periodo: { ...periodo, fecha_inicio: "2026-12-15" } });
    expect(antes.fecha_inicio).toMatch(/2026-S2/);
    expect(antes.fecha_inicio).toMatch(/anterior al inicio del periodo/);
  });

  it("el límite debe ser igual o posterior al inicio", () => {
    expect(validar({ fechaLimite: "2026-12-01" })).toEqual({});
    expect(validar({ fechaLimite: "2026-11-30" }).fecha_limite).toBe("Debe ser igual o posterior a la fecha de inicio.");
  });

  it("el límite puede superar el fin del periodo: se evalúa cuando el periodo ya terminó", () => {
    expect(validar({ fechaLimite: "2027-01-31" })).toEqual({});
  });

  it("un límite que ya pasó se rechaza", () => {
    const errores = validar({ fechaInicio: "2026-11-01", fechaLimite: "2026-11-05" });
    expect(errores.fecha_limite).toBe("La fecha límite no puede ser anterior a hoy.");
  });

  it("valida sin periodo elegido (no se puede comparar con su inicio)", () => {
    expect(validarNombreYFechas(datos(), { hoy: HOY })).toEqual({});
  });
});

describe("paso 3: alcance", () => {
  it("exige al menos un área, una sucursal o un colaborador", () => {
    expect(validarAlcanceCiclo({ areas: [], sucursales: [], colaboradores: [] })).toEqual({
      alcance: "Seleccione al menos un área, una sucursal o un colaborador.",
    });
  });

  it("basta con una sola de las tres listas", () => {
    expect(validarAlcanceCiclo({ areas: ["a"], sucursales: [], colaboradores: [] })).toEqual({});
    expect(validarAlcanceCiclo({ areas: [], sucursales: ["s"], colaboradores: [] })).toEqual({});
    expect(validarAlcanceCiclo({ areas: [], sucursales: [], colaboradores: ["e"] })).toEqual({});
  });
});
