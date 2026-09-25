// Simula un lector biométrico que ya reconoció la huella del empleado.
// Uso: docker exec attendance-service npm run simular:biometrico -- <id_empleado>
// Variables opcionales: ATTENDANCE_URL, DISPOSITIVO_CLAVE (por defecto, la del primer dispositivo configurado).
const { leerDispositivos } = require("../src/utils/dispositivos");
const { horaBolivia } = require("../src/utils/jornada");

const [idEmpleado] = process.argv.slice(2);
const url = process.env.ATTENDANCE_URL || `http://localhost:${process.env.PORT || 3004}`;
const clave =
  process.env.DISPOSITIVO_CLAVE || leerDispositivos(process.env.DISPOSITIVOS_BIOMETRICOS).keys().next().value;

async function main() {
  if (!idEmpleado || !clave) {
    console.error("Uso: npm run simular:biometrico -- <id_empleado> (requiere DISPOSITIVOS_BIOMETRICOS o DISPOSITIVO_CLAVE)");
    process.exit(1);
  }

  const respuesta = await fetch(`${url}/marcajes/biometrico/entrada`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Dispositivo-Clave": clave },
    body: JSON.stringify({ id_empleado: idEmpleado }),
  });
  const datos = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    console.error(`Marcaje rechazado (${respuesta.status}): ${datos.error ?? "sin detalle"}`);
    process.exit(1);
  }
  const hora = horaBolivia(new Date(datos.fecha_hora_marcaje));
  console.log(`Entrada registrada a las ${hora} (jornada ${datos.fecha_jornada}, dispositivo ${datos.codigo_dispositivo}).`);
}

main().catch((error) => {
  console.error(`No se pudo conectar con AttendanceService: ${error.message}`);
  process.exit(1);
});
