// KAN-35 (RF-15.6), QA de la agenda de entrevistas: formulario de programación con selector de fecha y hora,
// advertencia de solapamiento, reprogramación y cancelación con aviso al candidato, y el calendario del reclutador.
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  agendarEntrevista,
  cancelarEntrevista,
  obtenerAgendaEntrevistas,
  obtenerDetalleEntrevista,
  obtenerEntrevistasPostulacion,
  reintentarAvisoEntrevista,
  reprogramarEntrevista,
} from "../../../api/entrevistas";
import { ApiError } from "../../../api/httpClient";
import ProveedorAvisos from "../../../components/ui/ProveedorAvisos";
import { cambiarRol, cambiarUsuario } from "../../../context/sesion";
import AgendaEntrevistasPage from "./AgendaEntrevistasPage";
import ModalEntrevistas from "./ModalEntrevistas";
import { hoyLocal, lunesDe, sumarDias } from "./reglasEntrevista";

vi.mock("../../../api/entrevistas");
vi.mock("../../Asignaciones/hooks/useEmpleados", () => ({
  useEmpleados: () => ({ empleados: EMPLEADOS }),
}));

const MARIA = "44444444-4444-4444-8444-444444444444";
const ANA = "11111111-1111-4111-8111-111111111111";
const EMPLEADOS = [
  { id_empleado: MARIA, nombre_completo: "María Pérez", cargo: "Reclutadora", activo: true },
  { id_empleado: ANA, nombre_completo: "Ana Quispe", cargo: "Jefa de tienda", activo: true },
  { id_empleado: "baja", nombre_completo: "Pedro Baja", activo: false },
];
const SESION = { rol: "reclutador", idUsuario: MARIA, nombreUsuario: "María Pérez" };

const luis = {
  id_postulacion: "p-luis",
  nombres: "Luis",
  apellidos: "Rojas",
  correo_electronico: "luis@test.com",
  codigo_etapa: "APTO",
  nombre_etapa: "Apto",
  esta_archivada: false,
};
const citaDe = (cambios = {}) => ({
  id_entrevista: "e-1",
  id_postulacion: "p-luis",
  fecha_hora_programada: "2030-03-15T14:00:00.000Z",
  fecha_hora_fin: "2030-03-15T15:00:00.000Z",
  duracion_minutos: 60,
  modalidad: "VIRTUAL",
  lugar_enlace: "https://meet.google.com/abc",
  id_entrevistador_empleado: ANA,
  nombre_entrevistador: "Ana Quispe",
  codigo_estado: "PROGRAMADA",
  nombre_estado: "Programada",
  estado_ultimo_aviso: "ENTREGADO",
  id_ultimo_aviso: "n-1",
  nombres: "Luis",
  apellidos: "Rojas",
  correo_electronico: "luis@test.com",
  codigo_etapa: "APTO",
  nombre_etapa: "Apto",
  codigo_convocatoria: "CONV-01",
  titulo_puesto: "Cajero",
  ...cambios,
});
const otraCita = citaDe({ id_entrevista: "e-otra", nombres: "Carla", apellidos: "Vargas", id_postulacion: "p-carla" });

beforeEach(() => {
  vi.resetAllMocks();
  cambiarRol("reclutador");
  cambiarUsuario(MARIA);
  obtenerEntrevistasPostulacion.mockResolvedValue([]);
  obtenerAgendaEntrevistas.mockResolvedValue({ entrevistas: [] });
});

const pintarModal = (props = {}) =>
  render(
    <ProveedorAvisos>
      <ModalEntrevistas
        postulacion={luis}
        empleados={EMPLEADOS}
        sesion={SESION}
        puedeEditar
        onCerrar={() => {}}
        onActualizar={() => {}}
        {...props}
      />
    </ProveedorAvisos>,
  );

// Completa el formulario con una cita virtual el 15/03/2030 con Ana Quispe.
async function completarFormulario(usuario, { hora = "10:30", enlace = "https://meet.google.com/xyz" } = {}) {
  await usuario.type(screen.getByLabelText(/Fecha/), "2030-03-15");
  await usuario.selectOptions(screen.getByLabelText(/Hora de inicio/), hora);
  await usuario.selectOptions(screen.getByLabelText(/Modalidad/), "VIRTUAL");
  await usuario.type(screen.getByLabelText(/Enlace de la reunión/), enlace);
  await usuario.selectOptions(screen.getByLabelText(/Evaluador/), ANA);
}

