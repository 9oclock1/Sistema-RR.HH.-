import { describe, expect, it } from "vitest";
import {
  ESTADOS_PLANTILLA,
  OPCIONES_ESTADO,
  coincideConBusqueda,
  esEditable,
  formatearVigencia,
  hoyLaPaz,
  resumirSecciones,
} from "./formato";

const plantilla = {
  nombre: "Evaluación de personal de tienda",
  objetivo: "Medir la atención al cliente.",
  area: { nombre: "Atención al cliente" },
};

describe("coincideConBusqueda", () => {
  it("sin texto de búsqueda coincide con todo", () => {
    expect(coincideConBusqueda(plantilla, "")).toBe(true);
    expect(coincideConBusqueda(plantilla, "   ")).toBe(true);
  });

  it("busca en el nombre, el objetivo y el área, sin importar mayúsculas ni tildes", () => {
    expect(coincideConBusqueda(plantilla, "TIENDA")).toBe(true);
    expect(coincideConBusqueda(plantilla, "evaluacion")).toBe(true);
    expect(coincideConBusqueda(plantilla, "medir la atencion")).toBe(true);
    expect(coincideConBusqueda(plantilla, "atención al cliente")).toBe(true);
  });

  it("no coincide con lo que no aparece", () => {
    expect(coincideConBusqueda(plantilla, "almacén")).toBe(false);
  });
});

describe("resumirSecciones", () => {
  const laboral = { tipo_codigo: "COMPETENCIA_LABORAL" };
  const operativo = { tipo_codigo: "FACTOR_OPERATIVO" };

  it("describe una lista vacía", () => {
    expect(resumirSecciones([])).toBe("Sin secciones");
  });

  it("cuenta cada tipo con su singular o plural", () => {
    expect(resumirSecciones([laboral])).toBe("1 competencia laboral");
    expect(resumirSecciones([operativo, operativo])).toBe("2 factores operativos");
    expect(resumirSecciones([laboral, laboral, operativo])).toBe("2 competencias laborales · 1 factor operativo");
  });
});

describe("estados y vigencia", () => {
  it("solo se edita una plantilla que nunca se publicó", () => {
    expect(esEditable({ fue_publicada: false })).toBe(true);
    expect(esEditable({ fue_publicada: true })).toBe(false);
  });

  it("tiene un texto y un tono para cada estado, y las opciones del filtro los incluyen", () => {
    expect(Object.keys(ESTADOS_PLANTILLA)).toEqual(["BORRADOR", "PUBLICADA", "ARCHIVADA"]);
    expect(OPCIONES_ESTADO.map((o) => o.valor)).toEqual(["BORRADOR", "PUBLICADA", "ARCHIVADA"]);
    expect(OPCIONES_ESTADO.map((o) => o.etiqueta)).toEqual(["Borrador", "Publicada", "Archivada"]);
  });

  it("muestra la vigencia como un rango", () => {
    expect(formatearVigencia("2027-01-01", "2027-12-31")).toMatch(/2027.+–.+2027/);
  });

  it("hoyLaPaz devuelve la fecha de hoy como AAAA-MM-DD", () => {
    expect(hoyLaPaz()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
