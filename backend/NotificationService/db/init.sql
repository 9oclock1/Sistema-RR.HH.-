-- Created by Redgate Data Modeler (https://datamodeler.redgate-platform.com)
-- Last modification date: 2026-09-28 03:49:20.064
-- tables
-- Table: catalogos_alcance_comunicacion
CREATE TABLE catalogos_alcance_comunicacion (
    id_alcance smallint NOT NULL GENERATED ALWAYS AS IDENTITY,
    codigo varchar(30) NOT NULL,
    nombre varchar(80) NOT NULL,
    CONSTRAINT uq_alcance_codigo UNIQUE (codigo) NOT DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT pk_alcance_comunicacion PRIMARY KEY (id_alcance)
);
-- Table: catalogos_estado_mensaje
CREATE TABLE catalogos_estado_mensaje (
    id_estado smallint NOT NULL GENERATED ALWAYS AS IDENTITY,
    codigo varchar(30) NOT NULL,
    nombre varchar(80) NOT NULL,
    CONSTRAINT uq_estado_codigo UNIQUE (codigo) NOT DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT pk_estado_mensaje PRIMARY KEY (id_estado)
);
-- Table: catalogos_tipo_comunicacion
CREATE TABLE catalogos_tipo_comunicacion (
    id_tipo smallint NOT NULL GENERATED ALWAYS AS IDENTITY,
    codigo varchar(30) NOT NULL,
    nombre varchar(80) NOT NULL,
    CONSTRAINT uq_tipo_codigo UNIQUE (codigo) NOT DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT pk_tipo_comunicacion PRIMARY KEY (id_tipo)
);
-- Table: comunicaciones
CREATE TABLE comunicaciones (
    id_comunicacion uuid NOT NULL DEFAULT gen_random_uuid(),
    id_tipo smallint NOT NULL,
    id_alcance smallint NOT NULL,
    id_usuario_remitente uuid NOT NULL,
    remitente_nombre varchar(150) NULL,
    asunto varchar(150) NOT NULL,
    contenido text NOT NULL,
    requiere_confirmacion boolean NOT NULL DEFAULT false,
    prioridad varchar(10) NOT NULL DEFAULT 'NORMAL',
    enlace varchar(255) NULL,
    id_departamento_destino uuid NULL,
    id_sucursal_destino uuid NULL,
    cantidad_destinatarios integer NOT NULL DEFAULT 0,
    fecha_envio timestamptz NOT NULL DEFAULT current_timestamp,
    creado_en timestamptz NOT NULL DEFAULT current_timestamp,
    actualizado_en timestamptz NOT NULL DEFAULT current_timestamp,
    CONSTRAINT chk_asunto_no_vacio CHECK ((length (trim (asunto)) > 0)) NOT DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT chk_contenido_no_vacio CHECK ((length (trim (contenido)) > 0)) NOT DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT chk_prioridad CHECK (prioridad IN ('NORMAL', 'ALTA')) NOT DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT pk_comunicaciones PRIMARY KEY (id_comunicacion)
);
CREATE INDEX idx_comunicaciones_remitente on comunicaciones (id_usuario_remitente ASC);
CREATE INDEX idx_comunicaciones_fecha on comunicaciones (fecha_envio DESC);
-- Table: destinatarios_comunicacion
CREATE TABLE destinatarios_comunicacion (
    id_destinatario uuid NOT NULL DEFAULT gen_random_uuid(),
    id_comunicacion uuid NOT NULL,
    id_empleado uuid NOT NULL,
    id_estado smallint NOT NULL DEFAULT 1,
    fecha_entrega timestamptz NULL DEFAULT current_timestamp,
    fecha_lectura timestamptz NULL,
    fecha_confirmacion timestamptz NULL,
    CONSTRAINT uq_comunicacion_empleado UNIQUE (id_comunicacion, id_empleado) NOT DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT pk_destinatarios PRIMARY KEY (id_destinatario)
);
CREATE INDEX idx_destinatarios_empleado on destinatarios_comunicacion (id_empleado ASC);
CREATE INDEX idx_mensajes_no_leidos on destinatarios_comunicacion (id_empleado ASC, id_estado ASC);
-- Table: lecturas_comunicacion
CREATE TABLE lecturas_comunicacion (
    id_lectura uuid NOT NULL DEFAULT gen_random_uuid(),
    id_comunicacion uuid NOT NULL,
    id_empleado uuid NOT NULL,
    fecha_apertura timestamptz NULL DEFAULT current_timestamp,
    confirmo boolean NULL DEFAULT false,
    fecha_confirmacion timestamptz NULL,
    CONSTRAINT pk_lecturas PRIMARY KEY (id_lectura)
);
-- foreign keys
-- Reference: fk_comunicacion_alcance (table: comunicaciones)
ALTER TABLE comunicaciones
ADD CONSTRAINT fk_comunicacion_alcance FOREIGN KEY (id_alcance) REFERENCES catalogos_alcance_comunicacion (id_alcance) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Reference: fk_comunicacion_tipo (table: comunicaciones)
ALTER TABLE comunicaciones
ADD CONSTRAINT fk_comunicacion_tipo FOREIGN KEY (id_tipo) REFERENCES catalogos_tipo_comunicacion (id_tipo) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Reference: fk_destinatario_comunicacion (table: destinatarios_comunicacion)
ALTER TABLE destinatarios_comunicacion
ADD CONSTRAINT fk_destinatario_comunicacion FOREIGN KEY (id_comunicacion) REFERENCES comunicaciones (id_comunicacion) ON DELETE CASCADE NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Reference: fk_destinatario_estado (table: destinatarios_comunicacion)
ALTER TABLE destinatarios_comunicacion
ADD CONSTRAINT fk_destinatario_estado FOREIGN KEY (id_estado) REFERENCES catalogos_estado_mensaje (id_estado) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Reference: fk_lectura_comunicacion (table: lecturas_comunicacion)
ALTER TABLE lecturas_comunicacion
ADD CONSTRAINT fk_lectura_comunicacion FOREIGN KEY (id_comunicacion) REFERENCES comunicaciones (id_comunicacion) ON DELETE CASCADE NOT DEFERRABLE INITIALLY IMMEDIATE;

-- Seed data for catalogs
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

-- KAN-54 (RF-34): notificaciones internas del portal (alertas de resultado de solicitudes de ausencia).
-- Es idempotente (IF NOT EXISTS) para aplicarse también sobre una base ya creada.
-- Table: notificaciones
CREATE TABLE IF NOT EXISTS notificaciones (
    id_notificacion uuid NOT NULL DEFAULT gen_random_uuid(),
    id_empleado uuid NOT NULL,
    tipo varchar(40) NOT NULL,
    titulo varchar(150) NOT NULL,
    mensaje text NOT NULL,
    enlace varchar(255) NULL,
    id_referencia uuid NULL,
    leida boolean NOT NULL DEFAULT false,
    fecha_lectura timestamptz NULL,
    correo_estado varchar(15) NOT NULL DEFAULT 'NO_APLICA',
    correo_detalle varchar(200) NULL,
    creado_en timestamptz NOT NULL DEFAULT current_timestamp,
    CONSTRAINT pk_notificaciones PRIMARY KEY (id_notificacion),
    CONSTRAINT chk_notificacion_titulo CHECK (length(trim(titulo)) > 0),
    CONSTRAINT chk_notificacion_mensaje CHECK (length(trim(mensaje)) > 0),
    CONSTRAINT chk_notificacion_correo CHECK (correo_estado IN ('NO_APLICA', 'ENVIADO', 'FALLIDO')),
    CONSTRAINT chk_notificacion_lectura CHECK (leida = (fecha_lectura IS NOT NULL))
);
-- Bandeja del empleado y contador de no leídas (campana del encabezado).
CREATE INDEX IF NOT EXISTS idx_notificaciones_empleado ON notificaciones (id_empleado, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_notificaciones_no_leidas ON notificaciones (id_empleado) WHERE NOT leida;
-- Un mismo evento (p. ej. la resolución de una solicitud) notifica una sola vez al empleado, aunque se reintente el envío.
CREATE UNIQUE INDEX IF NOT EXISTS uq_notificacion_evento ON notificaciones (tipo, id_referencia, id_empleado) WHERE id_referencia IS NOT NULL;

-- End of file.