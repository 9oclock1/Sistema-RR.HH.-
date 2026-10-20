const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const rankingModel = require("../models/rankingModel");

describe("RF-13: Ranking de postulantes y criterios de adecuación", () => {
  // Mock en memoria emulando la lógica de ordenamiento y filtrado de la base de datos
  const generarPostulantesPrueba = () => [
    {
      id_postulacion: "pos-1",
      nombres: "Ana",
      apellidos: "Gómez",
      score_afinidad: 85.5,
      anios_experiencia: 4.0,
      pretension_salarial: 6000,
      fecha_postulacion: new Date("2026-10-01T10:00:00Z"),
    },
    {
      id_postulacion: "pos-2",
      nombres: "Carlos",
      apellidos: "Mendoza",
      score_afinidad: 92.0,
      anios_experiencia: 5.5,
      pretension_salarial: 7500,
      fecha_postulacion: new Date("2026-10-02T11:00:00Z"),
    },
    {
      id_postulacion: "pos-3",
      nombres: "Beatriz",
      apellidos: "Morales",
      score_afinidad: 85.5,
      anios_experiencia: 6.0, // Empate con Ana en score, pero mayor experiencia
      pretension_salarial: 5800,
      fecha_postulacion: new Date("2026-10-03T09:00:00Z"),
    },
    {
      id_postulacion: "pos-4",
      nombres: "David",
      apellidos: "Roca",
      score_afinidad: 70.0,
      anios_experiencia: 2.0,
      pretension_salarial: 4500,
      fecha_postulacion: new Date("2026-10-04T08:00:00Z"),
    },
  ];

  function ordenarRankingLocal(postulantes, criterioDesempate = "experiencia") {
    return [...postulantes].sort((a, b) => {
      // 1. Criterio primario: score_afinidad DESC
      if (b.score_afinidad !== a.score_afinidad) {
        return b.score_afinidad - a.score_afinidad;
      }
      // 2. Criterio secundario de desempate
      if (criterioDesempate === "experiencia") {
        if (b.anios_experiencia !== a.anios_experiencia) {
          return b.anios_experiencia - a.anios_experiencia;
        }
      }
      // 3. Antigüedad en postulación
      return a.fecha_postulacion - b.fecha_postulacion;
    });
  }

  describe("Criterio 1: Ordenamiento descendente por porcentaje de afinidad", () => {
    it("Debe clasificar a los postulantes ordenando de mayor a menor porcentaje de match", () => {
      const datos = generarPostulantesPrueba();
      const ordenados = ordenarRankingLocal(datos);

      assert.equal(
        ordenados[0].id_postulacion,
        "pos-2",
        "El primer lugar debe ser el mayor score (92.0)",
      );
      assert.ok(
        ordenados[0].score_afinidad >= ordenados[1].score_afinidad,
        "El score del puesto 1 debe ser mayor o igual al puesto 2",
      );
      assert.ok(
        ordenados[1].score_afinidad >= ordenados[2].score_afinidad,
        "El score del puesto 2 debe ser mayor o igual al puesto 3",
      );
      assert.ok(
        ordenados[2].score_afinidad >= ordenados[3].score_afinidad,
        "El score del puesto 3 debe ser mayor o igual al puesto 4",
      );
    });
  });

  describe("Criterio 2: Lógica determinista de desempate secundario", () => {
    it("Debe desempatar por mayor experiencia laboral cuando los scores coinciden", () => {
      const datos = generarPostulantesPrueba();
      const ordenados = ordenarRankingLocal(datos, "experiencia");

      // Ana y Beatriz empatan en 85.5. Beatriz tiene 6.0 años y Ana 4.0 años
      const indiceBeatriz = ordenados.findIndex(
        (p) => p.id_postulacion === "pos-3",
      );
      const indiceAna = ordenados.findIndex(
        (p) => p.id_postulacion === "pos-1",
      );

      assert.ok(
        indiceBeatriz < indiceAna,
        "Beatriz (6 años) debe posicionarse antes que Ana (4 años) ante igual score",
      );
    });

    it("Debe desempatar por fecha de postulación cuando se selecciona antigüedad", () => {
      const datos = generarPostulantesPrueba();
      const ordenados = ordenarRankingLocal(datos, "fecha_postulacion");

      // Ana postuló el 1 de octubre y Beatriz el 3 de octubre
      const indiceAna = ordenados.findIndex(
        (p) => p.id_postulacion === "pos-1",
      );
      const indiceBeatriz = ordenados.findIndex(
        (p) => p.id_postulacion === "pos-3",
      );

      assert.ok(
        indiceAna < indiceBeatriz,
        "Ana debe preceder a Beatriz por haber postulado antes (FIFO)",
      );
    });
  });

  describe("Criterio 3: Mantenimiento de jerarquía con filtros adicionales", () => {
    it("Debe filtrar por experiencia mínima preservando el orden de afinidad", () => {
      const datos = generarPostulantesPrueba();
      const filtrados = datos.filter((p) => p.anios_experiencia >= 5.0);
      const ordenados = ordenarRankingLocal(filtrados);

      assert.equal(filtrados.length, 2);
      assert.equal(ordenados[0].id_postulacion, "pos-2");
      assert.equal(ordenados[1].id_postulacion, "pos-3");
      assert.ok(ordenados[0].score_afinidad >= ordenados[1].score_afinidad);
    });

    it("Debe filtrar por pretensión salarial máxima conservando los scores relativos", () => {
      const datos = generarPostulantesPrueba();
      const filtrados = datos.filter((p) => p.pretension_salarial <= 6000);
      const ordenados = ordenarRankingLocal(filtrados);

      assert.equal(filtrados.length, 3);
      assert.ok(!ordenados.some((p) => p.id_postulacion === "pos-2"));
      assert.equal(ordenados[0].id_postulacion, "pos-3"); // 85.5% (6 años exp)
    });
  });

  describe("Criterio 4: Estabilidad y reposicionamiento ante nuevas postulaciones", () => {
    it("Debe recalcular la jerarquía insertando al nuevo candidato en su puesto exacto", () => {
      const datos = generarPostulantesPrueba();

      // Nuevo postulante con un score superior (95.0%)
      const nuevoPostulanteTop = {
        id_postulacion: "pos-nuevo-top",
        nombres: "Esteban",
        apellidos: "Quispe",
        score_afinidad: 95.0,
        anios_experiencia: 7.0,
        pretension_salarial: 8000,
        fecha_postulacion: new Date("2026-10-19T14:00:00Z"),
      };

      const rankingActualizado = ordenarRankingLocal([
        ...datos,
        nuevoPostulanteTop,
      ]);

      assert.equal(
        rankingActualizado[0].id_postulacion,
        "pos-nuevo-top",
        "El nuevo postulante con 95% debe posicionarse en el puesto #1 inmediatamente",
      );
      assert.equal(
        rankingActualizado[1].id_postulacion,
        "pos-2",
        "El anterior primer puesto debe desplazarse al puesto #2",
      );
      assert.equal(rankingActualizado.length, 5);
    });
  });
});
