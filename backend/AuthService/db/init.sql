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
