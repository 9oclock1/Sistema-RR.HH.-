import { MemoryRouter, Route, Routes } from "react-router";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorApi } from "../../../api/cliente";
import { exportarHistorialQuejas, listarCatalogosHistorial, listarHistorialQuejas, obtenerHistorialQueja } from "../../../api/historialQuejas";
import { listarSucursalesQueja, obtenerSucursalQueja, registrarSucursalQueja } from "../../../api/casosQueja";
import ProveedorAvisos from "../../../components/ui/ProveedorAvisos";
import { cambiarRol } from "../../../context/sesion";
import { SECCIONES } from "../../../router/modulos";
import { puedeAcceder, ROLES } from "../../../utils/permisos";
import PaginaModulo from "../../inicio/PaginaModulo";
import SucursalQueja from "../casos/SucursalQueja";
import HistorialQuejasPage from "./HistorialQuejasPage";
import { RUTA_HISTORIAL_QUEJAS, rutaHistorialQueja } from "./historial";

vi.mock("../../../api/historialQuejas");
vi.mock("../../../api/casosQueja");

const QUEJA = "c0000000-0000-4000-8000-000000000001";
const NORTE = "c0000000-0000-4000-8000-000000000051";
const REGISTRO = "2031-03-01T13:00:00.000Z";
const CIERRE = "2031-03-10T13:00:00.000Z";
const ACCION = "Reunión con el encargado de cajas para acordar un trato respetuoso.";
const RESOLUCION = "Se capacitó al encargado y se reorganizaron los turnos de cajas.";

const CATALOGOS = {
  categorias: [
    { id_categoria_queja: 1, codigo: "CLIMA_LABORAL", nombre: "Clima laboral" },
    { id_categoria_queja: 2, codigo: "ACOSO", nombre: "Acoso" },
  ],
  sucursales: [{ id_sucursal: NORTE, nombre: "Sopocachi" }],
};

const CASO = {
  id_queja: QUEJA,
  codigo_seguimiento: "QJ-7K3M-9XQ2",
  es_anonima: true,
  categoria: { id: 1, codigo: "CLIMA_LABORAL", nombre: "Clima laboral" },
  prioridad: { id: 3, codigo: "ALTA", nombre: "Alta" },
  estado: { id: 5, codigo: "RESUELTA", nombre: "Resuelta", es_final: true },
  sucursal: null,
  responsable: { id_empleado: "r1", nombre_completo: "Rosa Rojas" },
  registrada_en: REGISTRO,
  derivada_en: "2031-03-02T13:00:00.000Z",
  cerrada_en: CIERRE,
  duracion_dias: 9,
  total_acciones: 1,
};

const PAGINA = (casos, total = casos.length) => ({ casos, total, pagina: 1, limite: 20 });

const DETALLE = {
  ...CASO,
  derivaciones: [
    {
      id_asignacion: "a1",
      responsable: { id_empleado: "r1", nombre_completo: "Rosa Rojas" },
      asignador: { id_empleado: "a1", nombre_completo: "Ana Arce" },
      comentario: "Revisar con el área de cajas.",
      asignada_en: "2031-03-02T13:00:00.000Z",
    },
  ],
  historial: [
    { estado: { codigo: "REGISTRADA", nombre: "Registrada" }, estado_anterior: null, fecha: REGISTRO, registrado_por: null },
    {
      estado: { codigo: "RESUELTA", nombre: "Resuelta" },
      estado_anterior: { codigo: "EN_ACCION", nombre: "En acción" },
      fecha: CIERRE,
      registrado_por: { id_empleado: "r1", nombre_completo: "Rosa Rojas" },
    },
  ],
  acciones: [
    {
      id_accion: "x1",
      tipo: { codigo: "PREVENTIVA", nombre: "Preventiva" },
      descripcion: ACCION,
      registrada_por: { id_empleado: "r1", nombre_completo: "Rosa Rojas" },
      registrada_en: "2031-03-05T13:00:00.000Z",
    },
  ],
  resolucion: { descripcion: RESOLUCION },
};

const modulo = () => SECCIONES.flatMap((s) => s.modulos).find((m) => m.ruta === RUTA_HISTORIAL_QUEJAS);

const montar = (ruta = RUTA_HISTORIAL_QUEJAS) =>
  render(
    <ProveedorAvisos>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path={`${RUTA_HISTORIAL_QUEJAS}/:idQueja?`} element={<HistorialQuejasPage />} />
        </Routes>
      </MemoryRouter>
    </ProveedorAvisos>,
  );

