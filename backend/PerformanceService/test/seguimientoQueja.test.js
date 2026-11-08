/**
 * Suite de integración: KAN-90 (RF-70) acciones preventivas o correctivas y avance del caso de queja.
 *
 * Levanta PerformanceService como proceso hijo contra la PerformanceDB de DATABASE_URL, con EmployeeService y
 * NotificationService simulados, y comprueba la API, la base, los logs y el aviso que recibe el denunciante.
 * Requiere db/init.sql y los catálogos de db/seed.sql. Crea sus propias quejas (empleados «ce000000-…») y al
 * terminar borra solo esas. Sin base disponible, se omite.
 * Con el sistema en Docker:
 *   docker compose exec performance-service npm run test:seguimiento
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

const id = (n) => `ce000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ADMIN = id(1);
const RESPONSABLE = id(2);
const SUPERVISOR = id(3);
const DENUNCIANTE = id(4);
const AREA_RRHH = id(20);
const AREA_CAJAS = id(21);
const CARGO_JEFE = id(30);
const CARGO_CAJERO = id(31);

const PERSONAS = {
  [ADMIN]: { nombres: "Ana", apellidos: "Arce Admin", area: AREA_RRHH, cargo: id(32) },
  [RESPONSABLE]: { nombres: "Rosa", apellidos: "Rojas Ríos", area: AREA_RRHH, cargo: id(33) },
  [SUPERVISOR]: { nombres: "Saúl", apellidos: "Suárez Soria", area: AREA_CAJAS, cargo: CARGO_JEFE },
  [DENUNCIANTE]: { nombres: "Diana", apellidos: "Durán Daza", area: AREA_CAJAS, cargo: CARGO_CAJERO },
};

const QUEJA = {
  id_categoria_queja: "1",
  asunto: "Trato hostil del encargado de cajas",
  descripcion: "El encargado de cajas del turno tarde grita al personal frente a los clientes casi todos los días.",
};
const ACCION = "Reunión con el encargado de cajas para acordar un trato respetuoso con el personal.";
const RESOLUCION = "Se capacitó al encargado en liderazgo y se reorganizaron los turnos del área de cajas.";

const CLAVE = randomBytes(32).toString("hex");
const CARPETA = fs.mkdtempSync(path.join(os.tmpdir(), "seguimiento-queja-"));
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

async function api(metodo, ruta, { rol, empleado = RESPONSABLE, cuerpo } = {}) {
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

const comoAdmin = { rol: "admin", empleado: ADMIN };

async function registrarYDerivar({ anonima }) {
  const datos = new FormData();
  for (const [clave, valor] of Object.entries({ ...QUEJA, anonima: String(anonima) })) datos.append(clave, valor);
  const respuesta = await fetch(`${base}/quejas`, { method: "POST", body: datos, headers: { "X-Empleado-Id": DENUNCIANTE } });
  const cuerpo = await respuesta.json();
  assert.equal(respuesta.status, 201, JSON.stringify(cuerpo));
  creadas.push(cuerpo.codigo_seguimiento);
  const { rows } = await pool.query("SELECT id_queja FROM quejas WHERE codigo_seguimiento = $1", [cuerpo.codigo_seguimiento]);
  const idQueja = rows[0].id_queja;
  const derivacion = await api("POST", `/quejas/casos/${idQueja}/derivacion`, {
    ...comoAdmin,
    cuerpo: { id_categoria_queja: 1, id_prioridad_queja: 2, id_empleado_responsable: RESPONSABLE },
  });
  assert.equal(derivacion.estado, 201, JSON.stringify(derivacion.cuerpo));
  return { codigo: cuerpo.codigo_seguimiento, idQueja };
}

const cambiar = (idQueja, idEstado, extra = {}) =>
  api("POST", `/quejas/casos/${idQueja}/estado`, { cuerpo: { id_estado_queja: idEstado, ...extra } });

const filaQueja = async (idQueja) => (await pool.query("SELECT * FROM quejas WHERE id_queja = $1", [idQueja])).rows[0];
const accionesDe = async (idQueja) =>
  (await pool.query("SELECT * FROM acciones_queja WHERE id_queja = $1 ORDER BY creado_en", [idQueja])).rows;
const historialDe = async (idQueja) =>
  (await pool.query("SELECT * FROM historiales_estado_queja WHERE id_queja = $1 ORDER BY fecha_cambio", [idQueja])).rows;

let ESTADO;

async function llevarA(idQueja, codigos) {
  for (const codigo of codigos) {
    const extra = codigo === "RESUELTA" ? { resolucion: RESOLUCION } : {};
    const { estado, cuerpo } = await cambiar(idQueja, ESTADO[codigo], extra);
    assert.equal(estado, 200, JSON.stringify(cuerpo));
  }
}

describe("KAN-90 (RF-70): acciones y avance del caso con la API y la base reales", () => {
  let identificada;
  let anonima;

  before(async () => {
    try {
      await pool.query("SELECT resolucion, id_estado_aviso_resolucion FROM quejas LIMIT 1");
      const { rows } = await pool.query("SELECT id_estado_queja, codigo FROM catalogos_estado_queja");
      ESTADO = Object.fromEntries(rows.map((fila) => [fila.codigo, fila.id_estado_queja]));
      if (!ESTADO.EN_ACCION) throw new Error("sin los estados de KAN-90 en seed.sql");
    } catch (error) {
      motivo = `PerformanceDB no disponible o sin el esquema de KAN-90 (${error.message || error.code})`;
      return;
    }
    empleados = simularEmpleados();
    notificaciones = simularNotificaciones();
    const [puertoEmpleados, puertoNotificaciones] = await Promise.all([escuchar(empleados), escuchar(notificaciones)]);
    ({ hijo: servicio, base } = await levantarServicio({ puertoEmpleados, puertoNotificaciones }));
    identificada = await registrarYDerivar({ anonima: false });
    anonima = await registrarYDerivar({ anonima: true });
    disponible = true;
  });

  after(async () => {
    servicio?.kill();
    empleados?.close();
    notificaciones?.close();
    if (disponible) {
      const { rows } = await pool.query("SELECT id_queja FROM quejas WHERE codigo_seguimiento = ANY($1)", [creadas]);
      const ids = rows.map((r) => r.id_queja);
      for (const tabla of ["acciones_queja", "involucrados_queja", "asignaciones_queja", "historiales_estado_queja", "adjuntos_queja"]) {
        await pool.query(`DELETE FROM ${tabla} WHERE id_queja = ANY($1)`, [ids]);
      }
      await pool.query("DELETE FROM quejas WHERE id_queja = ANY($1)", [ids]);
      await pool.query("DELETE FROM empleados WHERE id_empleado::text LIKE 'ce000000-%'");
    }
    await pool.end();
    fs.rmSync(CARPETA, { recursive: true, force: true });
  });

  const requiere = (t) => {
    if (!disponible) t.skip(motivo);
    return disponible;
  };

  describe("Acceso del responsable", () => {
    it("el responsable ve el caso en su bandeja y el detalle sin la identidad del denunciante", async (t) => {
      if (!requiere(t)) return;
      const bandeja = await api("GET", "/quejas/asignados?limite=50");
      assert.equal(bandeja.estado, 200);
      const codigos = bandeja.cuerpo.casos.map((c) => c.codigo_seguimiento);
      assert.ok(codigos.includes(identificada.codigo) && codigos.includes(anonima.codigo));
      assert.ok(bandeja.cuerpo.casos.every((c) => c.responsable.id_empleado === RESPONSABLE));

      const detalle = await api("GET", `/quejas/asignados/${identificada.idQueja}`);
      assert.equal(detalle.estado, 200);
      assert.equal(detalle.cuerpo.descripcion, QUEJA.descripcion);
      assert.equal(detalle.cuerpo.denunciante, null);
      assert.ok(!JSON.stringify(detalle.cuerpo).includes(DENUNCIANTE));

      const ajeno = await api("GET", "/quejas/asignados?limite=50", { empleado: SUPERVISOR });
      assert.ok(!ajeno.cuerpo.casos.some((c) => c.codigo_seguimiento === identificada.codigo));
      assert.equal((await api("GET", `/quejas/asignados/${identificada.idQueja}`, { empleado: SUPERVISOR })).estado, 403);
    });
  });

  describe("Criterio 1: bitácora de acciones con fecha y autor", () => {
    it("el responsable registra una acción; queda cifrada, con su autor y la fecha del servidor", async (t) => {
      if (!requiere(t)) return;
      const antes = Date.now();
      const { estado, cuerpo } = await api("POST", `/quejas/casos/${identificada.idQueja}/acciones`, {
        cuerpo: { id_tipo_accion_queja: 1, descripcion: ACCION, id_empleado_registrador: SUPERVISOR, creado_en: "2020-01-01" },
      });
      assert.equal(estado, 201, JSON.stringify(cuerpo));
      assert.equal(cuerpo.registrada_por.id_empleado, RESPONSABLE);
      assert.equal(cuerpo.registrada_por.nombre_completo, "Rosa Rojas Ríos");

      const [fila] = await accionesDe(identificada.idQueja);
      assert.equal(fila.id_empleado_registrador, RESPONSABLE);
      assert.ok(Math.abs(new Date(fila.creado_en).getTime() - antes) < 60_000);
      assert.ok(Buffer.isBuffer(fila.descripcion));
      assert.ok(!fila.descripcion.toString("utf8").includes("encargado"));

      const seguimiento = await api("GET", `/quejas/casos/${identificada.idQueja}/seguimiento`);
      assert.equal(seguimiento.cuerpo.acciones[0].descripcion, ACCION);
      assert.equal(seguimiento.cuerpo.acciones[0].tipo.codigo, "PREVENTIVA");
      assert.equal(seguimiento.cuerpo.acciones[0].registrada_por.id_empleado, RESPONSABLE);
    });

    it("rechaza a quien no es el responsable, incluido el Administrador de RRHH", async (t) => {
      if (!requiere(t)) return;
      const previas = (await accionesDe(identificada.idQueja)).length;
      for (const opciones of [{ empleado: SUPERVISOR }, comoAdmin, { rol: "supervisor", empleado: SUPERVISOR }]) {
        const { estado } = await api("POST", `/quejas/casos/${identificada.idQueja}/acciones`, {
          ...opciones,
          cuerpo: { id_tipo_accion_queja: 2, descripcion: ACCION },
        });
        assert.equal(estado, 403);
      }
      const sinIdentidad = await api("POST", `/quejas/casos/${identificada.idQueja}/acciones`, {
        empleado: null,
        cuerpo: { id_tipo_accion_queja: 2, descripcion: ACCION },
      });
      assert.equal(sinIdentidad.estado, 401);
      assert.equal((await accionesDe(identificada.idQueja)).length, previas);
    });

    it("el administrador consulta la bitácora pero no puede actuar", async (t) => {
      if (!requiere(t)) return;
      const { estado, cuerpo } = await api("GET", `/quejas/casos/${identificada.idQueja}/seguimiento`, comoAdmin);
      assert.equal(estado, 200);
      assert.equal(cuerpo.acciones.length, 1);
      assert.equal(cuerpo.gestion.puede_actuar, false);
      assert.deepEqual(cuerpo.gestion.transiciones, []);
      const otro = await api("GET", `/quejas/casos/${identificada.idQueja}/seguimiento`, { empleado: SUPERVISOR });
      assert.equal(otro.estado, 403);
    });

    it("la bitácora no se puede editar ni borrar", async (t) => {
      if (!requiere(t)) return;
      const [fila] = await accionesDe(identificada.idQueja);
      for (const metodo of ["PUT", "PATCH", "DELETE"]) {
        for (const ruta of [`/quejas/casos/${identificada.idQueja}/acciones`, `/quejas/casos/${identificada.idQueja}/acciones/${fila.id_accion}`]) {
          const respuesta = await fetch(`${base}${ruta}`, {
            method: metodo,
            headers: { "Content-Type": "application/json", "X-Empleado-Id": RESPONSABLE, "X-Rol": "admin" },
            body: JSON.stringify({ descripcion: "Texto cambiado" }),
          });
          assert.equal(respuesta.status, 404, `${metodo} ${ruta}`);
        }
      }
      const [despues] = await accionesDe(identificada.idQueja);
      assert.deepEqual(despues, fila);
    });
  });

  describe("Criterio 2: transiciones de estado", () => {
    it("rechaza saltos inválidos con 409 y registra cada transición válida con anterior, nuevo, autor y fecha", async (t) => {
      if (!requiere(t)) return;
      const salto = await cambiar(identificada.idQueja, ESTADO.EN_ACCION);
      assert.equal(salto.estado, 409);
      assert.match(salto.cuerpo.error, /No se puede pasar el caso de «Asignada» a «En acción»/);
      const resolverDirecto = await cambiar(identificada.idQueja, ESTADO.RESUELTA, { resolucion: RESOLUCION });
      assert.equal(resolverDirecto.estado, 409);

      await llevarA(identificada.idQueja, ["EN_ANALISIS", "EN_ACCION", "EN_ANALISIS", "EN_ACCION"]);
      const pasos = (await historialDe(identificada.idQueja)).slice(2);
      assert.deepEqual(
        pasos.map((h) => [h.id_estado_anterior, h.id_estado_queja, h.id_empleado_responsable]),
        [
          [ESTADO.ASIGNADA, ESTADO.EN_ANALISIS, RESPONSABLE],
          [ESTADO.EN_ANALISIS, ESTADO.EN_ACCION, RESPONSABLE],
          [ESTADO.EN_ACCION, ESTADO.EN_ANALISIS, RESPONSABLE],
          [ESTADO.EN_ANALISIS, ESTADO.EN_ACCION, RESPONSABLE],
        ],
      );
      assert.ok(pasos.every((h) => h.fecha_cambio instanceof Date));
      assert.equal((await filaQueja(identificada.idQueja)).id_estado_queja, ESTADO.EN_ACCION);
    });

    it("el administrador no cambia el estado en nombre del responsable", async (t) => {
      if (!requiere(t)) return;
      const { estado } = await api("POST", `/quejas/casos/${identificada.idQueja}/estado`, {
        ...comoAdmin,
        cuerpo: { id_estado_queja: ESTADO.EN_ANALISIS },
      });
      assert.equal(estado, 403);
      assert.equal((await filaQueja(identificada.idQueja)).id_estado_queja, ESTADO.EN_ACCION);
    });
  });

  describe("Criterio 3: resolución obligatoria y aviso al denunciante", () => {
    it("sin descripción de la resolución responde 400 indicando el campo", async (t) => {
      if (!requiere(t)) return;
      for (const resolucion of [undefined, "", "    "]) {
        const { estado, cuerpo } = await cambiar(identificada.idQueja, ESTADO.RESUELTA, resolucion === undefined ? {} : { resolucion });
        assert.equal(estado, 400);
        assert.equal(cuerpo.detalles[0].campo, "resolucion");
      }
      const fila = await filaQueja(identificada.idQueja);
      assert.equal(fila.id_estado_queja, ESTADO.EN_ACCION);
      assert.equal(fila.resolucion, null);
    });

    it("con descripción resuelve, la cifra y avisa al denunciante solo con el código", async (t) => {
      if (!requiere(t)) return;
      avisos.length = 0;
      const { estado, cuerpo } = await cambiar(identificada.idQueja, ESTADO.RESUELTA, { resolucion: RESOLUCION });
      assert.equal(estado, 200, JSON.stringify(cuerpo));
      assert.equal(cuerpo.estado.codigo, "RESUELTA");
      assert.equal(cuerpo.aviso_resolucion.estado, "ENTREGADO");

      const fila = await filaQueja(identificada.idQueja);
      assert.equal(fila.id_estado_queja, ESTADO.RESUELTA);
      assert.ok(!fila.resolucion.toString("utf8").includes("capacitó"));
      assert.equal(fila.id_estado_aviso_resolucion, 2);
      assert.ok(fila.aviso_resolucion_en instanceof Date);

      assert.equal(avisos.length, 1);
      const [aviso] = avisos;
      assert.equal(aviso.cuerpo.id_empleado_destinatario, DENUNCIANTE);
      assert.match(aviso.cuerpo.asunto, new RegExp(identificada.codigo));
      const texto = JSON.stringify(aviso.cuerpo);
      assert.ok(!texto.includes(RESOLUCION) && !texto.includes(ACCION) && !texto.includes(QUEJA.descripcion));

      const seguimiento = await api("GET", `/quejas/casos/${identificada.idQueja}/seguimiento`);
      assert.equal(seguimiento.cuerpo.resolucion.descripcion, RESOLUCION);
    });

    it("«resuelta» es terminal: no admite más estados ni acciones", async (t) => {
      if (!requiere(t)) return;
      assert.equal((await cambiar(identificada.idQueja, ESTADO.EN_ANALISIS)).estado, 409);
      const accion = await api("POST", `/quejas/casos/${identificada.idQueja}/acciones`, {
        cuerpo: { id_tipo_accion_queja: 2, descripcion: ACCION },
      });
      assert.equal(accion.estado, 409);
    });

    it("la consulta pública por código muestra solo los estados, sin acciones ni resolución", async (t) => {
      if (!requiere(t)) return;
      const respuesta = await fetch(`${base}/quejas/seguimiento`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: identificada.codigo }),
      });
      const cuerpo = await respuesta.json();
      assert.equal(cuerpo.estado.codigo, "RESUELTA");
      assert.ok(cuerpo.historial.some((paso) => paso.codigo === "EN_ACCION"));
      const texto = JSON.stringify(cuerpo);
      assert.ok(!texto.includes(RESOLUCION) && !texto.includes(ACCION) && !texto.includes(RESPONSABLE));
    });

    it("en una queja anónima no se avisa a nadie y no queda ningún dato del denunciante en la base ni en los logs", async (t) => {
      if (!requiere(t)) return;
      avisos.length = 0;
      await api("POST", `/quejas/casos/${anonima.idQueja}/acciones`, { cuerpo: { id_tipo_accion_queja: 2, descripcion: ACCION } });
      await llevarA(anonima.idQueja, ["EN_ANALISIS", "EN_ACCION", "RESUELTA"]);
      assert.equal(avisos.length, 0);

      const fila = await filaQueja(anonima.idQueja);
      assert.equal(fila.es_anonima, true);
      assert.equal(fila.id_empleado_denunciante, null);
      assert.equal(fila.id_estado_aviso_resolucion, null);
      assert.equal(fila.aviso_resolucion_en, null);

      const { rows } = await pool.query(
        `SELECT row_to_json(q)::text AS fila FROM quejas q WHERE id_queja = $1
         UNION ALL SELECT row_to_json(h)::text FROM historiales_estado_queja h WHERE id_queja = $1
         UNION ALL SELECT row_to_json(a)::text FROM acciones_queja a WHERE id_queja = $1
         UNION ALL SELECT row_to_json(s)::text FROM asignaciones_queja s WHERE id_queja = $1`,
        [anonima.idQueja],
      );
      const volcado = rows.map((r) => r.fila).join("\n");
      assert.ok(!volcado.includes(DENUNCIANTE));
      assert.ok(!volcado.includes("Diana") && !volcado.includes("Durán"));
      assert.ok(!logs.includes(DENUNCIANTE) && !logs.includes(anonima.codigo));

      const reintento = await api("POST", `/quejas/casos/${anonima.idQueja}/resolucion/notificacion`);
      assert.equal(reintento.estado, 409);
    });

    it("si el aviso falla la resolución se mantiene y el responsable puede reintentarlo", async (t) => {
      if (!requiere(t)) return;
      const otra = await registrarYDerivar({ anonima: false });
      await llevarA(otra.idQueja, ["EN_ANALISIS", "EN_ACCION"]);
      avisosFallan = true;
      const { estado, cuerpo } = await cambiar(otra.idQueja, ESTADO.RESUELTA, { resolucion: RESOLUCION });
      avisosFallan = false;
      assert.equal(estado, 200);
      assert.equal(cuerpo.aviso_resolucion.estado, "FALLIDO");
      const fila = await filaQueja(otra.idQueja);
      assert.equal(fila.id_estado_queja, ESTADO.RESUELTA);
      assert.equal(fila.id_estado_aviso_resolucion, 3);
      assert.ok(!logs.includes(otra.codigo) && !logs.includes(RESOLUCION));

      assert.equal((await api("POST", `/quejas/casos/${otra.idQueja}/resolucion/notificacion`, comoAdmin)).estado, 403);
      const reintento = await api("POST", `/quejas/casos/${otra.idQueja}/resolucion/notificacion`);
      assert.equal(reintento.estado, 200);
      assert.equal(reintento.cuerpo.estado, "ENTREGADO");
      assert.equal((await filaQueja(otra.idQueja)).id_estado_aviso_resolucion, 2);
    });
  });
});
