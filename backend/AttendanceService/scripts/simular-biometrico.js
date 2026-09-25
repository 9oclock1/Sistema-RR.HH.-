// Simula un lector biométrico que ya reconoció la huella del empleado.
// Uso: docker exec attendance-service npm run simular:biometrico -- <id_empleado> [entrada|salida]
// Variables opcionales: ATTENDANCE_URL, DISPOSITIVO_CLAVE (por defecto, la del primer dispositivo configurado).
const { leerDispositivos } = require("../src/utils/dispositivos");
const { horaBolivia } = require("../src/utils/jornada");

const [idEmpleado, tipo = "entrada"] = process.argv.slice(2);
const url = process.env.ATTENDANCE_URL || `http://localhost:${process.env.PORT || 3004}`;
const clave =
  process.env.DISPOSITIVO_CLAVE || leerDispositivos(process.env.DISPOSITIVOS_BIOMETRICOS).keys().next().value;

const hora = (marcaje) => horaBolivia(new Date(marcaje.fecha_hora_marcaje));
const duracion = (minutos) => `${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, "0")} min`;

const describir = {
  entrada: (entrada) =>
    `Entrada registrada a las ${hora(entrada)} (jornada ${entrada.fecha_jornada}, dispositivo ${entrada.codigo_dispositivo}).`,
  salida: ({ salida, fecha_jornada, minutos_trabajados }) =>
    `Salida registrada a las ${hora(salida)} (jornada ${fecha_jornada}, dispositivo ${salida.codigo_dispositivo}). ` +
    `Horas trabajadas: ${duracion(minutos_trabajados)}.`,
};

async function main() {
  if (!idEmpleado || !clave || !Object.hasOwn(describir, tipo)) {
    console.error(
      "Uso: npm run simular:biometrico -- <id_empleado> [entrada|salida] (requiere DISPOSITIVOS_BIOMETRICOS o DISPOSITIVO_CLAVE)"
    );
    process.exit(1);
  }

  const respuesta = await fetch(`${url}/marcajes/biometrico/${tipo}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Dispositivo-Clave": clave },
    body: JSON.stringify({ id_empleado: idEmpleado }),
  });
  const datos = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    console.error(`Marcaje rechazado (${respuesta.status}): ${datos.error ?? "sin detalle"}`);
    process.exit(1);
  }
  console.log(describir[tipo](datos));
}

main().catch((error) => {
  console.error(`No se pudo conectar con AttendanceService: ${error.message}`);
  process.exit(1);
});