const campo = (texto) => screen.findByLabelText(new RegExp(`^${texto}`));

describe("RF-71: historial de quejas atendidas (pantalla)", () => {
  beforeEach(() => {
    cambiarRol("auditor");
    listarCatalogosHistorial.mockResolvedValue(CATALOGOS);
    listarHistorialQuejas.mockResolvedValue(PAGINA([CASO]));
    obtenerHistorialQueja.mockResolvedValue(DETALLE);
    exportarHistorialQuejas.mockResolvedValue(new Blob(["csv"], { type: "text/csv" }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe("permisos", () => {
    it("el Auditor (TI) es un rol reconocido y solo él y el Administrador de RRHH ven el módulo", () => {
      expect(ROLES.auditor.nombre).toBe("Auditor (TI)");
      expect(modulo().roles).toEqual(["admin", "auditor"]);
      expect(puedeAcceder("admin", modulo().roles)).toBe(true);
      expect(puedeAcceder("auditor", modulo().roles)).toBe(true);
      for (const rol of ["gerente", "reclutador", "supervisor", "empleado"]) {
        expect(puedeAcceder(rol, modulo().roles)).toBe(false);
      }
    });

    it("otro rol que entra por la URL ve «Acceso restringido» y no se consulta el historial", () => {
      cambiarRol("supervisor");
      render(
        <MemoryRouter>
          <PaginaModulo seccion="Desempeño" modulo={modulo()} />
        </MemoryRouter>,
      );
      expect(screen.getByText("Acceso restringido")).toBeInTheDocument();
      expect(listarHistorialQuejas).not.toHaveBeenCalled();
    });

    it("si el backend responde 403 muestra un mensaje claro en lugar de la tabla", async () => {
      listarHistorialQuejas.mockRejectedValue(new ErrorApi(403, "Prohibido"));
      montar();
      expect(await screen.findByText("Acceso restringido")).toBeInTheDocument();
      expect(screen.getByText(/Solo el Administrador de RRHH y el Auditor/)).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });
  });

  describe("bandeja", () => {
    it("lista los casos cerrados con sus metadatos y sin datos de quien presentó la queja", async () => {
      montar();
      const fila = (await screen.findByText("QJ-7K3M-9XQ2")).closest("tr");
      expect(within(fila).getByText("Anónima")).toBeInTheDocument();
      expect(within(fila).getByText("Clima laboral")).toBeInTheDocument();
      expect(within(fila).getByText("Sin sucursal")).toBeInTheDocument();
      expect(within(fila).getByText("Rosa Rojas")).toBeInTheDocument();
      expect(within(fila).getByText("9 días")).toBeInTheDocument();
      expect(within(fila).getByText("Resuelta")).toBeInTheDocument();
      expect(within(fila).getByRole("link", { name: /Ver la trazabilidad de la queja QJ-7K3M-9XQ2/ })).toHaveAttribute(
        "href",
        rutaHistorialQueja(QUEJA),
      );
      expect(listarHistorialQuejas).toHaveBeenCalledWith({ rol: "auditor" }, expect.objectContaining({ pagina: 1, limite: 20 }));
    });

    it("combina los filtros de fecha de cierre, categoría y sucursal (incluida «Sin sucursal»)", async () => {
      const usuario = userEvent.setup();
      montar();
      await screen.findByText("QJ-7K3M-9XQ2");
      await usuario.type(await campo("Cerradas desde"), "2031-03-01");
      await usuario.type(await campo("Cerradas hasta"), "2031-03-31");
      await usuario.selectOptions(await campo("Categoría"), "2");
      await usuario.selectOptions(await campo("Sucursal"), "sin");
      await waitFor(() =>
        expect(listarHistorialQuejas).toHaveBeenLastCalledWith(
          { rol: "auditor" },
          { desde: "2031-03-01", hasta: "2031-03-31", categoria: "2", sucursal: "sin", pagina: 1, limite: 20 },
        ),
      );
    });

    it("un rango invertido muestra el error bajo el campo y no consulta", async () => {
      const usuario = userEvent.setup();
      montar();
      await screen.findByText("QJ-7K3M-9XQ2");
      await usuario.type(await campo("Cerradas hasta"), "2031-03-01");
      const llamadas = listarHistorialQuejas.mock.calls.length;
      await usuario.type(await campo("Cerradas desde"), "2031-04-01");
      expect(await screen.findByText("La fecha final no puede ser anterior a la inicial.")).toBeInTheDocument();
      expect(listarHistorialQuejas.mock.calls.length).toBe(llamadas);
      expect(screen.getByRole("button", { name: /Exportar CSV/ })).toBeDisabled();
    });

    it("exporta el CSV con los mismos filtros de la búsqueda", async () => {
      const usuario = userEvent.setup();
      URL.createObjectURL = vi.fn(() => "blob:historial");
      URL.revokeObjectURL = vi.fn();
      montar();
      await screen.findByText("QJ-7K3M-9XQ2");
      await usuario.selectOptions(await campo("Categoría"), "1");
      await usuario.selectOptions(await campo("Sucursal"), NORTE);
      await waitFor(() => expect(screen.getByRole("button", { name: /Exportar CSV/ })).toBeEnabled());
      await usuario.click(screen.getByRole("button", { name: /Exportar CSV/ }));
      await waitFor(() =>
        expect(exportarHistorialQuejas).toHaveBeenCalledWith(
          { rol: "auditor" },
          { desde: "", hasta: "", categoria: "1", sucursal: NORTE },
        ),
      );
      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(await screen.findByText("Historial exportado")).toBeInTheDocument();
    });

    it("sin casos cerrados muestra el estado vacío y no deja exportar", async () => {
      listarHistorialQuejas.mockResolvedValue(PAGINA([]));
      montar();
      expect(await screen.findByText("Todavía no hay quejas cerradas")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Exportar CSV/ })).toBeDisabled();
    });
  });

  describe("detalle de trazabilidad", () => {
    it("muestra la línea de tiempo con acciones y resolución, en solo lectura", async () => {
      montar(rutaHistorialQueja(QUEJA));
      expect(await screen.findByText(ACCION)).toBeInTheDocument();
      expect(screen.getByText(RESOLUCION)).toBeInTheDocument();
      expect(screen.getByText("Revisar con el área de cajas.")).toBeInTheDocument();
      expect(screen.getByText(/no muestra quién presentó la queja/)).toBeInTheDocument();
      expect(screen.queryByText("Presentada por")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Registrar|Guardar|Cambiar/ })).not.toBeInTheDocument();
      expect(obtenerHistorialQueja).toHaveBeenCalledWith({ rol: "auditor" }, QUEJA);
    });

    it("un caso que no está cerrado muestra que no se encontró", async () => {
      obtenerHistorialQueja.mockRejectedValue(new ErrorApi(404, "No se encontró"));
      montar(rutaHistorialQueja(QUEJA));
      expect(await screen.findByText("No se encontró el caso cerrado")).toBeInTheDocument();
    });
  });

  describe("sucursal del caso (Casos de quejas)", () => {
    it("el Administrador registra dónde ocurrió el problema", async () => {
      const usuario = userEvent.setup();
      obtenerSucursalQueja.mockResolvedValue({ sucursal: null, editable: true });
      listarSucursalesQueja.mockResolvedValue([{ id_sucursal: NORTE, nombre: "Sopocachi" }]);
      registrarSucursalQueja.mockResolvedValue({ sucursal: { id_sucursal: NORTE, nombre: "Sopocachi" }, editable: true });
      const sesion = { rol: "admin" };
      render(
        <ProveedorAvisos>
          <SucursalQueja idQueja={QUEJA} sesion={sesion} editable />
        </ProveedorAvisos>,
      );
      const selector = await campo("Sucursal");
      await waitFor(() => expect(within(selector).getByRole("option", { name: "Sopocachi" })).toBeInTheDocument());
      expect(screen.getByRole("button", { name: /Guardar/ })).toBeDisabled();
      await usuario.selectOptions(selector, NORTE);
      await usuario.click(screen.getByRole("button", { name: /Guardar/ }));
      await waitFor(() => expect(registrarSucursalQueja).toHaveBeenCalledWith(sesion, QUEJA, NORTE));
      expect(await screen.findByText("Sucursal guardada")).toBeInTheDocument();
    });

    it("en un caso cerrado la sucursal queda solo de lectura", async () => {
      obtenerSucursalQueja.mockResolvedValue({ sucursal: { id_sucursal: NORTE, nombre: "Sopocachi" }, editable: false });
      listarSucursalesQueja.mockResolvedValue([]);
      render(
        <ProveedorAvisos>
          <SucursalQueja idQueja={QUEJA} sesion={{ rol: "admin" }} editable={false} />
        </ProveedorAvisos>,
      );
      const selector = await campo("Sucursal");
      await waitFor(() => expect(selector).toHaveValue(NORTE));
      expect(selector).toBeDisabled();
      expect(screen.queryByRole("button", { name: /Guardar/ })).not.toBeInTheDocument();
    });
  });
});
