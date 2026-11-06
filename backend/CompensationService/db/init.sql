-- extensiones
-- btree_gist: permite combinar UUID y rangos de fechas en una restricción EXCLUDE.
CREATE EXTENSION IF NOT EXISTS btree_gist;
-- tablas
-- Tabla: CONCEPTOS_PLANILLA
-- Rubros de la planilla: ingresos del trabajador, descuentos y aportes patronales.
-- tipo y forma_calculo no cambian después de crear el concepto.
CREATE TABLE CONCEPTOS_PLANILLA (
    id_concepto UUID NOT NULL DEFAULT gen_random_uuid(),
    codigo varchar(20) NOT NULL,
    nombre varchar(80) NOT NULL,
    descripcion varchar(250) NULL,
    tipo varchar(10) NOT NULL,
    forma_calculo varchar(12) NOT NULL,
    base_calculo varchar(15) NULL,
    es_de_ley boolean NOT NULL DEFAULT FALSE,
    cuenta_contable_codigo varchar(20) NULL,
    cuenta_contable_nombre varchar(80) NULL,
    esta_activo boolean NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT CONCEPTOS_PLANILLA_pk PRIMARY KEY (id_concepto),
    CONSTRAINT uq_concepto_codigo UNIQUE (codigo),
    CONSTRAINT chk_concepto_tipo CHECK (tipo IN ('INGRESO', 'DESCUENTO', 'APORTE')),
    CONSTRAINT chk_concepto_forma CHECK (forma_calculo IN ('MONTO_FIJO', 'PORCENTAJE')),
    -- Solo los porcentajes llevan base: el haber básico o el total ganado.
    CONSTRAINT chk_concepto_base CHECK (
        (forma_calculo = 'PORCENTAJE' AND base_calculo IN ('HABER_BASICO', 'TOTAL_GANADO'))
        OR (forma_calculo = 'MONTO_FIJO' AND base_calculo IS NULL)
    ),
    CONSTRAINT chk_concepto_cuenta CHECK ((cuenta_contable_codigo IS NULL) = (cuenta_contable_nombre IS NULL))
);
-- Tabla: VIGENCIAS_CONCEPTO
-- Historial de valores de cada concepto. Una vigencia nueva cierra la anterior sin modificar su valor,
-- así las planillas ya generadas conservan el valor histórico. vigente_hasta NULL = sin fecha de fin.
-- Las planillas referenciarán id_vigencia: un concepto usado no se puede eliminar, solo inactivar.
CREATE TABLE VIGENCIAS_CONCEPTO (
    id_vigencia UUID NOT NULL DEFAULT gen_random_uuid(),
    id_concepto UUID NOT NULL,
    valor numeric(12,4) NOT NULL,
    vigente_desde date NOT NULL,
    vigente_hasta date NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT VIGENCIAS_CONCEPTO_pk PRIMARY KEY (id_vigencia),
    CONSTRAINT fk_vigencia_concepto FOREIGN KEY (id_concepto)
        REFERENCES CONCEPTOS_PLANILLA (id_concepto) ON DELETE CASCADE,
    CONSTRAINT chk_vigencia_valor CHECK (valor > 0),
    CONSTRAINT chk_vigencia_fechas CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde),
    CONSTRAINT ex_vigencia_sin_solapamiento EXCLUDE USING gist (
        id_concepto WITH =,
        daterange(vigente_desde, vigente_hasta, '[]') WITH &&
    )
);
-- datos iniciales
-- Aportes de ley sobre el total ganado (Ley 065 de Pensiones y seguridad social de corto plazo).
-- Cuentas contables referenciales: ajustar al plan de cuentas de Contabilidad.
WITH conceptos AS (
    INSERT INTO CONCEPTOS_PLANILLA (codigo, nombre, tipo, forma_calculo, base_calculo, es_de_ley,
                                    cuenta_contable_codigo, cuenta_contable_nombre)
    VALUES
        ('SIP-VEJEZ', 'Aporte laboral de vejez', 'DESCUENTO', 'PORCENTAJE', 'TOTAL_GANADO', TRUE,
         '2.1.3.01', 'Aportes laborales por pagar'),
        ('SIP-RIESGO', 'Aporte laboral por riesgo común', 'DESCUENTO', 'PORCENTAJE', 'TOTAL_GANADO', TRUE,
         '2.1.3.01', 'Aportes laborales por pagar'),
        ('SIP-COMISION', 'Comisión de administración de pensiones', 'DESCUENTO', 'PORCENTAJE', 'TOTAL_GANADO', TRUE,
         '2.1.3.01', 'Aportes laborales por pagar'),
        ('SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'DESCUENTO', 'PORCENTAJE', 'TOTAL_GANADO', TRUE,
         '2.1.3.01', 'Aportes laborales por pagar'),
        ('CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'APORTE', 'PORCENTAJE', 'TOTAL_GANADO', TRUE,
         '5.1.2.01', 'Cargas sociales patronales'),
        ('SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'APORTE', 'PORCENTAJE', 'TOTAL_GANADO', TRUE,
         '5.1.2.01', 'Cargas sociales patronales'),
        ('PRO-VIVIENDA', 'Aporte patronal para vivienda', 'APORTE', 'PORCENTAJE', 'TOTAL_GANADO', TRUE,
         '5.1.2.01', 'Cargas sociales patronales'),
        ('SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'APORTE', 'PORCENTAJE', 'TOTAL_GANADO', TRUE,
         '5.1.2.01', 'Cargas sociales patronales')
    RETURNING id_concepto, codigo
)
INSERT INTO VIGENCIAS_CONCEPTO (id_concepto, valor, vigente_desde)
SELECT c.id_concepto, v.valor, DATE '2026-01-01'
FROM conceptos c
JOIN (VALUES
    ('SIP-VEJEZ', 10.00),
    ('SIP-RIESGO', 1.71),
    ('SIP-COMISION', 0.50),
    ('SIP-SOLIDARIO', 0.50),
    ('CNS-SALUD', 10.00),
    ('SIP-RIESGO-PROF', 1.71),
    ('PRO-VIVIENDA', 2.00),
    ('SIP-SOLIDARIO-PAT', 3.00)
) AS v (codigo, valor) USING (codigo);

