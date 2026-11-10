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
-- Tabla: PLANILLAS
-- Planilla mensual (periodo AAAA-MM): BORRADOR → APROBADA → CERRADA. Fuera de borrador no se edita ni se
-- elimina, ni cambia su detalle: lo valida el servicio (sin triggers, por decisión del equipo).
-- datos_hasta: último día consolidado; en el mes en curso llega hasta ayer y solo se aprueba el mes completo.
-- Contabilidad y Pagos confirman por separado; con ambas confirmaciones la planilla se cierra.
CREATE TABLE PLANILLAS (
    id_planilla UUID NOT NULL DEFAULT gen_random_uuid(),
    periodo char(7) NOT NULL,
    fecha_inicio date NOT NULL,
    fecha_fin date NOT NULL,
    datos_hasta date NOT NULL,
    estado varchar(10) NOT NULL DEFAULT 'BORRADOR',
    advertencias text[] NOT NULL DEFAULT '{}',
    generada_por UUID NOT NULL,
    generada_por_nombre varchar(150) NOT NULL,
    generada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    aprobada_por UUID NULL,
    aprobada_por_nombre varchar(150) NULL,
    aprobada_en TIMESTAMPTZ NULL,
    estado_contabilidad varchar(10) NOT NULL DEFAULT 'PENDIENTE',
    estado_pagos varchar(10) NOT NULL DEFAULT 'PENDIENTE',
    cerrada_en TIMESTAMPTZ NULL,
    CONSTRAINT PLANILLAS_pk PRIMARY KEY (id_planilla),
    CONSTRAINT uq_planilla_periodo UNIQUE (periodo),
    CONSTRAINT chk_planilla_estado CHECK (estado IN ('BORRADOR', 'APROBADA', 'CERRADA')),
    CONSTRAINT chk_planilla_fechas CHECK (fecha_fin >= fecha_inicio AND datos_hasta BETWEEN fecha_inicio AND fecha_fin),
    CONSTRAINT chk_planilla_aprobacion CHECK (
        (estado = 'BORRADOR') = (aprobada_en IS NULL)
        AND (aprobada_en IS NULL) = (aprobada_por IS NULL)
        AND (aprobada_por IS NULL) = (aprobada_por_nombre IS NULL)
    ),
    CONSTRAINT chk_planilla_mes_completo CHECK (estado = 'BORRADOR' OR datos_hasta = fecha_fin),
    CONSTRAINT chk_planilla_integraciones CHECK (
        estado_contabilidad IN ('PENDIENTE', 'CONFIRMADA', 'RECHAZADA')
        AND estado_pagos IN ('PENDIENTE', 'CONFIRMADA', 'RECHAZADA')
    ),
    CONSTRAINT chk_planilla_cierre CHECK (
        (estado = 'CERRADA') = (cerrada_en IS NOT NULL)
        AND (estado <> 'CERRADA' OR (estado_contabilidad = 'CONFIRMADA' AND estado_pagos = 'CONFIRMADA'))
    )
);
-- Tabla: PLANILLA_EMPLEADOS
-- Novedades del mes consolidadas por colaborador. Nombre, cargo, área y haber son copia al generar.
-- haber_mensual: haber del contrato (promedio por días si cambió en el mes). dias_contrato: 30 si el contrato
-- cubre el mes; si no, los días cubiertos. dias_pagados descuenta faltas injustificadas y licencias sin goce.
CREATE TABLE PLANILLA_EMPLEADOS (
    id_planilla_empleado UUID NOT NULL DEFAULT gen_random_uuid(),
    id_planilla UUID NOT NULL,
    id_empleado UUID NOT NULL,
    nombre_empleado varchar(150) NOT NULL,
    numero_documento varchar(20) NULL,
    cargo varchar(100) NULL,
    area varchar(100) NULL,
    sucursal varchar(100) NULL,
    id_contrato UUID NOT NULL,
    numero_contrato varchar(40) NOT NULL,
    haber_mensual numeric(12,2) NOT NULL,
    contrato_desde date NOT NULL,
    contrato_hasta date NOT NULL,
    dias_contrato smallint NOT NULL,
    faltas_injustificadas smallint NOT NULL DEFAULT 0,
    dias_licencia_sin_goce smallint NOT NULL DEFAULT 0,
    dias_licencia_con_goce smallint NOT NULL DEFAULT 0,
    dias_pagados smallint NOT NULL,
    atrasos smallint NOT NULL DEFAULT 0,
    minutos_atraso int NOT NULL DEFAULT 0,
    minutos_extra_habil int NOT NULL DEFAULT 0,
    minutos_extra_domingo int NOT NULL DEFAULT 0,
    minutos_extra_feriado int NOT NULL DEFAULT 0,
    minutos_extra_nocturnos int NOT NULL DEFAULT 0,
    minutos_domingo int NOT NULL DEFAULT 0,
    minutos_feriado int NOT NULL DEFAULT 0,
    minutos_descanso int NOT NULL DEFAULT 0,
    minutos_nocturnos int NOT NULL DEFAULT 0,
    observaciones text[] NOT NULL DEFAULT '{}',
    -- Resultado del cálculo (detalle en CALCULOS_PLANILLA). El líquido puede quedar negativo: es una alerta.
    total_ganado numeric(12,2) NOT NULL DEFAULT 0,
    total_descuentos numeric(12,2) NOT NULL DEFAULT 0,
    liquido_pagable numeric(12,2) NOT NULL DEFAULT 0,
    total_aportes numeric(12,2) NOT NULL DEFAULT 0,
    -- Inconsistencias del cálculo: con alguna, la planilla no se aprueba.
    alertas text[] NOT NULL DEFAULT '{}',
    CONSTRAINT PLANILLA_EMPLEADOS_pk PRIMARY KEY (id_planilla_empleado),
    CONSTRAINT uq_planilla_empleado UNIQUE (id_planilla, id_empleado),
    CONSTRAINT fk_planilla_empleado_planilla FOREIGN KEY (id_planilla)
        REFERENCES PLANILLAS (id_planilla) ON DELETE CASCADE,
    CONSTRAINT chk_planilla_empleado_haber CHECK (haber_mensual > 0),
    CONSTRAINT chk_planilla_empleado_contrato CHECK (contrato_hasta >= contrato_desde),
    CONSTRAINT chk_planilla_empleado_dias CHECK (
        dias_contrato BETWEEN 1 AND 30 AND dias_pagados BETWEEN 0 AND dias_contrato
        AND faltas_injustificadas >= 0 AND dias_licencia_sin_goce >= 0 AND dias_licencia_con_goce >= 0
    ),
    CONSTRAINT chk_planilla_empleado_minutos CHECK (
        atrasos >= 0 AND minutos_atraso >= 0 AND minutos_extra_habil >= 0 AND minutos_extra_domingo >= 0
        AND minutos_extra_feriado >= 0 AND minutos_extra_nocturnos >= 0 AND minutos_domingo >= 0
        AND minutos_feriado >= 0 AND minutos_descanso >= 0 AND minutos_nocturnos >= 0
    ),
    CONSTRAINT chk_planilla_empleado_totales CHECK (
        total_ganado >= 0 AND total_descuentos >= 0 AND total_aportes >= 0
        AND liquido_pagable = total_ganado - total_descuentos
    )
);
-- Tabla: NOVEDADES_PLANILLA
-- Rubros variables de un colaborador en la planilla (bonos por condiciones especiales y por productividad), con la
-- vigencia del concepto que les dio el valor. monto NULL: porcentaje que se calcula sobre el haber básico.
-- El bono de productividad (KAN-71) toma su valor de la regla del periodo, no de una vigencia de concepto.
CREATE TABLE NOVEDADES_PLANILLA (
    id_novedad UUID NOT NULL DEFAULT gen_random_uuid(),
    id_planilla_empleado UUID NOT NULL,
    origen varchar(15) NOT NULL,
    id_vigencia UUID NULL,
    codigo varchar(20) NOT NULL,
    nombre varchar(80) NOT NULL,
    forma_calculo varchar(12) NOT NULL,
    cantidad smallint NOT NULL,
    factor numeric(10,6) NOT NULL,
    valor numeric(12,4) NOT NULL,
    monto numeric(12,2) NULL,
    detalle varchar(400) NULL,
    CONSTRAINT NOVEDADES_PLANILLA_pk PRIMARY KEY (id_novedad),
    CONSTRAINT fk_novedad_planilla_empleado FOREIGN KEY (id_planilla_empleado)
        REFERENCES PLANILLA_EMPLEADOS (id_planilla_empleado) ON DELETE CASCADE,
    -- Un concepto usado en una planilla no se puede eliminar, solo inactivar.
    CONSTRAINT fk_novedad_planilla_vigencia FOREIGN KEY (id_vigencia) REFERENCES VIGENCIAS_CONCEPTO (id_vigencia),
    CONSTRAINT chk_novedad_planilla_origen CHECK (origen IN ('BONO_CONDICION', 'PRODUCTIVIDAD')),
    CONSTRAINT chk_novedad_planilla_vigencia CHECK ((id_vigencia IS NULL) = (origen = 'PRODUCTIVIDAD')),
    CONSTRAINT chk_novedad_planilla_forma CHECK (forma_calculo IN ('MONTO_FIJO', 'PORCENTAJE')),
    CONSTRAINT chk_novedad_planilla_valores CHECK (cantidad > 0 AND factor > 0 AND valor > 0 AND (monto IS NULL OR monto >= 0)),
    CONSTRAINT chk_novedad_planilla_monto CHECK ((forma_calculo = 'MONTO_FIJO') = (monto IS NOT NULL))
);
CREATE INDEX idx_novedades_planilla_empleado ON NOVEDADES_PLANILLA (id_planilla_empleado);
-- Tabla: CALCULOS_PLANILLA
-- Detalle del cálculo de cada colaborador: un renglón por concepto, con la vigencia que dio el valor, la base,
-- la cantidad (días u horas) y el resultado redondeado a centavos. Los totales del colaborador son su suma.
-- El bono de antigüedad (escala de KAN-70), el de productividad (regla de KAN-71) y las cuotas de préstamos (KAN-65)
-- no salen de una vigencia de concepto.
CREATE TABLE CALCULOS_PLANILLA (
    id_calculo UUID NOT NULL DEFAULT gen_random_uuid(),
    id_planilla_empleado UUID NOT NULL,
    id_vigencia UUID NULL,
    orden smallint NOT NULL,
    tipo varchar(10) NOT NULL,
    codigo varchar(20) NOT NULL,
    nombre varchar(80) NOT NULL,
    forma_calculo varchar(12) NOT NULL,
    base numeric(12,2) NULL,
    cantidad numeric(10,2) NULL,
    valor numeric(12,4) NOT NULL,
    resultado numeric(12,2) NOT NULL,
    detalle varchar(250) NULL,
    CONSTRAINT CALCULOS_PLANILLA_pk PRIMARY KEY (id_calculo),
    CONSTRAINT uq_calculo_orden UNIQUE (id_planilla_empleado, orden),
    CONSTRAINT fk_calculo_planilla_empleado FOREIGN KEY (id_planilla_empleado)
        REFERENCES PLANILLA_EMPLEADOS (id_planilla_empleado) ON DELETE CASCADE,
    -- Un concepto usado en una planilla no se puede eliminar, solo inactivar.
    CONSTRAINT fk_calculo_vigencia FOREIGN KEY (id_vigencia) REFERENCES VIGENCIAS_CONCEPTO (id_vigencia),
    CONSTRAINT chk_calculo_tipo CHECK (tipo IN ('INGRESO', 'DESCUENTO', 'APORTE')),
    CONSTRAINT chk_calculo_forma CHECK (forma_calculo IN ('MONTO_FIJO', 'PORCENTAJE')),
    CONSTRAINT chk_calculo_origen CHECK (id_vigencia IS NOT NULL OR codigo IN ('BONO-ANTIGUEDAD', 'BONO-PRODUCTIVIDAD', 'CUOTA-PRESTAMO')),
    CONSTRAINT chk_calculo_valores CHECK (valor > 0 AND resultado >= 0 AND (base IS NULL OR base >= 0) AND (cantidad IS NULL OR cantidad >= 0))
);
CREATE INDEX idx_calculos_planilla_empleado ON CALCULOS_PLANILLA (id_planilla_empleado);
-- Tabla: EVENTOS_SALIENTES
-- Bandeja de salida (outbox): el evento se guarda en la misma transacción que la aprobación y se envía
-- después al broker, con reintentos, hasta que se entrega.
CREATE TABLE EVENTOS_SALIENTES (
    id_evento UUID NOT NULL DEFAULT gen_random_uuid(),
    topico varchar(60) NOT NULL,
    tipo_evento varchar(60) NOT NULL,
    id_planilla UUID NULL,
    carga JSONB NOT NULL,
    estado varchar(10) NOT NULL DEFAULT 'PENDIENTE',
    intentos smallint NOT NULL DEFAULT 0,
    ultimo_error varchar(255) NULL,
    proximo_intento_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    entregado_en TIMESTAMPTZ NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT EVENTOS_SALIENTES_pk PRIMARY KEY (id_evento),
    CONSTRAINT fk_evento_planilla FOREIGN KEY (id_planilla) REFERENCES PLANILLAS (id_planilla),
    CONSTRAINT chk_evento_estado CHECK (estado IN ('PENDIENTE', 'ENTREGADO', 'FALLIDO')),
    CONSTRAINT chk_evento_intentos CHECK (intentos >= 0),
    CONSTRAINT chk_evento_entrega CHECK ((estado = 'ENTREGADO') = (entregado_en IS NOT NULL))
);
CREATE INDEX idx_eventos_salientes_pendientes ON EVENTOS_SALIENTES (estado, proximo_intento_en);
CREATE INDEX idx_eventos_salientes_planilla ON EVENTOS_SALIENTES (id_planilla);
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

