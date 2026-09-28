const pool = require("../config/db");
const { ALCANCE, TIPO, ESTADO_MENSAJE, ALCANCE_ID, TIPO_ID, ESTADO_MENSAJE_ID } = require("../config/catalogos");
const { EMPLEADOS, DEPARTAMENTOS, SUCURSALES } = require("../config/datosSimulados");

// Almacén en memoria como respaldo resiliente si la BD PostgreSQL no está accesible en entorno local/test
let baseDatosConectada = null;
const memoriaStore = {
  comunicaciones: [],
  destinatarios: [],
  lecturas: [],
};

// Semilla inicial para modo memoria
function inicializarMemoria() {
  if (memoriaStore.comunicaciones.length > 0) return;

  const ahora = new Date().toISOString();
  const ayer = new Date(Date.now() - 86400000).toISOString();
  const anteayer = new Date(Date.now() - 172800000).toISOString();

  // Comunicado 1: Obligatorio general para toda la empresa
  const com1Id = "10000000-0000-0000-0000-000000000001";
  memoriaStore.comunicaciones.push({
    id_comunicacion: com1Id,
    id_tipo: TIPO_ID[TIPO.COMUNICADO],
    id_alcance: ALCANCE_ID[ALCANCE.GENERAL],
    tipo_codigo: TIPO.COMUNICADO,
    tipo_nombre: "Comunicado institucional",
    alcance_codigo: ALCANCE.GENERAL,
    alcance_nombre: "Toda la organización",
    id_usuario_remitente: "4192f252-acf0-4522-a109-e051cad9a50b",
    remitente_nombre: "Administración RRHH",
    asunto: "Actualización obligatoria de políticas de seguridad y confidencialidad 2026",
    contenido:
      "Estimado equipo: Por disposición de la Gerencia General y el Departamento de Recursos Humanos, se comunica a todo el personal que han entrado en vigor las nuevas directrices de seguridad física e informática. Es requisito mandatorio leer este documento y confirmar su recepción explícita a través de esta plataforma.",
    requiere_confirmacion: true,
    id_departamento_destino: null,
    id_sucursal_destino: null,
    cantidad_destinatarios: 4,
    fecha_envio: ayer,
    creado_en: ayer,
    actualizado_en: ayer,
  });

  // Destinatarios para com 1
  memoriaStore.destinatarios.push(
    {
      id_destinatario: "d1000000-0000-0000-0000-000000000001",
      id_comunicacion: com1Id,
      id_empleado: "4192f252-acf0-4522-a109-e051cad9a50b", // Ana Quispe
      id_estado: ESTADO_MENSAJE_ID[ESTADO_MENSAJE.CONFIRMADO],
      estado_codigo: ESTADO_MENSAJE.CONFIRMADO,
      estado_nombre: "Confirmado",
      fecha_entrega: ayer,
      fecha_lectura: ayer,
      fecha_confirmacion: ayer,
    },
    {
      id_destinatario: "d1000000-0000-0000-0000-000000000002",
      id_comunicacion: com1Id,
      id_empleado: "cb7995a6-4b23-4738-ab8b-37d0b203d73b", // Luis Rojas
      id_estado: ESTADO_MENSAJE_ID[ESTADO_MENSAJE.LEIDO],
      estado_codigo: ESTADO_MENSAJE.LEIDO,
      estado_nombre: "Leído",
      fecha_entrega: ayer,
      fecha_lectura: ahora,
      fecha_confirmacion: null, // Pendiente de confirmar recepción
    },
    {
      id_destinatario: "d1000000-0000-0000-0000-000000000003",
      id_comunicacion: com1Id,
      id_empleado: "e1a2b3c4-d5e6-4789-a012-3456789abcde", // Carlos Mendoza
      id_estado: ESTADO_MENSAJE_ID[ESTADO_MENSAJE.NO_LEIDO],
      estado_codigo: ESTADO_MENSAJE.NO_LEIDO,
      estado_nombre: "No leído",
      fecha_entrega: ayer,
      fecha_lectura: null,
      fecha_confirmacion: null,
    },
    {
      id_destinatario: "d1000000-0000-0000-0000-000000000004",
      id_comunicacion: com1Id,
      id_empleado: "f2b3c4d5-e6f7-4890-b123-456789abcdef", // Elena Gomez
      id_estado: ESTADO_MENSAJE_ID[ESTADO_MENSAJE.NO_LEIDO],
      estado_codigo: ESTADO_MENSAJE.NO_LEIDO,
      estado_nombre: "No leído",
      fecha_entrega: ayer,
      fecha_lectura: null,
      fecha_confirmacion: null,
    }
  );

  // Comunicado 2: Mensaje directo (RF-64)
  const com2Id = "20000000-0000-0000-0000-000000000002";
  memoriaStore.comunicaciones.push({
    id_comunicacion: com2Id,
    id_tipo: TIPO_ID[TIPO.DIRECTA],
    id_alcance: ALCANCE_ID[ALCANCE.INDIVIDUAL],
    tipo_codigo: TIPO.DIRECTA,
    tipo_nombre: "Comunicación directa",
    alcance_codigo: ALCANCE.INDIVIDUAL,
    alcance_nombre: "Individual / Directo",
    id_usuario_remitente: "cb7995a6-4b23-4738-ab8b-37d0b203d73b", // Luis Rojas (Supervisor)
    remitente_nombre: "Luis Rojas (Supervisor)",
    asunto: "Coordinación sobre cronograma de inventario semestral",
    contenido:
      "Hola Ana, te escribo para coordinar la verificación física del almacén central programada para el próximo lunes a primera hora. Por favor confirma tu disponibilidad para acompañar a la comisión de auditoría.",
    requiere_confirmacion: false,
    id_departamento_destino: null,
    id_sucursal_destino: null,
    cantidad_destinatarios: 1,
    fecha_envio: anteayer,
    creado_en: anteayer,
    actualizado_en: anteayer,
  });

  memoriaStore.destinatarios.push({
    id_destinatario: "d2000000-0000-0000-0000-000000000001",
    id_comunicacion: com2Id,
    id_empleado: "4192f252-acf0-4522-a109-e051cad9a50b", // Para Ana
    id_estado: ESTADO_MENSAJE_ID[ESTADO_MENSAJE.NO_LEIDO],
    estado_codigo: ESTADO_MENSAJE.NO_LEIDO,
    estado_nombre: "No leído",
    fecha_entrega: anteayer,
    fecha_lectura: null,
    fecha_confirmacion: null,
  });
}

