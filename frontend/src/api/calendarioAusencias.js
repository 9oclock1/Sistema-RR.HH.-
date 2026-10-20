import { solicitar } from "./cliente";

const RUTA = "/att/calendario";

// Quién consulta: RRHH ve cualquier sucursal; el supervisor, solo la suya (temporal hasta contar con sesión).
const cabeceras = ({ idEmpleado, rol }) => ({
  ...(idEmpleado && { "X-Empleado-Id": idEmpleado }),
  "X-Rol": rol,
});

const parametros = (filtros) => {
  const p = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) if (valor) p.set(clave, valor);
  return p.toString();
};

// Sucursales, áreas, tipos de ausencia (para la leyenda) y si quien consulta puede configurar umbrales.
export const obtenerAlcanceCalendario = (identidad) => solicitar(`${RUTA}/ausencias/alcance`, { cabeceras: cabeceras(identidad) });

// filtros: { id_sucursal, id_departamento, desde, hasta }. Devuelve { filtros, equipo, ausencias, dias, resumen }.
export const consultarCalendarioAusencias = (filtros, identidad) =>
  solicitar(`${RUTA}/ausencias?${parametros(filtros)}`, { cabeceras: cabeceras(identidad) });

export const listarUmbralesCobertura = (identidad) => solicitar(`${RUTA}/umbrales`, { cabeceras: cabeceras(identidad) });

// datos: { id_sucursal?, id_departamento?, max_ausentes_porcentaje, min_presentes }.
export const guardarUmbralCobertura = (datos, identidad) =>
  solicitar(`${RUTA}/umbrales`, { metodo: "PUT", cuerpo: datos, cabeceras: cabeceras(identidad) });

export const eliminarUmbralCobertura = (idUmbral, identidad) =>
  solicitar(`${RUTA}/umbrales/${idUmbral}`, { metodo: "DELETE", cabeceras: cabeceras(identidad) });
