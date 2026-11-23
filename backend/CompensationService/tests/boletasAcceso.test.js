// Criterio 3 por HTTP: la identidad sale del JWT firmado, nunca de las cabeceras X-Empleado-Id / X-Rol.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "secreto-de-prueba";
const { armarContenido, calcularHash } = require("../src/utils/boletas");

const ANA = "f0000000-0000-4000-8000-000000000035";
const CARLOS = "f0000000-0000-4000-8000-000000000031";
const ANDREA = "f0000000-0000-4000-8000-000000000023";
const BOLETA_ANA = "0d3f5a4e-6a59-4a39-9a43-1f1e7e1c2b11";

const filaAna = {
  id_boleta: BOLETA_ANA,
  id_planilla: "a1b2c3d4-0000-4000-8000-000000000001",
  id_planilla_empleado: "a1b2c3d4-0000-4000-8000-000000000002",
  periodo: "2026-08",
  estado: "CERRADA",
  cerrada_en: "2026-09-05T15:00:00.000Z",
  emitida_en: "2026-09-06T12:00:00.000Z",
  descargas: 0,
  ultima_descarga_en: null,
  id_empleado: ANA,
  nombre_empleado: "Ana Torrez Villca",
  numero_contrato: "CT-35",
  haber_mensual: "3500.00",
  dias_contrato: 30,
  dias_pagados: 30,
  faltas_injustificadas: 0,
  dias_licencia_sin_goce: 0,
  total_ganado: "3500.00",
  total_descuentos: "385.00",
  liquido_pagable: "3115.00",
  total_aportes: "0.00",
  renglones: [],
};
filaAna.hash_contenido = calcularHash(armarContenido(filaAna));

const listados = [];
const rutaModelo = require.resolve("../src/models/boletas.model");
require.cache[rutaModelo] = {
  id: rutaModelo,
  filename: rutaModelo,
  loaded: true,
  exports: {
    pendientesDeEmitir: async () => [],
    emitir: async () => {},
    listar: async (idEmpleado) => {
      listados.push(idEmpleado);
      return [];
    },
    obtener: async (id) => (id === BOLETA_ANA ? filaAna : undefined),
    registrarDescarga: async () => {},
  },
};

const app = express();
app.use(require("../src/routes/boletas.routes"));
app.use(require("../src/middlewares/manejadorErrores"));

let servidor;
let base;
before(async () => {
  servidor = app.listen(0);
  await new Promise((listo) => servidor.once("listening", listo));
  base = `http://127.0.0.1:${servidor.address().port}`;
});
after(() => servidor.close());

const token = (sub, rol, secreto = "secreto-de-prueba", opciones = {}) =>
  jwt.sign({ rol }, secreto, { subject: sub, expiresIn: 60, ...opciones });
const pedir = (ruta, cabeceras = {}) => fetch(`${base}${ruta}`, { headers: cabeceras });
const conCookie = (t, extra = {}) => ({ Cookie: `otra=1; rrhh_sesion=${t}`, ...extra });

test("sin sesión responde 401 aunque se envíen X-Empleado-Id y X-Rol", async () => {
  for (const ruta of ["/boletas", `/boletas/${BOLETA_ANA}`, `/boletas/${BOLETA_ANA}/pdf`]) {
    const r = await pedir(ruta, { "X-Empleado-Id": ANA, "X-Rol": "admin" });
    assert.equal(r.status, 401, ruta);
    assert.equal((await r.json()).codigo, "SIN_SESION");
  }
});

test("un token alterado, firmado con otro secreto, vencido o sin firma responde 401", async () => {
  const valido = token(CARLOS, "empleado");
  const [cabecera, , firma] = valido.split(".");
  const carga = Buffer.from(JSON.stringify({ sub: CARLOS, rol: "admin", exp: 9999999999 })).toString("base64url");
  const sinFirma = `${Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")}.${carga}.`;
  for (const t of [`${cabecera}.${carga}.${firma}`, token(CARLOS, "admin", "otro-secreto"), token(CARLOS, "empleado", undefined, { expiresIn: -10 }), sinFirma, "basura"]) {
    assert.equal((await pedir(`/boletas/${BOLETA_ANA}`, conCookie(t))).status, 401);
  }
});

test("criterio 3: Carlos no ve la boleta de Ana aunque se ponga X-Rol admin o el id de Ana", async () => {
  const carlos = token(CARLOS, "empleado");
  const falsas = { "X-Rol": "admin", "X-Empleado-Id": ANA };
  assert.equal((await pedir(`/boletas/${BOLETA_ANA}`, conCookie(carlos, falsas))).status, 403);
  assert.equal((await pedir(`/boletas/${BOLETA_ANA}/pdf`, { Authorization: `Bearer ${carlos}`, ...falsas })).status, 403);
  listados.length = 0;
  assert.equal((await pedir("/boletas", conCookie(carlos, falsas))).status, 200);
  assert.deepEqual(listados, [CARLOS]);
});

test("Ana ve su boleta y RRHH (rol del token) la de cualquiera", async () => {
  const deAna = await pedir(`/boletas/${BOLETA_ANA}`, conCookie(token(ANA, "empleado")));
  assert.equal(deAna.status, 200);
  assert.equal((await deAna.json()).empleado.id_empleado, ANA);
  assert.equal((await pedir(`/boletas/${BOLETA_ANA}`, conCookie(token(ANDREA, "admin")))).status, 200);
  const pdf = await pedir(`/boletas/${BOLETA_ANA}/pdf`, { Authorization: `Bearer ${token(ANA, "empleado")}` });
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get("content-type"), "application/pdf");
});
