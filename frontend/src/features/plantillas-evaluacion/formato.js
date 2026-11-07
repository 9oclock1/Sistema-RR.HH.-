import { formatearFecha } from "../solicitud-vacaciones/formato";

// Estado de la versión más reciente de la plantilla.
export const ESTADOS_PLANTILLA = {
  BORRADOR: { texto: "Borrador", tono: "aviso" },
  PUBLICADA: { texto: "Publicada", tono: "exito" },
  ARCHIVADA: { texto: "Archivada", tono: "neutral" },
};

export const OPCIONES_ESTADO = Object.entries(ESTADOS_PLANTILLA).map(
  ([valor, { texto }]) => ({
    valor,
    etiqueta: texto,
  }),
);

export const formatearVigencia = (desde, hasta) =>
  `${formatearFecha(desde)} – ${formatearFecha(hasta)}`;

// Una plantilla que alguna vez se publicó ya no se edita ni se elimina: los cambios van en una versión nueva.
export const esEditable = (plantilla) => !plantilla.fue_publicada;

const sinTildes = (texto) =>
  texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export const coincideConBusqueda = (plantilla, busqueda) => {
  const buscado = sinTildes(busqueda.trim());
  if (!buscado) return true;
  return [plantilla.nombre, plantilla.objetivo, plantilla.area.nombre].some(
    (texto) => sinTildes(texto).includes(buscado),
  );
};

export const TIPOS_COMPETENCIA = {
  COMPETENCIA_LABORAL: {
    texto: "Competencia laboral",
    plural: "Competencias laborales",
    tono: "info",
  },
  FACTOR_OPERATIVO: {
    texto: "Factor operativo",
    plural: "Factores operativos",
    tono: "morado",
  },
};

export const OPCIONES_TIPO_COMPETENCIA = Object.entries(TIPOS_COMPETENCIA).map(
  ([valor, { texto }]) => ({
    valor,
    etiqueta: texto,
  }),
);

const plural = (cantidad, singular, varios) =>
  `${cantidad} ${cantidad === 1 ? singular : varios}`;

export const resumirSecciones = (competencias) => {
  if (competencias.length === 0) return "Sin secciones";
  const laborales = competencias.filter(
    (c) => c.tipo_codigo === "COMPETENCIA_LABORAL",
  ).length;
  const operativos = competencias.length - laborales;
  return [
    laborales > 0 &&
      plural(laborales, "competencia laboral", "competencias laborales"),
    operativos > 0 &&
      plural(operativos, "factor operativo", "factores operativos"),
  ]
    .filter(Boolean)
    .join(" · ");
};
