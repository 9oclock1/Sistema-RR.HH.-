-- extensiones
-- btree_gist: permite combinar UUID y rangos de fechas en una restricción EXCLUDE.
CREATE EXTENSION IF NOT EXISTS btree_gist;
-- tablas
-- Tabla: CATALOGOS_TIPO_JORNADA
CREATE TABLE CATALOGOS_TIPO_JORNADA (
    id_tipo_jornada SMALLINT NOT NULL,
    codigo varchar(30) NOT NULL,
    nombre varchar(60) NOT NULL,
    CONSTRAINT CATALOGOS_TIPO_JORNADA_pk PRIMARY KEY (id_tipo_jornada),
    CONSTRAINT uq_tipo_jornada_codigo UNIQUE (codigo)
);
-- Tabla: TURNOS
CREATE TABLE TURNOS (
    id_turno UUID NOT NULL DEFAULT gen_random_uuid(),
    id_tipo_jornada SMALLINT NOT NULL,
    nombre varchar(60) NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    minutos_refrigerio SMALLINT NOT NULL DEFAULT 0,
    minutos_tolerancia SMALLINT NOT NULL DEFAULT 0,
    esta_activo boolean NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT TURNOS_pk PRIMARY KEY (id_turno),
    CONSTRAINT uq_turno_nombre UNIQUE (nombre),
    CONSTRAINT chk_turno_horas_distintas CHECK (hora_inicio <> hora_fin),
    CONSTRAINT chk_turno_refrigerio CHECK (minutos_refrigerio >= 0),
    CONSTRAINT chk_turno_tolerancia CHECK (minutos_tolerancia >= 0)
);
-- Tabla: ASIGNACIONES_TURNO
CREATE TABLE ASIGNACIONES_TURNO (
    id_asignacion UUID NOT NULL DEFAULT gen_random_uuid(),
    id_turno UUID NOT NULL,
    id_empleado UUID NOT NULL,
    fecha_desde date NOT NULL,
    fecha_hasta date NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ASIGNACIONES_TURNO_pk PRIMARY KEY (id_asignacion),
    CONSTRAINT chk_asignacion_fechas CHECK (fecha_hasta IS NULL OR fecha_hasta >= fecha_desde)
);
CREATE INDEX idx_asignaciones_turno_id_turno ON ASIGNACIONES_TURNO (id_turno);
-- Tabla: CATALOGOS_TIPO_MARCAJE
CREATE TABLE CATALOGOS_TIPO_MARCAJE (
    id_tipo_marcaje SMALLINT NOT NULL,
    codigo varchar(30) NOT NULL,
    nombre varchar(60) NOT NULL,
    CONSTRAINT CATALOGOS_TIPO_MARCAJE_pk PRIMARY KEY (id_tipo_marcaje),
    CONSTRAINT uq_tipo_marcaje_codigo UNIQUE (codigo)
);
-- Tabla: CATALOGOS_ORIGEN_MARCAJE
CREATE TABLE CATALOGOS_ORIGEN_MARCAJE (
    id_origen_marcaje SMALLINT NOT NULL,
    codigo varchar(30) NOT NULL,
    nombre varchar(60) NOT NULL,
    CONSTRAINT CATALOGOS_ORIGEN_MARCAJE_pk PRIMARY KEY (id_origen_marcaje),
    CONSTRAINT uq_origen_marcaje_codigo UNIQUE (codigo)
);
-- Tabla: CATALOGOS_ESTADO_MARCAJE
CREATE TABLE CATALOGOS_ESTADO_MARCAJE (
    id_estado_marcaje SMALLINT NOT NULL,
    codigo varchar(30) NOT NULL,
    nombre varchar(60) NOT NULL,
    CONSTRAINT CATALOGOS_ESTADO_MARCAJE_pk PRIMARY KEY (id_estado_marcaje),
    CONSTRAINT uq_estado_marcaje_codigo UNIQUE (codigo)
);
-- Tabla: MARCAJES
CREATE TABLE MARCAJES (
    id_marcaje UUID NOT NULL DEFAULT gen_random_uuid(),
    id_empleado UUID NOT NULL,
    id_tipo_marcaje SMALLINT NOT NULL,
    id_origen_marcaje SMALLINT NOT NULL,
    id_estado_marcaje SMALLINT NOT NULL DEFAULT 1,
    fecha_hora_marcaje TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_jornada date NOT NULL,
    codigo_dispositivo varchar(40) NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT MARCAJES_pk PRIMARY KEY (id_marcaje),
    CONSTRAINT uq_marcaje_empleado_tipo_jornada UNIQUE (id_empleado, id_tipo_marcaje, fecha_jornada)
);
-- Tabla: CATALOGOS_PERIODO_ROL
CREATE TABLE CATALOGOS_PERIODO_ROL (
    id_periodo_rol SMALLINT NOT NULL,
    codigo varchar(30) NOT NULL,
    nombre varchar(60) NOT NULL,
    CONSTRAINT CATALOGOS_PERIODO_ROL_pk PRIMARY KEY (id_periodo_rol),
    CONSTRAINT uq_periodo_rol_codigo UNIQUE (codigo)
);
-- Tabla: CATALOGOS_ESTADO_ROL
CREATE TABLE CATALOGOS_ESTADO_ROL (
    id_estado_rol SMALLINT NOT NULL,
    codigo varchar(30) NOT NULL,
    nombre varchar(60) NOT NULL,
    CONSTRAINT CATALOGOS_ESTADO_ROL_pk PRIMARY KEY (id_estado_rol),
    CONSTRAINT uq_estado_rol_codigo UNIQUE (codigo)
);
-- Tabla: ROLES_TURNO
-- Rol de turnos rotativos de un área en una sucursal para una semana o un mes.
CREATE TABLE ROLES_TURNO (
    id_rol UUID NOT NULL DEFAULT gen_random_uuid(),
    id_sucursal UUID NOT NULL,
    id_departamento UUID NOT NULL,
    id_periodo_rol SMALLINT NOT NULL,
    fecha_inicio date NOT NULL,
    fecha_fin date NOT NULL,
    id_estado_rol SMALLINT NOT NULL DEFAULT 1,
    version_publicada int NOT NULL DEFAULT 0,
    tiene_cambios_sin_publicar boolean NOT NULL DEFAULT FALSE,
    publicado_en TIMESTAMPTZ NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ROLES_TURNO_pk PRIMARY KEY (id_rol),
    CONSTRAINT chk_rol_fechas CHECK (fecha_fin >= fecha_inicio),
    CONSTRAINT chk_rol_version CHECK (version_publicada >= 0),
    -- Un área de una sucursal no puede tener dos roles con días en común.
    CONSTRAINT ex_rol_sin_solapamiento EXCLUDE USING gist (
        id_sucursal WITH =,
        id_departamento WITH =,
        daterange(fecha_inicio, fecha_fin, '[]') WITH &&
    )
);
-- Tabla: ASIGNACIONES_ROL_TURNO
-- Borrador del rol: un turno o un descanso por empleado y día.
CREATE TABLE ASIGNACIONES_ROL_TURNO (
    id_asignacion_rol UUID NOT NULL DEFAULT gen_random_uuid(),
    id_rol UUID NOT NULL,
    id_empleado UUID NOT NULL,
    fecha date NOT NULL,
    id_turno UUID NULL,
    es_descanso boolean NOT NULL DEFAULT FALSE,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ASIGNACIONES_ROL_TURNO_pk PRIMARY KEY (id_asignacion_rol),
    CONSTRAINT uq_asignacion_rol_empleado_fecha UNIQUE (id_rol, id_empleado, fecha),
    CONSTRAINT chk_asignacion_rol_turno_o_descanso CHECK (es_descanso = (id_turno IS NULL))
);
CREATE INDEX idx_asignaciones_rol_turno_empleado_fecha ON ASIGNACIONES_ROL_TURNO (id_empleado, fecha);
CREATE INDEX idx_asignaciones_rol_turno_id_turno ON ASIGNACIONES_ROL_TURNO (id_turno);
-- Tabla: TURNOS_PUBLICADOS
-- Copia del rol al publicarse: es lo que ve el colaborador en su portal.
CREATE TABLE TURNOS_PUBLICADOS (
    id_turno_publicado UUID NOT NULL DEFAULT gen_random_uuid(),
    id_rol UUID NOT NULL,
    id_empleado UUID NOT NULL,
    fecha date NOT NULL,
    id_turno UUID NULL,
    es_descanso boolean NOT NULL DEFAULT FALSE,
    nombre_turno varchar(60) NULL,
    hora_inicio TIME NULL,
    hora_fin TIME NULL,
    minutos_refrigerio SMALLINT NULL,
    minutos_tolerancia SMALLINT NULL,
    publicado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT TURNOS_PUBLICADOS_pk PRIMARY KEY (id_turno_publicado),
    -- Un empleado tiene un solo turno publicado por día, aunque cambie de área.
    CONSTRAINT uq_turno_publicado_empleado_fecha UNIQUE (id_empleado, fecha),
    CONSTRAINT chk_turno_publicado_turno_o_descanso CHECK (
        es_descanso = (id_turno IS NULL)
        AND (es_descanso OR (nombre_turno IS NOT NULL AND hora_inicio IS NOT NULL AND hora_fin IS NOT NULL))
    )
);
CREATE INDEX idx_turnos_publicados_id_rol ON TURNOS_PUBLICADOS (id_rol);
CREATE INDEX idx_turnos_publicados_id_turno ON TURNOS_PUBLICADOS (id_turno);
-- Tabla: CATALOGOS_ESTADO_EVENTO
CREATE TABLE CATALOGOS_ESTADO_EVENTO (
    id_estado_evento SMALLINT NOT NULL,
    codigo varchar(30) NOT NULL,
    nombre varchar(60) NOT NULL,
    CONSTRAINT CATALOGOS_ESTADO_EVENTO_pk PRIMARY KEY (id_estado_evento),
    CONSTRAINT uq_estado_evento_codigo UNIQUE (codigo)
);
-- Tabla: EVENTOS_SALIENTES
-- Eventos para otros módulos; se guardan junto con el cambio y se envían después.
CREATE TABLE EVENTOS_SALIENTES (
    id_evento UUID NOT NULL DEFAULT gen_random_uuid(),
    topico varchar(60) NOT NULL,
    tipo_evento varchar(60) NOT NULL,
    id_rol UUID NULL,
    carga JSONB NOT NULL,
    id_estado_evento SMALLINT NOT NULL DEFAULT 1,
    intentos SMALLINT NOT NULL DEFAULT 0,
    ultimo_error varchar(255) NULL,
    proximo_intento_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    entregado_en TIMESTAMPTZ NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT EVENTOS_SALIENTES_pk PRIMARY KEY (id_evento),
    CONSTRAINT chk_evento_intentos CHECK (intentos >= 0)
);
CREATE INDEX idx_eventos_salientes_pendientes ON EVENTOS_SALIENTES (id_estado_evento, proximo_intento_en);
CREATE INDEX idx_eventos_salientes_id_rol ON EVENTOS_SALIENTES (id_rol);
-- Tabla: CATALOGOS_TIPO_NOVEDAD
CREATE TABLE CATALOGOS_TIPO_NOVEDAD (
    id_tipo_novedad SMALLINT NOT NULL,
    codigo varchar(30) NOT NULL,
    nombre varchar(60) NOT NULL,
    -- El colaborador puede presentar un justificativo para subsanarla.
    es_justificable BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT CATALOGOS_TIPO_NOVEDAD_pk PRIMARY KEY (id_tipo_novedad),
    CONSTRAINT uq_tipo_novedad_codigo UNIQUE (codigo)
);
-- Tabla: CATALOGOS_ESTADO_NOVEDAD
CREATE TABLE CATALOGOS_ESTADO_NOVEDAD (
    id_estado_novedad SMALLINT NOT NULL,
    codigo varchar(30) NOT NULL,
    nombre varchar(60) NOT NULL,
    CONSTRAINT CATALOGOS_ESTADO_NOVEDAD_pk PRIMARY KEY (id_estado_novedad),
    CONSTRAINT uq_estado_novedad_codigo UNIQUE (codigo)
);
-- Tabla: NOVEDADES_ASISTENCIA
-- Atrasos, inasistencias, salidas anticipadas y omisiones halladas al contrastar turnos y marcajes.
CREATE TABLE NOVEDADES_ASISTENCIA (
    id_novedad UUID NOT NULL DEFAULT gen_random_uuid(),
    id_empleado UUID NOT NULL,
    fecha_jornada date NOT NULL,
    id_tipo_novedad SMALLINT NOT NULL,
    id_estado_novedad SMALLINT NOT NULL DEFAULT 1,
    id_turno UUID NULL,
    id_rol UUID NULL,
    nombre_turno varchar(60) NOT NULL,
    inicio_programado TIMESTAMPTZ NOT NULL,
    fin_programado TIMESTAMPTZ NOT NULL,
    minutos_tolerancia SMALLINT NOT NULL DEFAULT 0,
    id_marcaje UUID NULL,
    minutos int NOT NULL DEFAULT 0,
    minutos_penalizacion int NOT NULL DEFAULT 0,
    -- Minutos efectivos del turno (duración menos refrigerio).
    minutos_programados int NOT NULL DEFAULT 0,
    detectada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    consolidada_en TIMESTAMPTZ NULL,
    CONSTRAINT NOVEDADES_ASISTENCIA_pk PRIMARY KEY (id_novedad),
    -- Cada tipo de novedad se registra una sola vez por jornada.
    CONSTRAINT uq_novedad_empleado_jornada_tipo UNIQUE (id_empleado, fecha_jornada, id_tipo_novedad),
    CONSTRAINT chk_novedad_minutos CHECK (minutos >= 0 AND minutos_penalizacion >= 0 AND minutos_programados >= 0),
    CONSTRAINT chk_novedad_horario CHECK (fin_programado > inicio_programado)
);
CREATE INDEX idx_novedades_asistencia_fecha ON NOVEDADES_ASISTENCIA (fecha_jornada);
CREATE INDEX idx_novedades_asistencia_id_marcaje ON NOVEDADES_ASISTENCIA (id_marcaje);
CREATE INDEX idx_novedades_asistencia_sin_consolidar ON NOVEDADES_ASISTENCIA (fin_programado) WHERE consolidada_en IS NULL;
-- Tabla: CATALOGOS_MOTIVO_JUSTIFICACION
CREATE TABLE CATALOGOS_MOTIVO_JUSTIFICACION (
    id_motivo_justificacion SMALLINT NOT NULL,
    codigo varchar(30) NOT NULL,
    nombre varchar(60) NOT NULL,
    CONSTRAINT CATALOGOS_MOTIVO_JUSTIFICACION_pk PRIMARY KEY (id_motivo_justificacion),
    CONSTRAINT uq_motivo_justificacion_codigo UNIQUE (codigo)
);
-- Tabla: CATALOGOS_ESTADO_JUSTIFICACION
CREATE TABLE CATALOGOS_ESTADO_JUSTIFICACION (
    id_estado_justificacion SMALLINT NOT NULL,
    codigo varchar(30) NOT NULL,
    nombre varchar(60) NOT NULL,
    CONSTRAINT CATALOGOS_ESTADO_JUSTIFICACION_pk PRIMARY KEY (id_estado_justificacion),
    CONSTRAINT uq_estado_justificacion_codigo UNIQUE (codigo)
);
-- Tabla: SOLICITUDES_JUSTIFICACION
-- Justificativo de una novedad presentado por el colaborador y revisado por su jefatura o RRHH.
CREATE TABLE SOLICITUDES_JUSTIFICACION (
    id_solicitud UUID NOT NULL DEFAULT gen_random_uuid(),
    id_novedad UUID NOT NULL,
    id_empleado UUID NOT NULL,
    id_motivo_justificacion SMALLINT NOT NULL,
    descripcion varchar(500) NULL,
    id_estado_justificacion SMALLINT NOT NULL DEFAULT 1,
    id_revisor UUID NULL,
    nombre_revisor varchar(150) NULL,
    comentario_revision varchar(500) NULL,
    revisada_en TIMESTAMPTZ NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT SOLICITUDES_JUSTIFICACION_pk PRIMARY KEY (id_solicitud),
    -- Pendiente sin revisión; aprobada o rechazada con revisor y fecha.
    CONSTRAINT chk_justificacion_revision CHECK (
        (id_estado_justificacion = 1) = (revisada_en IS NULL AND id_revisor IS NULL)
    ),
    -- El rechazo exige un comentario.
    CONSTRAINT chk_justificacion_rechazo CHECK (
        id_estado_justificacion <> 3 OR length(btrim(coalesce(comentario_revision, ''))) > 0
    )
);
-- Una novedad tiene a lo sumo una solicitud pendiente o aprobada; las rechazadas quedan como historial.
CREATE UNIQUE INDEX uq_justificacion_novedad_vigente ON SOLICITUDES_JUSTIFICACION (id_novedad)
    WHERE id_estado_justificacion IN (1, 2);
