import { MemoryRouter } from "react-router";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listarConvocatoriasEmpleado,
  listarConvocatoriasRrhh,
  listarPostulaciones,
  postularConvocatoria,
  revalidarPostulacion,
} from "../../api/convocatoriasInternas";
import { ApiError } from "../../api/httpClient";
import ProveedorAvisos from "../../components/ui/ProveedorAvisos";
import { fijarSesion } from "../../context/sesion";
import ConvocatoriasEmpleadoPage from "./ConvocatoriasEmpleadoPage";
import ConvocatoriasRrhhPage from "./ConvocatoriasRrhhPage";

vi.mock("../../api/convocatoriasInternas");

const ANA = "f0000000-0000-4000-8000-000000000035";

const convocatoria = (id, titulo, estado, cambios = {}) => ({
  id_convocatoria: id,
  titulo,
  cargo: "Supervisor de Cajas",
  departamento: "Atención al cliente",
  sucursal: "Sopocachi",
  descripcion_requisitos: "Dos años como cajero.",
  meses_antiguedad_minima: 24,
  nota_minima_desempeno: 75,
  fecha_inicio_postulacion: "2026-11-17",
  fecha_cierre_postulacion: "2026-12-17",
  estado,
  dias_para_cierre: estado === "CERRADA" ? null : 25,
  estado_notificacion: "ENTREGADA",
  destinatarios_notificados: 12,
  mi_postulacion: null,
  ...cambios,
});

const postulacion = (nombre, estado, cambios = {}) => ({
  id_postulacion: `p-${nombre}`,
  nombre_completo: nombre,
  cargo_actual: "Cajero",
  sucursal_actual: "Sopocachi",
  estado_postulacion: estado,
  meses_permanencia: 44,
  nota_ultima_evaluacion: 91,
  ciclo_ultima_evaluacion: "Evaluación trimestral 2026-T3",
  puntaje_meritos: estado === "APTO" ? 85.2 : null,
  motivos_no_apto: null,
  error_validacion: null,
  ...cambios,
});

const montar = (Pagina) =>
  render(
    <MemoryRouter>
      <ProveedorAvisos>
        <Pagina />
      </ProveedorAvisos>
    </MemoryRouter>,
  );

describe("portal del empleado: postulación", () => {
  beforeEach(() => {
    fijarSesion({ id_empleado: ANA, correo: "ana.torrez@correo.test", rol: "empleado" });
  });

  it("criterio 1: el empleado se postula a una convocatoria abierta y ve el resultado de la validación", async () => {
    const abierta = convocatoria("c-1", "Supervisor de Cajas - Sopocachi", "ABIERTA");
    listarConvocatoriasEmpleado
      .mockResolvedValueOnce({ convocatorias: [abierta], total: 1 })
      .mockResolvedValue({ convocatorias: [{ ...abierta, mi_postulacion: postulacion("Ana Torrez", "APTO") }], total: 1 });
    postularConvocatoria.mockResolvedValue(postulacion("Ana Torrez", "APTO"));
    montar(ConvocatoriasEmpleadoPage);

    await userEvent.click(await screen.findByRole("button", { name: "Postularme a Supervisor de Cajas - Sopocachi" }));

    expect(postularConvocatoria).toHaveBeenCalledWith({ rol: "empleado", idEmpleado: ANA }, "c-1");
    const estado = await screen.findByRole("status", { name: "Mi postulación" });
    expect(estado.textContent).toContain("Apto");
    expect(estado.textContent).toContain("Puntaje de méritos: 85,2");
    expect(screen.queryByRole("button", { name: /Postularme/ })).toBeNull();
    expect(await screen.findByText(/quedó como apto/)).toBeTruthy();
  });

  it("criterio 3: si no es apto muestra los motivos", async () => {
    const motivos = [
      "Permanencia insuficiente: tiene 3 meses y la convocatoria exige 2 años.",
      "Nota de la última evaluación insuficiente: obtuvo 60 (T3) y la mínima es 75.",
    ];
    listarConvocatoriasEmpleado.mockResolvedValue({
      convocatorias: [
        convocatoria("c-1", "Supervisor de Cajas - Sopocachi", "ABIERTA", {
          mi_postulacion: postulacion("Ana Torrez", "NO_APTO", { motivos_no_apto: motivos, meses_permanencia: 3, nota_ultima_evaluacion: 60 }),
        }),
      ],
      total: 1,
    });
    montar(ConvocatoriasEmpleadoPage);

    const estado = await screen.findByRole("status", { name: "Mi postulación" });
    expect(estado.textContent).toContain("No apto");
    const lista = within(estado).getByRole("list", { name: "Motivos por los que no es apto" });
    expect(within(lista).getAllByRole("listitem").map((li) => li.textContent)).toEqual(motivos);
  });

  it("una segunda postulación muestra el rechazo del servidor", async () => {
    listarConvocatoriasEmpleado.mockResolvedValue({ convocatorias: [convocatoria("c-1", "Supervisor de Cajas - Sopocachi", "ABIERTA")], total: 1 });
    postularConvocatoria.mockRejectedValue(
      new ApiError("Ya se postuló a esta convocatoria: la postulación se registra una sola vez.", 409, { codigo: "YA_POSTULADO" }),
    );
    montar(ConvocatoriasEmpleadoPage);

    await userEvent.click(await screen.findByRole("button", { name: /Postularme/ }));
    expect(await screen.findByText(/la postulación se registra una sola vez/)).toBeTruthy();
  });

  it("no ofrece postularse a convocatorias programadas ni cerradas", async () => {
    listarConvocatoriasEmpleado.mockResolvedValue({
      convocatorias: [convocatoria("c-2", "Jefe de Cajas - próxima", "PROGRAMADA"), convocatoria("c-3", "Asesor - anterior", "CERRADA")],
      total: 2,
    });
    montar(ConvocatoriasEmpleadoPage);

    await screen.findByText("Jefe de Cajas - próxima");
    expect(screen.getByText("Asesor - anterior")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Postularme/ })).toBeNull();
  });
});

