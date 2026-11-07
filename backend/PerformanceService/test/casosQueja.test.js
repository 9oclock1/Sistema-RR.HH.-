/**
 * Suite de integración: KAN-89 (RF-69) clasificación y derivación de quejas.
 *
 * Levanta PerformanceService como proceso hijo contra la PerformanceDB de DATABASE_URL, con EmployeeService y
 * NotificationService simulados, y comprueba la API, la base y el aviso que recibe el responsable.
 * Requiere db/init.sql y los catálogos de db/seed.sql. Crea sus propias quejas (empleados «cc000000-…») y al
 * terminar borra solo esas. Sin base disponible, se omite.
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

const id = (n) => `cc000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ADMIN = id(1);
const RRHH = id(2);
const SUPERVISOR = id(3);
const DENUNCIANTE = id(4);
const CAJERO = id(5);
const AREA_RRHH = id(20);
const AREA_CAJAS = id(21);
const CARGO_JEFE = id(30);
const CARGO_CAJERO = id(31);

const PERSONAS = {
  [ADMIN]: { nombres: "Ana", apellidos: "Arce Admin", area: AREA_RRHH, cargo: id(32) },
  [RRHH]: { nombres: "Rosa", apellidos: "Rojas Ríos", area: AREA_RRHH, cargo: id(33) },
  [SUPERVISOR]: { nombres: "Saúl", apellidos: "Suárez Soria", area: AREA_CAJAS, cargo: CARGO_JEFE },
  [DENUNCIANTE]: { nombres: "Diana", apellidos: "Durán Daza", area: AREA_RRHH, cargo: id(34) },
  [CAJERO]: { nombres: "Carla", apellidos: "Choque Cruz", area: AREA_CAJAS, cargo: CARGO_CAJERO },
};

const ANONIMA = {
  id_categoria_queja: "1",
  asunto: "Trato hostil del encargado de cajas",
  descripcion: "El encargado de cajas del turno tarde grita al personal frente a los clientes casi todos los días.",
};
const IDENTIFICADA = {
  id_categoria_queja: "3",
  asunto: "Falta de agua potable en el depósito",
  descripcion: "Desde hace dos semanas el dispensador del depósito no tiene agua y nadie responde los reportes.",
};

const CLAVE = randomBytes(32).toString("hex");
const CARPETA = fs.mkdtempSync(path.join(os.tmpdir(), "casos-queja-"));
const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 });
const creadas = [];
const avisos = [];
let avisosFallan = false;
let servicio;
let empleados;
let notificaciones;
let base;
let logs = "";
let disponible = false;
let motivo = "";

const puertoLibre = () =>
  new Promise((resolver) => {
    const servidor = net.createServer().listen(0, () => {
      const { port } = servidor.address();
      servidor.close(() => resolver(port));
    });
  });

const escuchar = (servidor) =>
  new Promise((resolver) => servidor.listen(0, "127.0.0.1", () => resolver(servidor.address().port)));

function simularEmpleados() {
  return http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    const responder = (cuerpo, estado = 200) => {
      res.statusCode = estado;
      res.end(JSON.stringify(cuerpo));
    };
    if (req.url === "/empleados") {
      return responder(
        Object.entries(PERSONAS).map(([idEmpleado, p]) => ({
          id_empleado: idEmpleado,
          nombre_completo: `${p.nombres} ${p.apellidos}`,
          id_departamento: p.area,
          id_cargo: p.cargo,
          activo: true,
        })),
      );
    }
    if (req.url === "/departamentos") {
      return responder([
        { id_departamento: AREA_RRHH, codigo: "RRHH", nombre: "Recursos Humanos" },
        { id_departamento: AREA_CAJAS, codigo: "CAJ", nombre: "Cajas" },
      ]);
    }
    if (req.url === "/jerarquia/cargos") return responder([{ id_cargo: CARGO_CAJERO, id_cargo_superior: CARGO_JEFE }]);
    const persona = PERSONAS[req.url.split("/").pop()];
    if (persona) return responder({ nombres: persona.nombres, apellidos: persona.apellidos });
    responder({ error: "Empleado no encontrado" }, 404);
  });
}

function simularNotificaciones() {
  return http.createServer((req, res) => {
    let cuerpo = "";
    req.on("data", (parte) => (cuerpo += parte));
    req.on("end", () => {
      res.setHeader("Content-Type", "application/json");
      if (avisosFallan) {
        res.statusCode = 503;
        return res.end(JSON.stringify({ error: "Servicio no disponible" }));
      }
      avisos.push({ ruta: req.url, cabeceras: req.headers, cuerpo: JSON.parse(cuerpo) });
      res.statusCode = 201;
      res.end(JSON.stringify({ mensaje: "Mensaje directo enviado exitosamente a la bandeja del empleado." }));
    });
  });
}

async function levantarServicio({ puertoEmpleados, puertoNotificaciones }) {
  const puerto = await puertoLibre();
  const hijo = spawn(process.execPath, ["index.js"], {
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      PORT: String(puerto),
      QUEJAS_DIR: path.join(CARPETA, "adjuntos"),
      QUEJAS_CLAVE_CIFRADO: CLAVE,
      QUEJAS_AREAS_RRHH: "RRHH",
      EMPLOYEE_SERVICE_URL: `http://127.0.0.1:${puertoEmpleados}`,
      EMPLOYEE_SERVICE_TIMEOUT_MS: "1500",
      NOTIFICATION_SERVICE_URL: `http://127.0.0.1:${puertoNotificaciones}`,
      NOTIFICATION_SERVICE_TIMEOUT_MS: "1500",
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

async function registrar(campos, cabeceras = {}) {
  const datos = new FormData();
  for (const [clave, valor] of Object.entries(campos)) datos.append(clave, valor);
  const respuesta = await fetch(`${base}/quejas`, { method: "POST", body: datos, headers: cabeceras });
  const cuerpo = await respuesta.json();
  assert.equal(respuesta.status, 201, JSON.stringify(cuerpo));
  creadas.push(cuerpo.codigo_seguimiento);
  const { rows } = await pool.query("SELECT id_queja FROM quejas WHERE codigo_seguimiento = $1", [
    cuerpo.codigo_seguimiento,
  ]);
  return { codigo: cuerpo.codigo_seguimiento, idQueja: rows[0].id_queja };
}

async function api(metodo, ruta, { rol = "admin", empleado = ADMIN, cuerpo } = {}) {
  const respuesta = await fetch(`${base}${ruta}`, {
    method: metodo,
    headers: {
      ...(cuerpo && { "Content-Type": "application/json" }),
      ...(rol && { "X-Rol": rol }),
      ...(empleado && { "X-Empleado-Id": empleado }),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await respuesta.text();
  return { estado: respuesta.status, cuerpo: texto ? JSON.parse(texto) : null };
}

const filaQueja = async (idQueja) => (await pool.query("SELECT * FROM quejas WHERE id_queja = $1", [idQueja])).rows[0];
const asignacionesDe = async (idQueja) =>
  (await pool.query("SELECT * FROM asignaciones_queja WHERE id_queja = $1 ORDER BY asignada_en", [idQueja])).rows;
const historialDe = async (idQueja) =>
  (await pool.query("SELECT * FROM historiales_estado_queja WHERE id_queja = $1 ORDER BY fecha_cambio", [idQueja]))
    .rows;

describe("KAN-89 (RF-69): clasificación y derivación con la API y la base reales", () => {
  let anonima;
  let identificada;

  before(async () => {
    try {
      const { rows } = await pool.query("SELECT count(*)::int AS n FROM catalogos_prioridad_queja");
      await pool.query("SELECT 1 FROM involucrados_queja LIMIT 1");
      if (rows[0].n === 0) throw new Error("sin los catálogos de seed.sql");
    } catch (error) {
      motivo = `PerformanceDB no disponible o sin el esquema de KAN-89 (${error.message || error.code})`;
      return;
    }
    empleados = simularEmpleados();
    notificaciones = simularNotificaciones();
    const [puertoEmpleados, puertoNotificaciones] = await Promise.all([escuchar(empleados), escuchar(notificaciones)]);
    ({ hijo: servicio, base } = await levantarServicio({ puertoEmpleados, puertoNotificaciones }));
    anonima = await registrar({ ...ANONIMA, anonima: "true" });
    identificada = await registrar({ ...IDENTIFICADA, anonima: "false" }, { "X-Empleado-Id": DENUNCIANTE });
    disponible = true;
  });

  after(async () => {
    servicio?.kill();
    empleados?.close();
    notificaciones?.close();
    if (disponible) {
      const { rows } = await pool.query("SELECT id_queja FROM quejas WHERE codigo_seguimiento = ANY($1)", [creadas]);
      const ids = rows.map((r) => r.id_queja);
      for (const tabla of ["involucrados_queja", "asignaciones_queja", "historiales_estado_queja", "adjuntos_queja"]) {
        await pool.query(`DELETE FROM ${tabla} WHERE id_queja = ANY($1)`, [ids]);
      }
      await pool.query("DELETE FROM quejas WHERE id_queja = ANY($1)", [ids]);
      await pool.query("DELETE FROM empleados WHERE id_empleado::text LIKE 'cc000000-%'");
    }
    await pool.end();
    fs.rmSync(CARPETA, { recursive: true, force: true });
  });

  const requiere = (t) => {
    if (!disponible) t.skip(motivo);
    return disponible;
  };

  describe("Bandeja y criterio 1: revisar y clasificar una queja nueva", () => {
    it("la bandeja muestra la queja nueva sin clasificar y sin su contenido", async (t) => {
      if (!requiere(t)) return;
      const { estado, cuerpo } = await api("GET", "/quejas/casos?estado=1&prioridad=sin&limite=50");
      assert.equal(estado, 200);
      const caso = cuerpo.casos.find((c) => c.codigo_seguimiento === anonima.codigo);
      assert.ok(caso, "la queja anónima debe estar en la bandeja");
      assert.equal(caso.prioridad, null);
      assert.equal(caso.responsable, null);
      assert.equal(caso.estado.codigo, "REGISTRADA");
      const texto = JSON.stringify(cuerpo);
      assert.ok(!texto.includes(ANONIMA.asunto) && !texto.includes(ANONIMA.descripcion));
      assert.ok(cuerpo.total >= 2);
    });

    it("el detalle descifra el asunto y la descripción solo para el administrador", async (t) => {
      if (!requiere(t)) return;
      const { estado, cuerpo } = await api("GET", `/quejas/casos/${anonima.idQueja}`);
      assert.equal(estado, 200);
      assert.equal(cuerpo.asunto, ANONIMA.asunto);
      assert.equal(cuerpo.descripcion, ANONIMA.descripcion);
      assert.equal(cuerpo.denunciante, null);

      const ajeno = await api("GET", `/quejas/casos/${anonima.idQueja}`, { rol: "supervisor" });
      assert.equal(ajeno.estado, 403);
      assert.ok(!JSON.stringify(ajeno.cuerpo).includes(ANONIMA.descripcion));
    });

    it("clasifica: reclasifica la categoría y asigna la prioridad", async (t) => {
      if (!requiere(t)) return;
      const { estado } = await api("PUT", `/quejas/casos/${anonima.idQueja}/clasificacion`, {
        cuerpo: { id_categoria_queja: 2, id_prioridad_queja: 4 },
      });
      assert.equal(estado, 200);
      const fila = await filaQueja(anonima.idQueja);
      assert.equal(fila.id_categoria_queja, 2);
      assert.equal(fila.id_prioridad_queja, 4);
      assert.equal(fila.id_estado_queja, 1);
    });

    it("los filtros por categoría y prioridad encuentran la queja clasificada", async (t) => {
      if (!requiere(t)) return;
      const coincide = await api("GET", "/quejas/casos?categoria=2&prioridad=4&limite=50");
      assert.ok(coincide.cuerpo.casos.some((c) => c.codigo_seguimiento === anonima.codigo));
      assert.ok(coincide.cuerpo.casos.every((c) => c.categoria.id === 2 && c.prioridad.id === 4));

      const otra = await api("GET", "/quejas/casos?prioridad=sin&limite=50");
      assert.ok(!otra.cuerpo.casos.some((c) => c.codigo_seguimiento === anonima.codigo));

      const invalido = await api("GET", "/quejas/casos?estado=abc");
      assert.equal(invalido.estado, 400);
    });

    it("solo propone como responsables a personal de RRHH y supervisores", async (t) => {
      if (!requiere(t)) return;
      const { estado, cuerpo } = await api("GET", "/quejas/responsables");
      assert.equal(estado, 200);
      const ids = cuerpo.map((c) => c.id_empleado);
      assert.ok(ids.includes(RRHH) && ids.includes(SUPERVISOR));
      assert.ok(!ids.includes(CAJERO));
    });
  });

  describe("Criterio 3: conflicto de interés", () => {
    it("registra a un involucrado y rechaza derivarle el caso con 409", async (t) => {
      if (!requiere(t)) return;
      const registro = await api("POST", `/quejas/casos/${anonima.idQueja}/involucrados`, {
        cuerpo: { id_empleado: SUPERVISOR },
      });
      assert.equal(registro.estado, 201);
      assert.equal((await api("POST", `/quejas/casos/${anonima.idQueja}/involucrados`, { cuerpo: { id_empleado: SUPERVISOR } })).estado, 409);

      const { estado, cuerpo } = await api("POST", `/quejas/casos/${anonima.idQueja}/derivacion`, {
        cuerpo: { id_empleado_responsable: SUPERVISOR },
      });
      assert.equal(estado, 409);
      assert.equal(cuerpo.detalles[0].codigo, "CONFLICTO_INTERES");
      assert.match(cuerpo.error, /conflicto de interés/i);
      assert.equal((await asignacionesDe(anonima.idQueja)).length, 0);
      assert.equal((await filaQueja(anonima.idQueja)).id_estado_queja, 1);
      assert.equal(avisos.length, 0);
    });

    it("tampoco deriva una queja identificada a su propio denunciante", async (t) => {
      if (!requiere(t)) return;
      const { estado, cuerpo } = await api("POST", `/quejas/casos/${identificada.idQueja}/derivacion`, {
        cuerpo: { id_categoria_queja: 3, id_prioridad_queja: 2, id_empleado_responsable: DENUNCIANTE },
      });
      assert.equal(estado, 409);
      assert.equal(cuerpo.detalles[0].codigo, "CONFLICTO_INTERES");
    });

    it("un rol distinto de admin no puede derivar", async (t) => {
      if (!requiere(t)) return;
      for (const rol of ["supervisor", "gerente", "empleado"]) {
        const { estado } = await api("POST", `/quejas/casos/${anonima.idQueja}/derivacion`, {
          rol,
          cuerpo: { id_empleado_responsable: RRHH },
        });
        assert.equal(estado, 403);
      }
      assert.equal((await asignacionesDe(anonima.idQueja)).length, 0);
    });
  });

  describe("Criterio 2: derivación con aviso al responsable", () => {
    it("deriva la queja anónima: pasa a ASIGNADA, registra quién lo hizo y avisa sin datos del denunciante", async (t) => {
      if (!requiere(t)) return;
      const { estado, cuerpo } = await api("POST", `/quejas/casos/${anonima.idQueja}/derivacion`, {
        cuerpo: { id_empleado_responsable: RRHH, comentario: "Coordinar con el área de cajas" },
      });
      assert.equal(estado, 201, JSON.stringify(cuerpo));
      assert.equal(cuerpo.estado.codigo, "ASIGNADA");
      assert.equal(cuerpo.notificacion.estado, "ENTREGADO");

      const [asignacion] = await asignacionesDe(anonima.idQueja);
      assert.equal(asignacion.id_empleado_responsable, RRHH);
      assert.equal(asignacion.id_empleado_asignador, ADMIN);
      assert.equal(asignacion.id_estado_notificacion, 2);
      assert.ok(asignacion.notificada_en);

      const historial = await historialDe(anonima.idQueja);
      assert.deepEqual(
        historial.map((h) => [h.id_estado_anterior, h.id_estado_queja, h.id_empleado_responsable]),
        [
          [null, 1, null],
          [1, 2, ADMIN],
        ],
      );
      const fila = await filaQueja(anonima.idQueja);
      assert.equal(fila.es_anonima, true);
      assert.equal(fila.id_empleado_denunciante, null);

      assert.equal(avisos.length, 1);
      const aviso = avisos[0];
      assert.equal(aviso.ruta, "/comunicaciones/directa");
      assert.equal(aviso.cabeceras["x-rol"], "admin");
      assert.equal(aviso.cuerpo.id_empleado_destinatario, RRHH);
      assert.equal(aviso.cuerpo.prioridad, "ALTA");
      assert.match(aviso.cuerpo.contenido, new RegExp(`Código: ${anonima.codigo}`));
      assert.match(aviso.cuerpo.contenido, /Categoría: Acoso/);
      assert.match(aviso.cuerpo.contenido, /Prioridad: Crítica/);
      assert.match(aviso.cuerpo.contenido, /Fecha de derivación: \d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}/);
      const enviado = JSON.stringify(aviso.cuerpo);
      for (const prohibido of [ANONIMA.asunto, ANONIMA.descripcion, "Coordinar", SUPERVISOR, "Saúl"]) {
        assert.ok(!enviado.includes(prohibido), `el aviso no debe incluir «${prohibido}»`);
      }
    });

    it("si el aviso falla, la derivación queda registrada como FALLIDO y se puede reintentar", async (t) => {
      if (!requiere(t)) return;
      avisosFallan = true;
      const { estado, cuerpo } = await api("POST", `/quejas/casos/${identificada.idQueja}/derivacion`, {
        cuerpo: { id_categoria_queja: 3, id_prioridad_queja: 2, id_empleado_responsable: SUPERVISOR },
      });
      assert.equal(estado, 201);
      assert.equal(cuerpo.notificacion.estado, "FALLIDO");
      assert.equal((await filaQueja(identificada.idQueja)).id_estado_queja, 2);
      assert.equal((await asignacionesDe(identificada.idQueja))[0].id_estado_notificacion, 3);

      avisosFallan = false;
      const reintento = await api("POST", `/quejas/casos/${identificada.idQueja}/derivacion/notificacion`);
      assert.equal(reintento.estado, 200);
      assert.equal(reintento.cuerpo.estado, "ENTREGADO");
      const aviso = avisos.at(-1);
      assert.equal(aviso.cuerpo.id_empleado_destinatario, SUPERVISOR);
      const enviado = JSON.stringify(aviso.cuerpo);
      for (const prohibido of [IDENTIFICADA.asunto, IDENTIFICADA.descripcion, DENUNCIANTE, "Diana", "Durán"]) {
        assert.ok(!enviado.includes(prohibido), `el aviso no debe incluir «${prohibido}»`);
      }
      assert.equal((await api("POST", `/quejas/casos/${identificada.idQueja}/derivacion/notificacion`)).estado, 409);
    });

    it("el detalle muestra al responsable vigente y la derivación con su aviso", async (t) => {
      if (!requiere(t)) return;
      const { cuerpo } = await api("GET", `/quejas/casos/${anonima.idQueja}`);
      assert.equal(cuerpo.responsable.id_empleado, RRHH);
      assert.equal(cuerpo.responsable.nombre_completo, "Rosa Rojas Ríos");
      assert.equal(cuerpo.derivaciones[0].notificacion.estado.codigo, "ENTREGADO");
      assert.deepEqual(
        cuerpo.involucrados.map((i) => i.id_empleado),
        [SUPERVISOR],
      );
      assert.equal(cuerpo.historial.at(-1).registrado_por.id_empleado, ADMIN);
    });
  });

  describe("La consulta pública por código no expone responsables", () => {
    it("muestra el nuevo estado sin responsable, asignador, involucrados ni comentarios", async (t) => {
      if (!requiere(t)) return;
      const respuesta = await fetch(`${base}/quejas/seguimiento`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": "198.51.100.40" },
        body: JSON.stringify({ codigo: anonima.codigo }),
      });
      const cuerpo = await respuesta.json();
      assert.equal(respuesta.status, 200);
      assert.equal(cuerpo.estado.codigo, "ASIGNADA");
      assert.deepEqual(Object.keys(cuerpo).sort(), [
        "actualizada_en",
        "categoria",
        "codigo_seguimiento",
        "estado",
        "historial",
        "registrada_en",
      ]);
      assert.deepEqual(
        cuerpo.historial.map((paso) => paso.codigo),
        ["REGISTRADA", "ASIGNADA"],
      );
      const texto = JSON.stringify(cuerpo);
      for (const prohibido of [RRHH, ADMIN, SUPERVISOR, "Rosa", "Ana", "Saúl", "Coordinar"]) {
        assert.ok(!texto.includes(prohibido), `la consulta pública no debe incluir «${prohibido}»`);
      }
    });
  });
});
