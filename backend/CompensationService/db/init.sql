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
-- Tabla: CONDICIONES_ESPECIALES
-- Bonificación por una condición especial de trabajo. Su valor, vigencias y cuenta contable son los de un
-- concepto de tipo INGRESO. TRASNOCHE y FERIADO se detectan de las jornadas marcadas en Asistencia;
-- ASIGNACION se asigna por colaborador (por ejemplo, áreas de congelados).
-- Monto fijo: por jornada detectada o por mes asignado. Porcentaje: del haber básico diario por jornada
-- detectada, o del haber básico mensual en una asignación (prorrateado por días).
CREATE TABLE CONDICIONES_ESPECIALES (
    id_condicion UUID NOT NULL DEFAULT gen_random_uuid(),
    id_concepto UUID NOT NULL,
    tipo_condicion varchar(10) NOT NULL,
    -- Solo TRASNOCHE: minutos trabajados entre las 20:00 y las 06:00 para que la jornada cuente.
    minutos_nocturnos_minimos smallint NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT CONDICIONES_ESPECIALES_pk PRIMARY KEY (id_condicion),
    CONSTRAINT uq_condicion_concepto UNIQUE (id_concepto),
    CONSTRAINT fk_condicion_concepto FOREIGN KEY (id_concepto)
        REFERENCES CONCEPTOS_PLANILLA (id_concepto) ON DELETE CASCADE,
    CONSTRAINT chk_condicion_tipo CHECK (tipo_condicion IN ('TRASNOCHE', 'FERIADO', 'ASIGNACION')),
    CONSTRAINT chk_condicion_minutos CHECK (
        (tipo_condicion = 'TRASNOCHE' AND minutos_nocturnos_minimos BETWEEN 1 AND 600)
        OR (tipo_condicion <> 'TRASNOCHE' AND minutos_nocturnos_minimos IS NULL)
    )
);
-- Tabla: ASIGNACIONES_CONDICION
-- Colaboradores con una condición de tipo ASIGNACION. El bono se aplica mientras la asignación está vigente
-- (vigente_hasta NULL = sin fecha de fin). Nombre y área son copia de EmployeeService al asignar.
CREATE TABLE ASIGNACIONES_CONDICION (
    id_asignacion UUID NOT NULL DEFAULT gen_random_uuid(),
    id_condicion UUID NOT NULL,
    id_empleado UUID NOT NULL,
    nombre_empleado varchar(150) NOT NULL,
    area varchar(100) NULL,
    vigente_desde date NOT NULL,
    vigente_hasta date NULL,
    motivo varchar(250) NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ASIGNACIONES_CONDICION_pk PRIMARY KEY (id_asignacion),
    CONSTRAINT fk_asignacion_condicion FOREIGN KEY (id_condicion)
        REFERENCES CONDICIONES_ESPECIALES (id_condicion) ON DELETE CASCADE,
    CONSTRAINT chk_asignacion_fechas CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde),
    CONSTRAINT ex_asignacion_sin_solapamiento EXCLUDE USING gist (
        id_condicion WITH =,
        id_empleado WITH =,
        daterange(vigente_desde, vigente_hasta, '[]') WITH &&
    )
);
CREATE INDEX idx_asignaciones_condicion_empleado ON ASIGNACIONES_CONDICION (id_empleado);
-- Tabla: PROCESOS_CONDICION
-- Último procesamiento de bonos de cada mes (periodo AAAA-MM). Reprocesar reemplaza sus bonos.
CREATE TABLE PROCESOS_CONDICION (
    id_proceso UUID NOT NULL DEFAULT gen_random_uuid(),
    periodo char(7) NOT NULL,
    fecha_inicio date NOT NULL,
    fecha_fin date NOT NULL,
    jornadas_analizadas int NOT NULL DEFAULT 0,
    procesado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT PROCESOS_CONDICION_pk PRIMARY KEY (id_proceso),
    CONSTRAINT uq_proceso_periodo UNIQUE (periodo),
    CONSTRAINT chk_proceso_fechas CHECK (fecha_fin >= fecha_inicio)
);
-- Tabla: BONOS_CONDICION
-- Bono de un colaborador en un periodo, con la vigencia del concepto que le dio el valor.
-- cantidad: jornadas detectadas o días asignados. factor: multiplicador del valor (jornadas para monto fijo,
-- jornadas/30 o días asignados/días del mes para porcentaje). monto: solo en monto fijo; el porcentaje se
-- calcula en la planilla sobre el haber básico.
CREATE TABLE BONOS_CONDICION (
    id_bono UUID NOT NULL DEFAULT gen_random_uuid(),
    id_proceso UUID NOT NULL,
    id_condicion UUID NOT NULL,
    id_vigencia UUID NOT NULL,
    id_empleado UUID NOT NULL,
    nombre_empleado varchar(150) NOT NULL,
    origen varchar(10) NOT NULL,
    id_asignacion UUID NULL,
    cantidad smallint NOT NULL,
    fechas date[] NOT NULL DEFAULT '{}',
    factor numeric(10,6) NOT NULL,
    valor numeric(12,4) NOT NULL,
    monto numeric(12,2) NULL,
    CONSTRAINT BONOS_CONDICION_pk PRIMARY KEY (id_bono),
    CONSTRAINT fk_bono_proceso FOREIGN KEY (id_proceso)
        REFERENCES PROCESOS_CONDICION (id_proceso) ON DELETE CASCADE,
    CONSTRAINT fk_bono_condicion FOREIGN KEY (id_condicion) REFERENCES CONDICIONES_ESPECIALES (id_condicion),
    -- Una condición con bonos procesados no se puede eliminar, solo inactivar.
    CONSTRAINT fk_bono_vigencia FOREIGN KEY (id_vigencia) REFERENCES VIGENCIAS_CONCEPTO (id_vigencia),
    CONSTRAINT fk_bono_asignacion FOREIGN KEY (id_asignacion)
        REFERENCES ASIGNACIONES_CONDICION (id_asignacion) ON DELETE SET NULL,
    CONSTRAINT chk_bono_origen CHECK (origen IN ('DETECCION', 'ASIGNACION')),
    CONSTRAINT chk_bono_cantidad CHECK (cantidad > 0 AND factor > 0)
);
CREATE INDEX idx_bonos_condicion_proceso ON BONOS_CONDICION (id_proceso);
CREATE INDEX idx_bonos_condicion_empleado ON BONOS_CONDICION (id_empleado);
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