-- Conceptos que calcula la planilla con las novedades del mes (KAN-64). El valor de cada vigencia es el
-- porcentaje que aplica el servicio: haber básico por días pagados, recargo de horas extra, pago adicional de
-- domingos, feriados y descansos trabajados, recargo nocturno y Aporte Nacional Solidario por tramo
-- (sobre el excedente de Bs 13.000, 25.000 y 35.000 del total ganado, Ley 065).
WITH conceptos AS (
    INSERT INTO CONCEPTOS_PLANILLA (codigo, nombre, descripcion, tipo, forma_calculo, base_calculo, es_de_ley,
                                    cuenta_contable_codigo, cuenta_contable_nombre)
    VALUES
        ('HABER-BASICO', 'Haber básico', 'Porcentaje del haber mensual por los días pagados del mes (sobre 30).',
         'INGRESO', 'PORCENTAJE', 'HABER_BASICO', TRUE, '5.1.1.01', 'Sueldos y salarios'),
        ('HORAS-EXTRA', 'Horas extraordinarias', 'Recargo sobre el valor de la hora (haber mensual / 240) por cada hora extra aprobada.',
         'INGRESO', 'PORCENTAJE', 'HABER_BASICO', TRUE, '5.1.1.02', 'Horas extraordinarias'),
        ('DOMINICAL', 'Domingos, feriados y descansos trabajados', 'Pago adicional sobre el valor de la hora por las horas ordinarias trabajadas en domingo, feriado o día de descanso.',
         'INGRESO', 'PORCENTAJE', 'HABER_BASICO', TRUE, '5.1.1.03', 'Dominicales y feriados trabajados'),
        ('RECARGO-NOCTURNO', 'Recargo nocturno', 'Recargo sobre el valor de la hora por las horas trabajadas entre las 20:00 y las 06:00.',
         'INGRESO', 'PORCENTAJE', 'HABER_BASICO', TRUE, '5.1.1.04', 'Recargo nocturno'),
        ('ANS-13000', 'Aporte nacional solidario (excedente de Bs 13.000)', 'Sobre la parte del total ganado que supera Bs 13.000.',
         'DESCUENTO', 'PORCENTAJE', 'TOTAL_GANADO', TRUE, '2.1.3.01', 'Aportes laborales por pagar'),
        ('ANS-25000', 'Aporte nacional solidario (excedente de Bs 25.000)', 'Sobre la parte del total ganado que supera Bs 25.000.',
         'DESCUENTO', 'PORCENTAJE', 'TOTAL_GANADO', TRUE, '2.1.3.01', 'Aportes laborales por pagar'),
        ('ANS-35000', 'Aporte nacional solidario (excedente de Bs 35.000)', 'Sobre la parte del total ganado que supera Bs 35.000.',
         'DESCUENTO', 'PORCENTAJE', 'TOTAL_GANADO', TRUE, '2.1.3.01', 'Aportes laborales por pagar')
    RETURNING id_concepto, codigo
)
INSERT INTO VIGENCIAS_CONCEPTO (id_concepto, valor, vigente_desde)
SELECT c.id_concepto, v.valor, DATE '2026-01-01'
FROM conceptos c
JOIN (VALUES
    ('HABER-BASICO', 100.00),
    ('HORAS-EXTRA', 100.00),
    ('DOMINICAL', 100.00),
    ('RECARGO-NOCTURNO', 25.00),
    ('ANS-13000', 1.00),
    ('ANS-25000', 5.00),
    ('ANS-35000', 10.00)
) AS v (codigo, valor) USING (codigo);

