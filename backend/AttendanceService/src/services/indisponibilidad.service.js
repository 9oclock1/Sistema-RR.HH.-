const empleados = require("./empleados.service");
const eventos = require("./eventos.service");
const { ErrorApp } = require("../utils/errores");

// KAN-53, criterio 2: al aprobar una ausencia, Producción y Logística (operarios) o Entregas y Despachos (choferes)
// reciben la indisponibilidad del empleado.
// Los datos se leen antes de abrir la transacción (hay llamadas a otros servicios); el evento se escribe dentro de ella,
// junto con la aprobación. Si no se puede saber el área, la aprobación no se hace: así la ausencia nunca queda sin avisar.
async function prepararEvento({ solicitud, categoria, nombreResolutor }) {
  const [nombre, ubicacion] = await Promise.all([
    empleados.obtenerNombre(solicitud.id_empleado),
    empleados.obtenerUbicacion(solicitud.id_empleado),
  ]);
  if (!ubicacion) {
    throw new ErrorApp(503, "No se pudo determinar el área del empleado para sincronizar su ausencia. Intente nuevamente.");
  }

  const resultado = { eventosRegistrados: 0 };
  const alResolver = async (cliente) => {
    resultado.eventosRegistrados = await eventos.registrarIndisponibilidad(cliente, {
      solicitud,
      categoria,
      empleado: { nombre_completo: nombre },
      ubicacion,
      aprobadoPor: nombreResolutor,
      aprobadoEn: new Date().toISOString(),
    });
  };
  return { alResolver, resultado };
}

module.exports = { prepararEvento };
