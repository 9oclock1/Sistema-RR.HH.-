const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "secreto-de-prueba";
const { cifrarContrasena, verificarContrasena } = require("../src/utils/contrasenas");

const ANA = "f0000000-0000-4000-8000-000000000035";
const ELENA = "f0000000-0000-4000-8000-000000000037";
const usuarios = [
  { id_usuario: "a0000000-0000-4000-8000-000000000001", id_empleado: ANA, correo: "ana.torrez@correo.test", hash_contrasena: cifrarContrasena("Clave-123"), rol: "empleado", esta_activo: true },
  { id_usuario: "a0000000-0000-4000-8000-000000000002", id_empleado: ELENA, correo: "elena.paredes@correo.test", hash_contrasena: cifrarContrasena("Clave-123"), rol: "empleado", esta_activo: false },
];

// Modelo en memoria: el servicio se prueba sin base de datos.
const rutaModelo = require.resolve("../src/models/usuarios.model");
require.cache[rutaModelo] = {
  id: rutaModelo,
  filename: rutaModelo,
  loaded: true,
  exports: {
    buscarPorCorreo: async (correo) => usuarios.find((u) => u.correo === correo),
    buscarPorEmpleado: async (id) => usuarios.find((u) => u.id_empleado === id),
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

const login = (cuerpo) =>
  fetch(`${base}/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
const cookieDe = (respuesta) => respuesta.headers.get("set-cookie") ?? "";
const tokenDe = (respuesta) => /rrhh_sesion=([^;]+)/.exec(cookieDe(respuesta))?.[1];
const sesion = (token) => fetch(`${base}/sesion`, { headers: token ? { Cookie: `rrhh_sesion=${token}` } : {} });

test("la contraseña se guarda con sal y solo la correcta coincide", () => {
  const a = cifrarContrasena("Clave-123");
  assert.notEqual(a, cifrarContrasena("Clave-123"));
  assert.match(a, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  assert.equal(verificarContrasena("Clave-123", a), true);
  assert.equal(verificarContrasena("otra", a), false);
  assert.equal(verificarContrasena("Clave-123", "basura"), false);
});

test("el inicio de sesión correcto deja una cookie HttpOnly con un JWT firmado", async () => {
  const r = await login({ correo: " Ana.Torrez@correo.test ", contrasena: "Clave-123" });
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).usuario, { id_empleado: ANA, correo: "ana.torrez@correo.test", rol: "empleado" });
  assert.match(cookieDe(r), /HttpOnly/i);
  assert.match(cookieDe(r), /SameSite=Strict/i);
  const datos = jwt.verify(tokenDe(r), "secreto-de-prueba", { algorithms: ["HS256"] });
  assert.equal(datos.sub, ANA);
  assert.equal(datos.rol, "empleado");
  assert.equal(datos.exp - datos.iat, 8 * 60 * 60);
});

test("contraseña incorrecta o correo inexistente responden 401 con el mismo mensaje y sin cookie", async () => {
  const mala = await login({ correo: "ana.torrez@correo.test", contrasena: "otra" });
  const nadie = await login({ correo: "nadie@correo.test", contrasena: "Clave-123" });
  assert.equal(mala.status, 401);
  assert.equal(nadie.status, 401);
  assert.equal((await mala.json()).error, (await nadie.json()).error);
  assert.equal(cookieDe(mala), "");
});

test("una cuenta desactivada no puede iniciar sesión", async () => {
  const r = await login({ correo: "elena.paredes@correo.test", contrasena: "Clave-123" });
  assert.equal(r.status, 403);
  assert.equal(cookieDe(r), "");
});

test("sin correo o contraseña responde 400 con el detalle por campo", async () => {
  const r = await login({ correo: "  " });
  assert.equal(r.status, 400);
  assert.deepEqual((await r.json()).detalles.map((d) => d.campo), ["correo", "contrasena"]);
});

test("la sesión se lee del token y es null si falta, está alterado, venció o la cuenta se desactivó", async () => {
  const token = tokenDe(await login({ correo: "ana.torrez@correo.test", contrasena: "Clave-123" }));
  const ok = await sesion(token);
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).usuario.id_empleado, ANA);

  const falsificado = jwt.sign({ rol: "admin" }, "otro-secreto", { subject: ANA });
  const vencido = jwt.sign({ rol: "empleado" }, "secreto-de-prueba", { subject: ANA, expiresIn: -10 });
  const desactivada = jwt.sign({ rol: "empleado" }, "secreto-de-prueba", { subject: ELENA });
  for (const t of [null, "basura", falsificado, vencido, desactivada]) {
    const r = await sesion(t);
    assert.equal(r.status, 200);
    assert.equal((await r.json()).usuario, null);
  }
});

test("cerrar sesión borra la cookie", async () => {
  const r = await fetch(`${base}/logout`, { method: "POST" });
  assert.equal(r.status, 204);
  assert.match(cookieDe(r), /rrhh_sesion=;/);
});
