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
    -- Respuesta de cada sistema: número de asiento u orden si confirmó, motivo si rechazó.
    referencia_contabilidad varchar(60) NULL,
    motivo_contabilidad varchar(255) NULL,
    respondida_contabilidad_en TIMESTAMPTZ NULL,
    referencia_pagos varchar(60) NULL,
    motivo_pagos varchar(255) NULL,
    respondida_pagos_en TIMESTAMPTZ NULL,
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
    ),
    -- Un borrador no se envió: no tiene respuestas.
    CONSTRAINT chk_planilla_respuestas CHECK (
        (estado <> 'BORRADOR' OR (estado_contabilidad = 'PENDIENTE' AND estado_pagos = 'PENDIENTE'))
        AND (estado_contabilidad = 'PENDIENTE') = (respondida_contabilidad_en IS NULL)
        AND (estado_contabilidad = 'RECHAZADA') = (motivo_contabilidad IS NOT NULL)
        AND (referencia_contabilidad IS NULL OR estado_contabilidad = 'CONFIRMADA')
        AND (estado_pagos = 'PENDIENTE') = (respondida_pagos_en IS NULL)
        AND (estado_pagos = 'RECHAZADA') = (motivo_pagos IS NOT NULL)
        AND (referencia_pagos IS NULL OR estado_pagos = 'CONFIRMADA')
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

-- Tabla: PLANILLA_AGUINALDO (RF-47, KAN-67)
-- Cabecera de la planilla de aguinaldos de una gestión (1 de diciembre del año anterior al 30 de noviembre
-- de `gestion`). Mismo ciclo de vida y las mismas integraciones asíncronas que PLANILLAS: BORRADOR →
-- APROBADA (se publica el asiento y la orden de dispersión) → CERRADA (ambas confirmaciones llegaron).
CREATE TABLE PLANILLA_AGUINALDO (
    id_aguinaldo UUID NOT NULL DEFAULT gen_random_uuid(),
    gestion smallint NOT NULL,
    fecha_inicio date NOT NULL,
    fecha_fin date NOT NULL,
    estado varchar(10) NOT NULL DEFAULT 'BORRADOR',
    generada_por UUID NOT NULL,
    generada_por_nombre varchar(150) NOT NULL,
    generada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    aprobada_por UUID NULL,
    aprobada_por_nombre varchar(150) NULL,
    aprobada_en TIMESTAMPTZ NULL,
    estado_contabilidad varchar(10) NOT NULL DEFAULT 'PENDIENTE',
    referencia_contabilidad varchar(60) NULL,
    motivo_contabilidad varchar(255) NULL,
    respondida_contabilidad_en TIMESTAMPTZ NULL,
    estado_pagos varchar(10) NOT NULL DEFAULT 'PENDIENTE',
    referencia_pagos varchar(60) NULL,
    motivo_pagos varchar(255) NULL,
    respondida_pagos_en TIMESTAMPTZ NULL,
    cerrada_en TIMESTAMPTZ NULL,
    CONSTRAINT PLANILLA_AGUINALDO_pk PRIMARY KEY (id_aguinaldo),
    CONSTRAINT uq_aguinaldo_gestion UNIQUE (gestion),
    CONSTRAINT chk_aguinaldo_gestion CHECK (gestion BETWEEN 2000 AND 2100),
    CONSTRAINT chk_aguinaldo_estado CHECK (estado IN ('BORRADOR', 'APROBADA', 'CERRADA')),
    CONSTRAINT chk_aguinaldo_fechas CHECK (fecha_fin >= fecha_inicio),
    CONSTRAINT chk_aguinaldo_aprobacion CHECK (
        (estado = 'BORRADOR') = (aprobada_en IS NULL)
        AND (aprobada_en IS NULL) = (aprobada_por IS NULL)
        AND (aprobada_por IS NULL) = (aprobada_por_nombre IS NULL)
    ),
    CONSTRAINT chk_aguinaldo_integraciones CHECK (
        estado_contabilidad IN ('PENDIENTE', 'CONFIRMADA', 'RECHAZADA')
        AND estado_pagos IN ('PENDIENTE', 'CONFIRMADA', 'RECHAZADA')
    ),
    CONSTRAINT chk_aguinaldo_cierre CHECK (
        (estado = 'CERRADA') = (cerrada_en IS NOT NULL)
        AND (estado <> 'CERRADA' OR (estado_contabilidad = 'CONFIRMADA' AND estado_pagos = 'CONFIRMADA'))
    ),
    CONSTRAINT chk_aguinaldo_respuestas CHECK (
        (estado <> 'BORRADOR' OR (estado_contabilidad = 'PENDIENTE' AND estado_pagos = 'PENDIENTE'))
        AND (estado_contabilidad = 'PENDIENTE') = (respondida_contabilidad_en IS NULL)
        AND (estado_contabilidad = 'RECHAZADA') = (motivo_contabilidad IS NOT NULL)
        AND (referencia_contabilidad IS NULL OR estado_contabilidad = 'CONFIRMADA')
        AND (estado_pagos = 'PENDIENTE') = (respondida_pagos_en IS NULL)
        AND (estado_pagos = 'RECHAZADA') = (motivo_pagos IS NOT NULL)
        AND (referencia_pagos IS NULL OR estado_pagos = 'CONFIRMADA')
    )
);
-- Tabla: AGUINALDO_EMPLEADOS
-- Un renglón por colaborador: el promedio de sus tres últimos sueldos y las duodécimas (meses y días
-- comerciales de 30 días) trabajados en la gestión. Un colaborador con menos de 3 meses queda excluido con
-- el motivo (criterio 2), en vez de con un monto en cero indistinguible de "no le corresponde nada".
CREATE TABLE AGUINALDO_EMPLEADOS (
    id_aguinaldo_empleado UUID NOT NULL DEFAULT gen_random_uuid(),
    id_aguinaldo UUID NOT NULL,
    id_empleado UUID NOT NULL,
    nombre_empleado varchar(150) NOT NULL,
    numero_documento varchar(20) NULL,
    -- Copia de EmployeeService al generar (igual que PLANILLA_EMPLEADOS): centro de costo para el reporte
    -- contable consolidado (RF-49, KAN-69).
    cargo varchar(100) NULL,
    area varchar(100) NULL,
    sucursal varchar(100) NULL,
    fecha_ingreso date NOT NULL,
    meses_trabajados smallint NOT NULL,
    dias_trabajados smallint NOT NULL,
    promedio_sueldo numeric(12,2) NOT NULL,
    -- PLANILLAS: total ganado de sus últimas planillas mensuales (meses_promedio = cuántas, 1 a 3);
    -- CONTRATO: sin planillas, el haber pactado; NULL: sin sueldo registrado (queda excluido).
    origen_promedio varchar(10) NULL,
    meses_promedio smallint NULL,
    monto numeric(12,2) NOT NULL,
    excluido boolean NOT NULL DEFAULT FALSE,
    motivo_exclusion varchar(255) NULL,
    CONSTRAINT AGUINALDO_EMPLEADOS_pk PRIMARY KEY (id_aguinaldo_empleado),
    CONSTRAINT chk_aguinaldo_empleado_origen CHECK (
        (origen_promedio IS NULL OR origen_promedio IN ('PLANILLAS', 'CONTRATO'))
        AND (origen_promedio = 'PLANILLAS') = (meses_promedio IS NOT NULL)
        AND (meses_promedio IS NULL OR meses_promedio BETWEEN 1 AND 3)
    ),
    CONSTRAINT uq_aguinaldo_empleado UNIQUE (id_aguinaldo, id_empleado),
    CONSTRAINT fk_aguinaldo_empleado_aguinaldo FOREIGN KEY (id_aguinaldo)
        REFERENCES PLANILLA_AGUINALDO (id_aguinaldo) ON DELETE CASCADE,
    CONSTRAINT chk_aguinaldo_empleado_exclusion CHECK (excluido = (motivo_exclusion IS NOT NULL)),
    CONSTRAINT chk_aguinaldo_empleado_valores CHECK (
        meses_trabajados >= 0 AND dias_trabajados BETWEEN 0 AND 29 AND promedio_sueldo >= 0 AND monto >= 0
        AND (NOT excluido OR monto = 0)
    )
);
CREATE INDEX idx_aguinaldo_empleados_aguinaldo ON AGUINALDO_EMPLEADOS (id_aguinaldo);

-- Tabla: EVENTOS_SALIENTES
-- Bandeja de salida (outbox): el evento se guarda en la misma transacción que la aprobación y se envía
-- después al broker, con reintentos, hasta que se entrega. id_evento es el id_mensaje del mensaje enviado.
-- destino: CONTABILIDAD (asiento, grupo D) o PAGOS (orden de dispersión, grupo A). id_planilla (planilla
-- mensual) o id_aguinaldo (RF-47, KAN-67): nunca los dos, la misma bandeja sirve para ambas (criterio 5).
CREATE TABLE EVENTOS_SALIENTES (
    id_evento UUID NOT NULL DEFAULT gen_random_uuid(),
    topico varchar(60) NOT NULL,
    tipo_evento varchar(60) NOT NULL,
    id_planilla UUID NULL,
    id_aguinaldo UUID NULL,
    destino varchar(15) NULL,
    carga JSONB NOT NULL,
    estado varchar(10) NOT NULL DEFAULT 'PENDIENTE',
    intentos smallint NOT NULL DEFAULT 0,
    ultimo_error varchar(255) NULL,
    proximo_intento_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    entregado_en TIMESTAMPTZ NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT EVENTOS_SALIENTES_pk PRIMARY KEY (id_evento),
    CONSTRAINT fk_evento_planilla FOREIGN KEY (id_planilla) REFERENCES PLANILLAS (id_planilla),
    CONSTRAINT fk_evento_aguinaldo FOREIGN KEY (id_aguinaldo) REFERENCES PLANILLA_AGUINALDO (id_aguinaldo),
    CONSTRAINT chk_evento_estado CHECK (estado IN ('PENDIENTE', 'ENTREGADO', 'FALLIDO')),
    CONSTRAINT chk_evento_intentos CHECK (intentos >= 0),
    CONSTRAINT chk_evento_entrega CHECK ((estado = 'ENTREGADO') = (entregado_en IS NOT NULL)),
    CONSTRAINT chk_evento_destino CHECK (destino IN ('CONTABILIDAD', 'PAGOS')),
    CONSTRAINT chk_evento_recurso_destino CHECK ((id_planilla IS NULL AND id_aguinaldo IS NULL) = (destino IS NULL)),
    CONSTRAINT chk_evento_recurso_unico CHECK (NOT (id_planilla IS NOT NULL AND id_aguinaldo IS NOT NULL))
);
CREATE INDEX idx_eventos_salientes_pendientes ON EVENTOS_SALIENTES (estado, proximo_intento_en);
CREATE INDEX idx_eventos_salientes_planilla ON EVENTOS_SALIENTES (id_planilla, destino, creado_en);
CREATE INDEX idx_eventos_salientes_aguinaldo ON EVENTOS_SALIENTES (id_aguinaldo, destino, creado_en);
-- Tabla: EVENTOS_ENTRANTES
-- Bandeja de entrada: confirmaciones de Contabilidad y Pagos. id_mensaje (del remitente) evita procesar dos veces
-- el mismo mensaje. RECIBIDO: en proceso o esperando reintento; PROCESADO: aplicado a la planilla; IGNORADO: no
-- cambia nada (por ejemplo, ya estaba confirmada); FALLIDO: inválido o sin procesar tras varios intentos (cola de
-- mensajes fallidos, se puede reprocesar). id_planilla solo se guarda si la planilla existe.
CREATE TABLE EVENTOS_ENTRANTES (
    id_evento_entrante UUID NOT NULL DEFAULT gen_random_uuid(),
    id_mensaje varchar(100) NOT NULL,
    topico varchar(60) NOT NULL,
    tipo_evento varchar(60) NOT NULL,
    origen varchar(10) NULL,
    id_planilla UUID NULL,
    id_aguinaldo UUID NULL,
    destino varchar(15) NULL,
    carga JSONB NOT NULL,
    estado varchar(10) NOT NULL DEFAULT 'RECIBIDO',
    intentos smallint NOT NULL DEFAULT 0,
    detalle varchar(255) NULL,
    recibido_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    procesado_en TIMESTAMPTZ NULL,
    CONSTRAINT EVENTOS_ENTRANTES_pk PRIMARY KEY (id_evento_entrante),
    CONSTRAINT uq_evento_entrante_mensaje UNIQUE (id_mensaje),
    CONSTRAINT fk_evento_entrante_planilla FOREIGN KEY (id_planilla) REFERENCES PLANILLAS (id_planilla),
    CONSTRAINT fk_evento_entrante_aguinaldo FOREIGN KEY (id_aguinaldo) REFERENCES PLANILLA_AGUINALDO (id_aguinaldo),
    CONSTRAINT chk_evento_entrante_estado CHECK (estado IN ('RECIBIDO', 'PROCESADO', 'IGNORADO', 'FALLIDO')),
    CONSTRAINT chk_evento_entrante_destino CHECK (destino IN ('CONTABILIDAD', 'PAGOS')),
    CONSTRAINT chk_evento_entrante_intentos CHECK (intentos >= 0),
    CONSTRAINT chk_evento_entrante_procesado CHECK ((estado IN ('PROCESADO', 'IGNORADO')) = (procesado_en IS NOT NULL)),
    CONSTRAINT chk_evento_entrante_recurso_unico CHECK (NOT (id_planilla IS NOT NULL AND id_aguinaldo IS NOT NULL))
);
CREATE INDEX idx_eventos_entrantes_estado ON EVENTOS_ENTRANTES (estado, recibido_en);
CREATE INDEX idx_eventos_entrantes_planilla ON EVENTOS_ENTRANTES (id_planilla);
CREATE INDEX idx_eventos_entrantes_aguinaldo ON EVENTOS_ENTRANTES (id_aguinaldo);
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
INSERT INTO CONCEPTOS_PLANILLA (codigo, nombre, descripcion, tipo, forma_calculo, base_calculo, es_de_ley,
                                cuenta_contable_codigo, cuenta_contable_nombre)
VALUES ('BONO-ANTIGUEDAD', 'Bono de antigüedad', 'Se calcula según los años de servicio y la escala legal vigente.',
        'INGRESO', 'PORCENTAJE', 'HABER_BASICO', TRUE, '5.1.1.05', 'Bono de antigüedad');

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

-- Tabla: AUDITORIA_BONIFICACIONES
-- Auditoría de altas, modificaciones y anulaciones de bonos (RF-53, KAN-73). bonos_condicion y bonos_productividad
-- se reemplazan por completo en cada reproceso del periodo (ver reemplazarProceso y aplicarReglas), así que esta
-- tabla es la única que conserva quién cambió qué y cuál era el valor anterior: el servicio compara los bonos del
-- proceso anterior con los nuevos y solo registra una fila cuando algo cambió. CONDICION se identifica por
-- condición + colaborador + asignación (id_vigencia no entra en la clave: una condición con nueva vigencia sigue
-- siendo el mismo bono, solo cambia su valor); PRODUCTIVIDAD se identifica por colaborador + regla. El bono de
-- antigüedad (KAN-70) no se audita aquí: no se persiste por colaborador, solo queda en CALCULOS_PLANILLA.
CREATE TABLE AUDITORIA_BONIFICACIONES (
    id_auditoria UUID NOT NULL DEFAULT gen_random_uuid(),
    tipo_bono varchar(20) NOT NULL,
    id_condicion UUID NULL,
    id_asignacion UUID NULL,
    id_regla UUID NULL,
    periodo char(7) NOT NULL,
    id_empleado UUID NOT NULL,
    nombre_empleado varchar(150) NOT NULL,
    accion varchar(15) NOT NULL,
    valor_anterior numeric(12,4) NULL,
    valor_nuevo numeric(12,4) NULL,
    monto_anterior numeric(12,2) NULL,
    monto_nuevo numeric(12,2) NULL,
    factor_anterior numeric(10,6) NULL,
    factor_nuevo numeric(10,6) NULL,
    realizado_por UUID NULL,
    realizado_por_rol varchar(20) NULL,
    realizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT AUDITORIA_BONIFICACIONES_pk PRIMARY KEY (id_auditoria),
    CONSTRAINT fk_auditoria_condicion FOREIGN KEY (id_condicion) REFERENCES CONDICIONES_ESPECIALES (id_condicion),
    CONSTRAINT fk_auditoria_asignacion FOREIGN KEY (id_asignacion)
        REFERENCES ASIGNACIONES_CONDICION (id_asignacion) ON DELETE SET NULL,
    CONSTRAINT fk_auditoria_regla FOREIGN KEY (id_regla) REFERENCES REGLAS_BONO_PRODUCTIVIDAD (id_regla),
    CONSTRAINT chk_auditoria_tipo_bono CHECK (tipo_bono IN ('CONDICION', 'PRODUCTIVIDAD')),
    CONSTRAINT chk_auditoria_origen CHECK (
        (tipo_bono = 'CONDICION' AND id_regla IS NULL)
        OR (tipo_bono = 'PRODUCTIVIDAD' AND id_condicion IS NULL AND id_asignacion IS NULL)
    ),
    CONSTRAINT chk_auditoria_accion CHECK (accion IN ('ALTA', 'MODIFICACION', 'ANULACION')),
    -- Alta: solo hay valor nuevo. Anulación: solo hay valor anterior. Modificación: hay ambos.
    CONSTRAINT chk_auditoria_valores CHECK (
        (accion = 'ALTA' AND valor_anterior IS NULL AND valor_nuevo IS NOT NULL)
        OR (accion = 'ANULACION' AND valor_anterior IS NOT NULL AND valor_nuevo IS NULL)
        OR (accion = 'MODIFICACION' AND valor_anterior IS NOT NULL AND valor_nuevo IS NOT NULL)
    )
);
CREATE INDEX idx_auditoria_empleado ON AUDITORIA_BONIFICACIONES (id_empleado, periodo);
CREATE INDEX idx_auditoria_periodo_tipo ON AUDITORIA_BONIFICACIONES (periodo, tipo_bono);

-- Tabla: BOLETAS_PAGO
-- Boleta de pago emitida a un colaborador por cada planilla cerrada (RF-46, KAN-66). Solo se emite con la planilla
-- CERRADA; su detalle es el de PLANILLA_EMPLEADOS y CALCULOS_PLANILLA, que ya no cambian.
-- hash_contenido: SHA-256 del contenido de la boleta al emitirla. Se vuelve a calcular en cada descarga: si no
-- coincide, la boleta no se entrega. Se imprime en el PDF como código de verificación.
-- id_empleado referencia a EMPLEADOS (EmployeeDB): sin FK por ser otro servicio.
CREATE TABLE BOLETAS_PAGO (
    id_boleta UUID NOT NULL DEFAULT gen_random_uuid(),
    id_planilla UUID NOT NULL,
    id_planilla_empleado UUID NOT NULL,
    id_empleado UUID NOT NULL,
    periodo char(7) NOT NULL,
    hash_contenido char(64) NOT NULL,
    emitida_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    descargas int NOT NULL DEFAULT 0,
    ultima_descarga_en TIMESTAMPTZ NULL,
    CONSTRAINT BOLETAS_PAGO_pk PRIMARY KEY (id_boleta),
    CONSTRAINT uq_boleta_planilla_empleado UNIQUE (id_planilla_empleado),
    CONSTRAINT uq_boleta_empleado_periodo UNIQUE (id_empleado, periodo),
    -- Sin borrado en cascada: una planilla con boletas emitidas no se elimina.
    CONSTRAINT fk_boleta_planilla FOREIGN KEY (id_planilla) REFERENCES PLANILLAS (id_planilla),
    CONSTRAINT fk_boleta_planilla_empleado FOREIGN KEY (id_planilla_empleado)
        REFERENCES PLANILLA_EMPLEADOS (id_planilla_empleado),
    CONSTRAINT chk_boleta_periodo CHECK (periodo ~ '^\d{4}-(0[1-9]|1[0-2])$'),
    CONSTRAINT chk_boleta_hash CHECK (hash_contenido ~ '^[0-9a-f]{64}$'),
    CONSTRAINT chk_boleta_descargas CHECK (descargas >= 0 AND (descargas = 0) = (ultima_descarga_en IS NULL))
);

-- Desvinculación laboral (RF-54, KAN-74)

-- Tabla: CAUSALES_DESVINCULACION
-- Catálogo de causales legales de desvinculación laboral. Define si corresponde o no el pago de desahucio.
CREATE TABLE CAUSALES_DESVINCULACION (
    codigo varchar(25) NOT NULL,
    nombre varchar(60) NOT NULL,
    descripcion varchar(250) NULL,
    corresponde_desahucio boolean NOT NULL,
    esta_activo boolean NOT NULL DEFAULT TRUE,
    orden smallint NOT NULL,
    CONSTRAINT CAUSALES_DESVINCULACION_pk PRIMARY KEY (codigo),
    CONSTRAINT uq_causal_nombre UNIQUE (nombre)
);

INSERT INTO CAUSALES_DESVINCULACION (codigo, nombre, descripcion, corresponde_desahucio, orden)
VALUES
    ('RENUNCIA', 'Renuncia voluntaria', 'Retiro por decisión voluntaria del colaborador; no corresponde pago de desahucio.', FALSE, 1),
    ('CONCLUSION_CONTRATO', 'Conclusión de contrato', 'Finalización del plazo o de la obra convenida en el contrato; no corresponde pago de desahucio.', FALSE, 2),
    ('DESPIDO_LEGAL', 'Despido legal (causa justificada)', 'Desvinculación por causa legal justificada; no corresponde pago de desahucio.', FALSE, 3),
    ('DESAHUCIO', 'Desahucio', 'Retiro por decisión del empleador sin causa justificada; obliga a pagar el desahucio.', TRUE, 4)
ON CONFLICT DO NOTHING;

-- Tabla: PROCESOS_DESVINCULACION
-- Un proceso de liquidación iniciado por la baja de un colaborador. nombre_empleado, fecha_ingreso y
-- corresponde_desahucio se copian al registrar para conservar los datos históricos aunque cambien después.
-- Procesos abiertos: estado INICIADO o EN_CURSO; el índice único parcial impide dos abiertos para un empleado.
CREATE TABLE PROCESOS_DESVINCULACION (
    id_proceso UUID NOT NULL DEFAULT gen_random_uuid(),
    id_empleado UUID NOT NULL,
    nombre_empleado varchar(150) NOT NULL,
    fecha_ingreso date NULL,
    codigo_causal varchar(25) NOT NULL,
    fecha_retiro date NOT NULL,
    corresponde_desahucio boolean NOT NULL,
    observaciones varchar(500) NULL,
    estado varchar(12) NOT NULL DEFAULT 'INICIADO',
    registrado_por UUID NULL,
    registrado_por_rol varchar(20) NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT PROCESOS_DESVINCULACION_pk PRIMARY KEY (id_proceso),
    CONSTRAINT fk_proceso_causal FOREIGN KEY (codigo_causal)
        REFERENCES CAUSALES_DESVINCULACION (codigo),
    CONSTRAINT chk_proceso_estado CHECK (estado IN ('INICIADO', 'EN_CURSO', 'CERRADO', 'ANULADO')),
    CONSTRAINT chk_proceso_fecha_retiro CHECK (fecha_ingreso IS NULL OR fecha_retiro >= fecha_ingreso)
);
CREATE UNIQUE INDEX uq_proceso_abierto_empleado ON PROCESOS_DESVINCULACION (id_empleado)
    WHERE estado IN ('INICIADO', 'EN_CURSO');
CREATE INDEX idx_procesos_desvinculacion_estado ON PROCESOS_DESVINCULACION (estado, creado_en);

-- Tabla: DOCUMENTOS_DESVINCULACION
-- Documento de respaldo (PDF, JPG o PNG, máx. 5 MB), 1 a 1 con el proceso. Se guarda aparte para no cargar
-- el binario en los listados.
CREATE TABLE DOCUMENTOS_DESVINCULACION (
    id_proceso UUID NOT NULL,
    nombre_archivo varchar(255) NOT NULL,
    tipo_mime varchar(50) NOT NULL,
    tamano_bytes integer NOT NULL,
    contenido bytea NOT NULL,
    subido_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT DOCUMENTOS_DESVINCULACION_pk PRIMARY KEY (id_proceso),
    CONSTRAINT fk_doc_desv_proceso FOREIGN KEY (id_proceso)
        REFERENCES PROCESOS_DESVINCULACION (id_proceso) ON DELETE CASCADE,
    CONSTRAINT chk_doc_desv_mime CHECK (tipo_mime IN ('application/pdf', 'image/jpeg', 'image/png')),
    CONSTRAINT chk_doc_desv_tamano CHECK (tamano_bytes > 0 AND tamano_bytes <= 5242880)
);

-- Sueldo promedio indemnizable (RF-55, KAN-75)

-- Tabla: PROMEDIOS_INDEMNIZABLES
-- Último cálculo del sueldo promedio indemnizable de cada proceso de liquidación (1 a 1).
-- Recalcular mientras el proceso está abierto reemplaza este registro y su detalle.
CREATE TABLE PROMEDIOS_INDEMNIZABLES (
    id_proceso UUID NOT NULL,
    periodo_limite char(7) NOT NULL,
    meses_considerados smallint NOT NULL,
    total_considerado numeric(12,2) NOT NULL,
    promedio numeric(12,2) NOT NULL,
    observaciones text[] NOT NULL DEFAULT '{}',
    calculado_por UUID NULL,
    calculado_por_rol varchar(20) NULL,
    calculado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT PROMEDIOS_INDEMNIZABLES_pk PRIMARY KEY (id_proceso),
    CONSTRAINT fk_promedio_proceso FOREIGN KEY (id_proceso)
        REFERENCES PROCESOS_DESVINCULACION (id_proceso) ON DELETE CASCADE,
    CONSTRAINT chk_promedio_meses CHECK (meses_considerados BETWEEN 1 AND 3),
    CONSTRAINT chk_promedio_total CHECK (total_considerado >= 0),
    CONSTRAINT chk_promedio_valor CHECK (promedio >= 0)
);

-- Tabla: DETALLE_PROMEDIO_INDEMNIZABLE
-- Meses considerados en el cálculo del sueldo promedio indemnizable. Guarda copia de dias_pagados,
-- haber_mensual y total_ganado al momento del cálculo para fijar la base legal del finiquito.
CREATE TABLE DETALLE_PROMEDIO_INDEMNIZABLE (
    id_proceso UUID NOT NULL,
    periodo char(7) NOT NULL,
    id_planilla UUID NOT NULL,
    id_planilla_empleado UUID NOT NULL,
    dias_pagados smallint NOT NULL,
    haber_mensual numeric(12,2) NOT NULL,
    total_ganado numeric(12,2) NOT NULL,
    CONSTRAINT DETALLE_PROMEDIO_INDEMNIZABLE_pk PRIMARY KEY (id_proceso, periodo),
    CONSTRAINT fk_detalle_promedio FOREIGN KEY (id_proceso)
        REFERENCES PROMEDIOS_INDEMNIZABLES (id_proceso) ON DELETE CASCADE,
    CONSTRAINT fk_detalle_promedio_planilla FOREIGN KEY (id_planilla)
        REFERENCES PLANILLAS (id_planilla),
    CONSTRAINT fk_detalle_promedio_empleado FOREIGN KEY (id_planilla_empleado)
        REFERENCES PLANILLA_EMPLEADOS (id_planilla_empleado),
    CONSTRAINT chk_detalle_promedio_total_ganado CHECK (total_ganado >= 0)
);

-- Beneficios sociales: indemnización y desahucio (RF-56, KAN-76)

-- Tabla: BENEFICIOS_SOCIALES
-- Último cálculo de la indemnización por tiempo de servicio y del desahucio de cada proceso (1 a 1).
-- Copia el sueldo promedio y las fechas usadas; si el promedio cambia después, el cálculo queda desactualizado.
CREATE TABLE BENEFICIOS_SOCIALES (
    id_proceso UUID NOT NULL,
    promedio_base numeric(12,2) NOT NULL,
    fecha_ingreso date NOT NULL,
    fecha_retiro date NOT NULL,
    dias_servicio integer NOT NULL,
    anios_servicio smallint NOT NULL,
    meses_servicio smallint NOT NULL,
    dias_fraccion smallint NOT NULL,
    corresponde_indemnizacion boolean NOT NULL,
    motivo_indemnizacion varchar(250) NOT NULL,
    monto_indemnizacion numeric(12,2) NOT NULL,
    corresponde_desahucio boolean NOT NULL,
    motivo_desahucio varchar(250) NOT NULL,
    monto_desahucio numeric(12,2) NOT NULL,
    total numeric(12,2) NOT NULL,
    calculado_por UUID NULL,
    calculado_por_rol varchar(20) NULL,
    calculado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT BENEFICIOS_SOCIALES_pk PRIMARY KEY (id_proceso),
    CONSTRAINT fk_beneficios_proceso FOREIGN KEY (id_proceso)
        REFERENCES PROCESOS_DESVINCULACION (id_proceso) ON DELETE CASCADE,
    CONSTRAINT chk_beneficios_fechas CHECK (fecha_retiro >= fecha_ingreso),
    CONSTRAINT chk_beneficios_dias CHECK (dias_servicio > 0),
    CONSTRAINT chk_beneficios_tiempo CHECK (
        anios_servicio >= 0 AND meses_servicio BETWEEN 0 AND 11 AND dias_fraccion BETWEEN 0 AND 30
    ),
    CONSTRAINT chk_beneficios_montos CHECK (
        promedio_base >= 0 AND monto_indemnizacion >= 0 AND monto_desahucio >= 0
        AND total = monto_indemnizacion + monto_desahucio
    ),
    CONSTRAINT chk_beneficios_sin_monto CHECK (
        (corresponde_indemnizacion OR monto_indemnizacion = 0)
        AND (corresponde_desahucio OR monto_desahucio = 0)
    )
);

-- Tabla: DETALLE_BENEFICIOS_SOCIALES
-- Renglones del cálculo: monto = promedio_base × cantidad / divisor (años / 1, meses / 12, días / 360, sueldos / 1).
CREATE TABLE DETALLE_BENEFICIOS_SOCIALES (
    id_proceso UUID NOT NULL,
    orden smallint NOT NULL,
    codigo_concepto varchar(25) NOT NULL,
    descripcion varchar(120) NOT NULL,
    unidad varchar(10) NOT NULL,
    cantidad smallint NOT NULL,
    divisor smallint NOT NULL,
    monto numeric(12,2) NOT NULL,
    CONSTRAINT DETALLE_BENEFICIOS_SOCIALES_pk PRIMARY KEY (id_proceso, orden),
    CONSTRAINT fk_detalle_beneficios FOREIGN KEY (id_proceso)
        REFERENCES BENEFICIOS_SOCIALES (id_proceso) ON DELETE CASCADE,
    CONSTRAINT chk_detalle_beneficios_concepto CHECK (codigo_concepto IN ('INDEMNIZACION', 'DESAHUCIO')),
    CONSTRAINT chk_detalle_beneficios_unidad CHECK (unidad IN ('ANIO', 'MES', 'DIA', 'SUELDO')),
    CONSTRAINT chk_detalle_beneficios_cantidad CHECK (cantidad > 0),
    CONSTRAINT chk_detalle_beneficios_divisor CHECK (divisor IN (1, 12, 360)),
    CONSTRAINT chk_detalle_beneficios_monto CHECK (monto >= 0)
);

-- Saldos proporcionales del finiquito (KAN-77)

-- Tabla: SALDOS_PROPORCIONALES
-- Último cálculo de las duodécimas de aguinaldo y las vacaciones truncas de un proceso de liquidación (1 a 1).
-- Copia el sueldo promedio, el saldo de vacaciones y los tiempos al momento del cálculo; recalcular mientras el
-- proceso está abierto reemplaza el registro.
CREATE TABLE SALDOS_PROPORCIONALES (
    id_proceso UUID NOT NULL,
    promedio numeric(12,2) NOT NULL,
    salario_diario numeric(12,2) NOT NULL,
    -- Aguinaldo: gestión en curso al retiro (1 de diciembre al 30 de noviembre)
    gestion_aguinaldo smallint NOT NULL,
    aguinaldo_desde date NOT NULL,
    aguinaldo_hasta date NOT NULL,
    aguinaldo_meses smallint NOT NULL,
    aguinaldo_dias smallint NOT NULL,
    monto_aguinaldo numeric(12,2) NOT NULL,
    -- Vacaciones: días no gozados del módulo de vacaciones (AttendanceService) y duodécima del año en curso
    anios_servicio smallint NOT NULL,
    dias_acumulados smallint NOT NULL,
    dias_gozados smallint NOT NULL,
    dias_pendientes smallint NOT NULL,
    monto_vacaciones_pendientes numeric(12,2) NOT NULL,
    anio_en_curso_desde date NOT NULL,
    anio_en_curso_meses smallint NOT NULL,
    anio_en_curso_dias smallint NOT NULL,
    dias_escala smallint NOT NULL,
    dias_duodecima numeric(6,2) NOT NULL,
    monto_duodecima_vacaciones numeric(12,2) NOT NULL,
    total numeric(12,2) NOT NULL,
    observaciones text[] NOT NULL DEFAULT '{}',
    calculado_por UUID NULL,
    calculado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT SALDOS_PROPORCIONALES_pk PRIMARY KEY (id_proceso),
    CONSTRAINT fk_saldos_proceso FOREIGN KEY (id_proceso)
        REFERENCES PROCESOS_DESVINCULACION (id_proceso) ON DELETE CASCADE,
    CONSTRAINT chk_saldos_montos CHECK (
        promedio >= 0 AND salario_diario >= 0 AND monto_aguinaldo >= 0 AND monto_vacaciones_pendientes >= 0
        AND monto_duodecima_vacaciones >= 0 AND total >= 0
    ),
    CONSTRAINT chk_saldos_tiempos CHECK (
        aguinaldo_meses BETWEEN 0 AND 12 AND aguinaldo_dias BETWEEN 0 AND 30
        AND anio_en_curso_meses BETWEEN 0 AND 12 AND anio_en_curso_dias BETWEEN 0 AND 30
        AND dias_escala IN (15, 20, 30) AND dias_duodecima >= 0
        AND dias_pendientes >= 0 AND dias_acumulados >= 0 AND dias_gozados >= 0
    )
);

-- Tabla: PARAMETROS_TRIBUTARIOS
CREATE TABLE PARAMETROS_TRIBUTARIOS (
    id_parametro UUID NOT NULL DEFAULT gen_random_uuid(),
    codigo varchar(30) NOT NULL,
    nombre varchar(100) NOT NULL,
    valor numeric(12,4) NOT NULL,
    vigente_desde date NOT NULL,
    vigente_hasta date NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT PARAMETROS_TRIBUTARIOS_pk PRIMARY KEY (id_parametro),
    CONSTRAINT chk_parametro_codigo CHECK (
        codigo IN ('SALARIO_MINIMO_NACIONAL', 'MULTIPLO_MINIMO_NO_IMPONIBLE', 'ALICUOTA_RCIVA', 'ALICUOTA_CREDITO_FISCAL')
    ),
    CONSTRAINT chk_parametro_valor CHECK (valor > 0),
    CONSTRAINT chk_parametro_fechas CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde),
    CONSTRAINT ex_parametro_sin_solapamiento EXCLUDE USING gist (
        codigo WITH =,
        daterange(vigente_desde, vigente_hasta, '[]') WITH &&
    )
);
-- Tabla: VALORES_UFV
CREATE TABLE VALORES_UFV (
    fecha date NOT NULL,
    valor numeric(10,5) NOT NULL,
    CONSTRAINT VALORES_UFV_pk PRIMARY KEY (fecha),
    CONSTRAINT chk_ufv_valor CHECK (valor > 0)
);
-- Tabla: ENTIDADES_APORTE
CREATE TABLE ENTIDADES_APORTE (
    codigo varchar(20) NOT NULL,
    nombre varchar(100) NOT NULL,
    formato_archivo varchar(4) NOT NULL,
    orden smallint NOT NULL,
    CONSTRAINT ENTIDADES_APORTE_pk PRIMARY KEY (codigo),
    CONSTRAINT uq_entidad_aporte_orden UNIQUE (orden),
    CONSTRAINT chk_entidad_aporte_formato CHECK (formato_archivo IN ('XLSX', 'TXT'))
);
-- Tabla: CONCEPTOS_ENTIDAD_APORTE
CREATE TABLE CONCEPTOS_ENTIDAD_APORTE (
    codigo_concepto varchar(20) NOT NULL,
    codigo_entidad varchar(20) NOT NULL,
    deduce_sueldo_neto boolean NOT NULL DEFAULT FALSE,
    CONSTRAINT CONCEPTOS_ENTIDAD_APORTE_pk PRIMARY KEY (codigo_concepto),
    CONSTRAINT fk_concepto_entidad_concepto FOREIGN KEY (codigo_concepto)
        REFERENCES CONCEPTOS_PLANILLA (codigo),
    CONSTRAINT fk_concepto_entidad_entidad FOREIGN KEY (codigo_entidad)
        REFERENCES ENTIDADES_APORTE (codigo)
);
-- Tabla: CREDITOS_FISCALES_DECLARADOS
CREATE TABLE CREDITOS_FISCALES_DECLARADOS (
    id_credito UUID NOT NULL DEFAULT gen_random_uuid(),
    id_empleado UUID NOT NULL,
    periodo char(7) NOT NULL,
    monto_facturas numeric(12,2) NOT NULL DEFAULT 0,
    saldo_inicial_favor numeric(12,2) NOT NULL DEFAULT 0,
    declarado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT CREDITOS_FISCALES_DECLARADOS_pk PRIMARY KEY (id_credito),
    CONSTRAINT uq_credito_empleado_periodo UNIQUE (id_empleado, periodo),
    CONSTRAINT chk_credito_periodo CHECK (periodo ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    CONSTRAINT chk_credito_montos CHECK (monto_facturas >= 0 AND saldo_inicial_favor >= 0)
);
-- Tabla: PLANILLAS_TRIBUTARIAS
CREATE TABLE PLANILLAS_TRIBUTARIAS (
    id_planilla_tributaria UUID NOT NULL DEFAULT gen_random_uuid(),
    id_planilla UUID NOT NULL,
    periodo char(7) NOT NULL,
    salario_minimo numeric(12,2) NOT NULL,
    multiplo_minimo_no_imponible numeric(6,2) NOT NULL,
    minimo_no_imponible numeric(12,2) NOT NULL,
    alicuota_rciva numeric(7,4) NOT NULL,
    alicuota_credito_fiscal numeric(7,4) NOT NULL,
    computo_salarios_minimos numeric(12,2) NOT NULL,
    periodo_saldo_anterior char(7) NULL,
    ufv_inicial numeric(10,5) NULL,
    ufv_final numeric(10,5) NULL,
    cantidad_dependientes int NOT NULL DEFAULT 0,
    total_sueldo_neto numeric(14,2) NOT NULL DEFAULT 0,
    total_base_imponible numeric(14,2) NOT NULL DEFAULT 0,
    total_impuesto_determinado numeric(14,2) NOT NULL DEFAULT 0,
    total_computo_salarios_minimos numeric(14,2) NOT NULL DEFAULT 0,
    total_credito_aplicado numeric(14,2) NOT NULL DEFAULT 0,
    total_impuesto_retenido numeric(14,2) NOT NULL DEFAULT 0,
    total_actualizacion_ufv numeric(14,2) NOT NULL DEFAULT 0,
    advertencias text[] NOT NULL DEFAULT '{}',
    generada_por UUID NULL,
    generada_por_nombre varchar(150) NULL,
    generada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT PLANILLAS_TRIBUTARIAS_pk PRIMARY KEY (id_planilla_tributaria),
    CONSTRAINT uq_planilla_tributaria_planilla UNIQUE (id_planilla),
    CONSTRAINT fk_planilla_tributaria_planilla FOREIGN KEY (id_planilla)
        REFERENCES PLANILLAS (id_planilla) ON DELETE CASCADE,
    CONSTRAINT chk_planilla_tributaria_parametros CHECK (
        salario_minimo > 0 AND multiplo_minimo_no_imponible > 0 AND minimo_no_imponible > 0
        AND alicuota_rciva > 0 AND alicuota_credito_fiscal > 0 AND computo_salarios_minimos >= 0
    ),
    CONSTRAINT chk_planilla_tributaria_ufv CHECK (
        (ufv_inicial IS NULL) = (ufv_final IS NULL) AND (ufv_inicial IS NULL OR (ufv_inicial > 0 AND ufv_final > 0))
        AND (ufv_inicial IS NULL OR periodo_saldo_anterior IS NOT NULL)
    ),
    CONSTRAINT chk_planilla_tributaria_totales CHECK (
        cantidad_dependientes >= 0 AND total_sueldo_neto >= 0 AND total_base_imponible >= 0
        AND total_impuesto_determinado >= 0 AND total_computo_salarios_minimos >= 0 AND total_credito_aplicado >= 0
        AND total_impuesto_retenido >= 0 AND total_actualizacion_ufv >= 0
        AND total_impuesto_determinado = total_computo_salarios_minimos + total_credito_aplicado + total_impuesto_retenido
    )
);
-- Tabla: RETENCIONES_RCIVA
CREATE TABLE RETENCIONES_RCIVA (
    id_retencion UUID NOT NULL DEFAULT gen_random_uuid(),
    id_planilla_tributaria UUID NOT NULL,
    id_empleado UUID NOT NULL,
    nombre_empleado varchar(150) NOT NULL,
    numero_documento varchar(20) NULL,
    total_ganado numeric(12,2) NOT NULL,
    aportes_laborales numeric(12,2) NOT NULL,
    sueldo_neto numeric(12,2) NOT NULL,
    base_imponible numeric(12,2) NOT NULL,
    impuesto_determinado numeric(12,2) NOT NULL,
    computo_salarios_minimos numeric(12,2) NOT NULL DEFAULT 0,
    monto_facturas numeric(12,2) NOT NULL DEFAULT 0,
    credito_fiscal_facturas numeric(12,2) NOT NULL DEFAULT 0,
    origen_saldo varchar(15) NOT NULL,
    saldo_mes_anterior numeric(12,2) NOT NULL DEFAULT 0,
    actualizacion_ufv numeric(12,2) NOT NULL DEFAULT 0,
    saldo_anterior_favor numeric(12,2) NOT NULL DEFAULT 0,
    credito_aplicado numeric(12,2) NOT NULL,
    impuesto_retenido numeric(12,2) NOT NULL,
    saldo_favor_siguiente numeric(12,2) NOT NULL,
    CONSTRAINT RETENCIONES_RCIVA_pk PRIMARY KEY (id_retencion),
    CONSTRAINT uq_retencion_empleado UNIQUE (id_planilla_tributaria, id_empleado),
    CONSTRAINT fk_retencion_planilla_tributaria FOREIGN KEY (id_planilla_tributaria)
        REFERENCES PLANILLAS_TRIBUTARIAS (id_planilla_tributaria) ON DELETE CASCADE,
    CONSTRAINT chk_retencion_montos CHECK (
        total_ganado >= 0 AND aportes_laborales >= 0 AND sueldo_neto >= 0 AND base_imponible >= 0
        AND impuesto_determinado >= 0 AND computo_salarios_minimos >= 0 AND monto_facturas >= 0
        AND credito_fiscal_facturas >= 0 AND saldo_mes_anterior >= 0 AND actualizacion_ufv >= 0
        AND saldo_anterior_favor >= 0 AND credito_aplicado >= 0 AND impuesto_retenido >= 0 AND saldo_favor_siguiente >= 0
    ),
    CONSTRAINT chk_retencion_origen_saldo CHECK (origen_saldo IN ('MES_ANTERIOR', 'SALDO_INICIAL')),
    CONSTRAINT chk_retencion_balance CHECK (
        impuesto_determinado = computo_salarios_minimos + credito_aplicado + impuesto_retenido
        AND saldo_anterior_favor = saldo_mes_anterior + actualizacion_ufv
        AND credito_fiscal_facturas + saldo_anterior_favor = credito_aplicado + saldo_favor_siguiente
    )
);
-- Tabla: PLANILLAS_APORTES
CREATE TABLE PLANILLAS_APORTES (
    id_planilla_aportes UUID NOT NULL DEFAULT gen_random_uuid(),
    id_planilla UUID NOT NULL,
    periodo char(7) NOT NULL,
    cantidad_empleados int NOT NULL DEFAULT 0,
    total_laboral numeric(14,2) NOT NULL DEFAULT 0,
    total_patronal numeric(14,2) NOT NULL DEFAULT 0,
    advertencias text[] NOT NULL DEFAULT '{}',
    generada_por UUID NULL,
    generada_por_nombre varchar(150) NULL,
    generada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT PLANILLAS_APORTES_pk PRIMARY KEY (id_planilla_aportes),
    CONSTRAINT uq_planilla_aportes_planilla UNIQUE (id_planilla),
    CONSTRAINT fk_planilla_aportes_planilla FOREIGN KEY (id_planilla)
        REFERENCES PLANILLAS (id_planilla) ON DELETE CASCADE,
    CONSTRAINT chk_planilla_aportes_totales CHECK (cantidad_empleados >= 0 AND total_laboral >= 0 AND total_patronal >= 0)
);
-- Tabla: DETALLE_APORTES
CREATE TABLE DETALLE_APORTES (
    id_detalle UUID NOT NULL DEFAULT gen_random_uuid(),
    id_planilla_aportes UUID NOT NULL,
    id_empleado UUID NOT NULL,
    nombre_empleado varchar(150) NOT NULL,
    numero_documento varchar(20) NULL,
    codigo_entidad varchar(20) NOT NULL,
    tipo varchar(8) NOT NULL,
    codigo_concepto varchar(20) NOT NULL,
    nombre_concepto varchar(80) NOT NULL,
    id_vigencia UUID NULL,
    base numeric(12,2) NULL,
    tasa numeric(12,4) NOT NULL,
    monto numeric(12,2) NOT NULL,
    CONSTRAINT DETALLE_APORTES_pk PRIMARY KEY (id_detalle),
    CONSTRAINT fk_detalle_aportes_planilla FOREIGN KEY (id_planilla_aportes)
        REFERENCES PLANILLAS_APORTES (id_planilla_aportes) ON DELETE CASCADE,
    CONSTRAINT fk_detalle_aportes_entidad FOREIGN KEY (codigo_entidad) REFERENCES ENTIDADES_APORTE (codigo),
    CONSTRAINT fk_detalle_aportes_vigencia FOREIGN KEY (id_vigencia) REFERENCES VIGENCIAS_CONCEPTO (id_vigencia),
    CONSTRAINT chk_detalle_aportes_tipo CHECK (tipo IN ('LABORAL', 'PATRONAL')),
    CONSTRAINT chk_detalle_aportes_valores CHECK (tasa > 0 AND monto >= 0 AND (base IS NULL OR base >= 0))
);
CREATE INDEX idx_detalle_aportes_entidad ON DETALLE_APORTES (id_planilla_aportes, codigo_entidad);

-- Finiquito (RF-58, KAN-78)

CREATE SEQUENCE seq_numero_finiquito;

-- Tabla: FINIQUITOS
-- Documento consolidado de liquidación final de un proceso de desvinculación (1 a 1).
-- Ciclo de vida: BORRADOR -> APROBADO (genera PDF oficial, bloquea cálculos y publica a Pagos y Contabilidad)
-- -> PAGADO (ambas confirmaciones llegaron, cierra el proceso y salda los préstamos aplicables).
CREATE TABLE FINIQUITOS (
    id_finiquito UUID NOT NULL DEFAULT gen_random_uuid(),
    id_proceso UUID NOT NULL,
    numero_documento varchar(20) NULL,
    estado varchar(10) NOT NULL DEFAULT 'BORRADOR',
    fecha_retiro date NOT NULL,
    codigo_causal varchar(25) NOT NULL,
    promedio_base numeric(12,2) NOT NULL,
    anios_servicio smallint NOT NULL,
    meses_servicio smallint NOT NULL,
    dias_fraccion smallint NOT NULL,
    total_ingresos numeric(12,2) NOT NULL,
    total_descuentos numeric(12,2) NOT NULL,
    liquido_pagable numeric(12,2) NOT NULL,
    estado_pagos varchar(10) NOT NULL DEFAULT 'PENDIENTE',
    referencia_pagos varchar(60) NULL,
    motivo_pagos varchar(255) NULL,
    respondida_pagos_en TIMESTAMPTZ NULL,
    estado_contabilidad varchar(10) NOT NULL DEFAULT 'PENDIENTE',
    referencia_contabilidad varchar(60) NULL,
    motivo_contabilidad varchar(255) NULL,
    respondida_contabilidad_en TIMESTAMPTZ NULL,
    generado_por UUID NULL,
    generado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    aprobado_por UUID NULL,
    aprobado_por_rol varchar(20) NULL,
    aprobado_en TIMESTAMPTZ NULL,
    pagado_en TIMESTAMPTZ NULL,
    CONSTRAINT FINIQUITOS_pk PRIMARY KEY (id_finiquito),
    CONSTRAINT uq_finiquito_proceso UNIQUE (id_proceso),
    CONSTRAINT uq_finiquito_numero UNIQUE (numero_documento),
    CONSTRAINT fk_finiquito_proceso FOREIGN KEY (id_proceso)
        REFERENCES PROCESOS_DESVINCULACION (id_proceso),
    CONSTRAINT chk_finiquito_estado CHECK (estado IN ('BORRADOR', 'APROBADO', 'PAGADO')),
    CONSTRAINT chk_finiquito_tiempo CHECK (
        promedio_base >= 0 AND anios_servicio >= 0 AND meses_servicio BETWEEN 0 AND 11 AND dias_fraccion BETWEEN 0 AND 30
    ),
    CONSTRAINT chk_finiquito_totales CHECK (
        total_ingresos >= 0 AND total_descuentos >= 0 AND liquido_pagable >= 0
        AND liquido_pagable = total_ingresos - total_descuentos
    ),
    CONSTRAINT chk_finiquito_integraciones CHECK (
        estado_pagos IN ('PENDIENTE', 'CONFIRMADA', 'RECHAZADA')
        AND estado_contabilidad IN ('PENDIENTE', 'CONFIRMADA', 'RECHAZADA')
    ),
    CONSTRAINT chk_finiquito_aprobacion CHECK (
        (estado = 'BORRADOR') = (aprobado_en IS NULL)
        AND (estado = 'BORRADOR') = (numero_documento IS NULL)
    ),
    CONSTRAINT chk_finiquito_pago CHECK (
        (estado = 'PAGADO') = (pagado_en IS NOT NULL)
        AND (estado <> 'PAGADO' OR (estado_pagos = 'CONFIRMADA' AND estado_contabilidad = 'CONFIRMADA'))
    ),
    CONSTRAINT chk_finiquito_respuestas CHECK (
        (estado <> 'BORRADOR' OR (estado_pagos = 'PENDIENTE' AND estado_contabilidad = 'PENDIENTE'))
        AND (estado_pagos = 'PENDIENTE') = (respondida_pagos_en IS NULL)
        AND (estado_pagos = 'RECHAZADA') = (motivo_pagos IS NOT NULL)
        AND (referencia_pagos IS NULL OR estado_pagos = 'CONFIRMADA')
        AND (estado_contabilidad = 'PENDIENTE') = (respondida_contabilidad_en IS NULL)
        AND (estado_contabilidad = 'RECHAZADA') = (motivo_contabilidad IS NOT NULL)
        AND (referencia_contabilidad IS NULL OR estado_contabilidad = 'CONFIRMADA')
    )
);

-- Tabla: DETALLE_FINIQUITO
-- Renglones del formulario consolidado de finiquito (ingresos por beneficios sociales y descuentos por
-- anticipos o préstamos activos). saldo_prestamo guarda el saldo_pendiente del préstamo al consolidar.
CREATE TABLE DETALLE_FINIQUITO (
    id_finiquito UUID NOT NULL,
    orden smallint NOT NULL,
    tipo varchar(10) NOT NULL,
    codigo varchar(30) NOT NULL,
    concepto varchar(120) NOT NULL,
    detalle varchar(250) NULL,
    monto numeric(12,2) NOT NULL,
    id_prestamo UUID NULL,
    saldo_prestamo numeric(12,2) NULL,
    CONSTRAINT DETALLE_FINIQUITO_pk PRIMARY KEY (id_finiquito, orden),
    CONSTRAINT fk_detalle_finiquito FOREIGN KEY (id_finiquito)
        REFERENCES FINIQUITOS (id_finiquito) ON DELETE CASCADE,
    CONSTRAINT fk_detalle_finiquito_prestamo FOREIGN KEY (id_prestamo)
        REFERENCES PRESTAMOS (id_prestamo),
    CONSTRAINT chk_detalle_finiquito_tipo CHECK (tipo IN ('INGRESO', 'DESCUENTO')),
    CONSTRAINT chk_detalle_finiquito_monto CHECK (monto > 0),
    CONSTRAINT chk_detalle_finiquito_prestamo CHECK ((tipo = 'DESCUENTO') = (id_prestamo IS NOT NULL)),
    CONSTRAINT chk_detalle_finiquito_saldo CHECK (saldo_prestamo IS NULL OR saldo_prestamo >= monto)
);

-- Tabla: DOCUMENTOS_FINIQUITO
-- PDF oficial del finiquito para firma (1 a 1 con FINIQUITOS). Se genera al aprobar y se guarda aparte.
CREATE TABLE DOCUMENTOS_FINIQUITO (
    id_finiquito UUID NOT NULL,
    nombre_archivo varchar(255) NOT NULL,
    contenido bytea NOT NULL,
    tamano_bytes integer NOT NULL,
    generado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT DOCUMENTOS_FINIQUITO_pk PRIMARY KEY (id_finiquito),
    CONSTRAINT fk_documento_finiquito FOREIGN KEY (id_finiquito)
        REFERENCES FINIQUITOS (id_finiquito) ON DELETE CASCADE,
    CONSTRAINT chk_documento_finiquito_tamano CHECK (tamano_bytes > 0)
);

-- Tabla: EVENTOS_FINIQUITO
-- Bandeja de salida propia de finiquitos (outbox): guarda envíos hacia Pagos y Contabilidad y las
-- respuestas simuladas que pasan por el mismo tópico F. id_mensaje no es único para permitir duplicados.
CREATE TABLE EVENTOS_FINIQUITO (
    id_evento UUID NOT NULL DEFAULT gen_random_uuid(),
    id_mensaje varchar(100) NOT NULL,
    id_finiquito UUID NOT NULL,
    sentido varchar(20) NOT NULL,
    destino varchar(15) NOT NULL,
    tipo_evento varchar(60) NOT NULL,
    topico varchar(60) NOT NULL,
    carga JSONB NOT NULL,
    estado varchar(10) NOT NULL DEFAULT 'PENDIENTE',
    intentos smallint NOT NULL DEFAULT 0,
    ultimo_error varchar(255) NULL,
    proximo_intento_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_pubsub varchar(100) NULL,
    entregado_en TIMESTAMPTZ NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT EVENTOS_FINIQUITO_pk PRIMARY KEY (id_evento),
    CONSTRAINT fk_evento_finiquito FOREIGN KEY (id_finiquito)
        REFERENCES FINIQUITOS (id_finiquito),
    CONSTRAINT chk_evento_finiquito_sentido CHECK (sentido IN ('SALIENTE', 'RESPUESTA_SIMULADA')),
    CONSTRAINT chk_evento_finiquito_destino CHECK (destino IN ('PAGOS', 'CONTABILIDAD')),
    CONSTRAINT chk_evento_finiquito_estado CHECK (estado IN ('PENDIENTE', 'ENTREGADO', 'FALLIDO')),
    CONSTRAINT chk_evento_finiquito_intentos CHECK (intentos >= 0),
    CONSTRAINT chk_evento_finiquito_entrega CHECK ((estado = 'ENTREGADO') = (entregado_en IS NOT NULL))
);
CREATE INDEX idx_eventos_finiquito_pendientes ON EVENTOS_FINIQUITO (estado, proximo_intento_en);
CREATE INDEX idx_eventos_finiquito_destino ON EVENTOS_FINIQUITO (id_finiquito, destino, creado_en);

-- Tabla: MENSAJES_FINIQUITO_ENTRANTES
-- Bandeja de entrada y cola de errores (DLQ) de las confirmaciones de Pagos y Contabilidad para finiquitos.
-- carga es text para registrar incluso JSON inválido. id_mensaje único descarta duplicados.
CREATE TABLE MENSAJES_FINIQUITO_ENTRANTES (
    id_entrante UUID NOT NULL DEFAULT gen_random_uuid(),
    id_mensaje varchar(100) NOT NULL,
    origen varchar(10) NULL,
    tipo_evento varchar(60) NULL,
    id_finiquito UUID NULL,
    destino varchar(15) NULL,
    carga text NOT NULL,
    estado varchar(10) NOT NULL DEFAULT 'RECIBIDO',
    intentos smallint NOT NULL DEFAULT 0,
    ultimo_error varchar(255) NULL,
    recibido_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    procesado_en TIMESTAMPTZ NULL,
    CONSTRAINT MENSAJES_FINIQUITO_ENTRANTES_pk PRIMARY KEY (id_entrante),
    CONSTRAINT uq_mensaje_finiquito_entrante UNIQUE (id_mensaje),
    CONSTRAINT fk_mensaje_finiquito_entrante FOREIGN KEY (id_finiquito)
        REFERENCES FINIQUITOS (id_finiquito),
    CONSTRAINT chk_mensaje_finiquito_destino CHECK (destino IS NULL OR destino IN ('PAGOS', 'CONTABILIDAD')),
    CONSTRAINT chk_mensaje_finiquito_estado CHECK (estado IN ('RECIBIDO', 'PROCESADO', 'IGNORADO', 'EN_DLQ')),
    CONSTRAINT chk_mensaje_finiquito_intentos CHECK (intentos >= 0),
    CONSTRAINT chk_mensaje_finiquito_procesado CHECK ((estado IN ('PROCESADO', 'IGNORADO')) = (procesado_en IS NOT NULL))
);
CREATE INDEX idx_mensajes_finiquito_entrantes_estado ON MENSAJES_FINIQUITO_ENTRANTES (estado, recibido_en);
CREATE INDEX idx_mensajes_finiquito_entrantes_finiquito ON MENSAJES_FINIQUITO_ENTRANTES (id_finiquito, recibido_en);

-- Cierre definitivo de desvinculación y bloqueo de accesos (RF-59, KAN-79)

-- Tabla: CIERRES_DESVINCULACION
-- Cierre definitivo manual de un proceso de desvinculación (1 a 1 con el proceso), cuando su finiquito está
-- APROBADO o PAGADO. Registra la inactivación en EmployeeService, la revocación en AuthService y el avance
-- consolidado de las revocaciones en Ventas/POS (E), Inventarios (I), Entregas (H) y CRM (B).
CREATE TABLE CIERRES_DESVINCULACION (
    id_cierre UUID NOT NULL DEFAULT gen_random_uuid(),
    id_proceso UUID NOT NULL,
    id_finiquito UUID NOT NULL,
    id_empleado UUID NOT NULL,
    estado_finiquito_al_cerrar varchar(10) NOT NULL,
    empleado_inactivado_en TIMESTAMPTZ NOT NULL,
    cuenta_estado varchar(15) NOT NULL,
    cuenta_revocada_en TIMESTAMPTZ NULL,
    estado_revocaciones varchar(12) NOT NULL DEFAULT 'EN_PROCESO',
    cerrado_por UUID NOT NULL,
    cerrado_por_rol varchar(20) NOT NULL,
    cerrado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completado_en TIMESTAMPTZ NULL,
    CONSTRAINT CIERRES_DESVINCULACION_pk PRIMARY KEY (id_cierre),
    CONSTRAINT uq_cierre_proceso UNIQUE (id_proceso),
    CONSTRAINT fk_cierre_proceso FOREIGN KEY (id_proceso)
        REFERENCES PROCESOS_DESVINCULACION (id_proceso),
    CONSTRAINT fk_cierre_finiquito FOREIGN KEY (id_finiquito)
        REFERENCES FINIQUITOS (id_finiquito),
    CONSTRAINT chk_cierre_estado_finiquito CHECK (estado_finiquito_al_cerrar IN ('APROBADO', 'PAGADO')),
    CONSTRAINT chk_cierre_cuenta_estado CHECK (cuenta_estado IN ('REVOCADA', 'SIN_CUENTA')),
    CONSTRAINT chk_cierre_cuenta_fecha CHECK ((cuenta_estado = 'REVOCADA') = (cuenta_revocada_en IS NOT NULL)),
    CONSTRAINT chk_cierre_estado_revocaciones CHECK (estado_revocaciones IN ('EN_PROCESO', 'COMPLETADO', 'CON_ALERTAS')),
    CONSTRAINT chk_cierre_completado CHECK ((estado_revocaciones = 'COMPLETADO') = (completado_en IS NOT NULL))
);

-- Tabla: REVOCACIONES_SISTEMA
-- Estado de la revocación de accesos en cada módulo operativo externo (4 filas por cierre).
-- PENDIENTE: esperando publicación en Pub/Sub; ENVIADA: publicada, corre el plazo de confirmación;
-- CONFIRMADA: módulo confirmó; RECHAZADA: módulo rechazó con motivo; VENCIDA: agotó los reenvíos por plazo.
CREATE TABLE REVOCACIONES_SISTEMA (
    id_revocacion UUID NOT NULL DEFAULT gen_random_uuid(),
    id_cierre UUID NOT NULL,
    destino varchar(15) NOT NULL,
    estado varchar(12) NOT NULL DEFAULT 'PENDIENTE',
    plazo_vence_en TIMESTAMPTZ NULL,
    reenvios_por_plazo smallint NOT NULL DEFAULT 0,
    recursos_revocados JSONB NULL,
    referencia varchar(60) NULL,
    motivo varchar(255) NULL,
    respondida_en TIMESTAMPTZ NULL,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT REVOCACIONES_SISTEMA_pk PRIMARY KEY (id_revocacion),
    CONSTRAINT uq_rev_sistema_cierre_destino UNIQUE (id_cierre, destino),
    CONSTRAINT fk_rev_sistema_cierre FOREIGN KEY (id_cierre)
        REFERENCES CIERRES_DESVINCULACION (id_cierre) ON DELETE CASCADE,
    CONSTRAINT chk_rev_sistema_destino CHECK (destino IN ('VENTAS', 'INVENTARIOS', 'ENTREGAS', 'CRM')),
    CONSTRAINT chk_rev_sistema_estado CHECK (estado IN ('PENDIENTE', 'ENVIADA', 'CONFIRMADA', 'RECHAZADA', 'VENCIDA')),
    CONSTRAINT chk_rev_sistema_reenvios CHECK (reenvios_por_plazo >= 0)
);
CREATE INDEX idx_rev_sistema_plazos ON REVOCACIONES_SISTEMA (estado, plazo_vence_en);

-- Tabla: EVENTOS_CIERRE
-- Bandeja de salida propia del cierre definitivo (outbox): guarda los envíos SALIENTE y las respuestas
-- simuladas RESPUESTA_SIMULADA hacia/desde Ventas/POS, Inventarios, Entregas y CRM en el tópico F.
-- id_mensaje no es único para permitir reenvíos y escenarios duplicados.
CREATE TABLE EVENTOS_CIERRE (
    id_evento UUID NOT NULL DEFAULT gen_random_uuid(),
    id_mensaje varchar(100) NOT NULL,
    id_cierre UUID NOT NULL,
    sentido varchar(20) NOT NULL,
    destino varchar(15) NOT NULL,
    tipo_evento varchar(60) NOT NULL,
    topico varchar(60) NOT NULL,
    carga JSONB NOT NULL,
    estado varchar(10) NOT NULL DEFAULT 'PENDIENTE',
    intentos smallint NOT NULL DEFAULT 0,
    ultimo_error varchar(255) NULL,
    proximo_intento_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_pubsub varchar(100) NULL,
    entregado_en TIMESTAMPTZ NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT EVENTOS_CIERRE_pk PRIMARY KEY (id_evento),
    CONSTRAINT fk_evento_cierre FOREIGN KEY (id_cierre)
        REFERENCES CIERRES_DESVINCULACION (id_cierre),
    CONSTRAINT chk_evento_cierre_sentido CHECK (sentido IN ('SALIENTE', 'RESPUESTA_SIMULADA')),
    CONSTRAINT chk_evento_cierre_destino CHECK (destino IN ('VENTAS', 'INVENTARIOS', 'ENTREGAS', 'CRM')),
    CONSTRAINT chk_evento_cierre_estado CHECK (estado IN ('PENDIENTE', 'ENTREGADO', 'FALLIDO')),
    CONSTRAINT chk_evento_cierre_intentos CHECK (intentos >= 0),
    CONSTRAINT chk_evento_cierre_entrega CHECK ((estado = 'ENTREGADO') = (entregado_en IS NOT NULL))
);
CREATE INDEX idx_eventos_cierre_pendientes ON EVENTOS_CIERRE (estado, proximo_intento_en);
CREATE INDEX idx_eventos_cierre_destino ON EVENTOS_CIERRE (id_cierre, destino, creado_en);

-- Tabla: MENSAJES_CIERRE_ENTRANTES
-- Bandeja de entrada y cola de errores (DLQ) de las confirmaciones de revocación de los sistemas externos.
-- carga es text para registrar incluso JSON inválido. id_mensaje único descarta duplicados.
CREATE TABLE MENSAJES_CIERRE_ENTRANTES (
    id_entrante UUID NOT NULL DEFAULT gen_random_uuid(),
    id_mensaje varchar(100) NOT NULL,
    origen varchar(10) NULL,
    tipo_evento varchar(60) NULL,
    id_cierre UUID NULL,
    destino varchar(15) NULL,
    carga text NOT NULL,
    estado varchar(10) NOT NULL DEFAULT 'RECIBIDO',
    intentos smallint NOT NULL DEFAULT 0,
    ultimo_error varchar(255) NULL,
    recibido_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    procesado_en TIMESTAMPTZ NULL,
    CONSTRAINT MENSAJES_CIERRE_ENTRANTES_pk PRIMARY KEY (id_entrante),
    CONSTRAINT uq_mensaje_cierre_entrante UNIQUE (id_mensaje),
    CONSTRAINT fk_mensaje_cierre_entrante FOREIGN KEY (id_cierre)
        REFERENCES CIERRES_DESVINCULACION (id_cierre),
    CONSTRAINT chk_mensaje_cierre_destino CHECK (destino IS NULL OR destino IN ('VENTAS', 'INVENTARIOS', 'ENTREGAS', 'CRM')),
    CONSTRAINT chk_mensaje_cierre_estado CHECK (estado IN ('RECIBIDO', 'PROCESADO', 'IGNORADO', 'EN_DLQ')),
    CONSTRAINT chk_mensaje_cierre_intentos CHECK (intentos >= 0),
    CONSTRAINT chk_mensaje_cierre_procesado CHECK ((estado IN ('PROCESADO', 'IGNORADO')) = (procesado_en IS NOT NULL))
);
CREATE INDEX idx_mensajes_cierre_entrantes_estado ON MENSAJES_CIERRE_ENTRANTES (estado, recibido_en);
CREATE INDEX idx_mensajes_cierre_entrantes_cierre ON MENSAJES_CIERRE_ENTRANTES (id_cierre, recibido_en);
