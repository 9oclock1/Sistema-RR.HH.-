const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "secreto-de-prueba";
const { cifrarContrasena } = require("../src/utils/contrasenas");

const PATRICIA = "f0000000-0000-4000-8000-000000000746";
const SIN_CUENTA = "f0000000-0000-4000-8000-000000000999";
const ELENA = "f0000000-0000-4000-8000-000000000037";
const PROCESO_1 = "c0000000-0000-4000-8000-000000000747";
const ADMIN = "f0000000-0000-4000-8000-000000000023";

let usuarios = [];
let revocaciones = [];

function reiniciarEstado() {
  usuarios = [
    {
      id_usuario: "b0000000-0000-4000-8000-000000000746",
      id_empleado: PATRICIA,
      correo: "patricia.limachi@correo.test",
      hash_contrasena: cifrarContrasena("rrhh123"),
      rol: "empleado",
      esta_activo: true,
    },
    {
      id_usuario: "b0000000-0000-4000-8000-000000000037",
      id_empleado: ELENA,
      correo: "elena.paredes@correo.test",
      hash_contrasena: cifrarContrasena("rrhh123"),
      rol: "empleado",
      esta_activo: false,
    },
  ];
  revocaciones = [];
}

reiniciarEstado();

const rutaModelo = require.resolve("../src/models/usuarios.model");
require.cache[rutaModelo] = {
  id: rutaModelo,
  filename: rutaModelo,
  loaded: true,
  exports: {
    buscarPorCorreo: async (correo) => usuarios.find((u) => u.correo === correo),
    buscarPorEmpleado: async (id) => usuarios.find((u) => u.id_empleado === id),
    obtenerUltimaRevocacion: async (id) =>
      revocaciones
        .filter((r) => r.id_empleado === id)
        .sort((a, b) => new Date(b.revocado_en) - new Date(a.revocado_en))[0] ?? null,
    revocarAcceso: async ({ idEmpleado, idProceso = null, solicitadoPor = null }) => {
      const usuario = usuarios.find((u) => u.id_empleado === idEmpleado) ?? null;
      if (idProceso) {
        const existente = revocaciones.find(
          (r) => r.id_empleado === idEmpleado && r.id_proceso === idProceso
        );
        if (existente) {
          if (usuario) usuario.esta_activo = false;
          if (!usuario && !existente.id_usuario) return { cuenta_estado: "SIN_CUENTA" };
          return { cuenta_estado: "REVOCADA", revocado_en: existente.revocado_en };
        }
      }
      if (usuario) usuario.esta_activo = false;
      const revocadoEn = new Date(Date.now() + 2000).toISOString();
      revocaciones.push({
        id_revocacion: `rev-${revocaciones.length + 1}`,
        id_empleado: idEmpleado,
        id_usuario: usuario?.id_usuario ?? null,
        motivo: "DESVINCULACION",
        id_proceso: idProceso,
        solicitado_por: solicitadoPor,
        revocado_en: revocadoEn,
      });
      if (!usuario) return { cuenta_estado: "SIN_CUENTA" };
      return { cuenta_estado: "REVOCADA", revocado_en: revocadoEn };
    },
  },
};

const app = require("../index");

let servidor;
let base;
before(async () => {
  servidor = app.listen(0);
  await new Promise((listo) => servidor.once("listening", listo));
  base = `http://127.0.0.1:${servidor.address().port}`;
});
after(() => servidor.close());
beforeEach(() => {
  process.env.CLAVE_SERVICIOS_INTERNOS = "clave-interna-test";
  reiniciarEstado();
});

const login = (correo, contrasena) =>
  fetch(`${base}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ correo, contrasena }),
  });

const tokenDe = (res) => /rrhh_sesion=([^;]+)/.exec(res.headers.get("set-cookie") ?? "")?.[1];
const sesion = (token) => fetch(`${base}/sesion`, { headers: token ? { Cookie: `rrhh_sesion=${token}` } : {} });
const revocar = (idEmpleado, cuerpo, clave) =>
  fetch(`${base}/usuarios/${idEmpleado}/revocar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(clave !== undefined ? { "X-Clave-Servicio": clave } : {}),
    },
    body: JSON.stringify(cuerpo),
  });

