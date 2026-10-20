const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../app");
const {
  calcularAfinidad,
  similitudCoseno,
  similitudLexica,
  detectarNivelEducacionMaximo,
} = require("../utils/affinityCalculator");

describe("RF-12: Algoritmo de comparación y matching de CV vs requisitos (QA & Edge Cases)", () => {
  // Vacante de referencia
  const vacanteSenior = {
    titulo_puesto: "Desarrollador Backend Senior",
    nivel_educacion_min: "LICENCIATURA",
    year_experiencia_min: 4.0,
    habilidades_clave_requeridas: ["Node.js", "PostgreSQL", "Docker", "AWS"],
  };

  describe("Criterio 1: Ponderación y cálculo del porcentaje de afinidad", () => {
    it("Debe otorgar 100% de afinidad a un candidato que cumple o supera todos los requisitos", async () => {
      const cvIdeal = {
        estadoExtraccion: "EXITOSA",
        educacion: [
          {
            institucion: "Universidad Católica",
            titulo: "Licenciatura en Informática",
            anioFin: 2020,
          },
        ],
        aniosExperienciaEstimados: 6,
        destrezasTecnicas: [
          "NodeJS",
          "PostgreSQL",
          "Docker",
          "AWS",
          "Git",
          "Linux",
        ],
      };

      const resultado = await calcularAfinidad({
        convocatoria: vacanteSenior,
        datosCv: cvIdeal,
      });

      assert.equal(resultado.porcentajeTotal, 100);
      assert.equal(resultado.esApto, true);
      assert.equal(resultado.educacion.cumple, true);
      assert.equal(resultado.experiencia.cumple, true);
      assert.equal(resultado.habilidades.totalCumplidas, 4);
    });

    it("Debe tolerar vacantes que no exigen experiencia previa (0 años) sin divisiones por cero", async () => {
      const vacanteJunior = {
        nivel_educacion_min: "TECNICO_SUPERIOR",
        year_experiencia_min: 0.0,
        habilidades_clave_requeridas: ["JavaScript"],
      };

      const cvSinExperiencia = {
        estadoExtraccion: "EXITOSA",
        educacion: [
          { titulo: "Técnico Superior en Sistemas", institucion: "Instituto" },
        ],
        aniosExperienciaEstimados: 0,
        destrezasTecnicas: ["JavaScript"],
      };

      const resultado = await calcularAfinidad({
        convocatoria: vacanteJunior,
        datosCv: cvSinExperiencia,
      });

      assert.equal(resultado.experiencia.porcentajeObtenido, 100);
      assert.equal(Number.isNaN(resultado.porcentajeTotal), false);
      assert.equal(resultado.porcentajeTotal, 100);
    });

    it("No debe castigar al candidato por tener destrezas técnicas adicionales a las requeridas", async () => {
      const cvConMuchasHabilidades = {
        estadoExtraccion: "EXITOSA",
        educacion: [
          { titulo: "Ingeniería de Sistemas", institucion: "Universidad" },
        ],
        aniosExperienciaEstimados: 5,
        destrezasTecnicas: [
          "Node.js",
          "PostgreSQL",
          "Docker",
          "AWS",
          "Python",
          "FastAPI",
          "React",
          "Vue",
          "Kubernetes",
          "Redis",
        ],
      };

      const resultado = await calcularAfinidad({
        convocatoria: vacanteSenior,
        datosCv: cvConMuchasHabilidades,
      });

      assert.equal(resultado.habilidades.totalCumplidas, 4);
      assert.equal(resultado.habilidades.porcentajeObtenido, 100);
      assert.equal(resultado.habilidades.habilidadesExtraCandidato.length, 6);
    });
  });

  describe("Clasificación de Grados y Equivalencias de Titulación", () => {
    it("Debe clasificar Ingeniería como equivalente a Licenciatura (orden 4)", () => {
      const nivel = detectarNivelEducacionMaximo([
        { titulo: "Ingeniería de Sistemas", institucion: "UCB" },
      ]);
      assert.equal(nivel.codigo, "LICENCIATURA");
      assert.equal(nivel.orden, 4);
    });

    it("Debe seleccionar el grado más alto cuando el candidato tiene múltiples títulos", () => {
      const nivel = detectarNivelEducacionMaximo([
        { titulo: "Bachiller en Humanidades", institucion: "Colegio" },
        {
          titulo: "Licenciatura en Administración de Empresas",
          institucion: "Universidad",
        },
        {
          titulo: "Maestría en Finanzas Corporativas",
          institucion: "Escuela de Negocios",
        },
      ]);
      assert.equal(nivel.codigo, "MAESTRIA");
      assert.equal(nivel.orden, 5);
    });
  });

  describe("Criterio 2: Desglose por dimensiones y soporte de pesos", () => {
    it("Debe calcular correctamente el desglose con pesos personalizados (50% Habilidades, 30% Exp, 20% Edu)", async () => {
      const pesosPersonalizados = {
        pesoEducacion: 20,
        pesoExperiencia: 30,
        pesoHabilidades: 50,
      };

      const cvMedio = {
        estadoExtraccion: "EXITOSA",
        educacion: [{ titulo: "Licenciatura", institucion: "Universidad" }], // 100% de 20 = 20 pts
        aniosExperienciaEstimados: 2, // 2 de 4 = 50% de 30 = 15 pts
        destrezasTecnicas: ["NodeJS", "PostgreSQL"], // 2 de 4 = 50% de 50 = 25 pts
      };

      const resultado = await calcularAfinidad({
        convocatoria: vacanteSenior,
        datosCv: cvMedio,
        pesosPersonalizados,
      });

      // 20 + 15 + 25 = 60%
      assert.equal(resultado.porcentajeTotal, 60);
      assert.equal(resultado.educacion.puntosAportados, 20);
      assert.equal(resultado.experiencia.puntosAportados, 15);
      assert.equal(resultado.habilidades.puntosAportados, 25);
      assert.equal(resultado.habilidades.incumplidas.includes("Docker"), true);
      assert.equal(resultado.habilidades.incumplidas.includes("AWS"), true);
    });
  });

  describe("Criterio 3: Requisito excluyente obligatorio y penalización visible", () => {
    it("Debe marcar condición no apta y penalizar afinidad si el candidato no alcanza el grado académico obligatorio", async () => {
      const cvBachiller = {
        estadoExtraccion: "EXITOSA",
        educacion: [
          { titulo: "Bachiller en Humanidades", institucion: "Colegio" },
        ],
        aniosExperienciaEstimados: 8, // Mucha experiencia
        destrezasTecnicas: ["Node.js", "PostgreSQL", "Docker", "AWS"], // Todas las habilidades
      };

      const resultado = await calcularAfinidad({
        convocatoria: vacanteSenior,
        datosCv: cvBachiller,
      });

      assert.equal(resultado.esApto, false);
      assert.equal(resultado.educacion.cumple, false);
      assert.ok(resultado.motivosNoApto.length > 0);
      assert.match(resultado.motivosNoApto[0], /nivel educativo mínimo/i);
      // Penalización visible: no puede superar 49%
      assert.ok(resultado.porcentajeTotal <= 49.0);
    });

    it("Debe marcar no apto si la vacante exige 4 años de experiencia y el candidato no registra experiencia laboral (0 años)", async () => {
      const cvSinExp = {
        estadoExtraccion: "EXITOSA",
        educacion: [
          { titulo: "Licenciatura en Informática", institucion: "Universidad" },
        ],
        aniosExperienciaEstimados: 0,
        destrezasTecnicas: ["Node.js", "PostgreSQL", "Docker", "AWS"],
      };

      const resultado = await calcularAfinidad({
        convocatoria: vacanteSenior,
        datosCv: cvSinExp,
      });

      assert.equal(resultado.esApto, false);
      assert.ok(
        resultado.motivosNoApto.some((m) => m.includes("experiencia laboral")),
      );
    });
  });

  describe("Resiliencia del Motor ante Datos Incompletos o Fallidos", () => {
    it("Debe responder de forma controlada (0% y no apto) si el CV no tiene extracción válida", async () => {
      const cvFallido = {
        estadoExtraccion: "FALLIDA",
        educacion: [],
        experienciaLaboral: [],
        aniosExperienciaEstimados: 0,
        destrezasTecnicas: [],
      };

      const resultado = await calcularAfinidad({
        convocatoria: vacanteSenior,
        datosCv: cvFallido,
      });

      assert.equal(resultado.porcentajeTotal, 0);
      assert.equal(resultado.esApto, false);
      assert.equal(resultado.motivosNoApto.length, 1);
    });

    it("Debe calcular similitud de coseno y similitud léxica sin lanzar excepciones ante cadenas vacías", () => {
      assert.equal(similitudCoseno([], []), 0);
      assert.equal(similitudCoseno([1, 0], [0, 1]), 0);
      assert.ok(Math.abs(similitudCoseno([1, 1], [1, 1]) - 1) < 1e-9);
      assert.equal(similitudLexica("", ""), 1);
      assert.equal(similitudLexica("React", "Angular"), 0);
    });
  });

  describe("Integración HTTP: Endpoint de afinidad (/postulaciones/:id/afinidad)", () => {
    it("Debe devolver 400 Bad Request si no se provee un ID de postulación válido", async () => {
      const res = await request(app).get("/postulaciones//afinidad");
      assert.ok([400, 404].includes(res.status));
    });

    it("Debe devolver 404 si la postulación consultada no existe en la base de datos", async () => {
      const res = await request(app).get(
        "/postulaciones/00000000-0000-0000-0000-000000000099/afinidad",
      );
      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      // Distingue "postulación inexistente" de "ruta no registrada" (ambas son 404).
      assert.match(res.body.message, /postulaci[oó]n/i);
      assert.doesNotMatch(res.body.message, /ruta no encontrada/i);
    });

    it("Debe tener registrados los endpoints de recálculo (404 por recurso inexistente, no por ruta)", async () => {
      const inexistente = "00000000-0000-0000-0000-000000000099";
      const rutas = [
        `/postulaciones/${inexistente}/recalcular-afinidad`,
        `/convocatorias/${inexistente}/recalcular-afinidad`,
      ];
      for (const ruta of rutas) {
        const res = await request(app).post(ruta);
        assert.equal(res.status, 404);
        assert.doesNotMatch(res.body.message, /ruta no encontrada/i);
      }
    });

    it("Debe rechazar con 400 un recálculo de convocatoria con pesos que no suman 100", async () => {
      const res = await request(app)
        .post("/convocatorias/00000000-0000-0000-0000-000000000099/recalcular-afinidad")
        .send({ pesoEducacion: 50, pesoExperiencia: 50, pesoHabilidades: 50 });
      assert.equal(res.status, 400);
    });

    it("Debe validar el filtro de rango de afinidad del listado de postulantes", async () => {
      const id = "00000000-0000-0000-0000-000000000099";
      const base = `/applicants/by-opening/${id}`;
      assert.equal((await request(app).get(`${base}?minAfinidad=abc`)).status, 400);
      assert.equal((await request(app).get(`${base}?minAfinidad=80&maxAfinidad=20`)).status, 400);
      assert.equal((await request(app).get(`${base}?maxAfinidad=150`)).status, 400);
    });
  });

  describe("Requisitos excluyentes proporcionales", () => {
    const vacante = {
      nivel_educacion_min: "LICENCIATURA",
      year_experiencia_min: 4,
      habilidades_clave_requeridas: [],
    };
    const cv = (anios, titulo = "Licenciatura en Informática") => ({
      estadoExtraccion: "EXITOSA",
      educacion: [{ titulo, institucion: "U" }],
      aniosExperienciaEstimados: anios,
      destrezasTecnicas: [],
    });

    it("No debe descartar a quien está cerca del mínimo de experiencia, solo ponderarlo", async () => {
      const cerca = await calcularAfinidad({ convocatoria: vacante, datosCv: cv(3) });
      assert.equal(cerca.esApto, true);
      assert.equal(cerca.experiencia.porcentajeObtenido, 75);
    });

    it("Debe marcar no apto y limitar a 49% a quien está lejos del mínimo de experiencia", async () => {
      const lejos = await calcularAfinidad({ convocatoria: vacante, datosCv: cv(1) });
      assert.equal(lejos.esApto, false);
      assert.ok(lejos.porcentajeTotal <= 49);
    });

    it("Debe puntuar más alto a quien está más cerca del mínimo", async () => {
      const a = await calcularAfinidad({ convocatoria: vacante, datosCv: cv(3) });
      const b = await calcularAfinidad({ convocatoria: vacante, datosCv: cv(2.5) });
      assert.ok(a.porcentajeTotal > b.porcentajeTotal);
    });

    it("No debe descartar a quien tiene un grado cercano al exigido (Técnico Superior vs Licenciatura)", async () => {
      const r = await calcularAfinidad({
        convocatoria: vacante,
        datosCv: cv(4, "Técnico Superior en Sistemas"),
      });
      assert.equal(r.esApto, true);
      assert.equal(r.educacion.cumple, false);
      assert.equal(r.educacion.porcentajeObtenido, 75);
    });

    it("Debe puntuar menos a quien cursa el grado que a quien lo terminó", async () => {
      const vacanteLic = { nivel_educacion_min: "LICENCIATURA", year_experiencia_min: 0, habilidades_clave_requeridas: [] };
      const calc = (titulo) =>
        calcularAfinidad({
          convocatoria: vacanteLic,
          datosCv: { estadoExtraccion: "EXITOSA", educacion: [{ titulo, institucion: "U" }], aniosExperienciaEstimados: 0, destrezasTecnicas: [] },
        });
      const terminado = await calc("Licenciatura en Informática");
      const cursando = await calc("Estudiante de Licenciatura en Informática");
      assert.equal(terminado.educacion.porcentajeObtenido, 100);
      assert.equal(terminado.educacion.cumple, true);
      assert.equal(cursando.educacion.enCurso, true);
      assert.equal(cursando.educacion.cumple, false);
      assert.equal(cursando.educacion.porcentajeObtenido, 75);
      assert.equal(cursando.esApto, true);
      assert.ok(cursando.porcentajeTotal < terminado.porcentajeTotal);
    });

    it("Debe preferir un grado concluido sobre uno en curso de valor equivalente", () => {
      const nivel = detectarNivelEducacionMaximo([
        { titulo: "Técnico Superior en Sistemas" },
        { titulo: "Estudiante de Licenciatura en Sistemas" },
      ]);
      assert.equal(nivel.enCurso, false);
      assert.equal(nivel.codigo, "TECNICO_SUPERIOR");
    });

    it("Debe contar como formación a quien está cursando o es estudiante del grado", () => {
      assert.equal(
        detectarNivelEducacionMaximo([{ titulo: "Estudiante de Ingeniería de Sistemas" }]).codigo,
        "LICENCIATURA",
      );
      assert.equal(
        detectarNivelEducacionMaximo([{ titulo: "Cursando Maestría en Finanzas" }]).codigo,
        "MAESTRIA",
      );
      assert.equal(
        detectarNivelEducacionMaximo([{ titulo: "Bachiller en Humanidades" }]).codigo,
        "BACHILLER",
      );
    });
  });

  describe("Compatibilidad con el extractor regex y umbrales por proveedor", () => {
    it("Debe detectar el grado cuando el extractor regex lo guarda en la institución", () => {
      const nivel = detectarNivelEducacionMaximo([
        {
          institucion: "Licenciatura en Ingenieria de Sistemas - Universidad Mayor de San Andres (2015)",
          titulo: "Grado académico detectado",
        },
      ]);
      assert.equal(nivel.codigo, "LICENCIATURA");
    });

    it("Debe permitir ajustar los umbrales de similitud por variables de entorno", async () => {
      const previo = { ...process.env };
      try {
        process.env.CV_PARSER_PROVIDER = "regex";
        const conv = { nivel_educacion_min: "BACHILLER", year_experiencia_min: 0, habilidades_clave_requeridas: ["Excel"] };
        const cv = { estadoExtraccion: "EXITOSA", educacion: [], aniosExperienciaEstimados: 0, destrezasTecnicas: ["Excel avanzado"] };
        // léxico: "Excel" vs "Excel avanzado" = 0.9, parcial con umbral exacto 0.95 y cumplida con 0.78
        process.env.AFFINITY_UMBRAL_EXACTO = "0.95";
        process.env.AFFINITY_UMBRAL_PARCIAL = "0.8";
        const parcial = await calcularAfinidad({ convocatoria: conv, datosCv: cv });
        assert.equal(parcial.habilidades.totalParciales, 1);
        delete process.env.AFFINITY_UMBRAL_EXACTO;
        delete process.env.AFFINITY_UMBRAL_PARCIAL;
        const completa = await calcularAfinidad({ convocatoria: conv, datosCv: cv });
        assert.equal(completa.habilidades.totalCumplidas, 1);
        assert.equal(completa.habilidades.totalParciales, 0);
      } finally {
        process.env.CV_PARSER_PROVIDER = previo.CV_PARSER_PROVIDER;
        delete process.env.AFFINITY_UMBRAL_EXACTO;
        delete process.env.AFFINITY_UMBRAL_PARCIAL;
      }
    });
  });

  describe("Comparación léxica de habilidades (sin embeddings)", () => {
    it("No debe confundir habilidades distintas que comparten letras", () => {
      assert.equal(similitudLexica("C", "Excel"), 0);
      assert.equal(similitudLexica("R", "PowerPoint"), 0);
      assert.equal(similitudLexica("SQL", "NoSQL"), 0);
      assert.equal(similitudLexica("Java", "JavaScript"), 0);
      assert.equal(similitudLexica("C++", "C#"), 0);
    });

    it("Debe seguir reconociendo variantes de escritura y habilidades ampliadas", () => {
      assert.equal(similitudLexica("Node.js", "NodeJS"), 1);
      assert.equal(similitudLexica("Excel", "Excel avanzado"), 0.9);
    });
  });
});
