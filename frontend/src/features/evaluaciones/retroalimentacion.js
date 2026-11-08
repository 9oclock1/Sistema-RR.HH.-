// KAN-26: utilidades de la retroalimentación cualitativa final.

export const MAX_TEXTO = 4000;
export const MAX_DESCRIPCION_COMPROMISO = 500;
export const MAX_COMPROMISOS = 20;

export const CAMPOS_RETROALIMENTACION = [
  { clave: "fortalezas", etiqueta: "Fortalezas", ayuda: "Lo que el colaborador hace bien y conviene que mantenga." },
  { clave: "aspectos_mejora", etiqueta: "Aspectos de mejora", ayuda: "Lo que debería trabajar en el próximo periodo." },
  { clave: "comentarios_generales", etiqueta: "Comentarios generales", ayuda: "Cualquier otra observación sobre su desempeño." },
];

let siguienteClave = 0;
const nuevaClave = () => `compromiso-${(siguienteClave += 1)}`;

export const compromisoVacio = () => ({ clave: nuevaClave(), descripcion: "", fecha_objetivo: "" });

// Del formato del servicio al estado del formulario (los null pasan a cadena vacía).
export const aEstado = (retro) => ({
  fortalezas: retro?.fortalezas ?? "",
  aspectos_mejora: retro?.aspectos_mejora ?? "",
  comentarios_generales: retro?.comentarios_generales ?? "",
  compromisos: (retro?.compromisos ?? []).map((c) => ({
    clave: c.id_compromiso ?? nuevaClave(),
    descripcion: c.descripcion,
    fecha_objetivo: c.fecha_objetivo,
  })),
});

// Del estado del formulario al cuerpo que espera el servicio.
export const aCuerpo = (estado) => ({
  fortalezas: estado.fortalezas.trim(),
  aspectos_mejora: estado.aspectos_mejora.trim(),
  comentarios_generales: estado.comentarios_generales.trim(),
  compromisos: estado.compromisos.map((c) => ({ descripcion: c.descripcion.trim(), fecha_objetivo: c.fecha_objetivo })),
});

// Compara lo escrito con lo guardado sin fijarse en espacios sobrantes.
export const mismoContenido = (a, b) => JSON.stringify(aCuerpo(a)) === JSON.stringify(aCuerpo(b));

export const tieneContenido = (retro) =>
  Boolean(retro && (retro.fortalezas || retro.aspectos_mejora || retro.comentarios_generales || retro.compromisos?.length));

// Errores por campo, con las mismas claves que usa el servicio («compromisos[0].fecha_objetivo»).
export function validarRetroalimentacion(estado, hoy) {
  const errores = {};
  for (const { clave, etiqueta } of CAMPOS_RETROALIMENTACION) {
    if (estado[clave].trim().length > MAX_TEXTO) errores[clave] = `${etiqueta}: hasta ${MAX_TEXTO} caracteres.`;
  }
  estado.compromisos.forEach((compromiso, i) => {
    const descripcion = compromiso.descripcion.trim();
    if (!descripcion) errores[`compromisos[${i}].descripcion`] = "Describa el compromiso.";
    else if (descripcion.length > MAX_DESCRIPCION_COMPROMISO)
      errores[`compromisos[${i}].descripcion`] = `Hasta ${MAX_DESCRIPCION_COMPROMISO} caracteres.`;
    if (!compromiso.fecha_objetivo) errores[`compromisos[${i}].fecha_objetivo`] = "Indique la fecha objetivo.";
    else if (compromiso.fecha_objetivo < hoy)
      errores[`compromisos[${i}].fecha_objetivo`] = "La fecha objetivo no puede ser anterior a hoy.";
  });
  return errores;
}

export const erroresDelServicio = (detalles = []) =>
  Object.fromEntries(detalles.filter((d) => d.campo).map((d) => [d.campo, d.mensaje]));
