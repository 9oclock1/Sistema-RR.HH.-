-- Datos de prueba de CompensationDB para desvinculación laboral (RF-54, KAN-74).
-- Requiere init.sql y que antes se haya ejecutado el seed de EmployeeService para mantener la coherencia
-- entre las dos bases (todo colaborador con proceso abierto está en estado BAJA en EmployeeDB).
-- Se puede ejecutar varias veces: lo que ya existe no se duplica.
--
-- Primero ejecute el seed de EmployeeService:
--   Get-Content backend/EmployeeService/db/seed.sql | docker exec -i rrhh-postgres psql -U adminRRHH -d EmployeeDB
-- Luego ejecute este archivo:
--   Get-Content backend/CompensationService/db/seed.sql | docker exec -i rrhh-postgres psql -U adminRRHH -d CompensationDB
--
-- Qué queda cargado:
--   4 procesos en estado INICIADO (uno por cada causal: DESPIDO_LEGAL, RENUNCIA, CONCLUSION_CONTRATO y DESAHUCIO).
--   1 proceso en estado ANULADO (Diego Quispe Mamani, que sigue activo) para demostrar que no bloquea nuevos registros.
BEGIN;

INSERT INTO PROCESOS_DESVINCULACION (
  id_proceso, id_empleado, nombre_empleado, fecha_ingreso, codigo_causal,
  fecha_retiro, corresponde_desahucio, observaciones, estado, registrado_por, registrado_por_rol
) VALUES
  (
    'c0000000-0000-4000-8000-000000000741',
    'f0000000-0000-4000-8000-000000000037',
    'Elena Paredes Gómez',
    '2019-03-01',
    'DESPIDO_LEGAL',
    '2026-10-15',
    FALSE,
    'Resolución disciplinaria documentada conforme a reglamento interno.',
    'INICIADO',
    'f0000000-0000-4000-8000-000000000023',
    'admin'
  ),
  (
    'c0000000-0000-4000-8000-000000000742',
    'f0000000-0000-4000-8000-000000000741',
    'Luciano Morales Chávez',
    '2022-05-01',
    'RENUNCIA',
    '2026-10-20',
    FALSE,
    'Carta de renuncia voluntaria recibida con firma del colaborador.',
    'INICIADO',
    'f0000000-0000-4000-8000-000000000023',
    'admin'
  ),
  (
    'c0000000-0000-4000-8000-000000000743',
    'f0000000-0000-4000-8000-000000000742',
    'Valeria Nina Quisbert',
    '2024-02-01',
    'CONCLUSION_CONTRATO',
    '2026-10-31',
    FALSE,
    'Cumplimiento del plazo establecido en el contrato a plazo fijo.',
    'INICIADO',
    'f0000000-0000-4000-8000-000000000023',
    'admin'
  ),
  (
    'c0000000-0000-4000-8000-000000000744',
    'f0000000-0000-4000-8000-000000000743',
    'Rodrigo Apaza Calle',
    '2021-08-01',
    'DESAHUCIO',
    '2026-11-10',
    TRUE,
    'Desvinculación por decisión del empleador con pago de desahucio.',
    'INICIADO',
    'f0000000-0000-4000-8000-000000000023',
    'admin'
  ),
  (
    'c0000000-0000-4000-8000-000000000745',
    'f0000000-0000-4000-8000-000000000033',
    'Diego Quispe Mamani',
    '2021-03-01',
    'RENUNCIA',
    '2026-09-30',
    FALSE,
    'Solicitud anulada por desistimiento del colaborador.',
    'ANULADO',
    'f0000000-0000-4000-8000-000000000023',
    'admin'
  )
ON CONFLICT DO NOTHING;

INSERT INTO DOCUMENTOS_DESVINCULACION (
  id_proceso, nombre_archivo, tipo_mime, tamano_bytes, contenido
) VALUES
  (
    'c0000000-0000-4000-8000-000000000741',
    'memorandum-despido-elena-paredes.pdf',
    'application/pdf',
    octet_length(convert_to(E'%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'UTF8')),
    convert_to(E'%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'UTF8')
  ),
  (
    'c0000000-0000-4000-8000-000000000742',
    'carta-renuncia-luciano-morales.pdf',
    'application/pdf',
    octet_length(convert_to(E'%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'UTF8')),
    convert_to(E'%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'UTF8')
  ),
  (
    'c0000000-0000-4000-8000-000000000743',
    'acta-conclusion-valeria-nina.pdf',
    'application/pdf',
    octet_length(convert_to(E'%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'UTF8')),
    convert_to(E'%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'UTF8')
  ),
  (
    'c0000000-0000-4000-8000-000000000744',
    'notificacion-desahucio-rodrigo-apaza.pdf',
    'application/pdf',
    octet_length(convert_to(E'%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'UTF8')),
    convert_to(E'%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'UTF8')
  ),
  (
    'c0000000-0000-4000-8000-000000000745',
    'respaldo-anulado-diego-quispe.pdf',
    'application/pdf',
    octet_length(convert_to(E'%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'UTF8')),
    convert_to(E'%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'UTF8')
  )
ON CONFLICT DO NOTHING;

COMMIT;
