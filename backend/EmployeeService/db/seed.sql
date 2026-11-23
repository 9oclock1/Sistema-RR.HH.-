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

-- Colaboradores desvinculados de ejemplo para CompensationService (RF-54, KAN-74).
BEGIN;
INSERT INTO EMPLEADOS (id_empleado, numero_documento, nombres, primer_apellido, segundo_apellido, fecha_nacimiento, genero, telefono_celular, correo_personal, direccion_domicilio, fecha_ingreso, id_cargo_actual, id_sucursal_actual, id_estado_empleado) VALUES
  ('f0000000-0000-4000-8000-000000000741', '7108741', 'Luciano', 'Morales', 'Chávez', '1993-05-12', 'Masculino', '71008741', 'luciano.morales@correo.test', 'Zona Sopocachi, La Paz', '2022-05-01', 'f0000000-0000-4000-8000-000000000105', 'f0000000-0000-4000-8000-000000000011', 4),
  ('f0000000-0000-4000-8000-000000000742', '7108742', 'Valeria', 'Nina', 'Quisbert', '1995-08-22', 'Femenino', '71008742', 'valeria.nina@correo.test', 'Zona Miraflores, La Paz', '2024-02-01', 'f0000000-0000-4000-8000-000000000106', 'f0000000-0000-4000-8000-000000000012', 4),
  ('f0000000-0000-4000-8000-000000000743', '7108743', 'Rodrigo', 'Apaza', 'Calle', '1991-11-03', 'Masculino', '71008743', 'rodrigo.apaza@correo.test', 'Zona Miraflores, La Paz', '2021-08-01', 'f0000000-0000-4000-8000-000000000105', 'f0000000-0000-4000-8000-000000000012', 4)
ON CONFLICT DO NOTHING;
INSERT INTO ASIGNACIONES_EMPLEADO (id_asignacion, id_empleado, id_cargo, id_sucursal, fecha_inicio) VALUES
  ('f0000000-0000-4000-8000-000000000751', 'f0000000-0000-4000-8000-000000000741', 'f0000000-0000-4000-8000-000000000105', 'f0000000-0000-4000-8000-000000000011', '2022-05-01'),
  ('f0000000-0000-4000-8000-000000000752', 'f0000000-0000-4000-8000-000000000742', 'f0000000-0000-4000-8000-000000000106', 'f0000000-0000-4000-8000-000000000012', '2024-02-01'),
  ('f0000000-0000-4000-8000-000000000753', 'f0000000-0000-4000-8000-000000000743', 'f0000000-0000-4000-8000-000000000105', 'f0000000-0000-4000-8000-000000000012', '2021-08-01')
ON CONFLICT DO NOTHING;
-- KAN-83: seguimiento del plan de capacitación previo al ascenso.
-- Cursos requeridos: Supervisor de Cajas (104) exige arqueo, liderazgo y seguridad (este último vence a los 24 meses);
-- Jefe de Atención al Cliente (103) exige atención avanzada y liderazgo.
--   Carlos (cajero -> Supervisor): los 3 cursos al día                              -> 100 %
--   Ana (cajero -> Supervisor): arqueo y liderazgo; su certificado de seguridad venció -> 67 % (1 pendiente)
--   Paola (asesora -> Jefe de Atención): solo atención avanzada                       -> 50 %
--   Diego (cajero -> Supervisor): ningún curso todavía                                -> 0 %
INSERT INTO CURSOS_CAPACITACION (id_curso, codigo, nombre, descripcion, horas_academicas, tipo_capacitacion, requiere_vencimiento, meses_vigencia) VALUES
  ('f0000000-0000-4000-8000-000000000c01', 'ATC-AVZ', 'Atención al cliente avanzada', 'Manejo de reclamos y fidelización.', 24, 'TECNICA', FALSE, NULL),
  ('f0000000-0000-4000-8000-000000000c02', 'CAJ-ARQ', 'Arqueo y control de caja', 'Cuadre, faltantes y sobrantes, custodia de valores.', 16, 'TECNICA', FALSE, NULL),
  ('f0000000-0000-4000-8000-000000000c03', 'LID-EQ', 'Liderazgo de equipos', 'Conducción de equipos, delegación y retroalimentación.', 32, 'TECNICA', FALSE, NULL),
  ('f0000000-0000-4000-8000-000000000c04', 'SEG-PA', 'Seguridad y primeros auxilios', 'Evacuación, extintores y primeros auxilios.', 12, 'CERTIFICACION', TRUE, 24)
