const { describe, it, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");

const ayudas = require("./ayudas/plantillas");

ayudas.simularTransaccion();

const plantillas = require("../models/plantillasModel");
const competencias = require("../models/competenciasModel");
const empleados = require("../services/empleadosService");
const servicioPlantillas = require("../services/plantillasService");
const servicioCompetencias = require("../services/competenciasService");

const { ID_PLANTILLA, OTRO_DEPARTAMENTO, DEPARTAMENTO, EMPLEADO, AREA, PERSONA, plantilla, datosPlantilla, error } = ayudas;

const CHOQUE = { id_plantilla: "aaaaaaaa-0000-4000-8000-000000000099", nombre: "Evaluación de personal de tienda", vigencia_desde: "2099-06-01", vigencia_hasta: "2099-12-31" };
const errorDeBase = (code) => Object.assign(new Error("error de la base"), { code });

describe("RF-01 criterio 4: no se guardan plantillas duplicadas", () => {
  let creadas;
  let actualizadas;
  let existente;

  beforeEach(() => {
    mock.restoreAll();
    creadas = [];
    actualizadas = [];
    existente = null;

    mock.method(empleados, "obtenerDepartamento", async () => AREA);
    mock.method(empleados, "obtenerEmpleado", async () => PERSONA);
    mock.method(plantillas, "buscarDuplicada", async () => existente);
    mock.method(plantillas, "asegurarDepartamento", async () => {});
    mock.method(plantillas, "asegurarEmpleado", async () => {});
    mock.method(plantillas, "crear", async (datos) => {
      creadas.push(datos);
      return ID_PLANTILLA;
    });
    mock.method(plantillas, "actualizar", async (id, datos) => {
      actualizadas.push([id, datos]);
    });
    mock.method(plantillas, "obtener", async () => plantilla());
    mock.method(plantillas, "listarVersiones", async () => []);
  });

  const consultaDeDuplicada = () => plantillas.buscarDuplicada.mock.calls.at(-1).arguments[0];

  describe("al crear", () => {
    it("busca coincidencias con el nombre limpio, el área y la vigencia indicados", async () => {
      await servicioPlantillas.crear(EMPLEADO, datosPlantilla({ nombre: "  Evaluación   de personal de tienda " }));
      assert.deepEqual(consultaDeDuplicada(), {
        nombre: "Evaluación de personal de tienda",
        objetivo: "Medir la atención al cliente.",
        idDepartamento: DEPARTAMENTO,
        vigenciaDesde: "2099-01-01",
        vigenciaHasta: "2099-12-31",
      });
    });

    it("si ya existe una igual muestra la alerta de duplicidad (409) con la plantilla en conflicto y no guarda", async () => {
      existente = CHOQUE;
      const fallo = await error(servicioPlantillas.crear(EMPLEADO, datosPlantilla()));

      assert.equal(fallo.estado, 409);
      assert.match(fallo.message, /Ya existe una plantilla con ese nombre/);
      assert.equal(fallo.detalles[0].campo, "nombre");
      assert.match(fallo.detalles[0].mensaje, /2099-06-01 al 2099-12-31/);
      assert.equal(creadas.length, 0);
      assert.equal(plantillas.asegurarEmpleado.mock.calls.length, 0);
    });

    it("con el mismo nombre en un área o un periodo distinto no hay conflicto y se guarda", async () => {
      await servicioPlantillas.crear(EMPLEADO, datosPlantilla({ id_departamento: OTRO_DEPARTAMENTO }));
      await servicioPlantillas.crear(EMPLEADO, datosPlantilla({ vigencia_desde: "2100-01-01", vigencia_hasta: "2100-12-31" }));
      assert.equal(creadas.length, 2);
      assert.equal(creadas[0].idDepartamento, OTRO_DEPARTAMENTO);
      assert.equal(creadas[1].vigenciaDesde, "2100-01-01");
    });

    it("si dos solicitudes chocan a la vez, la restricción de la base también se muestra como duplicidad", async () => {
      mock.method(plantillas, "crear", async () => {
        throw errorDeBase("23P01");
      });
      const fallo = await error(servicioPlantillas.crear(EMPLEADO, datosPlantilla()));
      assert.equal(fallo.estado, 409);
      assert.equal(fallo.detalles[0].campo, "nombre");
    });

    it("cualquier otro error de la base no se disfraza de duplicidad", async () => {
      mock.method(plantillas, "crear", async () => {
        throw errorDeBase("23503");
      });
      const fallo = await error(servicioPlantillas.crear(EMPLEADO, datosPlantilla()));
      assert.equal(fallo.code, "23503");
      assert.equal(fallo.estado, undefined);
    });
  });

  describe("al editar", () => {
    it("ignora a la propia plantilla al buscar coincidencias, para poder guardarla sin cambiar el nombre", async () => {
      await servicioPlantillas.actualizar(ID_PLANTILLA, datosPlantilla({ objetivo: "Otro objetivo." }));
      assert.equal(consultaDeDuplicada().excepto, ID_PLANTILLA);
      assert.equal(actualizadas.length, 1);
    });

    it("rechaza el cambio si el nuevo nombre y vigencia chocan con otra plantilla del área", async () => {
      existente = CHOQUE;
      const fallo = await error(servicioPlantillas.actualizar(ID_PLANTILLA, datosPlantilla({ nombre: "Evaluación de personal de tienda" })));
      assert.equal(fallo.estado, 409);
      assert.equal(actualizadas.length, 0);
    });

    it("también convierte el choque de la base en duplicidad", async () => {
      mock.method(plantillas, "actualizar", async () => {
        throw errorDeBase("23P01");
      });
      assert.equal((await error(servicioPlantillas.actualizar(ID_PLANTILLA, datosPlantilla()))).estado, 409);
    });
  });
});

describe("RF-01: nombres únicos en el catálogo de competencias", () => {
  const fila = { id_competencia: ayudas.idCompetencia(1), nombre: "Orden", descripcion: null, tipo_codigo: "FACTOR_OPERATIVO", tipo_nombre: "Factor operativo", esta_activa: true };
  const cuerpo = { nombre: " Orden ", tipo: "FACTOR_OPERATIVO" };
  let creadas;

  beforeEach(() => {
    mock.restoreAll();
    creadas = [];
    mock.method(competencias, "buscarPorNombre", async () => null);
    mock.method(competencias, "crear", async (datos) => {
      creadas.push(datos);
      return fila.id_competencia;
    });
    mock.method(competencias, "obtener", async () => fila);
  });

  it("crea la competencia con el nombre limpio y devuelve su ficha", async () => {
    const resultado = await servicioCompetencias.crear(cuerpo);
    assert.equal(competencias.buscarPorNombre.mock.calls[0].arguments[0], "Orden");
    assert.equal(creadas.length, 1);
    assert.deepEqual(resultado, {
      id_competencia: fila.id_competencia,
      nombre: "Orden",
      descripcion: null,
      tipo_codigo: "FACTOR_OPERATIVO",
      tipo_nombre: "Factor operativo",
      esta_activa: true,
    });
  });

  it("responde 409 si ya existe una con ese nombre, sin importar mayúsculas o espacios, y no la crea", async () => {
    mock.method(competencias, "buscarPorNombre", async () => ({ id_competencia: fila.id_competencia, nombre: "orden" }));
    const fallo = await error(servicioCompetencias.crear(cuerpo));
    assert.equal(fallo.estado, 409);
    assert.equal(fallo.detalles[0].campo, "nombre");
    assert.equal(creadas.length, 0);
  });

  it("si la base detecta el nombre repetido en el último momento, también responde 409", async () => {
    mock.method(competencias, "crear", async () => {
      throw errorDeBase("23505");
    });
    assert.equal((await error(servicioCompetencias.crear(cuerpo))).estado, 409);
  });

  it("no consulta ni guarda nada si los datos no son válidos", async () => {
    const fallo = await error(servicioCompetencias.crear({ nombre: "", tipo: "x" }));
    assert.equal(fallo.estado, 400);
    assert.equal(competencias.buscarPorNombre.mock.calls.length, 0);
  });
});
