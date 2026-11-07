// KAN-34 (RF-14.7), QA del pipeline de selección: tablero por etapas, cambios permitidos, rechazo con motivo,
// formalización de la contratación y confirmación del alta en el ERP.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cambiarEtapaPostulacion,
  obtenerCatalogoPipeline,
  obtenerHistorialEtapas,
  obtenerIntegraciones,
  obtenerPipeline,
  reintentarIntegracion,
} from "../../../api/pipelineSeleccion";
import { getConvocatorias } from "../../../api/convocatoriasApi";
import { obtenerEntrevistasPostulacion } from "../../../api/entrevistas";
import ProveedorAvisos from "../../../components/ui/ProveedorAvisos";
import { cambiarRol, cambiarUsuario } from "../../../context/sesion";
import PipelineSeleccionPage from "./PipelineSeleccionPage";

vi.mock("../../../api/pipelineSeleccion");
vi.mock("../../../api/convocatoriasApi");
vi.mock("../../../api/entrevistas");
vi.mock("../../Asignaciones/hooks/useEmpleados", () => ({
  useEmpleados: () => ({ empleados: [{ id_empleado: MARIA, nombre_completo: "María Pérez" }] }),
}));

const MARIA = "44444444-4444-4444-8444-444444444444";
const SESION = { rol: "reclutador", idUsuario: MARIA, nombreUsuario: "María Pérez" };

const catalogo = {
  etapas: [
    { id_etapa: 1, codigo: "POSTULADO", nombre: "Postulación Recibida" },
    { id_etapa: 2, codigo: "EN_REVISION", nombre: "En revisión" },
    { id_etapa: 3, codigo: "ENTREVISTA_TECNICA", nombre: "Entrevista técnica" },
    { id_etapa: 4, codigo: "APTO", nombre: "Apto" },
    { id_etapa: 6, codigo: "CONTRATADO", nombre: "Contratado" },
    { id_etapa: 7, codigo: "RECHAZADO", nombre: "Rechazado" },
  ],
  transiciones: [
    { id_etapa_origen: 1, id_etapa_destino: 2, solicita_motivo: false, requiere_cargo: false },
    { id_etapa_origen: 1, id_etapa_destino: 7, solicita_motivo: true, requiere_cargo: false },
    { id_etapa_origen: 4, id_etapa_destino: 3, solicita_motivo: false, requiere_cargo: false },
    { id_etapa_origen: 4, id_etapa_destino: 6, solicita_motivo: false, requiere_cargo: true },
    { id_etapa_origen: 4, id_etapa_destino: 7, solicita_motivo: true, requiere_cargo: false },
  ],
  cargos_operativos: [
    { id_cargo_operativo: 1, codigo: "CAJERO", nombre: "Cajero", nombre_modulo: "Marketplace / POS" },
    { id_cargo_operativo: 3, codigo: "ALMACENERO", nombre: "Almacenero", nombre_modulo: "Inventarios" },
  ],
};

const base = {
  esta_archivada: false,
  integraciones_fallidas: 0,
  alta_contabilidad_enviada: false,
  alta_operativa_enviada: false,
  actualizado_en: "2026-10-20T10:00:00Z",
};
const ana = {
  ...base,
  id_postulacion: "p-ana",
  id_etapa: 1,
  codigo_etapa: "POSTULADO",
  nombre_etapa: "Postulación Recibida",
  nombres: "Ana",
  apellidos: "Pérez",
  correo_electronico: "ana@test.com",
  porcentaje_afinidad: "88.50",
};
const luis = {
  ...base,
  id_postulacion: "p-luis",
  id_etapa: 4,
  codigo_etapa: "APTO",
  nombre_etapa: "Apto",
  nombres: "Luis",
  apellidos: "Rojas",
  numero_documento: "1000002",
  correo_electronico: "luis@test.com",
  telefono_contacto: "70000002",
  porcentaje_afinidad: null,
};
const eva = {
  ...base,
  id_postulacion: "p-eva",
  id_etapa: 6,
  codigo_etapa: "CONTRATADO",
  nombre_etapa: "Contratado",
  nombres: "Eva",
  apellidos: "Mena",
  correo_electronico: "eva@test.com",
  nombre_cargo: "Chofer",
  integraciones_fallidas: 1,
  alta_contabilidad_enviada: true,
};
const convocatoria = { codigo_convocatoria: "CONV-CAJ-01", titulo_puesto: "Cajero sucursal centro", cantidad_vacantes: 2 };

