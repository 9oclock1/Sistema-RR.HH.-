let siguienteId = 0;
export const nuevaFuncion = (texto = '') => ({ id: `f${++siguienteId}`, texto });

export const formularioVacio = () => ({
  nombre: '',
  id_nivel_salarial: '',
  id_departamento: '',
  perfil_requerido: '',
  id_cargo_superior: null,
  funciones: [nuevaFuncion()],
});

export const cargoAFormulario = (cargo) => ({
  nombre: cargo.nombre ?? '',
  id_nivel_salarial: cargo.id_nivel_salarial ? String(cargo.id_nivel_salarial) : '',
  id_departamento: cargo.id_departamento ? String(cargo.id_departamento) : '',
  perfil_requerido: cargo.perfil_requerido ?? '',
  id_cargo_superior: cargo.id_cargo_superior ?? null,
  funciones: cargo.funciones?.length ? cargo.funciones.map((texto) => nuevaFuncion(texto)) : [nuevaFuncion()],
});

// Objeto completo que esperan POST /cargos y PUT /cargos/:id.
export const formularioAPayload = (valores) => ({
  nombre: valores.nombre.trim(),
  id_nivel_salarial: Number(valores.id_nivel_salarial),
  id_departamento: valores.id_departamento ? Number(valores.id_departamento) : null,
  perfil_requerido: valores.perfil_requerido.trim() || null,
  id_cargo_superior: valores.id_cargo_superior,
  funciones: valores.funciones.map((f) => f.texto.trim()).filter(Boolean),
});

export const validarFormulario = (valores) => {
  const errores = {};
  if (!valores.nombre.trim()) errores.nombre = 'El nombre del cargo es obligatorio.';
  if (!valores.id_nivel_salarial) errores.id_nivel_salarial = 'Selecciona un nivel salarial.';
  return errores;
};

const CAMPOS_DEL_FORMULARIO = ['nombre', 'id_nivel_salarial', 'id_departamento', 'perfil_requerido', 'funciones'];

// Reparte los errores del backend ([{ campo, mensaje }]) entre los campos; lo que no tiene campo visible va al banner general.
export const mapearErroresApi = (errores) => {
  const porCampo = {};
  const generales = [];

  errores.forEach(({ campo, mensaje }) => {
    const clave = campo?.startsWith('funciones') ? 'funciones' : campo;
    if (CAMPOS_DEL_FORMULARIO.includes(clave)) {
      porCampo[clave] ??= mensaje;
    } else {
      generales.push(mensaje);
    }
  });

  return { porCampo, generales };
};
