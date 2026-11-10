import { MemoryRouter } from "react-router";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorApi } from "../../api/cliente";
import {
  actualizarUmbralBrecha,
  listarCiclosCerrados,
  listarColaboradoresDelCiclo,
  listarMensajesCrm,
  obtenerConsolidado,
  reintentarSolicitudCrm,
  reprocesarMensajeCrm,
  simularMensajeCrm,
} from "../../api/desempenoGlobal";
import ProveedorAvisos from "../../components/ui/ProveedorAvisos";
import { cambiarRol } from "../../context/sesion";
import DesempenoGlobalPage from "./DesempenoGlobalPage";

vi.mock("../../api/desempenoGlobal");

const PERIODO = { id_periodo: "p-3", nombre: "2026-T3" };
const CICLO_T3 = {
  id_ciclo: "c-3",
  nombre: "Evaluación trimestral 2026-T3",
  periodo: PERIODO,
  fecha_inicio: "2026-09-28",
  fecha_limite: "2026-10-10",
  cerrado_en: "2026-10-12T12:00:00.000Z",
  umbral_brecha: 60,
  evaluaciones: { total: 9, enviadas: 8, vencidas: 1 },
};
const CICLO_S1 = {
  ...CICLO_T3,
  id_ciclo: "c-1",
  nombre: "Evaluación de desempeño 2026-S1",
  periodo: { id_periodo: "p-1", nombre: "2026-S1" },
  evaluaciones: { total: 3, enviadas: 2, vencidas: 1 },
};

const crm = (quejas, felicitaciones, minutos, cantidad) => ({
  colaboradores_con_metricas: cantidad,
  cantidad_quejas: quejas,
  cantidad_felicitaciones: felicitaciones,
  minutos_resolucion_promedio: minutos,
});
const competencia = (id, nombre, puntaje, esBrecha = false) => ({ id_competencia: id, competencia: nombre, puntaje, es_brecha: esBrecha });
const grupo = (id, nombre, cambios) => ({
  id,
  nombre,
  asignados: 1,
  evaluados: 1,
  evaluaciones_enviadas: 1,
  evaluaciones_vencidas: 0,
  sin_datos: false,
  es_brecha: false,
  puntos_bajo_umbral: 0,
  crm: crm(0, 0, null, 0),
  ...cambios,
});

const RRHH = grupo("d-2", "Recursos Humanos", {
  puntaje: 50,
  diferencia_global: -21.49,
  es_brecha: true,
  puntos_bajo_umbral: 10,
  competencia_mas_baja: competencia("co-3", "Puntualidad y orden", 40, true),
  competencias: [competencia("co-1", "Atención al cliente", 55, true), competencia("co-2", "Trabajo en equipo", 60), competencia("co-3", "Puntualidad y orden", 40, true)],
});
const ATENCION = grupo("d-1", "Atención al cliente", {
  asignados: 8,
  evaluados: 7,
  evaluaciones_enviadas: 7,
  evaluaciones_vencidas: 1,
  puntaje: 74.56,
  diferencia_global: 3.07,
  competencia_mas_baja: competencia("co-1", "Atención al cliente", 72, false),
  competencias: [competencia("co-1", "Atención al cliente", 72), competencia("co-2", "Trabajo en equipo", 75), competencia("co-3", "Puntualidad y orden", 77)],
  crm: crm(27, 20, 29, 6),
});
const MIRAFLORES = grupo("s-2", "Miraflores", { asignados: 4, evaluados: 3, puntaje: 58.33, diferencia_global: -13.16, es_brecha: true, puntos_bajo_umbral: 1.67, competencia_mas_baja: competencia("co-1", "Atención al cliente", 50, true), competencias: [], crm: crm(19, 4, 36, 3) });
const SOPOCACHI = grupo("s-1", "Sopocachi", { asignados: 5, evaluados: 5, puntaje: 79.38, diferencia_global: 7.89, competencia_mas_baja: competencia("co-1", "Atención al cliente", 75, false), competencias: [], crm: crm(8, 16, 22, 3) });