ON CONFLICT DO NOTHING;
INSERT INTO REQUISITOS_CAPACITACION_CARGO (id_requisito_cargo, id_cargo, id_curso, es_obligatorio, meses_validez_requerida) VALUES
  ('f0000000-0000-4000-8000-000000000c11', 'f0000000-0000-4000-8000-000000000104', 'f0000000-0000-4000-8000-000000000c02', TRUE, NULL),
  ('f0000000-0000-4000-8000-000000000c12', 'f0000000-0000-4000-8000-000000000104', 'f0000000-0000-4000-8000-000000000c03', TRUE, NULL),
  ('f0000000-0000-4000-8000-000000000c13', 'f0000000-0000-4000-8000-000000000104', 'f0000000-0000-4000-8000-000000000c04', TRUE, NULL),
  ('f0000000-0000-4000-8000-000000000c14', 'f0000000-0000-4000-8000-000000000103', 'f0000000-0000-4000-8000-000000000c01', TRUE, NULL),
  ('f0000000-0000-4000-8000-000000000c15', 'f0000000-0000-4000-8000-000000000103', 'f0000000-0000-4000-8000-000000000c03', TRUE, NULL)
ON CONFLICT DO NOTHING;
INSERT INTO CAPACITACIONES_CERTIFICACION (id_capacitacion, id_empleado, id_curso, institucion_emisora, fecha_inicio, fecha_fin, fecha_emision, fecha_vencimiento) VALUES
  ('f0000000-0000-4000-8000-000000000c21', 'f0000000-0000-4000-8000-000000000031', 'f0000000-0000-4000-8000-000000000c02', 'Instituto de Formación Financiera', '2025-08-04', '2025-08-15', '2025-08-20', NULL),
  ('f0000000-0000-4000-8000-000000000c22', 'f0000000-0000-4000-8000-000000000031', 'f0000000-0000-4000-8000-000000000c03', 'Escuela de Gestión Andina', '2026-02-02', '2026-03-13', '2026-03-20', NULL),
  ('f0000000-0000-4000-8000-000000000c23', 'f0000000-0000-4000-8000-000000000031', 'f0000000-0000-4000-8000-000000000c04', 'Cruz Roja Boliviana', '2025-09-08', '2025-09-10', '2025-09-12', '2027-09-12'),
  ('f0000000-0000-4000-8000-000000000c24', 'f0000000-0000-4000-8000-000000000035', 'f0000000-0000-4000-8000-000000000c02', 'Instituto de Formación Financiera', '2025-06-02', '2025-06-13', '2025-06-18', NULL),
  ('f0000000-0000-4000-8000-000000000c25', 'f0000000-0000-4000-8000-000000000035', 'f0000000-0000-4000-8000-000000000c03', 'Escuela de Gestión Andina', '2026-02-02', '2026-03-13', '2026-03-20', NULL),
  ('f0000000-0000-4000-8000-000000000c26', 'f0000000-0000-4000-8000-000000000035', 'f0000000-0000-4000-8000-000000000c04', 'Cruz Roja Boliviana', '2024-05-06', '2024-05-08', '2024-05-10', '2026-05-10'),
  ('f0000000-0000-4000-8000-000000000c27', 'f0000000-0000-4000-8000-000000000034', 'f0000000-0000-4000-8000-000000000c01', 'Cámara Nacional de Comercio', '2026-04-06', '2026-04-24', '2026-04-30', NULL)
ON CONFLICT DO NOTHING;
INSERT INTO PLANES_ASCENSO (id_plan, id_empleado, id_cargo_destino, observaciones, asignado_por, asignado_en) VALUES
  ('f0000000-0000-4000-8000-000000000c31', 'f0000000-0000-4000-8000-000000000031', 'f0000000-0000-4000-8000-000000000104', 'Candidato a la supervisión de cajas de Sopocachi.', 'f0000000-0000-4000-8000-000000000023', '2026-07-01 09:00:00-04'),
  ('f0000000-0000-4000-8000-000000000c32', 'f0000000-0000-4000-8000-000000000035', 'f0000000-0000-4000-8000-000000000104', 'Candidata a la supervisión de cajas de Miraflores.', 'f0000000-0000-4000-8000-000000000023', '2026-07-01 09:00:00-04'),
  ('f0000000-0000-4000-8000-000000000c33', 'f0000000-0000-4000-8000-000000000034', 'f0000000-0000-4000-8000-000000000103', NULL, 'f0000000-0000-4000-8000-000000000023', '2026-08-03 09:00:00-04'),
  ('f0000000-0000-4000-8000-000000000c34', 'f0000000-0000-4000-8000-000000000033', 'f0000000-0000-4000-8000-000000000104', NULL, 'f0000000-0000-4000-8000-000000000023', '2026-10-05 09:00:00-04')
ON CONFLICT DO NOTHING;
COMMIT;

-- Colaborador con menos de tres meses de antigüedad para pruebas de sueldo promedio indemnizable (RF-55, KAN-75).
BEGIN;
INSERT INTO EMPLEADOS (id_empleado, numero_documento, nombres, primer_apellido, segundo_apellido, fecha_nacimiento, genero, telefono_celular, correo_personal, direccion_domicilio, fecha_ingreso, id_cargo_actual, id_sucursal_actual, id_estado_empleado) VALUES
  ('f0000000-0000-4000-8000-000000000744', '7108744', 'Fernando', 'Choque', 'Ticona', '1997-04-18', 'Masculino', '71008744', 'fernando.choque@correo.test', 'Zona Sopocachi, La Paz', '2026-09-01', 'f0000000-0000-4000-8000-000000000106', 'f0000000-0000-4000-8000-000000000011', 4)
