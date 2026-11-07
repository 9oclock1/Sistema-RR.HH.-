import { MemoryRouter, Route, Routes } from "react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorApi } from "../../api/cliente";
import { consultarQueja, listarCategoriasQueja, registrarQueja } from "../../api/quejas";
import ProveedorAvisos from "../../components/ui/ProveedorAvisos";
import BuzonQuejasPage from "./BuzonQuejasPage";
import ConsultarQuejaPage from "./ConsultarQuejaPage";
import { normalizarCodigo, RUTA_BUZON_QUEJAS, RUTA_CONSULTAR_QUEJA, validarQueja } from "./reglas";

vi.mock("../../api/quejas");

const EMPLEADO = "e0000000-0000-4000-8000-000000000004";
const CATEGORIAS = [
  { id_categoria_queja: 1, codigo: "CLIMA_LABORAL", nombre: "Clima laboral" },
  { id_categoria_queja: 2, codigo: "ACOSO", nombre: "Acoso" },
];
const REGISTRADA = {
  codigo_seguimiento: "QJ-7K3M-9XQ2",
  estado: { codigo: "REGISTRADA", nombre: "Registrada" },
  registrada_en: "2026-11-07T14:30:00.000Z",
  adjuntos: 1,
};
const SEGUIMIENTO = {
  codigo_seguimiento: "QJ-7K3M-9XQ2",
  estado: { codigo: "REGISTRADA", nombre: "Registrada", es_final: false },
  categoria: "Acoso",
  registrada_en: "2026-11-07T14:30:00.000Z",
  actualizada_en: "2026-11-07T14:30:00.000Z",
  historial: [{ codigo: "REGISTRADA", estado: "Registrada", fecha: "2026-11-07T14:30:00.000Z" }],
};

const montar = (ruta = RUTA_BUZON_QUEJAS) =>
  render(
    <ProveedorAvisos>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path={RUTA_BUZON_QUEJAS} element={<BuzonQuejasPage />} />
          <Route path={RUTA_CONSULTAR_QUEJA} element={<ConsultarQuejaPage />} />
        </Routes>
      </MemoryRouter>
    </ProveedorAvisos>,
  );

async function llenar(usuario, { categoria = "Acoso", asunto = "Comentarios inapropiados", descripcion } = {}) {
  await usuario.selectOptions(await screen.findByLabelText(/Categoría/), categoria);
  await usuario.type(screen.getByLabelText(/Asunto/), asunto);
  await usuario.type(
    screen.getByLabelText(/Descripción/),
    descripcion ?? "Un supervisor hace comentarios inapropiados de forma reiterada.",
  );
}

