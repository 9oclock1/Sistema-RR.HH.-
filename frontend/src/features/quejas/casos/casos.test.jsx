import { MemoryRouter, Route, Routes } from "react-router";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorApi } from "../../../api/cliente";
import {
  derivarCasoQueja,
  listarCasosQueja,
  listarCatalogosCasos,
  listarEmpleadosQueja,
  listarResponsablesQueja,
  obtenerCasoQueja,
  registrarInvolucradoQueja,
} from "../../../api/casosQueja";
import ProveedorAvisos from "../../../components/ui/ProveedorAvisos";
import { cambiarRol } from "../../../context/sesion";
import PaginaModulo from "../../inicio/PaginaModulo";
import { SECCIONES } from "../../../router/modulos";
import CasosQuejaPage from "./CasosQuejaPage";
import { RUTA_CASOS_QUEJA, rutaCasoQueja } from "./casos";

vi.mock("../../../api/casosQueja");

const ADMIN = "c0000000-0000-4000-8000-000000000010";
const RRHH = "c0000000-0000-4000-8000-000000000011";
const SUPERVISOR = "c0000000-0000-4000-8000-000000000012";
const QUEJA = "c0000000-0000-4000-8000-000000000001";
const FECHA = "2026-11-07T14:30:00.000Z";

const CATALOGOS = {
  categorias: [
    { id_categoria_queja: 1, codigo: "CLIMA_LABORAL", nombre: "Clima laboral" },
    { id_categoria_queja: 2, codigo: "ACOSO", nombre: "Acoso" },
  ],
  prioridades: [
    { id_prioridad_queja: 1, codigo: "BAJA", nombre: "Baja" },
    { id_prioridad_queja: 4, codigo: "CRITICA", nombre: "Crítica" },
  ],
  estados: [
    { id_estado_queja: 1, codigo: "REGISTRADA", nombre: "Registrada", es_final: false },
    { id_estado_queja: 2, codigo: "ASIGNADA", nombre: "Asignada", es_final: false },
  ],
};

const FILA = {
  id_queja: QUEJA,
  codigo_seguimiento: "QJ-7K3M-9XQ2",
  es_anonima: true,
  categoria: { id: 1, codigo: "CLIMA_LABORAL", nombre: "Clima laboral" },
  prioridad: null,
  estado: { id: 1, codigo: "REGISTRADA", nombre: "Registrada", es_final: false },
  responsable: null,
  registrada_en: FECHA,
  actualizada_en: FECHA,
};

const PAGINA = (casos, total = casos.length, pagina = 1) => ({ casos, total, pagina, limite: 20 });

const DETALLE = {
  ...FILA,
  denunciante: null,
  asunto: "Trato hostil en cajas",
  descripcion: "El encargado del turno tarde grita al personal de cajas frente a los clientes.",
  adjuntos: [],
  derivaciones: [],
  involucrados: [{ id_empleado: SUPERVISOR, nombre_completo: "Saúl Suárez", registrado_en: FECHA }],
  historial: [{ estado: { codigo: "REGISTRADA", nombre: "Registrada" }, estado_anterior: null, fecha: FECHA, registrado_por: null }],
};

const RESPONSABLES = [
  { id_empleado: RRHH, nombre_completo: "Rosa Rojas", cargo: "Analista de RRHH", area: "RRHH", motivo: "RRHH" },
  { id_empleado: SUPERVISOR, nombre_completo: "Saúl Suárez", cargo: "Jefe de cajas", area: "Cajas", motivo: "SUPERVISOR" },
];

const montar = (ruta = RUTA_CASOS_QUEJA) =>
  render(
    <ProveedorAvisos>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path={`${RUTA_CASOS_QUEJA}/:idQueja?`} element={<CasosQuejaPage />} />
        </Routes>
      </MemoryRouter>
    </ProveedorAvisos>,
  );

const campo = (texto) => screen.findByLabelText(new RegExp(`^${texto}`));

