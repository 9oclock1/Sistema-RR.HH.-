const fechaHora = new Intl.DateTimeFormat("es-BO", {
  timeZone: "America/La_Paz",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export const formatearFechaHora = (valor) => fechaHora.format(new Date(valor));

const TONOS_ESTADO = {
  REGISTRADA: "info",
  ASIGNADA: "morado",
  EN_ANALISIS: "info",
  EN_ACCION: "aviso",
  RESUELTA: "exito",
  DESESTIMADA: "neutral",
};

export const tonoEstado = (codigo) => TONOS_ESTADO[codigo] ?? "neutral";

export async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const campo = document.createElement("textarea");
    campo.value = texto;
    campo.setAttribute("readonly", "");
    campo.style.position = "fixed";
    campo.style.opacity = "0";
    document.body.appendChild(campo);
    campo.select();
    const copiado = document.execCommand?.("copy") ?? false;
    campo.remove();
    return copiado;
  }
}
