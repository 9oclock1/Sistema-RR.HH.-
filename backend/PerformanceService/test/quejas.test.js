/**
 * Suite de integración: KAN-88 (RF-68) buzón de quejas, criterios de aceptación y anonimato.
 *
 * Levanta PerformanceService como proceso hijo (para revisar sus logs) contra la PerformanceDB de DATABASE_URL,
 * con un EmployeeService simulado, y comprueba la base, el disco y los logs. Requiere el esquema de db/init.sql.
 * Crea sus propias quejas (empleados «bb000000-…») y al terminar borra solo esas. Sin base disponible, se omite.
 * Con el sistema en Docker:
 *   docker compose exec performance-service npm run test:quejas
 */
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env"), quiet: true });
const { Pool } = require("pg");

const CLAVE = randomBytes(32).toString("hex");
process.env.QUEJAS_CLAVE_CIFRADO = CLAVE;
const { descifrar, descifrarTexto } = require("../src/utils/cifrado");
const {
  jpegConExif,
  pdfConMetadatos,
  leerMetadatos,
  camposIdentificadores,
  escribirTemporales,
} = require("../src/tests/ayudas/archivosQueja");

const id = (n) => `bb000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const EMPLEADO = id(1);
const EMPLEADO_ANONIMO = id(2);
const EMPLEADO_SIN_RESPUESTA = id(3);
const EMPLEADO_INEXISTENTE = id(4);
const TOKEN = "Bearer eyJhbGciOiJIUzI1NiJ9.prueba-anonimato.firma";
const NAVEGADOR = "Mozilla/5.0 (EquipoDeJuanPerez)";
const IP = "203.0.113.77";
const MAXIMO_CONSULTAS = 5;

const CODIGO = /^QJ-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;
const CARPETA = fs.mkdtempSync(path.join(os.tmpdir(), "quejas-integracion-"));
const ADJUNTOS = path.join(CARPETA, "adjuntos");

const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 });
const creadas = [];
let servicio;
let empleados;
let base;
let logs = "";
let disponible = false;
let motivo = "";
let jpg;
let pdf;

const puertoLibre = () =>
  new Promise((resolver) => {
    const servidor = net.createServer().listen(0, () => {
      const { port } = servidor.address();
      servidor.close(() => resolver(port));
    });
  });

function simularEmpleados() {
  return http.createServer((req, res) => {
    const idEmpleado = req.url.split("/").pop();
    res.setHeader("Content-Type", "application/json");
    if (idEmpleado === EMPLEADO) return res.end(JSON.stringify({ id_empleado: EMPLEADO, nombres: "Juan", apellidos: "Pérez Mamani" }));
    if (idEmpleado === EMPLEADO_SIN_RESPUESTA) return req.socket.destroy();
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "Empleado no encontrado" }));
  });
}

async function levantarServicio(puertoEmpleados) {
  const puerto = await puertoLibre();
  const hijo = spawn(process.execPath, ["index.js"], {
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      PORT: String(puerto),
      QUEJAS_DIR: ADJUNTOS,
      QUEJAS_CLAVE_CIFRADO: CLAVE,
      QUEJAS_CONSULTAS_MAXIMO: String(MAXIMO_CONSULTAS),
      EMPLOYEE_SERVICE_URL: `http://127.0.0.1:${puertoEmpleados}`,
      EMPLOYEE_SERVICE_TIMEOUT_MS: "1500",
    },
  });
  hijo.stdout.on("data", (d) => (logs += d));
  hijo.stderr.on("data", (d) => (logs += d));
  await new Promise((resolver, rechazar) => {
    const espera = setTimeout(() => rechazar(new Error(`El servicio no arrancó:\n${logs}`)), 15000);
    hijo.stdout.on("data", () => {
      if (logs.includes("corriendo")) {
        clearTimeout(espera);
        resolver();
      }
    });
    hijo.on("exit", () => rechazar(new Error(`El servicio terminó:\n${logs}`)));
  });
  return { hijo, base: `http://127.0.0.1:${puerto}` };
}