ON CONFLICT DO NOTHING;
INSERT INTO ASIGNACIONES_EMPLEADO (id_asignacion, id_empleado, id_cargo, id_sucursal, fecha_inicio) VALUES
  ('f0000000-0000-4000-8000-000000000754', 'f0000000-0000-4000-8000-000000000744', 'f0000000-0000-4000-8000-000000000106', 'f0000000-0000-4000-8000-000000000011', '2026-09-01')
ON CONFLICT DO NOTHING;
COMMIT;

-- Colaboradora activa con planillas cerradas en CompensationService, para probar desde la pantalla el registro de su
-- baja y el cálculo del sueldo promedio indemnizable (RF-54 y RF-55).
BEGIN;
INSERT INTO EMPLEADOS (id_empleado, numero_documento, nombres, primer_apellido, segundo_apellido, fecha_nacimiento, genero, telefono_celular, correo_personal, direccion_domicilio, fecha_ingreso, id_cargo_actual, id_sucursal_actual, id_estado_empleado) VALUES
  ('f0000000-0000-4000-8000-000000000745', '7108745', 'Gabriela', 'Rocha', 'Mendoza', '1996-02-14', 'Femenino', '71008745', 'gabriela.rocha@correo.test', 'Zona Miraflores, La Paz', '2025-03-03', 'f0000000-0000-4000-8000-000000000106', 'f0000000-0000-4000-8000-000000000012', 1)
ON CONFLICT DO NOTHING;
INSERT INTO ASIGNACIONES_EMPLEADO (id_asignacion, id_empleado, id_cargo, id_sucursal, fecha_inicio) VALUES
  ('f0000000-0000-4000-8000-000000000755', 'f0000000-0000-4000-8000-000000000745', 'f0000000-0000-4000-8000-000000000106', 'f0000000-0000-4000-8000-000000000012', '2025-03-03')
ON CONFLICT DO NOTHING;
COMMIT;

-- Colaboradores desvinculados por desahucio con 1 año exacto, 91 y 90 días de servicio, para probar la indemnización
-- y el desahucio (RF-56, KAN-76).
BEGIN;
INSERT INTO EMPLEADOS (id_empleado, numero_documento, nombres, primer_apellido, segundo_apellido, fecha_nacimiento, genero, telefono_celular, correo_personal, direccion_domicilio, fecha_ingreso, id_cargo_actual, id_sucursal_actual, id_estado_empleado) VALUES
  ('f0000000-0000-4000-8000-000000000a61', '7108761', 'Sofía', 'Mamani', 'Lima', '1994-07-21', 'Femenino', '71008761', 'sofia.mamani@correo.test', 'Zona Sopocachi, La Paz', '2025-11-01', 'f0000000-0000-4000-8000-000000000105', 'f0000000-0000-4000-8000-000000000011', 4),
  ('f0000000-0000-4000-8000-000000000a62', '7108762', 'Marco', 'Condori', 'Flores', '1998-01-09', 'Masculino', '71008762', 'marco.condori@correo.test', 'Zona Miraflores, La Paz', '2026-08-02', 'f0000000-0000-4000-8000-000000000106', 'f0000000-0000-4000-8000-000000000012', 4),
  ('f0000000-0000-4000-8000-000000000a63', '7108763', 'Lucía', 'Vargas', 'Ríos', '1999-10-30', 'Femenino', '71008763', 'lucia.vargas@correo.test', 'Zona Miraflores, La Paz', '2026-08-03', 'f0000000-0000-4000-8000-000000000106', 'f0000000-0000-4000-8000-000000000012', 4)
ON CONFLICT DO NOTHING;
INSERT INTO ASIGNACIONES_EMPLEADO (id_asignacion, id_empleado, id_cargo, id_sucursal, fecha_inicio) VALUES
  ('f0000000-0000-4000-8000-000000000a71', 'f0000000-0000-4000-8000-000000000a61', 'f0000000-0000-4000-8000-000000000105', 'f0000000-0000-4000-8000-000000000011', '2025-11-01'),
  ('f0000000-0000-4000-8000-000000000a72', 'f0000000-0000-4000-8000-000000000a62', 'f0000000-0000-4000-8000-000000000106', 'f0000000-0000-4000-8000-000000000012', '2026-08-02'),
  ('f0000000-0000-4000-8000-000000000a73', 'f0000000-0000-4000-8000-000000000a63', 'f0000000-0000-4000-8000-000000000106', 'f0000000-0000-4000-8000-000000000012', '2026-08-03')
ON CONFLICT DO NOTHING;
COMMIT;
