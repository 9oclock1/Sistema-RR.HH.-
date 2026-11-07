import { describe, expect, it } from "vitest";
import { LIMITES, pendientesPublicacion, validarDatosCompetencia, validarDatosPlantilla } from "./validacionPlantilla";

const completa = {
  nombre: "Evaluación de tienda",
  id_departamento: "area-1",
  objetivo: "Medir la atención al cliente.",
  vigencia_desde: "2027-01-01",
  vigencia_hasta: "2027-12-31",
};

describe("validarDatosPlantilla", () => {
  it("no encuentra errores en una plantilla completa", () => {
    expect(validarDatosPlantilla(completa)).toEqual({});
  });

  it("pide cada dato obligatorio, tratando los espacios como vacío", () => {
    const errores = validarDatosPlantilla({
      nombre: "   ",
      id_departamento: "",
      objetivo: "  ",
      vigencia_desde: "",
      vigencia_hasta: "",
    });
    expect(Object.keys(errores)).toEqual(["nombre", "id_departamento", "objetivo", "vigencia_desde", "vigencia_hasta"]);
  });

  it("limita el largo del nombre y del objetivo, y acepta justo el máximo", () => {
    expect(validarDatosPlantilla({ ...completa, nombre: "n".repeat(LIMITES.nombre + 1) }).nombre).toMatch(/120/);
    expect(validarDatosPlantilla({ ...completa, objetivo: "o".repeat(LIMITES.objetivo + 1) }).objetivo).toMatch(/1000/);
    expect(validarDatosPlantilla({ ...completa, nombre: "n".repeat(LIMITES.nombre), objetivo: "o".repeat(LIMITES.objetivo) })).toEqual({});
  });

  it("rechaza fechas que no existen en el calendario", () => {
    expect(validarDatosPlantilla({ ...completa, vigencia_desde: "2027-02-30" }).vigencia_desde).toMatch(/no es válida/);
    expect(validarDatosPlantilla({ ...completa, vigencia_hasta: "2027-13-01" }).vigencia_hasta).toMatch(/no es válida/);
  });

  it("exige que la vigencia no termine antes de empezar, pero admite un solo día", () => {
    expect(validarDatosPlantilla({ ...completa, vigencia_desde: "2027-06-01", vigencia_hasta: "2027-05-31" }).vigencia_hasta).toMatch(/anterior/);
    expect(validarDatosPlantilla({ ...completa, vigencia_desde: "2027-06-01", vigencia_hasta: "2027-06-01" })).toEqual({});
  });

  it("no compara las fechas si la de inicio ya tiene un error", () => {
    const errores = validarDatosPlantilla({ ...completa, vigencia_desde: "", vigencia_hasta: "2027-01-01" });
    expect(Object.keys(errores)).toEqual(["vigencia_desde"]);
  });
});

describe("validarDatosCompetencia", () => {
  it("acepta una competencia con nombre y tipo, y la descripción es opcional", () => {
    expect(validarDatosCompetencia({ nombre: "Orden", tipo: "FACTOR_OPERATIVO", descripcion: "" })).toEqual({});
  });

  it("pide el nombre y el tipo", () => {
    expect(Object.keys(validarDatosCompetencia({ nombre: " ", tipo: "", descripcion: "" }))).toEqual(["nombre", "tipo"]);
  });

  it("limita el largo del nombre y de la descripción", () => {
    expect(validarDatosCompetencia({ nombre: "n".repeat(101), tipo: "FACTOR_OPERATIVO", descripcion: "" }).nombre).toMatch(/100/);
    expect(validarDatosCompetencia({ nombre: "A", tipo: "FACTOR_OPERATIVO", descripcion: "d".repeat(256) }).descripcion).toMatch(/255/);
  });
});

describe("pendientesPublicacion", () => {
  const activa = { nombre: "Atención", esta_activa: true };
  const HOY = "2026-11-07";

  it("no hay pendientes con secciones activas y una vigencia que no terminó", () => {
    expect(pendientesPublicacion({ plantilla: { vigencia_hasta: "2027-12-31" }, secciones: [activa], hoy: HOY })).toEqual([]);
  });

  it("la vigencia que termina hoy todavía permite publicar, la de ayer no", () => {
    expect(pendientesPublicacion({ plantilla: { vigencia_hasta: HOY }, secciones: [activa], hoy: HOY })).toEqual([]);
    const pendientes = pendientesPublicacion({ plantilla: { vigencia_hasta: "2026-11-06" }, secciones: [activa], hoy: HOY });
    expect(pendientes).toHaveLength(1);
    expect(pendientes[0]).toMatch(/vigencia terminó/);
  });

  it("pide al menos una sección", () => {
    const pendientes = pendientesPublicacion({ plantilla: { vigencia_hasta: "2027-12-31" }, secciones: [], hoy: HOY });
    expect(pendientes).toEqual(["Agregue al menos una sección de competencia o factor operativo."]);
  });

  it("nombra cada competencia desactivada", () => {
    const pendientes = pendientesPublicacion({
      plantilla: { vigencia_hasta: "2027-12-31" },
      secciones: [activa, { nombre: "Orden", esta_activa: false }, { nombre: "Metas", esta_activa: false }],
      hoy: HOY,
    });
    expect(pendientes).toHaveLength(2);
    expect(pendientes[0]).toContain("Orden");
    expect(pendientes[1]).toContain("Metas");
  });
});