function formulario(campos, archivos = []) {
  const datos = new FormData();
  for (const [clave, valor] of Object.entries(campos)) datos.append(clave, valor);
  for (const { contenido, tipo, nombre } of archivos) datos.append("archivos", new Blob([contenido], { type: tipo }), nombre);
  return datos;
}

async function registrar(campos, { archivos, cabeceras = {} } = {}) {
  const respuesta = await fetch(`${base}/quejas`, {
    method: "POST",
    body: formulario(campos, archivos),
    headers: { "X-Forwarded-For": "198.51.100.1", ...cabeceras },
  });
  const cuerpo = await respuesta.json();
  if (cuerpo.codigo_seguimiento) creadas.push(cuerpo.codigo_seguimiento);
  return { estado: respuesta.status, cuerpo };
}

async function consultar(codigo, ip = "198.51.100.2") {
  const respuesta = await fetch(`${base}/quejas/seguimiento`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
    body: JSON.stringify({ codigo }),
  });
  return { estado: respuesta.status, cuerpo: await respuesta.json(), cabeceras: respuesta.headers };
}

const filaQueja = async (codigo) =>
  (await pool.query("SELECT * FROM quejas WHERE codigo_seguimiento = $1", [codigo])).rows[0];

const adjuntosDe = async (idQueja) =>
  (await pool.query("SELECT * FROM adjuntos_queja WHERE id_queja = $1 ORDER BY orden", [idQueja])).rows;

async function textoGuardado(idQueja) {
  const { rows } = await pool.query(
    `SELECT row_to_json(q)::text AS fila FROM quejas q WHERE id_queja = $1
     UNION ALL SELECT row_to_json(a)::text FROM adjuntos_queja a WHERE id_queja = $1
     UNION ALL SELECT row_to_json(h)::text FROM historiales_estado_queja h WHERE id_queja = $1`,
    [idQueja],
  );
  return rows.map((r) => r.fila).join("\n");
}

const contarQuejas = async () => (await pool.query("SELECT count(*)::int AS n FROM quejas")).rows[0].n;
const archivosEnDisco = () => (fs.existsSync(ADJUNTOS) ? fs.readdirSync(ADJUNTOS).length : 0);

const VALIDA = {
  id_categoria_queja: "1",
  asunto: "Trato hostil en el turno tarde",
  descripcion: "El encargado de turno levanta la voz al personal de cajas frente a los clientes.",
};

