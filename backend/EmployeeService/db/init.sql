-- ============================================================
-- EmployeeService — init.sql
-- Se ejecuta automáticamente por el contenedor 'postgres' la
-- primera vez que levanta (docker-entrypoint-initdb.d), siempre
-- que el volumen de datos esté vacío.
-- EmployeeService — Esquema de Organización Estructural
-- Cubre RF-16, RF-17, RF-18, RF-19, RF-20
-- Consolidado: Regina (RF-16) + Ian (RF-17) + validaciones
-- ============================================================

-- ------------------------------------------------------------
-- 0. SUCURSALES (necesarias para RF-19)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sucursales (
    id_sucursal      SERIAL PRIMARY KEY,
    nombre           VARCHAR(100) NOT NULL,
    direccion        VARCHAR(255),
    ciudad           VARCHAR(100),
    activa           BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_apertura   DATE
);

-- ------------------------------------------------------------
-- RF-16: Gestión de áreas y departamentos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departamentos (
    id_departamento       SERIAL PRIMARY KEY,
    codigo                VARCHAR(20) UNIQUE,
    nombre                VARCHAR(100) NOT NULL,
    tipo                  VARCHAR(30) NOT NULL DEFAULT 'departamento'
                          CHECK (tipo IN ('departamento', 'seccion_operativa')),
    id_departamento_padre INTEGER REFERENCES departamentos(id_departamento),
    id_sucursal           INTEGER REFERENCES sucursales(id_sucursal),
    descripcion           TEXT,
    activo                BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion        TIMESTAMP NOT NULL DEFAULT now(),
    fecha_baja            TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_departamentos_padre ON departamentos(id_departamento_padre);
CREATE INDEX IF NOT EXISTS idx_departamentos_sucursal ON departamentos(id_sucursal);

-- ------------------------------------------------------------
-- RF-17: Gestión del catálogo de cargos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS niveles_salariales (
    id_nivel        SERIAL PRIMARY KEY,
    nombre          VARCHAR(50) NOT NULL,
    salario_base    NUMERIC(10,2) NOT NULL,
    salario_max     NUMERIC(10,2)
);

CREATE TABLE IF NOT EXISTS cargos (
    id_cargo            SERIAL PRIMARY KEY,
    nombre              VARCHAR(100) NOT NULL,
    id_nivel_salarial   INTEGER NOT NULL REFERENCES niveles_salariales(id_nivel),
    id_departamento     INTEGER REFERENCES departamentos(id_departamento),
    perfil_requerido    TEXT,
    id_cargo_superior   INTEGER REFERENCES cargos(id_cargo),
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion      TIMESTAMP NOT NULL DEFAULT now(),
    fecha_modificacion  TIMESTAMP NOT NULL DEFAULT now() -- Criterio 2, KAN-102
);

CREATE INDEX IF NOT EXISTS idx_cargos_superior ON cargos(id_cargo_superior);
CREATE INDEX IF NOT EXISTS idx_cargos_departamento ON cargos(id_departamento);

CREATE TABLE IF NOT EXISTS funciones_cargo (
    id_funcion      SERIAL PRIMARY KEY,
    id_cargo        INTEGER NOT NULL REFERENCES cargos(id_cargo) ON DELETE CASCADE,
    descripcion     TEXT NOT NULL,
    orden           SMALLINT DEFAULT 1
);

-- Trigger KAN-102: actualizar fecha_modificacion al cambiar el nivel salarial
CREATE OR REPLACE FUNCTION fn_actualizar_fecha_modificacion_cargo()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.id_nivel_salarial IS DISTINCT FROM OLD.id_nivel_salarial THEN
        NEW.fecha_modificacion = now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cargos_fecha_modificacion ON cargos;
CREATE TRIGGER trg_cargos_fecha_modificacion
    BEFORE UPDATE ON cargos
    FOR EACH ROW
    EXECUTE FUNCTION fn_actualizar_fecha_modificacion_cargo();

-- ------------------------------------------------------------
-- RF-18: Jerarquías y dependencias (tipo de supervisión, opcional)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS relaciones_supervision (
    id_relacion          SERIAL PRIMARY KEY,
    id_cargo_subordinado INTEGER NOT NULL REFERENCES cargos(id_cargo),
    id_cargo_supervisor  INTEGER NOT NULL REFERENCES cargos(id_cargo),
    tipo_relacion        VARCHAR(30) NOT NULL DEFAULT 'directa'
                          CHECK (tipo_relacion IN ('directa', 'funcional', 'matricial')),
    UNIQUE (id_cargo_subordinado, id_cargo_supervisor, tipo_relacion)
);

-- ------------------------------------------------------------
-- Empleados
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS empleados (
    id_empleado     SERIAL PRIMARY KEY,
    nombres         VARCHAR(100) NOT NULL,
    apellidos       VARCHAR(100) NOT NULL,
    ci              VARCHAR(20) UNIQUE NOT NULL,
    email           VARCHAR(150) UNIQUE,
    telefono        VARCHAR(20),
    fecha_ingreso   DATE NOT NULL DEFAULT CURRENT_DATE,
    activo          BOOLEAN NOT NULL DEFAULT TRUE
);

-- ------------------------------------------------------------
-- RF-19: Asignación de empleado a cargo y sucursal
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asignaciones_empleado (
    id_asignacion       SERIAL PRIMARY KEY,
    id_empleado         INTEGER NOT NULL REFERENCES empleados(id_empleado),
    id_cargo            INTEGER NOT NULL REFERENCES cargos(id_cargo),
    id_departamento     INTEGER REFERENCES departamentos(id_departamento),
    id_sucursal         INTEGER NOT NULL REFERENCES sucursales(id_sucursal),
    fecha_inicio        DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_fin           DATE,
    es_vigente          BOOLEAN NOT NULL DEFAULT TRUE,
    motivo_cambio       VARCHAR(150)
);

CREATE INDEX IF NOT EXISTS idx_asignaciones_empleado ON asignaciones_empleado(id_empleado);
CREATE INDEX IF NOT EXISTS idx_asignaciones_vigentes ON asignaciones_empleado(es_vigente) WHERE es_vigente = TRUE;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'uq_una_asignacion_vigente'
    ) THEN
        CREATE UNIQUE INDEX uq_una_asignacion_vigente
            ON asignaciones_empleado(id_empleado)
            WHERE es_vigente = TRUE;
    END IF;