CREATE INDEX idx_justificaciones_empleado ON SOLICITUDES_JUSTIFICACION (id_empleado);
CREATE INDEX idx_justificaciones_estado ON SOLICITUDES_JUSTIFICACION (id_estado_justificacion, creado_en);
-- Tabla: ADJUNTOS_JUSTIFICACION
-- Comprobantes digitales; el archivo se guarda fuera de la BD con la clave indicada.
CREATE TABLE ADJUNTOS_JUSTIFICACION (
    id_adjunto UUID NOT NULL DEFAULT gen_random_uuid(),
    id_solicitud UUID NOT NULL,
    nombre_original varchar(255) NOT NULL,
    tipo_mime varchar(100) NOT NULL,
    tamano_bytes int NOT NULL,
    clave_almacenamiento varchar(255) NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ADJUNTOS_JUSTIFICACION_pk PRIMARY KEY (id_adjunto),
    CONSTRAINT uq_adjunto_clave UNIQUE (clave_almacenamiento),
    CONSTRAINT chk_adjunto_tamano CHECK (tamano_bytes > 0),
    CONSTRAINT chk_adjunto_tipo CHECK (tipo_mime IN ('application/pdf', 'image/jpeg', 'image/png'))
);
CREATE INDEX idx_adjuntos_justificacion_solicitud ON ADJUNTOS_JUSTIFICACION (id_solicitud);
-- Tabla: CATALOGOS_ESTADO_HORAS_EXTRA
CREATE TABLE CATALOGOS_ESTADO_HORAS_EXTRA (
    id_estado_horas_extra SMALLINT NOT NULL,
    codigo varchar(30) NOT NULL,
    nombre varchar(60) NOT NULL,
    CONSTRAINT CATALOGOS_ESTADO_HORAS_EXTRA_pk PRIMARY KEY (id_estado_horas_extra),
    CONSTRAINT uq_estado_horas_extra_codigo UNIQUE (codigo)
);
-- Tabla: FERIADOS
-- Feriados nacionales: lo trabajado en ellos se paga con recargo del 100%.
CREATE TABLE FERIADOS (
    id_feriado UUID NOT NULL DEFAULT gen_random_uuid(),
    fecha date NOT NULL,
    nombre varchar(80) NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FERIADOS_pk PRIMARY KEY (id_feriado),
    CONSTRAINT uq_feriado_fecha UNIQUE (fecha)
);
-- Tabla: PERIODOS_HORAS_EXTRA
-- Cierre de un periodo para planillas: sus jornadas ya no se modifican.
CREATE TABLE PERIODOS_HORAS_EXTRA (
    id_periodo UUID NOT NULL DEFAULT gen_random_uuid(),
    fecha_inicio date NOT NULL,
    fecha_fin date NOT NULL,
    id_responsable UUID NOT NULL,
    nombre_responsable varchar(150) NOT NULL,
    cantidad_jornadas int NOT NULL DEFAULT 0,
    consolidado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT PERIODOS_HORAS_EXTRA_pk PRIMARY KEY (id_periodo),
    CONSTRAINT chk_periodo_horas_fechas CHECK (fecha_fin >= fecha_inicio),
    -- Un día se consolida una sola vez.
    CONSTRAINT ex_periodo_horas_sin_solapamiento EXCLUDE USING gist (daterange(fecha_inicio, fecha_fin, '[]') WITH &&)
);
-- Tabla: AUTORIZACIONES_HORAS_EXTRA
-- Autorización previa del supervisor: cuántos minutos extra puede quedarse un colaborador un día.
CREATE TABLE AUTORIZACIONES_HORAS_EXTRA (
    id_autorizacion UUID NOT NULL DEFAULT gen_random_uuid(),
    id_empleado UUID NOT NULL,
    fecha_jornada date NOT NULL,
    minutos_autorizados int NOT NULL,
    motivo varchar(500) NOT NULL,
    id_autorizador UUID NOT NULL,
    nombre_autorizador varchar(150) NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT AUTORIZACIONES_HORAS_EXTRA_pk PRIMARY KEY (id_autorizacion),
    CONSTRAINT uq_autorizacion_empleado_fecha UNIQUE (id_empleado, fecha_jornada),
    -- Con turno, hasta 2 horas extra; sin turno, la jornada de 8 horas y 2 extra.
    CONSTRAINT chk_autorizacion_minutos CHECK (minutos_autorizados BETWEEN 1 AND 600)
);
CREATE INDEX idx_autorizaciones_horas_extra_fecha ON AUTORIZACIONES_HORAS_EXTRA (fecha_jornada);
-- Tabla: HORAS_JORNADA
-- Jornada marcada separada en horas ordinarias, nocturnas y extra, con la revisión del supervisor.
CREATE TABLE HORAS_JORNADA (
    id_horas_jornada UUID NOT NULL DEFAULT gen_random_uuid(),
    id_empleado UUID NOT NULL,
    fecha_jornada date NOT NULL,
    id_turno UUID NULL,
    id_rol UUID NULL,
    -- Copia del turno programado; NULL si se trabajó sin turno (descanso o día libre).
    nombre_turno varchar(60) NULL,
    inicio_programado TIMESTAMPTZ NULL,
    fin_programado TIMESTAMPTZ NULL,
    minutos_refrigerio SMALLINT NOT NULL DEFAULT 0,
    id_marcaje_entrada UUID NOT NULL,
    id_marcaje_salida UUID NOT NULL,
    entrada_en TIMESTAMPTZ NOT NULL,
    salida_en TIMESTAMPTZ NOT NULL,
    -- HABIL, DOMINGO o FERIADO (un feriado en domingo cuenta como domingo).
    tipo_dia varchar(10) NOT NULL DEFAULT 'HABIL',
    minutos_trabajados int NOT NULL DEFAULT 0,
    minutos_ordinarios int NOT NULL DEFAULT 0,
    minutos_ordinarios_nocturnos int NOT NULL DEFAULT 0,
    -- Después del fin del turno (o todo, sin turno): horas extra marcadas en reloj.
    minutos_extra int NOT NULL DEFAULT 0,
    -- Antes del inicio del turno: solo se paga si se aprueba.
    minutos_anticipados int NOT NULL DEFAULT 0,
    id_estado_horas_extra SMALLINT NOT NULL DEFAULT 1,
    minutos_extra_aprobados int NULL,
    -- Lo que se paga según lo aprobado, separado por tipo de día. Las extra no pasan de 2 horas por día.
    minutos_extra_habil int NOT NULL DEFAULT 0,
    minutos_extra_domingo int NOT NULL DEFAULT 0,
    minutos_extra_feriado int NOT NULL DEFAULT 0,
    -- Tiempo ordinario trabajado en domingo o feriado.
    minutos_domingo int NOT NULL DEFAULT 0,
    minutos_feriado int NOT NULL DEFAULT 0,
    -- Sin turno en día hábil: las primeras 8 horas aprobadas.
    minutos_descanso int NOT NULL DEFAULT 0,
    minutos_extra_nocturnos int NOT NULL DEFAULT 0,
    minutos_nocturnos int NOT NULL DEFAULT 0,
    -- Autorización previa aplicada al calcular (aprobación automática hasta lo autorizado).
    id_autorizacion UUID NULL,
    id_revisor UUID NULL,
    nombre_revisor varchar(150) NULL,
    comentario_revision varchar(500) NULL,
    revisada_en TIMESTAMPTZ NULL,
    id_periodo UUID NULL,
    calculada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT HORAS_JORNADA_pk PRIMARY KEY (id_horas_jornada),
    CONSTRAINT uq_horas_jornada_empleado_fecha UNIQUE (id_empleado, fecha_jornada),
    CONSTRAINT chk_horas_jornada_marcajes CHECK (salida_en >= entrada_en),
    CONSTRAINT chk_horas_jornada_turno CHECK ((inicio_programado IS NULL) = (fin_programado IS NULL)),
    CONSTRAINT chk_horas_jornada_tipo_dia CHECK (tipo_dia IN ('HABIL', 'DOMINGO', 'FERIADO')),
    CONSTRAINT chk_horas_jornada_minutos CHECK (
        minutos_trabajados >= 0 AND minutos_ordinarios >= 0 AND minutos_ordinarios_nocturnos >= 0
        AND minutos_extra >= 0 AND minutos_anticipados >= 0 AND minutos_domingo >= 0 AND minutos_feriado >= 0
        AND minutos_descanso >= 0 AND minutos_extra_nocturnos >= 0 AND minutos_nocturnos >= 0
    ),
    -- Ley General del Trabajo, art. 50: hasta 2 horas extra por día.
    CONSTRAINT chk_horas_jornada_extra_dia CHECK (
        minutos_extra_habil >= 0 AND minutos_extra_domingo >= 0 AND minutos_extra_feriado >= 0
        AND minutos_extra_habil + minutos_extra_domingo + minutos_extra_feriado <= 120
    ),
    CONSTRAINT chk_horas_jornada_aprobados CHECK (
        minutos_extra_aprobados IS NULL OR minutos_extra_aprobados BETWEEN 0 AND minutos_extra + minutos_anticipados
    ),
    -- Revisada a mano: con revisor y fecha.
    CONSTRAINT chk_horas_jornada_revision CHECK ((revisada_en IS NULL) = (id_revisor IS NULL)),
    -- El rechazo exige un comentario.
    CONSTRAINT chk_horas_jornada_rechazo CHECK (
        id_estado_horas_extra <> 5 OR length(btrim(coalesce(comentario_revision, ''))) > 0
    )
);
CREATE INDEX idx_horas_jornada_fecha ON HORAS_JORNADA (fecha_jornada);
CREATE INDEX idx_horas_jornada_estado ON HORAS_JORNADA (id_estado_horas_extra, fecha_jornada);
CREATE INDEX idx_horas_jornada_id_periodo ON HORAS_JORNADA (id_periodo);
CREATE INDEX idx_horas_jornada_id_turno ON HORAS_JORNADA (id_turno);
CREATE INDEX idx_horas_jornada_id_rol ON HORAS_JORNADA (id_rol);
CREATE INDEX idx_horas_jornada_id_autorizacion ON HORAS_JORNADA (id_autorizacion);
-- llaves foráneas
-- Referencia: TURNOS_CATALOGOS_TIPO_JORNADA (tabla: TURNOS)
ALTER TABLE TURNOS
ADD CONSTRAINT TURNOS_CATALOGOS_TIPO_JORNADA FOREIGN KEY (id_tipo_jornada) REFERENCES CATALOGOS_TIPO_JORNADA (id_tipo_jornada) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Referencia: ASIGNACIONES_TURNO_TURNOS (tabla: ASIGNACIONES_TURNO)
ALTER TABLE ASIGNACIONES_TURNO
ADD CONSTRAINT ASIGNACIONES_TURNO_TURNOS FOREIGN KEY (id_turno) REFERENCES TURNOS (id_turno) ON DELETE RESTRICT NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Referencia: MARCAJES_CATALOGOS_TIPO_MARCAJE (tabla: MARCAJES)
ALTER TABLE MARCAJES
ADD CONSTRAINT MARCAJES_CATALOGOS_TIPO_MARCAJE FOREIGN KEY (id_tipo_marcaje) REFERENCES CATALOGOS_TIPO_MARCAJE (id_tipo_marcaje) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Referencia: MARCAJES_CATALOGOS_ORIGEN_MARCAJE (tabla: MARCAJES)
ALTER TABLE MARCAJES
ADD CONSTRAINT MARCAJES_CATALOGOS_ORIGEN_MARCAJE FOREIGN KEY (id_origen_marcaje) REFERENCES CATALOGOS_ORIGEN_MARCAJE (id_origen_marcaje) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Referencia: MARCAJES_CATALOGOS_ESTADO_MARCAJE (tabla: MARCAJES)
ALTER TABLE MARCAJES
ADD CONSTRAINT MARCAJES_CATALOGOS_ESTADO_MARCAJE FOREIGN KEY (id_estado_marcaje) REFERENCES CATALOGOS_ESTADO_MARCAJE (id_estado_marcaje) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Referencia: ROLES_TURNO_CATALOGOS_PERIODO_ROL (tabla: ROLES_TURNO)
ALTER TABLE ROLES_TURNO
ADD CONSTRAINT ROLES_TURNO_CATALOGOS_PERIODO_ROL FOREIGN KEY (id_periodo_rol) REFERENCES CATALOGOS_PERIODO_ROL (id_periodo_rol) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Referencia: ROLES_TURNO_CATALOGOS_ESTADO_ROL (tabla: ROLES_TURNO)
ALTER TABLE ROLES_TURNO
ADD CONSTRAINT ROLES_TURNO_CATALOGOS_ESTADO_ROL FOREIGN KEY (id_estado_rol) REFERENCES CATALOGOS_ESTADO_ROL (id_estado_rol) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Referencia: ASIGNACIONES_ROL_TURNO_ROLES_TURNO (tabla: ASIGNACIONES_ROL_TURNO)
ALTER TABLE ASIGNACIONES_ROL_TURNO
ADD CONSTRAINT ASIGNACIONES_ROL_TURNO_ROLES_TURNO FOREIGN KEY (id_rol) REFERENCES ROLES_TURNO (id_rol) ON DELETE CASCADE NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Referencia: ASIGNACIONES_ROL_TURNO_TURNOS (tabla: ASIGNACIONES_ROL_TURNO)
ALTER TABLE ASIGNACIONES_ROL_TURNO
ADD CONSTRAINT ASIGNACIONES_ROL_TURNO_TURNOS FOREIGN KEY (id_turno) REFERENCES TURNOS (id_turno) ON DELETE RESTRICT NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Referencia: TURNOS_PUBLICADOS_ROLES_TURNO (tabla: TURNOS_PUBLICADOS)
ALTER TABLE TURNOS_PUBLICADOS
ADD CONSTRAINT TURNOS_PUBLICADOS_ROLES_TURNO FOREIGN KEY (id_rol) REFERENCES ROLES_TURNO (id_rol) ON DELETE RESTRICT NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Referencia: TURNOS_PUBLICADOS_TURNOS (tabla: TURNOS_PUBLICADOS)
ALTER TABLE TURNOS_PUBLICADOS
ADD CONSTRAINT TURNOS_PUBLICADOS_TURNOS FOREIGN KEY (id_turno) REFERENCES TURNOS (id_turno) ON DELETE RESTRICT NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Referencia: EVENTOS_SALIENTES_CATALOGOS_ESTADO_EVENTO (tabla: EVENTOS_SALIENTES)
ALTER TABLE EVENTOS_SALIENTES
ADD CONSTRAINT EVENTOS_SALIENTES_CATALOGOS_ESTADO_EVENTO FOREIGN KEY (id_estado_evento) REFERENCES CATALOGOS_ESTADO_EVENTO (id_estado_evento) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Referencia: NOVEDADES_ASISTENCIA_CATALOGOS_TIPO_NOVEDAD (tabla: NOVEDADES_ASISTENCIA)
ALTER TABLE NOVEDADES_ASISTENCIA
ADD CONSTRAINT NOVEDADES_ASISTENCIA_CATALOGOS_TIPO_NOVEDAD FOREIGN KEY (id_tipo_novedad) REFERENCES CATALOGOS_TIPO_NOVEDAD (id_tipo_novedad) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Referencia: NOVEDADES_ASISTENCIA_CATALOGOS_ESTADO_NOVEDAD (tabla: NOVEDADES_ASISTENCIA)
ALTER TABLE NOVEDADES_ASISTENCIA
ADD CONSTRAINT NOVEDADES_ASISTENCIA_CATALOGOS_ESTADO_NOVEDAD FOREIGN KEY (id_estado_novedad) REFERENCES CATALOGOS_ESTADO_NOVEDAD (id_estado_novedad) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Referencia: NOVEDADES_ASISTENCIA_TURNOS (tabla: NOVEDADES_ASISTENCIA)
ALTER TABLE NOVEDADES_ASISTENCIA
ADD CONSTRAINT NOVEDADES_ASISTENCIA_TURNOS FOREIGN KEY (id_turno) REFERENCES TURNOS (id_turno) ON DELETE SET NULL NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Referencia: NOVEDADES_ASISTENCIA_ROLES_TURNO (tabla: NOVEDADES_ASISTENCIA)
ALTER TABLE NOVEDADES_ASISTENCIA
ADD CONSTRAINT NOVEDADES_ASISTENCIA_ROLES_TURNO FOREIGN KEY (id_rol) REFERENCES ROLES_TURNO (id_rol) ON DELETE RESTRICT NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Referencia: NOVEDADES_ASISTENCIA_MARCAJES (tabla: NOVEDADES_ASISTENCIA)
ALTER TABLE NOVEDADES_ASISTENCIA
ADD CONSTRAINT NOVEDADES_ASISTENCIA_MARCAJES FOREIGN KEY (id_marcaje) REFERENCES MARCAJES (id_marcaje) ON DELETE RESTRICT NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Referencia: SOLICITUDES_JUSTIFICACION_NOVEDADES_ASISTENCIA (tabla: SOLICITUDES_JUSTIFICACION)
ALTER TABLE SOLICITUDES_JUSTIFICACION
ADD CONSTRAINT SOLICITUDES_JUSTIFICACION_NOVEDADES_ASISTENCIA FOREIGN KEY (id_novedad) REFERENCES NOVEDADES_ASISTENCIA (id_novedad) ON DELETE RESTRICT NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Referencia: SOLICITUDES_JUSTIFICACION_CATALOGOS_MOTIVO_JUSTIFICACION (tabla: SOLICITUDES_JUSTIFICACION)
ALTER TABLE SOLICITUDES_JUSTIFICACION
ADD CONSTRAINT SOLICITUDES_JUSTIFICACION_CATALOGOS_MOTIVO_JUSTIFICACION FOREIGN KEY (id_motivo_justificacion) REFERENCES CATALOGOS_MOTIVO_JUSTIFICACION (id_motivo_justificacion) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Referencia: SOLICITUDES_JUSTIFICACION_CATALOGOS_ESTADO_JUSTIFICACION (tabla: SOLICITUDES_JUSTIFICACION)
ALTER TABLE SOLICITUDES_JUSTIFICACION
ADD CONSTRAINT SOLICITUDES_JUSTIFICACION_CATALOGOS_ESTADO_JUSTIFICACION FOREIGN KEY (id_estado_justificacion) REFERENCES CATALOGOS_ESTADO_JUSTIFICACION (id_estado_justificacion) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Referencia: ADJUNTOS_JUSTIFICACION_SOLICITUDES_JUSTIFICACION (tabla: ADJUNTOS_JUSTIFICACION)
ALTER TABLE ADJUNTOS_JUSTIFICACION
ADD CONSTRAINT ADJUNTOS_JUSTIFICACION_SOLICITUDES_JUSTIFICACION FOREIGN KEY (id_solicitud) REFERENCES SOLICITUDES_JUSTIFICACION (id_solicitud) ON DELETE CASCADE NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Referencia: HORAS_JORNADA_CATALOGOS_ESTADO_HORAS_EXTRA (tabla: HORAS_JORNADA)
ALTER TABLE HORAS_JORNADA
ADD CONSTRAINT HORAS_JORNADA_CATALOGOS_ESTADO_HORAS_EXTRA FOREIGN KEY (id_estado_horas_extra) REFERENCES CATALOGOS_ESTADO_HORAS_EXTRA (id_estado_horas_extra) NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Referencia: HORAS_JORNADA_TURNOS (tabla: HORAS_JORNADA)
ALTER TABLE HORAS_JORNADA
ADD CONSTRAINT HORAS_JORNADA_TURNOS FOREIGN KEY (id_turno) REFERENCES TURNOS (id_turno) ON DELETE SET NULL NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Referencia: HORAS_JORNADA_ROLES_TURNO (tabla: HORAS_JORNADA)
ALTER TABLE HORAS_JORNADA
ADD CONSTRAINT HORAS_JORNADA_ROLES_TURNO FOREIGN KEY (id_rol) REFERENCES ROLES_TURNO (id_rol) ON DELETE RESTRICT NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Referencia: HORAS_JORNADA_MARCAJES_ENTRADA (tabla: HORAS_JORNADA)
ALTER TABLE HORAS_JORNADA
ADD CONSTRAINT HORAS_JORNADA_MARCAJES_ENTRADA FOREIGN KEY (id_marcaje_entrada) REFERENCES MARCAJES (id_marcaje) ON DELETE RESTRICT NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Referencia: HORAS_JORNADA_MARCAJES_SALIDA (tabla: HORAS_JORNADA)
ALTER TABLE HORAS_JORNADA
ADD CONSTRAINT HORAS_JORNADA_MARCAJES_SALIDA FOREIGN KEY (id_marcaje_salida) REFERENCES MARCAJES (id_marcaje) ON DELETE RESTRICT NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Referencia: HORAS_JORNADA_AUTORIZACIONES_HORAS_EXTRA (tabla: HORAS_JORNADA)
ALTER TABLE HORAS_JORNADA
ADD CONSTRAINT HORAS_JORNADA_AUTORIZACIONES_HORAS_EXTRA FOREIGN KEY (id_autorizacion) REFERENCES AUTORIZACIONES_HORAS_EXTRA (id_autorizacion) ON DELETE SET NULL NOT DEFERRABLE INITIALLY IMMEDIATE;
-- Referencia: HORAS_JORNADA_PERIODOS_HORAS_EXTRA (tabla: HORAS_JORNADA)
ALTER TABLE HORAS_JORNADA
ADD CONSTRAINT HORAS_JORNADA_PERIODOS_HORAS_EXTRA FOREIGN KEY (id_periodo) REFERENCES PERIODOS_HORAS_EXTRA (id_periodo) ON DELETE RESTRICT NOT DEFERRABLE INITIALLY IMMEDIATE;
-- datos iniciales
INSERT INTO CATALOGOS_TIPO_JORNADA (id_tipo_jornada, codigo, nombre) VALUES
    (1, 'DIURNO', 'Diurno'),
    (2, 'VESPERTINO', 'Vespertino'),
    (3, 'NOCTURNO', 'Nocturno');
