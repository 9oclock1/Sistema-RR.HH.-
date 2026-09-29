export const mapearErroresApi = (errores, camposDelFormulario) => {
  const porCampo = {};
  const generales = [];

  errores.forEach(({ campo, mensaje }) => {
    const clave = campo?.replace(/\[\d+\]$/, '');
    if (camposDelFormulario.includes(clave)) {
      porCampo[clave] ??= mensaje;
    } else {
      generales.push(mensaje);
    }
  });

  return { porCampo, generales };
};
