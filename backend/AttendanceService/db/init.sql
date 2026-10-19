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
    CONSTRAINT chk_asignacion_fechas CHECK (fecha_hasta IS NULL OR fecha_hasta >= fecha_desde)
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
-- datos iniciales
INSERT INTO CATALOGOS_TIPO_JORNADA (id_tipo_jornada, codigo, nombre) VALUES
    (1, 'DIURNO', 'Diurno'),
    (2, 'VESPERTINO', 'Vespertino'),
    (3, 'NOCTURNO', 'Nocturno');
INSERT INTO CATALOGOS_TIPO_MARCAJE (id_tipo_marcaje, codigo, nombre) VALUES
    (1, 'ENTRADA', 'Entrada'),
    (2, 'SALIDA', 'Salida');
INSERT INTO CATALOGOS_ORIGEN_MARCAJE (id_origen_marcaje, codigo, nombre) VALUES
    (1, 'PORTAL', 'Portal'),
    (2, 'BIOMETRICO', 'Biométrico');
INSERT INTO CATALOGOS_ESTADO_MARCAJE (id_estado_marcaje, codigo, nombre) VALUES
    (1, 'REGISTRADO', 'Registrado'),
    (2, 'PENDIENTE_JUSTIFICACION', 'Pendiente de justificación');
-- KAN-51 (RF-31): solicitudes de licencias y permisos especiales.
-- Bloque idempotente: se puede ejecutar a mano sobre una AttendanceDB ya creada.
-- id_empleado e id_empleado_resolutor referencian EMPLEADOS (EmployeeDB): sin FK por ser otro servicio,
-- igual que MARCAJES y ASIGNACIONES_TURNO.
-- btree_gist: permite combinar UUID y rangos de fechas en una restricción EXCLUDE.
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
    (2, 'MATERNIDAD', 'Maternidad', TRUE, 90, TRUE),
    (3, 'DUELO', 'Duelo', TRUE, 3, TRUE),
    (4, 'ACADEMICA', 'Académica', FALSE, 5, TRUE),
    (5, 'PERSONAL', 'Personal', FALSE, 2, FALSE),
    (6, 'PATERNIDAD', 'Paternidad', TRUE, 3, TRUE)
ON CONFLICT DO NOTHING;
-- Si la BD ya tenía el tipo unificado, pasa a ser Maternidad (la paternidad es el tipo 6).
UPDATE CATALOGOS_TIPO_LICENCIA
SET codigo = 'MATERNIDAD', nombre = 'Maternidad'
WHERE id_tipo_licencia = 2 AND codigo = 'MATERNIDAD_PATERNIDAD';
-- KAN-52 (RF-32): saldo de vacaciones.
-- Bloque idempotente: se puede ejecutar a mano sobre una AttendanceDB ya creada.
-- Los días ganados NO se guardan: se calculan con EMPLEADOS.fecha_ingreso (EmployeeDB) y la escala legal.
-- Aquí solo se registran los días consumidos o reservados; las solicitudes (KAN-50) y su aprobación (KAN-53)
-- insertan y cambian de estado estos movimientos. id_empleado e id_solicitud_origen no tienen FK por ser otro servicio o historia.
-- Tabla: CATALOGOS_ESTADO_MOVIMIENTO_VACACION
CREATE TABLE IF NOT EXISTS CATALOGOS_ESTADO_MOVIMIENTO_VACACION (
    id_estado_movimiento SMALLINT NOT NULL,
    codigo varchar(30) NOT NULL,
    nombre varchar(60) NOT NULL,
    CONSTRAINT CATALOGOS_ESTADO_MOVIMIENTO_VACACION_pk PRIMARY KEY (id_estado_movimiento),
    CONSTRAINT uq_estado_movimiento_vacacion_codigo UNIQUE (codigo)
);
-- Tabla: MOVIMIENTOS_VACACION
CREATE TABLE IF NOT EXISTS MOVIMIENTOS_VACACION (
    id_movimiento UUID NOT NULL DEFAULT gen_random_uuid(),
    id_empleado UUID NOT NULL,
    id_estado_movimiento SMALLINT NOT NULL DEFAULT 1,
    id_solicitud_origen UUID NULL,
    fecha_inicio date NOT NULL,
    fecha_fin date NOT NULL,
    dias SMALLINT NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT MOVIMIENTOS_VACACION_pk PRIMARY KEY (id_movimiento),
    CONSTRAINT chk_movimiento_vacacion_fechas CHECK (fecha_fin >= fecha_inicio),
    CONSTRAINT chk_movimiento_vacacion_dias CHECK (dias > 0)
);
-- índices
-- Saldo e historial de un empleado.
CREATE INDEX IF NOT EXISTS ix_movimiento_vacacion_empleado ON MOVIMIENTOS_VACACION (id_empleado, fecha_inicio DESC);
-- Una solicitud origina un solo movimiento: evita descontar dos veces los mismos días.
CREATE UNIQUE INDEX IF NOT EXISTS uq_movimiento_vacacion_solicitud ON MOVIMIENTOS_VACACION (id_solicitud_origen) WHERE id_solicitud_origen IS NOT NULL;
-- llaves foráneas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'movimientos_vacacion_catalogos_estado_movimiento_vacacion') THEN
        ALTER TABLE MOVIMIENTOS_VACACION
        ADD CONSTRAINT MOVIMIENTOS_VACACION_CATALOGOS_ESTADO_MOVIMIENTO_VACACION FOREIGN KEY (id_estado_movimiento) REFERENCES CATALOGOS_ESTADO_MOVIMIENTO_VACACION (id_estado_movimiento) NOT DEFERRABLE INITIALLY IMMEDIATE;
    END IF;
END $$;
-- datos iniciales
INSERT INTO CATALOGOS_ESTADO_MOVIMIENTO_VACACION (id_estado_movimiento, codigo, nombre) VALUES
    (1, 'EN_PROCESO', 'En proceso de aprobación'),
    (2, 'GOZADO', 'Gozado'),
    (3, 'CANCELADO', 'Cancelado')
ON CONFLICT DO NOTHING;
-- Fin del archivo.