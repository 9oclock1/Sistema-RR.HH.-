import { MemoryRouter, Route, Routes } from "react-router";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorApi } from "../../../api/cliente";
import {
  cambiarEstadoQueja,
  listarCasosAsignados,
  listarCatalogosAsignados,
  obtenerCasoAsignado,
  obtenerSeguimientoQueja,
  registrarAccionQueja,
} from "../../../api/casosQueja";
import ProveedorAvisos from "../../../components/ui/ProveedorAvisos";
import { cambiarRol } from "../../../context/sesion";
import PaginaModulo from "../../inicio/PaginaModulo";
import { SECCIONES } from "../../../router/modulos";
import MisCasosQuejaPage from "./MisCasosQuejaPage";
import { RUTA_MIS_CASOS_QUEJA, rutaMiCasoQueja } from "./casos";

vi.mock("../../../api/casosQueja");

const RESPONSABLE = "d0000000-0000-4000-8000-000000000011";
const ADMIN = "d0000000-0000-4000-8000-000000000010";
const QUEJA = "d0000000-0000-4000-8000-000000000001";
const RESOLUCION = "Se capacitó al encargado y se reorganizaron los turnos.";
const ACCION = "Reunión con el encargado de cajas para acordar un trato respetuoso.";

const ESTADO = {
  ASIGNADA: { id: 2, codigo: "ASIGNADA", nombre: "Asignada", es_final: false },
  EN_ACCION: { id: 4, codigo: "EN_ACCION", nombre: "En acción", es_final: false },
};

const CASO = {
  id_queja: QUEJA,
  codigo_seguimiento: "QJ-7K3M-9XQ2",
  es_anonima: false,
  denunciante: null,
  categoria: { id: 1, codigo: "CLIMA_LABORAL", nombre: "Clima laboral" },
  prioridad: { id: 2, codigo: "MEDIA", nombre: "Media" },
  estado: ESTADO.EN_ACCION,
  asunto: "Trato hostil en cajas",
  descripcion: "El encargado del turno tarde grita al personal de cajas frente a los clientes.",
  registrada_en: "2026-11-01T14:00:00.000Z",
  actualizada_en: "2026-11-05T14:00:00.000Z",
  adjuntos: [],
  responsable: { id_empleado: RESPONSABLE, nombre_completo: "Rosa Rojas" },
  derivaciones: [],
  involucrados: [],
  historial: [
    { estado: { codigo: "REGISTRADA", nombre: "Registrada" }, estado_anterior: null, fecha: "2026-11-01T14:00:00.000Z", registrado_por: null },
    {
      estado: { codigo: "ASIGNADA", nombre: "Asignada" },
      estado_anterior: { codigo: "REGISTRADA", nombre: "Registrada" },
      fecha: "2026-11-02T14:00:00.000Z",
      registrado_por: { id_empleado: ADMIN, nombre_completo: "Ana Arce" },
    },
    {
      estado: { codigo: "EN_ANALISIS", nombre: "En análisis" },
      estado_anterior: { codigo: "ASIGNADA", nombre: "Asignada" },
      fecha: "2026-11-03T14:00:00.000Z",
      registrado_por: { id_empleado: RESPONSABLE, nombre_completo: "Rosa Rojas" },
    },
    {
      estado: { codigo: "EN_ACCION", nombre: "En acción" },
      estado_anterior: { codigo: "EN_ANALISIS", nombre: "En análisis" },
      fecha: "2026-11-05T14:00:00.000Z",
      registrado_por: { id_empleado: RESPONSABLE, nombre_completo: "Rosa Rojas" },
    },
  ],
};

const SEGUIMIENTO = {
  id_queja: QUEJA,
  acciones: [
    {
      id_accion: "a1",
      tipo: { codigo: "PREVENTIVA", nombre: "Preventiva" },
      descripcion: ACCION,
      registrada_por: { id_empleado: RESPONSABLE, nombre_completo: "Rosa Rojas" },
      registrada_en: "2026-11-04T14:00:00.000Z",
    },
  ],
  resolucion: null,
  gestion: {
    puede_actuar: true,
    puede_registrar_acciones: true,
    transiciones: [
      { id_estado_queja: 3, codigo: "EN_ANALISIS", nombre: "En análisis" },
      { id_estado_queja: 5, codigo: "RESUELTA", nombre: "Resuelta" },
    ],
    tipos_accion: [
      { id_tipo_accion_queja: 1, codigo: "PREVENTIVA", nombre: "Preventiva" },
      { id_tipo_accion_queja: 2, codigo: "CORRECTIVA", nombre: "Correctiva" },
    ],
    puede_reintentar_aviso: false,
  },
};

