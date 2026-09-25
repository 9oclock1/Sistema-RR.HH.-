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
-- Tabla: MARCAJES
CREATE TABLE MARCAJES (
    id_marcaje UUID NOT NULL DEFAULT gen_random_uuid(),
    id_empleado UUID NOT NULL,
    id_tipo_marcaje SMALLINT NOT NULL,
    id_origen_marcaje SMALLINT NOT NULL,
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
-- Fin del archivo.
