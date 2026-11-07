import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { consultarQueja, registrarQueja } from "./quejas";

const EMPLEADO = "e0000000-0000-4000-8000-000000000004";
const archivo = (nombre, tipo) => new File(["contenido"], nombre, { type: tipo });

describe("RF-68: API del buzón de quejas", () => {
  let solicitudes;

  beforeEach(() => {
    solicitudes = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url, opciones) => {
        solicitudes.push({ url, ...opciones });
        return new Response(JSON.stringify({ codigo_seguimiento: "QJ-7K3M-9XQ2" }), { status: 201 });
      }),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  const datos = {
    idEmpleado: EMPLEADO,
    idCategoria: "2",
    asunto: "Comentarios inapropiados",
    descripcion: "Un supervisor hace comentarios inapropiados.",
    archivos: [archivo("foto-de-juan.jpg", "image/jpeg"), archivo("Denuncia Juan.PDF", "application/pdf")],
  };

  it("anónima: no envía X-Empleado-Id ni Authorization y renombra los archivos", async () => {
    await registrarQueja({ ...datos, anonima: true });

    const [{ url, method, headers, body }] = solicitudes;
    expect(url).toBe("/api/perf/quejas");
    expect(method).toBe("POST");
    expect(Object.keys(headers).map((h) => h.toLowerCase())).not.toEqual(
      expect.arrayContaining(["x-empleado-id", "authorization"]),
    );
    expect(JSON.stringify(headers)).not.toContain(EMPLEADO);
    expect(body.get("anonima")).toBe("true");
    expect(body.getAll("archivos").map((a) => a.name)).toEqual(["adjunto-1.jpg", "adjunto-2.pdf"]);
    expect([...body.keys()]).not.toContain("id_empleado");
  });

  it("identificada: envía X-Empleado-Id y conserva los nombres de los archivos", async () => {
    await registrarQueja({ ...datos, anonima: false });

    const [{ headers, body }] = solicitudes;
    expect(headers["X-Empleado-Id"]).toBe(EMPLEADO);
    expect(headers.Authorization).toBeUndefined();
    expect(body.get("anonima")).toBe("false");
    expect(body.get("id_categoria_queja")).toBe("2");
    expect(body.getAll("archivos").map((a) => a.name)).toEqual(["foto-de-juan.jpg", "Denuncia Juan.PDF"]);
  });

  it("la consulta por código va en el cuerpo, sin cabeceras de identidad", async () => {
    await consultarQueja("QJ-7K3M-9XQ2");

    const [{ url, method, headers, body }] = solicitudes;
    expect(url).toBe("/api/perf/quejas/seguimiento");
    expect(method).toBe("POST");
    expect(JSON.parse(body)).toEqual({ codigo: "QJ-7K3M-9XQ2" });
    expect(headers).toEqual({ "Content-Type": "application/json" });
  });
});
