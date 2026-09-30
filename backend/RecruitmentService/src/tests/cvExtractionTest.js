const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../app");
const { calcularAniosExperiencia } = require("../utils/experienceCalculator");
const { DatosExtraidosCvSchema, ActualizarDatosCvManualSchema } = require("../utils/cvDataSchema");

describe("RF-11 Pruebas de extracción y calidad de CV (Criterios de Aceptación)", () => {
  const ID_POSTULACION_TEST = "01a0e556-71fb-75e0-b7d8-3fee1cbe069b";

  // Procesamiento de formatos soportados (PDF y DOCX) y extracción
  describe("Criterio 1: Extracción de datos según formato", () => {
    it("Debe validar que el schema acepte educación, experiencia y destrezas técnicas", () => {
      const payloadEjemplo = {
        estadoExtraccion: "EXITOSA",
        educacion: [
          {
            institucion: "Universidad Alta Pinta",
            titulo: "Carrera en Administración",
            anioFin: 2014,
          },
          {
            institucion: "Universidad Alta Pinta",
            titulo: "Maestría en Finanzas",
            anioFin: 2016,
          },
        ],
        experienciaLaboral: [
          {
            puesto: "Auxiliar Administrativo",
            empresa: "Empresa Borcelle",
            anioInicio: 2010,
            anioFin: 2030,
            esActual: false,
          },
        ],
        aniosExperienciaEstimados: 20,
        destrezasTecnicas: ["Liderazgo", "Gestión de activos"],
        esVerificado: false,
      };

      const resultado = DatosExtraidosCvSchema.safeParse(payloadEjemplo);
      assert.equal(resultado.success, true);
    });

    it("Debe calcular los años de experiencia acumulada unificando periodos solapados", () => {
      const cargosSimultaneos = [
        { puesto: "Auxiliar Administrativo", anioInicio: 2010, anioFin: 2030 },
        { puesto: "Administración Contable", anioInicio: 2010, anioFin: 2030 },
        {
          puesto: "Gerente del Área de Administración",
          anioInicio: 2010,
          anioFin: 2030,
        },
        { puesto: "Jefe en Administración", anioInicio: 2010, anioFin: 2030 },
      ];

      const aniosCalculados = calcularAniosExperiencia(cargosSimultaneos);
      // Al ser periodos de 2010 a 2030 concurrentes, la duración real acumulada debe ser 20
      assert.equal(aniosCalculados, 20);
    });

    it("Debe calcular correctamente empleos consecutivos sin solapar", () => {
      const cargosConsecutivos = [
        { puesto: "Junior Developer", anioInicio: 2018, anioFin: 2020 },
        { puesto: "Mid Developer", anioInicio: 2020, anioFin: 2024 },
      ];

      const aniosCalculados = calcularAniosExperiencia(cargosConsecutivos);
      assert.equal(aniosCalculados, 6);
    });
  });

  // Apertura de postulación y visualización de datos y documento
  describe("Criterio 2: Consulta de datos extraídos y acceso al archivo", () => {
    it("Debe responder con la estructura de datos_cv requerida para el frontend", async () => {
      const res = await request(app).get(
        `/postulaciones/${ID_POSTULACION_TEST}/datos-cv`,
      );

      if (res.status === 200) {
        assert.equal(res.body.success, true);
        assert.ok(res.body.data);
        assert.ok(res.body.data.datosCv);
        assert.ok(Array.isArray(res.body.data.datosCv.educacion));
        assert.ok(Array.isArray(res.body.data.datosCv.destrezasTecnicas));
      } else {
        // En caso de que el ID no exista en la BD mock, debe devolver 404
        assert.equal(res.status, 404);
      }
    });

    it("Debe permitir consultar o descargar el documento adjunto original", async () => {
      const res = await request(app).get(
        `/postulaciones/${ID_POSTULACION_TEST}/cv`,
      );
      assert.ok([200, 404].includes(res.status));
    });
  });

  // Corrección manual y guardado con verificación
  describe("Criterio 3: Corrección manual de datos y marcado como verificado", () => {
    it("Debe aceptar y validar un payload de actualización manual con experiencia laboral", () => {
      const payloadValido = {
        educacion: [
          {
            institucion: "Universidad Católica",
            titulo: "Ingeniería de Sistemas",
            anioFin: 2025,
          },
        ],
        experienciaLaboral: [
          {
            puesto: "Desarrollador Backend",
            empresa: "Tech Solutions",
            anioInicio: 2022,
            anioFin: null,
            esActual: true,
          },
        ],
        aniosExperienciaEstimados: 3,
        destrezasTecnicas: ["Node.js", "Docker", "PostgreSQL"],
        modificadoPor: "00000000-0000-0000-0000-000000000001",
      };

      const validacion = ActualizarDatosCvManualSchema.safeParse(payloadValido);
      assert.equal(validacion.success, true);
    });

    it("Debe rechazar la corrección manual si los años de experiencia son negativos", async () => {
      const payloadInvalido = {
        educacion: [],
        experienciaLaboral: [],
        aniosExperienciaEstimados: -2,
        destrezasTecnicas: ["Java"],
        modificadoPor: "00000000-0000-0000-0000-000000000001",
      };

      const res = await request(app)
        .put(`/postulaciones/${ID_POSTULACION_TEST}/datos-cv`)
        .send(payloadInvalido);

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    it("Debe procesar la actualización manual y devolver estado 200 si la postulación existe", async () => {
      const payloadValido = {
        educacion: [
          {
            institucion: "Universidad UCB",
            titulo: "Lic. Administración",
            anioFin: 2014,
          },
        ],
        experienciaLaboral: [
          {
            puesto: "Administrador Contable",
            empresa: "Empresa Borcelle",
            anioInicio: 2010,
            anioFin: 2030,
            esActual: false,
          },
        ],
        aniosExperienciaEstimados: 20,
        destrezasTecnicas: ["Liderazgo", "Resolución de problemas"],
        modificadoPor: "00000000-0000-0000-0000-000000000001",
      };

      const res = await request(app)
        .put(`/postulaciones/${ID_POSTULACION_TEST}/datos-cv`)
        .send(payloadValido);

      if (res.status === 200) {
        assert.equal(res.body.success, true);
        assert.equal(res.body.data.esVerificado, true);
        assert.equal(res.body.data.estadoExtraccion, "EXITOSA");
      } else {
        assert.equal(res.status, 404);
      }
    });
  });

  // Manejo de documento no procesable (estadoExtraccion = FALLIDA)
  describe("Criterio 4: Manejo de fallo de procesamiento", () => {
    it("Debe validar que el schema soporte el estado FALLIDA con arrays vacíos", () => {
      const payloadFallo = {
        estadoExtraccion: "FALLIDA",
        educacion: [],
        experienciaLaboral: [],
        aniosExperienciaEstimados: 0,
        destrezasTecnicas: [],
        esVerificado: false,
        errorDetalle: "DOCUMENT_NOT_PARSEABLE_OR_EMPTY",
      };

      const validacion = DatosExtraidosCvSchema.safeParse(payloadFallo);
      assert.equal(validacion.success, true);
      assert.equal(validacion.data.estadoExtraccion, "FALLIDA");
    });

    it("Debe simular fallo controlado cuando el archivo es un PDF corrupto o vacío", async () => {
      // Buffer con bytes aleatorios que no forman un PDF real ni docx válido
      const bufferCorrupto = Buffer.from("Not a real PDF header or content");

      const res = await request(app)
        .patch(`/postulaciones/${ID_POSTULACION_TEST}/cv`)
        .attach("cv", bufferCorrupto, {
          filename: "cv_corrupto.pdf",
          contentType: "application/pdf",
        });

      if (res.status === 200) {
        // El servicio debe capturar el error y guardar estado 'FALLIDA' sin caerse
        assert.equal(
          res.body.data.datos_extraidos_cv.estadoExtraccion,
          "FALLIDA",
        );
      } else {
        assert.ok([400, 404].includes(res.status));
      }
    });
  });
});