INSERT INTO CATALOGOS_TIPO_MARCAJE (id_tipo_marcaje, codigo, nombre) VALUES
    (1, 'ENTRADA', 'Entrada'),
    (2, 'SALIDA', 'Salida');
INSERT INTO CATALOGOS_ORIGEN_MARCAJE (id_origen_marcaje, codigo, nombre) VALUES
    (1, 'PORTAL', 'Portal'),
    (2, 'BIOMETRICO', 'Biométrico');
INSERT INTO CATALOGOS_ESTADO_MARCAJE (id_estado_marcaje, codigo, nombre) VALUES
    (1, 'REGISTRADO', 'Registrado'),
    (2, 'PENDIENTE_JUSTIFICACION', 'Pendiente de justificación');
INSERT INTO CATALOGOS_PERIODO_ROL (id_periodo_rol, codigo, nombre) VALUES
    (1, 'SEMANAL', 'Semanal'),
    (2, 'MENSUAL', 'Mensual');
INSERT INTO CATALOGOS_ESTADO_ROL (id_estado_rol, codigo, nombre) VALUES
    (1, 'BORRADOR', 'Borrador'),
    (2, 'PUBLICADO', 'Publicado');
INSERT INTO CATALOGOS_ESTADO_EVENTO (id_estado_evento, codigo, nombre) VALUES
    (1, 'PENDIENTE', 'Pendiente'),
    (2, 'ENTREGADO', 'Entregado'),
    (3, 'FALLIDO', 'Fallido');
