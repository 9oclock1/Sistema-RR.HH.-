const { describe, it, before, beforeEach, afterEach, after, mock } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { randomBytes } = require("node:crypto");

const CARPETA = fs.mkdtempSync(path.join(os.tmpdir(), "quejas-servicio-"));
process.env.QUEJAS_DIR = CARPETA;
process.env.QUEJAS_CLAVE_CIFRADO = randomBytes(32).toString("hex");
process.env.EMPLOYEE_SERVICE_URL = "http://empleados.prueba";

const clienteFalso = { query: async () => ({ rows: [] }) };
const rutaTransaccion = require.resolve(path.join(__dirname, "../config/transaccion"));
require.cache[rutaTransaccion] = {
  id: rutaTransaccion,
  filename: rutaTransaccion,
  loaded: true,
  exports: { enTransaccion: async (trabajo) => trabajo(clienteFalso) },
};

const modelo = require("../models/quejasModel");
const servicio = require("../services/quejasService");
const { descifrar, descifrarTexto } = require("../utils/cifrado");
const { jpegConExif } = require("./ayudas/archivosQueja");

const EMPLEADO = "e0000000-0000-4000-8000-000000000004";
const CUERPO = {
  id_categoria_queja: "2",
  asunto: "Comentarios inapropiados",
  descripcion: "Un supervisor hace comentarios inapropiados de forma reiterada.",
};
const CATEGORIAS = [1, 2, 3, 4].map((id) => ({ id_categoria_queja: id, codigo: `C${id}`, nombre: `Categoría ${id}` }));

const respuestaJson = (estado, cuerpo) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { "Content-Type": "application/json" } });

