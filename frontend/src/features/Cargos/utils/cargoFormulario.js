let siguienteId = 0;
export const nuevaFuncion = (texto = '') => ({ id: `f${++siguienteId}`, texto });

export const formularioVacio = () => ({
  codigo: '',
  nombre: '',
  id_departamento: '',
  nivel_jerarquico: '',
  salario_base_referencial: '',
  requisitos_minimos: '',
  id_cargo_jefe_directo: null,
  funciones: [nuevaFuncion()],
})
export const cargoAFormulario = (cargo) => ({
  codigo: cargo.codigo ?? '',
  nombre: cargo.nombre ?? '',
  id_departamento: cargo.id_departamento ?? '',
  nivel_jerarquico: cargo.nivel_jerarquico != null ? String(cargo.nivel_jerarquico) : '',
  salario_base_referencial: cargo.salario_base_referencial != null ? String(cargo.salario_base_referencial) : '',
  requisitos_minimos: cargo.requisitos_minimos ?? '',
  id_cargo_jefe_directo: cargo.id_cargo_jefe_directo ?? null,
  funciones: cargo.funciones?.length ? cargo.funciones.map((texto) => nuevaFuncion(texto)) : [nuevaFuncion()],
});

export const formularioAPayload = (valores) => ({
  codigo: valores.codigo.trim(),
  nombre: valores.nombre.trim(),
  id_departamento: valores.id_departamento,
  nivel_jerarquico: Number(valores.nivel_jerarquico),
  salario_base_referencial: valores.salario_base_referencial.trim(),
  requisitos_minimos: valores.requisitos_minimos.trim(),
  id_cargo_jefe_directo: valores.id_cargo_jefe_directo,
  funciones: valores.funciones.map((f) => f.texto.trim()).filter(Boolean),
});

const MONTO_REGEX = /^\d{1,10}(\.\d{1,2})?$/;

export const validarFormulario = (valores) => {
  const errores = {};
  const nivel = Number(valores.nivel_jerarquico);

  if (!valores.nombre.trim()) errores.nombre = 'El nombre del cargo es obligatorio.';
  if (!valores.codigo.trim()) errores.codigo = 'El código es obligatorio.';
  if (!valores.id_departamento) errores.id_departamento = 'Selecciona un área.';
  if (!valores.nivel_jerarquico) errores.nivel_jerarquico = 'Indica el nivel.';
  else if (!Number.isInteger(nivel) || nivel < 1 || nivel > 32767) errores.nivel_jerarquico = 'Debe ser un entero desde 1.';
  if (!valores.salario_base_referencial.trim()) errores.salario_base_referencial = 'Indica el salario.';
  else if (!MONTO_REGEX.test(valores.salario_base_referencial.trim()))
    errores.salario_base_referencial = 'Monto positivo, hasta 2 decimales.';
  if (!valores.requisitos_minimos.trim()) errores.requisitos_minimos = 'Los requisitos mínimos son obligatorios.';
  if (!valores.funciones.some((f) => f.texto.trim())) errores.funciones = 'Agrega al menos una función clave.';
  return errores;
};

export const CAMPOS_DEL_FORMULARIO = [
  'nombre',
  'codigo',
  'id_departamento',
  'nivel_jerarquico',
  'salario_base_referencial',
  'requisitos_minimos',
  'funciones',
];
