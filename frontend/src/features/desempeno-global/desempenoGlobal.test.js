import { describe, expect, it } from "vitest";
import {
  anchoBarra,
  armarMensajeSimulado,
  describirBarra,
  describirDiferencia,
  describirMetricasCrm,
  estadoGrupo,
  estadoMensajeCrm,
  estadoSolicitudCrm,
  formatearMinutos,
  opcionesDe,
  puntajeOGuion,
  validarUmbral,
} from "./desempenoGlobal";

describe("formato del puntaje", () => {
  it("muestra hasta 2 decimales con coma y un guion si no hay dato", () => {
    expect(puntajeOGuion(72.2)).toBe("72,2");
    expect(puntajeOGuion(86.39)).toBe("86,39");
    expect(puntajeOGuion(60)).toBe("60");
    expect(puntajeOGuion(null)).toBe("—");
    expect(puntajeOGuion(undefined)).toBe("—");
    expect(formatearMinutos(48.5)).toBe("48,5 min");
    expect(formatearMinutos(null)).toBe("—");
  });

  it("la barra va de 0 a 100 y no se desborda", () => {
    expect(anchoBarra(58.33)).toBe("58.33%");
    expect(anchoBarra(150)).toBe("100%");
    expect(anchoBarra(-5)).toBe("0%");
    expect(anchoBarra(null)).toBe("0%");
  });

  it("describe la diferencia con el promedio global con su signo", () => {
    expect(describirDiferencia(3.07)).toBe("+3,07");
    expect(describirDiferencia(-21.49)).toBe("−21,49");
    expect(describirDiferencia(0)).toBe("Igual al promedio");
    expect(describirDiferencia(null)).toBe("—");
  });
});

describe("brecha de productividad", () => {
  it("marca la brecha con texto e icono, no solo con color", () => {
    const brecha = estadoGrupo({ es_brecha: true, sin_datos: false });
    expect(brecha).toMatchObject({ tono: "peligro", texto: "Brecha", brecha: true });
    expect(brecha.icono).toBeTruthy();
    expect(estadoGrupo({ es_brecha: false, sin_datos: false })).toMatchObject({ tono: "exito", brecha: false });
  });

  it("un grupo sin evaluaciones enviadas es «Sin datos», nunca brecha", () => {
    expect(estadoGrupo({ es_brecha: false, sin_datos: true })).toMatchObject({ tono: "neutral", texto: "Sin datos", brecha: false });
  });

  it("describe cada barra completa para lectores de pantalla", () => {
    const brecha = { nombre: "Recursos Humanos", puntaje: 50, es_brecha: true, sin_datos: false, puntos_bajo_umbral: 10 };
    expect(describirBarra(brecha, 60)).toBe("Recursos Humanos: 50 de 100, umbral 60. Brecha de 10 puntos bajo el umbral");
    expect(describirBarra({ ...brecha, nombre: "Atención", puntaje: 74.56, es_brecha: false }, 60)).toBe(
      "Atención: 74,56 de 100, umbral 60",
    );
    expect(describirBarra({ nombre: "Compras", puntaje: null, sin_datos: true }, 60)).toBe("Compras: sin evaluaciones enviadas");
  });
});

describe("métricas del CRM", () => {
  it("indica cuando un colaborador no tiene métricas", () => {
    expect(describirMetricasCrm(null)).toBe("Sin métricas del CRM");
    expect(describirMetricasCrm({ cantidad_quejas: 9, cantidad_felicitaciones: 1, minutos_resolucion_promedio: 48.5 })).toBe(
      "9 quejas · 1 felicitaciones · 48,5 min",
    );
    expect(describirMetricasCrm({ cantidad_quejas: 0, cantidad_felicitaciones: 8, minutos_resolucion_promedio: null })).toBe(
      "0 quejas · 8 felicitaciones · —",
    );
  });

  it("traduce los estados de la solicitud y de los mensajes, con un respaldo para los desconocidos", () => {
    expect(estadoSolicitudCrm("ENTREGADO").texto).toBe("Publicada en Pub/Sub");
    expect(estadoSolicitudCrm("FALLIDO").tono).toBe("peligro");
    expect(estadoSolicitudCrm("OMITIDO").texto).toBe("No aplica");
    expect(estadoSolicitudCrm("OTRO").texto).toBe("OTRO");
    expect(estadoMensajeCrm("EN_DLQ")).toMatchObject({ tono: "peligro", texto: "En cola de errores" });
    expect(estadoMensajeCrm("PROCESADO").tono).toBe("exito");
    expect(estadoMensajeCrm("X").texto).toBe("X");
  });
});

