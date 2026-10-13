const { test } = require("node:test");
const assert = require("node:assert/strict");
const { diasSolicitados, evaluarLimite, clasificarParaNomina } = require("../src/utils/licencias");
const { validarSolicitudLicencia } = require("../src/utils/validarSolicitudLicencia");

const valida = { id_tipo_licencia: "3", fecha_inicio: "2026-11-02", fecha_fin: "2026-11-04" };

const camposInvalidos = (datos) => {
  try {
    validarSolicitudLicencia(datos);
  } catch (error) {
    assert.equal(error.estado, 400);
    return error.detalles.map((d) => d.campo);
  }
  assert.fail("debía rechazar los datos");
};

test("cuenta los días corridos con ambos extremos incluidos", () => {
  assert.equal(diasSolicitados("2026-11-02", "2026-11-02"), 1);
  assert.equal(diasSolicitados("2026-11-02", "2026-11-04"), 3);
  assert.equal(diasSolicitados("2026-02-27", "2026-03-02"), 4);
});

test("excede el límite solo cuando los días superan el tope", () => {
  const duelo = { dias_maximos_continuos: 3 };
  assert.deepEqual(evaluarLimite(duelo, 3), { tope: 3, excede: false });
  assert.deepEqual(evaluarLimite(duelo, 4), { tope: 3, excede: true });
});

test("un tipo sin tope nunca excede el límite", () => {
  assert.deepEqual(evaluarLimite({ dias_maximos_continuos: null }, 365), { tope: null, excede: false });
});

test("clasifica con o sin goce de haberes según el catálogo", () => {
  assert.equal(clasificarParaNomina({ es_con_goce_haberes: true }), "CON_GOCE");
  assert.equal(clasificarParaNomina({ es_con_goce_haberes: false }), "SIN_GOCE");
});

test("normaliza una solicitud válida enviada como texto (multipart)", () => {
  assert.deepEqual(validarSolicitudLicencia({ ...valida, motivo: "  Fallecimiento de familiar  " }), {
    id_tipo_licencia: 3,
    fecha_inicio: "2026-11-02",
    fecha_fin: "2026-11-04",
    motivo: "Fallecimiento de familiar",
  });
  assert.equal(validarSolicitudLicencia(valida).motivo, null);
});

test("acepta una solicitud de un solo día", () => {
  assert.doesNotThrow(() => validarSolicitudLicencia({ ...valida, fecha_fin: valida.fecha_inicio }));
});

test("exige tipo y fechas", () => {
  assert.deepEqual(camposInvalidos({}), ["id_tipo_licencia", "fecha_inicio", "fecha_fin"]);
  assert.deepEqual(camposInvalidos(undefined), ["id_tipo_licencia", "fecha_inicio", "fecha_fin"]);
});

test("rechaza tipos que no son enteros positivos", () => {
  for (const id_tipo_licencia of ["abc", "1.5", "0", "-1", ""]) {
    assert.deepEqual(camposInvalidos({ ...valida, id_tipo_licencia }), ["id_tipo_licencia"]);
  }
});

test("rechaza fechas con formato o calendario inválido", () => {
  assert.deepEqual(camposInvalidos({ ...valida, fecha_inicio: "02/11/2026" }), ["fecha_inicio"]);
  assert.deepEqual(camposInvalidos({ ...valida, fecha_fin: "2026-02-30" }), ["fecha_fin"]);
});

test("rechaza un rango con la fecha de fin anterior al inicio", () => {
  assert.deepEqual(camposInvalidos({ ...valida, fecha_inicio: "2026-11-05" }), ["fecha_fin"]);
});

test("rechaza un motivo de más de 500 caracteres", () => {
  assert.deepEqual(camposInvalidos({ ...valida, motivo: "x".repeat(501) }), ["motivo"]);
});
