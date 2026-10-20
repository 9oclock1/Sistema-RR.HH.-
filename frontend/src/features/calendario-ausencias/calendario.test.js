// KAN-55 / KAN-262: lógica del calendario y rendimiento con ausencias masivas.
// Se ejecuta con: node --test src/features/calendario-ausencias/calendario.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  diasDelRango,
  diaDeSemana,
  filtrarTipos,
  hoyEnBolivia,
  indexarDias,
  indexarPorDia,
  inicioDeSemana,
  moverAncla,
  rangoDeVista,
  sumarDias,
  textoDeAlerta,
  tituloDeVista,
  visualDeTipo,
} from "./calendario.js";

const ausencia = (id, tipo, inicio, fin, nombre = id) => ({
  clave: id,
  tipo: { codigo: tipo, nombre: tipo },
  empleado: { id_empleado: id, nombre_completo: nombre },
  fecha_inicio: inicio,
  fecha_fin: fin,
});

test("las semanas empiezan en lunes", () => {
  // 2026-11-04 es miércoles.
  assert.equal(diaDeSemana("2026-11-04"), 2);
  assert.equal(inicioDeSemana("2026-11-04"), "2026-11-02");
  assert.equal(inicioDeSemana("2026-11-02"), "2026-11-02");
  assert.equal(inicioDeSemana("2026-11-08"), "2026-11-02");
});

test("sumar días cruza fin de mes y de año sin correr el día", () => {
  assert.equal(sumarDias("2026-12-31", 1), "2027-01-01");
  assert.equal(sumarDias("2028-02-28", 1), "2028-02-29");
  assert.equal(sumarDias("2026-03-01", -1), "2026-02-28");
});

test("criterio 1: el mes se pide con las semanas completas que lo cubren", () => {
  // Noviembre de 2026 empieza en domingo y termina en lunes: 6 renglones.
  assert.deepEqual(rangoDeVista("mes", "2026-11-18"), { desde: "2026-10-26", hasta: "2026-12-06" });
  // Febrero de 2027 empieza en lunes y termina en domingo: exactamente 4 semanas.
  assert.deepEqual(rangoDeVista("mes", "2027-02-10"), { desde: "2027-02-01", hasta: "2027-02-28" });
  for (const ancla of ["2026-01-15", "2026-06-30", "2026-11-18", "2028-02-29"]) {
    const { desde, hasta } = rangoDeVista("mes", ancla);
    const dias = diasDelRango(desde, hasta).length;
    assert.equal(dias % 7, 0);
    assert.ok(dias <= 42);
  }
});

test("criterio 1: la vista semanal es de lunes a domingo y la diaria, un solo día", () => {
  assert.deepEqual(rangoDeVista("semana", "2026-11-04"), { desde: "2026-11-02", hasta: "2026-11-08" });
  assert.deepEqual(rangoDeVista("dia", "2026-11-04"), { desde: "2026-11-04", hasta: "2026-11-04" });
});

test("navegar mueve un mes, una semana o un día y respeta meses más cortos", () => {
  assert.equal(moverAncla("mes", "2026-11-18", 1), "2026-12-18");
  assert.equal(moverAncla("mes", "2026-12-18", 1), "2027-01-18");
  assert.equal(moverAncla("mes", "2026-01-31", 1), "2026-02-28");
  assert.equal(moverAncla("mes", "2026-03-31", -1), "2026-02-28");
  assert.equal(moverAncla("semana", "2026-11-04", 1), "2026-11-11");
  assert.equal(moverAncla("semana", "2026-11-04", -1), "2026-10-28");
  assert.equal(moverAncla("dia", "2026-11-30", 1), "2026-12-01");
});

test("el título de cada vista está en español", () => {
  assert.equal(tituloDeVista("mes", "2026-11-18"), "Noviembre de 2026");
  assert.match(tituloDeVista("semana", "2026-11-04"), /2 nov.* – 8 nov.* de 2026/);
  assert.match(tituloDeVista("dia", "2026-11-04"), /^Miércoles, 4 de noviembre de 2026$/);
});

test("hoy se calcula con la hora de Bolivia, no la del navegador", () => {
  // 02:00 UTC del día 5 todavía es el día 4 en Bolivia (UTC-4).
  assert.equal(hoyEnBolivia(new Date("2026-11-05T02:00:00Z")), "2026-11-04");
  assert.equal(hoyEnBolivia(new Date("2026-11-05T05:00:00Z")), "2026-11-05");
});

test("criterio 2: cada tipo tiene su propio color y los desconocidos uno neutro", () => {
  const clases = ["VACACIONES", "MEDICA", "MATERNIDAD", "PATERNIDAD", "DUELO", "ACADEMICA", "PERSONAL"].map((t) => visualDeTipo(t).clase);
  assert.equal(new Set(clases).size, clases.length);
  assert.equal(visualDeTipo("NUEVO_TIPO").clase, "otro");
  assert.ok(visualDeTipo("MEDICA").abreviatura.length > 0);
});

