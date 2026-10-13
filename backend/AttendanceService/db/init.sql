-- extensiones
-- btree_gist: permite combinar UUID y rangos de fechas en una restricción EXCLUDE.
CREATE EXTENSION IF NOT EXISTS btree_gist;
-- tablas
-- Tabla: CATALOGOS_TIPO_JORNADA
CREATE TABLE CATALOGOS_TIPO_JORNADA (
    id_tipo_jornada SMALLINT NOT NULL,
    codigo varchar(30) NOT NULL,
    nombre varchar(60) NOT NULL,
    CONSTRAINT CATALOGOS_TIPO_JORNADA_pk PRIMARY KEY (id_tipo_jornada),
    CONSTRAINT uq_tipo_jornada_codigo UNIQUE (codigo)
);
-- Tabla: TURNOS
CREATE TABLE TURNOS (
    id_turno UUID NOT NULL DEFAULT gen_random_uuid(),
    id_tipo_jornada SMALLINT NOT NULL,
    nombre varchar(60) NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    minutos_refrigerio SMALLINT NOT NULL DEFAULT 0,
    minutos_tolerancia SMALLINT NOT NULL DEFAULT 0,
    esta_activo boolean NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT TURNOS_pk PRIMARY KEY (id_turno),
    CONSTRAINT uq_turno_nombre UNIQUE (nombre),
    CONSTRAINT chk_turno_horas_distintas CHECK (hora_inicio <> hora_fin),
    CONSTRAINT chk_turno_refrigerio CHECK (minutos_refrigerio >= 0),
    CONSTRAINT chk_turno_tolerancia CHECK (minutos_tolerancia >= 0)
);
-- Tabla: ASIGNACIONES_TURNO
CREATE TABLE ASIGNACIONES_TURNO (
    id_asignacion UUID NOT NULL DEFAULT gen_random_uuid(),
    id_turno UUID NOT NULL,
    id_empleado UUID NOT NULL,
    fecha_desde date NOT NULL,
    fecha_hasta date NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ASIGNACIONES_TURNO_pk PRIMARY KEY (id_asignacion),
    CONSTRAINT chk_asignacion_fechas CHECK (
        fecha_hasta IS NULL
        OR fecha_hasta >= fecha_desde
    )
);
CREATE INDEX idx_asignaciones_turno_id_turno ON ASIGNACIONES_TURNO (id_turno);
-- Tabla: CATALOGOS_TIPO_MARCAJE
CREATE TABLE CATALOGOS_TIPO_MARCAJE (
    id_tipo_marcaje SMALLINT NOT NULL,
    codigo varchar(30) NOT NULL,
    nombre varchar(60) NOT NULL,
    CONSTRAINT CATALOGOS_TIPO_MARCAJE_pk PRIMARY KEY (id_tipo_marcaje),
    CONSTRAINT uq_tipo_marcaje_codigo UNIQUE (codigo)
);
-- Tabla: CATALOGOS_ORIGEN_MARCAJE
CREATE TABLE CATALOGOS_ORIGEN_MARCAJE (
    id_origen_marcaje SMALLINT NOT NULL,
    codigo varchar(30) NOT NULL,
    nombre varchar(60) NOT NULL,
    CONSTRAINT CATALOGOS_ORIGEN_MARCAJE_pk PRIMARY KEY (id_origen_marcaje),
    CONSTRAINT uq_origen_marcaje_codigo UNIQUE (codigo)
);
-- Tabla: CATALOGOS_ESTADO_MARCAJE
CREATE TABLE CATALOGOS_ESTADO_MARCAJE (
    id_estado_marcaje SMALLINT NOT NULL,
    codigo varchar(30) NOT NULL,
    nombre varchar(60) NOT NULL,
    CONSTRAINT CATALOGOS_ESTADO_MARCAJE_pk PRIMARY KEY (id_estado_marcaje),
    CONSTRAINT uq_estado_marcaje_codigo UNIQUE (codigo)
);
-- Tabla: MARCAJES
CREATE TABLE MARCAJES (
    id_marcaje UUID NOT NULL DEFAULT gen_random_uuid(),
    id_empleado UUID NOT NULL,
    id_tipo_marcaje SMALLINT NOT NULL,
    id_origen_marcaje SMALLINT NOT NULL,
    id_estado_marcaje SMALLINT NOT NULL DEFAULT 1,
    fecha_hora_marcaje TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_jornada date NOT NULL,
    codigo_dispositivo varchar(40) NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT MARCAJES_pk PRIMARY KEY (id_marcaje),
    CONSTRAINT uq_marcaje_empleado_tipo_jornada UNIQUE (id_empleado, id_tipo_marcaje, fecha_jornada)
);
-- Tabla: CATALOGOS_PERIODO_ROL
CREATE TABLE CATALOGOS_PERIODO_ROL (
    id_periodo_rol SMALLINT NOT NULL,
    codigo varchar(30) NOT NULL,
    nombre varchar(60) NOT NULL,
    CONSTRAINT CATALOGOS_PERIODO_ROL_pk PRIMARY KEY (id_periodo_rol),
    CONSTRAINT uq_periodo_rol_codigo UNIQUE (codigo)
);
-- Tabla: CATALOGOS_ESTADO_ROL
CREATE TABLE CATALOGOS_ESTADO_ROL (
    id_estado_rol SMALLINT NOT NULL,
    codigo varchar(30) NOT NULL,
    nombre varchar(60) NOT NULL,
    CONSTRAINT CATALOGOS_ESTADO_ROL_pk PRIMARY KEY (id_estado_rol),
    CONSTRAINT uq_estado_rol_codigo UNIQUE (codigo)
);
-- Tabla: ROLES_TURNO
-- Rol de turnos rotativos de un área en una sucursal para una semana o un mes.
CREATE TABLE ROLES_TURNO (
    id_rol UUID NOT NULL DEFAULT gen_random_uuid(),
    id_sucursal UUID NOT NULL,
    id_departamento UUID NOT NULL,
    id_periodo_rol SMALLINT NOT NULL,
    fecha_inicio date NOT NULL,
    fecha_fin date NOT NULL,
    id_estado_rol SMALLINT NOT NULL DEFAULT 1,
    version_publicada int NOT NULL DEFAULT 0,
    tiene_cambios_sin_publicar boolean NOT NULL DEFAULT FALSE,
    publicado_en TIMESTAMPTZ NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ROLES_TURNO_pk PRIMARY KEY (id_rol),
    CONSTRAINT chk_rol_fechas CHECK (fecha_fin >= fecha_inicio),
    CONSTRAINT chk_rol_version CHECK (version_publicada >= 0),
    -- Un área de una sucursal no puede tener dos roles con días en común.
    CONSTRAINT ex_rol_sin_solapamiento EXCLUDE USING gist (
        id_sucursal WITH =,
        id_departamento WITH =,
        daterange(fecha_inicio, fecha_fin, '[]') WITH &&
    )
);
-- Tabla: ASIGNACIONES_ROL_TURNO
-- Borrador del rol: un turno o un descanso por empleado y día.
CREATE TABLE ASIGNACIONES_ROL_TURNO (
    id_asignacion_rol UUID NOT NULL DEFAULT gen_random_uuid(),
    id_rol UUID NOT NULL,
    id_empleado UUID NOT NULL,
    fecha date NOT NULL,
    id_turno UUID NULL,
    es_descanso boolean NOT NULL DEFAULT FALSE,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ASIGNACIONES_ROL_TURNO_pk PRIMARY KEY (id_asignacion_rol),
    CONSTRAINT uq_asignacion_rol_empleado_fecha UNIQUE (id_rol, id_empleado, fecha),
    CONSTRAINT chk_asignacion_rol_turno_o_descanso CHECK (es_descanso = (id_turno IS NULL))
);
CREATE INDEX idx_asignaciones_rol_turno_empleado_fecha ON ASIGNACIONES_ROL_TURNO (id_empleado, fecha);
CREATE INDEX idx_asignaciones_rol_turno_id_turno ON ASIGNACIONES_ROL_TURNO (id_turno);
-- Tabla: TURNOS_PUBLICADOS
-- Copia del rol al publicarse: es lo que ve el colaborador en su portal.
CREATE TABLE TURNOS_PUBLICADOS (
    id_turno_publicado UUID NOT NULL DEFAULT gen_random_uuid(),
    id_rol UUID NOT NULL,
    id_empleado UUID NOT NULL,
    fecha date NOT NULL,
    id_turno UUID NULL,
    es_descanso boolean NOT NULL DEFAULT FALSE,
    nombre_turno varchar(60) NULL,
    hora_inicio TIME NULL,
    hora_fin TIME NULL,
    publicado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT TURNOS_PUBLICADOS_pk PRIMARY KEY (id_turno_publicado),
    -- Un empleado tiene un solo turno publicado por día, aunque cambie de área.
    CONSTRAINT uq_turno_publicado_empleado_fecha UNIQUE (id_empleado, fecha),
    CONSTRAINT chk_turno_publicado_turno_o_descanso CHECK (
        es_descanso = (id_turno IS NULL)
        AND (
            es_descanso
            OR (
                nombre_turno IS NOT NULL
                AND hora_inicio IS NOT NULL
                AND hora_fin IS NOT NULL
            )
        )
    )
);
CREATE INDEX idx_turnos_publicados_id_rol ON TURNOS_PUBLICADOS (id_rol);
CREATE INDEX idx_turnos_publicados_id_turno ON TURNOS_PUBLICADOS (id_turno);
-- Tabla: CATALOGOS_ESTADO_EVENTO
CREATE TABLE CATALOGOS_ESTADO_EVENTO (
    id_estado_evento SMALLINT NOT NULL,
    codigo varchar(30) NOT NULL,
    nombre varchar(60) NOT NULL,
    CONSTRAINT CATALOGOS_ESTADO_EVENTO_pk PRIMARY KEY (id_estado_evento),
    CONSTRAINT uq_estado_evento_codigo UNIQUE (codigo)
);
-- Tabla: EVENTOS_SALIENTES
-- Eventos para otros módulos; se guardan junto con el cambio y se envían después.
CREATE TABLE EVENTOS_SALIENTES (
    id_evento UUID NOT NULL DEFAULT gen_random_uuid(),
    topico varchar(60) NOT NULL,
    tipo_evento varchar(60) NOT NULL,
    id_rol UUID NULL,
    carga JSONB NOT NULL,
    id_estado_evento SMALLINT NOT NULL DEFAULT 1,
    intentos SMALLINT NOT NULL DEFAULT 0,
    ultimo_error varchar(255) NULL,
    proximo_intento_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    entregado_en TIMESTAMPTZ NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT EVENTOS_SALIENTES_pk PRIMARY KEY (id_evento),
    CONSTRAINT chk_evento_intentos CHECK (intentos >= 0)
);
CREATE INDEX idx_eventos_salientes_pendientes ON EVENTOS_SALIENTES (id_estado_evento, proximo_intento_en);
CREATE INDEX idx_eventos_salientes_id_rol ON EVENTOS_SALIENTES (id_rol);
-- llaves foráneas
-- Referencia: TURNOS_CATALOGOS_TIPO_JORNADA (tabla: TURNOS)
ALTER TABLE TURNOS
ADD CONSTRAINT TURNOS_CATALOGOS_TIPO_JORNADA FOREIGN KEY (id_tipo_jornada) REFERENCES CATALOGOS_TIPO_JORNADA (id_tipo_jornada) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Referencia: ASIGNACIONES_TURNO_TURNOS (tabla: ASIGNACIONES_TURNO)
ALTER TABLE ASIGNACIONES_TURNO
ADD CONSTRAINT ASIGNACIONES_TURNO_TURNOS FOREIGN KEY (id_turno) REFERENCES TURNOS (id_turno) ON DELETE RESTRICT NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Referencia: MARCAJES_CATALOGOS_TIPO_MARCAJE (tabla: MARCAJES)
ALTER TABLE MARCAJES
ADD CONSTRAINT MARCAJES_CATALOGOS_TIPO_MARCAJE FOREIGN KEY (id_tipo_marcaje) REFERENCES CATALOGOS_TIPO_MARCAJE (id_tipo_marcaje) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Referencia: MARCAJES_CATALOGOS_ORIGEN_MARCAJE (tabla: MARCAJES)
ALTER TABLE MARCAJES
ADD CONSTRAINT MARCAJES_CATALOGOS_ORIGEN_MARCAJE FOREIGN KEY (id_origen_marcaje) REFERENCES CATALOGOS_ORIGEN_MARCAJE (id_origen_marcaje) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Referencia: MARCAJES_CATALOGOS_ESTADO_MARCAJE (tabla: MARCAJES)
ALTER TABLE MARCAJES
ADD CONSTRAINT MARCAJES_CATALOGOS_ESTADO_MARCAJE FOREIGN KEY (id_estado_marcaje) REFERENCES CATALOGOS_ESTADO_MARCAJE (id_estado_marcaje) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Referencia: ROLES_TURNO_CATALOGOS_PERIODO_ROL (tabla: ROLES_TURNO)
ALTER TABLE ROLES_TURNO
ADD CONSTRAINT ROLES_TURNO_CATALOGOS_PERIODO_ROL FOREIGN KEY (id_periodo_rol) REFERENCES CATALOGOS_PERIODO_ROL (id_periodo_rol) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Referencia: ROLES_TURNO_CATALOGOS_ESTADO_ROL (tabla: ROLES_TURNO)
ALTER TABLE ROLES_TURNO
ADD CONSTRAINT ROLES_TURNO_CATALOGOS_ESTADO_ROL FOREIGN KEY (id_estado_rol) REFERENCES CATALOGOS_ESTADO_ROL (id_estado_rol) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Referencia: ASIGNACIONES_ROL_TURNO_ROLES_TURNO (tabla: ASIGNACIONES_ROL_TURNO)
ALTER TABLE ASIGNACIONES_ROL_TURNO
ADD CONSTRAINT ASIGNACIONES_ROL_TURNO_ROLES_TURNO FOREIGN KEY (id_rol) REFERENCES ROLES_TURNO (id_rol) ON DELETE CASCADE NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Referencia: ASIGNACIONES_ROL_TURNO_TURNOS (tabla: ASIGNACIONES_ROL_TURNO)
ALTER TABLE ASIGNACIONES_ROL_TURNO
ADD CONSTRAINT ASIGNACIONES_ROL_TURNO_TURNOS FOREIGN KEY (id_turno) REFERENCES TURNOS (id_turno) ON DELETE RESTRICT NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Referencia: TURNOS_PUBLICADOS_ROLES_TURNO (tabla: TURNOS_PUBLICADOS)
ALTER TABLE TURNOS_PUBLICADOS
ADD CONSTRAINT TURNOS_PUBLICADOS_ROLES_TURNO FOREIGN KEY (id_rol) REFERENCES ROLES_TURNO (id_rol) ON DELETE RESTRICT NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Referencia: TURNOS_PUBLICADOS_TURNOS (tabla: TURNOS_PUBLICADOS)
ALTER TABLE TURNOS_PUBLICADOS
ADD CONSTRAINT TURNOS_PUBLICADOS_TURNOS FOREIGN KEY (id_turno) REFERENCES TURNOS (id_turno) ON DELETE RESTRICT NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Referencia: EVENTOS_SALIENTES_CATALOGOS_ESTADO_EVENTO (tabla: EVENTOS_SALIENTES)
ALTER TABLE EVENTOS_SALIENTES
ADD CONSTRAINT EVENTOS_SALIENTES_CATALOGOS_ESTADO_EVENTO FOREIGN KEY (id_estado_evento) REFERENCES CATALOGOS_ESTADO_EVENTO (id_estado_evento) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- datos iniciales
INSERT INTO CATALOGOS_TIPO_JORNADA (id_tipo_jornada, codigo, nombre)
VALUES (1, 'DIURNO', 'Diurno'),
    (2, 'VESPERTINO', 'Vespertino'),
    (3, 'NOCTURNO', 'Nocturno');
