-- Created by Redgate Data Modeler (https://datamodeler.redgate-platform.com)
-- Last modification date: 2026-09-25 14:25:14.162
-- tables
-- Table: CAPACITACIONES_CERTIFICACION
CREATE TABLE CAPACITACIONES_CERTIFICACION (
    id_capacitacion UUID NOT NULL,
    id_empleado UUID NOT NULL,
    id_curso UUID NOT NULL,
    institucion_emisora varchar(120) NOT NULL,
    fecha_inicio date NULL,
    fecha_fin date NULL,
    fecha_emision date NOT NULL,
    fecha_vencimiento date NULL,
    certificado_adjunto_url varchar(255) NULL,
    certificado_nombre_original varchar(255) NULL,
    certificado_tipo_mime varchar(50) NULL,
    certificado_tamano_bytes int NULL,
    id_solicitud_servicio UUID NULL,
    alerta_vencimiento_enviada_en TIMESTAMPTZ NULL,
    registrado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT CAPACITACIONES_CERTIFICACION_pk PRIMARY KEY (id_capacitacion),
    CONSTRAINT uq_capacitacion_empleado_curso_emision UNIQUE (id_empleado, id_curso, fecha_emision),
    CONSTRAINT ck_capacitacion_rango_realizacion CHECK (fecha_inicio IS NULL OR fecha_fin IS NULL OR fecha_fin >= fecha_inicio),
    CONSTRAINT ck_capacitacion_vencimiento_posterior CHECK (fecha_vencimiento IS NULL OR fecha_vencimiento > fecha_emision),
    CONSTRAINT ck_capacitacion_certificado_mime CHECK (
        certificado_tipo_mime IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
    ),
    CONSTRAINT ck_capacitacion_certificado_tamano CHECK (certificado_tamano_bytes > 0),
    CONSTRAINT ck_capacitacion_certificado_completo CHECK (
        (certificado_adjunto_url IS NULL) = (certificado_nombre_original IS NULL)
        AND (certificado_adjunto_url IS NULL) = (certificado_tipo_mime IS NULL)
        AND (certificado_adjunto_url IS NULL) = (certificado_tamano_bytes IS NULL)
    )
);
-- Table: CARGOS
CREATE TABLE CARGOS (
    id_cargo UUID NOT NULL,
    id_departamento UUID NOT NULL,
    id_cargo_jefe_directo UUID NULL,
    codigo varchar(20) NOT NULL,
    nombre varchar(100) NOT NULL,
    fecha_modificacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    nivel_salarial varchar(50) NOT NULL DEFAULT 'Operativo Base',
    salario_base_referencial numeric(12, 2) NOT NULL,
    funciones_clave text NOT NULL,
    requisitos_minimos text NOT NULL,
    esta_activo boolean NOT NULL DEFAULT TRUE,
    CONSTRAINT CARGOS_pk PRIMARY KEY (id_cargo)
);
-- Table: CONTRATOS
CREATE TABLE CONTRATOS (
    id_contrato UUID NOT NULL,
    id_empleado UUID NOT NULL,
    id_tipo_contrato SMALLINT NOT NULL,
    id_tipo_jornada SMALLINT NOT NULL,
    numero_contrato varchar(40) NOT NULL,
    periodo_vigencia daterange NOT NULL,
    haber_mensual_pactado numeric(12, 2) NOT NULL,
    documento_adjunto_url varchar(255) NULL,
    es_adenda boolean NOT NULL DEFAULT FALSE,
    motivo_adenda text NULL,
    registrado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT CONTRATOS_pk PRIMARY KEY (id_contrato)
);
-- Table: CONVOCATORIAS_ASCENSO
CREATE TABLE CONVOCATORIAS_ASCENSO (
    id_convocatoria UUID NOT NULL,
    id_cargo UUID NOT NULL,
    id_sucursal UUID NOT NULL,
    titulo varchar(120) NOT NULL,
    descripcion_requisitos text NOT NULL,
    meses_antiguedad_minima int NOT NULL DEFAULT 6,
    nota_minima_desempeno numeric(4, 2) NOT NULL,
    fecha_inicio_postulacion date NOT NULL,
    fecha_cierre_postulacion date NOT NULL,
    esta_abierta boolean NOT NULL DEFAULT true,
    CONSTRAINT CONVOCATORIAS_ASCENSO_pk PRIMARY KEY (id_convocatoria)
);
-- Table: CURSOS_CAPACITACION
CREATE TABLE CURSOS_CAPACITACION (
    id_curso UUID NOT NULL,
    codigo varchar(30) NOT NULL,
    nombre varchar(150) NOT NULL,
    descripcion text NULL,
    horas_academicas int NOT NULL,
    tipo_capacitacion varchar(20) NOT NULL DEFAULT 'TECNICA',
    requiere_vencimiento boolean NOT NULL DEFAULT FALSE,
    meses_vigencia int NULL,
    esta_activo boolean NOT NULL DEFAULT TRUE,
    CONSTRAINT CURSOS_CAPACITACION_pk PRIMARY KEY (id_curso),
    CONSTRAINT uq_curso_capacitacion_codigo UNIQUE (codigo),
    CONSTRAINT ck_curso_tipo_capacitacion CHECK (tipo_capacitacion IN ('INDUCCION', 'CARNET_SANITARIO', 'TECNICA', 'CERTIFICACION')),
    CONSTRAINT ck_curso_horas_positivas CHECK (horas_academicas > 0),
    CONSTRAINT ck_curso_carnet_con_vencimiento CHECK (tipo_capacitacion <> 'CARNET_SANITARIO' OR requiere_vencimiento),
    CONSTRAINT ck_curso_meses_vigencia CHECK (meses_vigencia IS NULL OR (requiere_vencimiento AND meses_vigencia > 0))
);
-- Table: DEPARTAMENTOS
CREATE TABLE DEPARTAMENTOS (
    id_departamento UUID NOT NULL,
    id_departamento_padre UUID NULL,
    codigo varchar(20) NOT NULL,
    nombre varchar(100) NOT NULL,
    descripcion varchar(255) NULL,
    esta_activo boolean NOT NULL DEFAULT TRUE,
    CONSTRAINT DEPARTAMENTOS_pk PRIMARY KEY (id_departamento)
);
-- Table: EMPLEADOS
CREATE TABLE EMPLEADOS (
    id_empleado UUID NOT NULL,
    numero_documento varchar(20) NOT NULL,
    complemento_documento varchar(5) NULL,
    nombres varchar(70) NOT NULL,
    primer_apellido varchar(50) NOT NULL,
    segundo_apellido varchar(50) NULL,
    fecha_nacimiento date NOT NULL,
    genero varchar(20) NOT NULL,
    telefono_celular varchar(20) NOT NULL,
    correo_personal varchar(120) NOT NULL,
    direccion_domicilio varchar(255) NOT NULL,
    fecha_ingreso DATE NOT NULL,
    id_cargo_actual UUID NOT NULL,
    id_sucursal_actual UUID NOT NULL,
    id_estado_empleado SMALLINT NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT EMPLEADOS_pk PRIMARY KEY (id_empleado)
);
-- Table: ESTADOS_EMPLEADO
CREATE TABLE ESTADOS_EMPLEADO (
    id_estado_empleado SMALLINT NOT NULL,
    codigo varchar(20) NOT NULL,
    nombre varchar(50) NOT NULL,
    permite_acceso boolean NOT NULL,
    CONSTRAINT ESTADOS_EMPLEADO_pk PRIMARY KEY (id_estado_empleado)
);
CREATE TABLE HISTORIAL_SOLICITUD_SERVICIO (
    id_evento UUID NOT NULL,
    id_solicitud_servicio UUID NOT NULL,
    estado_anterior varchar(20) NULL,
    estado_nuevo varchar(20) NOT NULL,
    origen varchar(10) NOT NULL,
    id_mensaje_externo varchar(64) NULL,
    detalle text NULL,
    carga_mensaje jsonb NULL,
    registrado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT HISTORIAL_SOLICITUD_SERVICIO_pk PRIMARY KEY (id_evento),
    CONSTRAINT uq_historial_solicitud_mensaje_externo UNIQUE (id_mensaje_externo),
    CONSTRAINT ck_historial_solicitud_origen CHECK (origen IN ('RRHH', 'COMPRAS')),
    CONSTRAINT ck_historial_solicitud_estado_nuevo CHECK (
        estado_nuevo IN ('PENDIENTE_ENVIO', 'ENVIADA', 'EN_PROCESO', 'ORDEN_EMITIDA', 'RECHAZADA', 'CANCELADA')
    ),
    CONSTRAINT ck_historial_solicitud_estado_anterior CHECK (
        estado_anterior IN ('PENDIENTE_ENVIO', 'ENVIADA', 'EN_PROCESO', 'ORDEN_EMITIDA', 'RECHAZADA', 'CANCELADA')
    )
);
-- Table: MEMORANDUMS
CREATE TABLE MEMORANDUMS (
    id_memorandum UUID NOT NULL,
    id_empleado_receptor UUID NOT NULL,
    id_tipo_memo SMALLINT NOT NULL,
    id_empleado_emisor UUID NOT NULL,
    codigo_cite varchar(40) NOT NULL,
    asunto varchar(150) NOT NULL,
    contenido_descripcion text NOT NULL,
    fecha_emision date NOT NULL,
    fue_notificado boolean NOT NULL DEFAULT false,
    fecha_hora_notificacion TIMESTAMPTZ NULL,
    acuse_recibo_firmado boolean NOT NULL DEFAULT false,
    fecha_hora_acuse TIMESTAMPTZ NULL,
    CONSTRAINT MEMORANDUMS_pk PRIMARY KEY (id_memorandum)
);
-- Table: POSTULACIONES_ASCENSO
CREATE TABLE POSTULACIONES_ASCENSO (
    id_postulacion UUID NOT NULL,
    id_convocatoria UUID NOT NULL,
    id_empleado UUID NOT NULL,
    fecha_postulacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cumple_antiguedad boolean NOT NULL,
    cumple_nota_evaluacion boolean NOT NULL,
    estado_postulacion varchar(30) NOT NULL,
    fecha_formalizacion_ascenso date NULL,
    observaciones_resolucion text NULL,
    CONSTRAINT POSTULACIONES_ASCENSO_pk PRIMARY KEY (id_postulacion),
    CONSTRAINT uq_postulacion_convocatoria_empleado UNIQUE (id_convocatoria, id_empleado)
);
-- Table: REQUISITOS_CAPACITACION_CARGO
CREATE TABLE REQUISITOS_CAPACITACION_CARGO (
    id_requisito_cargo UUID NOT NULL,
    id_cargo UUID NOT NULL,
    id_curso UUID NOT NULL,
    es_obligatorio boolean NOT NULL DEFAULT TRUE,
    meses_validez_requerida int NULL,
    CONSTRAINT REQUISITOS_CAPACITACION_CARGO_pk PRIMARY KEY (id_requisito_cargo),
    CONSTRAINT uq_requisito_cargo_curso UNIQUE (id_cargo, id_curso)
);
CREATE TABLE SOLICITUDES_SERVICIO_CAPACITACION (
    id_solicitud_servicio UUID NOT NULL,
    id_mensaje UUID NOT NULL,
    id_curso UUID NOT NULL,
    id_empleado_solicitante UUID NOT NULL,
    descripcion_requerimiento text NOT NULL,
    cantidad_participantes int NOT NULL,
    fecha_requerida date NULL,
    monto_estimado numeric(12, 2) NULL,
    estado varchar(20) NOT NULL DEFAULT 'PENDIENTE_ENVIO',
    numero_orden_servicio varchar(40) NULL,
    proveedor_nombre varchar(150) NULL,
    proveedor_nit varchar(20) NULL,
    monto_adjudicado numeric(12, 2) NULL,
    intentos_envio int NOT NULL DEFAULT 0,
    proximo_intento_en TIMESTAMPTZ NULL,
    ultimo_error text NULL,
    enviada_en TIMESTAMPTZ NULL,
    registrado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT SOLICITUDES_SERVICIO_CAPACITACION_pk PRIMARY KEY (id_solicitud_servicio),
    CONSTRAINT uq_solicitud_servicio_id_mensaje UNIQUE (id_mensaje),
    CONSTRAINT uq_solicitud_servicio_numero_orden UNIQUE (numero_orden_servicio),
    CONSTRAINT ck_solicitud_servicio_estado CHECK (
        estado IN ('PENDIENTE_ENVIO', 'ENVIADA', 'EN_PROCESO', 'ORDEN_EMITIDA', 'RECHAZADA', 'CANCELADA')
    ),
    CONSTRAINT ck_solicitud_servicio_participantes CHECK (cantidad_participantes > 0),
    CONSTRAINT ck_solicitud_servicio_montos CHECK (
        (monto_estimado IS NULL OR monto_estimado >= 0) AND (monto_adjudicado IS NULL OR monto_adjudicado >= 0)
    ),
    CONSTRAINT ck_solicitud_servicio_intentos CHECK (intentos_envio >= 0),
    CONSTRAINT ck_solicitud_servicio_enviada CHECK (estado IN ('PENDIENTE_ENVIO', 'CANCELADA') OR enviada_en IS NOT NULL),
    CONSTRAINT ck_solicitud_servicio_orden_emitida CHECK (
        estado <> 'ORDEN_EMITIDA' OR (numero_orden_servicio IS NOT NULL AND proveedor_nombre IS NOT NULL)
    )
);
-- Table: SUCURSALES
CREATE TABLE SUCURSALES (
    id_sucursal UUID NOT NULL,
    codigo_sucursal varchar(20) NOT NULL,
    nombre varchar(100) NOT NULL,
    direccion varchar(255) NOT NULL,
    ciudad varchar(50) NOT NULL DEFAULT 'La Paz',
    telefono_contacto varchar(20) NULL,
    esta_activa boolean NOT NULL DEFAULT TRUE,
    CONSTRAINT SUCURSALES_pk PRIMARY KEY (id_sucursal)
);
-- Table: TIPOS_CONTRATO
CREATE TABLE TIPOS_CONTRATO (
    id_tipo_contrato SMALLINT NOT NULL,
    codigo varchar(30) NOT NULL,
    nombre varchar(60) NOT NULL,
    CONSTRAINT TIPOS_CONTRATO_pk PRIMARY KEY (id_tipo_contrato)
);
-- Table: TIPOS_JORNADA
CREATE TABLE TIPOS_JORNADA (
    id_tipo_jornada SMALLINT NOT NULL,
    codigo varchar(30) NOT NULL,
    nombre varchar(60) NOT NULL,
    horas_semanales int NOT NULL,
    CONSTRAINT TIPOS_JORNADA_pk PRIMARY KEY (id_tipo_jornada)
);
-- Table: TIPOS_MEMORANDUM
CREATE TABLE TIPOS_MEMORANDUM (
    id_tipo_memo SMALLINT NOT NULL,
    clasificacion varchar(30) NOT NULL,
    nombre varchar(80) NOT NULL,
    descripcion varchar(255) NOT NULL,
    CONSTRAINT TIPOS_MEMORANDUM_pk PRIMARY KEY (id_tipo_memo)
);
-- foreign keys
-- Reference: CAPACITACIONES_CERTIFICACION_CURSOS_CAPACITACION (table: CAPACITACIONES_CERTIFICACION)
ALTER TABLE CAPACITACIONES_CERTIFICACION
ADD CONSTRAINT CAPACITACIONES_CERTIFICACION_CURSOS_CAPACITACION FOREIGN KEY (id_curso) REFERENCES CURSOS_CAPACITACION (id_curso) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Reference: CAPACITACIONES_CERTIFICACION_EMPLEADOS (table: CAPACITACIONES_CERTIFICACION)
ALTER TABLE CAPACITACIONES_CERTIFICACION
ADD CONSTRAINT CAPACITACIONES_CERTIFICACION_EMPLEADOS FOREIGN KEY (id_empleado) REFERENCES EMPLEADOS (id_empleado) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Reference: CARGOS_CARGOS (table: CARGOS)
ALTER TABLE CARGOS
ADD CONSTRAINT CARGOS_CARGOS FOREIGN KEY (id_cargo_jefe_directo) REFERENCES CARGOS (id_cargo) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Reference: CARGOS_DEPARTAMENTOS (table: CARGOS)
ALTER TABLE CARGOS
ADD CONSTRAINT CARGOS_DEPARTAMENTOS FOREIGN KEY (id_departamento) REFERENCES DEPARTAMENTOS (id_departamento) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Reference: CONTRATOS_EMPLEADOS (table: CONTRATOS)
ALTER TABLE CONTRATOS
ADD CONSTRAINT CONTRATOS_EMPLEADOS FOREIGN KEY (id_empleado) REFERENCES EMPLEADOS (id_empleado) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Reference: CONTRATOS_TIPOS_CONTRATO (table: CONTRATOS)
ALTER TABLE CONTRATOS
ADD CONSTRAINT CONTRATOS_TIPOS_CONTRATO FOREIGN KEY (id_tipo_contrato) REFERENCES TIPOS_CONTRATO (id_tipo_contrato) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Reference: CONTRATOS_TIPOS_JORNADA (table: CONTRATOS)
ALTER TABLE CONTRATOS
ADD CONSTRAINT CONTRATOS_TIPOS_JORNADA FOREIGN KEY (id_tipo_jornada) REFERENCES TIPOS_JORNADA (id_tipo_jornada) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Reference: CONVOCATORIAS_ASCENSO_CARGOS (table: CONVOCATORIAS_ASCENSO)
ALTER TABLE CONVOCATORIAS_ASCENSO
ADD CONSTRAINT CONVOCATORIAS_ASCENSO_CARGOS FOREIGN KEY (id_cargo) REFERENCES CARGOS (id_cargo) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Reference: CONVOCATORIAS_ASCENSO_SUCURSALES (table: CONVOCATORIAS_ASCENSO)
ALTER TABLE CONVOCATORIAS_ASCENSO
ADD CONSTRAINT CONVOCATORIAS_ASCENSO_SUCURSALES FOREIGN KEY (id_sucursal) REFERENCES SUCURSALES (id_sucursal) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Reference: DEPARTAMENTOS_DEPARTAMENTOS (table: DEPARTAMENTOS)
ALTER TABLE DEPARTAMENTOS
ADD CONSTRAINT DEPARTAMENTOS_DEPARTAMENTOS FOREIGN KEY (id_departamento_padre) REFERENCES DEPARTAMENTOS (id_departamento) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Reference: EMPLEADOS_CARGOS (table: EMPLEADOS)
ALTER TABLE EMPLEADOS
ADD CONSTRAINT EMPLEADOS_CARGOS FOREIGN KEY (id_cargo_actual) REFERENCES CARGOS (id_cargo) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Reference: EMPLEADOS_ESTADOS_EMPLEADO (table: EMPLEADOS)
ALTER TABLE EMPLEADOS
ADD CONSTRAINT EMPLEADOS_ESTADOS_EMPLEADO FOREIGN KEY (id_estado_empleado) REFERENCES ESTADOS_EMPLEADO (id_estado_empleado) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Reference: EMPLEADOS_SUCURSALES (table: EMPLEADOS)
ALTER TABLE EMPLEADOS
ADD CONSTRAINT EMPLEADOS_SUCURSALES FOREIGN KEY (id_sucursal_actual) REFERENCES SUCURSALES (id_sucursal) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Reference: MEMORANDUMS_EMPLEADOS (table: MEMORANDUMS)
ALTER TABLE MEMORANDUMS
ADD CONSTRAINT MEMORANDUMS_EMPLEADOS FOREIGN KEY (id_empleado_receptor) REFERENCES EMPLEADOS (id_empleado) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Reference: MEMORANDUMS_EMPLEADOS_EMISOR (table: MEMORANDUMS)
ALTER TABLE MEMORANDUMS
ADD CONSTRAINT MEMORANDUMS_EMPLEADOS_EMISOR FOREIGN KEY (id_empleado_emisor) REFERENCES EMPLEADOS (id_empleado) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Reference: MEMORANDUMS_TIPOS_MEMORANDUM (table: MEMORANDUMS)
ALTER TABLE MEMORANDUMS
ADD CONSTRAINT MEMORANDUMS_TIPOS_MEMORANDUM FOREIGN KEY (id_tipo_memo) REFERENCES TIPOS_MEMORANDUM (id_tipo_memo) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Reference: POSTULACIONES_ASCENSO_CONVOCATORIAS_ASCENSO (table: POSTULACIONES_ASCENSO)
ALTER TABLE POSTULACIONES_ASCENSO
ADD CONSTRAINT POSTULACIONES_ASCENSO_CONVOCATORIAS_ASCENSO FOREIGN KEY (id_convocatoria) REFERENCES CONVOCATORIAS_ASCENSO (id_convocatoria) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Reference: POSTULACIONES_ASCENSO_EMPLEADOS (table: POSTULACIONES_ASCENSO)
ALTER TABLE POSTULACIONES_ASCENSO
ADD CONSTRAINT POSTULACIONES_ASCENSO_EMPLEADOS FOREIGN KEY (id_empleado) REFERENCES EMPLEADOS (id_empleado) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Reference: REQUISITOS_CAPACITACION_CARGO_CARGOS (table: REQUISITOS_CAPACITACION_CARGO)
ALTER TABLE REQUISITOS_CAPACITACION_CARGO
ADD CONSTRAINT REQUISITOS_CAPACITACION_CARGO_CARGOS FOREIGN KEY (id_cargo) REFERENCES CARGOS (id_cargo) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Reference: REQUISITOS_CAPACITACION_CARGO_CURSOS_CAPACITACION (table: REQUISITOS_CAPACITACION_CARGO)
ALTER TABLE REQUISITOS_CAPACITACION_CARGO
ADD CONSTRAINT REQUISITOS_CAPACITACION_CARGO_CURSOS_CAPACITACION FOREIGN KEY (id_curso) REFERENCES CURSOS_CAPACITACION (id_curso) NOT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE CAPACITACIONES_CERTIFICACION
ADD CONSTRAINT CAPACITACIONES_CERTIFICACION_SOLICITUDES_SERVICIO FOREIGN KEY (id_solicitud_servicio) REFERENCES SOLICITUDES_SERVICIO_CAPACITACION (id_solicitud_servicio) NOT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE SOLICITUDES_SERVICIO_CAPACITACION
ADD CONSTRAINT SOLICITUDES_SERVICIO_CAPACITACION_CURSOS_CAPACITACION FOREIGN KEY (id_curso) REFERENCES CURSOS_CAPACITACION (id_curso) NOT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE SOLICITUDES_SERVICIO_CAPACITACION
ADD CONSTRAINT SOLICITUDES_SERVICIO_CAPACITACION_EMPLEADOS FOREIGN KEY (id_empleado_solicitante) REFERENCES EMPLEADOS (id_empleado) NOT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE HISTORIAL_SOLICITUD_SERVICIO
ADD CONSTRAINT HISTORIAL_SOLICITUD_SERVICIO_SOLICITUDES_SERVICIO FOREIGN KEY (id_solicitud_servicio) REFERENCES SOLICITUDES_SERVICIO_CAPACITACION (id_solicitud_servicio) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- End of file.
-- KAN-125 (RF-19.1): historial de asignaciones cargo + sucursal por empleado.
-- Table: ASIGNACIONES_EMPLEADO
CREATE TABLE ASIGNACIONES_EMPLEADO (
    id_asignacion UUID NOT NULL,
    id_empleado UUID NOT NULL,
    id_cargo UUID NOT NULL,
    id_sucursal UUID NOT NULL,
    fecha_inicio date NOT NULL,
    fecha_fin date NULL,
    es_vigente boolean NOT NULL DEFAULT TRUE,
    registrado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ASIGNACIONES_EMPLEADO_pk PRIMARY KEY (id_asignacion),
    CONSTRAINT ck_asignacion_vigente_sin_fin CHECK (es_vigente = (fecha_fin IS NULL)),
    CONSTRAINT ck_asignacion_rango_fechas CHECK (
        fecha_fin IS NULL
        OR fecha_fin >= fecha_inicio
    )
);
-- Un empleado tiene como máximo una asignación vigente.
CREATE UNIQUE INDEX uq_asignacion_vigente_empleado ON ASIGNACIONES_EMPLEADO (id_empleado)
WHERE es_vigente;
CREATE INDEX ix_asignacion_empleado_fecha ON ASIGNACIONES_EMPLEADO (id_empleado, fecha_inicio DESC);
ALTER TABLE ASIGNACIONES_EMPLEADO
ADD CONSTRAINT ASIGNACIONES_EMPLEADO_EMPLEADOS FOREIGN KEY (id_empleado) REFERENCES EMPLEADOS (id_empleado) NOT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE ASIGNACIONES_EMPLEADO
ADD CONSTRAINT ASIGNACIONES_EMPLEADO_CARGOS FOREIGN KEY (id_cargo) REFERENCES CARGOS (id_cargo) NOT DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE ASIGNACIONES_EMPLEADO
ADD CONSTRAINT ASIGNACIONES_EMPLEADO_SUCURSALES FOREIGN KEY (id_sucursal) REFERENCES SUCURSALES (id_sucursal) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- RF-18 (criterio 4): historial de cambios del superior (jefe directo) de un cargo.
CREATE TABLE IF NOT EXISTS HISTORIAL_JERARQUIA_CARGO (
    id_historial UUID NOT NULL DEFAULT gen_random_uuid(),
    id_cargo UUID NOT NULL REFERENCES CARGOS (id_cargo),
    id_cargo_jefe_anterior UUID NULL REFERENCES CARGOS (id_cargo),
    id_cargo_jefe_nuevo UUID NULL REFERENCES CARGOS (id_cargo),
    cambiado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT HISTORIAL_JERARQUIA_CARGO_pk PRIMARY KEY (id_historial)
);
CREATE INDEX IF NOT EXISTS ix_historial_jerarquia_cargo ON HISTORIAL_JERARQUIA_CARGO (id_cargo, cambiado_en DESC);
-- KAN-268 (RF-37): memorándums de llamada de atención.
ALTER TABLE MEMORANDUMS
ADD COLUMN gestion SMALLINT NULL,
    ADD COLUMN numero_correlativo INT NULL,
    ADD COLUMN naturaleza_falta varchar(10) NULL,
    ADD COLUMN gravedad_falta varchar(10) NULL,
    ADD COLUMN estado_sancion varchar(10) NOT NULL DEFAULT 'BORRADOR',
    ADD COLUMN evidencia_adjunto_url varchar(255) NULL,
    ADD COLUMN documento_pdf_url varchar(255) NULL,
    ADD COLUMN motivo_anulacion text NULL,
    ADD COLUMN fecha_hora_anulacion TIMESTAMPTZ NULL;
-- El CITE se asigna recién al confirmar la emisión; un borrador aún no lo tiene.
ALTER TABLE MEMORANDUMS
ALTER COLUMN codigo_cite DROP NOT NULL;
ALTER TABLE MEMORANDUMS
ADD CONSTRAINT uq_memorandum_codigo_cite UNIQUE (codigo_cite),
    ADD CONSTRAINT uq_memorandum_correlativo UNIQUE (gestion, numero_correlativo),
    ADD CONSTRAINT ck_memorandum_naturaleza_falta CHECK (naturaleza_falta IN ('OPERATIVA', 'CONDUCTA')),
    ADD CONSTRAINT ck_memorandum_gravedad_falta CHECK (gravedad_falta IN ('LEVE', 'MODERADA', 'GRAVE')),
    ADD CONSTRAINT ck_memorandum_falta_completa CHECK (
        (naturaleza_falta IS NULL) = (gravedad_falta IS NULL)
    ),
    ADD CONSTRAINT ck_memorandum_estado_sancion CHECK (
        estado_sancion IN ('BORRADOR', 'EMITIDO', 'ANULADO')
    ),
    ADD CONSTRAINT ck_memorandum_correlativo_positivo CHECK (numero_correlativo > 0),
    ADD CONSTRAINT ck_memorandum_emitido_con_correlativo CHECK (
        estado_sancion = 'BORRADOR'
        OR (
            gestion IS NOT NULL
            AND numero_correlativo IS NOT NULL
            AND codigo_cite IS NOT NULL
        )
    ),
    ADD CONSTRAINT ck_memorandum_anulacion CHECK (
        (estado_sancion = 'ANULADO') = (
            motivo_anulacion IS NOT NULL
            AND fecha_hora_anulacion IS NOT NULL
        )
    );
CREATE INDEX ix_memorandum_receptor_estado_fecha ON MEMORANDUMS (
    id_empleado_receptor,
    estado_sancion,
    fecha_emision DESC
);
CREATE TABLE CORRELATIVOS_MEMORANDUM (
    gestion SMALLINT NOT NULL,
    ultimo_numero INT NOT NULL DEFAULT 0,
    CONSTRAINT CORRELATIVOS_MEMORANDUM_pk PRIMARY KEY (gestion),
    CONSTRAINT ck_correlativo_memorandum_no_negativo CHECK (ultimo_numero >= 0)
);
-- Seed de tipos de memorándum.
INSERT INTO TIPOS_MEMORANDUM (id_tipo_memo, clasificacion, nombre, descripcion)
VALUES (
        1,
        'AMONESTACION',
        'Llamada de atención',
        'Llamada de atención por falta operativa o de conducta'
    ),
    (
        2,
        'RECONOCIMIENTO',
        'Puntualidad',
        'Reconocimiento por puntualidad'
    ),
    (
        3,
        'RECONOCIMIENTO',
        'Rendimiento operativo',
        'Reconocimiento por rendimiento operativo destacado'
    );
-- KAN-278 (RF-39): notificación y acuse de recibo digital de memorándums.
-- fue_notificado / fecha_hora_notificacion: el aviso llegó al portal del colaborador; el plazo de acuse corre desde ahí.
-- acuse_recibo_firmado / fecha_hora_acuse: acuse del colaborador, con la IP y el usuario que lo registraron.
-- estado_acuse: PENDIENTE (esperando acuse), RECIBIDO ('Notificado y Recibido') o VENCIDO (plazo cumplido sin acuse; RRHH ya fue alertado).
ALTER TABLE MEMORANDUMS
ADD COLUMN estado_acuse varchar(10) NOT NULL DEFAULT 'PENDIENTE',
    ADD COLUMN fecha_limite_acuse TIMESTAMPTZ NULL,
    ADD COLUMN fecha_hora_apertura TIMESTAMPTZ NULL,
    ADD COLUMN ip_acuse varchar(45) NULL,
    ADD COLUMN id_usuario_acuse UUID NULL,
    ADD COLUMN comentario_descargo text NULL,
    ADD COLUMN fecha_hora_alerta_rrhh TIMESTAMPTZ NULL;
ALTER TABLE MEMORANDUMS
ADD CONSTRAINT ck_memorandum_estado_acuse CHECK (estado_acuse IN ('PENDIENTE', 'RECIBIDO', 'VENCIDO')),
    ADD CONSTRAINT ck_memorandum_notificacion CHECK (
        fue_notificado = (fecha_hora_notificacion IS NOT NULL)
        AND fue_notificado = (fecha_limite_acuse IS NOT NULL)
    ),
    ADD CONSTRAINT ck_memorandum_acuse CHECK (
        acuse_recibo_firmado = (estado_acuse = 'RECIBIDO')
        AND acuse_recibo_firmado = (
            fecha_hora_acuse IS NOT NULL
            AND ip_acuse IS NOT NULL
            AND id_usuario_acuse IS NOT NULL
        )
    ),
    ADD CONSTRAINT ck_memorandum_acuse_vencido CHECK (
        estado_acuse <> 'VENCIDO'
        OR fecha_hora_alerta_rrhh IS NOT NULL
    );
-- Memorándums emitidos que esperan acuse: los recorre el job de vencimientos.
CREATE INDEX ix_memorandum_acuse_pendiente ON MEMORANDUMS (fecha_limite_acuse)
WHERE estado_acuse = 'PENDIENTE';

-- KAN-263 (RF-36): Kardex laboral consolidado. Una fila por empleado con sus datos y totales.
CREATE INDEX IF NOT EXISTS ix_contrato_empleado ON CONTRATOS (id_empleado);
CREATE INDEX IF NOT EXISTS ix_capacitacion_empleado_fecha
    ON CAPACITACIONES_CERTIFICACION (id_empleado, fecha_emision DESC);

CREATE OR REPLACE VIEW vw_kardex_resumen AS
SELECT e.id_empleado,
       e.numero_documento,
       e.complemento_documento,
       e.nombres,
       e.primer_apellido,
       e.segundo_apellido,
       concat_ws(' ', e.nombres, e.primer_apellido, e.segundo_apellido) AS nombre_completo,
       e.fecha_nacimiento,
       e.genero,
       e.telefono_celular,
       e.correo_personal,
       e.direccion_domicilio,
       e.fecha_ingreso,
       extract(year FROM age(CURRENT_DATE, e.fecha_ingreso))::int AS antiguedad_anios,
       extract(month FROM age(CURRENT_DATE, e.fecha_ingreso))::int AS antiguedad_meses,
       ee.codigo AS estado_codigo,
       ee.nombre AS estado_nombre,
       c.id_cargo,
       c.codigo AS cargo_codigo,
       c.nombre AS cargo_nombre,
       c.nivel_salarial AS cargo_nivel_salarial,
       d.id_departamento,
       d.nombre AS area_nombre,
       s.id_sucursal,
       s.nombre AS sucursal_nombre,
       s.ciudad AS sucursal_ciudad,
       asg.vigente_desde,
       asg.total_asignaciones,
       cv.id_contrato AS contrato_vigente_id,
       cv.numero_contrato AS contrato_vigente_numero,
       cv.tipo_contrato AS contrato_vigente_tipo,
       cv.tipo_jornada AS contrato_vigente_jornada,
       cv.fecha_inicio AS contrato_vigente_desde,
       cv.fecha_fin AS contrato_vigente_hasta,
       cv.haber_mensual_pactado AS contrato_vigente_haber,
       ct.total_contratos,
       ct.total_adendas,
       mm.total_sanciones,
       mm.sanciones_leves,
       mm.sanciones_moderadas,
       mm.sanciones_graves,
       mm.total_reconocimientos,
       mm.memorandums_sin_acuse,
       mm.fecha_ultima_sancion,
       cap.total_capacitaciones,
       cap.capacitaciones_vencidas
  FROM EMPLEADOS e
  JOIN ESTADOS_EMPLEADO ee ON ee.id_estado_empleado = e.id_estado_empleado
  JOIN CARGOS c            ON c.id_cargo = e.id_cargo_actual
  JOIN DEPARTAMENTOS d     ON d.id_departamento = c.id_departamento
  JOIN SUCURSALES s        ON s.id_sucursal = e.id_sucursal_actual
  LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS total_asignaciones,
              MAX(a.fecha_inicio) FILTER (WHERE a.es_vigente) AS vigente_desde
         FROM ASIGNACIONES_EMPLEADO a
        WHERE a.id_empleado = e.id_empleado
  ) asg ON TRUE
  LEFT JOIN LATERAL (
       SELECT k.id_contrato,
              k.numero_contrato,
              tc.nombre AS tipo_contrato,
              tj.nombre AS tipo_jornada,
              lower(k.periodo_vigencia) AS fecha_inicio,
              upper(k.periodo_vigencia) - 1 AS fecha_fin,
              k.haber_mensual_pactado
         FROM CONTRATOS k
         JOIN TIPOS_CONTRATO tc ON tc.id_tipo_contrato = k.id_tipo_contrato
         JOIN TIPOS_JORNADA tj  ON tj.id_tipo_jornada = k.id_tipo_jornada
        WHERE k.id_empleado = e.id_empleado
          AND k.periodo_vigencia @> CURRENT_DATE
        ORDER BY lower(k.periodo_vigencia) DESC NULLS LAST, k.registrado_en DESC
        LIMIT 1
  ) cv ON TRUE
  LEFT JOIN LATERAL (
       SELECT COUNT(*) FILTER (WHERE NOT k.es_adenda)::int AS total_contratos,
              COUNT(*) FILTER (WHERE k.es_adenda)::int AS total_adendas
         FROM CONTRATOS k
        WHERE k.id_empleado = e.id_empleado
  ) ct ON TRUE
  LEFT JOIN LATERAL (
       SELECT COUNT(*) FILTER (WHERE NOT mt.es_reconocimiento)::int AS total_sanciones,
              COUNT(*) FILTER (WHERE NOT mt.es_reconocimiento AND mt.gravedad_falta = 'LEVE')::int AS sanciones_leves,
              COUNT(*) FILTER (WHERE NOT mt.es_reconocimiento AND mt.gravedad_falta = 'MODERADA')::int AS sanciones_moderadas,
              COUNT(*) FILTER (WHERE NOT mt.es_reconocimiento AND mt.gravedad_falta = 'GRAVE')::int AS sanciones_graves,
              COUNT(*) FILTER (WHERE mt.es_reconocimiento)::int AS total_reconocimientos,
              COUNT(*) FILTER (WHERE NOT mt.acuse_recibo_firmado)::int AS memorandums_sin_acuse,
              MAX(mt.fecha_emision) FILTER (WHERE NOT mt.es_reconocimiento) AS fecha_ultima_sancion
         FROM (
              SELECT m.gravedad_falta,
                     m.acuse_recibo_firmado,
                     m.fecha_emision,
                     upper(trim(t.clasificacion)) = 'RECONOCIMIENTO' AS es_reconocimiento
                FROM MEMORANDUMS m
                JOIN TIPOS_MEMORANDUM t ON t.id_tipo_memo = m.id_tipo_memo
               WHERE m.id_empleado_receptor = e.id_empleado
                 AND m.estado_sancion = 'EMITIDO'
         ) mt
  ) mm ON TRUE
  LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS total_capacitaciones,
              COUNT(*) FILTER (WHERE cc.fecha_vencimiento < CURRENT_DATE)::int AS capacitaciones_vencidas
         FROM CAPACITACIONES_CERTIFICACION cc
        WHERE cc.id_empleado = e.id_empleado
  ) cap ON TRUE;