describe("KAN-88 (RF-68): buzón de quejas con la API y la base reales", () => {
  before(async () => {
    try {
      await pool.query("SELECT 1 FROM quejas LIMIT 1");
      await pool.query("SELECT 1 FROM adjuntos_queja LIMIT 1");
    } catch (error) {
      motivo = `PerformanceDB no disponible o sin el esquema de KAN-88 (${error.message || error.code})`;
      return;
    }
    jpg = await jpegConExif();
    pdf = await pdfConMetadatos();
    empleados = simularEmpleados().listen(0);
    await new Promise((resolver) => empleados.once("listening", resolver));
    ({ hijo: servicio, base } = await levantarServicio(empleados.address().port));
    disponible = true;
  });

  after(async () => {
    servicio?.kill();
    empleados?.close();
    if (disponible) {
      const { rows } = await pool.query("SELECT id_queja FROM quejas WHERE codigo_seguimiento = ANY($1)", [creadas]);
      const ids = rows.map((r) => r.id_queja);
      await pool.query("DELETE FROM adjuntos_queja WHERE id_queja = ANY($1)", [ids]);
      await pool.query("DELETE FROM historiales_estado_queja WHERE id_queja = ANY($1)", [ids]);
      await pool.query("DELETE FROM quejas WHERE id_queja = ANY($1)", [ids]);
      await pool.query("DELETE FROM empleados WHERE id_empleado::text LIKE 'bb000000-%'");
    }
    await pool.end();
    fs.rmSync(CARPETA, { recursive: true, force: true });
  });

  const requiere = (t) => {
    if (!disponible) t.skip(motivo);
    return disponible;
  };

  describe("Criterio 1: registrar con categoría, descripción y adjuntos opcionales entrega un código", () => {
    it("queja identificada con adjuntos: 201, código y vínculo con el empleado", async (t) => {
      if (!requiere(t)) return;
      const { estado, cuerpo } = await registrar(
        { ...VALIDA, anonima: "false" },
        {
          cabeceras: { "X-Empleado-Id": EMPLEADO },
          archivos: [
            { contenido: jpg, tipo: "image/jpeg", nombre: "foto-turno.jpg" },
            { contenido: pdf, tipo: "application/pdf", nombre: "acta-reunion.pdf" },
          ],
        },
      );

      assert.equal(estado, 201);
      assert.match(cuerpo.codigo_seguimiento, CODIGO);
      assert.deepEqual(cuerpo.estado, { codigo: "REGISTRADA", nombre: "Registrada" });
      assert.equal(cuerpo.adjuntos, 2);

      const queja = await filaQueja(cuerpo.codigo_seguimiento);
      assert.equal(queja.id_empleado_denunciante, EMPLEADO);
      assert.equal(queja.es_anonima, false);
      assert.equal(queja.id_categoria_queja, 1);
      assert.equal(descifrarTexto(queja.asunto), VALIDA.asunto);
      assert.equal(descifrarTexto(queja.descripcion), VALIDA.descripcion);

      const adjuntos = await adjuntosDe(queja.id_queja);
      assert.deepEqual(
        adjuntos.map((a) => [a.orden, a.tipo_mime, descifrarTexto(a.nombre_original)]),
        [
          [1, "image/jpeg", "foto-turno.jpg"],
          [2, "application/pdf", "acta-reunion.pdf"],
        ],
      );
      const empleado = (await pool.query("SELECT nombres, apellidos FROM empleados WHERE id_empleado = $1", [EMPLEADO])).rows[0];
      assert.deepEqual(empleado, { nombres: "Juan", apellidos: "Pérez Mamani" });
    });

    it("sin adjuntos (JSON) también se registra", async (t) => {
      if (!requiere(t)) return;
      const respuesta = await fetch(`${base}/quejas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...VALIDA, id_categoria_queja: 3, anonima: true }),
      });
      const cuerpo = await respuesta.json();
      creadas.push(cuerpo.codigo_seguimiento);
      assert.equal(respuesta.status, 201);
      assert.equal(cuerpo.adjuntos, 0);
    });

    it("descripción y adjuntos quedan cifrados en reposo (base y disco)", async (t) => {
      if (!requiere(t)) return;
      const queja = await filaQueja(creadas[0]);
      const guardado = await textoGuardado(queja.id_queja);
      for (const texto of [VALIDA.asunto, VALIDA.descripcion, "foto-turno", "acta-reunion"]) {
        assert.ok(!guardado.includes(texto), `«${texto}» quedó en texto plano en la base`);
      }
      for (const adjunto of await adjuntosDe(queja.id_queja)) {
        const enDisco = fs.readFileSync(path.join(ADJUNTOS, adjunto.clave_almacenamiento));
        for (const firma of ["JFIF", "%PDF", "Exif"]) assert.ok(!enDisco.includes(Buffer.from(firma)));
        assert.equal(descifrar(enDisco).length, adjunto.tamano_bytes);
      }
    });

    it("si EmployeeService no responde, la queja identificada se guarda igual", async (t) => {
      if (!requiere(t)) return;
      const { estado, cuerpo } = await registrar(
        { ...VALIDA, anonima: "false" },
        { cabeceras: { "X-Empleado-Id": EMPLEADO_SIN_RESPUESTA } },
      );
      assert.equal(estado, 201);
      assert.equal((await filaQueja(cuerpo.codigo_seguimiento)).id_empleado_denunciante, EMPLEADO_SIN_RESPUESTA);
      const { rows } = await pool.query("SELECT nombres FROM empleados WHERE id_empleado = $1", [EMPLEADO_SIN_RESPUESTA]);
      assert.deepEqual(rows, [{ nombres: null }]);
    });

    it("identificada sin X-Empleado-Id: 401; con un empleado inexistente: 403", async (t) => {
      if (!requiere(t)) return;
      assert.equal((await registrar({ ...VALIDA, anonima: "false" })).estado, 401);
      const { estado, cuerpo } = await registrar(
        { ...VALIDA, anonima: "false" },
        { cabeceras: { "X-Empleado-Id": EMPLEADO_INEXISTENTE } },
      );
      assert.equal(estado, 403);
      assert.equal(cuerpo.error, "El usuario no corresponde a un empleado registrado.");
    });
  });

  describe("Criterio 2: una queja anónima no guarda ningún dato que identifique al empleado", () => {
    let codigo;
    let queja;

    before(async () => {
      if (!disponible) return;
      const { cuerpo } = await registrar(
        { ...VALIDA, id_categoria_queja: "2", anonima: "true" },
        {
          cabeceras: { "X-Empleado-Id": EMPLEADO_ANONIMO, Authorization: TOKEN, "User-Agent": NAVEGADOR, "X-Forwarded-For": IP },
          archivos: [
            { contenido: jpg, tipo: "image/jpeg", nombre: "foto-de-juan-perez.jpg" },
            { contenido: pdf, tipo: "application/pdf", nombre: "denuncia-juan-perez.pdf" },
          ],
        },
      );
      codigo = cuerpo.codigo_seguimiento;
      queja = await filaQueja(codigo);
    });

    it("no guarda el empleado, aunque el navegador haya enviado X-Empleado-Id", async (t) => {
      if (!requiere(t)) return;
      assert.match(codigo, CODIGO);
      assert.equal(queja.es_anonima, true);
      assert.equal(queja.id_empleado_denunciante, null);
      assert.equal(queja.id_departamento, null);
      assert.equal(queja.id_sucursal, null);
      const historial = (await pool.query("SELECT * FROM historiales_estado_queja WHERE id_queja = $1", [queja.id_queja])).rows;
      assert.deepEqual(historial.map((h) => [h.id_estado_queja, h.id_empleado_responsable]), [[1, null]]);
    });

    it("tampoco crea la réplica del empleado en EMPLEADOS", async (t) => {
      if (!requiere(t)) return;
      const { rows } = await pool.query("SELECT 1 FROM empleados WHERE id_empleado = $1", [EMPLEADO_ANONIMO]);
      assert.equal(rows.length, 0);
    });

    it("ninguna fila guardada contiene id, token, IP, navegador ni nombres de archivo", async (t) => {
      if (!requiere(t)) return;
      const guardado = await textoGuardado(queja.id_queja);
      for (const dato of [EMPLEADO_ANONIMO, TOKEN, "eyJhbGci", IP, NAVEGADOR, "EquipoDeJuan", "foto-de-juan", "denuncia-juan"]) {
        assert.ok(!guardado.includes(dato), `«${dato}» quedó guardado en la base`);
      }
      const adjuntos = await adjuntosDe(queja.id_queja);
      assert.deepEqual(adjuntos.map((a) => a.nombre_original), [null, null]);
    });

    it("los logs del servicio no muestran id, token, IP, navegador ni nombres de archivo", (t) => {
      if (!requiere(t)) return;
      for (const dato of [EMPLEADO_ANONIMO, TOKEN, "eyJhbGci", IP, NAVEGADOR, "foto-de-juan", "denuncia-juan", codigo]) {
        assert.ok(!logs.includes(dato), `«${dato}» apareció en los logs del servicio`);
      }
    });

    it("exiftool no encuentra metadatos identificadores en los adjuntos guardados", async (t) => {
      if (!requiere(t)) return;
      const adjuntos = await adjuntosDe(queja.id_queja);
      const claros = Object.fromEntries(
        adjuntos.map((a) => [
          `adjunto-${a.orden}.${a.tipo_mime === "application/pdf" ? "pdf" : "jpg"}`,
          descifrar(fs.readFileSync(path.join(ADJUNTOS, a.clave_almacenamiento))),
        ]),
      );
      const rutas = escribirTemporales(path.join(CARPETA, "exif"), claros);
      const metadatos = leerMetadatos(rutas);
      if (!metadatos) return t.skip("exiftool no disponible (instálelo, defina EXIFTOOL_BIN o habilite Docker)");
      for (const [nombre, datos] of Object.entries(metadatos)) {
        assert.deepEqual(camposIdentificadores(datos), [], `${nombre} conserva metadatos`);
        assert.ok(!JSON.stringify(datos).includes("Juan"), `${nombre} menciona la identidad`);
      }
    });
  });

  describe("Validaciones: campos obligatorios y adjuntos inválidos", () => {
    it("sin campos: 400 con un mensaje por cada campo y sin guardar nada", async (t) => {
      if (!requiere(t)) return;
      const antes = await contarQuejas();
      const { estado, cuerpo } = await registrar({});
      assert.equal(estado, 400);
      assert.equal(cuerpo.error, "Revise los datos de la queja.");
      assert.deepEqual(cuerpo.detalles.map((d) => d.campo).sort(), ["anonima", "asunto", "descripcion", "id_categoria_queja"]);
      assert.equal(await contarQuejas(), antes);
    });

    it("sin descripción o con una categoría que no existe: 400 en ese campo", async (t) => {
      if (!requiere(t)) return;
      const sinDescripcion = await registrar({ ...VALIDA, descripcion: "", anonima: "true" });
      assert.deepEqual(sinDescripcion.cuerpo.detalles, [{ campo: "descripcion", mensaje: "Describa lo ocurrido." }]);
      const sinCategoria = await registrar({ ...VALIDA, id_categoria_queja: "99", anonima: "true" });
      assert.deepEqual(sinCategoria.cuerpo.detalles, [
        { campo: "id_categoria_queja", mensaje: "La categoría seleccionada no existe." },
      ]);
    });

    for (const [caso, archivos, estadoEsperado, mensaje] of [
      ["un GIF", [{ contenido: Buffer.from("GIF89a"), tipo: "image/gif", nombre: "x.gif" }], 400, "«x.gif» no está permitido. Solo se aceptan PDF, JPG o PNG."],
      ["texto disfrazado de PDF", [{ contenido: Buffer.from("hola"), tipo: "application/pdf", nombre: "x.pdf" }], 400, "«x.pdf» no es un PDF válido."],
      ["un archivo de 6 MB", [{ contenido: Buffer.alloc(6 * 1024 * 1024), tipo: "application/pdf", nombre: "grande.pdf" }], 413, "Cada archivo puede pesar hasta 5 MB."],
      ["cuatro archivos", Array.from({ length: 4 }, (_, i) => ({ contenido: Buffer.from("x"), tipo: "image/png", nombre: `${i}.png` })), 400, "Puede adjuntar hasta 3 archivos."],
    ]) {
      it(`adjunto inválido (${caso}): ${estadoEsperado} y no queda nada en base ni disco`, async (t) => {
        if (!requiere(t)) return;
        const antes = { quejas: await contarQuejas(), archivos: archivosEnDisco() };
        const { estado, cuerpo } = await registrar({ ...VALIDA, anonima: "true" }, { archivos });
        assert.equal(estado, estadoEsperado);
        assert.equal(cuerpo.error, mensaje);
        assert.equal(cuerpo.detalles[0].campo, "archivos");
        assert.deepEqual({ quejas: await contarQuejas(), archivos: archivosEnDisco() }, antes);
      });
    }
  });

  describe("Criterio 3: consultar el estado con el código, sin identificarse", () => {
    it("código válido: estado, categoría, fechas e historial, sin datos sensibles", async (t) => {
      if (!requiere(t)) return;
      const { estado, cuerpo } = await consultar(creadas[0]);
      assert.equal(estado, 200);
      assert.deepEqual(Object.keys(cuerpo).sort(), [
        "actualizada_en",
        "categoria",
        "codigo_seguimiento",
        "estado",
        "historial",
        "registrada_en",
      ]);
      assert.deepEqual(cuerpo.estado, { codigo: "REGISTRADA", nombre: "Registrada", es_final: false });
      assert.equal(cuerpo.categoria, "Clima laboral");
      assert.deepEqual(cuerpo.historial.map((h) => h.codigo), ["REGISTRADA"]);
      const texto = JSON.stringify(cuerpo);
      for (const dato of [EMPLEADO, "anonima", "asunto", "descripcion", "adjunto", "Juan", "id_queja"]) {
        assert.ok(!texto.includes(dato), `la consulta expone «${dato}»`);
      }
    });

    it("no revela si la queja es anónima o identificada: la respuesta tiene la misma forma", async (t) => {
      if (!requiere(t)) return;
      const forma = (valor) =>
        Array.isArray(valor)
          ? valor.map(forma)
          : valor && typeof valor === "object"
            ? Object.fromEntries(Object.keys(valor).sort().map((k) => [k, forma(valor[k])]))
            : typeof valor;
      const filas = await pool.query("SELECT codigo_seguimiento, es_anonima FROM quejas WHERE codigo_seguimiento = ANY($1)", [creadas]);
      const identificada = filas.rows.find((f) => !f.es_anonima).codigo_seguimiento;
      const anonima = filas.rows.find((f) => f.es_anonima).codigo_seguimiento;
      const a = await consultar(identificada, "198.51.100.3");
      const b = await consultar(anonima, "198.51.100.3");
      assert.deepEqual(forma(a.cuerpo), forma(b.cuerpo));
      assert.deepEqual([...a.cabeceras.keys()].sort(), [...b.cabeceras.keys()].sort());
    });

    it("acepta el código en minúsculas, con espacios y con O/I/L confundidas", async (t) => {
      if (!requiere(t)) return;
      const codigo = creadas[0];
      const escrito = codigo.toLowerCase().replaceAll("-", " ").replaceAll("0", "o").replaceAll("1", "l");
      const { estado, cuerpo } = await consultar(escrito, "198.51.100.4");
      assert.equal(estado, 200);
      assert.equal(cuerpo.codigo_seguimiento, codigo);
    });

    it("código inexistente o mal escrito: 404 con el mismo mensaje", async (t) => {
      if (!requiere(t)) return;
      const respuestas = await Promise.all(
        ["QJ-0000-0000", "hola", "", "QJ-UUUU-UUUU"].map((codigo) => consultar(codigo, "198.51.100.5")),
      );
      for (const { estado, cuerpo } of respuestas) {
        assert.equal(estado, 404);
        assert.deepEqual(cuerpo, { error: "No encontramos una queja con ese código. Revise que esté bien escrito." });
      }
    });

    it("no necesita ninguna cabecera de identificación", async (t) => {
      if (!requiere(t)) return;
      const respuesta = await fetch(`${base}/quejas/seguimiento`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": "198.51.100.6" },
        body: JSON.stringify({ codigo: creadas[0] }),
      });
      assert.equal(respuesta.status, 200);
    });

    it(`después de ${MAXIMO_CONSULTAS} intentos desde la misma IP responde 429 (fuerza bruta)`, async (t) => {
      if (!requiere(t)) return;
      const estados = [];
      for (let i = 0; i <= MAXIMO_CONSULTAS; i += 1) estados.push((await consultar(`QJ-0000-000${i}`, "198.51.100.7")).estado);
      assert.deepEqual(estados, [...Array(MAXIMO_CONSULTAS).fill(404), 429]);
      const bloqueada = await consultar(creadas[0], "198.51.100.7");
      assert.equal(bloqueada.estado, 429);
      assert.ok(Number(bloqueada.cabeceras.get("retry-after")) > 0);
      assert.equal((await consultar(creadas[0], "198.51.100.8")).estado, 200);
    });
  });
});