-- Tabla: REGLAS_BONO_PRODUCTIVIDAD
-- Reglas configurables de bonos variables por cumplimiento de metas (RF-51, KAN-71): venta, puntualidad o
-- desempeño en caja. Una regla activa por tipo de meta y periodo; "puntualidad" y "desempeño en caja" quedan
-- definidas aquí para cuando existan esas métricas, pero hoy solo Ventas y Marketing publica datos.
CREATE TABLE REGLAS_BONO_PRODUCTIVIDAD (
    id_regla UUID NOT NULL DEFAULT gen_random_uuid(),
    periodo date NOT NULL,
    tipo_meta varchar(20) NOT NULL,
    umbral_cumplimiento numeric(6,2) NOT NULL,
    forma_calculo varchar(12) NOT NULL,
    valor numeric(12,4) NOT NULL,
    esta_activa boolean NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT REGLAS_BONO_PRODUCTIVIDAD_pk PRIMARY KEY (id_regla),
    CONSTRAINT uq_regla_periodo_tipo UNIQUE (periodo, tipo_meta),
    CONSTRAINT chk_regla_tipo_meta CHECK (tipo_meta IN ('VENTAS', 'PUNTUALIDAD', 'DESEMPENO_CAJA')),
    CONSTRAINT chk_regla_forma CHECK (forma_calculo IN ('MONTO_FIJO', 'PORCENTAJE')),
    CONSTRAINT chk_regla_umbral CHECK (umbral_cumplimiento > 0),
    CONSTRAINT chk_regla_valor CHECK (valor > 0),
    CONSTRAINT chk_regla_periodo_dia CHECK (EXTRACT(DAY FROM periodo) = 1)
);
CREATE INDEX idx_reglas_bono_periodo ON REGLAS_BONO_PRODUCTIVIDAD (periodo);