test("indexa cada ausencia en todos los días que cubre dentro del rango", () => {
  const porDia = indexarPorDia(
    [ausencia("a", "VACACIONES", "2026-11-03", "2026-11-05"), ausencia("b", "MEDICA", "2026-11-04", "2026-11-04")],
    "2026-11-02",
    "2026-11-08"
  );
  assert.equal(porDia.get("2026-11-02"), undefined);
  assert.equal(porDia.get("2026-11-03").length, 1);
  assert.equal(porDia.get("2026-11-04").length, 2);
  assert.equal(porDia.get("2026-11-05").length, 1);
  assert.equal(porDia.get("2026-11-06"), undefined);
});

test("una ausencia que empieza antes o termina después del rango solo se indexa dentro de él", () => {
  const porDia = indexarPorDia([ausencia("a", "VACACIONES", "2026-10-01", "2027-01-31")], "2026-11-02", "2026-11-04");
  assert.deepEqual([...porDia.keys()], ["2026-11-02", "2026-11-03", "2026-11-04"]);
});

test("las ausencias de un día salen ordenadas por tipo y luego por nombre", () => {
  const porDia = indexarPorDia(
    [
      ausencia("1", "VACACIONES", "2026-11-03", "2026-11-03", "Zoila"),
      ausencia("2", "MEDICA", "2026-11-03", "2026-11-03", "Ximena"),
      ausencia("3", "VACACIONES", "2026-11-03", "2026-11-03", "Ana"),
    ],
    "2026-11-03",
    "2026-11-03"
  );
  assert.deepEqual(porDia.get("2026-11-03").map((a) => a.empleado.nombre_completo), ["Ximena", "Ana", "Zoila"]);
});

test("apagar un tipo en la leyenda lo quita sin tocar los demás", () => {
  const lista = [ausencia("a", "VACACIONES", "2026-11-03", "2026-11-03"), ausencia("b", "MEDICA", "2026-11-03", "2026-11-03")];
  assert.equal(filtrarTipos(lista, new Set()), lista);
  assert.deepEqual(filtrarTipos(lista, new Set(["MEDICA"])).map((a) => a.clave), ["a"]);
});

test("criterio 3: el texto de la alerta explica el motivo", () => {
  const texto = textoDeAlerta({
    area: "Panadería",
    ausentes: 2,
    programados: 5,
    presentes: 3,
    porcentaje_ausentes: 40,
    max_ausentes_porcentaje: 30,
    min_presentes: 1,
    motivos: ["PORCENTAJE"],
  });
  assert.equal(texto, "Panadería: 2 de 5 ausentes; falta el 40 % (tolera 30 %)");
  assert.match(
    textoDeAlerta({ area: "Cajas", ausentes: 3, programados: 4, presentes: 1, porcentaje_ausentes: 75, max_ausentes_porcentaje: 80, min_presentes: 2, motivos: ["MINIMO_PRESENTES"] }),
    /quedan 1 presentes \(mínimo 2\)/
  );
});

test("indexarDias permite buscar el estado de cobertura de un día", () => {
  const dias = indexarDias([{ fecha: "2026-11-03", baja_cobertura: true }, { fecha: "2026-11-04", baja_cobertura: false }]);
  assert.equal(dias.get("2026-11-03").baja_cobertura, true);
  assert.equal(dias.get("2026-11-09"), undefined);
});

// ---- KAN-262: rendimiento del renderizado mensual con ausencias masivas ----
const masivas = (total) =>
  Array.from({ length: total }, (_, i) =>
    ausencia(`e${i}`, ["VACACIONES", "MEDICA", "DUELO", "ACADEMICA", "PERSONAL"][i % 5], sumarDias("2026-10-26", (i * 3) % 38), sumarDias("2026-10-26", ((i * 3) % 38) + (i % 10)), `Colaborador ${i}`)
  );

test("rendimiento: indexar 5 000 ausencias en la cuadrícula mensual toma menos de 300 ms", () => {
  const { desde, hasta } = rangoDeVista("mes", "2026-11-18");
  const ausencias = masivas(5000);

  const inicio = performance.now();
  const porDia = indexarPorDia(ausencias, desde, hasta);
  const ms = performance.now() - inicio;

  assert.equal(porDia.size, 42);
  assert.ok(ms < 300, `tardó ${ms.toFixed(0)} ms`);
});

test("rendimiento: filtrar por tipo 5 000 ausencias e indexarlas de nuevo es instantáneo (menos de 300 ms)", () => {
  const { desde, hasta } = rangoDeVista("mes", "2026-11-18");
  const ausencias = masivas(5000);

  const inicio = performance.now();
  const visibles = filtrarTipos(ausencias, new Set(["DUELO", "PERSONAL"]));
  const porDia = indexarPorDia(visibles, desde, hasta);
  const ms = performance.now() - inicio;

  assert.ok(visibles.length < ausencias.length);
  assert.ok([...porDia.values()].every((lista) => lista.every((a) => !["DUELO", "PERSONAL"].includes(a.tipo.codigo))));
  assert.ok(ms < 300, `tardó ${ms.toFixed(0)} ms`);
});
