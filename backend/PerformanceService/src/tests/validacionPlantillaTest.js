const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  validarId,
  validarCabecera,
  validarFiltros,
  ESTADO_VERSION,
} = require("../utils/plantillas");
const {
  validarSecciones,
  validarPublicacion,
  MAX_SECCIONES,
} = require("../utils/versiones");
const {
  validarCompetencia,
  validarFiltros: validarFiltrosCompetencias,
  TIPO_COMPETENCIA,
} = require("../utils/competencias");

const DEPARTAMENTO = "f0000000-0000-4000-8000-000000000001";

const cabecera = (cambios = {}) => ({
  nombre: "Evaluación de personal de tienda",
  id_departamento: DEPARTAMENTO,
  objetivo: "Medir la atención al cliente.",
  vigencia_desde: "2027-01-01",
  vigencia_hasta: "2027-12-31",
  ...cambios,
});

// Ejecuta la validación y devuelve el error lanzado, para revisar su estado y su detalle.
const fallo = (validar, ...argumentos) => {
  try {
    validar(...argumentos);
  } catch (error) {
    return error;
  }
  assert.fail("Se esperaba un error de validación");
};
const camposDe = (error) => error.detalles.map((d) => d.campo);

describe("RF-01: validación de la cabecera de la plantilla", () => {
  it("acepta una cabecera completa y devuelve los datos limpios", () => {
    assert.deepEqual(validarCabecera(cabecera()), {
      nombre: "Evaluación de personal de tienda",
      objetivo: "Medir la atención al cliente.",
      idDepartamento: DEPARTAMENTO,
      vigenciaDesde: "2027-01-01",
      vigenciaHasta: "2027-12-31",
    });
  });

  it("quita los espacios sobrantes del nombre y del objetivo, y pasa el área a minúsculas", () => {
    const datos = validarCabecera(
      cabecera({
        nombre: "  Evaluación   de   tienda  ",
        objetivo: "  Medir.  ",
        id_departamento: DEPARTAMENTO.toUpperCase(),
      }),
    );
    assert.equal(datos.nombre, "Evaluación de tienda");
    assert.equal(datos.objetivo, "Medir.");
    assert.equal(datos.idDepartamento, DEPARTAMENTO);
  });

  it("acepta una vigencia de un solo día (fin igual al inicio)", () => {
    assert.doesNotThrow(() =>
      validarCabecera(
        cabecera({
          vigencia_desde: "2027-05-01",
          vigencia_hasta: "2027-05-01",
        }),
      ),
    );
  });

  it("devuelve 400 con un error por cada campo vacío", () => {
    const error = fallo(validarCabecera, {
      nombre: "   ",
      objetivo: "",
      id_departamento: "",
      vigencia_desde: "",
      vigencia_hasta: "",
    });
    assert.equal(error.estado, 400);
    assert.deepEqual(camposDe(error), [
      "nombre",
      "objetivo",
      "id_departamento",
      "vigencia_desde",
      "vigencia_hasta",
    ]);
  });

  it("trata un cuerpo ausente o que no es un objeto como una cabecera vacía", () => {
    for (const cuerpo of [undefined, null, "texto", 5]) {
      const error = fallo(validarCabecera, cuerpo);
      assert.equal(error.estado, 400);
      assert.equal(error.detalles.length, 5);
    }
  });

  it("rechaza un nombre de más de 120 caracteres y acepta uno de exactamente 120", () => {
    assert.deepEqual(
      camposDe(fallo(validarCabecera, cabecera({ nombre: "n".repeat(121) }))),
      ["nombre"],
    );
    assert.doesNotThrow(() =>
      validarCabecera(cabecera({ nombre: "n".repeat(120) })),
    );
  });

  it("rechaza un objetivo de más de 1000 caracteres", () => {
    assert.deepEqual(
      camposDe(
        fallo(validarCabecera, cabecera({ objetivo: "o".repeat(1001) })),
      ),
      ["objetivo"],
    );
    assert.doesNotThrow(() =>
      validarCabecera(cabecera({ objetivo: "o".repeat(1000) })),
    );
  });

  it("rechaza un área que no es un identificador", () => {
    assert.deepEqual(
      camposDe(fallo(validarCabecera, cabecera({ id_departamento: "tienda" }))),
      ["id_departamento"],
    );
  });

  it("rechaza fechas con formato incorrecto o que no existen en el calendario", () => {
    for (const fecha of [
      "01/01/2027",
      "2027-1-1",
      "2027-02-30",
      "2027-13-01",
      "mañana",
    ]) {
      assert.deepEqual(
        camposDe(fallo(validarCabecera, cabecera({ vigencia_desde: fecha }))),
        ["vigencia_desde"],
        fecha,
      );
    }
  });

  it("rechaza una vigencia que termina antes de empezar", () => {
    const error = fallo(
      validarCabecera,
      cabecera({ vigencia_desde: "2027-06-01", vigencia_hasta: "2027-05-31" }),
    );
    assert.deepEqual(camposDe(error), ["vigencia_hasta"]);
    assert.match(error.detalles[0].mensaje, /anterior/);
  });
});