const montar = (ruta = rutaMiCasoQueja(QUEJA)) =>
  render(
    <ProveedorAvisos>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path={`${RUTA_MIS_CASOS_QUEJA}/:idQueja?`} element={<MisCasosQuejaPage />} />
        </Routes>
      </MemoryRouter>
    </ProveedorAvisos>,
  );

const tarjeta = async (titulo) => (await screen.findByRole("heading", { name: titulo })).closest(".ds-tarjeta");

describe("RF-70: acciones y avance del caso (pantalla del responsable)", () => {
  beforeEach(() => {
    cambiarRol("supervisor");
    localStorage.setItem("rrhh.idEmpleado", RESPONSABLE);
    listarCatalogosAsignados.mockResolvedValue({ categorias: [], prioridades: [], estados: [] });
    listarCasosAsignados.mockResolvedValue({ casos: [], total: 0, pagina: 1, limite: 20 });
    obtenerCasoAsignado.mockResolvedValue(CASO);
    obtenerSeguimientoQueja.mockResolvedValue(SEGUIMIENTO);
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("la bandeja muestra solo los casos asignados al usuario", async () => {
    montar(RUTA_MIS_CASOS_QUEJA);
    expect(await screen.findByText("No tiene casos asignados")).toBeInTheDocument();
    expect(listarCasosAsignados).toHaveBeenCalledWith(
      { rol: "supervisor", idEmpleado: RESPONSABLE },
      expect.objectContaining({ pagina: 1, limite: 20 }),
    );
  });

  it("el módulo es para supervisores y personal de RRHH, no para cualquier empleado", () => {
    const modulo = SECCIONES.flatMap((s) => s.modulos).find((m) => m.ruta === RUTA_MIS_CASOS_QUEJA);
    expect(modulo.roles).toEqual(["supervisor", "reclutador"]);
    cambiarRol("empleado");
    render(
      <MemoryRouter>
        <PaginaModulo seccion="Desempeño" modulo={modulo} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Acceso restringido")).toBeInTheDocument();
  });

  it("la línea de tiempo combina estados y acciones en orden, con autor y fecha", async () => {
    montar();
    const linea = await screen.findByRole("list", { name: "Estados y acciones del caso" });
    const pasos = within(linea).getAllByRole("listitem").map((paso) => paso.textContent);
    expect(pasos).toHaveLength(5);
    expect(pasos[0]).toMatch(/Queja registrada.*Buzón de quejas/);
    expect(pasos[1]).toMatch(/Registrada → Asignada.*Ana Arce/);
    expect(pasos[2]).toMatch(/Asignada → En análisis.*Rosa Rojas/);
    expect(pasos[3]).toMatch(/Acción preventiva.*Rosa Rojas.*Reunión con el encargado/);
    expect(pasos[4]).toMatch(/En análisis → En acción/);
    expect(pasos[3]).toMatch(/4 de noviembre de 2026/);
  });

  it("no muestra la identidad de quien presentó una queja identificada", async () => {
    montar();
    expect(await screen.findByText("Identificada; sus datos solo los ve RRHH")).toBeInTheDocument();
  });

  it("ofrece solo las transiciones válidas desde el estado actual", async () => {
    montar();
    const estado = await tarjeta("Estado del caso");
    const opciones = within(estado).getAllByRole("radio").map((radio) => radio.closest("label").textContent);
    expect(opciones).toEqual(["En análisis", "Resuelta"]);
  });

  it("al elegir «Resuelta» exige la descripción de la resolución y no envía sin ella", async () => {
    const usuario = userEvent.setup();
    montar();
    const estado = await tarjeta("Estado del caso");
    expect(within(estado).queryByLabelText(/Descripción de la resolución/)).not.toBeInTheDocument();

    await usuario.click(within(estado).getByRole("radio", { name: "Resuelta" }));
    const campo = within(estado).getByLabelText(/Descripción de la resolución/);
    expect(campo).toBeRequired();
    await usuario.click(within(estado).getByRole("button", { name: "Marcar como resuelto" }));
    expect(
      await within(estado).findByText("Describa cómo se resolvió el caso: es obligatorio para marcarlo como resuelto."),
    ).toBeInTheDocument();
    expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(cambiarEstadoQueja).not.toHaveBeenCalled();
  });

  it("con la descripción pide confirmación y resuelve el caso", async () => {
    const usuario = userEvent.setup();
    cambiarEstadoQueja.mockResolvedValue({
      estado: { codigo: "RESUELTA", nombre: "Resuelta", es_final: true },
      aviso_resolucion: { estado: "ENTREGADO", notificada_en: "2026-11-07T14:00:00.000Z" },
    });
    montar();
    const estado = await tarjeta("Estado del caso");
    await usuario.click(within(estado).getByRole("radio", { name: "Resuelta" }));
    await usuario.type(within(estado).getByLabelText(/Descripción de la resolución/), RESOLUCION);
    await usuario.click(within(estado).getByRole("button", { name: "Marcar como resuelto" }));

    const modal = await screen.findByRole("dialog", { name: "¿Marcar el caso como resuelto?" });
    expect(modal).toHaveTextContent("Se avisará a quien presentó la queja");
    await usuario.click(within(modal).getByRole("button", { name: "Marcar como resuelto" }));
    await waitFor(() =>
      expect(cambiarEstadoQueja).toHaveBeenCalledWith({ rol: "supervisor", idEmpleado: RESPONSABLE }, QUEJA, {
        idEstado: 5,
        resolucion: RESOLUCION,
      }),
    );
  });

  it("muestra en el campo el error de resolución que devuelve el servidor", async () => {
    const usuario = userEvent.setup();
    cambiarEstadoQueja.mockRejectedValue(
      new ErrorApi(400, "Falta la descripción de la resolución.", [{ campo: "resolucion", mensaje: "Describa la resolución." }]),
    );
    montar();
    const estado = await tarjeta("Estado del caso");
    await usuario.click(within(estado).getByRole("radio", { name: "Resuelta" }));
    await usuario.type(within(estado).getByLabelText(/Descripción de la resolución/), RESOLUCION);
    await usuario.click(within(estado).getByRole("button", { name: "Marcar como resuelto" }));
    const modal = await screen.findByRole("dialog");
    await usuario.click(within(modal).getByRole("button", { name: "Marcar como resuelto" }));
    expect(await within(estado).findByText("Describa la resolución.")).toBeInTheDocument();
  });

  it("registra una acción preventiva o correctiva y valida sus campos", async () => {
    const usuario = userEvent.setup();
    registrarAccionQueja.mockResolvedValue({ tipo: { codigo: "CORRECTIVA", nombre: "Correctiva" } });
    montar();
    const formulario = await tarjeta("Registrar acción");
    await usuario.click(within(formulario).getByRole("button", { name: "Registrar acción" }));
    expect(within(formulario).getByText("Indique si la acción es preventiva o correctiva.")).toBeInTheDocument();
    expect(within(formulario).getByText("Describa la acción realizada.")).toBeInTheDocument();
    expect(registrarAccionQueja).not.toHaveBeenCalled();

    await usuario.click(within(formulario).getByRole("radio", { name: "Correctiva" }));
    await usuario.type(within(formulario).getByLabelText(/Descripción de la acción/), ACCION);
    await usuario.click(within(formulario).getByRole("button", { name: "Registrar acción" }));
    await waitFor(() =>
      expect(registrarAccionQueja).toHaveBeenCalledWith({ rol: "supervisor", idEmpleado: RESPONSABLE }, QUEJA, {
        idTipo: 2,
        descripcion: ACCION,
      }),
    );
  });

  it("si no puede actuar no muestra controles para cambiar el estado ni registrar acciones", async () => {
    obtenerSeguimientoQueja.mockResolvedValue({
      ...SEGUIMIENTO,
      gestion: { ...SEGUIMIENTO.gestion, puede_actuar: false, puede_registrar_acciones: false, transiciones: [] },
    });
    montar();
    await screen.findByRole("list", { name: "Estados y acciones del caso" });
    expect(screen.queryByRole("heading", { name: "Estado del caso" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Registrar acción" })).not.toBeInTheDocument();
  });

  it("un caso que no le está asignado muestra el aviso en lugar del detalle", async () => {
    obtenerCasoAsignado.mockRejectedValue(new ErrorApi(403, "Este caso no está asignado a usted."));
    montar();
    expect(await screen.findByText("Este caso no está asignado a usted")).toBeInTheDocument();
    expect(screen.queryByText(CASO.descripcion)).not.toBeInTheDocument();
  });
});