const consolidado = (cambios = {}) => ({
  ciclo: { ...CICLO_T3 },
  resumen: {
    promedio_global: 71.49,
    asignados: 9,
    evaluados: 8,
    cobertura_porcentual: 88.89,
    evaluaciones_enviadas: 8,
    evaluaciones_vencidas: 1,
    departamentos_en_brecha: 1,
    sucursales_en_brecha: 1,
  },
  departamentos: [RRHH, ATENCION],
  sucursales: [MIRAFLORES, SOPOCACHI],
  competencias: [competencia("co-1", "Atención al cliente", 70.75), competencia("co-2", "Trabajo en equipo", 72.5), competencia("co-3", "Puntualidad y orden", 71.88)],
  crm: {
    solicitud: { id_mensaje: "m-1", estado: "ENTREGADO", intentos: 1, ultimo_error: null, entregado_en: "2026-10-12T12:05:00.000Z", creado_en: "2026-10-12T12:00:00.000Z" },
    metricas_recibidas: 6,
    ...crm(27, 20, 29, 6),
  },
  ...cambios,
});

const colab = (id, nombre, cambios) => ({
  id_empleado: id,
  nombre_completo: nombre,
  id_departamento: "d-1",
  departamento: "Atención al cliente",
  id_sucursal: "s-1",
  sucursal: "Sopocachi",
  evaluaciones_enviadas: 1,
  evaluaciones_vencidas: 0,
  puntaje: 80,
  competencias: [],
  crm: null,
  bajo_umbral: false,
  ...cambios,
});
const COLABORADORES = {
  ciclo: CICLO_T3,
  umbral_brecha: 60,
  colaboradores: [
    colab("e-26", "Sofía Condori", { id_departamento: "d-2", departamento: "Recursos Humanos", puntaje: 50, bajo_umbral: true }),
    colab("e-33", "Diego Quispe", { id_sucursal: "s-2", sucursal: "Miraflores", puntaje: 53, bajo_umbral: true, crm: { cantidad_quejas: 9, cantidad_felicitaciones: 1, minutos_resolucion_promedio: 48.5 } }),
    colab("e-31", "Carlos Rojas", { puntaje: 92, crm: { cantidad_quejas: 1, cantidad_felicitaciones: 2, minutos_resolucion_promedio: 12.5 } }),
    colab("e-25", "Luis Vargas", { id_sucursal: "s-2", sucursal: "Miraflores", puntaje: null, evaluaciones_enviadas: 0, evaluaciones_vencidas: 1 }),
  ],
};

const MENSAJE_DLQ = {
  id_mensaje: "m-dlq",
  id_mensaje_externo: "c3b1f6a2-5d0e-4c11-9a52-7e8f0b1d2a02",
  tipo_evento: "METRICAS_DESEMPENO_CRM",
  estado: "EN_DLQ",
  intentos: 5,
  ultimo_error: "El mensaje no es un JSON válido.",
  recibido_en: "2026-10-13T13:00:00.000Z",
  procesado_en: null,
  metricas: 0,
  carga: "{",
};

function mostrar() {
  return render(
    <MemoryRouter>
      <ProveedorAvisos>
        <DesempenoGlobalPage />
      </ProveedorAvisos>
    </MemoryRouter>,
  );
}

const abrirPestana = (usuario, nombre) => usuario.click(screen.getByRole("tab", { name: new RegExp(`^${nombre}`) }));

beforeEach(() => {
  vi.resetAllMocks();
  cambiarRol("admin");
  listarCiclosCerrados.mockResolvedValue([CICLO_T3, CICLO_S1]);
  obtenerConsolidado.mockImplementation(async (_rol, id) => (id === "c-1" ? consolidado({ ciclo: CICLO_S1 }) : consolidado()));
  listarColaboradoresDelCiclo.mockResolvedValue(COLABORADORES);
  listarMensajesCrm.mockResolvedValue([MENSAJE_DLQ]);
  actualizarUmbralBrecha.mockResolvedValue({ id_ciclo: "c-3", umbral_brecha: 70 });
  reprocesarMensajeCrm.mockResolvedValue({ ...MENSAJE_DLQ, estado: "PROCESADO" });
  reintentarSolicitudCrm.mockResolvedValue({ estado: "PENDIENTE" });
  simularMensajeCrm.mockResolvedValue({ id_mensaje: "m-9", estado: "RECIBIDO", duplicado: false });
});

