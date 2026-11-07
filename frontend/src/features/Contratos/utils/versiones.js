import { fechaDeHoy } from '../../Capacitaciones/utils/fechas';

const dosDigitos = (numero) => String(numero).padStart(2, '0');

export const diaSiguiente = (fecha) => {
  const dia = new Date(`${fecha}T00:00:00Z`);
  dia.setUTCDate(dia.getUTCDate() + 1);
  return `${dia.getUTCFullYear()}-${dosDigitos(dia.getUTCMonth() + 1)}-${dosDigitos(dia.getUTCDate())}`;
};

export const versionActual = (historial) =>
  historial.filter((version) => !historial.some((otra) => otra.id_contrato_anterior === version.id_contrato)).at(-1) ?? null;

export const normalizarMonto = (texto) => texto.trim().replace(',', '.');

export const mismoMonto = (a, b) => Number(a) === Number(b);

export const estadoVersion = (version) => {
  if (version.es_version_vigente) return { tono: 'exito', texto: 'Vigente' };
  if (version.fecha_vigencia > fechaDeHoy()) return { tono: 'info', texto: 'Programada' };
  return null;
};