-- Tabla: VIGENCIAS_ESCALA_ANTIGUEDAD
-- Versiones de la tabla legal de escalas de antigüedad (RF-50). Una vigencia nueva cierra la anterior sin
-- modificar sus tramos, así los bonos ya calculados en planillas anteriores conservan el porcentaje histórico.
CREATE TABLE VIGENCIAS_ESCALA_ANTIGUEDAD (
    id_vigencia UUID NOT NULL DEFAULT gen_random_uuid(),
    vigente_desde date NOT NULL,
    vigente_hasta date NULL,
    motivo varchar(250) NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT VIGENCIAS_ESCALA_ANTIGUEDAD_pk PRIMARY KEY (id_vigencia),
    CONSTRAINT chk_escala_fechas CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde),
    CONSTRAINT ex_escala_sin_solapamiento EXCLUDE USING gist (
        daterange(vigente_desde, vigente_hasta, '[]') WITH &&
    )
);
-- Tabla: TRAMOS_ANTIGUEDAD
-- Tramos de años de servicio y su porcentaje de bono, dentro de una vigencia de la escala legal.
-- anios_hasta NULL = sin tope (el tramo más alto de la escala).
CREATE TABLE TRAMOS_ANTIGUEDAD (
    id_tramo UUID NOT NULL DEFAULT gen_random_uuid(),
    id_vigencia UUID NOT NULL,
    anios_desde smallint NOT NULL,
    anios_hasta smallint NULL,
    porcentaje numeric(5,2) NOT NULL,
    CONSTRAINT TRAMOS_ANTIGUEDAD_pk PRIMARY KEY (id_tramo),
    CONSTRAINT fk_tramo_vigencia FOREIGN KEY (id_vigencia)
        REFERENCES VIGENCIAS_ESCALA_ANTIGUEDAD (id_vigencia) ON DELETE CASCADE,
    CONSTRAINT chk_tramo_anios_desde CHECK (anios_desde >= 0),
    CONSTRAINT chk_tramo_rango CHECK (anios_hasta IS NULL OR anios_hasta >= anios_desde),
    CONSTRAINT chk_tramo_porcentaje CHECK (porcentaje > 0 AND porcentaje <= 100),
    CONSTRAINT uq_tramo_vigencia_desde UNIQUE (id_vigencia, anios_desde)
);
CREATE INDEX idx_tramos_vigencia ON TRAMOS_ANTIGUEDAD (id_vigencia);

-- El bono de antigüedad es un ingreso de la planilla (RF-50, criterio 1); su porcentaje no es fijo por
-- vigencia de concepto sino que depende del tramo de años de servicio, por lo que no lleva VIGENCIAS_CONCEPTO.
INSERT INTO CONCEPTOS_PLANILLA (codigo, nombre, descripcion, tipo, forma_calculo, base_calculo, es_de_ley)
VALUES ('BONO-ANTIGUEDAD', 'Bono de antigüedad', 'Se calcula según los años de servicio y la escala legal vigente.',
        'INGRESO', 'PORCENTAJE', 'HABER_BASICO', TRUE);

-- datos iniciales
-- Escala de referencia: ajustar a la tabla legal vigente desde la pantalla de parametrización (RF-50, criterio 3).
WITH vigencia AS (
    INSERT INTO VIGENCIAS_ESCALA_ANTIGUEDAD (vigente_desde, motivo)
    VALUES (DATE '2026-01-01', 'Escala de referencia inicial, pendiente de validar por Administración')
    RETURNING id_vigencia
)
INSERT INTO TRAMOS_ANTIGUEDAD (id_vigencia, anios_desde, anios_hasta, porcentaje)
SELECT v.id_vigencia, t.anios_desde, t.anios_hasta, t.porcentaje
FROM vigencia v
JOIN (VALUES
    (2, 4, 5.00),
    (5, 7, 11.00),
    (8, 10, 18.00),
    (11, 14, 26.00),
    (15, 19, 34.00),
    (20, 24, 42.00),
    (25, NULL, 50.00)
) AS t (anios_desde, anios_hasta, porcentaje) ON TRUE;
