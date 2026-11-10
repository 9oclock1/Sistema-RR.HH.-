import { MemoryRouter } from "react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorApi } from "../../api/cliente";
import { listarAuditoriaBonos } from "../../api/bonificaciones";
import ProveedorAvisos from "../../components/ui/ProveedorAvisos";
import { cambiarRol } from "../../context/sesion";
import { SECCIONES } from "../../router/modulos";
import { puedeAcceder } from "../../utils/permisos";
import PaginaModulo from "../inicio/PaginaModulo";
import AuditoriaBonosPage from "./AuditoriaBonosPage";
import { RUTA_AUDITORIA_BONOS } from "./auditoria";

vi.mock("../../api/bonificaciones");

const modulo = () => SECCIONES.flatMap((s) => s.modulos).find((m) => m.ruta === RUTA_AUDITORIA_BONOS);

const montar = () =>
  render(
    <ProveedorAvisos>
      <MemoryRouter>
        <AuditoriaBonosPage />
      </MemoryRouter>
    </ProveedorAvisos>,
  );

describe("RF-53: auditoría y historial de bonificaciones (pantalla)", () => {
  beforeEach(() => {
    cambiarRol("auditor");
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("solo el Administrador de RRHH y el Auditor ven el módulo", () => {
    expect(modulo().roles).toEqual(["admin", "auditor"]);
    expect(puedeAcceder("admin", modulo().roles)).toBe(true);
    expect(puedeAcceder("auditor", modulo().roles)).toBe(true);
    for (const rol of ["gerente", "reclutador", "supervisor", "empleado"]) {
      expect(puedeAcceder(rol, modulo().roles)).toBe(false);
    }
  });

  it("otro rol que entra por la URL ve «Acceso restringido» y no se consulta nada", () => {
    cambiarRol("supervisor");
    render(
      <MemoryRouter>
        <PaginaModulo seccion="Planillas" modulo={modulo()} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Acceso restringido")).toBeInTheDocument();
    expect(listarAuditoriaBonos).not.toHaveBeenCalled();
  });

  it("muestra las tres pestañas: auditoría, por colaborador y por sucursal", async () => {
    montar();
    expect(await screen.findByRole("tab", { name: "Auditoría" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Por colaborador" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Por sucursal" })).toBeInTheDocument();
  });

  it("si el backend responde 403 en la auditoría, muestra «Acceso restringido» en vez de la tabla", async () => {
    listarAuditoriaBonos.mockRejectedValue(new ErrorApi(403, "Prohibido"));
    const usuario = userEvent.setup();
    montar();
    await usuario.type(await screen.findByLabelText("Periodo"), "2026-11");
    expect(await screen.findByText("Acceso restringido")).toBeInTheDocument();
  });
});
