let siguienteId = 0;
export const nuevaHabilidad = (texto = '') => ({ id: `h${++siguienteId}`, texto });

// Campos que se precargan desde el perfil del cargo.
export const CAMPOS_PERFIL = ['titulo_puesto', 'descripcion_puesto', 'nivel_educacion_min', 'year_experiencia_min'];

export const ETIQUETAS_CAMPO = {
  id_cargo_referencial: 'Cargo',
  id_sucursal_destino: 'Sucursal de destino',
  titulo_puesto: 'Título del puesto',
  descripcion_puesto: 'Descripción',
  nivel_educacion_min: 'Formación mínima',
  year_experiencia_min: 'Experiencia mínima',
  cantidad_vacantes: 'Vacantes',
  fecha_limite_postulacion: 'Fecha límite',
  habilidades_clave_requeridas: 'Habilidades clave',
};

export const CAMPOS_DEL_FORMULARIO = Object.keys(ETIQUETAS_CAMPO);

// Fecha local 'AAAA-MM-DD', el mismo formato del input type="date".
export const hoyLocal = () => new Intl.DateTimeFormat('en-CA').format(new Date());

export const formularioVacio = () => ({
  id_cargo_referencial: '',
  id_sucursal_destino: '',
  titulo_puesto: '',
  descripcion_puesto: '',
  nivel_educacion_min: '',
  year_experiencia_min: '0',
  cantidad_vacantes: '1',
  fecha_limite_postulacion: '',
  habilidades_clave_requeridas: [nuevaHabilidad()],
});

export const convocatoriaAFormulario = (convocatoria) => ({
  id_cargo_referencial: convocatoria.id_cargo_referencial ?? '',
  id_sucursal_destino: convocatoria.id_sucursal_destino ?? '',
  titulo_puesto: convocatoria.titulo_puesto ?? '',
  descripcion_puesto: convocatoria.descripcion_puesto ?? '',
  nivel_educacion_min: convocatoria.nivel_educacion_min ?? '',
  year_experiencia_min: String(convocatoria.year_experiencia_min ?? 0),
  cantidad_vacantes: String(convocatoria.cantidad_vacantes ?? 1),
  fecha_limite_postulacion: convocatoria.fecha_limite_postulacion ?? '',
  habilidades_clave_requeridas: convocatoria.habilidades_clave_requeridas?.length
    ? convocatoria.habilidades_clave_requeridas.map((texto) => nuevaHabilidad(texto))
    : [nuevaHabilidad()],
});

export const perfilAFormulario = (perfil) => ({
  titulo_puesto: perfil.titulo_puesto ?? '',
  descripcion_puesto: perfil.descripcion_puesto ?? '',
  nivel_educacion_min: perfil.nivel_educacion_min ?? '',
  year_experiencia_min: String(perfil.year_experiencia_min ?? 0),
});

export const formularioAPayload = (valores) => ({
  id_cargo_referencial: valores.id_cargo_referencial,
  id_sucursal_destino: valores.id_sucursal_destino.trim(),
  titulo_puesto: valores.titulo_puesto.trim(),
  descripcion_puesto: valores.descripcion_puesto.trim(),
  nivel_educacion_min: valores.nivel_educacion_min,
  year_experiencia_min: Number(valores.year_experiencia_min),
  cantidad_vacantes: Number(valores.cantidad_vacantes),
  fecha_limite_postulacion: valores.fecha_limite_postulacion || null,
  habilidades_clave_requeridas: valores.habilidades_clave_requeridas.map((h) => h.texto.trim()).filter(Boolean),
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXPERIENCIA_REGEX = /^\d{1,3}(\.\d)?$/;

// Solo lo necesario para guardar el borrador. Lo que falte para publicar lo informa el backend en campos_pendientes.
export const validarFormulario = (valores) => {
  const errores = {};
  const sucursal = valores.id_sucursal_destino.trim();
  const cantidad = Number(valores.cantidad_vacantes);

  if (!valores.id_cargo_referencial) errores.id_cargo_referencial = 'Selecciona un cargo.';
  if (!sucursal) errores.id_sucursal_destino = 'La sucursal de destino es obligatoria.';
  else if (!UUID_REGEX.test(sucursal)) errores.id_sucursal_destino = 'Debe ser un identificador UUID válido.';
  if (!valores.titulo_puesto.trim()) errores.titulo_puesto = 'El título del puesto es obligatorio.';
  if (!EXPERIENCIA_REGEX.test(valores.year_experiencia_min.trim()))
    errores.year_experiencia_min = 'Entre 0 y 999.9 años, hasta 1 decimal.';
  if (!Number.isInteger(cantidad) || cantidad < 1) errores.cantidad_vacantes = 'Debe ser un entero desde 1.';
  if (valores.fecha_limite_postulacion && valores.fecha_limite_postulacion < hoyLocal())
    errores.fecha_limite_postulacion = 'La fecha límite ya pasó.';
  return errores;
};
