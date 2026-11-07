const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

// El modelo se prueba contra un pool simulado: se captura el SQL y los parámetros que enviaría a PostgreSQL.
const rutaPool = require.resolve(path.join(__dirname, "../../db/pool"));
const consultas = [];
let respuestas = [];
require.cache[rutaPool] = {
  id: rutaPool,
  filename: rutaPool,
  loaded: true,
  exports: {
    query: async (sql, valores) => {
      consultas.push({ sql, valores });
      return respuestas.shift() ?? { rows: [] };
    },
  },
};

const rankingModel = require("../models/rankingModel");
const { validarConsultaRanking } = require("../validators/rankingValidator");

function validar(query) {
  const req = { query };
  let error = null;
  validarConsultaRanking(req, {}, (e) => {
    error = e ?? null;
  });
  return { req, error };
}

describe("RF-13: Ranking de postulantes por porcentaje de afinidad", () => {
  beforeEach(() => {
    consultas.length = 0;
    respuestas = [];
  });

  describe("Cableado del servicio", () => {
    it("El archivo de rutas existe con el nombre que importa app.js", () => {
      assert.doesNotThrow(() => require("../routes/rankingRoutes"));
    });
  });

  describe("Criterio 1: orden descendente por afinidad", () => {
    it("Ordena por porcentaje_afinidad DESC con los nulos al final y numera con ROW_NUMBER", async () => {
      respuestas = [{ rows: [{ total: "0" }] }, { rows: [] }];
      await rankingModel.obtenerRankingPorConvocatoria("conv-1");

      const sql = consultas[1].sql;
      assert.match(sql, /p\.porcentaje_afinidad AS score_afinidad/);
      assert.doesNotMatch(sql, /p\.score_afinidad/);
      assert.match(sql, /ROW_NUMBER\(\) OVER \(ORDER BY score_afinidad DESC NULLS LAST,/);
    });

    it("Devuelve score nulo (no 0%) para un postulante sin análisis de CV", async () => {
      respuestas = [
        { rows: [{ total: "1" }] },
        { rows: [{ posicion_ranking: "1", score_afinidad: null, anios_experiencia: "0", nombres: "Fabio" }] },
      ];
      const { postulantes } = await rankingModel.obtenerRankingPorConvocatoria("conv-1");
      assert.equal(postulantes[0].score_afinidad, null);
      assert.equal(postulantes[0].posicion_ranking, 1);
    });
  });

  describe("Criterio 2: desempate secundario determinista", () => {
    it("La cláusula usa solo columnas del CTE (sin alias de tabla) y termina en un desempate estable", () => {
      for (const criterio of ["experiencia", "fecha_postulacion", "educacion"]) {
        for (const orden of ["asc", "desc"]) {
          const clausula = rankingModel.construirClausulaDesempate(criterio, orden);
          assert.doesNotMatch(clausula, /\bp\./, `${criterio}/${orden} no debe usar el alias p.`);
          assert.match(clausula, /id_postulacion ASC$/);
        }
      }
    });

    it("Experiencia: respeta el sentido pedido y desempata después por antigüedad", () => {
      assert.match(rankingModel.construirClausulaDesempate("experiencia", "desc"), /^anios_experiencia DESC, fecha_postulacion ASC/);
      assert.match(rankingModel.construirClausulaDesempate("experiencia", "asc"), /^anios_experiencia ASC/);
    });

    it("Educación: ordena por el nivel detectado del CV (códigos de nivelesEducacion)", async () => {
      respuestas = [{ rows: [{ total: "0" }] }, { rows: [] }];
      await rankingModel.obtenerRankingPorConvocatoria("conv-1", { desempate: "educacion" });
      const sql = consultas[1].sql;
      assert.match(sql, /'afinidadDetalle'->'educacion'->>'nivelDetectado'/);
      for (const codigo of ["DOCTORADO", "MAESTRIA", "LICENCIATURA", "TECNICO_SUPERIOR", "TECNICO_MEDIO", "BACHILLER"]) {
        assert.match(sql, new RegExp(`WHEN '${codigo}'`));
      }
      assert.match(sql, /nivel_educacion_orden DESC, anios_experiencia DESC/);
    });

    it("Por defecto, la fecha de postulación favorece a quien postuló primero (asc)", () => {
      const { req, error } = validar({ desempate: "fecha_postulacion" });
      assert.equal(error, null);
      assert.equal(req.querySanitizada.orden_desempate, "asc");
    });

    it("Experiencia y educación son descendentes por defecto", () => {
      assert.equal(validar({}).req.querySanitizada.orden_desempate, "desc");
      assert.equal(validar({ desempate: "educacion" }).req.querySanitizada.orden_desempate, "desc");
    });
  });

  describe("Criterio 3: filtros que mantienen la jerarquía de afinidad", () => {
    it("Los filtros restringen el conjunto, y el conteo y la consulta comparten los mismos parámetros", async () => {
      respuestas = [{ rows: [{ total: "0" }] }, { rows: [] }];
      await rankingModel.obtenerRankingPorConvocatoria("conv-1", {
        experiencia_min: 5,
        ciudad: "La Paz",
        etapa: "2",
        pagina: 2,
        limite: 5,
      });
      const [conteo, listado] = consultas;
      assert.deepEqual(conteo.valores, ["conv-1", 5, "2", "La Paz"]);
      assert.deepEqual(listado.valores, ["conv-1", 5, "2", "La Paz", 5, 5]);
      assert.match(listado.sql, /anios_experiencia >= \$2/);
      assert.match(listado.sql, /id_etapa::text = \$3/);
      assert.match(listado.sql, /LOWER\(ciudad\) = LOWER\(\$4\)/);
      assert.match(listado.sql, /LIMIT \$5 OFFSET \$6/);
      // El orden por afinidad se aplica igual con o sin filtros.
      assert.match(listado.sql, /ORDER BY score_afinidad DESC NULLS LAST/);
    });

    it("Sin filtros solo se envía el id de la convocatoria", async () => {
      respuestas = [{ rows: [{ total: "0" }] }, { rows: [] }];
      await rankingModel.obtenerRankingPorConvocatoria("conv-1");
      assert.deepEqual(consultas[0].valores, ["conv-1"]);
    });

    it("Rechaza criterios, órdenes, experiencia y paginación inválidos", () => {
      assert.ok(validar({ desempate: "foo" }).error);
      assert.ok(validar({ orden_desempate: "x" }).error);
      assert.ok(validar({ experiencia_min: "-1" }).error);
      assert.ok(validar({ pagina: "1.5" }).error);
      assert.ok(validar({ pagina: "0" }).error);
      assert.ok(validar({ limite: "500" }).error);
      assert.equal(validar({ experiencia_min: "2", pagina: "3", limite: "20" }).error, null);
    });
  });

  describe("Criterio 4: el ranking se calcula en cada consulta", () => {
    it("No depende de posicion_ranking guardada: un postulante nuevo entra en su puesto al refrescar", async () => {
      respuestas = [{ rows: [{ total: "0" }] }, { rows: [] }];
      await rankingModel.obtenerRankingPorConvocatoria("conv-1");
      assert.doesNotMatch(consultas[1].sql, /p\.posicion_ranking/);
      assert.match(consultas[1].sql, /ROW_NUMBER\(\)/);
    });
  });
});