-- tablas
-- Tabla: PRESTAMOS
-- Anticipos de sueldo y préstamos otorgados a un colaborador, con su plan de cuotas.
-- id_empleado referencia a EMPLOYEES (EmployeeDB): sin FK por ser otro servicio, se valida en el backend.
-- liquido_pagable_referencial y porcentaje_cuota quedan fijos al registrar: conservan la base que se usó
-- para aprobar el préstamo, aunque el sueldo del colaborador cambie después.
CREATE TABLE PRESTAMOS (
    id_prestamo UUID NOT NULL DEFAULT gen_random_uuid(),
    id_empleado UUID NOT NULL,
    tipo varchar(10) NOT NULL,
    monto numeric(12,2) NOT NULL,
    numero_cuotas smallint NOT NULL,
    mes_inicio date NOT NULL,
    motivo varchar(250) NULL,
    liquido_pagable_referencial numeric(12,2) NOT NULL,
    porcentaje_cuota numeric(5,2) NOT NULL,
    saldo_pendiente numeric(12,2) NOT NULL,
    estado varchar(12) NOT NULL DEFAULT 'ACTIVO',
    registrado_por varchar(80) NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT PRESTAMOS_pk PRIMARY KEY (id_prestamo),
    CONSTRAINT chk_prestamo_tipo CHECK (tipo IN ('ANTICIPO', 'PRESTAMO')),
    CONSTRAINT chk_prestamo_monto CHECK (monto > 0),
    CONSTRAINT chk_prestamo_cuotas CHECK (numero_cuotas BETWEEN 1 AND 60),
    CONSTRAINT chk_prestamo_liquido CHECK (liquido_pagable_referencial > 0),
    CONSTRAINT chk_prestamo_saldo CHECK (saldo_pendiente >= 0),
    CONSTRAINT chk_prestamo_estado CHECK (estado IN ('ACTIVO', 'COMPLETADO', 'CANCELADO')),
    CONSTRAINT chk_prestamo_mes_inicio CHECK (mes_inicio = date_trunc('month', mes_inicio)::date)
);
CREATE INDEX idx_prestamos_empleado ON PRESTAMOS (id_empleado);
-- Tabla: CUOTAS_PRESTAMO
-- Plan de cuotas de cada préstamo: una fila por mes de descuento, con su estado de pago.
-- periodo = primer día del mes en que la cuota se descuenta en la planilla.
CREATE TABLE CUOTAS_PRESTAMO (
    id_cuota UUID NOT NULL DEFAULT gen_random_uuid(),
    id_prestamo UUID NOT NULL,
    numero_cuota smallint NOT NULL,
    periodo date NOT NULL,
    monto numeric(12,2) NOT NULL,
    estado varchar(10) NOT NULL DEFAULT 'PENDIENTE',
    pagada_en TIMESTAMPTZ NULL,
    CONSTRAINT CUOTAS_PRESTAMO_pk PRIMARY KEY (id_cuota),
    CONSTRAINT fk_cuota_prestamo FOREIGN KEY (id_prestamo)
        REFERENCES PRESTAMOS (id_prestamo) ON DELETE CASCADE,
    CONSTRAINT chk_cuota_monto CHECK (monto > 0),
    CONSTRAINT chk_cuota_estado CHECK (estado IN ('PENDIENTE', 'PAGADA')),
    CONSTRAINT chk_cuota_pago CHECK ((estado = 'PAGADA') = (pagada_en IS NOT NULL)),
    CONSTRAINT chk_cuota_periodo CHECK (periodo = date_trunc('month', periodo)::date),
    CONSTRAINT uq_cuota_prestamo_numero UNIQUE (id_prestamo, numero_cuota),
    CONSTRAINT uq_cuota_prestamo_periodo UNIQUE (id_prestamo, periodo)
);
-- La planilla de un periodo consulta todas las cuotas pendientes de ese mes, de todos los préstamos.
CREATE INDEX idx_cuotas_periodo_estado ON CUOTAS_PRESTAMO (periodo, estado);

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