describe("RF-68: servicio de registro de quejas (base simulada)", () => {
  let llamadas;
  let jpg;

  before(async () => {
    jpg = await jpegConExif();
  });

  const simular = ({ empleados = () => respuestaJson(200, { nombres: "Pedro", apellidos: "Condori" }), choques = 0 } = {}) => {
    llamadas = { fetch: [], sincronizar: [], quejas: [], historial: [], adjuntos: [], codigos: [] };
    let pendientes = choques;
    mock.method(globalThis, "fetch", async (url) => {
      llamadas.fetch.push(String(url));
      return empleados();
    });
    mock.method(modelo, "listarCategorias", async () => CATEGORIAS);
    mock.method(modelo, "obtenerEstado", async () => ({ codigo: "REGISTRADA", nombre: "Registrada", es_final: false }));
    mock.method(modelo, "sincronizarEmpleado", async (db, datos) => llamadas.sincronizar.push(datos));
    mock.method(modelo, "insertarQueja", async (db, datos) => {
      llamadas.codigos.push(datos.codigo);
      if (pendientes > 0) {
        pendientes -= 1;
        throw Object.assign(new Error("duplicado"), { code: "23505", constraint: "uq_queja_codigo_seguimiento" });
      }
      llamadas.quejas.push(datos);
      return { id_queja: "q-1", creado_en: "2030-01-01T12:00:00.000Z" };
    });
    mock.method(modelo, "insertarHistorialInicial", async (db, datos) => llamadas.historial.push(datos));
    mock.method(modelo, "insertarAdjunto", async (db, datos) => llamadas.adjuntos.push(datos));
  };

  beforeEach(() => simular());
  afterEach(() => mock.restoreAll());
  after(() => fs.rmSync(CARPETA, { recursive: true, force: true }));

  const archivo = (nombre = "foto-de-juan.jpg") => ({ buffer: jpg, mimetype: "image/jpeg", originalname: nombre });

  it("queja identificada: guarda el vínculo con el empleado y sincroniza su réplica", async () => {
    const resultado = await servicio.registrarQueja({ cuerpo: { ...CUERPO, anonima: "false" }, idEmpleado: EMPLEADO });

    assert.match(resultado.codigo_seguimiento, /^QJ-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    assert.deepEqual(resultado.estado, { codigo: "REGISTRADA", nombre: "Registrada" });
    assert.equal(llamadas.fetch[0], `http://empleados.prueba/empleados/${EMPLEADO}`);
    assert.deepEqual(llamadas.sincronizar, [{ idEmpleado: EMPLEADO, nombres: "Pedro", apellidos: "Condori" }]);
    assert.equal(llamadas.quejas[0].idEmpleado, EMPLEADO);
    assert.equal(llamadas.quejas[0].esAnonima, false);
  });

  it("queja anónima: no consulta a EmployeeService ni guarda ningún dato del empleado", async () => {
    await servicio.registrarQueja({
      cuerpo: { ...CUERPO, anonima: "true" },
      archivos: [archivo()],
      idEmpleado: EMPLEADO,
    });

    assert.equal(llamadas.fetch.length, 0);
    assert.equal(llamadas.sincronizar.length, 0);
    const [queja] = llamadas.quejas;
    assert.equal(queja.idEmpleado, null);
    assert.equal(queja.esAnonima, true);
    assert.equal(llamadas.adjuntos[0].nombreOriginal, null);
    const guardado = JSON.stringify({ queja, historial: llamadas.historial, adjuntos: llamadas.adjuntos });
    assert.ok(!guardado.includes(EMPLEADO));
    assert.ok(!guardado.includes("foto-de-juan"));
  });

  it("cifra asunto, descripción y nombre del archivo; ninguno queda en texto plano", async () => {
    await servicio.registrarQueja({
      cuerpo: { ...CUERPO, anonima: "false" },
      archivos: [archivo()],
      idEmpleado: EMPLEADO,
    });

    const [queja] = llamadas.quejas;
    const [adjunto] = llamadas.adjuntos;
    assert.ok(Buffer.isBuffer(queja.asunto) && !queja.asunto.includes(Buffer.from(CUERPO.asunto)));
    assert.equal(descifrarTexto(queja.asunto), CUERPO.asunto);
    assert.equal(descifrarTexto(queja.descripcion), CUERPO.descripcion);
    assert.equal(descifrarTexto(adjunto.nombreOriginal), "foto-de-juan.jpg");
  });

  it("guarda el adjunto cifrado en disco, sin EXIF y con un nombre aleatorio", async () => {
    await servicio.registrarQueja({ cuerpo: { ...CUERPO, anonima: "true" }, archivos: [archivo()] });

    const [adjunto] = llamadas.adjuntos;
    assert.match(adjunto.clave, /^[0-9a-f]{32}$/);
    const enDisco = fs.readFileSync(path.join(CARPETA, adjunto.clave));
    assert.ok(!enDisco.includes(Buffer.from("JFIF")) && !enDisco.includes(Buffer.from("Juan")));
    const claro = descifrar(enDisco);
    assert.equal(claro.length, adjunto.tamano);
    assert.ok(!claro.includes(Buffer.from("Juan")));
    assert.deepEqual([adjunto.orden, adjunto.tipo], [1, "image/jpeg"]);
  });

  it("el historial inicial queda en Registrada y sin responsable", async () => {
    await servicio.registrarQueja({ cuerpo: { ...CUERPO, anonima: "true" } });
    assert.deepEqual(llamadas.historial, [{ idQueja: "q-1", idEstado: 1 }]);
  });

  it("si EmployeeService no responde, la queja identificada igual se guarda", async () => {
    mock.restoreAll();
    simular({
      empleados: () => {
        throw new TypeError("fetch failed");
      },
    });
    const resultado = await servicio.registrarQueja({ cuerpo: { ...CUERPO, anonima: "false" }, idEmpleado: EMPLEADO });

    assert.ok(resultado.codigo_seguimiento);
    assert.deepEqual(llamadas.sincronizar, [{ idEmpleado: EMPLEADO, nombres: null, apellidos: null }]);
    assert.equal(llamadas.quejas[0].idEmpleado, EMPLEADO);
  });

  it("si EmployeeService responde con error, también se guarda", async () => {
    mock.restoreAll();
    simular({ empleados: () => respuestaJson(500, { error: "caído" }) });
    await servicio.registrarQueja({ cuerpo: { ...CUERPO, anonima: "false" }, idEmpleado: EMPLEADO });
    assert.equal(llamadas.quejas.length, 1);
  });

  it("si EmployeeService confirma que el empleado no existe, responde 403", async () => {
    mock.restoreAll();
    simular({ empleados: () => respuestaJson(404, { error: "no existe" }) });
    await assert.rejects(
      servicio.registrarQueja({ cuerpo: { ...CUERPO, anonima: "false" }, idEmpleado: EMPLEADO }),
      { estado: 403, message: "El usuario no corresponde a un empleado registrado." },
    );
    assert.equal(llamadas.quejas.length, 0);
  });

  it("si el código sale repetido, genera otro y reintenta", async () => {
    mock.restoreAll();
    simular({ choques: 2 });
    const resultado = await servicio.registrarQueja({ cuerpo: { ...CUERPO, anonima: "true" } });
    assert.equal(llamadas.codigos.length, 3);
    assert.equal(new Set(llamadas.codigos).size, 3);
    assert.equal(resultado.codigo_seguimiento, llamadas.codigos[2]);
  });

  it("si la base falla, borra los adjuntos ya escritos en disco", async () => {
    mock.method(modelo, "insertarHistorialInicial", async () => {
      throw new Error("base caída");
    });
    const antes = fs.readdirSync(CARPETA).length;
    await assert.rejects(
      servicio.registrarQueja({ cuerpo: { ...CUERPO, anonima: "true" }, archivos: [archivo(), archivo("otra.jpg")] }),
      /base caída/,
    );
    assert.equal(fs.readdirSync(CARPETA).length, antes);
  });

  it("valida antes de tocar la base o el disco", async () => {
    const antes = fs.readdirSync(CARPETA).length;
    await assert.rejects(servicio.registrarQueja({ cuerpo: { anonima: "true" }, archivos: [archivo()] }), { estado: 400 });
    assert.equal(llamadas.quejas.length, 0);
    assert.equal(fs.readdirSync(CARPETA).length, antes);
  });
});
