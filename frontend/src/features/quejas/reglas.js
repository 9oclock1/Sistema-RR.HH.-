export const RUTA_BUZON_QUEJAS = "/desempeno/buzon-quejas";
export const RUTA_CONSULTAR_QUEJA = "/consultar-queja";

export const ASUNTO = { MIN: 5, MAX: 150 };
export const DESCRIPCION = { MIN: 20, MAX: 5000 };

function validarLargo(errores, campo, valor, { MIN, MAX }, { vacio, nombre }) {
  if (!valor) errores[campo] = vacio;
  else if (valor.length < MIN) errores[campo] = `${nombre} debe tener al menos ${MIN} caracteres.`;
  else if (valor.length > MAX) errores[campo] = `${nombre} puede tener hasta ${MAX} caracteres.`;
}

export function validarQueja({ idCategoria, asunto, descripcion, anonima }, { idEmpleado }) {
  const errores = {};
  if (!idCategoria) errores.id_categoria_queja = "Seleccione la categoría de la queja.";
  validarLargo(errores, "asunto", asunto.trim(), ASUNTO, { vacio: "Escriba el asunto de la queja.", nombre: "El asunto" });
  validarLargo(errores, "descripcion", descripcion.trim(), DESCRIPCION, {
    vacio: "Describa lo ocurrido.",
    nombre: "La descripción",
  });
  if (!anonima && !idEmpleado) {
    errores.anonima = "Seleccione un usuario de prueba en la barra lateral o envíe la queja de forma anónima.";
  }
  return errores;
}

const CODIGO = /^QJ-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

export function normalizarCodigo(entrada) {
  let limpio = entrada.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (limpio.length === 10 && limpio.startsWith("QJ")) limpio = limpio.slice(2);
  limpio = limpio.replace(/O/g, "0").replace(/[IL]/g, "1");
  const codigo = `QJ-${limpio.slice(0, 4)}-${limpio.slice(4)}`;
  return CODIGO.test(codigo) ? codigo : null;
}
