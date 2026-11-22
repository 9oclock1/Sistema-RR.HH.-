-- Datos de prueba de EmployeeDB (personal, cargos y jerarquía de una cadena de supermercados).
-- Requiere init.sql, que se carga solo al crear la base. Es SQL puro: se puede correr desde SQLTools, DBeaver o psql.
-- Los ids coinciden con los de PerformanceService/db/seed.sql para que ambos servicios hablen de las mismas personas.
-- Se puede ejecutar varias veces: lo que ya existe no se duplica.
--   Get-Content backend/EmployeeService/db/seed.sql | docker exec -i rrhh-postgres psql -U adminRRHH -d EmployeeDB
--
-- Qué queda cargado:
--   Áreas:      Atención al cliente, Recursos Humanos.
--   Sucursales: Sopocachi y Miraflores.
--   Jerarquía:  Atención: Cajero -> Supervisor de Cajas -> Jefe de Atención; Asesor de Atención -> Jefe de Atención.
--               RRHH: Analista -> Jefe de RRHH.
--   Cada sucursal tiene su jefe y su supervisor de cajas, así el evaluador de cada ciclo sale de la misma sucursal.
--   Marcela Quiroga (jefa en Sopocachi) y Jorge Mamani (jefe en Miraflores) sirven como usuarios de prueba.
--   RRHH solo tiene jefe y analista en Sopocachi: si se programa un ciclo para RRHH en Miraflores se ve el caso
--   "sin evaluador en la sucursal". Elena Paredes está dada de baja y nunca entra a un ciclo.
BEGIN;
INSERT INTO ESTADOS_EMPLEADO (id_estado_empleado, codigo, nombre, permite_acceso) VALUES
  (1, 'ACTIVO', 'Activo', TRUE),
  (2, 'VACACIONES', 'De vacaciones', TRUE),
  (3, 'SUSPENDIDO', 'Suspendido', FALSE),
  (4, 'BAJA', 'Baja', FALSE)
ON CONFLICT DO NOTHING;
INSERT INTO TIPOS_CONTRATO (id_tipo_contrato, codigo, nombre) VALUES
  (1, 'INDEFINIDO', 'Contrato indefinido'),
  (2, 'PLAZO_FIJO', 'Contrato a plazo fijo')
ON CONFLICT DO NOTHING;
INSERT INTO TIPOS_JORNADA (id_tipo_jornada, codigo, nombre, horas_semanales) VALUES
  (1, 'TIEMPO_COMPLETO', 'Tiempo completo', 48),
  (2, 'MEDIO_TIEMPO', 'Medio tiempo', 24)
ON CONFLICT DO NOTHING;
INSERT INTO DEPARTAMENTOS (id_departamento, codigo, nombre, descripcion) VALUES
  ('f0000000-0000-4000-8000-000000000001', 'ATC', 'Atención al cliente', 'Cajas y atención en sala'),
  ('f0000000-0000-4000-8000-000000000002', 'RRHH', 'Recursos Humanos', 'Gestión del personal')
ON CONFLICT DO NOTHING;
INSERT INTO SUCURSALES (id_sucursal, codigo_sucursal, nombre, direccion, ciudad) VALUES
  ('f0000000-0000-4000-8000-000000000011', 'SUC-SOP', 'Sopocachi', 'Av. 6 de Agosto 2170', 'La Paz'),
  ('f0000000-0000-4000-8000-000000000012', 'SUC-MIR', 'Miraflores', 'Av. Busch 1450', 'La Paz')