INSERT INTO CATALOGOS_TIPO_MARCAJE (id_tipo_marcaje, codigo, nombre)
VALUES (1, 'ENTRADA', 'Entrada'),
    (2, 'SALIDA', 'Salida');
INSERT INTO CATALOGOS_ORIGEN_MARCAJE (id_origen_marcaje, codigo, nombre)
VALUES (1, 'PORTAL', 'Portal'),
    (2, 'BIOMETRICO', 'Biométrico');
INSERT INTO CATALOGOS_ESTADO_MARCAJE (id_estado_marcaje, codigo, nombre)
VALUES (1, 'REGISTRADO', 'Registrado'),
    (
        2,
        'PENDIENTE_JUSTIFICACION',
        'Pendiente de justificación'
    );
INSERT INTO CATALOGOS_PERIODO_ROL (id_periodo_rol, codigo, nombre)
VALUES (1, 'SEMANAL', 'Semanal'),
    (2, 'MENSUAL', 'Mensual');
INSERT INTO CATALOGOS_ESTADO_ROL (id_estado_rol, codigo, nombre)
VALUES (1, 'BORRADOR', 'Borrador'),
    (2, 'PUBLICADO', 'Publicado');
INSERT INTO CATALOGOS_ESTADO_EVENTO (id_estado_evento, codigo, nombre)
VALUES (1, 'PENDIENTE', 'Pendiente'),
    (2, 'ENTREGADO', 'Entregado'),
    (3, 'FALLIDO', 'Fallido');
