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
COMMIT;