describe("consolidado de un ciclo cerrado", () => {
  it("carga el ciclo más reciente con sus indicadores globales", async () => {
    mostrar();

    expect(await screen.findByRole("heading", { name: "Resultados de desempeño" })).toBeInTheDocument();
    expect(await screen.findByText("71,49")).toBeInTheDocument();
    expect(screen.getByText("88,89 %")).toBeInTheDocument();
    expect(screen.getByText(/8 de 9 con evaluación enviada · 1 vencida/)).toBeInTheDocument();
    expect(obtenerConsolidado).toHaveBeenCalledWith("admin", "c-3");
    expect(listarColaboradoresDelCiclo).toHaveBeenCalledWith("admin", "c-3");
    expect(screen.getByRole("combobox", { name: "Ciclo cerrado" })).toHaveValue("c-3");
  });

  it("resalta el área en brecha en el aviso, el gráfico, la tabla y los indicadores", async () => {
    mostrar();
    await screen.findByText("71,49");

    expect(screen.getByText("Brecha de productividad en 1 área")).toBeInTheDocument();
    expect(screen.getByText(/10 puntos bajo el umbral de 60/)).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Recursos Humanos: 50 de 100, umbral 60. Brecha de 10 puntos bajo el umbral" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Atención al cliente: 74,56 de 100, umbral 60" })).toBeInTheDocument();

    const tabla = screen.getByRole("table", { name: "Comparativa de desempeño por área" });
    const filaRrhh = within(tabla).getByRole("row", { name: /Recursos Humanos/ });
    expect(within(filaRrhh).getByText("Brecha")).toBeInTheDocument();
    expect(within(filaRrhh).getByText("−21,49")).toBeInTheDocument();
    expect(within(filaRrhh).getByText("Puntualidad y orden")).toBeInTheDocument();
    const filaAtencion = within(tabla).getByRole("row", { name: /Atención al cliente/ });
    expect(within(filaAtencion).getByText("Sobre el umbral")).toBeInTheDocument();
    expect(within(filaAtencion).getByText(/27 quejas · 20 felicitaciones/)).toBeInTheDocument();
    expect(within(filaAtencion).getByText("7 de 8")).toBeInTheDocument();

    const indicador = screen.getByText("Áreas en brecha").closest("div");
    expect(within(indicador).getByText("1")).toBeInTheDocument();
    expect(within(indicador).getByText("Recursos Humanos")).toBeInTheDocument();
  });

  it("muestra que ninguna área está bajo el umbral cuando no hay brechas", async () => {
    obtenerConsolidado.mockResolvedValue(
      consolidado({
        resumen: { ...consolidado().resumen, departamentos_en_brecha: 0, sucursales_en_brecha: 0 },
        departamentos: [{ ...ATENCION }],
        sucursales: [{ ...SOPOCACHI }],
      }),
    );
    mostrar();

    expect(await screen.findByText("Ninguna área quedó bajo el umbral de 60")).toBeInTheDocument();
    expect(screen.queryByText(/Brecha de productividad/)).not.toBeInTheDocument();
  });

  it("un área sin evaluaciones enviadas se muestra «Sin datos» y no como brecha", async () => {
    obtenerConsolidado.mockResolvedValue(
      consolidado({
        departamentos: [grupo("d-9", "Compras", { puntaje: null, sin_datos: true, diferencia_global: null, evaluados: 0, evaluaciones_enviadas: 0, evaluaciones_vencidas: 2, competencia_mas_baja: null, competencias: [] })],
      }),
    );
    mostrar();

    const tabla = await screen.findByRole("table", { name: "Comparativa de desempeño por área" });
    const fila = within(tabla).getByRole("row", { name: /Compras/ });
    expect(within(fila).getByText("Sin datos")).toBeInTheDocument();
    expect(within(fila).queryByText("Brecha")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Compras: sin evaluaciones enviadas" })).toBeInTheDocument();
  });

  it("compara sucursales en su propia pestaña", async () => {
    const usuario = userEvent.setup();
    mostrar();
    await screen.findByText("71,49");

    await abrirPestana(usuario, "Sucursales");

    expect(screen.getByText("Brecha de productividad en 1 sucursal")).toBeInTheDocument();
    const tabla = screen.getByRole("table", { name: "Comparativa de desempeño por sucursal" });
    expect(within(within(tabla).getByRole("row", { name: /Miraflores/ })).getByText("Brecha")).toBeInTheDocument();
    expect(within(within(tabla).getByRole("row", { name: /Sopocachi/ })).getByText("Sobre el umbral")).toBeInTheDocument();
  });

  it("cruza áreas y competencias y marca las celdas bajo el umbral", async () => {
    const usuario = userEvent.setup();
    mostrar();
    await screen.findByText("71,49");

    await abrirPestana(usuario, "Competencias");

    expect(screen.getByRole("img", { name: "Trabajo en equipo: 72,5 de 100, umbral 60" })).toBeInTheDocument();
    const matriz = screen.getByRole("table", { name: "Puntaje por competencia de cada área" });
    expect(within(matriz).getByRole("columnheader", { name: "Puntualidad y orden" })).toBeInTheDocument();
    const filaRrhh = within(matriz).getByRole("row", { name: /Recursos Humanos/ });
    expect(within(filaRrhh).getByText(/^40/)).toHaveTextContent("40 (bajo el umbral)");
    expect(within(filaRrhh).getByText(/^60/)).not.toHaveTextContent("bajo el umbral"); // igual al umbral: no es brecha
  });

  it("cambia de ciclo con el selector", async () => {
    const usuario = userEvent.setup();
    mostrar();
    await screen.findByText("71,49");

    await usuario.selectOptions(screen.getByRole("combobox", { name: "Ciclo cerrado" }), "c-1");

    await waitFor(() => expect(obtenerConsolidado).toHaveBeenCalledWith("admin", "c-1"));
    expect(listarColaboradoresDelCiclo).toHaveBeenCalledWith("admin", "c-1");
    expect(screen.getByText(/2 de 3 evaluaciones enviadas, 1 vencidas/)).toBeInTheDocument();
  });
});

