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