const altaContabilidad = { id_evento: "ev-1", nombre_modulo: "Contabilidad", codigo_destino: "CONTABILIDAD" };
const altaPos = { id_evento: "ev-2", nombre_modulo: "Marketplace / POS", codigo_destino: "MARKETPLACE_POS" };

beforeEach(() => {
  cambiarRol("reclutador");
  cambiarUsuario(MARIA);
  localStorage.setItem("rrhh.pipeline.convocatoria", "c-1");
  getConvocatorias.mockResolvedValue([
    { id_convocatoria: "c-1", codigo_convocatoria: "CONV-CAJ-01", titulo_puesto: "Cajero sucursal centro", estado: "publicada" },
    { id_convocatoria: "c-0", codigo_convocatoria: "BORR-01", titulo_puesto: "Borrador", estado: "borrador" },
  ]);
  obtenerCatalogoPipeline.mockResolvedValue(catalogo);
  obtenerPipeline.mockResolvedValue({ convocatoria, postulaciones: [ana, luis, eva] });
  cambiarEtapaPostulacion.mockResolvedValue({ message: "El postulante pasó a la etapa «En revisión»." });
});

const pintar = () =>
  render(
    <ProveedorAvisos>
      <PipelineSeleccionPage />
    </ProveedorAvisos>,
  );

const tarjetaDe = async (nombre) => (await screen.findByText(nombre)).closest("article");
const arrastrar = (tarjeta, columna) => {
  const dataTransfer = { setData: vi.fn(), effectAllowed: "", dropEffect: "" };
  fireEvent.dragStart(tarjeta, { dataTransfer });
  fireEvent.dragOver(columna, { dataTransfer });
  fireEvent.drop(columna, { dataTransfer });
};

describe("Tablero por etapas", () => {
  it("agrupa a los postulantes por etapa y resume las vacantes cubiertas", async () => {
    pintar();
    const postulados = await screen.findByRole("listitem", { name: "Postulación Recibida" });
    expect(within(postulados).getByText("Ana Pérez")).toBeInTheDocument();
    expect(within(postulados).getByText("Afinidad 88.5%")).toBeInTheDocument();
    expect(within(screen.getByRole("listitem", { name: "Apto" })).getByText("Sin evaluar")).toBeInTheDocument();
    expect(screen.getByText(/3 postulante\(s\) · 1 de 2 vacante\(s\)/)).toBeInTheDocument();
  });

  it("no ofrece convocatorias en borrador", async () => {
    pintar();
    await screen.findByText("Ana Pérez");
    expect(screen.queryByRole("option", { name: /BORR-01/ })).not.toBeInTheDocument();
  });

  it("marca el alta con error de un contratado y no permite moverlo", async () => {
    pintar();
    const tarjeta = await tarjetaDe("Eva Mena");
    expect(within(tarjeta).getByText("Alta con error")).toBeInTheDocument();
    expect(within(tarjeta).getByText("Chofer")).toBeInTheDocument();
    expect(within(tarjeta).queryByRole("button", { name: "Mover" })).not.toBeInTheDocument();
  });

  it("sin usuario identificado no permite mover y lo avisa", async () => {
    cambiarUsuario(null);
    pintar();
    const tarjeta = await tarjetaDe("Ana Pérez");
    expect(within(tarjeta).queryByRole("button", { name: "Mover" })).not.toBeInTheDocument();
    expect(screen.getByText("Seleccione su usuario")).toBeInTheDocument();
  });
});

