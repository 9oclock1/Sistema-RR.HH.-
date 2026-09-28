const pool = require("../config/db");
const { ErrorApp } = require("../utils/errores");
const empleadosServicio = require("../services/empleados.service");

let baseDatosInicializada = false;

// Inicializa las tablas requeridas en PostgreSQL si no existen (sin fallback en RAM)
async function autoInicializarTablas() {
  const ddl = `
    CREATE TABLE IF NOT EXISTS catalogos_alcance_comunicacion (
        id_alcance smallint NOT NULL GENERATED ALWAYS AS IDENTITY,
        codigo varchar(30) NOT NULL,
        nombre varchar(80) NOT NULL,
        CONSTRAINT uq_alcance_codigo UNIQUE (codigo),
        CONSTRAINT pk_alcance_comunicacion PRIMARY KEY (id_alcance)
    );
    CREATE TABLE IF NOT EXISTS catalogos_estado_mensaje (
        id_estado smallint NOT NULL GENERATED ALWAYS AS IDENTITY,
        codigo varchar(30) NOT NULL,
        nombre varchar(80) NOT NULL,
        CONSTRAINT uq_estado_codigo UNIQUE (codigo),
        CONSTRAINT pk_estado_mensaje PRIMARY KEY (id_estado)
    );
    CREATE TABLE IF NOT EXISTS catalogos_tipo_comunicacion (
        id_tipo smallint NOT NULL GENERATED ALWAYS AS IDENTITY,
        codigo varchar(30) NOT NULL,
        nombre varchar(80) NOT NULL,
        CONSTRAINT uq_tipo_codigo UNIQUE (codigo),
        CONSTRAINT pk_tipo_comunicacion PRIMARY KEY (id_tipo)
    );
    CREATE TABLE IF NOT EXISTS comunicaciones (
        id_comunicacion uuid NOT NULL DEFAULT gen_random_uuid(),
        id_tipo smallint NOT NULL,
        id_alcance smallint NOT NULL,
        id_usuario_remitente uuid NOT NULL,
        remitente_nombre varchar(150) NULL,
        asunto varchar(150) NOT NULL,
        contenido text NOT NULL,
        requiere_confirmacion boolean NOT NULL DEFAULT false,
        id_departamento_destino uuid NULL,
        id_sucursal_destino uuid NULL,
        cantidad_destinatarios integer NOT NULL DEFAULT 0,
        fecha_envio timestamptz NOT NULL DEFAULT current_timestamp,
        creado_en timestamptz NOT NULL DEFAULT current_timestamp,
        actualizado_en timestamptz NOT NULL DEFAULT current_timestamp,
        CONSTRAINT chk_asunto_no_vacio CHECK ((length(trim(asunto)) > 0)),
        CONSTRAINT chk_contenido_no_vacio CHECK ((length(trim(contenido)) > 0)),
        CONSTRAINT pk_comunicaciones PRIMARY KEY (id_comunicacion)
    );
    ALTER TABLE comunicaciones ADD COLUMN IF NOT EXISTS remitente_nombre varchar(150) NULL;
    CREATE TABLE IF NOT EXISTS destinatarios_comunicacion (
        id_destinatario uuid NOT NULL DEFAULT gen_random_uuid(),
        id_comunicacion uuid NOT NULL REFERENCES comunicaciones(id_comunicacion) ON DELETE CASCADE,
        id_empleado uuid NOT NULL,
        id_estado smallint NOT NULL DEFAULT 1,
        fecha_entrega timestamptz NULL DEFAULT current_timestamp,
        fecha_lectura timestamptz NULL,
        fecha_confirmacion timestamptz NULL,
        CONSTRAINT uq_comunicacion_empleado UNIQUE (id_comunicacion, id_empleado),
        CONSTRAINT pk_destinatarios PRIMARY KEY (id_destinatario)
    );
    CREATE TABLE IF NOT EXISTS lecturas_comunicacion (
        id_lectura uuid NOT NULL DEFAULT gen_random_uuid(),
        id_comunicacion uuid NOT NULL REFERENCES comunicaciones(id_comunicacion) ON DELETE CASCADE,
        id_empleado uuid NOT NULL,
        fecha_apertura timestamptz NULL DEFAULT current_timestamp,
        confirmo boolean NULL DEFAULT false,
        fecha_confirmacion timestamptz NULL,
        CONSTRAINT pk_lecturas PRIMARY KEY (id_lectura)
    );
    INSERT INTO catalogos_alcance_comunicacion (codigo, nombre) VALUES
      ('INDIVIDUAL', 'Individual / Directo'),
      ('GENERAL', 'Toda la organización'),
      ('DEPARTAMENTO', 'Por departamento'),
      ('SUCURSAL', 'Por sucursal')
    ON CONFLICT (codigo) DO NOTHING;
    INSERT INTO catalogos_tipo_comunicacion (codigo, nombre) VALUES
      ('DIRECTA', 'Comunicación directa'),
      ('COMUNICADO', 'Comunicado institucional'),
      ('CIRCULAR', 'Circular'),
      ('REGLAMENTO', 'Reglamento')
    ON CONFLICT (codigo) DO NOTHING;
    INSERT INTO catalogos_estado_mensaje (codigo, nombre) VALUES
      ('NO_LEIDO', 'No leído'),
      ('LEIDO', 'Leído'),
      ('CONFIRMADO', 'Confirmado')
    ON CONFLICT (codigo) DO NOTHING;
  `;
  await pool.query(ddl);
}

