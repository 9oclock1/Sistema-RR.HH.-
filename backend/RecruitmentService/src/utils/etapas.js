const HttpError = require("./HttpError");

const ETAPA = {
  POSTULADO: 1,
  EN_REVISION: 2,
  ENTREVISTA_TECNICA: 3,
  APTO: 4,
  FINALISTA: 5,
  CONTRATADO: 6,
  RECHAZADO: 7,
};

const MAX_MOTIVO = 1000;

const conflicto = (mensaje, detalles = {}) =>
  new HttpError(409, mensaje, {
    campos_faltantes: [],
    errores: [],
    ...detalles,
  });

const solicitudInvalida = (campo, mensaje, tipo = "invalido") =>
  new HttpError(400, mensaje, {
    campos_faltantes: tipo === "faltante" ? [campo] : [],
    errores: [{ campo, mensaje }],
  });

/**
 * Reglas de negocio de un cambio de etapa. Recibe todo lo leído de la base y lanza el primer error que aplique.
 * - postulacion: { id_etapa, nombre_etapa, es_final, esta_archivada }
 * - destino: etapa pedida (null si no existe); transicion: fila de TRANSICIONES_ETAPA_POSTULACION (null si no está permitida)
 * - permitidas: etapas a las que sí puede pasar (para el mensaje); cargo: cargo operativo pedido (null si no existe)
 * - vacantes: { cantidad, contratados } de la convocatoria, solo al contratar
 */
function verificarCambioEtapa({
  postulacion,
  destino,
  transicion,
  permitidas = [],
  idCargoOperativo = null,
  cargo = null,
  vacantes = null,
}) {
  if (!destino) {
    throw solicitudInvalida("id_etapa", "La etapa indicada no existe.");
  }
  if (!destino.esta_activa) {
    throw solicitudInvalida(
      "id_etapa",
      `La etapa «${destino.nombre}» ya no se usa en el flujo de selección.`,
    );
  }
  if (postulacion.esta_archivada || postulacion.es_final) {
    throw conflicto(
      `La postulación está cerrada en «${postulacion.nombre_etapa}» y ya no admite cambios de etapa.`,
    );
  }
  if (destino.id_etapa === postulacion.id_etapa) {
    throw conflicto(
      `El postulante ya se encuentra en la etapa «${destino.nombre}».`,
    );
  }
  if (!transicion) {
    const opciones = permitidas.map((etapa) => etapa.nombre).join(", ");
    throw conflicto(
      `No se puede pasar de «${postulacion.nombre_etapa}» a «${destino.nombre}».` +
        (opciones
          ? ` Desde «${postulacion.nombre_etapa}» solo puede pasar a: ${opciones}.`
          : ""),
      { etapas_permitidas: permitidas },
    );
  }

  if (transicion.requiere_cargo) {
    if (idCargoOperativo === null) {
      throw solicitudInvalida(
        "id_cargo_operativo",
        "Para contratar debe asignar el cargo operativo (cajero, vendedor, almacenero o chofer).",
        "faltante",
      );
    }
    if (!cargo) {
      throw solicitudInvalida(
        "id_cargo_operativo",
        "El cargo operativo indicado no existe.",
      );
    }
  } else if (idCargoOperativo !== null) {
    throw solicitudInvalida(
      "id_cargo_operativo",
      "El cargo operativo solo se asigna al contratar al postulante.",
    );
  }

  if (
    destino.id_etapa === ETAPA.CONTRATADO &&
    vacantes &&
    vacantes.contratados >= vacantes.cantidad
  ) {
    throw conflicto(
      `La convocatoria ya cubrió sus ${vacantes.cantidad} vacante(s); no se puede contratar a otro postulante.`,
    );
  }
}

module.exports = { ETAPA, MAX_MOTIVO, verificarCambioEtapa };