describe("Cambio de etapa", () => {
  it("al arrastrar a una etapa permitida registra el cambio a nombre del usuario", async () => {
    pintar();
    arrastrar(await tarjetaDe("Ana Pérez"), screen.getByRole("listitem", { name: "En revisión" }));
    const dialogo = await screen.findByRole("dialog", { name: "Cambiar etapa" });
    await userEvent.type(within(dialogo).getByLabelText("Comentario (opcional)"), "CV completo");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Cambiar etapa" }));
    await waitFor(() =>
      expect(cambiarEtapaPostulacion).toHaveBeenCalledWith("p-ana", { id_etapa: 2, motivo: "CV completo" }, SESION),
    );
    expect(await screen.findByText("Etapa actualizada")).toBeInTheDocument();
    expect(obtenerPipeline).toHaveBeenCalledTimes(2);
  });

  it("al soltar en una etapa no permitida avisa y no abre el modal", async () => {
    pintar();
    const tarjeta = await tarjetaDe("Ana Pérez");
    fireEvent.dragStart(tarjeta, { dataTransfer: { setData: vi.fn() } });
    fireEvent.drop(screen.getByRole("listitem", { name: "Apto" }), { dataTransfer: {} });
    expect(await screen.findByText("Cambio no permitido")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(cambiarEtapaPostulacion).not.toHaveBeenCalled();
  });

  it("el rechazo pide un motivo opcional y avisa que archiva la postulación", async () => {
    pintar();
    await userEvent.click(within(await tarjetaDe("Ana Pérez")).getByRole("button", { name: "Mover" }));
    const dialogo = await screen.findByRole("dialog", { name: "Cambiar etapa" });
    await userEvent.selectOptions(within(dialogo).getByLabelText(/Nueva etapa/), "7");
    expect(within(dialogo).getByText(/se archivará y se notificará el cierre/)).toBeInTheDocument();
    await userEvent.click(within(dialogo).getByRole("button", { name: "Rechazar" }));
    await waitFor(() => expect(cambiarEtapaPostulacion).toHaveBeenCalledWith("p-ana", { id_etapa: 7 }, SESION));
  });

  it("muestra en el modal el error del backend y actualiza el tablero si hubo conflicto", async () => {
    cambiarEtapaPostulacion.mockRejectedValue(
      Object.assign(new Error("La postulación está cerrada en «Rechazado»."), { status: 409, errores: [] }),
    );
    pintar();
    await userEvent.click(within(await tarjetaDe("Ana Pérez")).getByRole("button", { name: "Mover" }));
    const dialogo = await screen.findByRole("dialog", { name: "Cambiar etapa" });
    await userEvent.selectOptions(within(dialogo).getByLabelText(/Nueva etapa/), "2");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Cambiar etapa" }));
    expect(await within(dialogo).findByText("La postulación está cerrada en «Rechazado».")).toBeInTheDocument();
    expect(obtenerPipeline).toHaveBeenCalledTimes(2);
  });
});

describe("Formalización de la contratación", () => {
  beforeEach(() => {
    cambiarEtapaPostulacion.mockResolvedValue({
      message: "El postulante fue contratado.",
      data: { integraciones: [altaContabilidad, altaPos] },
    });
    obtenerIntegraciones.mockResolvedValue([
      { ...altaContabilidad, estado: "ENTREGADO", intentos: 1, entregado_en: "2026-10-20T15:00:05Z" },
      { ...altaPos, estado: "FALLIDO", intentos: 1, ultimo_error: "El destino respondió 400" },
    ]);
  });

  const abrirContratacion = async () => {
    pintar();
    arrastrar(await tarjetaDe("Luis Rojas"), screen.getByRole("listitem", { name: "Contratado" }));
    return screen.findByRole("dialog", { name: "Formalizar contratación" });
  };

  it("al soltar en «Contratado» abre la formalización con los datos del candidato", async () => {
    const dialogo = await abrirContratacion();
    expect(within(dialogo).getByText("1000002")).toBeInTheDocument();
    expect(within(dialogo).getByText("luis@test.com · 70000002")).toBeInTheDocument();
    expect(within(dialogo).getByText("CONV-CAJ-01 · Cajero sucursal centro")).toBeInTheDocument();
  });

  it("exige el cargo operativo y la confirmación del reclutador", async () => {
    const dialogo = await abrirContratacion();
    const confirmar = within(dialogo).getByRole("button", { name: "Confirmar contratación" });
    expect(confirmar).toBeDisabled();
    await userEvent.selectOptions(within(dialogo).getByLabelText(/Cargo operativo/), "3");
    expect(within(dialogo).getByText("Sus datos se enviarán a Inventarios.")).toBeInTheDocument();
    expect(confirmar).toBeDisabled();
    await userEvent.click(within(dialogo).getByLabelText(/aceptó la oferta/));
    expect(confirmar).toBeEnabled();
  });

  it("contrata y muestra la confirmación del alta en cada módulo", async () => {
    const dialogo = await abrirContratacion();
    await userEvent.selectOptions(within(dialogo).getByLabelText(/Cargo operativo/), "1");
    await userEvent.type(within(dialogo).getByLabelText("Observaciones (opcional)"), "Inicia el lunes");
    await userEvent.click(within(dialogo).getByLabelText(/aceptó la oferta/));
    await userEvent.click(within(dialogo).getByRole("button", { name: "Confirmar contratación" }));

    await waitFor(() =>
      expect(cambiarEtapaPostulacion).toHaveBeenCalledWith(
        "p-luis",
        { id_etapa: 6, id_cargo_operativo: 1, motivo: "Inicia el lunes" },
        SESION,
      ),
    );
    const confirmacion = await screen.findByRole("dialog", { name: "Alta del colaborador" });
    expect(within(confirmacion).getByText("Luis Rojas fue contratado como Cajero")).toBeInTheDocument();
    expect(await within(confirmacion).findByText("Enviada")).toBeInTheDocument();
    expect(within(confirmacion).getByText("Fallida")).toBeInTheDocument();
  });

  it("permite reenviar un alta fallida desde la confirmación", async () => {
    reintentarIntegracion.mockResolvedValue({ message: "Se volverá a enviar." });
    const dialogo = await abrirContratacion();
    await userEvent.selectOptions(within(dialogo).getByLabelText(/Cargo operativo/), "1");
    await userEvent.click(within(dialogo).getByLabelText(/aceptó la oferta/));
    await userEvent.click(within(dialogo).getByRole("button", { name: "Confirmar contratación" }));
    const confirmacion = await screen.findByRole("dialog", { name: "Alta del colaborador" });
    await userEvent.click(await within(confirmacion).findByRole("button", { name: "Reintentar envío" }));
    await waitFor(() => expect(reintentarIntegracion).toHaveBeenCalledWith("ev-2", SESION));
  });

  it("desde «Mover», elegir «Contratado» pasa a la formalización", async () => {
    pintar();
    await userEvent.click(within(await tarjetaDe("Luis Rojas")).getByRole("button", { name: "Mover" }));
    const dialogo = await screen.findByRole("dialog", { name: "Cambiar etapa" });
    await userEvent.selectOptions(within(dialogo).getByLabelText(/Nueva etapa/), "6");
    expect(await screen.findByRole("dialog", { name: "Formalizar contratación" })).toBeInTheDocument();
  });
});

describe("Historial de la postulación", () => {
  it("muestra quién cambió cada etapa, cuándo y con qué motivo", async () => {
    obtenerHistorialEtapas.mockResolvedValue([
      {
        id_historial: "h-1",
        codigo_etapa_anterior: "POSTULADO",
        nombre_etapa_anterior: "Postulación Recibida",
        codigo_etapa: "EN_REVISION",
        nombre_etapa: "En revisión",
        id_usuario_evaluador: MARIA,
        nombre_usuario_evaluador: "María Pérez",
        motivo: "CV completo",
        fecha_cambio: "2026-10-20T14:00:00Z",
      },
    ]);
    obtenerIntegraciones.mockResolvedValue([]);
    pintar();
    await userEvent.click(within(await tarjetaDe("Ana Pérez")).getByRole("button", { name: "Historial" }));
    const dialogo = await screen.findByRole("dialog", { name: "Ana Pérez" });
    expect(await within(dialogo).findByText("CV completo")).toBeInTheDocument();
    expect(within(dialogo).getByText(/María Pérez/)).toBeInTheDocument();
  });
});

// KAN-35 (RF-15.4): desde la tarjeta se agendan las entrevistas de quienes están en «Entrevista técnica» o «Apto».
describe("Entrevistas desde el pipeline", () => {
  it("ofrece las entrevistas solo a postulantes agendables y muestra la próxima cita", async () => {
    obtenerPipeline.mockResolvedValue({
      convocatoria,
      postulaciones: [ana, { ...luis, proxima_entrevista: "2030-03-15T14:00:00.000Z" }, eva],
    });
    obtenerEntrevistasPostulacion.mockResolvedValue([]);
    pintar();

    const tarjetaLuis = await tarjetaDe("Luis Rojas");
    expect(within(tarjetaLuis).getByText(/Entrevista .*15 mar.* · 10:00/)).toBeInTheDocument();
    expect(within(await tarjetaDe("Ana Pérez")).queryByRole("button", { name: "Entrevistas" })).not.toBeInTheDocument();

    await userEvent.click(within(tarjetaLuis).getByRole("button", { name: "Entrevistas" }));
    const dialogo = await screen.findByRole("dialog", { name: "Entrevistas de Luis Rojas" });
    expect(await within(dialogo).findByText("Aún no tiene entrevistas agendadas.")).toBeInTheDocument();
    expect(within(dialogo).getByRole("button", { name: /Agendar entrevista/ })).toBeInTheDocument();
  });
});
