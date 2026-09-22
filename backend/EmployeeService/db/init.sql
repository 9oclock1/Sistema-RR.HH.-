CREATE TABLE IF NOT EXISTS sucursales (
    id_sucursal      SERIAL PRIMARY KEY,
    nombre           VARCHAR(100) NOT NULL,
    direccion        VARCHAR(255),
    ciudad           VARCHAR(100),
    activa           BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_apertura   DATE
);

CREATE TABLE IF NOT EXISTS departamentos (
    id_departamento       SERIAL PRIMARY KEY,
    codigo                VARCHAR(20) UNIQUE,
    nombre                VARCHAR(100) NOT NULL,
    tipo                  VARCHAR(30) NOT NULL DEFAULT 'departamento' CHECK (tipo IN ('departamento', 'seccion_operativa')),
    id_departamento_padre INTEGER REFERENCES departamentos(id_departamento),
    id_sucursal           INTEGER REFERENCES sucursales(id_sucursal),
    descripcion           TEXT,
    activo                BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion        TIMESTAMP NOT NULL DEFAULT now(),
    fecha_baja            TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_departamentos_padre ON departamentos(id_departamento_padre);
CREATE INDEX IF NOT EXISTS idx_departamentos_sucursal ON departamentos(id_sucursal);

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
    fecha_modificacion  TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cargos_superior ON cargos(id_cargo_superior);
CREATE INDEX IF NOT EXISTS idx_cargos_departamento ON cargos(id_departamento);

CREATE TABLE IF NOT EXISTS funciones_cargo (
    id_funcion      SERIAL PRIMARY KEY,
    id_cargo        INTEGER NOT NULL REFERENCES cargos(id_cargo) ON DELETE CASCADE,
    descripcion     TEXT NOT NULL,
    orden           SMALLINT DEFAULT 1
);

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

--pruebas
INSERT INTO sucursales (nombre, activa) 
VALUES ('Sede Central', true);

INSERT INTO departamentos (codigo, nombre, id_sucursal, activo) 
VALUES 
    ('ADM', 'Administración', 1, true),
    ('VEN', 'Ventas', 1, true);

INSERT INTO niveles_salariales (nombre, salario_base, salario_max) 
VALUES 
    ('Nivel 1 - Operativo', 2500, 3500),
    ('Nivel 2 - Técnico', 3500, 5500),
    ('Nivel 3 - Jefatura', 5500, 8500);