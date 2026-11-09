import { describe, expect, it } from "vitest";
import {
  alcanceVacio,
  alternarId,
  colaboradoresDelAlcance,
  estadoCiclo,
  formatearDia,
  formatearMomento,
  nombreDe,
  normalizar,
  rutaCiclo,
} from "./ciclo";

const empleado = (id, area, sucursal, activo = true) => ({ id_empleado: id, id_departamento: area, id_sucursal: sucursal, activo });
const EMPLEADOS = [
  empleado("e1", "A", "S1"),
  empleado("e2", "A", "S1"),
  empleado("e3", "A", "S2"),
  empleado("e4", "B", "S1"),
  empleado("e5", "A", "S1", false),
];
const ids = (lista) => lista.map((e) => e.id_empleado);
const alcance = (cambios) => ({ ...alcanceVacio(), ...cambios });

describe("colaboradoresDelAlcance: la misma regla con la que el servicio genera las asignaciones", () => {
  it("un área incluye a sus colaboradores activos", () => {
    expect(ids(colaboradoresDelAlcance(EMPLEADOS, alcance({ areas: ["A"] })))).toEqual(["e1", "e2", "e3"]);
  });

  it("área y sucursal juntas son una intersección", () => {
    expect(ids(colaboradoresDelAlcance(EMPLEADOS, alcance({ areas: ["A"], sucursales: ["S1"] })))).toEqual(["e1", "e2"]);
  });

  it("una sucursal sola incluye todas las áreas de esa sucursal", () => {
    expect(ids(colaboradoresDelAlcance(EMPLEADOS, alcance({ sucursales: ["S1"] })))).toEqual(["e1", "e2", "e4"]);
  });

  it("los colaboradores elegidos uno por uno se suman sin repetirse", () => {
    const resultado = colaboradoresDelAlcance(EMPLEADOS, alcance({ areas: ["A"], sucursales: ["S1"], colaboradores: ["e1", "e4"] }));
    expect(ids(resultado)).toEqual(["e1", "e2", "e4"]);
  });

  it("los inactivos nunca entran, ni por grupo ni elegidos a mano", () => {
    expect(ids(colaboradoresDelAlcance(EMPLEADOS, alcance({ areas: ["A"], colaboradores: ["e5"] })))).not.toContain("e5");
  });

  it("un alcance vacío no incluye a nadie", () => {
    expect(colaboradoresDelAlcance(EMPLEADOS, alcanceVacio())).toEqual([]);
  });
});

describe("alternarId", () => {
  it("agrega el id que falta y quita el que ya está, sin modificar la lista original", () => {
    const original = ["a", "b"];
    expect(alternarId(original, "c")).toEqual(["a", "b", "c"]);
    expect(alternarId(original, "a")).toEqual(["b"]);
    expect(original).toEqual(["a", "b"]);
  });
});

describe("formato", () => {
  it("una fecha de calendario no se corre un día por la zona horaria", () => {
    expect(formatearDia("2026-11-08")).toMatch(/08/);
    expect(formatearDia("2026-11-08")).toMatch(/2026/);
    expect(formatearDia("2026-01-01")).toMatch(/01/);
  });

  it("sin valor muestra un guion", () => {
    expect(formatearDia(null)).toBe("—");
    expect(formatearMomento(undefined)).toBe("—");
  });

  it("un momento se muestra con la hora de La Paz", () => {
    // 04:11 UTC del 8 de noviembre es la medianoche del 8 en La Paz (UTC-4): las 12:11 a. m. del mismo día, no del 7.
    const texto = formatearMomento("2026-11-08T04:11:00.000Z");
    expect(texto).toMatch(/08/);
    expect(texto).toMatch(/12:11/);
  });

  it("normalizar quita tildes y mayúsculas para buscar", () => {
    expect(normalizar("  Lucía Gutiérrez ")).toBe("  lucia gutierrez ");
    expect(normalizar(null)).toBe("");
  });

  it("nombreDe cae a un texto cuando no hay nombre", () => {
    expect(nombreDe({ nombre_completo: "Ana Jefa" })).toBe("Ana Jefa");
    expect(nombreDe(null)).toBe("Nombre no disponible");
  });

  it("los tres estados del ciclo tienen su etiqueta y un estado desconocido se muestra como cerrado", () => {
    expect(estadoCiclo("PROGRAMADO").texto).toBe("Programado");
    expect(estadoCiclo("ACTIVO").texto).toBe("Activo");
    expect(estadoCiclo("CERRADO").texto).toBe("Cerrado");
    expect(estadoCiclo("OTRO").texto).toBe("Cerrado");
  });

  it("la ruta de un ciclo cuelga de la pantalla de ciclos", () => {
    expect(rutaCiclo("abc")).toBe("/desempeno/ciclos/abc");
  });
});
