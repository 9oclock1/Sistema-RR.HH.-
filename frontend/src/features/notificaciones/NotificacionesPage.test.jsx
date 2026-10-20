// KAN-54 (RF-34), QA de la vista «Notificaciones»: lista, filtros, lectura, paginación, errores e identificación.
import { MemoryRouter, Route, Routes } from "react-router";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contarNoLeidas, listarNotificaciones, marcarLeida, marcarTodasLeidas } from "../../api/notificaciones";
import ProveedorAvisos from "../../components/ui/ProveedorAvisos";
import CampanaNotificaciones from "./CampanaNotificaciones";
import NotificacionesPage from "./NotificacionesPage";
import { guardarEmpleado, olvidarEmpleado } from "../marcaje/sesionEmpleado";
import { alCambiarNotificaciones } from "./eventosNotificaciones";

vi.mock("../../api/notificaciones");
vi.mock("../../api/marcajes", () => ({
  consultarJornada: vi.fn(async () => ({ empleado: { nombres: "Ana", apellidos: "Quispe" } })),
}));

const ANA = "4192f252-acf0-4522-a109-e051cad9a50b";

const aprobada = {
  id_notificacion: "n-1",
  tipo: "SOLICITUD_APROBADA",
  titulo: "Solicitud aprobada: Vacaciones",
  mensaje: "Su solicitud de «Vacaciones» para el 07/12/2026 al 11/12/2026 fue aprobada por Luis Rojas.",
  enlace: "/asistencia/solicitud-vacaciones?solicitud=s-1",
  leida: false,
  correo_estado: "ENVIADO",
  creado_en: "2026-11-02T15:00:00.000Z",
};
const rechazada = {
  id_notificacion: "n-2",
  tipo: "SOLICITUD_RECHAZADA",
  titulo: "Solicitud rechazada: Licencia médica",
  mensaje: "Su solicitud de «Licencia médica» para el 02/11/2026 fue rechazada por Luis Rojas.\nJustificación: No hay cobertura en el turno.",
  enlace: "/asistencia/licencias?solicitud=s-2",
  leida: true,
  correo_estado: "FALLIDO",
  creado_en: "2026-11-01T10:00:00.000Z",
};

function abrir(ruta = "/comunicaciones/notificaciones") {
  return render(
    <ProveedorAvisos>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/comunicaciones/notificaciones" element={<NotificacionesPage />} />
          <Route path="/asistencia/solicitud-vacaciones" element={<p>Pantalla de vacaciones</p>} />
        </Routes>
      </MemoryRouter>
    </ProveedorAvisos>
  );
}

beforeEach(() => {
  localStorage.setItem("rrhh.idEmpleado", ANA);
  listarNotificaciones.mockResolvedValue({ notificaciones: [aprobada, rechazada], no_leidas: 1, total: 2 });
  marcarLeida.mockResolvedValue({});
  marcarTodasLeidas.mockResolvedValue({ marcadas: 1, no_leidas: 0 });
  contarNoLeidas.mockResolvedValue({ no_leidas: 1 });
});

