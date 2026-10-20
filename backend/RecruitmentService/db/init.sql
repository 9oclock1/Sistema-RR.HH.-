-- Created by Redgate Data Modeler (https://datamodeler.redgate-platform.com)
-- Last modification date: 2026-09-24 01:44:51.13
-- tables
-- Table: CATALOGOS_ETAPA_POSTULACION
CREATE TABLE CATALOGOS_ETAPA_POSTULACION (
    id_etapa SMALLINT NOT NULL,
    codigo varchar(30) NOT NULL,
    nombre varchar(60) NOT NULL,
    orden_flujo SMALLINT NOT NULL,
    CONSTRAINT CATALOGOS_ETAPA_POSTULACION_pk PRIMARY KEY (id_etapa)
);
-- Table: CONVOCATORIAS
CREATE TABLE CONVOCATORIAS (
    id_convocatoria UUID NOT NULL,
    id_cargo_referencial UUID NOT NULL,
    id_sucursal_destino UUID NOT NULL,
    codigo_convocatoria varchar(30) NOT NULL,
    titulo_puesto varchar(120) NOT NULL,
    descripcion_puesto text NOT NULL,
    cantidad_vacantes int NOT NULL DEFAULT 1,
    year_experiencia_min numeric(4, 1) NOT NULL DEFAULT (0.0),
    nivel_educacion_min varchar(50) NOT NULL,
    habilidades_clave_requeridas text [] NOT NULL,
    fecha_publicacion date NOT NULL,
    fecha_limite_postulacion date NOT NULL,
    esta_activa boolean NOT NULL DEFAULT TRUE,
    pesos_afinidad JSONB NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT CONVOCATORIAS_pk PRIMARY KEY (id_convocatoria)
);
-- Table: ENTREVISTAS
CREATE TABLE ENTREVISTAS (
    id_entrevista UUID NOT NULL,
    id_postulacion UUID NOT NULL,
    id_entrevistador_empleado UUID NOT NULL,
    fecha_hora_programada TIMESTAMPTZ NOT NULL,
    modalidad varchar(20) NOT NULL,
    lugar_enlace varchar(255) NOT NULL,
    notificacion_enviada boolean NOT NULL DEFAULT FALSE,
    calificacion_entrevista numeric(4, 2) NULL,
    resultado_cualitativo text NULL,
    estado_entrevista varchar(20) NOT NULL DEFAULT 'PROGRAMADA',
    CONSTRAINT ENTREVISTAS_pk PRIMARY KEY (id_entrevista)
);
-- Table: HISTORIALES_ETAPA_POSTULACION
CREATE TABLE HISTORIALES_ETAPA_POSTULACION (
    id_historial UUID NOT NULL,
    id_postulacion UUID NOT NULL,
    id_etapa SMALLINT NOT NULL,
    id_usuario_evaluador UUID NOT NULL,
    comentarios_etapa TEXT NULL,
    fecha_cambio TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT HISTORIALES_ETAPA_POSTULACION_pk PRIMARY KEY (id_historial)
);
-- Table: POSTULACIONES
CREATE TABLE POSTULACIONES (
    id_postulacion UUID NOT NULL,
    id_convocatoria UUID NOT NULL,
    id_postulante UUID NOT NULL,
    id_etapa SMALLINT NOT NULL,
    cv_archivo_url varchar(255) NULL,
    cv_formato_mimetype varchar(100) NULL,
    datos_extraidos_cv JSONB NULL,
    porcentaje_afinidad numeric(5, 2) NULL,
    posicion_ranking int NULL,
    id_empleado_generado UUID NULL,
    fecha_postulacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT POSTULACIONES_pk PRIMARY KEY (id_postulacion),
    CONSTRAINT uq_postulacion_convocatoria_postulante UNIQUE (id_convocatoria, id_postulante)
);
-- Table: POSTULANTES
CREATE TABLE POSTULANTES (
    id_postulante UUID NOT NULL,
    numero_documento varchar(20) NOT NULL,
    nombres varchar(70) NOT NULL,
    apellidos varchar(100) NOT NULL,
    correo_electronico varchar(120) NOT NULL,
    telefono_contacto varchar(20) NOT NULL,
    direccion_residencia varchar(255) NULL,
    ciudad varchar(50) NOT NULL DEFAULT 'La Paz',
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT POSTULANTES_pk PRIMARY KEY (id_postulante),
    CONSTRAINT uq_postulante_correo UNIQUE (correo_electronico)
);
-- foreign keys
-- Reference: ENTREVISTAS_POSTULACIONES (table: ENTREVISTAS)
ALTER TABLE ENTREVISTAS
ADD CONSTRAINT ENTREVISTAS_POSTULACIONES FOREIGN KEY (id_postulacion) REFERENCES POSTULACIONES (id_postulacion) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Reference: HISTORIALES_ETAPA_POSTULACION_CATALOGOS_ETAPA_POSTULACION (table: HISTORIALES_ETAPA_POSTULACION)
ALTER TABLE HISTORIALES_ETAPA_POSTULACION
ADD CONSTRAINT HISTORIALES_ETAPA_POSTULACION_CATALOGOS_ETAPA_POSTULACION FOREIGN KEY (id_etapa) REFERENCES CATALOGOS_ETAPA_POSTULACION (id_etapa) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Reference: HISTORIALES_ETAPA_POSTULACION_POSTULACIONES (table: HISTORIALES_ETAPA_POSTULACION)
ALTER TABLE HISTORIALES_ETAPA_POSTULACION
ADD CONSTRAINT HISTORIALES_ETAPA_POSTULACION_POSTULACIONES FOREIGN KEY (id_postulacion) REFERENCES POSTULACIONES (id_postulacion) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Reference: POSTULACIONES_CATALOGOS_ETAPA_POSTULACION (table: POSTULACIONES)
ALTER TABLE POSTULACIONES
ADD CONSTRAINT POSTULACIONES_CATALOGOS_ETAPA_POSTULACION FOREIGN KEY (id_etapa) REFERENCES CATALOGOS_ETAPA_POSTULACION (id_etapa) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Reference: POSTULACIONES_CONVOCATORIAS (table: POSTULACIONES)
ALTER TABLE POSTULACIONES
ADD CONSTRAINT POSTULACIONES_CONVOCATORIAS FOREIGN KEY (id_convocatoria) REFERENCES CONVOCATORIAS (id_convocatoria) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Reference: POSTULACIONES_POSTULANTES (table: POSTULACIONES)
ALTER TABLE POSTULACIONES
ADD CONSTRAINT POSTULACIONES_POSTULANTES FOREIGN KEY (id_postulante) REFERENCES POSTULANTES (id_postulante) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Seed initial recruitment stages catalog (CATALOGOS_ETAPA_POSTULACION)
INSERT INTO CATALOGOS_ETAPA_POSTULACION (id_etapa, codigo, nombre, orden_flujo)
VALUES (1, 'POSTULADO', 'Postulación Recibida', 1),
    (2, 'REVISION_CV', 'Revisión Curricular', 2),
    (3, 'ENTREVISTA', 'Entrevista', 3),
    (4, 'EVALUACION', 'Evaluación Técnica', 4),
    (5, 'FINALISTA', 'Finalista / Oferta', 5),
    (6, 'CONTRATADO', 'Contratado', 6),
    (7, 'RECHAZADO', 'No Seleccionado', 7) ON CONFLICT (id_etapa) DO NOTHING;
ALTER TABLE CATALOGOS_ETAPA_POSTULACION
ADD COLUMN es_final boolean NOT NULL DEFAULT FALSE,
    ADD COLUMN esta_activa boolean NOT NULL DEFAULT TRUE,
    ADD CONSTRAINT uq_etapa_postulacion_codigo UNIQUE (codigo);
UPDATE CATALOGOS_ETAPA_POSTULACION
SET codigo = 'EN_REVISION',
    nombre = 'En revisión'
WHERE id_etapa = 2;
UPDATE CATALOGOS_ETAPA_POSTULACION
SET codigo = 'ENTREVISTA_TECNICA',
    nombre = 'Entrevista técnica'
WHERE id_etapa = 3;
UPDATE CATALOGOS_ETAPA_POSTULACION
SET codigo = 'APTO',
    nombre = 'Apto'
WHERE id_etapa = 4;
UPDATE CATALOGOS_ETAPA_POSTULACION
SET esta_activa = FALSE
WHERE id_etapa = 5;
UPDATE CATALOGOS_ETAPA_POSTULACION
SET nombre = 'Rechazado'
WHERE id_etapa = 7;
UPDATE CATALOGOS_ETAPA_POSTULACION
SET es_final = TRUE
WHERE id_etapa IN (6, 7);
CREATE TABLE TRANSICIONES_ETAPA_POSTULACION (
    id_etapa_origen SMALLINT NOT NULL,
    id_etapa_destino SMALLINT NOT NULL,
    solicita_motivo boolean NOT NULL DEFAULT FALSE,
    requiere_cargo boolean NOT NULL DEFAULT FALSE,
    CONSTRAINT TRANSICIONES_ETAPA_POSTULACION_pk PRIMARY KEY (id_etapa_origen, id_etapa_destino),
    CONSTRAINT chk_transicion_etapa_distinta CHECK (id_etapa_origen <> id_etapa_destino)
);
CREATE TABLE CATALOGOS_DESTINO_INTEGRACION (
    id_destino SMALLINT NOT NULL,
    codigo varchar(30) NOT NULL,
    grupo char(1) NOT NULL,
    nombre_modulo varchar(60) NOT NULL,
    canal varchar(10) NOT NULL,
    topico varchar(60) NULL,
    CONSTRAINT CATALOGOS_DESTINO_INTEGRACION_pk PRIMARY KEY (id_destino),
    CONSTRAINT uq_destino_integracion_codigo UNIQUE (codigo),
    CONSTRAINT chk_destino_integracion_canal CHECK (canal IN ('REST', 'PUBSUB'))
);
CREATE TABLE CATALOGOS_CARGO_OPERATIVO (
    id_cargo_operativo SMALLINT NOT NULL,
    codigo varchar(30) NOT NULL,
    nombre varchar(60) NOT NULL,
    id_destino SMALLINT NOT NULL,
    CONSTRAINT CATALOGOS_CARGO_OPERATIVO_pk PRIMARY KEY (id_cargo_operativo),
    CONSTRAINT uq_cargo_operativo_codigo UNIQUE (codigo)
);
CREATE TABLE CATALOGOS_ESTADO_EVENTO (
    id_estado_evento SMALLINT NOT NULL,
    codigo varchar(30) NOT NULL,
    nombre varchar(60) NOT NULL,
    CONSTRAINT CATALOGOS_ESTADO_EVENTO_pk PRIMARY KEY (id_estado_evento),
    CONSTRAINT uq_estado_evento_codigo UNIQUE (codigo)
);
ALTER TABLE HISTORIALES_ETAPA_POSTULACION
ALTER COLUMN id_historial
SET DEFAULT gen_random_uuid(),
    ADD COLUMN id_etapa_anterior SMALLINT NULL,
    ADD COLUMN nombre_usuario_evaluador varchar(120) NULL;
CREATE INDEX idx_historiales_etapa_postulacion ON HISTORIALES_ETAPA_POSTULACION (id_postulacion, fecha_cambio DESC);
ALTER TABLE POSTULACIONES
ADD COLUMN id_cargo_operativo SMALLINT NULL,
    ADD COLUMN contratado_en TIMESTAMPTZ NULL,
    ADD COLUMN esta_archivada boolean NOT NULL DEFAULT FALSE,
    ADD COLUMN archivada_en TIMESTAMPTZ NULL,
    ADD COLUMN alta_contabilidad_enviada boolean NOT NULL DEFAULT FALSE,
    ADD COLUMN alta_operativa_enviada boolean NOT NULL DEFAULT FALSE,
    ADD CONSTRAINT chk_postulacion_archivada CHECK (
        esta_archivada = FALSE
        OR archivada_en IS NOT NULL
    );
CREATE INDEX idx_postulaciones_id_etapa ON POSTULACIONES (id_convocatoria, id_etapa);
CREATE TABLE EVENTOS_SALIENTES (
    id_evento UUID NOT NULL DEFAULT gen_random_uuid(),
    id_mensaje UUID NOT NULL DEFAULT gen_random_uuid(),
    id_postulacion UUID NOT NULL,
    id_destino SMALLINT NOT NULL,
    tipo_evento varchar(60) NOT NULL,
    carga JSONB NOT NULL,
    id_estado_evento SMALLINT NOT NULL DEFAULT 1,
    intentos SMALLINT NOT NULL DEFAULT 0,
    ultimo_error varchar(255) NULL,
    proximo_intento_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    entregado_en TIMESTAMPTZ NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT EVENTOS_SALIENTES_pk PRIMARY KEY (id_evento),
    CONSTRAINT uq_evento_saliente_mensaje UNIQUE (id_mensaje),
    CONSTRAINT uq_evento_saliente_postulacion_destino UNIQUE (id_postulacion, id_destino, tipo_evento),
    CONSTRAINT chk_evento_intentos CHECK (intentos >= 0)
);
CREATE INDEX idx_eventos_salientes_pendientes ON EVENTOS_SALIENTES (id_estado_evento, proximo_intento_en);
-- foreign keys
ALTER TABLE TRANSICIONES_ETAPA_POSTULACION
ADD CONSTRAINT TRANSICIONES_ETAPA_ORIGEN FOREIGN KEY (id_etapa_origen) REFERENCES CATALOGOS_ETAPA_POSTULACION (id_etapa) NOT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE TRANSICIONES_ETAPA_POSTULACION
ADD CONSTRAINT TRANSICIONES_ETAPA_DESTINO FOREIGN KEY (id_etapa_destino) REFERENCES CATALOGOS_ETAPA_POSTULACION (id_etapa) NOT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE CATALOGOS_CARGO_OPERATIVO
ADD CONSTRAINT CATALOGOS_CARGO_OPERATIVO_DESTINO FOREIGN KEY (id_destino) REFERENCES CATALOGOS_DESTINO_INTEGRACION (id_destino) NOT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE HISTORIALES_ETAPA_POSTULACION
ADD CONSTRAINT HISTORIALES_ETAPA_POSTULACION_ETAPA_ANTERIOR FOREIGN KEY (id_etapa_anterior) REFERENCES CATALOGOS_ETAPA_POSTULACION (id_etapa) NOT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE POSTULACIONES
ADD CONSTRAINT POSTULACIONES_CATALOGOS_CARGO_OPERATIVO FOREIGN KEY (id_cargo_operativo) REFERENCES CATALOGOS_CARGO_OPERATIVO (id_cargo_operativo) NOT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE EVENTOS_SALIENTES
ADD CONSTRAINT EVENTOS_SALIENTES_POSTULACIONES FOREIGN KEY (id_postulacion) REFERENCES POSTULACIONES (id_postulacion) NOT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE EVENTOS_SALIENTES
ADD CONSTRAINT EVENTOS_SALIENTES_CATALOGOS_DESTINO_INTEGRACION FOREIGN KEY (id_destino) REFERENCES CATALOGOS_DESTINO_INTEGRACION (id_destino) NOT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE EVENTOS_SALIENTES
ADD CONSTRAINT EVENTOS_SALIENTES_CATALOGOS_ESTADO_EVENTO FOREIGN KEY (id_estado_evento) REFERENCES CATALOGOS_ESTADO_EVENTO (id_estado_evento) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- seed
-- Flujo: Postulado → En revisión → Entrevista técnica → Apto → Contratado; se puede rechazar desde cualquier
INSERT INTO TRANSICIONES_ETAPA_POSTULACION (
        id_etapa_origen,
        id_etapa_destino,
        solicita_motivo,
        requiere_cargo
    )
VALUES (1, 2, FALSE, FALSE),
    (1, 7, TRUE, FALSE),
    (2, 3, FALSE, FALSE),
    (2, 7, TRUE, FALSE),
    (3, 2, FALSE, FALSE),
    (3, 4, FALSE, FALSE),
    (3, 7, TRUE, FALSE),
    (4, 3, FALSE, FALSE),
    (4, 6, FALSE, TRUE),
    (4, 7, TRUE, FALSE),
    (5, 6, FALSE, TRUE),
    (5, 7, TRUE, FALSE);
INSERT INTO CATALOGOS_DESTINO_INTEGRACION (
        id_destino,
        codigo,
        grupo,
        nombre_modulo,
        canal,
        topico
    )
VALUES (
        1,
        'CONTABILIDAD',
        'D',
        'Contabilidad',
        'REST',
        NULL
    ),
    (
        2,
        'MARKETPLACE_POS',
        'E',
        'Marketplace / POS',
        'PUBSUB',
        'marketplace-pos'
    ),
    (
        3,
        'INVENTARIOS',
        'I',
        'Inventarios',
        'PUBSUB',
        'inventarios'
    ),
    (
        4,
        'ENTREGAS',
        'H',
        'Entregas y Despachos',
        'PUBSUB',
        'entregas-despachos'
    );
INSERT INTO CATALOGOS_CARGO_OPERATIVO (id_cargo_operativo, codigo, nombre, id_destino)
VALUES (1, 'CAJERO', 'Cajero', 2),
    (2, 'VENDEDOR', 'Vendedor', 2),
    (3, 'ALMACENERO', 'Almacenero', 3),
    (4, 'CHOFER', 'Chofer', 4);
INSERT INTO CATALOGOS_ESTADO_EVENTO (id_estado_evento, codigo, nombre)
VALUES (1, 'PENDIENTE', 'Pendiente'),
    (2, 'ENTREGADO', 'Entregado'),
    (3, 'FALLIDO', 'Fallido');
-- End of file.