describe("validación del umbral", () => {
  it.each([
    ["60", 60],
    ["72,5", 72.5],
    ["72.5", 72.5],
    ["0", 0],
    ["100", 100],
    ["  85,25 ", 85.25],
  ])("acepta %s", (texto, esperado) => {
    expect(validarUmbral(texto)).toEqual({ valor: esperado });
  });

  it.each([
    ["", "Escriba el umbral."],
    ["   ", "Escriba el umbral."],
    ["abc", "Use un número de 0 a 100 con hasta 2 decimales."],
    ["-1", "Use un número de 0 a 100 con hasta 2 decimales."],
    ["60,123", "Use un número de 0 a 100 con hasta 2 decimales."],
    ["101", "El umbral no puede superar 100."],
    ["100,5", "El umbral no puede superar 100."],
  ])("rechaza %j", (texto, mensaje) => {
    expect(validarUmbral(texto)).toEqual({ error: mensaje });
  });
});

describe("mensaje simulado del CRM", () => {
  const colaboradores = [
    { id_empleado: "e-1", crm: null },
    { id_empleado: "e-2", crm: { cantidad_quejas: 1 } },
    { id_empleado: "e-3", crm: { cantidad_quejas: 2 } },
    { id_empleado: "e-4", crm: { cantidad_quejas: 3 } },
  ];

  it("arma la respuesta B → F con el formato que el servicio valida", () => {
    const mensaje = JSON.parse(armarMensajeSimulado({ idCiclo: "c-1", periodo: "2026-T3", colaboradores, idMensaje: "id-fijo" }));
    expect(mensaje.encabezado).toMatchObject({
      id_mensaje: "id-fijo",
      origen: { grupo: "B", modulo: "CRM" },
      destino: { grupo: "F", modulo: "RRHH" },
      tipo: "METRICAS_DESEMPENO_CRM",
      version_esquema: 1,
    });
    expect(mensaje.datos).toMatchObject({ id_ciclo: "c-1", periodo: { nombre: "2026-T3" } });
    expect(mensaje.datos.metricas.map((m) => m.id_empleado)).toEqual(["e-2", "e-3"]);
    expect(mensaje.datos.metricas[0]).toEqual({
      id_empleado: "e-2",
      cantidad_quejas: 2,
      cantidad_felicitaciones: 5,
      minutos_resolucion_promedio: 18.5,
    });
  });

  it("si nadie tiene métricas todavía, toma al primer colaborador", () => {
    const mensaje = JSON.parse(
      armarMensajeSimulado({ idCiclo: "c-1", periodo: "2026-T3", colaboradores: colaboradores.slice(0, 1), idMensaje: "x" }),
    );
    expect(mensaje.datos.metricas.map((m) => m.id_empleado)).toEqual(["e-1"]);
  });

  it("cada ejemplo lleva un id distinto, para poder probar un duplicado enviando dos veces el mismo texto", () => {
    const uno = JSON.parse(armarMensajeSimulado({ idCiclo: "c", periodo: "p", colaboradores }));
    const otro = JSON.parse(armarMensajeSimulado({ idCiclo: "c", periodo: "p", colaboradores }));
    expect(uno.encabezado.id_mensaje).not.toBe(otro.encabezado.id_mensaje);
  });
});

describe("opciones de filtro", () => {
  it("agrupa por id sin repetir y ordena por nombre", () => {
    const lista = [
      { id_sucursal: "s-2", sucursal: "Sopocachi" },
      { id_sucursal: "s-1", sucursal: "Miraflores" },
      { id_sucursal: "s-2", sucursal: "Sopocachi" },
    ];
    expect(opcionesDe(lista, "id_sucursal", "sucursal")).toEqual([
      { valor: "s-1", etiqueta: "Miraflores" },
      { valor: "s-2", etiqueta: "Sopocachi" },
    ]);
  });
});