-- Tabla: EVENTOS_VENTAS_ENTRANTES
-- Bandeja de entrada del cierre de ventas del periodo publicado por Ventas y Marketing (grupo E). id_mensaje
-- (del remitente) evita procesar dos veces el mismo mensaje (RF-51, criterio 4). RECIBIDO: en proceso o
-- esperando reintento; PROCESADO: las métricas quedaron registradas; IGNORADO: mensaje repetido o que no es
-- para RRHH; FALLIDO: inválido o sin procesar tras varios intentos (cola de mensajes fallidos, se reprocesa).
CREATE TABLE EVENTOS_VENTAS_ENTRANTES (
    id_evento_entrante UUID NOT NULL DEFAULT gen_random_uuid(),
    id_mensaje varchar(100) NOT NULL,
    topico varchar(60) NOT NULL,
    tipo_evento varchar(60) NOT NULL,
    periodo date NULL,
    carga JSONB NOT NULL,
    estado varchar(10) NOT NULL DEFAULT 'RECIBIDO',
    intentos smallint NOT NULL DEFAULT 0,
    detalle varchar(255) NULL,
    recibido_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    procesado_en TIMESTAMPTZ NULL,
    CONSTRAINT EVENTOS_VENTAS_ENTRANTES_pk PRIMARY KEY (id_evento_entrante),
    CONSTRAINT uq_evento_venta_mensaje UNIQUE (id_mensaje),
    CONSTRAINT chk_evento_venta_estado CHECK (estado IN ('RECIBIDO', 'PROCESADO', 'IGNORADO', 'FALLIDO')),
    CONSTRAINT chk_evento_venta_intentos CHECK (intentos >= 0),
    CONSTRAINT chk_evento_venta_procesado CHECK ((estado IN ('PROCESADO', 'IGNORADO')) = (procesado_en IS NOT NULL))
);
CREATE INDEX idx_eventos_venta_estado ON EVENTOS_VENTAS_ENTRANTES (estado, recibido_en);