ON CONFLICT DO NOTHING;
-- Los cargos se cargan sin superior y luego se enlazan, para no depender del orden.
INSERT INTO CARGOS (id_cargo, id_departamento, codigo, nombre, nivel_salarial, salario_base_referencial, funciones_clave, requisitos_minimos) VALUES
  ('f0000000-0000-4000-8000-000000000101', 'f0000000-0000-4000-8000-000000000002', 'RRHH-JEF', 'Jefe de Recursos Humanos', 'Jefatura', 9500, 'Funciones propias del cargo jefe de recursos humanos.', 'Experiencia previa en el rubro.'),
  ('f0000000-0000-4000-8000-000000000102', 'f0000000-0000-4000-8000-000000000002', 'RRHH-ANA', 'Analista de Recursos Humanos', 'Operativo Medio', 5200, 'Funciones propias del cargo analista de recursos humanos.', 'Experiencia previa en el rubro.'),
  ('f0000000-0000-4000-8000-000000000103', 'f0000000-0000-4000-8000-000000000001', 'ATC-JEF', 'Jefe de Atención al Cliente', 'Jefatura', 8500, 'Funciones propias del cargo jefe de atención al cliente.', 'Experiencia previa en el rubro.'),
  ('f0000000-0000-4000-8000-000000000104', 'f0000000-0000-4000-8000-000000000001', 'ATC-SUP', 'Supervisor de Cajas', 'Operativo Medio', 5800, 'Funciones propias del cargo supervisor de cajas.', 'Experiencia previa en el rubro.'),
  ('f0000000-0000-4000-8000-000000000105', 'f0000000-0000-4000-8000-000000000001', 'ATC-CAJ', 'Cajero', 'Operativo Base', 3200, 'Funciones propias del cargo cajero.', 'Experiencia previa en el rubro.'),
  ('f0000000-0000-4000-8000-000000000106', 'f0000000-0000-4000-8000-000000000001', 'ATC-ASE', 'Asesor de Atención', 'Operativo Base', 3400, 'Funciones propias del cargo asesor de atención.', 'Experiencia previa en el rubro.')
