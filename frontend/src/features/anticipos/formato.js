export const TIPOS = {
  ANTICIPO: { etiqueta: "Anticipo de sueldo", tono: "info" },
  PRESTAMO: { etiqueta: "Préstamo", tono: "aviso" },
};

export const ESTADOS = {
  ACTIVO: { etiqueta: "Activo", tono: "exito" },
  COMPLETADO: { etiqueta: "Completado", tono: "neutral" },
  CANCELADO: { etiqueta: "Cancelado", tono: "peligro" },
};

export const opciones = (catalogo) =>
  Object.entries(catalogo).map(([valor, { etiqueta }]) => ({ valor, etiqueta }));

export const formatearMonto = (valor) =>
  `Bs ${Number(valor).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const formatearFecha = (fecha) => (fecha ? fecha.split("-").reverse().join("/") : "—");

// "2026-12" para mostrar el periodo sin el día, que siempre es 01.
export const formatearPeriodo = (fecha) => {
  if (!fecha) return "—";
  const [anio, mes] = fecha.split("-");
  const MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  return `${MESES[Number(mes) - 1]} ${anio}`;
};

export const hoyLaPaz = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/La_Paz" }).format(new Date());