describe("Vista de notificaciones", () => {
  it("pide identificarse y no consulta nada sin empleado", async () => {
    localStorage.clear();
    abrir();

    expect(await screen.findByLabelText(/identificador/i)).toBeInTheDocument();
    expect(listarNotificaciones).not.toHaveBeenCalled();
  });

  it("muestra el historial con el resultado, la fecha, el estado del correo y la justificación del rechazo", async () => {
    abrir();

    expect(await screen.findByText("Solicitud aprobada: Vacaciones")).toBeInTheDocument();
    expect(screen.getByText("Solicitud rechazada: Licencia médica")).toBeInTheDocument();
    expect(screen.getByText(/Justificación: No hay cobertura en el turno\./)).toBeInTheDocument();
    expect(screen.getByText("Correo enviado")).toBeInTheDocument();
    expect(screen.getByText("Correo no enviado")).toBeInTheDocument();
    expect(listarNotificaciones).toHaveBeenCalledWith(ANA, { soloNoLeidas: false, limite: 15, desplazamiento: 0 });
    // Solo la no leída se anuncia como tal.
    expect(screen.getAllByText(/Sin leer\./)).toHaveLength(1);
  });

  it("criterio 4: «Ver solicitud» lleva al detalle de la solicitud y la marca como leída", async () => {
    const usuario = userEvent.setup();
    abrir();

    await usuario.click(await screen.findByRole("link", { name: /Ver la solicitud: Solicitud aprobada/ }));

    expect(await screen.findByText("Pantalla de vacaciones")).toBeInTheDocument();
    expect(marcarLeida).toHaveBeenCalledWith(ANA, "n-1");
  });

  it("cada alerta enlaza a su propia pantalla (vacaciones o licencias)", async () => {
    abrir();

    const vacaciones = await screen.findByRole("link", { name: /Solicitud aprobada: Vacaciones/ });
    const licencia = screen.getByRole("link", { name: /Solicitud rechazada: Licencia médica/ });
    expect(vacaciones).toHaveAttribute("href", "/asistencia/solicitud-vacaciones?solicitud=s-1");
    expect(licencia).toHaveAttribute("href", "/asistencia/licencias?solicitud=s-2");
  });

  it("marcar una como leída baja el contador, llama al servidor y avisa a la campana", async () => {
    const usuario = userEvent.setup();
    const alerta = vi.fn();
    const baja = alCambiarNotificaciones(alerta);
    abrir();

    const pestanaSinLeer = await screen.findByRole("tab", { name: /Sin leer/ });
    expect(within(pestanaSinLeer).getByText("1")).toBeInTheDocument();

    await usuario.click(screen.getByRole("button", { name: /Marcar como leída: Solicitud aprobada/ }));

    await waitFor(() => expect(marcarLeida).toHaveBeenCalledWith(ANA, "n-1"));
    expect(within(screen.getByRole("tab", { name: /Sin leer/ })).queryByText("1")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Marcar como leída:/ })).not.toBeInTheDocument();
    expect(alerta).toHaveBeenCalledTimes(1);
    baja();
  });

  it("si el servidor falla al marcar, devuelve la alerta a «sin leer» y lo informa", async () => {
    const usuario = userEvent.setup();
    marcarLeida.mockRejectedValue(new Error("Sin conexión"));
    abrir();

    await usuario.click(await screen.findByRole("button", { name: /Marcar como leída: Solicitud aprobada/ }));

    expect(await screen.findByText("No se pudo marcar como leída")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Marcar como leída: Solicitud aprobada/ })).toBeInTheDocument();
  });

  it("«Marcar todas como leídas» las marca en el servidor y se deshabilita", async () => {
    const usuario = userEvent.setup();
    abrir();

    const boton = await screen.findByRole("button", { name: "Marcar todas como leídas" });
    await usuario.click(boton);

    await waitFor(() => expect(marcarTodasLeidas).toHaveBeenCalledWith(ANA));
    expect(screen.getByRole("button", { name: "Marcar todas como leídas" })).toBeDisabled();
  });

  it("la pestaña «Sin leer» pide solo las no leídas y muestra el vacío cuando no hay", async () => {
    const usuario = userEvent.setup();
    abrir();
    await screen.findByText("Solicitud aprobada: Vacaciones");
    listarNotificaciones.mockResolvedValue({ notificaciones: [], no_leidas: 0, total: 0 });

    await usuario.click(screen.getByRole("tab", { name: /Sin leer/ }));

    expect(await screen.findByText("No tiene notificaciones sin leer")).toBeInTheDocument();
    expect(listarNotificaciones).toHaveBeenLastCalledWith(ANA, { soloNoLeidas: true, limite: 15, desplazamiento: 0 });
  });

  it("«Ver más» agrega la página siguiente sin repetir alertas y oculta el botón al terminar", async () => {
    const usuario = userEvent.setup();
    const tercera = { ...rechazada, id_notificacion: "n-3", titulo: "Solicitud aprobada: Permiso personal" };
    listarNotificaciones
      .mockResolvedValueOnce({ notificaciones: [aprobada, rechazada], no_leidas: 1, total: 3 })
      .mockResolvedValueOnce({ notificaciones: [rechazada, tercera], no_leidas: 1, total: 3 });
    abrir();

    expect(await screen.findByText("Mostrando 2 de 3")).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Ver más" }));

    expect(await screen.findByText("Mostrando 3 de 3")).toBeInTheDocument();
    expect(screen.getAllByText("Solicitud rechazada: Licencia médica")).toHaveLength(1);
    expect(screen.getByText("Solicitud aprobada: Permiso personal")).toBeInTheDocument();
    expect(listarNotificaciones).toHaveBeenLastCalledWith(ANA, { soloNoLeidas: false, limite: 15, desplazamiento: 2 });
    expect(screen.queryByRole("button", { name: "Ver más" })).not.toBeInTheDocument();
  });

  it("un error al cargar se muestra con la opción de reintentar", async () => {
    const usuario = userEvent.setup();
    listarNotificaciones.mockRejectedValueOnce(new Error("No se pudo conectar con el servidor"));
    abrir();

    expect(await screen.findByText("No se pudieron cargar las notificaciones")).toBeInTheDocument();
    expect(screen.getByText("No se pudo conectar con el servidor")).toBeInTheDocument();

    await usuario.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("Solicitud aprobada: Vacaciones")).toBeInTheDocument();
  });

  it("sin alertas muestra un vacío que explica qué verá aquí", async () => {
    listarNotificaciones.mockResolvedValue({ notificaciones: [], no_leidas: 0, total: 0 });
    abrir();

    expect(await screen.findByText("No tiene notificaciones")).toBeInTheDocument();
  });
});

describe("Campana del encabezado", () => {
  // La campana lee el empleado de una memoria compartida del módulo, no directamente del almacenamiento.
  beforeEach(() => guardarEmpleado(ANA));
  afterEach(() => olvidarEmpleado());

  const abrirCampana = () =>
    render(
      <ProveedorAvisos>
        <MemoryRouter>
          <CampanaNotificaciones />
        </MemoryRouter>
      </ProveedorAvisos>
    );

  it("muestra el contador de sin leer y enlaza a la vista completa", async () => {
    const usuario = userEvent.setup();
    abrirCampana();

    const campana = await screen.findByRole("button", { name: "Notificaciones, 1 sin leer" });
    await usuario.click(campana);

    expect(await screen.findByRole("link", { name: "Ver todas las notificaciones" })).toHaveAttribute(
      "href",
      "/comunicaciones/notificaciones"
    );
  });

  it("actualiza su contador al instante cuando la vista completa cambia algo", async () => {
    abrirCampana();
    await screen.findByRole("button", { name: "Notificaciones, 1 sin leer" });
    contarNoLeidas.mockResolvedValue({ no_leidas: 0 });

    const { avisarCambioNotificaciones } = await import("./eventosNotificaciones");
    avisarCambioNotificaciones();

    expect(await screen.findByRole("button", { name: "Notificaciones" })).toBeInTheDocument();
  });
});