CREATE INDEX IF NOT EXISTS ix_capacitacion_vencimiento
    ON CAPACITACIONES_CERTIFICACION (fecha_vencimiento)
    WHERE fecha_vencimiento IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_capacitacion_alerta_pendiente
    ON CAPACITACIONES_CERTIFICACION (fecha_vencimiento)
    WHERE fecha_vencimiento IS NOT NULL AND alerta_vencimiento_enviada_en IS NULL;

CREATE INDEX IF NOT EXISTS ix_capacitacion_solicitud_servicio
    ON CAPACITACIONES_CERTIFICACION (id_solicitud_servicio)
    WHERE id_solicitud_servicio IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_solicitud_servicio_pendiente_envio
    ON SOLICITUDES_SERVICIO_CAPACITACION (proximo_intento_en)
    WHERE estado = 'PENDIENTE_ENVIO';
CREATE INDEX IF NOT EXISTS ix_solicitud_servicio_respuesta_simulada
    ON SOLICITUDES_SERVICIO_CAPACITACION (actualizado_en)
    WHERE estado IN ('ENVIADA', 'EN_PROCESO');
CREATE INDEX IF NOT EXISTS ix_solicitud_servicio_curso_estado
    ON SOLICITUDES_SERVICIO_CAPACITACION (id_curso, estado);
CREATE INDEX IF NOT EXISTS ix_historial_solicitud_servicio_fecha
    ON HISTORIAL_SOLICITUD_SERVICIO (id_solicitud_servicio, registrado_en DESC);