ON CONFLICT DO NOTHING;
UPDATE CARGOS SET id_cargo_jefe_directo = 'f0000000-0000-4000-8000-000000000101' WHERE id_cargo = 'f0000000-0000-4000-8000-000000000102' AND id_cargo_jefe_directo IS NULL;
UPDATE CARGOS SET id_cargo_jefe_directo = 'f0000000-0000-4000-8000-000000000103' WHERE id_cargo = 'f0000000-0000-4000-8000-000000000104' AND id_cargo_jefe_directo IS NULL;
UPDATE CARGOS SET id_cargo_jefe_directo = 'f0000000-0000-4000-8000-000000000104' WHERE id_cargo = 'f0000000-0000-4000-8000-000000000105' AND id_cargo_jefe_directo IS NULL;
UPDATE CARGOS SET id_cargo_jefe_directo = 'f0000000-0000-4000-8000-000000000103' WHERE id_cargo = 'f0000000-0000-4000-8000-000000000106' AND id_cargo_jefe_directo IS NULL;
INSERT INTO EMPLEADOS (id_empleado, numero_documento, nombres, primer_apellido, segundo_apellido, fecha_nacimiento, genero, telefono_celular, correo_personal, direccion_domicilio, fecha_ingreso, id_cargo_actual, id_sucursal_actual, id_estado_empleado) VALUES
  ('f0000000-0000-4000-8000-000000000021', '7102877', 'Marcela', 'Quiroga', 'Peña', '1985-01-15', 'Femenino', '71004431', 'marcela.quiroga@correo.test', 'Zona Sopocachi, La Paz', '2019-03-01', 'f0000000-0000-4000-8000-000000000103', 'f0000000-0000-4000-8000-000000000011', 1),
  ('f0000000-0000-4000-8000-000000000022', '7103014', 'Jorge', 'Mamani', 'Condori', '1986-02-15', 'Masculino', '71004642', 'jorge.mamani@correo.test', 'Zona Miraflores, La Paz', '2020-03-01', 'f0000000-0000-4000-8000-000000000103', 'f0000000-0000-4000-8000-000000000012', 1),
  ('f0000000-0000-4000-8000-000000000023', '7103151', 'Andrea', 'Salazar', 'Vega', '1987-03-15', 'Femenino', '71004853', 'andrea.salazar@correo.test', 'Zona Sopocachi, La Paz', '2021-03-01', 'f0000000-0000-4000-8000-000000000101', 'f0000000-0000-4000-8000-000000000011', 1),
  ('f0000000-0000-4000-8000-000000000024', '7103288', 'Rosa', 'Mendoza', 'Ticona', '1988-04-15', 'Masculino', '71005064', 'rosa.mendoza@correo.test', 'Zona Sopocachi, La Paz', '2022-03-01', 'f0000000-0000-4000-8000-000000000104', 'f0000000-0000-4000-8000-000000000011', 1),
  ('f0000000-0000-4000-8000-000000000025', '7103425', 'Luis', 'Vargas', 'Apaza', '1989-05-15', 'Femenino', '71005275', 'luis.vargas@correo.test', 'Zona Miraflores, La Paz', '2023-03-01', 'f0000000-0000-4000-8000-000000000104', 'f0000000-0000-4000-8000-000000000012', 1),
  ('f0000000-0000-4000-8000-000000000026', '7103562', 'Sofía', 'Condori', 'Mamani', '1990-06-15', 'Masculino', '71005486', 'sofia.condori@correo.test', 'Zona Sopocachi, La Paz', '2024-03-01', 'f0000000-0000-4000-8000-000000000102', 'f0000000-0000-4000-8000-000000000011', 1),
  ('f0000000-0000-4000-8000-000000000031', '7104247', 'Carlos', 'Rojas', 'Vargas', '1991-07-15', 'Femenino', '71006541', 'carlos.rojas@correo.test', 'Zona Sopocachi, La Paz', '2019-03-01', 'f0000000-0000-4000-8000-000000000105', 'f0000000-0000-4000-8000-000000000011', 1),
  ('f0000000-0000-4000-8000-000000000032', '7104384', 'Lucía', 'Flores', 'Choque', '1992-08-15', 'Masculino', '71006752', 'lucia.flores@correo.test', 'Zona Sopocachi, La Paz', '2020-03-01', 'f0000000-0000-4000-8000-000000000105', 'f0000000-0000-4000-8000-000000000011', 1),
  ('f0000000-0000-4000-8000-000000000033', '7104521', 'Diego', 'Quispe', 'Mamani', '1993-09-15', 'Femenino', '71006963', 'diego.quispe@correo.test', 'Zona Miraflores, La Paz', '2021-03-01', 'f0000000-0000-4000-8000-000000000105', 'f0000000-0000-4000-8000-000000000012', 1),
  ('f0000000-0000-4000-8000-000000000034', '7104658', 'Paola', 'Gutiérrez', 'Limachi', '1994-01-15', 'Masculino', '71007174', 'paola.gutierrez@correo.test', 'Zona Miraflores, La Paz', '2022-03-01', 'f0000000-0000-4000-8000-000000000106', 'f0000000-0000-4000-8000-000000000012', 1),
  ('f0000000-0000-4000-8000-000000000035', '7104795', 'Ana', 'Torrez', 'Villca', '1995-02-15', 'Femenino', '71007385', 'ana.torrez@correo.test', 'Zona Miraflores, La Paz', '2023-03-01', 'f0000000-0000-4000-8000-000000000105', 'f0000000-0000-4000-8000-000000000012', 1),
  ('f0000000-0000-4000-8000-000000000036', '7104932', 'Mario', 'Fernández', 'Cruz', '1996-03-15', 'Masculino', '71007596', 'mario.fernandez@correo.test', 'Zona Sopocachi, La Paz', '2024-03-01', 'f0000000-0000-4000-8000-000000000106', 'f0000000-0000-4000-8000-000000000011', 1),
  ('f0000000-0000-4000-8000-000000000037', '7105069', 'Elena', 'Paredes', 'Gómez', '1985-04-15', 'Femenino', '71007807', 'elena.paredes@correo.test', 'Zona Sopocachi, La Paz', '2019-03-01', 'f0000000-0000-4000-8000-000000000105', 'f0000000-0000-4000-8000-000000000011', 4)
