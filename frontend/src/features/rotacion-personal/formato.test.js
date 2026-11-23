import { describe, expect, it } from "vitest";
import {
  claseCausal,
  describirTendencia,
  detalleKpi,
  escalaEje,
  estadoDe,
  formatearPorcentaje,
  nombrePeriodo,
  nombrePeriodoCorto,
  opcionesPeriodo,
  restarMeses,
  segmentosAnillo,
  textoMeta,
  textoTramo,
} from "./formato";

describe("periodos", () => {
  it("nombra el mes en español", () => {
    expect(nombrePeriodo("2026-11")).toBe("noviembre 2026");
    expect(nombrePeriodoCorto("2026-01")).toBe("ene 26");
  });

  it("resta meses cruzando el año", () => {
    expect(restarMeses("2026-02", 3)).toBe("2025-11");
    expect(restarMeses("2026-12", 12)).toBe("2025-12");
  });

  it("ofrece el mes actual como «Este mes» y los anteriores", () => {
    const opciones = opcionesPeriodo("2026-01-15", 3);
    expect(opciones).toEqual([
      { valor: "2026-01", etiqueta: "Este mes (enero 2026)" },
      { valor: "2025-12", etiqueta: "Diciembre 2025" },
      { valor: "2025-11", etiqueta: "Noviembre 2025" },
    ]);
  });
});

describe("textos de los indicadores", () => {
  it("porcentaje con coma decimal y guion sin dato", () => {
    expect(formatearPorcentaje(3.4)).toBe("3,4%");
    expect(formatearPorcentaje(90)).toBe("90%");
    expect(formatearPorcentaje(0)).toBe("0%");
    expect(formatearPorcentaje(null)).toBe("—");
  });

  it("la meta indica el sentido", () => {
    expect(textoMeta({ meta: 3, sentido: "menor" })).toBe("Meta: ≤ 3%");
    expect(textoMeta({ meta: 90, sentido: "mayor" })).toBe("Meta: ≥ 90%");
  });

  it("el tramo dice qué rango cubre cada KPI", () => {
    expect(textoTramo({ codigo: "KPI-10" }, { periodo: "2026-11", esMesActual: true })).toBe("Este mes, al día de hoy");
    expect(textoTramo({ codigo: "KPI-10" }, { periodo: "2026-10", esMesActual: false })).toBe("Mes de octubre 2026");
    expect(textoTramo({ codigo: "KPI-11" }, { periodo: "2026-10", esMesActual: false })).toBe("12 meses hasta octubre 2026");
  });

  it("el detalle usa singular y plural", () => {
    expect(detalleKpi({ codigo: "KPI-10", detalle: { bajas: 1, plantilla_promedio: 67.5 } })).toBe(
      "1 baja sobre una plantilla promedio de 67,5"
    );
    expect(detalleKpi({ codigo: "KPI-11", detalle: { siguen_activos: 56, empleados_inicio: 62 } })).toBe(
      "56 de 62 colaboradores siguen en planilla"
    );
    expect(detalleKpi({ codigo: "KPI-12", detalle: { bajas_tempranas: 3, ingresos: 1 } })).toBe(
      "3 bajas antes de los 90 días sobre 1 ingreso"
    );
  });

  it("cada estado del semáforo lleva texto e ícono; uno desconocido es «Sin datos»", () => {
    expect(estadoDe("verde").texto).toBe("Cumple la meta");
    expect(estadoDe("amarillo").tono).toBe("aviso");
    expect(estadoDe("rojo").icono).toBeTruthy();
    expect(estadoDe("otro").texto).toBe("Sin datos");
  });
});

describe("gráficos", () => {
  it("el eje Y usa pasos redondos, a lo sumo 5 divisiones y deja ver la meta", () => {
    expect(escalaEje([1.6, 4.3, null], 3)).toEqual({ tope: 5, divisiones: 5 });
    expect(escalaEje([7.5], 3)).toEqual({ tope: 8, divisiones: 4 });
    expect(escalaEje([12.4], 3)).toEqual({ tope: 12.5, divisiones: 5 });
    expect(escalaEje([null, null], 15)).toEqual({ tope: 25, divisiones: 5 });
  });

  it("los segmentos del anillo suman la circunferencia y omiten las causales en cero", () => {
    const items = [
      { codigo: "RENUNCIA", cantidad: 3 },
      { codigo: "DESPIDO_LEGAL", cantidad: 0 },
      { codigo: "DESAHUCIO", cantidad: 1 },
    ];
    const segmentos = segmentosAnillo(items, 100);
    expect(segmentos.map((s) => [s.codigo, s.largo, s.desplazamiento])).toEqual([
      ["RENUNCIA", 75, -0],
      ["DESAHUCIO", 25, -75],
    ]);
    expect(segmentos[1].clase).toBe("rp-causal--4");
    expect(segmentosAnillo([{ codigo: "RENUNCIA", cantidad: 0 }], 100)).toEqual([]);
  });

  it("cada causal conserva su color; una nueva toma uno de reserva", () => {
    expect(claseCausal("RENUNCIA")).toBe("rp-causal--1");
    expect(claseCausal("OTRA", 4)).toBe("rp-causal--5");
  });

  it("describe la tendencia para lectores de pantalla", () => {
    const tendencia = [
      { periodo: "2025-12", valor: 1.6 },
      { periodo: "2026-01", valor: 4.3 },
      { periodo: "2026-02", valor: null },
    ];
    expect(describirTendencia(tendencia)).toBe(
      "Rotación mensual de diciembre 2025 a febrero 2026. Valor más alto: 4,3% en enero 2026. Último mes: —."
    );
    expect(describirTendencia([{ periodo: "2026-01", valor: null }])).toBe("Sin datos de rotación en los últimos 12 meses.");
  });
});
