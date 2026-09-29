export function formatearFecha(fechaIso) {
  if (!fechaIso) return "—";
  try {
    const fecha = new Date(fechaIso);
    if (isNaN(fecha.getTime())) return "—";

    const ahora = new Date();
    const difMs = ahora - fecha;
    const difSeg = Math.floor(difMs / 1000);
    const difMin = Math.floor(difSeg / 60);
    const difHoras = Math.floor(difMin / 60);
    const difDias = Math.floor(difHoras / 24);

    if (difSeg < 60) return "Hace un momento";
    if (difMin < 60) return `Hace ${difMin} min`;
    if (difHoras < 24 && fecha.getDate() === ahora.getDate()) {
      return `Hoy, ${fecha.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })}`;
    }
    if (difDias === 1) {
      return `Ayer, ${fecha.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })}`;
    }

    return fecha.toLocaleDateString("es-BO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function formatearFechaLarga(fechaIso) {
  if (!fechaIso) return "—";
  try {
    const fecha = new Date(fechaIso);
    if (isNaN(fecha.getTime())) return "—";
    return fecha.toLocaleString("es-BO", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}
