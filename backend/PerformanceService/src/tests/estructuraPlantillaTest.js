const { describe, it, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");

const ayudas = require("./ayudas/plantillas");

ayudas.simularTransaccion();

const plantillas = require("../models/plantillasModel");
const versiones = require("../models/versionesModel");
const empleados = require("../services/empleadosService");
const servicio = require("../services/versionesService");
const { validarEstructura } = require("../utils/versiones");

const {
  ID_PLANTILLA,
  ID_VERSION,
  EMPLEADO,
  PERSONA,
  ID_ESCALA,
  idCompetencia,
  plantilla,
  version,
  seccion,
  criterio,
  pregunta,
  error,
} = ayudas;

const camposDe = (fallo) => fallo.detalles.map((d) => d.campo);

// Cuerpo de PUT .../estructura con una sección (competencia 1), un criterio y las preguntas indicadas.
const cuerpo = (...pesos) => ({
  secciones: [
    {
      id_competencia: idCompetencia(1),
      criterios: [
        {
          nombre: "Trato al cliente",
          descripcion: "",
          preguntas: pesos.map((peso, i) => ({
            texto: `Pregunta ${i + 1}`,
            peso_porcentual: peso,
            es_obligatoria: true,
            id_escala: ID_ESCALA,
          })),
        },
      ],
    },
  ],
});

describe("KAN-22 en la plantilla: criterios, preguntas y pesos dentro de la versión", () => {
  let estado;
  let bitacora;

  const simular = (inicial = {}) => {
    estado = {
      plantilla: plantilla(),
      version: version(),
      secciones: [],
      criterios: [],
      preguntas: [],
      catalogo: [{ id_competencia: idCompetencia(1), nombre: "Competencia 1", esta_activa: true }],
      escalas: [ID_ESCALA],
      ...inicial,
    };
    bitacora = [];
    const anotar = (nombre) => async (...argumentos) => {
      bitacora.push([nombre, argumentos]);
    };

    mock.method(empleados, "obtenerEmpleado", async () => PERSONA);
    mock.method(plantillas, "obtener", async () => estado.plantilla);
    mock.method(plantillas, "asegurarEmpleado", async () => {});
    mock.method(versiones, "obtener", async () => estado.version);
    mock.method(versiones, "listarSecciones", async () => estado.secciones);
    mock.method(versiones, "listarCriterios", async () => estado.criterios);
    mock.method(versiones, "listarPreguntas", async () => estado.preguntas);
    mock.method(versiones, "listarCompetencias", async (ids) => estado.catalogo.filter((c) => ids.includes(c.id_competencia)));
    mock.method(versiones, "escalasExistentes", async () => new Set(estado.escalas));
    mock.method(versiones, "reemplazarEstructura", anotar("reemplazarEstructura"));
    mock.method(versiones, "tocarPlantilla", anotar("tocarPlantilla"));
    mock.method(versiones, "hoy", async () => "2026-11-07");
    mock.method(versiones, "publicar", anotar("publicar"));
    mock.method(versiones, "ultimoNumero", async () => 1);
    mock.method(versiones, "crearBorrador", anotar("crearBorrador"));
    mock.method(versiones, "copiarEstructura", anotar("copiarEstructura"));
  };

  const llamadas = (nombre) => bitacora.filter(([n]) => n === nombre).map(([, argumentos]) => argumentos);

  beforeEach(() => {
    mock.restoreAll();
    simular();
  });

  describe("Guardar la estructura del borrador", () => {
    it("reemplaza secciones, criterios y preguntas y devuelve la versión con su balance", async () => {
      simular({
        secciones: [seccion(1)],
        criterios: [criterio(1)],
        preguntas: [pregunta(1, 40), pregunta(2, 60, { id_criterio: criterio(1).id_criterio, orden: 2 })],
      });

      const resultado = await servicio.guardarEstructura(ID_PLANTILLA, ID_VERSION, cuerpo(40, 60));

      const [idVersion, secciones] = llamadas("reemplazarEstructura")[0];
      assert.equal(idVersion, ID_VERSION);
      assert.equal(secciones[0].criterios[0].preguntas.length, 2);
      assert.equal(llamadas("tocarPlantilla").length, 1);
      assert.equal(resultado.secciones[0].criterios[0].preguntas.length, 2);
      assert.equal(resultado.total_preguntas, 2);
      assert.deepEqual(resultado.balance, { suma: 100, diferencia: 0, balanceado: true });
    });

    it("un borrador se puede guardar desbalanceado: el balance se exige al publicar", async () => {
      simular({ secciones: [seccion(1)], criterios: [criterio(1)], preguntas: [pregunta(1, 70)] });
      const resultado = await servicio.guardarEstructura(ID_PLANTILLA, ID_VERSION, cuerpo(70));
      assert.deepEqual(resultado.balance, { suma: 70, diferencia: 30, balanceado: false });
    });

    it("un criterio sin preguntas también se puede guardar en borrador", async () => {
      const resultado = await servicio.guardarEstructura(ID_PLANTILLA, ID_VERSION, cuerpo());
      assert.equal(resultado.total_preguntas, 0);
      assert.equal(llamadas("reemplazarEstructura").length, 1);
    });

    it("rechaza una estructura mal formada con la ruta exacta de cada error y sin tocar la base", async () => {
      const malo = cuerpo(0, 150);
      malo.secciones[0].criterios[0].nombre = " ";
      malo.secciones[0].criterios[0].preguntas[1].id_escala = null;
      const fallo = await error(servicio.guardarEstructura(ID_PLANTILLA, ID_VERSION, malo));
      assert.equal(fallo.estado, 400);
      assert.deepEqual(camposDe(fallo), [
        "secciones[0].criterios[0].nombre",
        "secciones[0].criterios[0].preguntas[0].peso_porcentual",
        "secciones[0].criterios[0].preguntas[1].peso_porcentual",
        "secciones[0].criterios[0].preguntas[1].id_escala",
      ]);
      assert.equal(llamadas("reemplazarEstructura").length, 0);
    });

    it("exige la lista de secciones", async () => {
      for (const cuerpoMalo of [undefined, {}, { secciones: "x" }]) {
        const fallo = await error(servicio.guardarEstructura(ID_PLANTILLA, ID_VERSION, cuerpoMalo));
        assert.equal(fallo.estado, 400);
        assert.deepEqual(camposDe(fallo), ["secciones"]);
      }
    });

    it("responde 422 si una escala o una competencia no existen", async () => {
      simular({ escalas: [], catalogo: [] });
      const fallo = await error(servicio.guardarEstructura(ID_PLANTILLA, ID_VERSION, cuerpo(100)));
      assert.equal(fallo.estado, 422);
      assert.deepEqual(camposDe(fallo), ["secciones[0].id_competencia", "secciones[0].criterios[0].preguntas[0].id_escala"]);
      assert.equal(llamadas("reemplazarEstructura").length, 0);
    });

    it("una versión publicada o archivada exige crear una nueva versión", async () => {
      for (const id_estado_version of [2, 3]) {
        simular({ version: version({ id_estado_version }) });
        const fallo = await error(servicio.guardarEstructura(ID_PLANTILLA, ID_VERSION, cuerpo(100)));
        assert.equal(fallo.estado, 409);
        assert.match(fallo.message, /nueva versión/);
        assert.equal(llamadas("reemplazarEstructura").length, 0);
      }
    });

    it("responde 404 si la plantilla o la versión no existen", async () => {
      simular({ plantilla: null });
      assert.equal((await error(servicio.guardarEstructura(ID_PLANTILLA, ID_VERSION, cuerpo(100)))).estado, 404);
      simular({ version: null });
      assert.equal((await error(servicio.guardarEstructura(ID_PLANTILLA, ID_VERSION, cuerpo(100)))).estado, 404);
    });
  });

  describe("Publicar exige criterios, preguntas y pesos que sumen 100 %", () => {
    const publicar = () => servicio.publicar(EMPLEADO, ID_PLANTILLA, ID_VERSION);

    it("publica cuando todo está completo y los pesos suman exactamente 100 (33,33 + 33,33 + 33,34)", async () => {
      simular({
        secciones: [seccion(1)],
        criterios: [criterio(1)],
        preguntas: [pregunta(1, 33.33), pregunta(2, 33.33, { id_criterio: criterio(1).id_criterio }), pregunta(3, 33.34, { id_criterio: criterio(1).id_criterio })],
      });
      let lecturas = 0;
      mock.method(versiones, "obtener", async () => (lecturas++ === 0 ? version() : version({ id_estado_version: 2 })));

      const resultado = await publicar();

      assert.equal(llamadas("publicar").length, 1);
      assert.equal(resultado.estado_codigo, "PUBLICADA");
    });

    it("no publica si la suma de pesos es distinta de 100 % y muestra el desbalance", async () => {
      simular({ secciones: [seccion(1)], criterios: [criterio(1)], preguntas: [pregunta(1, 80)] });
      const fallo = await error(publicar());
      assert.equal(fallo.estado, 422);
      assert.deepEqual(camposDe(fallo), ["peso_porcentual"]);
      assert.match(fallo.detalles[0].mensaje, /80 %.*faltan 20 %/);
      assert.equal(llamadas("publicar").length, 0);
    });

    it("avisa cuando los pesos sobran", async () => {
      simular({ secciones: [seccion(1)], criterios: [criterio(1)], preguntas: [pregunta(1, 60), pregunta(2, 60, { id_criterio: criterio(1).id_criterio })] });
      const fallo = await error(publicar());
      assert.match(fallo.detalles[0].mensaje, /120 %.*sobran 20 %/);
    });

    it("no publica una sección sin criterios", async () => {
      simular({ secciones: [seccion(1)] });
      const fallo = await error(publicar());
      assert.equal(fallo.estado, 422);
      assert.deepEqual(camposDe(fallo), ["criterios"]);
      assert.match(fallo.detalles[0].mensaje, /Competencia 1/);
    });

    it("no publica un criterio sin preguntas", async () => {
      simular({ secciones: [seccion(1)], criterios: [criterio(1)] });
      const fallo = await error(publicar());
      assert.deepEqual(camposDe(fallo), ["preguntas"]);
      assert.match(fallo.detalles[0].mensaje, /Criterio 1/);
    });

    it("lista todos los pendientes juntos", async () => {
      simular({
        secciones: [seccion(1), seccion(2)],
        criterios: [criterio(1)],
        preguntas: [pregunta(1, 50)],
      });
      const fallo = await error(publicar());
      assert.deepEqual(camposDe(fallo), ["criterios", "peso_porcentual"]);
    });
  });

  describe("Nueva versión de una plantilla publicada", () => {
    const publicada = (cambios) => plantilla({ id_estado_version: 2, estado_codigo: "PUBLICADA", fue_publicada: true, ...cambios });

    it("copia la estructura completa, con criterios y preguntas, a un borrador nuevo", async () => {
      simular({ plantilla: publicada() });
      await servicio.crearVersion(ID_PLANTILLA);
      assert.equal(llamadas("copiarEstructura").length, 1);
    });

    it("no crea otra versión si la vigencia ya terminó: esa versión no se podría publicar", async () => {
      simular({ plantilla: publicada({ vigencia_hasta: "2026-11-06" }) });
      const fallo = await error(servicio.crearVersion(ID_PLANTILLA));
      assert.equal(fallo.estado, 409);
      assert.match(fallo.message, /vigencia.*terminó/);
      assert.equal(llamadas("crearBorrador").length, 0);
    });

    it("sí la crea si la vigencia termina hoy", async () => {
      simular({ plantilla: publicada({ vigencia_hasta: "2026-11-07" }) });
      await servicio.crearVersion(ID_PLANTILLA);
      assert.equal(llamadas("crearBorrador").length, 1);
    });
  });
});

describe("KAN-22: validación del cuerpo de la estructura", () => {
  it("normaliza textos, aplica es_obligatoria = true por omisión y conserva el orden", () => {
    const { secciones } = validarEstructura({
      secciones: [
        {
          id_competencia: idCompetencia(1).toUpperCase(),
          criterios: [{ nombre: "  Trato  ", preguntas: [{ texto: " ¿Saluda? ", peso_porcentual: 12.5, id_escala: ID_ESCALA }] }],
        },
      ],
    });
    assert.equal(secciones[0].id_competencia, idCompetencia(1));
    assert.equal(secciones[0].criterios[0].nombre, "Trato");
    assert.equal(secciones[0].criterios[0].preguntas[0].texto, "¿Saluda?");
    assert.equal(secciones[0].criterios[0].preguntas[0].es_obligatoria, true);
  });

  it("rechaza pesos con más de dos decimales y criterios repetidos en una sección", () => {
    const base = cuerpo(10.123);
    base.secciones[0].criterios.push({ nombre: "trato al cliente", preguntas: [] });
    assert.throws(
      () => validarEstructura(base),
      (e) =>
        e.estado === 400 &&
        e.detalles.some((d) => d.campo === "secciones[0].criterios[0].preguntas[0].peso_porcentual") &&
        e.detalles.some((d) => d.campo === "secciones[0].criterios[1].nombre"),
    );
  });
});
