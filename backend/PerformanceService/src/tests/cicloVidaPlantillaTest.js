const { describe, it, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");

const ayudas = require("./ayudas/plantillas");

ayudas.simularTransaccion();

const plantillas = require("../models/plantillasModel");
const versiones = require("../models/versionesModel");
const empleados = require("../services/empleadosService");
const servicioPlantillas = require("../services/plantillasService");
const servicioVersiones = require("../services/versionesService");

const { ID_PLANTILLA, ID_VERSION, ID_VERSION_2, EMPLEADO, AREA, PERSONA, idCompetencia, plantilla, version, seccion, criterio, pregunta, datosPlantilla, error } = ayudas;

describe("RF-01: ciclo de vida de la plantilla (base simulada)", () => {
  let bitacora;
  let estado;

  // `estado` es lo que «hay» en la base; las llamadas de escritura quedan anotadas en `bitacora` en orden.
  const simular = (inicial = {}) => {
    estado = { area: AREA, persona: PERSONA, plantilla: plantilla(), version: version(), secciones: [], criterios: [], preguntas: [], ...inicial };
    bitacora = [];
    const anotar = (nombre, valor) => async (...argumentos) => {
      bitacora.push([nombre, argumentos]);
      return valor;
    };

    mock.method(empleados, "obtenerDepartamento", async () => estado.area);
    mock.method(empleados, "obtenerEmpleado", async () => estado.persona);

    mock.method(plantillas, "buscarDuplicada", async () => estado.duplicada ?? null);
    mock.method(plantillas, "asegurarDepartamento", anotar("asegurarDepartamento"));
    mock.method(plantillas, "asegurarEmpleado", anotar("asegurarEmpleado"));
    mock.method(plantillas, "crear", anotar("crear", ID_PLANTILLA));
    mock.method(plantillas, "actualizar", anotar("actualizar"));
    mock.method(plantillas, "eliminar", anotar("eliminar"));
    mock.method(plantillas, "obtener", async () => estado.plantilla);
    mock.method(plantillas, "listarVersiones", async () => []);

    mock.method(versiones, "obtener", async (idPlantilla, idVersion) => {
      if (idVersion === ID_VERSION_2 && !(estado.version && estado.version.id_version === ID_VERSION_2))
        return version({ id_version: ID_VERSION_2, numero_version: 2 });
      return estado.version && idVersion === estado.version.id_version ? estado.version : null;
    });
    mock.method(versiones, "listarSecciones", async () => estado.secciones);
    mock.method(versiones, "listarCriterios", async () => estado.criterios);
    mock.method(versiones, "listarPreguntas", async () => estado.preguntas);
    mock.method(versiones, "listarCompetencias", async (ids) => (estado.catalogo ?? []).filter((c) => ids.includes(c.id_competencia)));
    mock.method(versiones, "reemplazarSecciones", anotar("reemplazarSecciones"));
    mock.method(versiones, "tocarPlantilla", anotar("tocarPlantilla"));
    mock.method(versiones, "hoy", async () => estado.hoy ?? "2026-11-07");
    mock.method(versiones, "publicar", anotar("publicar"));
    mock.method(versiones, "ultimoNumero", async () => estado.ultimoNumero ?? 1);
    mock.method(versiones, "crearBorrador", anotar("crearBorrador", ID_VERSION_2));
    mock.method(versiones, "copiarEstructura", anotar("copiarEstructura"));
  };

  const llamadas = (nombre) => bitacora.filter(([n]) => n === nombre).map(([, argumentos]) => argumentos);

  beforeEach(() => {
    mock.restoreAll();
    simular();
  });

  describe("Criterio 1: crear la plantilla la deja en borrador", () => {
    it("crea la plantilla con su nombre, objetivo, área y vigencia, a nombre de quien la registra", async () => {
      const resultado = await servicioPlantillas.crear(EMPLEADO, datosPlantilla());

      const [[datos]] = llamadas("crear");
      assert.deepEqual(datos, {
        nombre: "Evaluación de personal de tienda",
        objetivo: "Medir la atención al cliente.",
        idDepartamento: ayudas.DEPARTAMENTO,
        vigenciaDesde: "2099-01-01",
        vigenciaHasta: "2099-12-31",
        idCreador: EMPLEADO,
      });
      assert.equal(resultado.id_plantilla, ID_PLANTILLA);
    });

    it("la respuesta muestra la plantilla en estado borrador, en su versión 1", async () => {
      const resultado = await servicioPlantillas.crear(EMPLEADO, datosPlantilla());
      assert.equal(resultado.estado_codigo, "BORRADOR");
      assert.equal(resultado.version_actual.numero_version, 1);
      assert.equal(resultado.fue_publicada, false);
    });

    it("copia el área y a quien la crea en la réplica local antes de guardar la plantilla", async () => {
      await servicioPlantillas.crear(EMPLEADO, datosPlantilla());
      assert.deepEqual(bitacora.map(([nombre]) => nombre).slice(0, 3), ["asegurarDepartamento", "asegurarEmpleado", "crear"]);
      assert.deepEqual(llamadas("asegurarDepartamento")[0][0], AREA);
      assert.deepEqual(llamadas("asegurarEmpleado")[0][0], PERSONA);
    });

    it("no guarda nada si falta algún dato obligatorio", async () => {
      const fallo = await error(servicioPlantillas.crear(EMPLEADO, datosPlantilla({ nombre: "", objetivo: " " })));
      assert.equal(fallo.estado, 400);
      assert.deepEqual(fallo.detalles.map((d) => d.campo), ["nombre", "objetivo"]);
      assert.equal(bitacora.length, 0);
    });

    it("responde 422 y no guarda si el área no existe o está dada de baja", async () => {
      simular({ area: null });
      const fallo = await error(servicioPlantillas.crear(EMPLEADO, datosPlantilla()));
      assert.equal(fallo.estado, 422);
      assert.equal(fallo.detalles[0].campo, "id_departamento");
      assert.equal(bitacora.length, 0);
    });

    it("responde 403 si quien registra no es un empleado conocido", async () => {
      simular({ persona: null });
      const fallo = await error(servicioPlantillas.crear(EMPLEADO, datosPlantilla()));
      assert.equal(fallo.estado, 403);
      assert.equal(bitacora.length, 0);
    });

    it("responde 503 y no guarda si EmployeeService no responde", async () => {
      mock.method(empleados, "obtenerDepartamento", async () => {
        const { ErrorApp } = require("../utils/errores");
        throw new ErrorApp(503, "No se pudo consultar el servicio de empleados. Intente nuevamente.");
      });
      const fallo = await error(servicioPlantillas.crear(EMPLEADO, datosPlantilla()));
      assert.equal(fallo.estado, 503);
      assert.equal(bitacora.length, 0);
    });
  });

  describe("Criterio 2: las secciones se configuran en borrador", () => {
    const catalogo = [1, 2, 3].map((n) => seccion(n)).map(({ id_competencia, nombre, esta_activa }) => ({ id_competencia, nombre, esta_activa }));
    const cuerpo = (...numeros) => ({ secciones: numeros.map((n) => ({ id_competencia: idCompetencia(n) })) });

    it("guarda las competencias en el orden indicado y devuelve la versión con sus secciones", async () => {
      simular({ catalogo });
      mock.method(versiones, "listarSecciones", async () => [seccion(3, { orden: 1 }), seccion(1, { orden: 2 })]);

      const resultado = await servicioVersiones.reemplazarSecciones(ID_PLANTILLA, ID_VERSION, cuerpo(3, 1));

      assert.deepEqual(llamadas("reemplazarSecciones")[0].slice(0, 2), [ID_VERSION, [idCompetencia(3), idCompetencia(1)]]);
      assert.deepEqual(resultado.secciones.map((s) => s.competencia.nombre), ["Competencia 3", "Competencia 1"]);
      assert.equal(resultado.editable, true);
      assert.equal(llamadas("tocarPlantilla").length, 1);
    });

    it("permite dejar la versión sin secciones", async () => {
      await servicioVersiones.reemplazarSecciones(ID_PLANTILLA, ID_VERSION, { secciones: [] });
      assert.deepEqual(llamadas("reemplazarSecciones")[0][1], []);
    });

    it("responde 422 si una competencia no existe y no guarda nada", async () => {
      simular({ catalogo });
      const fallo = await error(servicioVersiones.reemplazarSecciones(ID_PLANTILLA, ID_VERSION, cuerpo(1, 9)));
      assert.equal(fallo.estado, 422);
      assert.deepEqual(fallo.detalles.map((d) => d.campo), ["secciones[1].id_competencia"]);
      assert.equal(llamadas("reemplazarSecciones").length, 0);
    });

    it("rechaza una competencia desactivada que se agrega ahora, pero no una que la versión ya tenía", async () => {
      const desactivada = { ...catalogo[1], esta_activa: false };
      simular({ catalogo: [catalogo[0], desactivada] });

      const fallo = await error(servicioVersiones.reemplazarSecciones(ID_PLANTILLA, ID_VERSION, cuerpo(1, 2)));
      assert.equal(fallo.estado, 422);
      assert.match(fallo.detalles[0].mensaje, /desactivada/);

      simular({ catalogo: [catalogo[0], desactivada], secciones: [seccion(2, { esta_activa: false })] });
      await servicioVersiones.reemplazarSecciones(ID_PLANTILLA, ID_VERSION, cuerpo(1, 2));
      assert.equal(llamadas("reemplazarSecciones").length, 1);
    });

    it("responde 404 si la versión no pertenece a la plantilla o la plantilla no existe", async () => {
      assert.equal((await error(servicioVersiones.reemplazarSecciones(ID_PLANTILLA, ayudas.OTRO_DEPARTAMENTO, cuerpo(1)))).estado, 404);
      simular({ plantilla: null });
      assert.equal((await error(servicioVersiones.reemplazarSecciones(ID_PLANTILLA, ID_VERSION, cuerpo(1)))).estado, 404);
    });

    it("no publica una versión sin secciones y devuelve los pendientes", async () => {
      const fallo = await error(servicioVersiones.publicar(EMPLEADO, ID_PLANTILLA, ID_VERSION));
      assert.equal(fallo.estado, 422);
      assert.deepEqual(fallo.detalles.map((d) => d.campo), ["secciones"]);
      assert.equal(llamadas("publicar").length, 0);
    });

    it("no publica si una sección usa una competencia desactivada", async () => {
      simular({ secciones: [seccion(1), seccion(2, { esta_activa: false })] });
      const fallo = await error(servicioVersiones.publicar(EMPLEADO, ID_PLANTILLA, ID_VERSION));
      assert.equal(fallo.estado, 422);
      assert.match(fallo.detalles[0].mensaje, /Competencia 2/);
    });

    it("no publica una plantilla cuya vigencia ya terminó", async () => {
      simular({
        plantilla: plantilla({ vigencia_hasta: "2026-11-06" }),
        secciones: [seccion(1)],
        criterios: [criterio(1)],
        preguntas: [pregunta(1, 100)],
      });
      const fallo = await error(servicioVersiones.publicar(EMPLEADO, ID_PLANTILLA, ID_VERSION));
      assert.equal(fallo.estado, 422);
      assert.deepEqual(fallo.detalles.map((d) => d.campo), ["vigencia_hasta"]);
    });
  });

  describe("Criterio 3: al publicar queda disponible y se bloquea la estructura", () => {
    beforeEach(() => {
      simular({
        secciones: [seccion(1), seccion(2)],
        criterios: [criterio(1), criterio(2)],
        preguntas: [pregunta(1, 50), pregunta(2, 50)],
      });
    });

    it("publica la versión a nombre de quien confirma y lo anota en la réplica de empleados", async () => {
      // Antes de publicar la versión está en borrador; después de publicar, el servicio la lee ya publicada.
      let lecturas = 0;
      mock.method(versiones, "obtener", async () => (lecturas++ === 0 ? version() : version({ id_estado_version: 2 })));

      const resultado = await servicioVersiones.publicar(EMPLEADO, ID_PLANTILLA, ID_VERSION);

      assert.deepEqual(llamadas("publicar")[0].slice(0, 3), [ID_PLANTILLA, ID_VERSION, EMPLEADO]);
      assert.deepEqual(llamadas("asegurarEmpleado")[0][0], PERSONA);
      assert.equal(resultado.estado_codigo, "PUBLICADA");
      assert.equal(resultado.editable, false);
      assert.equal(resultado.publicador, "Andrea Salazar");
      assert.equal(resultado.secciones.length, 2);
    });

    it("una versión ya publicada no se vuelve a publicar", async () => {
      simular({ version: version({ id_estado_version: 2 }), secciones: [seccion(1)] });
      const fallo = await error(servicioVersiones.publicar(EMPLEADO, ID_PLANTILLA, ID_VERSION));
      assert.equal(fallo.estado, 409);
      assert.equal(llamadas("publicar").length, 0);
    });

    it("una versión publicada o archivada ya no admite cambios en sus secciones", async () => {
      for (const id_estado_version of [2, 3]) {
        simular({ version: version({ id_estado_version }), secciones: [seccion(1)] });
        const fallo = await error(servicioVersiones.reemplazarSecciones(ID_PLANTILLA, ID_VERSION, { secciones: [] }));
        assert.equal(fallo.estado, 409);
        assert.match(fallo.message, /nueva versión/);
        assert.equal(llamadas("reemplazarSecciones").length, 0);
      }
    });

    it("una plantilla ya publicada no se puede editar", async () => {
      simular({ plantilla: plantilla({ fue_publicada: true, id_estado_version: 2, estado_codigo: "PUBLICADA" }) });
      const fallo = await error(servicioPlantillas.actualizar(ID_PLANTILLA, datosPlantilla({ nombre: "Otro nombre" })));
      assert.equal(fallo.estado, 409);
      assert.equal(llamadas("actualizar").length, 0);
    });

    it("una plantilla que ya se publicó alguna vez no se puede eliminar, aunque tenga un borrador nuevo", async () => {
      simular({ plantilla: plantilla({ fue_publicada: true }) });
      const fallo = await error(servicioPlantillas.eliminar(ID_PLANTILLA));
      assert.equal(fallo.estado, 409);
      assert.equal(llamadas("eliminar").length, 0);
    });

    it("una plantilla en borrador sí se edita y se elimina", async () => {
      await servicioPlantillas.actualizar(ID_PLANTILLA, datosPlantilla({ objetivo: "Nuevo objetivo." }));
      assert.equal(llamadas("actualizar")[0][1].objetivo, "Nuevo objetivo.");

      const resultado = await servicioPlantillas.eliminar(ID_PLANTILLA);
      assert.equal(llamadas("eliminar")[0][0], ID_PLANTILLA);
      assert.match(resultado.mensaje, /eliminada/);
    });

    it("editar o eliminar una plantilla que no existe responde 404", async () => {
      simular({ plantilla: null });
      assert.equal((await error(servicioPlantillas.actualizar(ID_PLANTILLA, datosPlantilla()))).estado, 404);
      assert.equal((await error(servicioPlantillas.eliminar(ID_PLANTILLA))).estado, 404);
    });
  });

  describe("Versiones nuevas a partir de la publicada", () => {
    const publicada = () => plantilla({ id_estado_version: 2, estado_codigo: "PUBLICADA", fue_publicada: true });

    it("crea un borrador con el número siguiente y le copia la estructura de la versión más reciente", async () => {
      simular({ plantilla: publicada(), ultimoNumero: 3 });

      await servicioVersiones.crearVersion(ID_PLANTILLA);

      assert.deepEqual(llamadas("crearBorrador")[0].slice(0, 2), [ID_PLANTILLA, 4]);
      assert.deepEqual(llamadas("copiarEstructura")[0].slice(0, 2), [ID_VERSION, ID_VERSION_2]);
    });

    it("no crea otra versión mientras haya un borrador abierto", async () => {
      simular({ plantilla: plantilla({ fue_publicada: true }) });
      const fallo = await error(servicioVersiones.crearVersion(ID_PLANTILLA));
      assert.equal(fallo.estado, 409);
      assert.equal(llamadas("crearBorrador").length, 0);
    });

    it("responde 404 si la plantilla no existe", async () => {
      simular({ plantilla: null });
      assert.equal((await error(servicioVersiones.crearVersion(ID_PLANTILLA))).estado, 404);
    });

    it("publicar el borrador nuevo se hace sobre esa versión y deja que el modelo archive la anterior", async () => {
      simular({
        plantilla: plantilla({ id_version: ID_VERSION_2, numero_version: 2, fue_publicada: true }),
        version: version({ id_version: ID_VERSION_2, numero_version: 2 }),
        secciones: [seccion(1)],
        criterios: [criterio(1)],
        preguntas: [pregunta(1, 100)],
      });

      await servicioVersiones.publicar(EMPLEADO, ID_PLANTILLA, ID_VERSION_2);

      assert.deepEqual(llamadas("publicar")[0].slice(0, 3), [ID_PLANTILLA, ID_VERSION_2, EMPLEADO]);
    });
  });

  describe("Consulta de plantillas", () => {
    it("el detalle incluye las versiones y el listado resume cada plantilla", async () => {
      mock.method(plantillas, "listarVersiones", async () => [{ id_version: ID_VERSION, numero_version: 1 }]);
      mock.method(plantillas, "listar", async () => [plantilla({ secciones_total: 4 })]);

      const detalle = await servicioPlantillas.obtener(ID_PLANTILLA);
      assert.equal(detalle.versiones.length, 1);
      assert.deepEqual(detalle.area, { id_departamento: ayudas.DEPARTAMENTO, nombre: "Atención al cliente" });

      const [fila] = await servicioPlantillas.listar({ estado: "borrador" });
      assert.equal(fila.secciones_total, 4);
      assert.equal(fila.estado_codigo, "BORRADOR");
      assert.deepEqual(plantillas.listar.mock.calls[0].arguments[0].estados, [1]);
    });

    it("el filtro inválido responde 400 sin consultar la base", async () => {
      mock.method(plantillas, "listar", async () => []);
      const fallo = await error(servicioPlantillas.listar({ estado: "ACTIVA" }));
      assert.equal(fallo.estado, 400);
      assert.equal(plantillas.listar.mock.calls.length, 0);
    });

    it("un identificador mal formado responde 400 y uno que no existe, 404", async () => {
      assert.equal((await error(servicioPlantillas.obtener("abc"))).estado, 400);
      simular({ plantilla: null });
      assert.equal((await error(servicioPlantillas.obtener(ID_PLANTILLA))).estado, 404);
    });
  });
});