inicializarMemoria();

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

async function verificarConexionDb() {
  if (baseDatosConectada === true) return true;
  try {
    const res = await pool.query("SELECT to_regclass('public.destinatarios_comunicacion') AS tabla;");
    if (!res.rows[0].tabla) {
      await autoInicializarTablas();
    }
    baseDatosConectada = true;
    return true;
  } catch (error) {
    baseDatosConectada = false;
    return false;
  }
}

// ==========================================
// FUNCIONES DE PERSISTENCIA
// ==========================================

async function crearComunicacion({
  idTipo,
  idAlcance,
  idUsuarioRemitente,
  remitenteNombre = "Administración",
  asunto,
  contenido,
  requiereConfirmacion = false,
  idDepartamentoDestino = null,
  idSucursalDestino = null,
  idsEmpleadosDestinatarios = [],
}) {
  const tieneDb = await verificarConexionDb();

  if (tieneDb) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Insertar comunicación
      const queryCom = `
        INSERT INTO comunicaciones (
          id_tipo, id_alcance, id_usuario_remitente, asunto, contenido,
          requiere_confirmacion, id_departamento_destino, id_sucursal_destino,
          cantidad_destinatarios, fecha_envio
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
        RETURNING *;
      `;
      const resCom = await client.query(queryCom, [
        idTipo,
        idAlcance,
        idUsuarioRemitente,
        asunto,
        contenido,
        requiereConfirmacion,
        idDepartamentoDestino,
        idSucursalDestino,
        idsEmpleadosDestinatarios.length,
      ]);
      const comunicacion = resCom.rows[0];

      // 2. Batch insert masivo y escalable usando unnest para destinatarios
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

  // Modo memoria fallback
  const idCom = crypto.randomUUID();
  const fechaEnvio = new Date().toISOString();

  // Encontrar códigos de catálogos
  const tipoCodigo = Object.keys(TIPO_ID).find((k) => TIPO_ID[k] === idTipo) || TIPO.COMUNICADO;
  const alcanceCodigo = Object.keys(ALCANCE_ID).find((k) => ALCANCE_ID[k] === idAlcance) || ALCANCE.GENERAL;

  const nuevaCom = {
    id_comunicacion: idCom,
    id_tipo: idTipo,
    id_alcance: idAlcance,
    tipo_codigo: tipoCodigo,
    tipo_nombre: tipoCodigo,
    alcance_codigo: alcanceCodigo,
    alcance_nombre: alcanceCodigo,
    id_usuario_remitente: idUsuarioRemitente,
    remitente_nombre: remitenteNombre,
    asunto,
    contenido,
    requiere_confirmacion: Boolean(requiereConfirmacion),
    id_departamento_destino: idDepartamentoDestino,
    id_sucursal_destino: idSucursalDestino,
    cantidad_destinatarios: idsEmpleadosDestinatarios.length,
    fecha_envio: fechaEnvio,
    creado_en: fechaEnvio,
    actualizado_en: fechaEnvio,
  };

  memoriaStore.comunicaciones.unshift(nuevaCom);

  for (const idEmp of idsEmpleadosDestinatarios) {
    memoriaStore.destinatarios.push({
      id_destinatario: crypto.randomUUID(),
      id_comunicacion: idCom,
      id_empleado: idEmp,
      id_estado: ESTADO_MENSAJE_ID[ESTADO_MENSAJE.NO_LEIDO],
      estado_codigo: ESTADO_MENSAJE.NO_LEIDO,
      estado_nombre: "No leído",
      fecha_entrega: fechaEnvio,
      fecha_lectura: null,
      fecha_confirmacion: null,
    });
  }

  return nuevaCom;
}

