import { describe, expect, it } from "vitest";
import { ErrorApi } from "../../api/cliente";
import {
  PERIODO_RE,
  esSinGenerar,
  formatearPorcentaje,
  formatearTasa,
  formatearUfv,
  nombreArchivoAportes,
  nombreArchivoTributaria,
  nombreArchivoZip,
} from "./planillasFiscales";

describe("planillas fiscales", () => {
  it("reconoce el error de una planilla que aún no se generó", () => {
    expect(esSinGenerar(new ErrorApi(404, "Todavía no se generó", undefined, "SIN_GENERAR"))).toBe(true);
    expect(esSinGenerar(new ErrorApi(404, "Planilla no encontrada"))).toBe(false);
    expect(esSinGenerar(new ErrorApi(409, "x", undefined, "SIN_GENERAR"))).toBe(false);
    expect(esSinGenerar(null)).toBe(false);
  });

  it("valida el periodo con el formato AAAA-MM", () => {
    expect(PERIODO_RE.test("2026-05")).toBe(true);
    expect(PERIODO_RE.test("2026-13")).toBe(false);
    expect(PERIODO_RE.test("2026-5")).toBe(false);
    expect(PERIODO_RE.test("")).toBe(false);
  });

  it("nombra los archivos descargados con el periodo", () => {
    expect(nombreArchivoTributaria("2026-05", "xlsx")).toBe("planilla-tributaria-2026-05.xlsx");
    expect(nombreArchivoAportes("2026-05", "CAJA_SALUD", "txt")).toBe("aportes-CAJA_SALUD-2026-05.txt");
    expect(nombreArchivoZip("2026-05")).toBe("planilla-aportes-2026-05.zip");
  });

  it("da formato a los porcentajes", () => {
    expect(formatearPorcentaje(13)).toMatch(/^13\s%$/);
    expect(formatearTasa(1.71)).toMatch(/^1,71\s%$/);
    expect(formatearTasa(10)).toMatch(/^10,00\s%$/);
  });

  it("da formato a la UFV con cinco decimales", () => {
    expect(formatearUfv(2.7184)).toBe("2,71840");
  });
});