describe("colaboradores y métricas del CRM", () => {
  it("asocia las métricas del CRM a cada colaborador y avisa de quien no las tiene", async () => {
    const usuario = userEvent.setup();
    mostrar();
    await screen.findByText("71,49");
    await abrirPestana(usuario, "Colaboradores");

    const tabla = screen.getByRole("table", { name: "Puntaje y métricas del CRM por colaborador" });
    const diego = within(tabla).getByRole("row", { name: /Diego Quispe/ });
    expect(within(diego).getByText("9")).toBeInTheDocument();
    expect(within(diego).getByText("48,5 min")).toBeInTheDocument();
    expect(within(diego).getByText("Bajo el umbral")).toBeInTheDocument();
    const sofia = within(tabla).getByRole("row", { name: /Sofía Condori/ });
    expect(within(sofia).getByText("Sin métricas del CRM")).toBeInTheDocument();
    const luis = within(tabla).getByRole("row", { name: /Luis Vargas/ });
    expect(within(luis).getByText("Sin evaluación enviada")).toBeInTheDocument();
    expect(within(luis).getByText("1 vencida(s)")).toBeInTheDocument();
    expect(within(within(tabla).getByRole("row", { name: /Carlos Rojas/ })).queryByText("Bajo el umbral")).not.toBeInTheDocument();
  });

  it("filtra por área y sucursal", async () => {
    const usuario = userEvent.setup();
    mostrar();
    await screen.findByText("71,49");
    await abrirPestana(usuario, "Colaboradores");

    await usuario.selectOptions(screen.getByRole("combobox", { name: "Sucursal" }), "s-2");

    const tabla = screen.getByRole("table", { name: "Puntaje y métricas del CRM por colaborador" });
    expect(within(tabla).getByText("Diego Quispe")).toBeInTheDocument();
    expect(within(tabla).getByText("Luis Vargas")).toBeInTheDocument();
    expect(within(tabla).queryByText("Carlos Rojas")).not.toBeInTheDocument();
    expect(screen.getByText("Se muestran 2 de 4 colaboradores.")).toBeInTheDocument();

    await usuario.selectOptions(screen.getByRole("combobox", { name: "Área" }), "d-2");
    expect(screen.getByText("Ningún colaborador coincide con los filtros")).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Quitar filtros" }));
    expect(within(screen.getByRole("table", { name: "Puntaje y métricas del CRM por colaborador" })).getByText("Carlos Rojas")).toBeInTheDocument();
  });
});