describe("RF-68: buzón de quejas (pantalla)", () => {
  beforeEach(() => {
    listarCategoriasQueja.mockResolvedValue(CATEGORIAS);
    registrarQueja.mockResolvedValue(REGISTRADA);
    localStorage.setItem("rrhh.idEmpleado", EMPLEADO);
  });

  afterEach(() => vi.clearAllMocks());

  it("sin datos, muestra el resumen de errores en español y no envía", async () => {
    const usuario = userEvent.setup();
    montar();
    await usuario.click(await screen.findByRole("button", { name: "Enviar queja" }));

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("Categoría: Seleccione la categoría de la queja.");
    expect(alerta).toHaveTextContent("Asunto: Escriba el asunto de la queja.");
    expect(alerta).toHaveTextContent("Descripción: Describa lo ocurrido.");
    expect(registrarQueja).not.toHaveBeenCalled();
  });

  it("explica qué implica el envío anónimo", async () => {
    montar();
    const casilla = await screen.findByRole("checkbox", { name: "Enviar de forma anónima" });
    expect(casilla).not.toBeChecked();
    expect(casilla).toHaveAccessibleDescription(/No se guardará su nombre.*código de seguimiento será la única forma/);
  });

  it("anónima: envía sin el empleado aunque haya un usuario elegido y muestra el código", async () => {
    const usuario = userEvent.setup();
    montar();
    await usuario.click(await screen.findByRole("checkbox", { name: "Enviar de forma anónima" }));
    await llenar(usuario);
    const adjunto = new File(["x"], "foto.png", { type: "image/png" });
    await usuario.upload(screen.getByLabelText(/Elegir archivos/), adjunto);
    await usuario.click(screen.getByRole("button", { name: "Enviar queja" }));

    expect(await screen.findByRole("heading", { name: "Su queja fue registrada" })).toHaveFocus();
    expect(registrarQueja).toHaveBeenCalledWith({
      idEmpleado: undefined,
      anonima: true,
      idCategoria: "2",
      asunto: "Comentarios inapropiados",
      descripcion: "Un supervisor hace comentarios inapropiados de forma reiterada.",
      archivos: [adjunto],
    });
    expect(screen.getByText("QJ-7K3M-9XQ2")).toBeInTheDocument();
    expect(screen.getByText(/no podremos recuperar el código si lo pierde/)).toBeInTheDocument();
  });

  it("identificada: envía con el usuario elegido", async () => {
    const usuario = userEvent.setup();
    montar();
    await llenar(usuario, { categoria: "Clima laboral" });
    await usuario.click(screen.getByRole("button", { name: "Enviar queja" }));

    await screen.findByRole("heading", { name: "Su queja fue registrada" });
    expect(registrarQueja).toHaveBeenCalledWith(expect.objectContaining({ idEmpleado: EMPLEADO, anonima: false, idCategoria: "1" }));
  });

  it("identificada sin usuario de prueba: pide elegir uno o enviar de forma anónima", async () => {
    localStorage.removeItem("rrhh.idEmpleado");
    const usuario = userEvent.setup();
    montar();
    await llenar(usuario);
    await usuario.click(screen.getByRole("button", { name: "Enviar queja" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Seleccione un usuario de prueba en la barra lateral o envíe la queja de forma anónima.",
    );
    expect(registrarQueja).not.toHaveBeenCalled();
  });

  it("copia el código de seguimiento al portapapeles", async () => {
    const usuario = userEvent.setup();
    const escribir = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    montar();
    await usuario.click(await screen.findByRole("checkbox", { name: "Enviar de forma anónima" }));
    await llenar(usuario);
    await usuario.click(screen.getByRole("button", { name: "Enviar queja" }));
    await usuario.click(await screen.findByRole("button", { name: "Copiar código" }));

    expect(escribir).toHaveBeenCalledWith("QJ-7K3M-9XQ2");
    expect(await screen.findByRole("button", { name: "Copiado" })).toBeInTheDocument();
  });

  it("muestra junto a cada campo los errores que devuelve el backend", async () => {
    registrarQueja.mockRejectedValue(
      new ErrorApi(400, "«x.gif» no está permitido.", [{ campo: "archivos", mensaje: "«x.gif» no está permitido." }]),
    );
    const usuario = userEvent.setup();
    montar();
    await usuario.click(await screen.findByRole("checkbox", { name: "Enviar de forma anónima" }));
    await llenar(usuario);
    await usuario.click(screen.getByRole("button", { name: "Enviar queja" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Adjuntos: «x.gif» no está permitido.");
  });
});

describe("RF-68: consultar mi queja (pantalla pública)", () => {
  afterEach(() => vi.clearAllMocks());

  it("consulta con el código normalizado y muestra estado, categoría e historial", async () => {
    consultarQueja.mockResolvedValue(SEGUIMIENTO);
    const usuario = userEvent.setup();
    montar(RUTA_CONSULTAR_QUEJA);
    await usuario.type(screen.getByLabelText(/Código de seguimiento/), "qj 7k3m 9xq2");
    await usuario.click(screen.getByRole("button", { name: "Consultar" }));

    expect(await screen.findByRole("heading", { name: "QJ-7K3M-9XQ2" })).toBeInTheDocument();
    expect(consultarQueja).toHaveBeenCalledWith("QJ-7K3M-9XQ2");
    expect(screen.getAllByText("Registrada").length).toBeGreaterThan(0);
    expect(screen.getByText("Acoso")).toBeInTheDocument();
  });

  it("con un formato inválido avisa en el campo y no consulta", async () => {
    const usuario = userEvent.setup();
    montar(RUTA_CONSULTAR_QUEJA);
    await usuario.type(screen.getByLabelText(/Código de seguimiento/), "hola");
    await usuario.click(screen.getByRole("button", { name: "Consultar" }));

    expect(await screen.findByText("Escriba el código con el formato QJ-XXXX-XXXX.")).toBeInTheDocument();
    expect(consultarQueja).not.toHaveBeenCalled();
  });

  it("si el código no existe, muestra el mensaje del servidor", async () => {
    consultarQueja.mockRejectedValue(new ErrorApi(404, "No encontramos una queja con ese código. Revise que esté bien escrito."));
    const usuario = userEvent.setup();
    montar(RUTA_CONSULTAR_QUEJA);
    await usuario.type(screen.getByLabelText(/Código de seguimiento/), "QJ-0000-0000");
    await usuario.click(screen.getByRole("button", { name: "Consultar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No encontramos una queja con ese código.");
  });

  it("no necesita usuario ni guarda el código en el navegador", async () => {
    consultarQueja.mockResolvedValue(SEGUIMIENTO);
    const usuario = userEvent.setup();
    montar(RUTA_CONSULTAR_QUEJA);
    await usuario.type(screen.getByLabelText(/Código de seguimiento/), "QJ-7K3M-9XQ2");
    await usuario.click(screen.getByRole("button", { name: "Consultar" }));

    await screen.findByRole("heading", { name: "QJ-7K3M-9XQ2" });
    expect(localStorage.length).toBe(0);
  });

  it("desde la confirmación, abre la consulta con el código ya cargado", async () => {
    listarCategoriasQueja.mockResolvedValue(CATEGORIAS);
    registrarQueja.mockResolvedValue(REGISTRADA);
    consultarQueja.mockResolvedValue(SEGUIMIENTO);
    const usuario = userEvent.setup();
    montar();
    await usuario.click(await screen.findByRole("checkbox", { name: "Enviar de forma anónima" }));
    await llenar(usuario);
    await usuario.click(screen.getByRole("button", { name: "Enviar queja" }));
    await usuario.click(await screen.findByRole("link", { name: "Consultar estado" }));

    await waitFor(() => expect(consultarQueja).toHaveBeenCalledWith("QJ-7K3M-9XQ2"));
    expect(await screen.findByRole("heading", { name: "QJ-7K3M-9XQ2" })).toBeInTheDocument();
  });
});

describe("RF-68: reglas del formulario", () => {
  it("normaliza el código igual que el backend", () => {
    expect(normalizarCodigo("qj-34ok-aldk")).toBe("QJ-340K-A1DK");
    expect(normalizarCodigo("7K3M9XQ2")).toBe("QJ-7K3M-9XQ2");
    expect(normalizarCodigo("QJ-UUUU-1234")).toBeNull();
  });

  it("la identificada exige usuario; la anónima no", () => {
    const datos = { idCategoria: "1", asunto: "Asunto válido", descripcion: "Descripción suficientemente larga.", anonima: false };
    expect(validarQueja(datos, { idEmpleado: null }).anonima).toBeDefined();
    expect(validarQueja({ ...datos, anonima: true }, { idEmpleado: null })).toEqual({});
  });
});

describe("RF-68: rutas", () => {
  it("«Consultar mi queja» es pública: queda fuera del layout con rol y sesión", async () => {
    const { router } = await import("../../router/index.jsx");
    const publica = router.routes.find((ruta) => ruta.path === RUTA_CONSULTAR_QUEJA);
    const layout = router.routes.find((ruta) => ruta.path === "/");
    expect(publica).toBeDefined();
    expect(layout.children.some((ruta) => ruta.path === RUTA_CONSULTAR_QUEJA)).toBe(false);
    expect(layout.children.some((ruta) => ruta.path === RUTA_BUZON_QUEJAS)).toBe(true);
  }, 60_000);
});
