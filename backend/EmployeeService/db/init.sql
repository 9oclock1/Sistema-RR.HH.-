-- KAN-100 (RF-17.1) - Catalogo de cargos y relación con areas
CREATE TABLE IF NOT EXISTS departamentos (
    id      SERIAL PRIMARY KEY,
    nombre  VARCHAR(100) NOT NULL,
    codigo  VARCHAR(20)  UNIQUE,
    estado  BOOLEAN      NOT NULL DEFAULT TRUE
);

-- catalogo de cargos
CREATE TABLE IF NOT EXISTS cargos (
    id                  SERIAL PRIMARY KEY,
    nombre              VARCHAR(100)   NOT NULL,                        
    nivel_salarial      NUMERIC(12,2)  NOT NULL CHECK (nivel_salarial >= 0), 
    funciones_clave     TEXT,
    perfil_requerido    TEXT,
    area_id             INTEGER REFERENCES departamentos(id)
                            ON UPDATE CASCADE ON DELETE RESTRICT,    
    activo              BOOLEAN        NOT NULL DEFAULT TRUE,        
    fecha_modificacion  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),        
    created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cargos_area_id ON cargos (area_id);

--pruebas
INSERT INTO departamentos (nombre, codigo) VALUES
    ('Cajas',          'CAJ'),
    ('Almacén',        'ALM'),
    ('Panadería',      'PAN'),
    ('Administración', 'ADM')
ON CONFLICT (codigo) DO NOTHING;