describe("solicitud de métricas al CRM", () => {
  it("informa que la solicitud se publicó y que el CRM ya respondió", async () => {
    mostrar();

    expect(await screen.findByText("Solicitud de métricas al CRM: Publicada en Pub/Sub")).toBeInTheDocument();
    expect(screen.getByText(/El CRM ya respondió con las métricas de 6 colaborador/)).toBeInTheDocument();
  });

  it("explica que la respuesta es asíncrona mientras no llegan métricas", async () => {
    obtenerConsolidado.mockResolvedValue(consolidado({ crm: { ...consolidado().crm, metricas_recibidas: 0, colaboradores_con_metricas: 0 } }));
    mostrar();

    expect(await screen.findByText(/aún no llegaron las métricas/)).toBeInTheDocument();
  });

  it("si la publicación falló, el administrador puede reintentarla", async () => {
    const usuario = userEvent.setup();
    const fallida = { ...consolidado().crm, solicitud: { id_mensaje: "m-1", estado: "FALLIDO", intentos: 8, ultimo_error: "No se pudo conectar con Pub/Sub", entregado_en: null, creado_en: "2026-10-12T12:00:00.000Z" } };
    obtenerConsolidado.mockResolvedValue(consolidado({ crm: fallida }));
    mostrar();

    expect(await screen.findByText(/No se pudo publicar tras 8 intento\(s\): No se pudo conectar con Pub\/Sub/)).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Reintentar publicación" }));

    expect(reintentarSolicitudCrm).toHaveBeenCalledWith("admin", "c-3");
    expect(await screen.findByText("Solicitud en cola")).toBeInTheDocument();
    await waitFor(() => expect(obtenerConsolidado).toHaveBeenCalledTimes(2));
  });

  it("explica por qué no se pidió nada cuando no hay cajeros ni asesores, y cuando no hay solicitud", async () => {
    const omitida = { ...consolidado().crm, solicitud: { id_mensaje: "m-1", estado: "OMITIDO", intentos: 0, ultimo_error: "Ningún evaluado del ciclo ocupa un cargo que mide el CRM.", entregado_en: null, creado_en: "2026-10-12T12:00:00.000Z" } };
    obtenerConsolidado.mockResolvedValueOnce(consolidado({ crm: omitida }));
    const { unmount } = mostrar();
    expect(await screen.findByText("Ningún evaluado del ciclo ocupa un cargo que mide el CRM.")).toBeInTheDocument();
    unmount();

    obtenerConsolidado.mockResolvedValueOnce(consolidado({ crm: { ...consolidado().crm, solicitud: null } }));
    mostrar();
    expect(await screen.findByText("Sin solicitud de métricas al CRM")).toBeInTheDocument();
  });
});