test("exigirServicioInterno: sin clave o incorrecta responde 403; sin variable de entorno responde 503", async () => {
  const rSin = await revocar(PATRICIA, { id_proceso: PROCESO_1, solicitado_por: ADMIN });
  assert.equal(rSin.status, 403);

  const rMala = await revocar(PATRICIA, { id_proceso: PROCESO_1, solicitado_por: ADMIN }, "incorrecta");
  assert.equal(rMala.status, 403);

  delete process.env.CLAVE_SERVICIOS_INTERNOS;
  const r503 = await revocar(PATRICIA, { id_proceso: PROCESO_1, solicitado_por: ADMIN }, "clave-interna-test");
  assert.equal(r503.status, 503);
});

test("revocar desactiva la cuenta, registra la revocación y es idempotente por id_proceso", async () => {
  const r1 = await revocar(PATRICIA, { id_proceso: PROCESO_1, solicitado_por: ADMIN }, "clave-interna-test");
  assert.equal(r1.status, 200);
  const d1 = await r1.json();
  assert.equal(d1.cuenta_estado, "REVOCADA");
  assert.ok(d1.revocado_en);
  assert.equal(usuarios[0].esta_activo, false);
  assert.equal(revocaciones.length, 1);

  const r2 = await revocar(PATRICIA, { id_proceso: PROCESO_1, solicitado_por: ADMIN }, "clave-interna-test");
  assert.equal(r2.status, 200);
  const d2 = await r2.json();
  assert.deepEqual(d2, d1);
  assert.equal(revocaciones.length, 1);

  const rConsulta = await fetch(`${base}/usuarios/${PATRICIA}/acceso`, {
    headers: { "X-Clave-Servicio": "clave-interna-test" },
  });
  assert.equal(rConsulta.status, 200);
  const acceso = await rConsulta.json();
  assert.deepEqual(acceso, { tiene_cuenta: true, esta_activo: false, revocado_en: d1.revocado_en });
});

test("colaborador sin cuenta queda SIN_CUENTA y registra revocación con id_usuario null", async () => {
  const r = await revocar(SIN_CUENTA, { id_proceso: PROCESO_1, solicitado_por: ADMIN }, "clave-interna-test");
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { cuenta_estado: "SIN_CUENTA" });
  assert.equal(revocaciones.length, 1);
  assert.equal(revocaciones[0].id_usuario, null);
});

test("AC5: antes de revocar inicia sesión; tras revocar responde 403 ACCESO_REVOCADO y contraseña mala sigue 401", async () => {
  const rAntes = await login("patricia.limachi@correo.test", "rrhh123");
  assert.equal(rAntes.status, 200);
  const tokenAntes = tokenDe(rAntes);
  assert.ok(tokenAntes);

  const rRev = await revocar(PATRICIA, { id_proceso: PROCESO_1, solicitado_por: ADMIN }, "clave-interna-test");
  assert.equal(rRev.status, 200);

  const rDespues = await login("patricia.limachi@correo.test", "rrhh123");
  assert.equal(rDespues.status, 403);
  const bodyDespues = await rDespues.json();
  assert.equal(bodyDespues.codigo, "ACCESO_REVOCADO");
  assert.match(bodyDespues.error, /revocado por el cierre de su relación laboral/i);

  const rMalaPass = await login("patricia.limachi@correo.test", "otra");
  assert.equal(rMalaPass.status, 401);

  const rElena = await login("elena.paredes@correo.test", "rrhh123");
  assert.equal(rElena.status, 403);
  assert.equal((await rElena.json()).codigo, undefined);

  // Token emitido antes de la revocación: GET /sesion devuelve null aunque se reactive la cuenta.
  usuarios[0].esta_activo = true;
  const rSes = await sesion(tokenAntes);
  assert.equal(rSes.status, 200);
  assert.equal((await rSes.json()).usuario, null);

  // Token posterior a revocado_en (simulado con iat futuro) vuelve a ser válido si se reactivó.
  const tokenPosterior = jwt.sign(
    { rol: "empleado", iat: Math.floor(Date.now() / 1000) + 10 },
    process.env.JWT_SECRET,
    { subject: PATRICIA, expiresIn: 3600 }
  );
  const rSesNueva = await sesion(tokenPosterior);
  assert.equal((await rSesNueva.json()).usuario.id_empleado, PATRICIA);
});
