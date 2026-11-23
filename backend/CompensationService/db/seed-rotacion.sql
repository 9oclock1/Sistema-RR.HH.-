-- Bajas de ejemplo para el dashboard de rotación de personal (RF-75, KAN-95), con su causal y fecha de retiro.
-- Requiere init.sql y, antes, el seed-rotacion.sql de EmployeeService (mismas personas y fechas de ingreso).
-- Se puede ejecutar varias veces: lo que ya existe no se duplica.
--   cat backend/CompensationService/db/seed-rotacion.sql | docker exec -i rrhh-postgres psql -U adminRRHH -d CompensationDB
--
-- Qué queda cargado: 10 procesos de desvinculación repartidos en los últimos 12 meses y en las 4 causales
-- (CERRADO los de hace dos meses o más, INICIADO los más recientes), cada uno con su respaldo.
BEGIN;
WITH b AS (SELECT date_trunc('month', timezone('America/La_Paz', now()))::date AS mes)
INSERT INTO PROCESOS_DESVINCULACION (id_proceso, id_empleado, nombre_empleado, fecha_ingreso, codigo_causal, fecha_retiro, corresponde_desahucio, estado, registrado_por, registrado_por_rol)
SELECT v.id_proceso::uuid, v.id_empleado::uuid, v.nombre_empleado, v.fecha_ingreso, v.codigo_causal, v.fecha_retiro,
       v.corresponde_desahucio, v.estado, v.registrado_por, v.registrado_por_rol
  FROM b, LATERAL (VALUES
    ('c0000000-0000-4000-8095-000000000116', 'f0000000-0000-4000-8095-000000000116', 'Pamela Chura Alanoca', DATE '2023-09-01', 'CONCLUSION_CONTRATO', (b.mes - make_interval(months => 10))::date + 21, FALSE, 'CERRADO', 'f0000000-0000-4000-8000-000000000023'::uuid, 'admin'),
    ('c0000000-0000-4000-8095-000000000140', 'f0000000-0000-4000-8095-000000000140', 'Carla Chura Alanoca', DATE '2023-09-01', 'DESAHUCIO', (b.mes - make_interval(months => 7))::date + 19, TRUE, 'CERRADO', 'f0000000-0000-4000-8000-000000000023'::uuid, 'admin'),
    ('c0000000-0000-4000-8095-000000000200', 'f0000000-0000-4000-8095-000000000200', 'Silvia Aruquipa Gutiérrez', (b.mes - make_interval(months => 11))::date + 2, 'RENUNCIA', (b.mes - make_interval(months => 11))::date + 27, FALSE, 'CERRADO', 'f0000000-0000-4000-8000-000000000023'::uuid, 'admin'),
    ('c0000000-0000-4000-8095-000000000201', 'f0000000-0000-4000-8095-000000000201', 'Iván Nina Chura', (b.mes - make_interval(months => 11))::date + 16, 'RENUNCIA', (b.mes - make_interval(months => 10))::date + 19, FALSE, 'CERRADO', 'f0000000-0000-4000-8000-000000000023'::uuid, 'admin'),
    ('c0000000-0000-4000-8095-000000000202', 'f0000000-0000-4000-8095-000000000202', 'Fernanda Mamani Condori', (b.mes - make_interval(months => 11))::date + 23, 'CONCLUSION_CONTRATO', (b.mes - make_interval(months => 8))::date + 27, FALSE, 'CERRADO', 'f0000000-0000-4000-8000-000000000023'::uuid, 'admin'),
    ('c0000000-0000-4000-8095-000000000203', 'f0000000-0000-4000-8095-000000000203', 'Wilson Limachi Copa', (b.mes - make_interval(months => 10))::date + 5, 'RENUNCIA', (b.mes - make_interval(months => 9))::date + 14, FALSE, 'CERRADO', 'f0000000-0000-4000-8000-000000000023'::uuid, 'admin'),
    ('c0000000-0000-4000-8095-000000000205', 'f0000000-0000-4000-8095-000000000205', 'Franz Salazar Poma', (b.mes - make_interval(months => 10))::date + 19, 'DESPIDO_LEGAL', (b.mes - make_interval(months => 7))::date + 25, FALSE, 'CERRADO', 'f0000000-0000-4000-8000-000000000023'::uuid, 'admin'),
    ('c0000000-0000-4000-8095-000000000206', 'f0000000-0000-4000-8095-000000000206', 'Wendy Flores Cruz', (b.mes - make_interval(months => 9))::date + 1, 'CONCLUSION_CONTRATO', (b.mes - make_interval(months => 5))::date + 16, FALSE, 'CERRADO', 'f0000000-0000-4000-8000-000000000023'::uuid, 'admin'),
    ('c0000000-0000-4000-8095-000000000208', 'f0000000-0000-4000-8095-000000000208', 'Teresa Vargas Salazar', (b.mes - make_interval(months => 8))::date + 3, 'RENUNCIA', (b.mes - make_interval(months => 3))::date + 9, FALSE, 'CERRADO', 'f0000000-0000-4000-8000-000000000023'::uuid, 'admin'),
    ('c0000000-0000-4000-8095-000000000212', 'f0000000-0000-4000-8095-000000000212', 'Karen Villca Nina', (b.mes - make_interval(months => 6))::date + 11, 'RENUNCIA', (b.mes - make_interval(months => 0))::date + 1, FALSE, 'INICIADO', 'f0000000-0000-4000-8000-000000000023'::uuid, 'admin')
) AS v(id_proceso, id_empleado, nombre_empleado, fecha_ingreso, codigo_causal, fecha_retiro, corresponde_desahucio, estado, registrado_por, registrado_por_rol)
ON CONFLICT DO NOTHING;
INSERT INTO DOCUMENTOS_DESVINCULACION (id_proceso, nombre_archivo, tipo_mime, tamano_bytes, contenido)
SELECT v.id_proceso::uuid, v.nombre_archivo, 'application/pdf',
       octet_length(convert_to(E'%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'UTF8')),
       convert_to(E'%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'UTF8')
  FROM (VALUES
    ('c0000000-0000-4000-8095-000000000116', 'respaldo-baja-116.pdf'),
    ('c0000000-0000-4000-8095-000000000140', 'respaldo-baja-140.pdf'),
    ('c0000000-0000-4000-8095-000000000200', 'respaldo-baja-200.pdf'),
    ('c0000000-0000-4000-8095-000000000201', 'respaldo-baja-201.pdf'),
    ('c0000000-0000-4000-8095-000000000202', 'respaldo-baja-202.pdf'),
    ('c0000000-0000-4000-8095-000000000203', 'respaldo-baja-203.pdf'),
    ('c0000000-0000-4000-8095-000000000205', 'respaldo-baja-205.pdf'),
    ('c0000000-0000-4000-8095-000000000206', 'respaldo-baja-206.pdf'),
    ('c0000000-0000-4000-8095-000000000208', 'respaldo-baja-208.pdf'),
    ('c0000000-0000-4000-8095-000000000212', 'respaldo-baja-212.pdf')
) AS v(id_proceso, nombre_archivo)
ON CONFLICT DO NOTHING;
COMMIT;