describe("RF-01: filtros del listado y validación de identificadores", () => {
  it("sin filtros no restringe nada", () => {
    assert.deepEqual(validarFiltros({}), {
      estados: null,
      idDepartamento: null,
      busqueda: null,
    });
    assert.deepEqual(validarFiltros(), {
      estados: null,
      idDepartamento: null,
      busqueda: null,
    });
    assert.deepEqual(
      validarFiltros({ estado: "", id_departamento: "", q: "" }),
      { estados: null, idDepartamento: null, busqueda: null },
    );
  });

  it("convierte los códigos de estado en ids, sin importar mayúsculas ni espacios", () => {
    assert.deepEqual(
      validarFiltros({ estado: "borrador, Publicada" }).estados,
      [ESTADO_VERSION.BORRADOR, ESTADO_VERSION.PUBLICADA],
    );
  });

  it("rechaza estados desconocidos, áreas inválidas y búsquedas demasiado largas", () => {
    assert.deepEqual(camposDe(fallo(validarFiltros, { estado: "ACTIVA" })), [
      "estado",
    ]);
    assert.deepEqual(
      camposDe(fallo(validarFiltros, { id_departamento: "x" })),
      ["id_departamento"],
    );
    assert.deepEqual(camposDe(fallo(validarFiltros, { q: "q".repeat(121) })), [
      "q",
    ]);
    assert.equal(fallo(validarFiltros, { estado: ["BORRADOR"] }).estado, 400);
  });

  it("recorta la búsqueda y la descarta si queda vacía", () => {
    assert.equal(validarFiltros({ q: "  tienda " }).busqueda, "tienda");
    assert.equal(validarFiltros({ q: "   " }).busqueda, null);
  });

  it("validarId devuelve el identificador en minúsculas o responde 400 con el campo pedido", () => {
    assert.equal(validarId(DEPARTAMENTO.toUpperCase()), DEPARTAMENTO);
    const error = fallo(validarId, "abc", "id_version");
    assert.equal(error.estado, 400);
    assert.deepEqual(camposDe(error), ["id_version"]);
    assert.equal(fallo(validarId, undefined).estado, 400);
  });
});