describe("RRHH: postulaciones y ranking de méritos", () => {
  const cerrada = convocatoria("c-9", "Asesor de Atención - Miraflores", "CERRADA");
  const ranking = {
    convocatoria: { ...cerrada, estado: "CERRADA", meses_antiguedad_minima: 6, nota_minima_desempeno: 60 },
    ranking_definitivo: true,
    formula_meritos: { descripcion: "70 % nota de la última evaluación + 30 % antigüedad (hasta 60 meses)" },
    totales: { postulaciones: 5, aptos: 2, no_aptos: 2, pendientes: 1 },
    ranking: [
      postulacion("Carlos Rojas", "APTO", { posicion: 1, puntaje_meritos: 90.2, nota_ultima_evaluacion: 86 }),
      postulacion("Ana Torrez", "APTO", { posicion: 2, puntaje_meritos: 85.2 }),
    ],
    no_aptos: [
      postulacion("Diego Quispe", "NO_APTO", { motivos_no_apto: ["Nota de la última evaluación insuficiente: obtuvo 55 y la mínima es 60."] }),
      postulacion("Rosa Mendoza", "NO_APTO", { motivos_no_apto: ["No tiene evaluaciones de desempeño cerradas."] }),
    ],
    pendientes: [postulacion("Fito Mamani", "PENDIENTE_VALIDACION", { error_validacion: "No se pudo contactar a PerformanceService" })],
  };

  const abrirPostulaciones = async () => {
    montar(ConvocatoriasRrhhPage);
    await userEvent.click(await screen.findByRole("button", { name: "Ver las postulaciones de Asesor de Atención - Miraflores" }));
    return screen.findByRole("dialog", { name: "Postulaciones: Asesor de Atención - Miraflores" });
  };

  beforeEach(() => {
    fijarSesion({ id_empleado: ANA, correo: "ana.torrez@correo.test", rol: "admin" });
    listarConvocatoriasRrhh.mockResolvedValue({ convocatorias: [cerrada], total: 1 });
    listarPostulaciones.mockResolvedValue(ranking);
  });

  it("criterio 4: con la convocatoria cerrada muestra el ranking final de aptos por puntaje de méritos", async () => {
    const dialogo = await abrirPostulaciones();

    expect(await within(dialogo).findByText("Ranking final de aptos")).toBeTruthy();
    const tabla = within(dialogo).getByRole("table", { name: /Ranking de postulantes aptos/ });
    const filas = within(tabla).getAllByRole("row").slice(1);
    expect(filas.map((f) => f.textContent)).toEqual([
      expect.stringMatching(/^1Carlos Rojas.*90,2$/),
      expect.stringMatching(/^2Ana Torrez.*85,2$/),
    ]);
    expect(within(dialogo).getByText(/70 % nota de la última evaluación/)).toBeTruthy();
  });

  it("criterio 3: los no aptos aparecen con su motivo", async () => {
    const dialogo = await abrirPostulaciones();
    const noAptos = await within(dialogo).findByRole("list", { name: "Postulantes no aptos" });
    expect(noAptos.textContent).toContain("Diego Quispe");
    expect(noAptos.textContent).toContain("obtuvo 55 y la mínima es 60");
    expect(noAptos.textContent).toContain("No tiene evaluaciones de desempeño cerradas");
  });

  it("con la convocatoria abierta el ranking es provisional", async () => {
    listarPostulaciones.mockResolvedValue({ ...ranking, ranking_definitivo: false });
    const dialogo = await abrirPostulaciones();
    expect(await within(dialogo).findByText("Ranking provisional de aptos")).toBeTruthy();
    expect(within(dialogo).getByText("La convocatoria sigue recibiendo postulaciones")).toBeTruthy();
  });

  it("el Administrador vuelve a validar una postulación pendiente", async () => {
    revalidarPostulacion.mockResolvedValue(postulacion("Fito Mamani", "APTO"));
    const dialogo = await abrirPostulaciones();
    const pendientes = await within(dialogo).findByRole("list", { name: "Postulaciones pendientes de validar" });
    expect(pendientes.textContent).toContain("No se pudo contactar a PerformanceService");

    await userEvent.click(within(pendientes).getByRole("button", { name: "Volver a validar" }));
    await waitFor(() => expect(revalidarPostulacion).toHaveBeenCalledWith({ rol: "admin", idEmpleado: ANA }, "c-9", "p-Fito Mamani"));
    expect(await screen.findByText("Validada: cumple los requisitos.")).toBeTruthy();
  });

  it("la gerencia revisa el ranking pero no vuelve a validar", async () => {
    fijarSesion({ id_empleado: ANA, correo: "ana.torrez@correo.test", rol: "gerente" });
    const dialogo = await abrirPostulaciones();
    await within(dialogo).findByRole("list", { name: "Postulaciones pendientes de validar" });
    expect(within(dialogo).queryByRole("button", { name: "Volver a validar" })).toBeNull();
  });
});
