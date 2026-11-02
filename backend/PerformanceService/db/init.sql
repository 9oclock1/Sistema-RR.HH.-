-- tablas
-- Tabla: PLANTILLAS_EVALUACION
-- Cada versión es una fila. id_familia agrupa las versiones de una misma plantilla;
-- una versión publicada no se modifica: los cambios se hacen en una versión nueva.
CREATE TABLE PLANTILLAS_EVALUACION (
    id_plantilla UUID NOT NULL DEFAULT gen_random_uuid(),
    id_familia UUID NOT NULL,
    version SMALLINT NOT NULL DEFAULT 1,
    nombre varchar(120) NOT NULL,
    descripcion varchar(500) NULL,
    estado varchar(20) NOT NULL DEFAULT 'BORRADOR',
    publicada_en TIMESTAMPTZ NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT PLANTILLAS_EVALUACION_pk PRIMARY KEY (id_plantilla),
    CONSTRAINT uq_plantilla_version UNIQUE (id_familia, version),
    CONSTRAINT chk_plantilla_version CHECK (version >= 1),
    CONSTRAINT chk_plantilla_estado CHECK (estado IN ('BORRADOR', 'PUBLICADA', 'ARCHIVADA')),
    CONSTRAINT chk_plantilla_publicacion CHECK ((estado = 'BORRADOR') = (publicada_en IS NULL))
);
-- Una familia tiene a lo sumo un borrador en edición.
CREATE UNIQUE INDEX uq_plantilla_borrador_familia ON PLANTILLAS_EVALUACION (id_familia) WHERE estado = 'BORRADOR';
-- Tabla: CRITERIOS_EVALUACION
CREATE TABLE CRITERIOS_EVALUACION (
    id_criterio UUID NOT NULL DEFAULT gen_random_uuid(),
    id_plantilla UUID NOT NULL,
    nombre varchar(120) NOT NULL,
    descripcion varchar(500) NULL,
    orden SMALLINT NOT NULL,
    CONSTRAINT CRITERIOS_EVALUACION_pk PRIMARY KEY (id_criterio),
    CONSTRAINT uq_criterio_orden UNIQUE (id_plantilla, orden)
);
CREATE INDEX idx_criterios_id_plantilla ON CRITERIOS_EVALUACION (id_plantilla);
-- Tabla: PREGUNTAS_EVALUACION
-- peso: porcentaje de la nota final; la suma de una plantilla publicada es 100.
-- tipo_escala: LIKERT (1 a 5 con etiquetas), NUMERICA (rango libre) o CUALITATIVA (niveles con etiqueta).
CREATE TABLE PREGUNTAS_EVALUACION (
    id_pregunta UUID NOT NULL DEFAULT gen_random_uuid(),
    id_criterio UUID NOT NULL,
    enunciado varchar(500) NOT NULL,
    peso NUMERIC(5,2) NOT NULL,
    tipo_escala varchar(20) NOT NULL,
    valor_minimo NUMERIC(7,2) NOT NULL,
    valor_maximo NUMERIC(7,2) NOT NULL,
    orden SMALLINT NOT NULL,
    CONSTRAINT PREGUNTAS_EVALUACION_pk PRIMARY KEY (id_pregunta),
    CONSTRAINT uq_pregunta_orden UNIQUE (id_criterio, orden),
    CONSTRAINT chk_pregunta_peso CHECK (peso > 0 AND peso <= 100),
    CONSTRAINT chk_pregunta_tipo_escala CHECK (tipo_escala IN ('LIKERT', 'NUMERICA', 'CUALITATIVA')),
    CONSTRAINT chk_pregunta_rango CHECK (valor_minimo < valor_maximo)
);
CREATE INDEX idx_preguntas_id_criterio ON PREGUNTAS_EVALUACION (id_criterio);
-- Tabla: NIVELES_ESCALA
-- Etiqueta descriptiva de cada nivel, la que ve el evaluador al calificar.
CREATE TABLE NIVELES_ESCALA (
    id_pregunta UUID NOT NULL,
    valor NUMERIC(7,2) NOT NULL,
    etiqueta varchar(80) NOT NULL,
    CONSTRAINT NIVELES_ESCALA_pk PRIMARY KEY (id_pregunta, valor)
);
-- llaves foráneas
ALTER TABLE CRITERIOS_EVALUACION ADD CONSTRAINT fk_criterio_plantilla
    FOREIGN KEY (id_plantilla) REFERENCES PLANTILLAS_EVALUACION (id_plantilla) ON DELETE CASCADE;
ALTER TABLE PREGUNTAS_EVALUACION ADD CONSTRAINT fk_pregunta_criterio
    FOREIGN KEY (id_criterio) REFERENCES CRITERIOS_EVALUACION (id_criterio) ON DELETE CASCADE;
ALTER TABLE NIVELES_ESCALA ADD CONSTRAINT fk_nivel_pregunta
    FOREIGN KEY (id_pregunta) REFERENCES PREGUNTAS_EVALUACION (id_pregunta) ON DELETE CASCADE;
