const {
  esVacio,
  faltante,
  invalido,
  cuerpoComoObjeto,
  normalizarTexto,
  lanzarSiHayErrores,
} = require("./comunes");
const { MAX_MOTIVO } = require("../utils/etapas");

const normalizarEnteroPositivo = (valor, campo, errores) => {
  if (esVacio(valor)) return null;
  const numero = typeof valor === "string" ? Number(valor.trim()) : valor;
  if (!Number.isInteger(numero) || numero < 1) {
    errores.push(
      invalido(
        campo,
        `El campo '${campo}' debe ser un número entero positivo.`,
      ),
    );
    return null;
  }
  return numero;
};

function validarCambioEtapa(body) {
  const datos = cuerpoComoObjeto(body);
  const errores = [];

  const idEtapa = normalizarEnteroPositivo(datos.id_etapa, "id_etapa", errores);
  const codigoEtapa = normalizarTexto(
    datos.codigo_etapa,
    "codigo_etapa",
    { maxLength: 30 },
    errores,
  );
  if (esVacio(datos.id_etapa) && esVacio(datos.codigo_etapa)) {
    errores.push(faltante("id_etapa"));
  }

  const motivo = normalizarTexto(
    datos.motivo,
    "motivo",
    { maxLength: MAX_MOTIVO },
    errores,
  );
  const idCargoOperativo = normalizarEnteroPositivo(
    datos.id_cargo_operativo,
    "id_cargo_operativo",
    errores,
  );

  lanzarSiHayErrores(errores, "No se puede cambiar la etapa del postulante.");

  return {
    id_etapa: idEtapa,
    codigo_etapa: codigoEtapa ? codigoEtapa.toUpperCase() : null,
    motivo,
    id_cargo_operativo: idCargoOperativo,
  };
}

module.exports = { validarCambioEtapa };