ON CONFLICT DO NOTHING;
INSERT INTO ASIGNACIONES_EMPLEADO (id_asignacion, id_empleado, id_cargo, id_sucursal, fecha_inicio) VALUES
  ('f0000000-0000-4000-8000-000000000521', 'f0000000-0000-4000-8000-000000000021', 'f0000000-0000-4000-8000-000000000103', 'f0000000-0000-4000-8000-000000000011', '2019-03-01'),
  ('f0000000-0000-4000-8000-000000000522', 'f0000000-0000-4000-8000-000000000022', 'f0000000-0000-4000-8000-000000000103', 'f0000000-0000-4000-8000-000000000012', '2020-03-01'),
  ('f0000000-0000-4000-8000-000000000523', 'f0000000-0000-4000-8000-000000000023', 'f0000000-0000-4000-8000-000000000101', 'f0000000-0000-4000-8000-000000000011', '2021-03-01'),
  ('f0000000-0000-4000-8000-000000000524', 'f0000000-0000-4000-8000-000000000024', 'f0000000-0000-4000-8000-000000000104', 'f0000000-0000-4000-8000-000000000011', '2022-03-01'),
  ('f0000000-0000-4000-8000-000000000525', 'f0000000-0000-4000-8000-000000000025', 'f0000000-0000-4000-8000-000000000104', 'f0000000-0000-4000-8000-000000000012', '2023-03-01'),
  ('f0000000-0000-4000-8000-000000000526', 'f0000000-0000-4000-8000-000000000026', 'f0000000-0000-4000-8000-000000000102', 'f0000000-0000-4000-8000-000000000011', '2024-03-01'),
  ('f0000000-0000-4000-8000-000000000531', 'f0000000-0000-4000-8000-000000000031', 'f0000000-0000-4000-8000-000000000105', 'f0000000-0000-4000-8000-000000000011', '2019-03-01'),
  ('f0000000-0000-4000-8000-000000000532', 'f0000000-0000-4000-8000-000000000032', 'f0000000-0000-4000-8000-000000000105', 'f0000000-0000-4000-8000-000000000011', '2020-03-01'),
  ('f0000000-0000-4000-8000-000000000533', 'f0000000-0000-4000-8000-000000000033', 'f0000000-0000-4000-8000-000000000105', 'f0000000-0000-4000-8000-000000000012', '2021-03-01'),
  ('f0000000-0000-4000-8000-000000000534', 'f0000000-0000-4000-8000-000000000034', 'f0000000-0000-4000-8000-000000000106', 'f0000000-0000-4000-8000-000000000012', '2022-03-01'),
  ('f0000000-0000-4000-8000-000000000535', 'f0000000-0000-4000-8000-000000000035', 'f0000000-0000-4000-8000-000000000105', 'f0000000-0000-4000-8000-000000000012', '2023-03-01'),
  ('f0000000-0000-4000-8000-000000000536', 'f0000000-0000-4000-8000-000000000036', 'f0000000-0000-4000-8000-000000000106', 'f0000000-0000-4000-8000-000000000011', '2024-03-01'),
  ('f0000000-0000-4000-8000-000000000537', 'f0000000-0000-4000-8000-000000000037', 'f0000000-0000-4000-8000-000000000105', 'f0000000-0000-4000-8000-000000000011', '2019-03-01')
ON CONFLICT DO NOTHING;