describe("RF-01: validación de la lista de secciones", () => {
  const seccion = (n) => ({
    id_competencia: `f0000000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`,
  });

  it("acepta una lista vacía: una versión en borrador puede quedar sin secciones", () => {
    assert.deepEqual(validarSecciones({ secciones: [] }), []);
  });

  it("devuelve las competencias en el orden recibido y en minúsculas", () => {
    const ids = validarSecciones({
      secciones: [
        seccion(3),
        { id_competencia: seccion(1).id_competencia.toUpperCase() },
      ],
    });
    assert.deepEqual(ids, [
      seccion(3).id_competencia,
      seccion(1).id_competencia,
    ]);
  });

  it("rechaza lo que no es una lista", () => {
    for (const cuerpo of [
      undefined,
      {},
      { secciones: "x" },
      { secciones: null },
    ]) {
      assert.deepEqual(camposDe(fallo(validarSecciones, cuerpo)), [
        "secciones",
      ]);
    }
  });

  it("rechaza una competencia repetida y señala su posición", () => {
    const error = fallo(validarSecciones, {
      secciones: [seccion(1), seccion(2), seccion(1)],
    });
    assert.deepEqual(camposDe(error), ["secciones[2].id_competencia"]);
  });

  it("rechaza elementos sin un identificador válido", () => {
    const error = fallo(validarSecciones, {
      secciones: [{ id_competencia: "x" }, {}, null],
    });
    assert.deepEqual(camposDe(error), [
      "secciones[0].id_competencia",
      "secciones[1].id_competencia",
      "secciones[2].id_competencia",
    ]);
  });

  it(`admite hasta ${MAX_SECCIONES} secciones y rechaza una más`, () => {
    const lista = (n) => ({
      secciones: Array.from({ length: n }, (_, i) => ({
        id_competencia: `f0000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
      })),
    });
    assert.equal(validarSecciones(lista(MAX_SECCIONES)).length, MAX_SECCIONES);
    assert.deepEqual(
      camposDe(fallo(validarSecciones, lista(MAX_SECCIONES + 1))),
      ["secciones"],
    );
  });
});

describe("Reglas para publicar una versión", () => {
  const plantilla = (cambios = {}) => ({
    nombre: "Evaluación de tienda",
    objetivo: "Medir.",
    id_departamento: DEPARTAMENTO,
    vigencia_hasta: "2027-12-31",
    ...cambios,
  });
  const competencia = (nombre, activa = true) => ({
    competencia: { nombre, esta_activa: activa },
  });
  const HOY = "2027-06-15";

  it("no encuentra pendientes cuando la cabecera está completa y hay secciones con competencias activas", () => {
    assert.deepEqual(
      validarPublicacion({
        plantilla: plantilla(),
        secciones: [competencia("Atención")],
        hoy: HOY,
      }),
      [],
    );
  });

  it("exige al menos una sección", () => {
    const problemas = validarPublicacion({
      plantilla: plantilla(),
      secciones: [],
      hoy: HOY,
    });
    assert.equal(problemas.length, 1);
    assert.equal(problemas[0].campo, "secciones");
  });

  it("señala cada competencia desactivada por su nombre", () => {
    const problemas = validarPublicacion({
      plantilla: plantilla(),
      secciones: [
        competencia("Atención"),
        competencia("Orden", false),
        competencia("Metas", false),
      ],
      hoy: HOY,
    });
    assert.equal(problemas.length, 2);
    assert.match(problemas[0].mensaje, /Orden/);
    assert.match(problemas[1].mensaje, /Metas/);
  });

  it("no deja publicar una plantilla cuya vigencia ya terminó, pero sí la que termina hoy", () => {
    const vencida = validarPublicacion({
      plantilla: plantilla({ vigencia_hasta: "2027-06-14" }),
      secciones: [competencia("A")],
      hoy: HOY,
    });
    assert.deepEqual(
      vencida.map((p) => p.campo),
      ["vigencia_hasta"],
    );
    assert.deepEqual(
      validarPublicacion({
        plantilla: plantilla({ vigencia_hasta: HOY }),
        secciones: [competencia("A")],
        hoy: HOY,
      }),
      [],
    );
  });

  it("detecta una cabecera con campos vacíos", () => {
    const problemas = validarPublicacion({
      plantilla: plantilla({
        nombre: " ",
        objetivo: "",
        id_departamento: null,
      }),
      secciones: [competencia("A")],
      hoy: HOY,
    });
    assert.deepEqual(
      problemas.map((p) => p.campo),
      ["nombre", "objetivo", "id_departamento"],
    );
  });

  it("junta todos los pendientes en una sola respuesta", () => {
    const problemas = validarPublicacion({
      plantilla: plantilla({ vigencia_hasta: "2020-01-01", objetivo: "" }),
      secciones: [],
      hoy: HOY,
    });
    assert.deepEqual(
      problemas.map((p) => p.campo),
      ["objetivo", "vigencia_hasta", "secciones"],
    );
  });
});

describe("RF-01: validación del catálogo de competencias", () => {
  it("acepta una competencia y normaliza el nombre, el tipo y la descripción vacía", () => {
    assert.deepEqual(
      validarCompetencia({
        nombre: "  Orientación   a resultados ",
        tipo: "competencia_laboral",
        descripcion: "",
      }),
      {
        nombre: "Orientación a resultados",
        descripcion: null,
        idTipo: TIPO_COMPETENCIA.COMPETENCIA_LABORAL,
      },
    );
    assert.equal(
      validarCompetencia({
        nombre: "Metas",
        tipo: "FACTOR_OPERATIVO",
        descripcion: " Logro ",
      }).descripcion,
      "Logro",
    );
  });

  it("rechaza nombre vacío, tipo desconocido y textos demasiado largos", () => {
    assert.deepEqual(
      camposDe(fallo(validarCompetencia, { nombre: "", tipo: "otro" })),
      ["nombre", "tipo"],
    );
    assert.deepEqual(
      camposDe(
        fallo(validarCompetencia, {
          nombre: "n".repeat(101),
          tipo: "FACTOR_OPERATIVO",
        }),
      ),
      ["nombre"],
    );
    assert.deepEqual(
      camposDe(
        fallo(validarCompetencia, {
          nombre: "A",
          tipo: "FACTOR_OPERATIVO",
          descripcion: "d".repeat(256),
        }),
      ),
      ["descripcion"],
    );
    assert.equal(fallo(validarCompetencia, null).estado, 400);
  });

  it("el listado muestra solo las activas, salvo que se pida lo contrario", () => {
    assert.deepEqual(validarFiltrosCompetencias({}), {
      idTipo: null,
      soloActivas: true,
      busqueda: null,
    });
    assert.equal(
      validarFiltrosCompetencias({ activas: "false" }).soloActivas,
      false,
    );
    assert.equal(
      validarFiltrosCompetencias({ tipo: "factor_operativo" }).idTipo,
      TIPO_COMPETENCIA.FACTOR_OPERATIVO,
    );
  });

  it("rechaza filtros inválidos en el listado", () => {
    assert.deepEqual(
      camposDe(fallo(validarFiltrosCompetencias, { tipo: "x", activas: "si" })),
      ["tipo", "activas"],
    );
  });
});