END $$;

-- ------------------------------------------------------------
-- RF-16, criterios 3 y 4: validar baja de un departamento
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validar_baja_departamento()
RETURNS TRIGGER AS $$
DECLARE
    v_cargos_activos     INTEGER;
    v_empleados_vigentes INTEGER;
BEGIN
    IF OLD.activo = TRUE AND NEW.activo = FALSE THEN

        SELECT COUNT(*) INTO v_cargos_activos
        FROM cargos
        WHERE id_departamento = OLD.id_departamento AND activo = TRUE;

        SELECT COUNT(*) INTO v_empleados_vigentes
        FROM asignaciones_empleado
        WHERE id_departamento = OLD.id_departamento AND es_vigente = TRUE;

        IF v_cargos_activos > 0 OR v_empleados_vigentes > 0 THEN
            RAISE EXCEPTION
                'No se puede dar de baja el área "%": tiene % cargo(s) activo(s) y % empleado(s) asignado(s).',
                OLD.nombre, v_cargos_activos, v_empleados_vigentes
                USING ERRCODE = 'check_violation';
        END IF;

        NEW.fecha_baja := now();
    END IF;

    IF OLD.activo = FALSE AND NEW.activo = TRUE THEN
        NEW.fecha_baja := NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_baja_departamento ON departamentos;
CREATE TRIGGER trg_validar_baja_departamento
    BEFORE UPDATE ON departamentos
    FOR EACH ROW
    EXECUTE FUNCTION fn_validar_baja_departamento();

-- ------------------------------------------------------------
-- Vistas de apoyo
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW vista_departamentos_activos AS
SELECT id_departamento, codigo, nombre, tipo, id_departamento_padre, id_sucursal, descripcion
FROM departamentos
WHERE activo = TRUE
ORDER BY nombre;

-- RF-20: Organigrama completo (recursivo)
CREATE OR REPLACE VIEW vista_organigrama AS
WITH RECURSIVE arbol_cargos AS (
    SELECT
        c.id_cargo,
        c.nombre            AS cargo,
        c.id_cargo_superior,
        c.id_departamento,
        1                   AS nivel,
        ARRAY[c.id_cargo]   AS ruta
    FROM cargos c
    WHERE c.id_cargo_superior IS NULL
      AND c.activo = TRUE

    UNION ALL

    SELECT
        c.id_cargo,
        c.nombre,
        c.id_cargo_superior,
        c.id_departamento,
        a.nivel + 1,
        a.ruta || c.id_cargo
    FROM cargos c
    JOIN arbol_cargos a ON c.id_cargo_superior = a.id_cargo
    WHERE c.activo = TRUE
)
SELECT
    a.id_cargo,
    a.cargo,
    a.id_cargo_superior,
    d.nombre AS departamento,
    a.nivel,
    a.ruta,
    e.id_empleado,
    e.nombres || ' ' || e.apellidos AS empleado_actual,
    s.nombre AS sucursal
FROM arbol_cargos a
LEFT JOIN departamentos d ON d.id_departamento = a.id_departamento
LEFT JOIN asignaciones_empleado ae
    ON ae.id_cargo = a.id_cargo AND ae.es_vigente = TRUE
LEFT JOIN empleados e ON e.id_empleado = ae.id_empleado
LEFT JOIN sucursales s ON s.id_sucursal = ae.id_sucursal
ORDER BY a.ruta;

-- Ejemplos de uso:
-- SELECT * FROM vista_organigrama WHERE sucursal = 'Sucursal Central';
-- UPDATE departamentos SET activo = FALSE WHERE id_departamento = <id>;  -- prueba criterios 3/4