-- KPI-12 (rotación temprana, épica 13): altas y bajas recientes para el dashboard de RRHH.
--   2025-S2 (jul-dic 2025): 1 ingreso (Verónica), 0 bajas en el periodo                  -> 0 %      (verde)
--   2026-S1 (ene-jun 2026): 7 ingresos; Verónica se va el 01/02 con 53 días (ingresó en
--                           2025-S2, pero la baja cae en S1); Fabián se va con 134 días (no es temprana) -> 1/7 = 14,29 % (verde)
--   2026-S2 (jul-dic 2026): 4 ingresos; Pablo (45 días) e Iván (53 días) se van antes de los 90 días    -> 2/4 = 50 %    (rojo)
INSERT INTO EMPLEADOS (id_empleado, numero_documento, nombres, primer_apellido, segundo_apellido, fecha_nacimiento, genero, telefono_celular, correo_personal, direccion_domicilio, fecha_ingreso, fecha_baja, id_cargo_actual, id_sucursal_actual, id_estado_empleado) VALUES
  ('f0000000-0000-4000-8000-000000000901', '7110101', 'Verónica', 'Nina', 'Huanca', '1999-05-10', 'Femenino', '71010101', 'veronica.nina@correo.test', 'Zona Sopocachi, La Paz', '2025-12-10', '2026-02-01', 'f0000000-0000-4000-8000-000000000105', 'f0000000-0000-4000-8000-000000000011', 4),
  ('f0000000-0000-4000-8000-000000000902', '7110102', 'Ramiro', 'Apaza', 'Calle', '1998-02-21', 'Masculino', '71010102', 'ramiro.apaza@correo.test', 'Zona Miraflores, La Paz', '2026-01-12', NULL, 'f0000000-0000-4000-8000-000000000106', 'f0000000-0000-4000-8000-000000000012', 1),
  ('f0000000-0000-4000-8000-000000000903', '7110103', 'Gisela', 'Rocha', 'Mendoza', '1997-07-03', 'Femenino', '71010103', 'gisela.rocha@correo.test', 'Zona Sopocachi, La Paz', '2026-02-02', NULL, 'f0000000-0000-4000-8000-000000000102', 'f0000000-0000-4000-8000-000000000011', 1),
  ('f0000000-0000-4000-8000-000000000904', '7110104', 'Fabián', 'Choque', 'Ticona', '2000-11-14', 'Masculino', '71010104', 'fabian.choque@correo.test', 'Zona Miraflores, La Paz', '2026-02-16', '2026-06-30', 'f0000000-0000-4000-8000-000000000105', 'f0000000-0000-4000-8000-000000000012', 4),
  ('f0000000-0000-4000-8000-000000000905', '7110105', 'Leonel', 'Morales', 'Chávez', '1996-09-30', 'Masculino', '71010105', 'leonel.morales@correo.test', 'Zona Sopocachi, La Paz', '2026-03-02', NULL, 'f0000000-0000-4000-8000-000000000105', 'f0000000-0000-4000-8000-000000000011', 1),
  ('f0000000-0000-4000-8000-000000000906', '7110106', 'Camila', 'Ríos', 'Vargas', '2001-01-18', 'Femenino', '71010106', 'camila.rios@correo.test', 'Zona Sopocachi, La Paz', '2026-04-06', NULL, 'f0000000-0000-4000-8000-000000000106', 'f0000000-0000-4000-8000-000000000011', 1),
  ('f0000000-0000-4000-8000-000000000907', '7110107', 'Hugo', 'Ticona', 'Quispe', '1995-06-25', 'Masculino', '71010107', 'hugo.ticona@correo.test', 'Zona Miraflores, La Paz', '2026-05-04', NULL, 'f0000000-0000-4000-8000-000000000102', 'f0000000-0000-4000-8000-000000000012', 1),
  ('f0000000-0000-4000-8000-000000000908', '7110108', 'Natalia', 'Vega', 'Rojas', '1999-12-08', 'Femenino', '71010108', 'natalia.vega@correo.test', 'Zona Miraflores, La Paz', '2026-06-01', NULL, 'f0000000-0000-4000-8000-000000000105', 'f0000000-0000-4000-8000-000000000012', 1),
  ('f0000000-0000-4000-8000-000000000909', '7110109', 'Pablo', 'Quisbert', 'Mamani', '2000-03-12', 'Masculino', '71010109', 'pablo.quisbert@correo.test', 'Zona Sopocachi, La Paz', '2026-07-06', '2026-08-20', 'f0000000-0000-4000-8000-000000000105', 'f0000000-0000-4000-8000-000000000011', 4),
  ('f0000000-0000-4000-8000-000000000910', '7110110', 'Daniela', 'Cruz', 'Flores', '1998-08-19', 'Femenino', '71010110', 'daniela.cruz@correo.test', 'Zona Miraflores, La Paz', '2026-08-03', NULL, 'f0000000-0000-4000-8000-000000000106', 'f0000000-0000-4000-8000-000000000012', 1),
  ('f0000000-0000-4000-8000-000000000911', '7110111', 'Iván', 'Limachi', 'Condori', '1997-04-02', 'Masculino', '71010111', 'ivan.limachi@correo.test', 'Zona Sopocachi, La Paz', '2026-09-07', '2026-10-30', 'f0000000-0000-4000-8000-000000000102', 'f0000000-0000-4000-8000-000000000011', 4),
  ('f0000000-0000-4000-8000-000000000912', '7110112', 'Rocío', 'Pérez', 'Aliaga', '2002-10-27', 'Femenino', '71010112', 'rocio.perez@correo.test', 'Zona Miraflores, La Paz', '2026-10-05', NULL, 'f0000000-0000-4000-8000-000000000105', 'f0000000-0000-4000-8000-000000000012', 1)