describe("Criterio 1: formulario de programación", () => {
  it("valida los datos antes de enviar y agenda con fecha, hora, modalidad y evaluador", async () => {
    const usuario = userEvent.setup();
    agendarEntrevista.mockResolvedValue({ message: "La entrevista quedó agendada y se notificará al candidato en luis@test.com." });
    pintarModal();

    await usuario.click(await screen.findByRole("button", { name: /Agendar entrevista/ }));
    await usuario.click(screen.getByRole("button", { name: /Agendar y avisar/ }));
    expect(screen.getByText("Elija la fecha de la entrevista.")).toBeInTheDocument();
    expect(screen.getByText("Elija al evaluador.")).toBeInTheDocument();
    expect(agendarEntrevista).not.toHaveBeenCalled();

    await completarFormulario(usuario, { enlace: "sala 3" });
    await usuario.click(screen.getByRole("button", { name: /Agendar y avisar/ }));
    expect(screen.getByText(/debe empezar con http/)).toBeInTheDocument();

    await usuario.clear(screen.getByLabelText(/Enlace de la reunión/));
    await usuario.type(screen.getByLabelText(/Enlace de la reunión/), "https://meet.google.com/xyz");
    await usuario.click(screen.getByRole("button", { name: /Agendar y avisar/ }));

    expect(agendarEntrevista).toHaveBeenCalledWith(
      "p-luis",
      {
        fecha_hora_programada: "2030-03-15T10:30",
        duracion_minutos: 60,
        modalidad: "VIRTUAL",
        lugar_enlace: "https://meet.google.com/xyz",
        id_entrevistador_empleado: ANA,
      },
      SESION,
    );
    expect(await screen.findByText(/se notificará al candidato en luis@test.com/)).toBeInTheDocument();
  });

  it("solo ofrece evaluadores activos y cambia el campo de lugar según la modalidad", async () => {
    const usuario = userEvent.setup();
    pintarModal();
    await usuario.click(await screen.findByRole("button", { name: /Agendar entrevista/ }));
    const evaluador = screen.getByLabelText(/Evaluador/);
    expect(within(evaluador).getByRole("option", { name: /Ana Quispe · Jefa de tienda/ })).toBeInTheDocument();
    expect(within(evaluador).queryByRole("option", { name: /Pedro Baja/ })).not.toBeInTheDocument();

    await usuario.selectOptions(screen.getByLabelText(/Modalidad/), "PRESENCIAL");
    expect(screen.getByLabelText(/Dirección/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Fecha/)).toHaveAttribute("min", hoyLocal());
  });

  it("no permite agendar a postulantes fuera de entrevista técnica o apto", async () => {
    pintarModal({ postulacion: { ...luis, codigo_etapa: "EN_REVISION", nombre_etapa: "En revisión" } });
    expect(await screen.findByText(/Solo se agendan entrevistas a postulantes/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Agendar entrevista/ })).not.toBeInTheDocument();
  });
});