// RF-66: Listar bandeja de mensajes para el empleado ordenados de más reciente a más antiguo
async function listarBandejaEmpleado(idEmpleado, { estado, busqueda } = {}) {
  const tieneDb = await verificarConexionDb();

  if (tieneDb) {
    let filtroSql = "WHERE d.id_empleado = $1";
    const params = [idEmpleado];

    if (estado === "no_leidos") {
      params.push(ESTADO_MENSAJE_ID[ESTADO_MENSAJE.NO_LEIDO]);
      filtroSql += ` AND d.id_estado = $${params.length}`;
    } else if (estado === "leidos") {
      params.push(ESTADO_MENSAJE_ID[ESTADO_MENSAJE.NO_LEIDO]);
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
             c.id_usuario_remitente,
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
    return rows;
  }

  // Fallback memoria
  let destinatarios = memoriaStore.destinatarios.filter((d) => d.id_empleado === idEmpleado);

  if (estado === "no_leidos") {
    destinatarios = destinatarios.filter((d) => d.estado_codigo === ESTADO_MENSAJE.NO_LEIDO);
  } else if (estado === "leidos") {
    destinatarios = destinatarios.filter((d) => d.estado_codigo !== ESTADO_MENSAJE.NO_LEIDO);
  }

  const resultado = [];
  for (const d of destinatarios) {
    const c = memoriaStore.comunicaciones.find((com) => com.id_comunicacion === d.id_comunicacion);
    if (!c) continue;

    if (busqueda && busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      if (!c.asunto.toLowerCase().includes(q) && !c.contenido.toLowerCase().includes(q)) {
        continue;
      }
    }

    resultado.push({
      id_destinatario: d.id_destinatario,
      id_comunicacion: d.id_comunicacion,
      id_empleado: d.id_empleado,
      id_estado: d.id_estado,
      fecha_entrega: d.fecha_entrega,
      fecha_lectura: d.fecha_lectura,
      fecha_confirmacion: d.fecha_confirmacion,
      asunto: c.asunto,
      contenido: c.contenido,
      requiere_confirmacion: c.requiere_confirmacion,
      fecha_envio: c.fecha_envio,
      id_usuario_remitente: c.id_usuario_remitente,
      remitente_nombre: c.remitente_nombre || "Administración RRHH",
      tipo_codigo: c.tipo_codigo,
      tipo_nombre: c.tipo_nombre,
      alcance_codigo: c.alcance_codigo,
      alcance_nombre: c.alcance_nombre,
      estado_codigo: d.estado_codigo,
      estado_nombre: d.estado_nombre,
    });
  }

  // Criterio de aceptación 1 de RF-66: listarlos en orden del más reciente al más antiguo
  return resultado.sort((a, b) => new Date(b.fecha_envio) - new Date(a.fecha_envio));
}

// RF-66 AC 3: Al abrir el mensaje, se marca como leído y registra fecha de lectura
async function abrirMensaje(idDestinatario, idEmpleado) {
  const tieneDb = await verificarConexionDb();

  if (tieneDb) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Buscar el mensaje del destinatario
      const queryBuscar = `
        SELECT d.*, c.asunto, c.contenido, c.requiere_confirmacion, c.fecha_envio,
               c.id_usuario_remitente,
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

      // Si está en estado NO_LEIDO (1), actualizar a LEIDO (2) y registrar fecha_lectura
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
        mensaje.estado_codigo = ESTADO_MENSAJE.LEIDO;
        mensaje.estado_nombre = "Leído";

        // Registrar apertura en lecturas_comunicacion
        await client.query(
          `INSERT INTO lecturas_comunicacion (id_comunicacion, id_empleado, fecha_apertura, confirmo)
           VALUES ($1, $2, CURRENT_TIMESTAMP, false);`,
          [mensaje.id_comunicacion, idEmpleado]
        );
      }

      await client.query("COMMIT");
      return mensaje;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  // Fallback memoria
  const dest = memoriaStore.destinatarios.find(
    (d) => d.id_destinatario === idDestinatario && d.id_empleado === idEmpleado
  );
  if (!dest) return null;

  const com = memoriaStore.comunicaciones.find((c) => c.id_comunicacion === dest.id_comunicacion);
  if (!com) return null;

  if (dest.id_estado === ESTADO_MENSAJE_ID[ESTADO_MENSAJE.NO_LEIDO]) {
    dest.id_estado = ESTADO_MENSAJE_ID[ESTADO_MENSAJE.LEIDO];
    dest.estado_codigo = ESTADO_MENSAJE.LEIDO;
    dest.estado_nombre = "Leído";
    dest.fecha_lectura = new Date().toISOString();

    memoriaStore.lecturas.push({
      id_lectura: crypto.randomUUID(),
      id_comunicacion: com.id_comunicacion,
      id_empleado: idEmpleado,
      fecha_apertura: dest.fecha_lectura,
      confirmo: false,
      fecha_confirmacion: null,
    });
  }

  return {
    ...dest,
    asunto: com.asunto,
    contenido: com.contenido,
    requiere_confirmacion: com.requiere_confirmacion,
    fecha_envio: com.fecha_envio,
    id_usuario_remitente: com.id_usuario_remitente,
    remitente_nombre: com.remitente_nombre || "Administración RRHH",
    tipo_codigo: com.tipo_codigo,
    tipo_nombre: com.tipo_nombre,
    alcance_codigo: com.alcance_codigo,
    alcance_nombre: com.alcance_nombre,
  };
}

// RF-67 AC 1 & 2: Confirmación explícita de recepción
async function confirmarRecepcion(idDestinatario, idEmpleado) {
  const tieneDb = await verificarConexionDb();

  if (tieneDb) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const queryActualizar = `
        UPDATE destinatarios_comunicacion
        SET id_estado = 3, fecha_confirmacion = CURRENT_TIMESTAMP
        WHERE id_destinatario = $1 AND id_empleado = $2
        RETURNING *;
      `;
      const res = await client.query(queryActualizar, [idDestinatario, idEmpleado]);
      if (res.rows.length === 0) {
        await client.query("ROLLBACK");
        return null;
      }
      const dest = res.rows[0];

      // Actualizar lectura
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

  // Fallback memoria
  const dest = memoriaStore.destinatarios.find(
    (d) => d.id_destinatario === idDestinatario && d.id_empleado === idEmpleado
  );
  if (!dest) return null;

  dest.id_estado = ESTADO_MENSAJE_ID[ESTADO_MENSAJE.CONFIRMADO];
  dest.estado_codigo = ESTADO_MENSAJE.CONFIRMADO;
  dest.estado_nombre = "Confirmado";
  dest.fecha_confirmacion = new Date().toISOString();

  const lectura = memoriaStore.lecturas.find(
    (l) => l.id_comunicacion === dest.id_comunicacion && l.id_empleado === idEmpleado
  );
  if (lectura) {
    lectura.confirmo = true;
    lectura.fecha_confirmacion = dest.fecha_confirmacion;
  }

  return dest;
}

// RF-64 AC 3 & RF-65 AC 2: Listar enviados con destinatarios y fecha
async function listarEnviados(idUsuarioRemitente, { esAdminOGerente = false } = {}) {
  const tieneDb = await verificarConexionDb();

  if (tieneDb) {
    // Si es admin/gerente, ve todos los comunicados emitidos; de lo contrario, solo los propios
    const filtroSql = esAdminOGerente ? "" : "WHERE c.id_usuario_remitente = $1";
    const params = esAdminOGerente ? [] : [idUsuarioRemitente];

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
    return rows;
  }

  // Fallback memoria
  let coms = memoriaStore.comunicaciones;
  if (!esAdminOGerente && idUsuarioRemitente) {
    coms = coms.filter((c) => c.id_usuario_remitente === idUsuarioRemitente);
  }

  return coms
    .map((c) => {
      const dests = memoriaStore.destinatarios.filter((d) => d.id_comunicacion === c.id_comunicacion);
      const totalLeidos = dests.filter((d) => d.id_estado === ESTADO_MENSAJE_ID[ESTADO_MENSAJE.LEIDO]).length;
      const totalConfirmados = dests.filter(
        (d) => d.id_estado === ESTADO_MENSAJE_ID[ESTADO_MENSAJE.CONFIRMADO]
      ).length;

      // Obtener nombre del destinatario directo si aplica (RF-64 AC 3)
      let nombreDestinatarioDirecto = null;
      if (c.alcance_codigo === ALCANCE.INDIVIDUAL && dests.length > 0) {
        const emp = EMPLEADOS.find((e) => e.id_empleado === dests[0].id_empleado);
        if (emp) nombreDestinatarioDirecto = `${emp.nombres} ${emp.apellidos}`;
      }

      // Nombre departamento o sucursal si aplica
      let nombreGrupoDestino = null;
      if (c.id_departamento_destino) {
        const depto = DEPARTAMENTOS.find((dep) => dep.id_departamento === c.id_departamento_destino);
        nombreGrupoDestino = depto?.nombre;
      } else if (c.id_sucursal_destino) {
        const suc = SUCURSALES.find((s) => s.id_sucursal === c.id_sucursal_destino);
        nombreGrupoDestino = suc?.nombre;
      }

      return {
        ...c,
        nombre_destinatario_directo: nombreDestinatarioDirecto,
        nombre_grupo_destino: nombreGrupoDestino,
        total_leidos: totalLeidos,
        total_confirmados: totalConfirmados,
      };
    })
    .sort((a, b) => new Date(b.fecha_envio) - new Date(a.fecha_envio));
}

// RF-67 AC 2 & 3: Auditoría de comunicación (confirmados y pendientes)
async function obtenerAuditoriaComunicacion(idComunicacion) {
  const tieneDb = await verificarConexionDb();

  if (tieneDb) {
    // 1. Obtener comunicación
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

    // 2. Destinatarios con estado
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

    for (const d of destinatarios) {
      const emp = EMPLEADOS.find((e) => e.id_empleado === d.id_empleado);
      const registro = {
        ...d,
        nombre_empleado: emp ? `${emp.nombres} ${emp.apellidos}` : "Empleado",
        cargo: emp?.cargo ?? "Funcionario",
      };

      if (d.id_estado === 3) {
        confirmados.push(registro);
      } else {
        pendientes.push(registro);
      }
    }

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

  // Fallback memoria
  const comunicacion = memoriaStore.comunicaciones.find((c) => c.id_comunicacion === idComunicacion);
  if (!comunicacion) return null;

  const dests = memoriaStore.destinatarios.filter((d) => d.id_comunicacion === idComunicacion);
  const confirmados = [];
  const pendientes = [];

  for (const d of dests) {
    const emp = EMPLEADOS.find((e) => e.id_empleado === d.id_empleado);
    const registro = {
      ...d,
      nombre_empleado: emp ? `${emp.nombres} ${emp.apellidos}` : "Empleado",
      cargo: emp?.cargo ?? "Funcionario",
    };

    if (d.estado_codigo === ESTADO_MENSAJE.CONFIRMADO) {
      confirmados.push(registro);
    } else {
      pendientes.push(registro);
    }
  }

  return {
    comunicacion,
    metricas: {
      total: comunicacion.cantidad_destinatarios,
      confirmados: confirmados.length,
      pendientes: pendientes.length,
      leidos_sin_confirmar: pendientes.filter((p) => p.estado_codigo === ESTADO_MENSAJE.LEIDO).length,
      no_leidos: pendientes.filter((p) => p.estado_codigo === ESTADO_MENSAJE.NO_LEIDO).length,
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
