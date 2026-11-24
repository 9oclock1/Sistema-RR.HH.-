-- AuthDB: cuentas de acceso al portal de RRHH.

-- Tabla: USUARIOS
-- Cuenta con la que un colaborador inicia sesión. id_empleado referencia a EMPLEADOS (EmployeeDB): sin FK por ser
-- otro servicio. hash_contrasena: scrypt con sal propia, en el formato scrypt$<sal>$<clave> (hexadecimal).
-- esta_activo = FALSE bloquea el inicio de sesión y las sesiones ya abiertas.
CREATE TABLE USUARIOS (
    id_usuario UUID NOT NULL DEFAULT gen_random_uuid(),
    id_empleado UUID NOT NULL,
    correo varchar(120) NOT NULL,
    hash_contrasena varchar(200) NOT NULL,
    rol varchar(20) NOT NULL,
    esta_activo boolean NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT USUARIOS_pk PRIMARY KEY (id_usuario),
    CONSTRAINT uq_usuario_empleado UNIQUE (id_empleado),
    CONSTRAINT uq_usuario_correo UNIQUE (correo),
    CONSTRAINT chk_usuario_rol CHECK (rol IN ('admin', 'gerente', 'reclutador', 'supervisor', 'empleado', 'auditor', 'contador')),
    CONSTRAINT chk_usuario_correo CHECK (correo = lower(correo) AND correo ~ '^[^@ ]+@[^@ ]+$'),
    CONSTRAINT chk_usuario_hash CHECK (hash_contrasena ~ '^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$')
);

-- Tabla: REVOCACIONES_ACCESO
-- Registro de cada revocación de credenciales del colaborador (KAN-79). id_usuario puede ser NULL si el
-- colaborador nunca tuvo cuenta; todo JWT con iat anterior a revocado_en queda invalidado.
CREATE TABLE REVOCACIONES_ACCESO (
    id_revocacion UUID NOT NULL DEFAULT gen_random_uuid(),
    id_empleado UUID NOT NULL,
    id_usuario UUID NULL,
    motivo varchar(40) NOT NULL,
    id_proceso UUID NULL,
    solicitado_por UUID NULL,
    revocado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT REVOCACIONES_ACCESO_pk PRIMARY KEY (id_revocacion),
    CONSTRAINT fk_revocacion_usuario FOREIGN KEY (id_usuario) REFERENCES USUARIOS (id_usuario),
    CONSTRAINT chk_revocacion_motivo CHECK (motivo IN ('DESVINCULACION'))
);
CREATE INDEX idx_revocaciones_empleado_fecha ON REVOCACIONES_ACCESO (id_empleado, revocado_en DESC);
