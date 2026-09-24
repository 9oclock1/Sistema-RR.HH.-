-- Created by Redgate Data Modeler (https://datamodeler.redgate-platform.com)
-- Last modification date: 2026-09-24 01:44:51.13
-- tables
-- Table: CATALOGOS_ETAPA_POSTULACION
CREATE TABLE CATALOGOS_ETAPA_POSTULACION (
    id_etapa SMALLINT NOT NULL,
    codigo varchar(30) NOT NULL,
    nombre varchar(60) NOT NULL,
    orden_flujo SMALLINT NOT NULL,
    CONSTRAINT CATALOGOS_ETAPA_POSTULACION_pk PRIMARY KEY (id_etapa),
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
    cv_archivo_url varchar(255) NOT NULL,
    cv_formato_mimetype varchar(50) NOT NULL,
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
-- End of file.