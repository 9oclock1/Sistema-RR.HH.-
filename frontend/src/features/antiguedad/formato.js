export const formatearMonto = (valor) =>
  `Bs ${Number(valor).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const formatearPorcentaje = (valor) =>
  `${Number(valor).toLocaleString("es-BO", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} %`;

export const formatearFecha = (fecha) => (fecha ? fecha.split("-").reverse().join("/") : "—");

export const formatearRangoAnios = (tramo) =>
  tramo.anios_hasta === null ? `${tramo.anios_desde}+ años` : `${tramo.anios_desde}-${tramo.anios_hasta} años`;

export const hoyLaPaz = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/La_Paz" }).format(new Date());