async function asegurarBaseDatos() {
  if (baseDatosInicializada) return;
  try {
    const res = await pool.query("SELECT to_regclass('public.destinatarios_comunicacion') AS tabla;");
    if (!res.rows[0].tabla) {
      await autoInicializarTablas();
    }
    baseDatosInicializada = true;
  } catch (error) {
    console.error("Error al conectar con PostgreSQL en NotificationService:", error.message);
    throw new ErrorApp(503, "No se pudo establecer conexión con la base de datos de notificaciones.");
  }
}

// ==========================================
// FUNCIONES DE PERSISTENCIA EN POSTGRESQL
// ==========================================

async function crearComunicacion({
  idTipo,
  idAlcance,
  idUsuarioRemitente,
  remitenteNombre = null,
  asunto,
  contenido,
  requiereConfirmacion = false,
  idDepartamentoDestino = null,
  idSucursalDestino = null,
  idsEmpleadosDestinatarios = [],
}) {
  await asegurarBaseDatos();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Insertar comunicación
    const queryCom = `
      INSERT INTO comunicaciones (
        id_tipo, id_alcance, id_usuario_remitente, remitente_nombre, asunto, contenido,
        requiere_confirmacion, id_departamento_destino, id_sucursal_destino,
        cantidad_destinatarios, fecha_envio
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
      RETURNING *;
    `;
    const resCom = await client.query(queryCom, [
      idTipo,
      idAlcance,
      idUsuarioRemitente,
      remitenteNombre,
      asunto,
      contenido,
      requiereConfirmacion,
      idDepartamentoDestino,
      idSucursalDestino,
      idsEmpleadosDestinatarios.length,
    ]);
    const comunicacion = resCom.rows[0];

    // 2. Batch insert escalable de destinatarios usando unnest
    if (idsEmpleadosDestinatarios.length > 0) {
      const queryDest = `
        INSERT INTO destinatarios_comunicacion (id_comunicacion, id_empleado, id_estado, fecha_entrega)
        SELECT $1, unnest($2::uuid[]), 1, CURRENT_TIMESTAMP
        ON CONFLICT (id_comunicacion, id_empleado) DO NOTHING;
      `;
      await client.query(queryDest, [comunicacion.id_comunicacion, idsEmpleadosDestinatarios]);
    }

    await client.query("COMMIT");
    return comunicacion;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// RF-66: Listar bandeja de mensajes para el empleado
async function listarBandejaEmpleado(idEmpleado, { estado, busqueda } = {}) {
  await asegurarBaseDatos();

  let filtroSql = "WHERE d.id_empleado = $1";
  const params = [idEmpleado];

  if (estado === "no_leidos") {
    params.push(1); // NO_LEIDO
    filtroSql += ` AND d.id_estado = $${params.length}`;
  } else if (estado === "leidos") {
    params.push(1); // Distinto de NO_LEIDO
    filtroSql += ` AND d.id_estado != $${params.length}`;
  }

  if (busqueda && busqueda.trim()) {
    params.push(`%${busqueda.trim()}%`);
    filtroSql += ` AND (c.asunto ILIKE $${params.length} OR c.contenido ILIKE $${params.length})`;
  }

  const query = `
    SELECT d.id_destinatario, d.id_comunicacion, d.id_empleado, d.id_estado,
           d.fecha_entrega, d.fecha_lectura, d.fecha_confirmacion,
           c.asunto, c.contenido, c.requiere_confirmacion, c.fecha_envio,
           c.id_usuario_remitente, c.remitente_nombre,
           t.codigo AS tipo_codigo, t.nombre AS tipo_nombre,
           a.codigo AS alcance_codigo, a.nombre AS alcance_nombre,
           e.codigo AS estado_codigo, e.nombre AS estado_nombre
    FROM destinatarios_comunicacion d
    JOIN comunicaciones c ON d.id_comunicacion = c.id_comunicacion
    JOIN catalogos_tipo_comunicacion t ON c.id_tipo = t.id_tipo
    JOIN catalogos_alcance_comunicacion a ON c.id_alcance = a.id_alcance
    JOIN catalogos_estado_mensaje e ON d.id_estado = e.id_estado
    ${filtroSql}
    ORDER BY c.fecha_envio DESC;
  `;
  const { rows } = await pool.query(query, params);

  // Enriquecer cada mensaje con el nombre real del remitente si falta
  const filasConRemitente = await Promise.all(
    rows.map(async (r) => {
      let remitente = r.remitente_nombre;
      if (!remitente || remitente === "Administración de RRHH") {
        if (r.tipo_codigo === "DIRECTA" || r.alcance_codigo === "INDIVIDUAL") {
          const datosRem = await empleadosServicio.obtenerNombreEmpleado(r.id_usuario_remitente);
          remitente = datosRem
            ? `${datosRem.nombre_completo} (${datosRem.cargo || "Supervisor"})`
            : "Supervisor / RRHH";
        } else {
          remitente = r.remitente_nombre || "Administración de RRHH";
        }
      }
      return {
        ...r,
        remitente_nombre: remitente,
      };
    })
  );

  return filasConRemitente;
}

// RF-66 AC 3: Apertura de mensaje (marcado a leído automático con fecha)
async function abrirMensaje(idDestinatario, idEmpleado) {
  await asegurarBaseDatos();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const queryBuscar = `
      SELECT d.*, c.asunto, c.contenido, c.requiere_confirmacion, c.fecha_envio,
             c.id_usuario_remitente, c.remitente_nombre,
             t.codigo AS tipo_codigo, t.nombre AS tipo_nombre,
             a.codigo AS alcance_codigo, a.nombre AS alcance_nombre,
             e.codigo AS estado_codigo, e.nombre AS estado_nombre
      FROM destinatarios_comunicacion d
      JOIN comunicaciones c ON d.id_comunicacion = c.id_comunicacion
      JOIN catalogos_tipo_comunicacion t ON c.id_tipo = t.id_tipo
      JOIN catalogos_alcance_comunicacion a ON c.id_alcance = a.id_alcance
      JOIN catalogos_estado_mensaje e ON d.id_estado = e.id_estado
      WHERE d.id_destinatario = $1 AND d.id_empleado = $2;
    `;
    const res = await client.query(queryBuscar, [idDestinatario, idEmpleado]);
    if (res.rows.length === 0) {
      await client.query("ROLLBACK");
      return null;
    }
    const mensaje = res.rows[0];

    // Si está no leído (1), actualizar a leído (2) y registrar fecha_lectura
    if (mensaje.id_estado === 1) {
      const queryActualizar = `
        UPDATE destinatarios_comunicacion
        SET id_estado = 2, fecha_lectura = CURRENT_TIMESTAMP
        WHERE id_destinatario = $1
        RETURNING fecha_lectura, id_estado;
      `;
      const resAct = await client.query(queryActualizar, [idDestinatario]);
      mensaje.fecha_lectura = resAct.rows[0].fecha_lectura;
      mensaje.id_estado = 2;
      mensaje.estado_codigo = "LEIDO";
      mensaje.estado_nombre = "Leído";

      // Registrar apertura en lecturas_comunicacion
      await client.query(
        `INSERT INTO lecturas_comunicacion (id_comunicacion, id_empleado, fecha_apertura, confirmo)
         VALUES ($1, $2, CURRENT_TIMESTAMP, false);`,
        [mensaje.id_comunicacion, idEmpleado]
      );
    }

    await client.query("COMMIT");

    // Enriquecer con nombre del remitente si no viene en c.remitente_nombre
    if (!mensaje.remitente_nombre || (mensaje.remitente_nombre === "Administración de RRHH" && (mensaje.tipo_codigo === "DIRECTA" || mensaje.alcance_codigo === "INDIVIDUAL"))) {
      const datosRemitente = await empleadosServicio.obtenerNombreEmpleado(mensaje.id_usuario_remitente);
      if (datosRemitente) {
        mensaje.remitente_nombre = `${datosRemitente.nombre_completo} (${datosRemitente.cargo || "Supervisor"})`;
      } else if (!mensaje.remitente_nombre) {
        mensaje.remitente_nombre = "Administración de RRHH";
      }
    }

    return mensaje;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// RF-67 AC 1 & 2: Confirmación explícita de recepción (con validaciones estrictas)
async function confirmarRecepcion(idDestinatario, idEmpleado) {
  await asegurarBaseDatos();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Obtener estado actual del mensaje y si requiere confirmación
    const queryVerificar = `
      SELECT d.*, c.requiere_confirmacion, c.asunto
      FROM destinatarios_comunicacion d
      JOIN comunicaciones c ON d.id_comunicacion = c.id_comunicacion
      WHERE d.id_destinatario = $1 AND d.id_empleado = $2;
    `;
    const resVer = await client.query(queryVerificar, [idDestinatario, idEmpleado]);
    if (resVer.rows.length === 0) {
      await client.query("ROLLBACK");
      throw new ErrorApp(404, "El mensaje solicitado no existe en su bandeja de entrada.");
    }

    const reg = resVer.rows[0];

    // Validación: No permitir confirmar mensajes que no son obligatorios
    if (!reg.requiere_confirmacion) {
      await client.query("ROLLBACK");
      throw new ErrorApp(400, "Esta comunicación no requiere confirmación obligatoria de recepción.");
    }

    // Validación: No sobreescribir confirmación si ya fue confirmada previamente (preserva fecha de auditoría)
    if (reg.id_estado === 3 || reg.fecha_confirmacion !== null) {
      await client.query("ROLLBACK");
      throw new ErrorApp(
        409,
        `La recepción de este comunicado ya fue confirmada previamente el ${new Date(reg.fecha_confirmacion).toLocaleString("es-BO")}.`
      );
    }

    // Actualizar destinatario: marcar estado 3, registrar fecha_confirmacion y garantizar fecha_lectura
    const queryActualizar = `
      UPDATE destinatarios_comunicacion
      SET id_estado = 3,
          fecha_confirmacion = CURRENT_TIMESTAMP,
          fecha_lectura = COALESCE(fecha_lectura, CURRENT_TIMESTAMP)
      WHERE id_destinatario = $1 AND id_empleado = $2
      RETURNING *;
    `;
    const res = await client.query(queryActualizar, [idDestinatario, idEmpleado]);
    const dest = res.rows[0];

    // Actualizar o insertar registro en lecturas_comunicacion
    await client.query(
      `INSERT INTO lecturas_comunicacion (id_comunicacion, id_empleado, fecha_apertura, confirmo, fecha_confirmacion)
       VALUES ($1, $2, COALESCE($3, CURRENT_TIMESTAMP), true, CURRENT_TIMESTAMP)
       ON CONFLICT DO NOTHING;`,
      [dest.id_comunicacion, idEmpleado, dest.fecha_lectura]
    );

    await client.query(
      `UPDATE lecturas_comunicacion
       SET confirmo = true, fecha_confirmacion = CURRENT_TIMESTAMP
       WHERE id_comunicacion = $1 AND id_empleado = $2;`,
      [dest.id_comunicacion, idEmpleado]
    );

    await client.query("COMMIT");
    return dest;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// RF-64 AC 3 & RF-65 AC 2: Consulta de enviados con nombres de destinatarios y grupos resueltos
async function listarEnviados(idUsuarioRemitente, { esAdminOGerente = false } = {}) {
  await asegurarBaseDatos();

  const filtroSql = esAdminOGerente && !idUsuarioRemitente ? "" : "WHERE c.id_usuario_remitente = $1";
  const params = esAdminOGerente && !idUsuarioRemitente ? [] : [idUsuarioRemitente];

  const query = `
    SELECT c.*,
           t.codigo AS tipo_codigo, t.nombre AS tipo_nombre,
           a.codigo AS alcance_codigo, a.nombre AS alcance_nombre,
           (SELECT COUNT(*) FROM destinatarios_comunicacion d WHERE d.id_comunicacion = c.id_comunicacion AND d.id_estado = 2) AS total_leidos,
           (SELECT COUNT(*) FROM destinatarios_comunicacion d WHERE d.id_comunicacion = c.id_comunicacion AND d.id_estado = 3) AS total_confirmados
    FROM comunicaciones c
    JOIN catalogos_tipo_comunicacion t ON c.id_tipo = t.id_tipo
    JOIN catalogos_alcance_comunicacion a ON c.id_alcance = a.id_alcance
    ${filtroSql}
    ORDER BY c.fecha_envio DESC;
  `;
  const { rows } = await pool.query(query, params);

  // Obtener catálogos de departamentos y sucursales para mapear nombres de grupos
  const [departamentos, sucursales] = await Promise.all([
    empleadosServicio.listarDepartamentos(),
    empleadosServicio.listarSucursales(),
  ]);

  const mapaDepartamentos = {};
  departamentos.forEach((d) => (mapaDepartamentos[d.id_departamento] = d.nombre));

  const mapaSucursales = {};
  sucursales.forEach((s) => (mapaSucursales[s.id_sucursal] = s.nombre));

  // Resolver destinatarios directos para comunicaciones individuales
  const filasEnriquecidas = await Promise.all(
    rows.map(async (c) => {
      let nombre_destinatario_directo = null;
      let nombre_grupo_destino = null;

      if (c.alcance_codigo === "INDIVIDUAL") {
        const resDest = await pool.query(
          "SELECT id_empleado FROM destinatarios_comunicacion WHERE id_comunicacion = $1 LIMIT 1;",
          [c.id_comunicacion]
        );
        if (resDest.rows.length > 0) {
          const emp = await empleadosServicio.obtenerNombreEmpleado(resDest.rows[0].id_empleado);
          nombre_destinatario_directo = emp ? emp.nombre_completo : "Empleado";
        }
      } else if (c.alcance_codigo === "DEPARTAMENTO") {
        nombre_grupo_destino = mapaDepartamentos[c.id_departamento_destino]
          ? `Departamento: ${mapaDepartamentos[c.id_departamento_destino]}`
          : "Por departamento";
      } else if (c.alcance_codigo === "SUCURSAL") {
        nombre_grupo_destino = mapaSucursales[c.id_sucursal_destino]
          ? `Sucursal: ${mapaSucursales[c.id_sucursal_destino]}`
          : "Por sucursal";
      } else if (c.alcance_codigo === "GENERAL") {
        nombre_grupo_destino = "Toda la organización";
      }

      return {
        ...c,
        nombre_destinatario_directo,
        nombre_grupo_destino,
      };
    })
  );

  return filasEnriquecidas;
}

// RF-67 AC 2 & 3: Auditoría detallada con nombres reales de empleados
async function obtenerAuditoriaComunicacion(idComunicacion) {
  await asegurarBaseDatos();

  const queryCom = `
    SELECT c.*,
           t.codigo AS tipo_codigo, t.nombre AS tipo_nombre,
           a.codigo AS alcance_codigo, a.nombre AS alcance_nombre
    FROM comunicaciones c
    JOIN catalogos_tipo_comunicacion t ON c.id_tipo = t.id_tipo
    JOIN catalogos_alcance_comunicacion a ON c.id_alcance = a.id_alcance
    WHERE c.id_comunicacion = $1;
  `;
  const resCom = await pool.query(queryCom, [idComunicacion]);
  if (resCom.rows.length === 0) return null;
  const comunicacion = resCom.rows[0];

  const queryDests = `
    SELECT d.id_destinatario, d.id_empleado, d.id_estado, d.fecha_entrega, d.fecha_lectura, d.fecha_confirmacion,
           e.codigo AS estado_codigo, e.nombre AS estado_nombre
    FROM destinatarios_comunicacion d
    JOIN catalogos_estado_mensaje e ON d.id_estado = e.id_estado
    WHERE d.id_comunicacion = $1
    ORDER BY d.fecha_confirmacion DESC NULLS LAST, d.fecha_lectura DESC NULLS LAST;
  `;
  const resDests = await pool.query(queryDests, [idComunicacion]);
  const destinatarios = resDests.rows;

  const confirmados = [];
  const pendientes = [];

  await Promise.all(
    destinatarios.map(async (d) => {
      const emp = await empleadosServicio.obtenerEmpleado(d.id_empleado);
      const registro = {
        ...d,
        nombre_empleado: emp ? emp.nombre_completo : "Empleado",
        cargo: emp?.cargo || "Funcionario",
      };

      if (d.id_estado === 3) {
        confirmados.push(registro);
      } else {
        pendientes.push(registro);
      }
    })
  );

  // Ordenar listas
  confirmados.sort((a, b) => new Date(b.fecha_confirmacion) - new Date(a.fecha_confirmacion));
  pendientes.sort((a, b) => (b.nombre_empleado || "").localeCompare(a.nombre_empleado || ""));

  return {
    comunicacion,
    metricas: {
      total: comunicacion.cantidad_destinatarios,
      confirmados: confirmados.length,
      pendientes: pendientes.length,
      leidos_sin_confirmar: pendientes.filter((p) => p.id_estado === 2).length,
      no_leidos: pendientes.filter((p) => p.id_estado === 1).length,
    },
    confirmados,
    pendientes,
  };
}

module.exports = {
  crearComunicacion,
  listarBandejaEmpleado,
  abrirMensaje,
  confirmarRecepcion,
  listarEnviados,
  obtenerAuditoriaComunicacion,
};