describe("RF-69: bandeja y derivación de casos de quejas (pantalla)", () => {
  beforeEach(() => {
    cambiarRol("admin");
    localStorage.setItem("rrhh.idEmpleado", ADMIN);
    listarCatalogosCasos.mockResolvedValue(CATALOGOS);
    listarCasosQueja.mockResolvedValue(PAGINA([FILA]));
    obtenerCasoQueja.mockResolvedValue(DETALLE);
    listarResponsablesQueja.mockResolvedValue(RESPONSABLES);
    listarEmpleadosQueja.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe("bandeja", () => {
    it("muestra código, categoría, prioridad, estado, responsable y fecha, sin el contenido de la queja", async () => {
      montar();
      const fila = (await screen.findByText("QJ-7K3M-9XQ2")).closest("tr");
      expect(within(fila).getByText("Clima laboral")).toBeInTheDocument();
      expect(within(fila).getByText("Sin clasificar")).toBeInTheDocument();
      expect(within(fila).getByText("Registrada")).toBeInTheDocument();
      expect(within(fila).getByText("Sin asignar")).toBeInTheDocument();
      expect(within(fila).getByText("Anónima")).toBeInTheDocument();
      expect(within(fila).getByRole("link", { name: /Revisar la queja QJ-7K3M-9XQ2/ })).toHaveAttribute(
        "href",
        rutaCasoQueja(QUEJA),
      );
      expect(screen.queryByText(DETALLE.descripcion)).not.toBeInTheDocument();
      expect(listarCasosQueja).toHaveBeenCalledWith({ rol: "admin" }, expect.objectContaining({ pagina: 1, limite: 20 }));
    });

    it("filtra por estado, categoría y prioridad (incluida «Sin clasificar») y vuelve a la página 1", async () => {
      const usuario = userEvent.setup();
      listarCasosQueja.mockResolvedValue(PAGINA([FILA], 45));
      montar();
      await usuario.click(await screen.findByRole("button", { name: "Siguiente" }));
      await waitFor(() =>
        expect(listarCasosQueja).toHaveBeenLastCalledWith({ rol: "admin" }, expect.objectContaining({ pagina: 2 })),
      );

      await usuario.selectOptions(await campo("Estado"), "1");
      await usuario.selectOptions(await campo("Categoría"), "2");
      await usuario.selectOptions(await campo("Prioridad"), "sin");
      await waitFor(() =>
        expect(listarCasosQueja).toHaveBeenLastCalledWith(
          { rol: "admin" },
          { estado: "1", categoria: "2", prioridad: "sin", pagina: 1, limite: 20 },
        ),
      );
    });

    it("sin resultados con filtros ofrece quitarlos", async () => {
      const usuario = userEvent.setup();
      montar();
      await screen.findByText("QJ-7K3M-9XQ2");
      listarCasosQueja.mockResolvedValue(PAGINA([]));
      await usuario.selectOptions(await campo("Prioridad"), "4");
      await usuario.click(await screen.findByRole("button", { name: "Quitar filtros" }));
      await waitFor(() =>
        expect(listarCasosQueja).toHaveBeenLastCalledWith({ rol: "admin" }, { estado: "", categoria: "", prioridad: "", pagina: 1, limite: 20 }),
      );
    });

    it("solo el Administrador de RRHH puede abrir el módulo", () => {
      const modulo = SECCIONES.flatMap((s) => s.modulos).find((m) => m.ruta === RUTA_CASOS_QUEJA);
      expect(modulo.roles).toEqual(["admin"]);
      cambiarRol("supervisor");
      render(
        <MemoryRouter>
          <PaginaModulo seccion="Desempeño" modulo={modulo} />
        </MemoryRouter>,
      );
      expect(screen.getByText("Acceso restringido")).toBeInTheDocument();
      expect(listarCasosQueja).not.toHaveBeenCalled();
    });
  });

  describe("detalle y derivación", () => {
    it("muestra la descripción descifrada solo en el detalle", async () => {
      montar(rutaCasoQueja(QUEJA));
      expect(await screen.findByText(DETALLE.descripcion)).toBeInTheDocument();
      expect(screen.getByText("Anónimo, sin datos de quien la presentó")).toBeInTheDocument();
      expect(obtenerCasoQueja).toHaveBeenCalledWith({ rol: "admin", idEmpleado: ADMIN }, QUEJA);
    });

    it("advierte el conflicto de interés al elegir a un involucrado y no deja derivar", async () => {
      const usuario = userEvent.setup();
      montar(rutaCasoQueja(QUEJA));
      const responsable = await campo("Responsable");
      await waitFor(() => expect(responsable).toBeEnabled());
      expect(within(responsable).getByRole("option", { name: /Saúl Suárez.*involucrado/ })).toBeInTheDocument();

      await usuario.selectOptions(responsable, SUPERVISOR);
      const alerta = await screen.findByRole("alert");
      expect(alerta).toHaveTextContent("Conflicto de interés");
      expect(screen.getByRole("button", { name: "Derivar caso" })).toBeDisabled();
      expect(derivarCasoQueja).not.toHaveBeenCalled();

      await usuario.selectOptions(responsable, RRHH);
      expect(screen.queryByText("Conflicto de interés")).not.toBeInTheDocument();
    });

    it("muestra la advertencia si el servidor rechaza la derivación por conflicto de interés", async () => {
      const usuario = userEvent.setup();
      derivarCasoQueja.mockRejectedValue(
        new ErrorApi(409, "Conflicto de interés: la persona elegida está involucrada en esta queja.", [
          { campo: "id_empleado_responsable", codigo: "CONFLICTO_INTERES", mensaje: "Conflicto de interés" },
        ]),
      );
      montar(rutaCasoQueja(QUEJA));
      await usuario.selectOptions(await campo("Prioridad"), "4");
      const responsable = await campo("Responsable");
      await waitFor(() => expect(responsable).toBeEnabled());
      await usuario.selectOptions(responsable, RRHH);
      await usuario.click(screen.getByRole("button", { name: "Derivar caso" }));

      expect(await screen.findByText("Conflicto de interés")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Derivar caso" })).toBeDisabled();
    });

    it("exige la prioridad y el responsable antes de derivar", async () => {
      const usuario = userEvent.setup();
      montar(rutaCasoQueja(QUEJA));
      await usuario.click(await screen.findByRole("button", { name: "Derivar caso" }));
      expect(await screen.findByText("Seleccione la prioridad.")).toBeInTheDocument();
      expect(screen.getByText("Seleccione el responsable del caso.")).toBeInTheDocument();
      expect(derivarCasoQueja).not.toHaveBeenCalled();
    });

    it("deriva con categoría, prioridad y responsable, y avisa si el aviso no se entregó", async () => {
      const usuario = userEvent.setup();
      derivarCasoQueja.mockResolvedValue({
        responsable: { id_empleado: RRHH, nombre_completo: "Rosa Rojas" },
        estado: { codigo: "ASIGNADA", nombre: "Asignada" },
        notificacion: { estado: "FALLIDO", notificada_en: null },
      });
      montar(rutaCasoQueja(QUEJA));
      await usuario.selectOptions(await campo("Categoría"), "2");
      await usuario.selectOptions(await campo("Prioridad"), "4");
      const responsable = await campo("Responsable");
      await waitFor(() => expect(responsable).toBeEnabled());
      await usuario.selectOptions(responsable, RRHH);
      await usuario.type(screen.getByLabelText(/Comentario/), "Coordinar con cajas");
      await usuario.click(screen.getByRole("button", { name: "Derivar caso" }));

      await waitFor(() =>
        expect(derivarCasoQueja).toHaveBeenCalledWith({ rol: "admin", idEmpleado: ADMIN }, QUEJA, {
          idCategoria: "2",
          idPrioridad: "4",
          idResponsable: RRHH,
          comentario: "Coordinar con cajas",
        }),
      );
      expect(await screen.findByText("Caso derivado")).toBeInTheDocument();
      expect(screen.getByText("No se pudo avisar al responsable")).toBeInTheDocument();
      await waitFor(() => expect(obtenerCasoQueja).toHaveBeenCalledTimes(2));
    });

    it("registra a un involucrado elegido de la lista de empleados", async () => {
      const usuario = userEvent.setup();
      listarEmpleadosQueja.mockResolvedValue([
        { id_empleado: RRHH, nombre_completo: "Rosa Rojas", cargo: "Analista de RRHH", activo: true },
        { id_empleado: SUPERVISOR, nombre_completo: "Saúl Suárez", cargo: "Jefe de cajas", activo: true },
      ]);
      registrarInvolucradoQueja.mockResolvedValue({ id_empleado: RRHH, nombre_completo: "Rosa Rojas" });
      montar(rutaCasoQueja(QUEJA));
      const selector = await campo("Agregar involucrado");
      await waitFor(() => expect(selector).toBeEnabled());
      expect(within(selector).queryByRole("option", { name: /Saúl Suárez/ })).not.toBeInTheDocument();
      await usuario.selectOptions(selector, RRHH);
      await usuario.click(screen.getByRole("button", { name: "Agregar" }));
      await waitFor(() =>
        expect(registrarInvolucradoQueja).toHaveBeenCalledWith({ rol: "admin", idEmpleado: ADMIN }, QUEJA, RRHH),
      );
    });

    it("sin usuario de prueba pide elegirlo y no deja derivar", async () => {
      localStorage.removeItem("rrhh.idEmpleado");
      montar(rutaCasoQueja(QUEJA));
      expect(await screen.findByText("Elija su usuario de prueba")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Derivar caso" })).toBeDisabled();
    });
  });
});
