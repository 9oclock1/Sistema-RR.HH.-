const pool = require("../../db/pool");
const { ESTADO_EVENTO, DESTINO } = require("../utils/integracion");

async function listarDestinos(client) {
  const { rows } = await client.query(
    "SELECT id_destino, codigo, grupo, nombre_modulo, canal FROM CATALOGOS_DESTINO_INTEGRACION",
  );
  return Object.fromEntries(rows.map((destino) => [destino.codigo, destino]));
}

// Datos del postulante y de la convocatoria que necesitan los módulos para dar de alta al colaborador.
async function obtenerDatosAlta(client, idPostulacion) {
  const { rows } = await client.query(
    `SELECT p.id_postulacion, p.id_empleado_generado,
            pos.numero_documento, pos.nombres, pos.apellidos, pos.correo_electronico, pos.telefono_contacto, pos.ciudad,
            c.id_convocatoria, c.codigo_convocatoria, c.titulo_puesto, c.id_cargo_referencial, c.id_sucursal_destino
       FROM POSTULACIONES p
       INNER JOIN POSTULANTES pos ON pos.id_postulante = p.id_postulante
       INNER JOIN CONVOCATORIAS c ON c.id_convocatoria = p.id_convocatoria
      WHERE p.id_postulacion = $1`,
    [idPostulacion],
  );
  return rows[0] || null;
}

// Si la postulación ya tenía el alta registrada para ese destino no se duplica (uq_evento_saliente_postulacion_destino).
async function registrar(
  client,
  { idMensaje, idPostulacion, idDestino, tipoEvento, carga },
) {
  const { rows } = await client.query(
    `INSERT INTO EVENTOS_SALIENTES (id_mensaje, id_postulacion, id_destino, tipo_evento, carga)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id_postulacion, id_destino, tipo_evento) DO NOTHING
     RETURNING id_evento, id_mensaje, id_destino, tipo_evento, creado_en`,
    [idMensaje, idPostulacion, idDestino, tipoEvento, carga],
  );
  return rows[0] || null;
}

// Reserva hasta `limite` eventos vencidos de los destinos indicados; otro ciclo no los toma mientras dure la reserva.
async function reservarPendientes(codigosDestino, limite, segundosReserva) {
  const { rows } = await pool.query(
    `UPDATE EVENTOS_SALIENTES ev
        SET proximo_intento_en = CURRENT_TIMESTAMP + make_interval(secs => $3)
       FROM CATALOGOS_DESTINO_INTEGRACION d
      WHERE d.id_destino = ev.id_destino
        AND ev.id_evento IN (
          SELECT e.id_evento
            FROM EVENTOS_SALIENTES e
            INNER JOIN CATALOGOS_DESTINO_INTEGRACION de ON de.id_destino = e.id_destino
           WHERE e.id_estado_evento = $4 AND e.proximo_intento_en <= CURRENT_TIMESTAMP
             AND de.codigo = ANY($1::text[])
           ORDER BY e.creado_en
           LIMIT $2
           FOR UPDATE OF e SKIP LOCKED)
      RETURNING ev.id_evento, ev.id_mensaje, ev.id_postulacion, ev.tipo_evento, ev.carga, ev.intentos,
                d.codigo AS codigo_destino, d.canal`,
    [codigosDestino, limite, segundosReserva, ESTADO_EVENTO.PENDIENTE],
  );
  return rows;
}

// Marca el evento como entregado y, en la misma sentencia, el flag de la postulación que corresponde al destino.
async function marcarEntregado(evento) {
  const flag =
    evento.codigo_destino === DESTINO.CONTABILIDAD
      ? "alta_contabilidad_enviada"
      : "alta_operativa_enviada";
  await pool.query(
    `WITH entregado AS (
       UPDATE EVENTOS_SALIENTES
          SET id_estado_evento = $2, entregado_en = CURRENT_TIMESTAMP, intentos = intentos + 1, ultimo_error = NULL
        WHERE id_evento = $1 AND id_estado_evento <> $2
        RETURNING id_postulacion)
     UPDATE POSTULACIONES p SET ${flag} = TRUE
       FROM entregado WHERE p.id_postulacion = entregado.id_postulacion`,
    [evento.id_evento, ESTADO_EVENTO.ENTREGADO],
  );
}

async function marcarError(idEvento, { error, esperaMs }) {
  await pool.query(
    `UPDATE EVENTOS_SALIENTES
        SET intentos = intentos + 1, ultimo_error = left($2, 255),
            proximo_intento_en = CURRENT_TIMESTAMP + make_interval(secs => $3)
      WHERE id_evento = $1`,
    [idEvento, error, esperaMs / 1000],
  );
}

async function listarPorPostulacion(idPostulacion) {
  const { rows } = await pool.query(
    `SELECT ev.id_evento, ev.id_mensaje, ev.tipo_evento,
            d.codigo AS codigo_destino, d.grupo, d.nombre_modulo, d.canal,
            es.codigo AS estado, ev.intentos, ev.ultimo_error, ev.proximo_intento_en, ev.entregado_en, ev.creado_en
       FROM EVENTOS_SALIENTES ev
       INNER JOIN CATALOGOS_DESTINO_INTEGRACION d ON d.id_destino = ev.id_destino
       INNER JOIN CATALOGOS_ESTADO_EVENTO es ON es.id_estado_evento = ev.id_estado_evento
      WHERE ev.id_postulacion = $1
      ORDER BY d.id_destino`,
    [idPostulacion],
  );
  return rows;
}

module.exports = {
  listarDestinos,
  obtenerDatosAlta,
  registrar,
  reservarPendientes,
  marcarEntregado,
  marcarError,
  listarPorPostulacion,
};
