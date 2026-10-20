// KAN-35 (RF-15.6): reglas de la agenda de entrevistas en la vista (hora de La Paz, cruces y calendario semanal).
import { describe, expect, it } from "vitest";
import {
  citasQueSeCruzan,
  diasDeSemana,
  distribuirPorDia,
  esAgendable,
  esUrlValida,
  formatearCita,
  lunesDe,
  partesLocales,
  sumarDias,
  tituloSemana,
} from "./reglasEntrevista";

const cita = (id, isoInicio, duracion = 60, codigo_estado = "PROGRAMADA") => ({
  id_entrevista: id,
  fecha_hora_programada: isoInicio,
  duracion_minutos: duracion,
  codigo_estado,
});

describe("Fechas en hora de La Paz", () => {
  it("separa fecha y hora locales sin depender de la zona del navegador", () => {
    expect(partesLocales("2030-03-16T02:30:00Z")).toEqual({ fecha: "2030-03-15", hora: "22:30" });
    expect(partesLocales("2030-03-15T14:00:00Z")).toEqual({ fecha: "2030-03-15", hora: "10:00" });
  });

  it("calcula la semana de lunes a domingo", () => {
    expect(lunesDe("2030-03-15")).toBe("2030-03-11");
    expect(lunesDe("2030-03-17")).toBe("2030-03-11");
    expect(lunesDe("2030-03-11")).toBe("2030-03-11");
    expect(diasDeSemana("2030-03-11")).toEqual([
      "2030-03-11", "2030-03-12", "2030-03-13", "2030-03-14", "2030-03-15", "2030-03-16", "2030-03-17",
    ]);
    expect(sumarDias("2030-02-28", 1)).toBe("2030-03-01");
  });

  it("titula la semana, también cuando cruza de mes", () => {
    expect(tituloSemana("2030-03-11")).toBe("11 – 17 de marzo de 2030");
    expect(tituloSemana("2030-03-25")).toBe("25 – 31 de marzo de 2030");
    expect(tituloSemana("2030-04-29")).toMatch(/29 abr.* – 5 may.* 2030/);
  });

  it("muestra la cita con su rango horario", () => {
    expect(formatearCita({ ...cita("a", "2030-03-15T14:00:00Z", 45) })).toMatch(/15 mar.* 2030 · 10:00–10:45$/);
  });
});

describe("Cruces con la agenda del evaluador", () => {
  const agenda = [cita("a", "2030-03-15T14:00:00Z"), cita("b", "2030-03-15T18:00:00Z", 30, "CANCELADA")];

  it("detecta el cruce con una cita vigente del mismo día", () => {
    expect(citasQueSeCruzan(agenda, { fecha: "2030-03-15", hora: "10:30", duracion: "60" }).map((c) => c.id_entrevista)).toEqual(["a"]);
    expect(citasQueSeCruzan(agenda, { fecha: "2030-03-15", hora: "09:30", duracion: "60" })).toHaveLength(1);
  });

  it("no cuenta las que solo se tocan, las canceladas, otros días ni la propia cita", () => {
    expect(citasQueSeCruzan(agenda, { fecha: "2030-03-15", hora: "11:00", duracion: "60" })).toEqual([]);
    expect(citasQueSeCruzan(agenda, { fecha: "2030-03-15", hora: "09:00", duracion: "60" })).toEqual([]);
    expect(citasQueSeCruzan(agenda, { fecha: "2030-03-15", hora: "14:00", duracion: "30" })).toEqual([]);
    expect(citasQueSeCruzan(agenda, { fecha: "2030-03-16", hora: "10:00", duracion: "60" })).toEqual([]);
    expect(citasQueSeCruzan(agenda, { fecha: "2030-03-15", hora: "10:00", duracion: "60", excluirId: "a" })).toEqual([]);
  });
});

describe("Calendario semanal", () => {
  it("pone lado a lado las citas que se cruzan y a lo ancho las que no", () => {
    const porDia = distribuirPorDia([
      cita("a", "2030-03-15T14:00:00Z", 60),
      cita("b", "2030-03-15T14:30:00Z", 60),
      cita("c", "2030-03-15T16:00:00Z", 30),
      cita("d", "2030-03-16T14:00:00Z", 30),
    ]);
    const viernes = Object.fromEntries(porDia.get("2030-03-15").map((i) => [i.cita.id_entrevista, [i.carril, i.carriles]]));
    expect(viernes).toEqual({ a: [0, 2], b: [1, 2], c: [0, 1] });
    expect(porDia.get("2030-03-16")[0]).toMatchObject({ inicio: 600, fin: 630, carril: 0, carriles: 1 });
  });
});

describe("Reglas del formulario", () => {
  it("solo agenda a postulantes en entrevista técnica o apto que no estén archivados", () => {
    expect(esAgendable({ codigo_etapa: "APTO" })).toBe(true);
    expect(esAgendable({ codigo_etapa: "ENTREVISTA_TECNICA" })).toBe(true);
    expect(esAgendable({ codigo_etapa: "EN_REVISION" })).toBe(false);
    expect(esAgendable({ codigo_etapa: "APTO", esta_archivada: true })).toBe(false);
  });

  it("exige un enlace http(s) para la modalidad virtual", () => {
    expect(esUrlValida("https://meet.google.com/abc")).toBe(true);
    expect(esUrlValida("http://zoom.us/j/1")).toBe(true);
    expect(esUrlValida("meet.google.com/abc")).toBe(false);
    expect(esUrlValida("javascript:alert(1)")).toBe(false);
  });
});
