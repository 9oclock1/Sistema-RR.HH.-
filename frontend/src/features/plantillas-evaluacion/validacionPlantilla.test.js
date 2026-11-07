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
  const HOY = "2026-11-07";
  const vigente = { vigencia_hasta: "2027-12-31" };
  // Sección con un criterio y una pregunta; por omisión la pregunta pesa todo (100 %).
  const seccion = (nombre, { activa = true, peso = "100" } = {}) => ({
    competencia: { nombre, esta_activa: activa },
    criterios: [{ nombre: `Criterio de ${nombre}`, preguntas: [{ peso_porcentual: peso }] }],
  });
  const pendientes = (cambios) => pendientesPublicacion({ plantilla: vigente, secciones: [seccion("Atención")], hoy: HOY, ...cambios });

  it("no hay pendientes con una estructura completa, pesos que suman 100 % y una vigencia que no terminó", () => {
    expect(pendientes()).toEqual([]);
  });

  it("la vigencia que termina hoy todavía permite publicar, la de ayer no", () => {
    expect(pendientes({ plantilla: { vigencia_hasta: HOY } })).toEqual([]);
    const lista = pendientes({ plantilla: { vigencia_hasta: "2026-11-06" } });
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatch(/vigencia terminó/);
    expect(lista[0]).toMatch(/actualice las fechas/);
  });

  it("si la plantilla ya se publicó alguna vez, con la vigencia terminada ya no sirven las fechas: hay que crear otra", () => {
    const [mensaje] = pendientes({ plantilla: { vigencia_hasta: "2026-11-06", fue_publicada: true } });
    expect(mensaje).toMatch(/cree una plantilla nueva/);
  });

  it("pide al menos una sección", () => {
    expect(pendientes({ secciones: [] })).toEqual(["Agregue al menos una sección de competencia o factor operativo."]);
  });

  it("nombra cada competencia desactivada", () => {
    const lista = pendientes({
      secciones: [seccion("Atención", { peso: "33.33" }), seccion("Orden", { activa: false, peso: "33.33" }), seccion("Metas", { activa: false, peso: "33.34" })],
    });
    expect(lista).toHaveLength(2);
    expect(lista[0]).toContain("Orden");
    expect(lista[1]).toContain("Metas");
  });

  it("pide criterios en cada sección y preguntas en cada criterio, por nombre", () => {
    const lista = pendientes({
      secciones: [
        { competencia: { nombre: "Atención", esta_activa: true }, criterios: [] },
        { competencia: { nombre: "Equipo", esta_activa: true }, criterios: [{ nombre: "Colaboración", preguntas: [] }, { nombre: " ", preguntas: [] }] },
      ],
    });
    expect(lista).toEqual([
      "La sección «Atención» no tiene criterios: agregue al menos uno.",
      "El criterio «Colaboración» de la sección «Equipo» no tiene preguntas: agregue al menos una.",
      "El criterio «sin nombre» de la sección «Equipo» no tiene preguntas: agregue al menos una.",
    ]);
  });

  it("muestra cuánto falta o sobra cuando los pesos no suman 100 %", () => {
    expect(pendientes({ secciones: [seccion("Atención", { peso: "80" })] })[0]).toMatch(/80 %.*faltan 20 %/);
    expect(pendientes({ secciones: [seccion("Atención", { peso: "130" })] })[0]).toMatch(/130 %.*sobran 30 %/);
  });

  it("suma en centésimas: 33,33 + 33,33 + 33,34 es exactamente 100 %", () => {
    const secciones = [seccion("A", { peso: "33.33" }), seccion("B", { peso: "33.33" }), seccion("C", { peso: "33.34" })];
    expect(pendientes({ secciones })).toEqual([]);
  });
});