ON CONFLICT DO NOTHING;
INSERT INTO ASIGNACIONES_EMPLEADO (id_asignacion, id_empleado, id_cargo, id_sucursal, fecha_inicio) VALUES
  ('f0000000-0000-4000-8000-000000000941', 'f0000000-0000-4000-8000-000000000901', 'f0000000-0000-4000-8000-000000000105', 'f0000000-0000-4000-8000-000000000011', '2025-12-10'),
  ('f0000000-0000-4000-8000-000000000942', 'f0000000-0000-4000-8000-000000000902', 'f0000000-0000-4000-8000-000000000106', 'f0000000-0000-4000-8000-000000000012', '2026-01-12'),
  ('f0000000-0000-4000-8000-000000000943', 'f0000000-0000-4000-8000-000000000903', 'f0000000-0000-4000-8000-000000000102', 'f0000000-0000-4000-8000-000000000011', '2026-02-02'),
  ('f0000000-0000-4000-8000-000000000944', 'f0000000-0000-4000-8000-000000000904', 'f0000000-0000-4000-8000-000000000105', 'f0000000-0000-4000-8000-000000000012', '2026-02-16'),
  ('f0000000-0000-4000-8000-000000000945', 'f0000000-0000-4000-8000-000000000905', 'f0000000-0000-4000-8000-000000000105', 'f0000000-0000-4000-8000-000000000011', '2026-03-02'),
  ('f0000000-0000-4000-8000-000000000946', 'f0000000-0000-4000-8000-000000000906', 'f0000000-0000-4000-8000-000000000106', 'f0000000-0000-4000-8000-000000000011', '2026-04-06'),
  ('f0000000-0000-4000-8000-000000000947', 'f0000000-0000-4000-8000-000000000907', 'f0000000-0000-4000-8000-000000000102', 'f0000000-0000-4000-8000-000000000012', '2026-05-04'),
  ('f0000000-0000-4000-8000-000000000948', 'f0000000-0000-4000-8000-000000000908', 'f0000000-0000-4000-8000-000000000105', 'f0000000-0000-4000-8000-000000000012', '2026-06-01'),
  ('f0000000-0000-4000-8000-000000000949', 'f0000000-0000-4000-8000-000000000909', 'f0000000-0000-4000-8000-000000000105', 'f0000000-0000-4000-8000-000000000011', '2026-07-06'),
  ('f0000000-0000-4000-8000-000000000950', 'f0000000-0000-4000-8000-000000000910', 'f0000000-0000-4000-8000-000000000106', 'f0000000-0000-4000-8000-000000000012', '2026-08-03'),
  ('f0000000-0000-4000-8000-000000000951', 'f0000000-0000-4000-8000-000000000911', 'f0000000-0000-4000-8000-000000000102', 'f0000000-0000-4000-8000-000000000011', '2026-09-07'),
  ('f0000000-0000-4000-8000-000000000952', 'f0000000-0000-4000-8000-000000000912', 'f0000000-0000-4000-8000-000000000105', 'f0000000-0000-4000-8000-000000000012', '2026-10-05')
ON CONFLICT DO NOTHING;
COMMIT;