-- KAN-51 (RF-31): solicitudes de licencias y permisos especiales.
-- Bloque idempotente: se puede ejecutar a mano sobre una AttendanceDB ya creada.
-- id_empleado e id_empleado_resolutor referencian EMPLEADOS (EmployeeDB): sin FK por ser otro servicio,
-- igual que MARCAJES y ASIGNACIONES_TURNO.
CREATE EXTENSION IF NOT EXISTS btree_gist;
-- Tabla: CATALOGOS_ESTADO_SOLICITUD
CREATE TABLE IF NOT EXISTS CATALOGOS_ESTADO_SOLICITUD (
    id_estado_solicitud SMALLINT NOT NULL,
    codigo varchar(30) NOT NULL,
    nombre varchar(60) NOT NULL,
    CONSTRAINT CATALOGOS_ESTADO_SOLICITUD_pk PRIMARY KEY (id_estado_solicitud),
    CONSTRAINT uq_estado_solicitud_codigo UNIQUE (codigo)
);
-- Tabla: CATALOGOS_TIPO_LICENCIA (la causal es el tipo; los topes y reglas viven en el catálogo)
CREATE TABLE IF NOT EXISTS CATALOGOS_TIPO_LICENCIA (
    id_tipo_licencia SMALLINT NOT NULL,
    codigo varchar(30) NOT NULL,
    nombre varchar(80) NOT NULL,
    es_con_goce_haberes boolean NOT NULL,
    dias_maximos_continuos SMALLINT NULL,
    requiere_adjunto boolean NOT NULL DEFAULT FALSE,
    esta_activo boolean NOT NULL DEFAULT TRUE,
    CONSTRAINT CATALOGOS_TIPO_LICENCIA_pk PRIMARY KEY (id_tipo_licencia),
    CONSTRAINT uq_tipo_licencia_codigo UNIQUE (codigo),
    CONSTRAINT chk_tipo_licencia_tope CHECK (dias_maximos_continuos IS NULL OR dias_maximos_continuos > 0)
);
-- Tabla: SOLICITUDES_LICENCIA
CREATE TABLE IF NOT EXISTS SOLICITUDES_LICENCIA (
    id_solicitud UUID NOT NULL DEFAULT gen_random_uuid(),
    id_empleado UUID NOT NULL,
    id_tipo_licencia SMALLINT NOT NULL,
    id_estado_solicitud SMALLINT NOT NULL DEFAULT 1,
    fecha_inicio date NOT NULL,
    fecha_fin date NOT NULL,
    dias_solicitados SMALLINT GENERATED ALWAYS AS (fecha_fin - fecha_inicio + 1) STORED,
    es_con_goce_haberes boolean NOT NULL,
    excede_limite_dias boolean NOT NULL DEFAULT FALSE,
    motivo text NULL,
    id_empleado_resolutor UUID NULL,
    resuelto_en TIMESTAMPTZ NULL,
    motivo_resolucion text NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT SOLICITUDES_LICENCIA_pk PRIMARY KEY (id_solicitud),
    CONSTRAINT chk_solicitud_licencia_fechas CHECK (fecha_fin >= fecha_inicio),
    CONSTRAINT chk_solicitud_licencia_resolucion CHECK ((id_empleado_resolutor IS NULL) = (resuelto_en IS NULL)),
    -- Un empleado no puede tener dos licencias activas (pendiente o aprobada) que se solapen.
    CONSTRAINT ex_solicitud_licencia_solape EXCLUDE USING gist (
        id_empleado WITH =,
        daterange(fecha_inicio, fecha_fin, '[]') WITH &&
    ) WHERE (id_estado_solicitud IN (1, 2))
);
-- Tabla: ADJUNTOS_SOLICITUD_LICENCIA (respaldo digital: baja médica, certificado de defunción, etc.)
CREATE TABLE IF NOT EXISTS ADJUNTOS_SOLICITUD_LICENCIA (
    id_adjunto UUID NOT NULL DEFAULT gen_random_uuid(),
    id_solicitud UUID NOT NULL,
    nombre_original varchar(255) NOT NULL,
    archivo_url varchar(255) NOT NULL,
    formato_mimetype varchar(100) NOT NULL,
    tamano_bytes integer NOT NULL,
    subido_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ADJUNTOS_SOLICITUD_LICENCIA_pk PRIMARY KEY (id_adjunto),
    CONSTRAINT chk_adjunto_licencia_tamano CHECK (tamano_bytes > 0)
);
-- índices
-- Historial de un empleado (pantalla "mis solicitudes").
CREATE INDEX IF NOT EXISTS ix_solicitud_licencia_empleado ON SOLICITUDES_LICENCIA (id_empleado, fecha_inicio DESC);
-- Bandeja de pendientes del aprobador (KAN-53).
CREATE INDEX IF NOT EXISTS ix_solicitud_licencia_estado ON SOLICITUDES_LICENCIA (id_estado_solicitud, creado_en);
-- Cronograma de ausencias aprobadas por rango de fechas (KAN-55).
CREATE INDEX IF NOT EXISTS ix_solicitud_licencia_aprobadas_fechas ON SOLICITUDES_LICENCIA (fecha_inicio, fecha_fin) WHERE id_estado_solicitud = 2;
CREATE INDEX IF NOT EXISTS ix_adjunto_licencia_solicitud ON ADJUNTOS_SOLICITUD_LICENCIA (id_solicitud);
-- llaves foráneas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'solicitudes_licencia_catalogos_tipo_licencia') THEN
        ALTER TABLE SOLICITUDES_LICENCIA
        ADD CONSTRAINT SOLICITUDES_LICENCIA_CATALOGOS_TIPO_LICENCIA FOREIGN KEY (id_tipo_licencia) REFERENCES CATALOGOS_TIPO_LICENCIA (id_tipo_licencia) NOT DEFERRABLE INITIALLY IMMEDIATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'solicitudes_licencia_catalogos_estado_solicitud') THEN
        ALTER TABLE SOLICITUDES_LICENCIA
        ADD CONSTRAINT SOLICITUDES_LICENCIA_CATALOGOS_ESTADO_SOLICITUD FOREIGN KEY (id_estado_solicitud) REFERENCES CATALOGOS_ESTADO_SOLICITUD (id_estado_solicitud) NOT DEFERRABLE INITIALLY IMMEDIATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'adjuntos_solicitud_licencia_solicitudes_licencia') THEN
        ALTER TABLE ADJUNTOS_SOLICITUD_LICENCIA
        ADD CONSTRAINT ADJUNTOS_SOLICITUD_LICENCIA_SOLICITUDES_LICENCIA FOREIGN KEY (id_solicitud) REFERENCES SOLICITUDES_LICENCIA (id_solicitud) ON DELETE CASCADE NOT DEFERRABLE INITIALLY IMMEDIATE;
    END IF;
END $$;
-- datos iniciales (topes y goce referenciales: confirmar con RRHH / normativa vigente)
INSERT INTO CATALOGOS_ESTADO_SOLICITUD (id_estado_solicitud, codigo, nombre) VALUES
    (1, 'PENDIENTE', 'Pendiente'),
    (2, 'APROBADA', 'Aprobada'),
    (3, 'RECHAZADA', 'Rechazada'),
    (4, 'CANCELADA', 'Cancelada')
ON CONFLICT DO NOTHING;
INSERT INTO CATALOGOS_TIPO_LICENCIA (id_tipo_licencia, codigo, nombre, es_con_goce_haberes, dias_maximos_continuos, requiere_adjunto) VALUES
    (1, 'MEDICA', 'Licencia médica', TRUE, NULL, TRUE),
    (2, 'MATERNIDAD_PATERNIDAD', 'Maternidad / paternidad', TRUE, 90, TRUE),
    (3, 'DUELO', 'Duelo', TRUE, 3, TRUE),
    (4, 'ACADEMICA', 'Académica', FALSE, 5, TRUE),
    (5, 'PERSONAL', 'Personal', FALSE, 2, FALSE)
ON CONFLICT DO NOTHING;
-- Fin del archivo.