INSERT INTO CATALOGOS_TIPO_NOVEDAD (id_tipo_novedad, codigo, nombre, es_justificable) VALUES
    (1, 'ATRASO', 'Atraso', TRUE),
    (2, 'INASISTENCIA', 'Falta injustificada', TRUE),
    (3, 'SALIDA_ANTICIPADA', 'Salida anticipada', TRUE),
    (4, 'OMISION_SALIDA', 'Omisión de marcaje de salida', FALSE);
INSERT INTO CATALOGOS_ESTADO_NOVEDAD (id_estado_novedad, codigo, nombre) VALUES
    (1, 'REGISTRADA', 'Registrada'),
    (2, 'JUSTIFICADA', 'Justificada');
INSERT INTO CATALOGOS_MOTIVO_JUSTIFICACION (id_motivo_justificacion, codigo, nombre) VALUES
    (1, 'SALUD', 'Salud o atención médica'),
    (2, 'EMERGENCIA_FAMILIAR', 'Emergencia familiar'),
    (3, 'TRAMITE', 'Trámite personal o legal'),
    (4, 'TRANSPORTE', 'Problema de transporte'),
    (5, 'OTRO', 'Otro motivo');
INSERT INTO CATALOGOS_ESTADO_JUSTIFICACION (id_estado_justificacion, codigo, nombre) VALUES
    (1, 'PENDIENTE', 'Pendiente de revisión'),
    (2, 'APROBADA', 'Aprobada'),
    (3, 'RECHAZADA', 'Rechazada');