-- Tabla: METRICAS_VENTAS_PERIODO
-- Ventas cerradas y cumplimiento de cuota de cada vendedor y cajero del periodo, tal como las publica
-- Ventas y Marketing. Una fila por colaborador y periodo; el evento que la trajo queda para trazabilidad.
-- Un periodo reenviado (no duplicado, un id_mensaje nuevo con una corrección) reemplaza la fila anterior.
CREATE TABLE METRICAS_VENTAS_PERIODO (
    id_metrica UUID NOT NULL DEFAULT gen_random_uuid(),
    periodo date NOT NULL,
    id_empleado UUID NOT NULL,
    rol varchar(20) NOT NULL,
    monto_ventas numeric(14,2) NOT NULL,
    cuota_asignada numeric(14,2) NOT NULL,
    porcentaje_cumplimiento numeric(7,2) NOT NULL,
    id_evento_entrante UUID NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT METRICAS_VENTAS_PERIODO_pk PRIMARY KEY (id_metrica),
    CONSTRAINT uq_metrica_periodo_empleado UNIQUE (periodo, id_empleado),
    CONSTRAINT fk_metrica_evento FOREIGN KEY (id_evento_entrante)
        REFERENCES EVENTOS_VENTAS_ENTRANTES (id_evento_entrante),
    CONSTRAINT chk_metrica_rol CHECK (rol IN ('VENDEDOR', 'CAJERO')),
    CONSTRAINT chk_metrica_monto CHECK (monto_ventas >= 0),
    CONSTRAINT chk_metrica_cuota CHECK (cuota_asignada > 0),
    CONSTRAINT chk_metrica_cumplimiento CHECK (porcentaje_cumplimiento >= 0)
);
CREATE INDEX idx_metricas_ventas_periodo ON METRICAS_VENTAS_PERIODO (periodo);