describe("mensajes del CRM y cola de errores", () => {
  async function abrirMensajes(usuario) {
    mostrar();
    await screen.findByText("71,49");
    await abrirPestana(usuario, "Mensajes del CRM");
    return screen.findByRole("table", { name: "Mensajes de métricas recibidos del CRM" });
  }

  it("lista la cola de errores con el motivo de cada mensaje", async () => {
    const usuario = userEvent.setup();
    const tabla = await abrirMensajes(usuario);

    expect(listarMensajesCrm).toHaveBeenCalledWith("admin", "EN_DLQ");
    const fila = within(tabla).getByRole("row", { name: /METRICAS_DESEMPENO_CRM/ });
    expect(within(fila).getByText("En cola de errores")).toBeInTheDocument();
    expect(within(fila).getByText("El mensaje no es un JSON válido.")).toBeInTheDocument();
    expect(within(fila).getByText("5")).toBeInTheDocument();
  });

  it("muestra un mensaje claro cuando la cola está vacía y permite ver otros estados", async () => {
    const usuario = userEvent.setup();
    listarMensajesCrm.mockResolvedValueOnce([]);
    await abrirMensajes(usuario);
    expect(await screen.findByText("La cola de errores está vacía")).toBeInTheDocument();

    await usuario.selectOptions(screen.getByRole("combobox", { name: "Mostrar" }), "PROCESADO");
    await waitFor(() => expect(listarMensajesCrm).toHaveBeenLastCalledWith("admin", "PROCESADO"));
  });

  it("el administrador reprocesa un mensaje y se actualiza el consolidado", async () => {
    const usuario = userEvent.setup();
    await abrirMensajes(usuario);
    listarMensajesCrm.mockResolvedValue([]);

    await usuario.click(screen.getByRole("button", { name: /Reprocesar el mensaje c3b1f6a2/ }));

    expect(reprocesarMensajeCrm).toHaveBeenCalledWith("admin", "m-dlq");
    expect(await screen.findByText("Mensaje reprocesado")).toBeInTheDocument();
    expect(await screen.findByText("La cola de errores está vacía")).toBeInTheDocument();
    await waitFor(() => expect(obtenerConsolidado).toHaveBeenCalledTimes(2));
  });

  it("si el reproceso vuelve a fallar, lo dice y el mensaje sigue en la cola", async () => {
    const usuario = userEvent.setup();
    reprocesarMensajeCrm.mockRejectedValue(new ErrorApi(422, "No se pudo reprocesar el mensaje: El ciclo indicado aún no está cerrado."));
    await abrirMensajes(usuario);

    await usuario.click(screen.getByRole("button", { name: /Reprocesar el mensaje/ }));

    expect(await screen.findByText("No se pudo reprocesar el mensaje")).toBeInTheDocument();
    expect(screen.getByText(/El ciclo indicado aún no está cerrado/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reprocesar el mensaje/ })).toBeEnabled();
  });

  it("el administrador simula la llegada de un mensaje del CRM", async () => {
    const usuario = userEvent.setup();
    await abrirMensajes(usuario);

    await usuario.click(screen.getByText("Simular la llegada de un mensaje del CRM"));
    const area = screen.getByRole("textbox", { name: "Mensaje del CRM (JSON)" });
    const enviado = JSON.parse(area.value);
    expect(enviado.encabezado).toMatchObject({ origen: { grupo: "B" }, destino: { grupo: "F" }, tipo: "METRICAS_DESEMPENO_CRM" });
    expect(enviado.datos).toMatchObject({ id_ciclo: "c-3", periodo: { nombre: "2026-T3" } });
    expect(enviado.datos.metricas.map((m) => m.id_empleado)).toEqual(["e-33", "e-31"]);

    await usuario.click(screen.getByRole("button", { name: "Enviar al sistema" }));
    expect(simularMensajeCrm).toHaveBeenCalledWith("admin", area.value);
    expect(await screen.findByText(/Mensaje recibido\. Se procesa en segundo plano/)).toBeInTheDocument();

    simularMensajeCrm.mockResolvedValue({ id_mensaje: "m-9", estado: "PROCESADO", duplicado: true });
    await usuario.click(screen.getByRole("button", { name: "Enviar al sistema" }));
    expect(await screen.findByText(/ya se había recibido \(Procesado\); se descartó sin cambiar nada/)).toBeInTheDocument();
  });

  it("muestra el error del servidor al simular un mensaje", async () => {
    const usuario = userEvent.setup();
    simularMensajeCrm.mockRejectedValue(new ErrorApi(403, "La simulación del CRM está desactivada (SIMULAR_CRM_ACTIVO=false)."));
    await abrirMensajes(usuario);

    await usuario.click(screen.getByText("Simular la llegada de un mensaje del CRM"));
    await usuario.click(screen.getByRole("button", { name: "Enviar al sistema" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("La simulación del CRM está desactivada");
  });
});

describe("umbral de brecha", () => {
  it("el administrador lo cambia y el consolidado se recalcula", async () => {
    const usuario = userEvent.setup();
    mostrar();
    await screen.findByText("71,49");
    expect(screen.getByText("60", { selector: "strong" })).toBeInTheDocument();

    await usuario.click(screen.getByRole("button", { name: "Cambiar umbral" }));
    const campo = screen.getByRole("textbox", { name: /Umbral de brecha/ });
    expect(campo).toHaveValue("60");
    await usuario.clear(campo);
    await usuario.type(campo, "70,5");
    await usuario.click(screen.getByRole("button", { name: "Guardar" }));

    expect(actualizarUmbralBrecha).toHaveBeenCalledWith("admin", "c-3", 70.5);
    expect(await screen.findByText("Umbral actualizado")).toBeInTheDocument();
    await waitFor(() => expect(obtenerConsolidado).toHaveBeenCalledTimes(2));
  });

  it("valida el valor antes de llamar al servidor", async () => {
    const usuario = userEvent.setup();
    mostrar();
    await screen.findByText("71,49");

    await usuario.click(screen.getByRole("button", { name: "Cambiar umbral" }));
    const campo = screen.getByRole("textbox", { name: /Umbral de brecha/ });
    await usuario.clear(campo);
    await usuario.type(campo, "150");
    await usuario.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("El umbral no puede superar 100.")).toBeInTheDocument();
    expect(actualizarUmbralBrecha).not.toHaveBeenCalled();

    await usuario.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("button", { name: "Cambiar umbral" })).toBeInTheDocument();
  });

  it("muestra el error que devuelve el servidor", async () => {
    const usuario = userEvent.setup();
    actualizarUmbralBrecha.mockRejectedValue(new ErrorApi(400, "Datos inválidos", [{ campo: "umbral_brecha", mensaje: "Debe ser un número entre 0 y 100 con hasta 2 decimales." }]));
    mostrar();
    await screen.findByText("71,49");

    await usuario.click(screen.getByRole("button", { name: "Cambiar umbral" }));
    await usuario.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Debe ser un número entre 0 y 100 con hasta 2 decimales.")).toBeInTheDocument();
  });
});

