const { NIVELES_SALARIALES } = require('../utils/nivelesSalariales');

const obtenerResumen = async (db, idEmpleado) => {
  const { rows } = await db.query('SELECT * FROM vw_kardex_resumen WHERE id_empleado = $1', [idEmpleado]);
  return rows[0] || null;
};

const listarContratos = async (db, idEmpleado) => {
  const { rows } = await db.query(
    `SELECT k.id_contrato,
            k.numero_contrato,
            tc.codigo AS tipo_contrato_codigo,
            tc.nombre AS tipo_contrato,
            tj.nombre AS tipo_jornada,
            tj.horas_semanales,
            lower(k.periodo_vigencia) AS fecha_inicio,
            upper(k.periodo_vigencia) - 1 AS fecha_fin,
            (k.periodo_vigencia @> CURRENT_DATE) AS esta_vigente,
            k.haber_mensual_pactado,
            k.documento_adjunto_url,
            k.es_adenda,
            k.motivo_adenda,
            k.registrado_en
       FROM contratos k
       JOIN tipos_contrato tc ON tc.id_tipo_contrato = k.id_tipo_contrato
       JOIN tipos_jornada tj  ON tj.id_tipo_jornada = k.id_tipo_jornada
      WHERE k.id_empleado = $1
      ORDER BY lower(k.periodo_vigencia) DESC NULLS LAST, k.registrado_en DESC`,
    [idEmpleado]
  );
  return rows;
};

const listarTrayectoria = async (db, idEmpleado) => {
  const { rows } = await db.query(
    `SELECT a.id_asignacion,
            a.fecha_inicio,
            a.fecha_fin,
            a.es_vigente,
            a.id_cargo,
            c.nombre AS cargo,
            c.nivel_salarial,
            d.nombre AS area,
            a.id_sucursal,
            s.nombre AS sucursal,
            s.ciudad AS sucursal_ciudad,
            LAG(c.nombre) OVER w AS cargo_anterior,
            LAG(s.nombre) OVER w AS sucursal_anterior,
            COALESCE(a.id_cargo <> LAG(a.id_cargo) OVER w, FALSE) AS cambio_cargo,
            COALESCE(a.id_sucursal <> LAG(a.id_sucursal) OVER w, FALSE) AS cambio_sucursal,
            COALESCE(
              array_position($2::text[], c.nivel_salarial::text)
                > LAG(array_position($2::text[], c.nivel_salarial::text)) OVER w,
              FALSE
            ) AS es_ascenso
       FROM asignaciones_empleado a
       JOIN cargos c        ON c.id_cargo = a.id_cargo
       JOIN departamentos d ON d.id_departamento = c.id_departamento
       JOIN sucursales s    ON s.id_sucursal = a.id_sucursal
      WHERE a.id_empleado = $1
     WINDOW w AS (ORDER BY a.fecha_inicio, a.registrado_en)
      ORDER BY a.fecha_inicio, a.registrado_en`,
    [idEmpleado, NIVELES_SALARIALES]
  );
  return rows;
};

const listarMemorandums = async (db, idEmpleado) => {
  const { rows } = await db.query(
    `SELECT m.id_memorandum,
            m.codigo_cite,
            m.asunto,
            m.contenido_descripcion,
            m.fecha_emision,
            t.nombre AS tipo_nombre,
            t.clasificacion AS tipo_clasificacion,
            (m.naturaleza_falta IS NULL) AS es_reconocimiento,
            m.naturaleza_falta,
            m.gravedad_falta,
            m.estado_sancion,
            m.evidencia_adjunto_url,
            m.documento_pdf_url,
            m.fue_notificado,
            m.fecha_hora_notificacion,
            m.acuse_recibo_firmado,
            m.fecha_hora_acuse,
            concat_ws(' ', em.nombres, em.primer_apellido, em.segundo_apellido) AS emisor_nombre
       FROM memorandums m
       JOIN tipos_memorandum t ON t.id_tipo_memo = m.id_tipo_memo
       JOIN empleados em       ON em.id_empleado = m.id_empleado_emisor
      WHERE m.id_empleado_receptor = $1
        AND m.estado_sancion <> 'ANULADO'
      ORDER BY m.fecha_emision DESC, m.numero_correlativo DESC`,
    [idEmpleado]
  );
  return rows;
};

const listarCapacitaciones = async (db, idEmpleado) => {
  const { rows } = await db.query(
    `SELECT cc.id_capacitacion,
            cu.id_curso,
            cu.codigo AS curso_codigo,
            cu.nombre AS curso,
            cu.horas_academicas,
            cc.institucion_emisora,
            cc.fecha_emision,
            cc.fecha_vencimiento,
            (cc.fecha_vencimiento IS NULL OR cc.fecha_vencimiento >= CURRENT_DATE) AS esta_vigente,
            cc.certificado_adjunto_url
       FROM capacitaciones_certificacion cc
       JOIN cursos_capacitacion cu ON cu.id_curso = cc.id_curso
      WHERE cc.id_empleado = $1
      ORDER BY cc.fecha_emision DESC, cc.registrado_en DESC`,
    [idEmpleado]
  );
  return rows;
};

module.exports = { obtenerResumen, listarContratos, listarTrayectoria, listarMemorandums, listarCapacitaciones };