-- Tabla: BONOS_PRODUCTIVIDAD
-- Bono asignado a un colaborador que superó el umbral de la regla vigente de su periodo (RF-51, criterio 3).
-- El motor reemplaza estos bonos al reprocesar el periodo, igual que BONOS_CONDICION.
CREATE TABLE BONOS_PRODUCTIVIDAD (
    id_bono UUID NOT NULL DEFAULT gen_random_uuid(),
    periodo date NOT NULL,
    id_empleado UUID NOT NULL,
    id_regla UUID NOT NULL,
    id_metrica UUID NOT NULL,
    porcentaje_cumplimiento numeric(7,2) NOT NULL,
    valor numeric(12,4) NOT NULL,
    monto numeric(12,2) NULL,
    generado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT BONOS_PRODUCTIVIDAD_pk PRIMARY KEY (id_bono),
    CONSTRAINT uq_bono_productividad UNIQUE (periodo, id_empleado, id_regla),
    CONSTRAINT fk_bono_regla FOREIGN KEY (id_regla) REFERENCES REGLAS_BONO_PRODUCTIVIDAD (id_regla),
    CONSTRAINT fk_bono_metrica FOREIGN KEY (id_metrica) REFERENCES METRICAS_VENTAS_PERIODO (id_metrica),
    CONSTRAINT chk_bono_monto CHECK (monto IS NULL OR monto > 0)
);
CREATE INDEX idx_bonos_productividad_periodo ON BONOS_PRODUCTIVIDAD (periodo);

-- El bono de productividad es un ingreso de la planilla (RF-51); el monto fijo o el porcentaje sobre el haber
-- básico lo define la regla vigente del periodo (REGLAS_BONO_PRODUCTIVIDAD), no una vigencia manual de este
-- concepto, igual que BONO-ANTIGUEDAD.
INSERT INTO CONCEPTOS_PLANILLA (codigo, nombre, descripcion, tipo, forma_calculo, base_calculo, es_de_ley,
                                cuenta_contable_codigo, cuenta_contable_nombre)
VALUES ('BONO-PRODUCTIVIDAD', 'Bono de productividad',
        'Se calcula según el cumplimiento de metas de venta, puntualidad o desempeño en caja del periodo.',
        'INGRESO', 'MONTO_FIJO', NULL, FALSE, '5.1.1.06', 'Bono de productividad');