describe("permisos por rol", () => {
  it("el gerente consulta todo pero no puede cambiar el umbral, reprocesar, reintentar ni simular", async () => {
    const usuario = userEvent.setup();
    cambiarRol("gerente");
    const fallida = { ...consolidado().crm, solicitud: { id_mensaje: "m-1", estado: "FALLIDO", intentos: 8, ultimo_error: "x", entregado_en: null, creado_en: "2026-10-12T12:00:00.000Z" } };
    obtenerConsolidado.mockResolvedValue(consolidado({ crm: fallida }));
    mostrar();

    expect(await screen.findByText("71,49")).toBeInTheDocument();
    expect(obtenerConsolidado).toHaveBeenCalledWith("gerente", "c-3");
    expect(screen.queryByRole("button", { name: "Cambiar umbral" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reintentar publicación" })).not.toBeInTheDocument();

    await abrirPestana(usuario, "Mensajes del CRM");
    const tabla = await screen.findByRole("table", { name: "Mensajes de métricas recibidos del CRM" });
    expect(within(tabla).getByText("El mensaje no es un JSON válido.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reprocesar/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Simular la llegada de un mensaje del CRM")).not.toBeInTheDocument();
  });
});

describe("estados de carga y error", () => {
  it("muestra un estado vacío cuando aún no hay ciclos cerrados", async () => {
    listarCiclosCerrados.mockResolvedValue([]);
    mostrar();

    expect(await screen.findByText("Aún no hay ciclos cerrados")).toBeInTheDocument();
    expect(obtenerConsolidado).not.toHaveBeenCalled();
  });

  it("si no se pueden cargar los ciclos, lo dice y permite reintentar", async () => {
    const usuario = userEvent.setup();
    listarCiclosCerrados.mockRejectedValueOnce(new ErrorApi(503, "No hay conexión con el servicio de desempeño."));
    mostrar();

    expect(await screen.findByRole("alert")).toHaveTextContent("No hay conexión con el servicio de desempeño.");
    await usuario.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("71,49")).toBeInTheDocument();
  });

  it("si falla el consolidado, lo dice sin romper la página y permite reintentar", async () => {
    const usuario = userEvent.setup();
    obtenerConsolidado.mockRejectedValueOnce(new ErrorApi(500, "Error interno del servidor"));
    mostrar();

    expect(await screen.findByText("No se pudo cargar el consolidado del ciclo")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Ciclo cerrado" })).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("71,49")).toBeInTheDocument();
  });

  it("un ciclo sin evaluaciones enviadas no muestra promedios", async () => {
    obtenerConsolidado.mockResolvedValue(
      consolidado({
        resumen: { promedio_global: null, asignados: 3, evaluados: 0, cobertura_porcentual: 0, evaluaciones_enviadas: 0, evaluaciones_vencidas: 3, departamentos_en_brecha: 0, sucursales_en_brecha: 0 },
        departamentos: [],
        sucursales: [],
        competencias: [],
        crm: { solicitud: null, metricas_recibidas: 0, ...crm(0, 0, null, 0) },
      }),
    );
    listarColaboradoresDelCiclo.mockResolvedValue({ ...COLABORADORES, colaboradores: [] });
    mostrar();

    expect(await screen.findByText("Este ciclo no tiene evaluaciones enviadas")).toBeInTheDocument();
    expect(screen.queryByText("Promedio global")).not.toBeInTheDocument();
    expect(screen.getByText("No hay áreas con evaluaciones en este ciclo.")).toBeInTheDocument();
  });
});
