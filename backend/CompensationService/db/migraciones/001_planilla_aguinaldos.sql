-- Migración idempotente para bases de CompensationDB creadas ANTES de que la planilla de aguinaldos
-- (RF-47, KAN-67) se agregara a db/init.sql. Postgres solo corre init.sql una vez, al crear el volumen de
-- Docker por primera vez: un entorno que ya existía antes de este cambio no recibe las tablas nuevas solo, y
-- el reporte contable de aguinaldos (RF-49, KAN-69) falla con "relation ... does not exist" (500 genérico).
--
-- Se puede correr tantas veces como se quiera, en cualquier momento, sin perder datos existentes:
--   docker exec -i rrhh-postgres psql -U adminRRHH -d CompensationDB < backend/CompensationService/db/migraciones/001_planilla_aguinaldos.sql
--
-- Alternativa (pierde TODOS los datos de CompensationDB, no solo los de aguinaldos): recrear el volumen desde
-- cero para que init.sql se ejecute de nuevo con las tablas ya incluidas.
--   docker compose down -v && docker compose up -d
--
-- Si el proyecto llega a tener más cambios de esquema sobre una base ya existente, el patrón es el mismo:
-- un archivo numerado en esta carpeta, con CREATE/ALTER ... IF NOT EXISTS y constraints protegidas con DO $$.

BEGIN;

CREATE TABLE IF NOT EXISTS PLANILLA_AGUINALDO (
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

CREATE TABLE IF NOT EXISTS AGUINALDO_EMPLEADOS (
    id_aguinaldo_empleado UUID NOT NULL DEFAULT gen_random_uuid(),
    id_aguinaldo UUID NOT NULL,
    id_empleado UUID NOT NULL,
    nombre_empleado varchar(150) NOT NULL,
    numero_documento varchar(20) NULL,
    cargo varchar(100) NULL,
    area varchar(100) NULL,
    sucursal varchar(100) NULL,
    fecha_ingreso date NOT NULL,
    meses_trabajados smallint NOT NULL,
    dias_trabajados smallint NOT NULL,
    promedio_sueldo numeric(12,2) NOT NULL,
    monto numeric(12,2) NOT NULL,
    excluido boolean NOT NULL DEFAULT FALSE,
    motivo_exclusion varchar(255) NULL,
    CONSTRAINT AGUINALDO_EMPLEADOS_pk PRIMARY KEY (id_aguinaldo_empleado),
    CONSTRAINT uq_aguinaldo_empleado UNIQUE (id_aguinaldo, id_empleado),
    CONSTRAINT fk_aguinaldo_empleado_aguinaldo FOREIGN KEY (id_aguinaldo)
        REFERENCES PLANILLA_AGUINALDO (id_aguinaldo) ON DELETE CASCADE,
    CONSTRAINT chk_aguinaldo_empleado_exclusion CHECK (excluido = (motivo_exclusion IS NOT NULL)),
    CONSTRAINT chk_aguinaldo_empleado_valores CHECK (
        meses_trabajados >= 0 AND dias_trabajados BETWEEN 0 AND 29 AND promedio_sueldo >= 0 AND monto >= 0
        AND (NOT excluido OR monto = 0)
    )
);
CREATE INDEX IF NOT EXISTS idx_aguinaldo_empleados_aguinaldo ON AGUINALDO_EMPLEADOS (id_aguinaldo);

-- EVENTOS_SALIENTES/EVENTOS_ENTRANTES ya existían antes de KAN-67 (los usa la planilla mensual): si la base
-- es de antes, les falta la columna id_aguinaldo y sus constraints quedaron con la definición vieja (sin
-- contemplar el aguinaldo como recurso). ADD COLUMN IF NOT EXISTS es seguro siempre; las constraints se
-- reemplazan (DROP IF EXISTS + ADD) porque Postgres no tiene "ADD CONSTRAINT IF NOT EXISTS", y hacerlo así
-- es seguro: si la base ya tiene la columna y la constraint correcta, el resultado es el mismo.
ALTER TABLE EVENTOS_SALIENTES ADD COLUMN IF NOT EXISTS id_aguinaldo UUID NULL;
ALTER TABLE EVENTOS_ENTRANTES ADD COLUMN IF NOT EXISTS id_aguinaldo UUID NULL;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_evento_aguinaldo') THEN
        ALTER TABLE EVENTOS_SALIENTES ADD CONSTRAINT fk_evento_aguinaldo
            FOREIGN KEY (id_aguinaldo) REFERENCES PLANILLA_AGUINALDO (id_aguinaldo);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_evento_entrante_aguinaldo') THEN
        ALTER TABLE EVENTOS_ENTRANTES ADD CONSTRAINT fk_evento_entrante_aguinaldo
            FOREIGN KEY (id_aguinaldo) REFERENCES PLANILLA_AGUINALDO (id_aguinaldo);
    END IF;
END $$;

ALTER TABLE EVENTOS_SALIENTES DROP CONSTRAINT IF EXISTS chk_evento_recurso_destino;
ALTER TABLE EVENTOS_SALIENTES ADD CONSTRAINT chk_evento_recurso_destino
    CHECK ((id_planilla IS NULL AND id_aguinaldo IS NULL) = (destino IS NULL));

ALTER TABLE EVENTOS_SALIENTES DROP CONSTRAINT IF EXISTS chk_evento_recurso_unico;
ALTER TABLE EVENTOS_SALIENTES ADD CONSTRAINT chk_evento_recurso_unico
    CHECK (NOT (id_planilla IS NOT NULL AND id_aguinaldo IS NOT NULL));

ALTER TABLE EVENTOS_ENTRANTES DROP CONSTRAINT IF EXISTS chk_evento_entrante_recurso_unico;
ALTER TABLE EVENTOS_ENTRANTES ADD CONSTRAINT chk_evento_entrante_recurso_unico
    CHECK (NOT (id_planilla IS NOT NULL AND id_aguinaldo IS NOT NULL));

CREATE INDEX IF NOT EXISTS idx_eventos_salientes_aguinaldo ON EVENTOS_SALIENTES (id_aguinaldo, destino, creado_en);
CREATE INDEX IF NOT EXISTS idx_eventos_entrantes_aguinaldo ON EVENTOS_ENTRANTES (id_aguinaldo);

COMMIT;
