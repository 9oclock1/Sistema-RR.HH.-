import { formatearValor, hoyLaPaz } from "../conceptos/formato";

export const TIPOS_META = {
  VENTAS: { etiqueta: "Meta de ventas", tono: "exito" },
  PUNTUALIDAD: { etiqueta: "Puntualidad", tono: "info" },
  DESEMPENO_CAJA: { etiqueta: "Desempeño en caja", tono: "morado" },
};

export const FORMAS_BONO = {
  MONTO_FIJO: "Monto fijo",
  PORCENTAJE: "Porcentaje del haber básico",
};

export const describirValor = (valor, forma) => formatearValor(valor, forma);

export const mesActual = () => hoyLaPaz().slice(0, 7);

export const mesAnterior = () => {
  const [anio, mes] = mesActual().split("-").map(Number);
  return mes === 1 ? `${anio - 1}-12` : `${anio}-${String(mes - 1).padStart(2, "0")}`;
};

export const formatearMes = (periodo) => {
  const texto = new Intl.DateTimeFormat("es-BO", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${periodo.slice(0, 7)}-01T00:00:00Z`)
  );
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

export const formatearMomento = (iso) =>
  new Intl.DateTimeFormat("es-BO", { dateStyle: "short", timeStyle: "short", timeZone: "America/La_Paz" }).format(
    new Date(iso)
  );

export const formatearPorcentaje = (valor) =>
  `${Number(valor).toLocaleString("es-BO", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} %`;