INSERT INTO CATALOGOS_ESTADO_HORAS_EXTRA (id_estado_horas_extra, codigo, nombre) VALUES
    (1, 'SIN_EXTRA', 'Sin horas extra'),
    (2, 'PENDIENTE', 'Pendiente de revisión'),
    (3, 'APROBADA', 'Aprobada'),
    (4, 'AJUSTADA', 'Aprobada con ajuste'),
    (5, 'RECHAZADA', 'Rechazada');
-- Feriados nacionales de Bolivia 2026 y 2027.
INSERT INTO FERIADOS (fecha, nombre) VALUES
    ('2026-01-01', 'Año Nuevo'),
    ('2026-01-22', 'Día del Estado Plurinacional'),
    ('2026-02-16', 'Carnaval'),
    ('2026-02-17', 'Carnaval'),
    ('2026-04-03', 'Viernes Santo'),
    ('2026-05-01', 'Día del Trabajo'),
    ('2026-06-04', 'Corpus Christi'),
    ('2026-06-21', 'Año Nuevo Andino Amazónico'),
    ('2026-08-06', 'Día de la Independencia'),
    ('2026-11-02', 'Todos Santos'),
    ('2026-12-25', 'Navidad'),
    ('2027-01-01', 'Año Nuevo'),
    ('2027-01-22', 'Día del Estado Plurinacional'),
    ('2027-02-08', 'Carnaval'),
    ('2027-02-09', 'Carnaval'),
    ('2027-03-26', 'Viernes Santo'),
    ('2027-05-01', 'Día del Trabajo'),
    ('2027-05-27', 'Corpus Christi'),
    ('2027-06-21', 'Año Nuevo Andino Amazónico'),
    ('2027-08-06', 'Día de la Independencia'),
    ('2027-11-02', 'Todos Santos'),
    ('2027-12-25', 'Navidad');
-- Fin del archivo.