describe("Criterio 3: advertencia de solapamiento", () => {
  it("muestra la agenda del evaluador, marca el cruce y permite guardar de todas formas", async () => {
    const usuario = userEvent.setup();
    obtenerAgendaEntrevistas.mockResolvedValue({ entrevistas: [otraCita] });
    agendarEntrevista
      .mockRejectedValueOnce(
        new ApiError("El evaluador ya tiene una entrevista en ese horario.", 409, {
          solapamiento: true,
          entrevistas_solapadas: [otraCita],
        }),
      )
      .mockResolvedValueOnce({ message: "Quedó guardada aunque el evaluador tiene otra entrevista en ese horario." });
    pintarModal();

    await usuario.click(await screen.findByRole("button", { name: /Agendar entrevista/ }));
    await completarFormulario(usuario);

    expect(obtenerAgendaEntrevistas).toHaveBeenLastCalledWith(
      { desde: "2030-03-15T00:00", hasta: "2030-03-16T00:00", idEntrevistador: ANA },
      expect.anything(),
    );
    expect(await screen.findByText("Se cruza con el horario elegido")).toBeInTheDocument();
    expect(screen.getByText("Posible solapamiento")).toBeInTheDocument();

    await usuario.click(screen.getByRole("button", { name: /Agendar y avisar/ }));
    const alerta = await screen.findByRole("alert");
    expect(within(alerta).getByText("El evaluador ya tiene entrevistas en ese horario")).toBeInTheDocument();
    expect(within(alerta).getByText(/10:00–11:00 con Carla Vargas/)).toBeInTheDocument();

    await usuario.click(screen.getByRole("button", { name: /Guardar de todas formas/ }));
    await waitFor(() => expect(agendarEntrevista).toHaveBeenCalledTimes(2));
    expect(agendarEntrevista.mock.calls[1][1].confirmar_solapamiento).toBe(true);
    expect(await screen.findByText(/Quedó guardada aunque/)).toBeInTheDocument();
  });

  it("al cambiar la hora desaparece la advertencia del servidor", async () => {
    const usuario = userEvent.setup();
    obtenerAgendaEntrevistas.mockResolvedValue({ entrevistas: [otraCita] });
    agendarEntrevista.mockRejectedValueOnce(
      new ApiError("solapa", 409, { solapamiento: true, entrevistas_solapadas: [otraCita] }),
    );
    pintarModal();
    await usuario.click(await screen.findByRole("button", { name: /Agendar entrevista/ }));
    await completarFormulario(usuario);
    await usuario.click(screen.getByRole("button", { name: /Agendar y avisar/ }));
    await screen.findByRole("button", { name: /Guardar de todas formas/ });

    await usuario.selectOptions(screen.getByLabelText(/Hora de inicio/), "14:00");
    expect(screen.queryByRole("button", { name: /Guardar de todas formas/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Se cruza con el horario elegido")).not.toBeInTheDocument();
  });
});

describe("Criterios 2 y 4: avisos al candidato, reprogramación y cancelación", () => {
  it("muestra el estado del correo y reintenta uno fallido", async () => {
    const usuario = userEvent.setup();
    obtenerEntrevistasPostulacion.mockResolvedValue([citaDe({ estado_ultimo_aviso: "FALLIDO" })]);
    reintentarAvisoEntrevista.mockResolvedValue({});
    pintarModal();
    expect(await screen.findByText("Correo no enviado")).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: /Reintentar correo/ }));
    expect(reintentarAvisoEntrevista).toHaveBeenCalledWith("n-1", SESION);
  });

  it("reprograma con los datos precargados y el motivo", async () => {
    const usuario = userEvent.setup();
    obtenerEntrevistasPostulacion.mockResolvedValue([citaDe()]);
    obtenerAgendaEntrevistas.mockResolvedValue({ entrevistas: [citaDe()] });
    reprogramarEntrevista.mockResolvedValue({ message: "La entrevista fue reprogramada." });
    pintarModal();

    await usuario.click(await screen.findByRole("button", { name: /Reprogramar/ }));
    expect(screen.getByLabelText(/Fecha/)).toHaveValue("2030-03-15");
    expect(screen.getByLabelText(/Hora de inicio/)).toHaveValue("10:00");
    expect(screen.getByLabelText(/Evaluador/)).toHaveValue(ANA);
    expect(await screen.findByText("No tiene otras entrevistas ese día.")).toBeInTheDocument();

    await usuario.selectOptions(screen.getByLabelText(/Hora de inicio/), "15:00");
    await usuario.type(screen.getByLabelText(/Motivo del cambio/), "Viaje del evaluador");
    await usuario.click(screen.getByRole("button", { name: /Reprogramar y avisar/ }));
    expect(reprogramarEntrevista).toHaveBeenCalledWith(
      "e-1",
      expect.objectContaining({ fecha_hora_programada: "2030-03-15T15:00", motivo: "Viaje del evaluador" }),
      SESION,
    );
    expect(await screen.findByText("La entrevista fue reprogramada.")).toBeInTheDocument();
  });

  it("cancela solo con motivo", async () => {
    const usuario = userEvent.setup();
    obtenerEntrevistasPostulacion.mockResolvedValue([citaDe()]);
    cancelarEntrevista.mockResolvedValue({ message: "La entrevista fue cancelada y se avisará al candidato." });
    pintarModal();

    await usuario.click(await screen.findByRole("button", { name: /^Cancelar$/ }));
    await usuario.click(screen.getByRole("button", { name: /Cancelar entrevista/ }));
    expect(screen.getByText(/Indique el motivo/)).toBeInTheDocument();
    expect(cancelarEntrevista).not.toHaveBeenCalled();

    await usuario.type(screen.getByLabelText(/Motivo/), "La vacante fue cubierta");
    await usuario.click(screen.getByRole("button", { name: /Cancelar entrevista/ }));
    expect(cancelarEntrevista).toHaveBeenCalledWith("e-1", "La vacante fue cubierta", SESION);
    expect(await screen.findByText(/se avisará al candidato/)).toBeInTheDocument();
  });

  it("una cita cancelada no ofrece acciones", async () => {
    obtenerEntrevistasPostulacion.mockResolvedValue([citaDe({ codigo_estado: "CANCELADA", nombre_estado: "Cancelada" })]);
    pintarModal();
    expect(await screen.findByText("Cancelada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reprogramar/ })).not.toBeInTheDocument();
  });
});

describe("RF-15.5: agenda semanal del reclutador", () => {
  const lunes = lunesDe(hoyLocal());
  const miercoles = sumarDias(lunes, 2);
  // 10:00 y 10:30 en La Paz (UTC-4): se cruzan y van lado a lado.
  const deLaSemana = [
    citaDe({ id_entrevista: "s-1", fecha_hora_programada: `${miercoles}T14:00:00.000Z`, fecha_hora_fin: `${miercoles}T15:00:00.000Z` }),
    citaDe({
      id_entrevista: "s-2",
      nombres: "Carla",
      apellidos: "Vargas",
      codigo_estado: "REPROGRAMADA",
      nombre_estado: "Reprogramada",
      fecha_hora_programada: `${miercoles}T14:30:00.000Z`,
      fecha_hora_fin: `${miercoles}T15:00:00.000Z`,
      duracion_minutos: 30,
    }),
  ];

  const pintarAgenda = () =>
    render(
      <ProveedorAvisos>
        <AgendaEntrevistasPage />
      </ProveedorAvisos>,
    );

  it("consulta la semana actual y ubica cada cita en su día", async () => {
    obtenerAgendaEntrevistas.mockResolvedValue({ entrevistas: deLaSemana });
    pintarAgenda();

    const cita = await screen.findByRole("button", { name: /10:00 a 11:00, Luis Rojas, Programada, evaluador Ana Quispe/ });
    expect(cita).toHaveStyle({ width: "50%", left: "0%" });
    expect(screen.getByRole("button", { name: /10:30 a 11:00, Carla Vargas, Reprogramada/ })).toHaveStyle({ left: "50%" });
    expect(screen.getByText("2 entrevista(s) vigente(s) esta semana")).toBeInTheDocument();
    expect(obtenerAgendaEntrevistas).toHaveBeenCalledWith(
      { desde: `${lunes}T00:00`, hasta: `${sumarDias(lunes, 7)}T00:00`, idEntrevistador: undefined, incluirCanceladas: false },
      expect.anything(),
    );
  });

  it("navega entre semanas y filtra por evaluador y canceladas", async () => {
    const usuario = userEvent.setup();
    pintarAgenda();
    await screen.findByText("No hay entrevistas esta semana");

    await usuario.click(screen.getByRole("button", { name: "Semana siguiente" }));
    await waitFor(() =>
      expect(obtenerAgendaEntrevistas).toHaveBeenLastCalledWith(
        expect.objectContaining({ desde: `${sumarDias(lunes, 7)}T00:00` }),
        expect.anything(),
      ),
    );
    await usuario.click(screen.getByRole("button", { name: "Hoy" }));
    await usuario.selectOptions(screen.getByLabelText("Evaluador"), ANA);
    await usuario.click(screen.getByLabelText("Mostrar canceladas"));
    await waitFor(() =>
      expect(obtenerAgendaEntrevistas).toHaveBeenLastCalledWith(
        { desde: `${lunes}T00:00`, hasta: `${sumarDias(lunes, 7)}T00:00`, idEntrevistador: ANA, incluirCanceladas: true },
        expect.anything(),
      ),
    );
  });

  it("abre el detalle con el historial y permite reprogramar o cancelar", async () => {
    const usuario = userEvent.setup();
    obtenerAgendaEntrevistas.mockResolvedValue({ entrevistas: deLaSemana });
    obtenerDetalleEntrevista.mockResolvedValue({
      ...deLaSemana[0],
      historial: [
        {
          id_historial: "h-2",
          codigo_estado: "REPROGRAMADA",
          nombre_estado: "Reprogramada",
          fecha_hora_anterior: `${sumarDias(lunes, 1)}T14:00:00.000Z`,
          fecha_hora_nueva: deLaSemana[0].fecha_hora_programada,
          motivo: "Viaje del evaluador",
          nombre_usuario: "María Pérez",
          id_usuario: MARIA,
          fecha_cambio: "2030-01-01T12:00:00.000Z",
        },
      ],
      notificaciones: [],
    });
    pintarAgenda();

    await usuario.click(await screen.findByRole("button", { name: /10:00 a 11:00, Luis Rojas/ }));
    const dialogo = await screen.findByRole("dialog", { name: "Entrevista con Luis Rojas" });
    expect(await within(dialogo).findByText("Viaje del evaluador")).toBeInTheDocument();
    expect(within(dialogo).getByRole("link", { name: "https://meet.google.com/abc" })).toBeInTheDocument();
    expect(within(dialogo).getByText("Correo enviado")).toBeInTheDocument();

    await usuario.click(within(dialogo).getByRole("button", { name: "Reprogramar" }));
    expect(await screen.findByRole("dialog", { name: "Reprogramar entrevista" })).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Volver" }));
    await usuario.click(await screen.findByRole("button", { name: "Cancelar entrevista" }));
    expect(await screen.findByLabelText(/Motivo/)).toBeInTheDocument();
  });
});
