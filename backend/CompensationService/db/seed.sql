-- Datos de prueba de CompensationDB para desvinculación laboral (RF-54, KAN-74).
-- Requiere init.sql y que antes se haya ejecutado el seed de EmployeeService para mantener la coherencia
-- entre las dos bases (todo colaborador con proceso abierto está en estado BAJA en EmployeeDB).
-- Se puede ejecutar varias veces: lo que ya existe no se duplica.
--
-- Primero ejecute el seed de EmployeeService:
--   Get-Content -Encoding UTF8 backend/EmployeeService/db/seed.sql | docker exec -i rrhh-postgres psql -U adminRRHH -d EmployeeDB
-- Luego ejecute este archivo:
--   Get-Content -Encoding UTF8 backend/CompensationService/db/seed.sql | docker exec -i rrhh-postgres psql -U adminRRHH -d CompensationDB
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

-- Datos de prueba de planillas cerradas de los últimos meses para cálculo del sueldo promedio indemnizable (RF-55, KAN-75).
-- Requiere que NO existan planillas generadas manualmente de 2026-07 a 2026-10 (una planilla por periodo: uq_planilla_periodo).
-- Primero ejecute el seed de EmployeeService para contar con Fernando Choque Ticona en EmployeeDB:
--   Get-Content -Encoding UTF8 backend/EmployeeService/db/seed.sql | docker exec -i rrhh-postgres psql -U adminRRHH -d EmployeeDB
--
-- Casos cubiertos por colaborador:
--   - Elena Paredes Gómez (...037): salarios variables con horas extra y bono de productividad, 15 días en 2026-10 (julio queda fuera).
--   - Luciano Morales Chávez (...741): bono de antigüedad, dominical y 20 días pagados en 2026-10.
--   - Valeria Nina Quisbert (...742): 3 meses completos (30 días) con horas extra y recargo nocturno, sin observaciones.
--   - Rodrigo Apaza Calle (...743): cambio de haber mensual (4000 -> 4400) y retiro en 2026-11 sin planilla cerrada de 2026-11.
--   - Fernando Choque Ticona (...744): antigüedad menor a tres meses (ingresó 2026-09-01, solo 2 planillas cerradas).
BEGIN;

INSERT INTO PROCESOS_DESVINCULACION (
  id_proceso, id_empleado, nombre_empleado, fecha_ingreso, codigo_causal,
  fecha_retiro, corresponde_desahucio, observaciones, estado, registrado_por, registrado_por_rol
) VALUES (
  'c0000000-0000-4000-8000-000000000746',
  'f0000000-0000-4000-8000-000000000744',
  'Fernando Choque Ticona',
  '2026-09-01',
  'RENUNCIA',
  '2026-10-31',
  FALSE,
  'Carta de renuncia presentada tras dos meses de servicio.',
  'INICIADO',
  'f0000000-0000-4000-8000-000000000023',
  'admin'
)
ON CONFLICT DO NOTHING;

INSERT INTO DOCUMENTOS_DESVINCULACION (
  id_proceso, nombre_archivo, tipo_mime, tamano_bytes, contenido
) VALUES (
  'c0000000-0000-4000-8000-000000000746',
  'carta-renuncia-fernando-choque.pdf',
  'application/pdf',
  octet_length(convert_to(E'%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'UTF8')),
  convert_to(E'%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'UTF8')
)
ON CONFLICT DO NOTHING;

INSERT INTO PLANILLAS (
  id_planilla, periodo, fecha_inicio, fecha_fin, datos_hasta, estado,
  generada_por, generada_por_nombre, generada_en,
  aprobada_por, aprobada_por_nombre, aprobada_en,
  estado_contabilidad, estado_pagos,
  referencia_contabilidad, respondida_contabilidad_en,
  referencia_pagos, respondida_pagos_en,
  cerrada_en
) VALUES
  (
    'c0000000-0000-4000-8000-000000000761', '2026-07', DATE '2026-07-01', DATE '2026-07-31', DATE '2026-07-31', 'CERRADA',
    'f0000000-0000-4000-8000-000000000023', 'Andrea Salazar Vega', TIMESTAMPTZ '2026-08-01T10:00:00-04:00',
    'f0000000-0000-4000-8000-000000000023', 'Andrea Salazar Vega', TIMESTAMPTZ '2026-08-01T14:00:00-04:00',
    'CONFIRMADA', 'CONFIRMADA',
    'AS-2026-0701', TIMESTAMPTZ '2026-08-02T09:00:00-04:00',
    'OP-2026-0701', TIMESTAMPTZ '2026-08-02T09:00:00-04:00',
    TIMESTAMPTZ '2026-08-02T09:05:00-04:00'
  ),
  (
    'c0000000-0000-4000-8000-000000000762', '2026-08', DATE '2026-08-01', DATE '2026-08-31', DATE '2026-08-31', 'CERRADA',
    'f0000000-0000-4000-8000-000000000023', 'Andrea Salazar Vega', TIMESTAMPTZ '2026-09-01T10:00:00-04:00',
    'f0000000-0000-4000-8000-000000000023', 'Andrea Salazar Vega', TIMESTAMPTZ '2026-09-01T14:00:00-04:00',
    'CONFIRMADA', 'CONFIRMADA',
    'AS-2026-0801', TIMESTAMPTZ '2026-09-02T09:00:00-04:00',
    'OP-2026-0801', TIMESTAMPTZ '2026-09-02T09:00:00-04:00',
    TIMESTAMPTZ '2026-09-02T09:05:00-04:00'
  ),
  (
    'c0000000-0000-4000-8000-000000000763', '2026-09', DATE '2026-09-01', DATE '2026-09-30', DATE '2026-09-30', 'CERRADA',
    'f0000000-0000-4000-8000-000000000023', 'Andrea Salazar Vega', TIMESTAMPTZ '2026-10-01T10:00:00-04:00',
    'f0000000-0000-4000-8000-000000000023', 'Andrea Salazar Vega', TIMESTAMPTZ '2026-10-01T14:00:00-04:00',
    'CONFIRMADA', 'CONFIRMADA',
    'AS-2026-0901', TIMESTAMPTZ '2026-10-02T09:00:00-04:00',
    'OP-2026-0901', TIMESTAMPTZ '2026-10-02T09:00:00-04:00',
    TIMESTAMPTZ '2026-10-02T09:05:00-04:00'
  ),
  (
    'c0000000-0000-4000-8000-000000000764', '2026-10', DATE '2026-10-01', DATE '2026-10-31', DATE '2026-10-31', 'CERRADA',
    'f0000000-0000-4000-8000-000000000023', 'Andrea Salazar Vega', TIMESTAMPTZ '2026-11-01T10:00:00-04:00',
    'f0000000-0000-4000-8000-000000000023', 'Andrea Salazar Vega', TIMESTAMPTZ '2026-11-01T14:00:00-04:00',
    'CONFIRMADA', 'CONFIRMADA',
    'AS-2026-1001', TIMESTAMPTZ '2026-11-02T09:00:00-04:00',
    'OP-2026-1001', TIMESTAMPTZ '2026-11-02T09:00:00-04:00',
    TIMESTAMPTZ '2026-11-02T09:05:00-04:00'
  )
ON CONFLICT DO NOTHING;

INSERT INTO PLANILLA_EMPLEADOS (
  id_planilla_empleado, id_planilla, id_empleado, nombre_empleado, numero_documento,
  cargo, area, sucursal, id_contrato, numero_contrato, haber_mensual,
  contrato_desde, contrato_hasta, dias_contrato, dias_pagados,
  minutos_extra_habil, minutos_domingo, minutos_nocturnos,
  total_ganado, total_descuentos, liquido_pagable, total_aportes
) VALUES
  (
    'c0000000-0000-4000-8000-000000000771', 'c0000000-0000-4000-8000-000000000761', 'f0000000-0000-4000-8000-000000000037', 'Elena Paredes Gómez', '7105069',
    'Cajero', 'Atención al cliente', 'Sopocachi', 'c0000000-0000-4000-8000-000000000791', 'CTR-2019-037', 4500.00,
    DATE '2026-07-01', DATE '2026-07-31', 30, 30,
    0, 0, 0,
    4900.00, 622.79, 4277.21, 818.79
  ),
  (
    'c0000000-0000-4000-8000-000000000772', 'c0000000-0000-4000-8000-000000000762', 'f0000000-0000-4000-8000-000000000037', 'Elena Paredes Gómez', '7105069',
    'Cajero', 'Atención al cliente', 'Sopocachi', 'c0000000-0000-4000-8000-000000000791', 'CTR-2019-037', 4500.00,
    DATE '2026-08-01', DATE '2026-08-31', 30, 30,
    600, 0, 0,
    5275.00, 670.46, 4604.54, 881.45
  ),
  (
    'c0000000-0000-4000-8000-000000000773', 'c0000000-0000-4000-8000-000000000763', 'f0000000-0000-4000-8000-000000000037', 'Elena Paredes Gómez', '7105069',
    'Cajero', 'Atención al cliente', 'Sopocachi', 'c0000000-0000-4000-8000-000000000791', 'CTR-2019-037', 4500.00,
    DATE '2026-09-01', DATE '2026-09-30', 30, 30,
    0, 0, 0,
    5200.00, 660.92, 4539.08, 868.92
  ),
  (
    'c0000000-0000-4000-8000-000000000774', 'c0000000-0000-4000-8000-000000000764', 'f0000000-0000-4000-8000-000000000037', 'Elena Paredes Gómez', '7105069',
    'Cajero', 'Atención al cliente', 'Sopocachi', 'c0000000-0000-4000-8000-000000000791', 'CTR-2019-037', 4500.00,
    DATE '2026-10-01', DATE '2026-10-15', 15, 15,
    0, 0, 0,
    2450.00, 311.40, 2138.60, 409.40
  ),
  (
    'c0000000-0000-4000-8000-000000000775', 'c0000000-0000-4000-8000-000000000761', 'f0000000-0000-4000-8000-000000000741', 'Luciano Morales Chávez', '7108741',
    'Cajero', 'Atención al cliente', 'Sopocachi', 'c0000000-0000-4000-8000-000000000792', 'CTR-2022-741', 3800.00,
    DATE '2026-07-01', DATE '2026-07-31', 30, 30,
    0, 0, 0,
    4050.00, 514.76, 3535.24, 676.76
  ),
  (
    'c0000000-0000-4000-8000-000000000776', 'c0000000-0000-4000-8000-000000000762', 'f0000000-0000-4000-8000-000000000741', 'Luciano Morales Chávez', '7108741',
    'Cajero', 'Atención al cliente', 'Sopocachi', 'c0000000-0000-4000-8000-000000000792', 'CTR-2022-741', 3800.00,
    DATE '2026-08-01', DATE '2026-08-31', 30, 30,
    0, 600, 0,
    4208.33, 534.87, 3673.46, 703.21
  ),
  (
    'c0000000-0000-4000-8000-000000000777', 'c0000000-0000-4000-8000-000000000763', 'f0000000-0000-4000-8000-000000000741', 'Luciano Morales Chávez', '7108741',
    'Cajero', 'Atención al cliente', 'Sopocachi', 'c0000000-0000-4000-8000-000000000792', 'CTR-2022-741', 3800.00,
    DATE '2026-09-01', DATE '2026-09-30', 30, 30,
    0, 0, 0,
    4050.00, 514.76, 3535.24, 676.76
  ),
  (
    'c0000000-0000-4000-8000-000000000778', 'c0000000-0000-4000-8000-000000000764', 'f0000000-0000-4000-8000-000000000741', 'Luciano Morales Chávez', '7108741',
    'Cajero', 'Atención al cliente', 'Sopocachi', 'c0000000-0000-4000-8000-000000000792', 'CTR-2022-741', 3800.00,
    DATE '2026-10-01', DATE '2026-10-20', 20, 20,
    0, 0, 0,
    2700.00, 343.17, 2356.83, 451.17
  ),
  (
    'c0000000-0000-4000-8000-000000000779', 'c0000000-0000-4000-8000-000000000761', 'f0000000-0000-4000-8000-000000000742', 'Valeria Nina Quisbert', '7108742',
    'Asesor de Atención', 'Atención al cliente', 'Miraflores', 'c0000000-0000-4000-8000-000000000793', 'CTR-2024-742', 3200.00,
    DATE '2026-07-01', DATE '2026-07-31', 30, 30,
    450, 0, 0,
    3400.00, 432.14, 2967.86, 568.14
  ),
  (
    'c0000000-0000-4000-8000-000000000780', 'c0000000-0000-4000-8000-000000000762', 'f0000000-0000-4000-8000-000000000742', 'Valeria Nina Quisbert', '7108742',
    'Asesor de Atención', 'Atención al cliente', 'Miraflores', 'c0000000-0000-4000-8000-000000000793', 'CTR-2024-742', 3200.00,
    DATE '2026-08-01', DATE '2026-08-31', 30, 30,
    270, 0, 0,
    3320.00, 421.97, 2898.03, 554.77
  ),
  (
    'c0000000-0000-4000-8000-000000000781', 'c0000000-0000-4000-8000-000000000763', 'f0000000-0000-4000-8000-000000000742', 'Valeria Nina Quisbert', '7108742',
    'Asesor de Atención', 'Atención al cliente', 'Miraflores', 'c0000000-0000-4000-8000-000000000793', 'CTR-2024-742', 3200.00,
    DATE '2026-09-01', DATE '2026-09-30', 30, 30,
    0, 0, 0,
    3200.00, 406.72, 2793.28, 534.72
  ),
  (
    'c0000000-0000-4000-8000-000000000782', 'c0000000-0000-4000-8000-000000000764', 'f0000000-0000-4000-8000-000000000742', 'Valeria Nina Quisbert', '7108742',
    'Asesor de Atención', 'Atención al cliente', 'Miraflores', 'c0000000-0000-4000-8000-000000000793', 'CTR-2024-742', 3200.00,
    DATE '2026-10-01', DATE '2026-10-31', 30, 30,
    630, 0, 900,
    3530.00, 448.66, 3081.34, 589.86
  ),
  (
    'c0000000-0000-4000-8000-000000000783', 'c0000000-0000-4000-8000-000000000761', 'f0000000-0000-4000-8000-000000000743', 'Rodrigo Apaza Calle', '7108743',
    'Cajero', 'Atención al cliente', 'Miraflores', 'c0000000-0000-4000-8000-000000000794', 'CTR-2021-743', 4000.00,
    DATE '2026-07-01', DATE '2026-07-31', 30, 30,
    0, 0, 0,
    4250.00, 540.18, 3709.82, 710.18
  ),
  (
    'c0000000-0000-4000-8000-000000000784', 'c0000000-0000-4000-8000-000000000762', 'f0000000-0000-4000-8000-000000000743', 'Rodrigo Apaza Calle', '7108743',
    'Cajero', 'Atención al cliente', 'Miraflores', 'c0000000-0000-4000-8000-000000000794', 'CTR-2021-743', 4000.00,
    DATE '2026-08-01', DATE '2026-08-31', 30, 30,
    0, 0, 0,
    4600.00, 584.66, 4015.34, 768.66
  ),
  (
    'c0000000-0000-4000-8000-000000000785', 'c0000000-0000-4000-8000-000000000763', 'f0000000-0000-4000-8000-000000000743', 'Rodrigo Apaza Calle', '7108743',
    'Cajero', 'Atención al cliente', 'Miraflores', 'c0000000-0000-4000-8000-000000000794', 'CTR-2021-743', 4400.00,
    DATE '2026-09-01', DATE '2026-09-30', 30, 30,
    0, 0, 0,
    4650.00, 591.02, 4058.98, 777.02
  ),
  (
    'c0000000-0000-4000-8000-000000000786', 'c0000000-0000-4000-8000-000000000764', 'f0000000-0000-4000-8000-000000000743', 'Rodrigo Apaza Calle', '7108743',
    'Cajero', 'Atención al cliente', 'Miraflores', 'c0000000-0000-4000-8000-000000000794', 'CTR-2021-743', 4400.00,
    DATE '2026-10-01', DATE '2026-10-31', 30, 30,
    300, 0, 0,
    4833.33, 614.32, 4219.01, 807.65
  ),
  (
    'c0000000-0000-4000-8000-000000000787', 'c0000000-0000-4000-8000-000000000763', 'f0000000-0000-4000-8000-000000000744', 'Fernando Choque Ticona', '7108744',
    'Asesor de Atención', 'Atención al cliente', 'Sopocachi', 'c0000000-0000-4000-8000-000000000795', 'CTR-2026-744', 3000.00,
    DATE '2026-09-01', DATE '2026-09-30', 30, 30,
    0, 0, 0,
    3000.00, 381.30, 2618.70, 501.30
  ),
  (
    'c0000000-0000-4000-8000-000000000788', 'c0000000-0000-4000-8000-000000000764', 'f0000000-0000-4000-8000-000000000744', 'Fernando Choque Ticona', '7108744',
    'Asesor de Atención', 'Atención al cliente', 'Sopocachi', 'c0000000-0000-4000-8000-000000000795', 'CTR-2026-744', 3000.00,
    DATE '2026-10-01', DATE '2026-10-31', 30, 30,
    300, 0, 0,
    3125.00, 397.20, 2727.80, 522.19
  )
ON CONFLICT DO NOTHING;

INSERT INTO CALCULOS_PLANILLA (
  id_planilla_empleado, id_vigencia, orden, tipo, codigo, nombre,
  forma_calculo, base, cantidad, valor, resultado, detalle
) VALUES
  ('c0000000-0000-4000-8000-000000000771', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'HABER-BASICO' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 1, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 4500.00, 30.00, 100.0000, 4500.00, '30 de 30 días'),
  ('c0000000-0000-4000-8000-000000000771', NULL, 2, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 4500.00, 30.00, 11.0000, 400.00, '7 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-000000000771', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-VEJEZ' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 3, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 4900.00, NULL, 10.0000, 490.00, NULL),
  ('c0000000-0000-4000-8000-000000000771', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 4, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 4900.00, NULL, 1.7100, 83.79, NULL),
  ('c0000000-0000-4000-8000-000000000771', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-COMISION' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 5, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 4900.00, NULL, 0.5000, 24.50, NULL),
  ('c0000000-0000-4000-8000-000000000771', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 6, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 4900.00, NULL, 0.5000, 24.50, NULL),
  ('c0000000-0000-4000-8000-000000000771', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'CNS-SALUD' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 7, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 4900.00, NULL, 10.0000, 490.00, NULL),
  ('c0000000-0000-4000-8000-000000000771', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO-PROF' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 8, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 4900.00, NULL, 1.7100, 83.79, NULL),
  ('c0000000-0000-4000-8000-000000000771', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'PRO-VIVIENDA' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 9, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 4900.00, NULL, 2.0000, 98.00, NULL),
  ('c0000000-0000-4000-8000-000000000771', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO-PAT' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 10, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 4900.00, NULL, 3.0000, 147.00, NULL),
  ('c0000000-0000-4000-8000-000000000772', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'HABER-BASICO' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 1, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 4500.00, 30.00, 100.0000, 4500.00, '30 de 30 días'),
  ('c0000000-0000-4000-8000-000000000772', NULL, 2, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 4500.00, 30.00, 11.0000, 400.00, '7 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-000000000772', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'HORAS-EXTRA' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 3, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 18.75, 10.00, 100.0000, 375.00, '10 h a Bs 18,75 la hora'),
  ('c0000000-0000-4000-8000-000000000772', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-VEJEZ' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 4, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 5275.00, NULL, 10.0000, 527.50, NULL),
  ('c0000000-0000-4000-8000-000000000772', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 5, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 5275.00, NULL, 1.7100, 90.20, NULL),
  ('c0000000-0000-4000-8000-000000000772', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-COMISION' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 6, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 5275.00, NULL, 0.5000, 26.38, NULL),
  ('c0000000-0000-4000-8000-000000000772', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 7, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 5275.00, NULL, 0.5000, 26.38, NULL),
  ('c0000000-0000-4000-8000-000000000772', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'CNS-SALUD' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 8, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 5275.00, NULL, 10.0000, 527.50, NULL),
  ('c0000000-0000-4000-8000-000000000772', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO-PROF' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 9, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 5275.00, NULL, 1.7100, 90.20, NULL),
  ('c0000000-0000-4000-8000-000000000772', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'PRO-VIVIENDA' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 10, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 5275.00, NULL, 2.0000, 105.50, NULL),
  ('c0000000-0000-4000-8000-000000000772', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO-PAT' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 11, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 5275.00, NULL, 3.0000, 158.25, NULL),
  ('c0000000-0000-4000-8000-000000000773', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'HABER-BASICO' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 1, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 4500.00, 30.00, 100.0000, 4500.00, '30 de 30 días'),
  ('c0000000-0000-4000-8000-000000000773', NULL, 2, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 4500.00, 30.00, 11.0000, 400.00, '7 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-000000000773', NULL, 3, 'INGRESO', 'BONO-PRODUCTIVIDAD', 'Bono de productividad', 'MONTO_FIJO', NULL, 1.00, 300.0000, 300.00, 'Bono por cumplimiento de meta'),
  ('c0000000-0000-4000-8000-000000000773', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-VEJEZ' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 4, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 5200.00, NULL, 10.0000, 520.00, NULL),
  ('c0000000-0000-4000-8000-000000000773', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 5, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 5200.00, NULL, 1.7100, 88.92, NULL),
  ('c0000000-0000-4000-8000-000000000773', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-COMISION' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 6, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 5200.00, NULL, 0.5000, 26.00, NULL),
  ('c0000000-0000-4000-8000-000000000773', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 7, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 5200.00, NULL, 0.5000, 26.00, NULL),
  ('c0000000-0000-4000-8000-000000000773', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'CNS-SALUD' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 8, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 5200.00, NULL, 10.0000, 520.00, NULL),
  ('c0000000-0000-4000-8000-000000000773', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO-PROF' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 9, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 5200.00, NULL, 1.7100, 88.92, NULL),
  ('c0000000-0000-4000-8000-000000000773', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'PRO-VIVIENDA' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 10, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 5200.00, NULL, 2.0000, 104.00, NULL),
  ('c0000000-0000-4000-8000-000000000773', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO-PAT' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 11, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 5200.00, NULL, 3.0000, 156.00, NULL),
  ('c0000000-0000-4000-8000-000000000774', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'HABER-BASICO' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 1, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 4500.00, 15.00, 100.0000, 2250.00, '15 de 30 días'),
  ('c0000000-0000-4000-8000-000000000774', NULL, 2, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 4500.00, 15.00, 11.0000, 200.00, '7 años de servicio · 15 de 30 días'),
  ('c0000000-0000-4000-8000-000000000774', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-VEJEZ' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 3, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 2450.00, NULL, 10.0000, 245.00, NULL),
  ('c0000000-0000-4000-8000-000000000774', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 4, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 2450.00, NULL, 1.7100, 41.90, NULL),
  ('c0000000-0000-4000-8000-000000000774', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-COMISION' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 5, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 2450.00, NULL, 0.5000, 12.25, NULL),
  ('c0000000-0000-4000-8000-000000000774', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 6, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 2450.00, NULL, 0.5000, 12.25, NULL),
  ('c0000000-0000-4000-8000-000000000774', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'CNS-SALUD' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 7, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 2450.00, NULL, 10.0000, 245.00, NULL),
  ('c0000000-0000-4000-8000-000000000774', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO-PROF' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 8, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 2450.00, NULL, 1.7100, 41.90, NULL),
  ('c0000000-0000-4000-8000-000000000774', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'PRO-VIVIENDA' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 9, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 2450.00, NULL, 2.0000, 49.00, NULL),
  ('c0000000-0000-4000-8000-000000000774', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO-PAT' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 10, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 2450.00, NULL, 3.0000, 73.50, NULL),
  ('c0000000-0000-4000-8000-000000000775', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'HABER-BASICO' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 1, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 3800.00, 30.00, 100.0000, 3800.00, '30 de 30 días'),
  ('c0000000-0000-4000-8000-000000000775', NULL, 2, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 3800.00, 30.00, 5.0000, 250.00, '4 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-000000000775', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-VEJEZ' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 3, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 4050.00, NULL, 10.0000, 405.00, NULL),
  ('c0000000-0000-4000-8000-000000000775', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 4, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 4050.00, NULL, 1.7100, 69.26, NULL),
  ('c0000000-0000-4000-8000-000000000775', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-COMISION' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 5, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 4050.00, NULL, 0.5000, 20.25, NULL),
  ('c0000000-0000-4000-8000-000000000775', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 6, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 4050.00, NULL, 0.5000, 20.25, NULL),
  ('c0000000-0000-4000-8000-000000000775', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'CNS-SALUD' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 7, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 4050.00, NULL, 10.0000, 405.00, NULL),
  ('c0000000-0000-4000-8000-000000000775', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO-PROF' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 8, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 4050.00, NULL, 1.7100, 69.26, NULL),
  ('c0000000-0000-4000-8000-000000000775', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'PRO-VIVIENDA' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 9, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 4050.00, NULL, 2.0000, 81.00, NULL),
  ('c0000000-0000-4000-8000-000000000775', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO-PAT' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 10, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 4050.00, NULL, 3.0000, 121.50, NULL),
  ('c0000000-0000-4000-8000-000000000776', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'HABER-BASICO' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 1, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 3800.00, 30.00, 100.0000, 3800.00, '30 de 30 días'),
  ('c0000000-0000-4000-8000-000000000776', NULL, 2, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 3800.00, 30.00, 5.0000, 250.00, '4 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-000000000776', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'DOMINICAL' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 3, 'INGRESO', 'DOMINICAL', 'Domingos, feriados y descansos trabajados', 'PORCENTAJE', 15.83, 10.00, 100.0000, 158.33, '10 h a Bs 15,83 la hora'),
  ('c0000000-0000-4000-8000-000000000776', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-VEJEZ' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 4, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 4208.33, NULL, 10.0000, 420.83, NULL),
  ('c0000000-0000-4000-8000-000000000776', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 5, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 4208.33, NULL, 1.7100, 71.96, NULL),
  ('c0000000-0000-4000-8000-000000000776', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-COMISION' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 6, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 4208.33, NULL, 0.5000, 21.04, NULL),
  ('c0000000-0000-4000-8000-000000000776', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 7, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 4208.33, NULL, 0.5000, 21.04, NULL),
  ('c0000000-0000-4000-8000-000000000776', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'CNS-SALUD' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 8, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 4208.33, NULL, 10.0000, 420.83, NULL),
  ('c0000000-0000-4000-8000-000000000776', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO-PROF' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 9, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 4208.33, NULL, 1.7100, 71.96, NULL),
  ('c0000000-0000-4000-8000-000000000776', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'PRO-VIVIENDA' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 10, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 4208.33, NULL, 2.0000, 84.17, NULL),
  ('c0000000-0000-4000-8000-000000000776', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO-PAT' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 11, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 4208.33, NULL, 3.0000, 126.25, NULL),
  ('c0000000-0000-4000-8000-000000000777', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'HABER-BASICO' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 1, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 3800.00, 30.00, 100.0000, 3800.00, '30 de 30 días'),
  ('c0000000-0000-4000-8000-000000000777', NULL, 2, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 3800.00, 30.00, 5.0000, 250.00, '4 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-000000000777', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-VEJEZ' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 3, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 4050.00, NULL, 10.0000, 405.00, NULL),
  ('c0000000-0000-4000-8000-000000000777', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 4, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 4050.00, NULL, 1.7100, 69.26, NULL),
  ('c0000000-0000-4000-8000-000000000777', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-COMISION' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 5, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 4050.00, NULL, 0.5000, 20.25, NULL),
  ('c0000000-0000-4000-8000-000000000777', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 6, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 4050.00, NULL, 0.5000, 20.25, NULL),
  ('c0000000-0000-4000-8000-000000000777', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'CNS-SALUD' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 7, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 4050.00, NULL, 10.0000, 405.00, NULL),
  ('c0000000-0000-4000-8000-000000000777', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO-PROF' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 8, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 4050.00, NULL, 1.7100, 69.26, NULL),
  ('c0000000-0000-4000-8000-000000000777', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'PRO-VIVIENDA' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 9, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 4050.00, NULL, 2.0000, 81.00, NULL),
  ('c0000000-0000-4000-8000-000000000777', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO-PAT' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 10, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 4050.00, NULL, 3.0000, 121.50, NULL),
  ('c0000000-0000-4000-8000-000000000778', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'HABER-BASICO' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 1, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 3800.00, 20.00, 100.0000, 2533.33, '20 de 30 días'),
  ('c0000000-0000-4000-8000-000000000778', NULL, 2, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 3800.00, 20.00, 5.0000, 166.67, '4 años de servicio · 20 de 30 días'),
  ('c0000000-0000-4000-8000-000000000778', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-VEJEZ' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 3, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 2700.00, NULL, 10.0000, 270.00, NULL),
  ('c0000000-0000-4000-8000-000000000778', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 4, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 2700.00, NULL, 1.7100, 46.17, NULL),
  ('c0000000-0000-4000-8000-000000000778', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-COMISION' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 5, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 2700.00, NULL, 0.5000, 13.50, NULL),
  ('c0000000-0000-4000-8000-000000000778', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 6, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 2700.00, NULL, 0.5000, 13.50, NULL),
  ('c0000000-0000-4000-8000-000000000778', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'CNS-SALUD' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 7, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 2700.00, NULL, 10.0000, 270.00, NULL),
  ('c0000000-0000-4000-8000-000000000778', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO-PROF' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 8, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 2700.00, NULL, 1.7100, 46.17, NULL),
  ('c0000000-0000-4000-8000-000000000778', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'PRO-VIVIENDA' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 9, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 2700.00, NULL, 2.0000, 54.00, NULL),
  ('c0000000-0000-4000-8000-000000000778', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO-PAT' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 10, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 2700.00, NULL, 3.0000, 81.00, NULL),
  ('c0000000-0000-4000-8000-000000000779', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'HABER-BASICO' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 1, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 3200.00, 30.00, 100.0000, 3200.00, '30 de 30 días'),
  ('c0000000-0000-4000-8000-000000000779', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'HORAS-EXTRA' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 2, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 13.33, 7.50, 100.0000, 200.00, '7,5 h a Bs 13,33 la hora'),
  ('c0000000-0000-4000-8000-000000000779', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-VEJEZ' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 3, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 3400.00, NULL, 10.0000, 340.00, NULL),
  ('c0000000-0000-4000-8000-000000000779', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 4, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 3400.00, NULL, 1.7100, 58.14, NULL),
  ('c0000000-0000-4000-8000-000000000779', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-COMISION' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 5, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 3400.00, NULL, 0.5000, 17.00, NULL),
  ('c0000000-0000-4000-8000-000000000779', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 6, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 3400.00, NULL, 0.5000, 17.00, NULL),
  ('c0000000-0000-4000-8000-000000000779', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'CNS-SALUD' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 7, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 3400.00, NULL, 10.0000, 340.00, NULL),
  ('c0000000-0000-4000-8000-000000000779', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO-PROF' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 8, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 3400.00, NULL, 1.7100, 58.14, NULL),
  ('c0000000-0000-4000-8000-000000000779', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'PRO-VIVIENDA' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 9, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 3400.00, NULL, 2.0000, 68.00, NULL),
  ('c0000000-0000-4000-8000-000000000779', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO-PAT' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 10, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 3400.00, NULL, 3.0000, 102.00, NULL),
  ('c0000000-0000-4000-8000-000000000780', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'HABER-BASICO' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 1, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 3200.00, 30.00, 100.0000, 3200.00, '30 de 30 días'),
  ('c0000000-0000-4000-8000-000000000780', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'HORAS-EXTRA' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 2, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 13.33, 4.50, 100.0000, 120.00, '4,5 h a Bs 13,33 la hora'),
  ('c0000000-0000-4000-8000-000000000780', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-VEJEZ' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 3, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 3320.00, NULL, 10.0000, 332.00, NULL),
  ('c0000000-0000-4000-8000-000000000780', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 4, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 3320.00, NULL, 1.7100, 56.77, NULL),
  ('c0000000-0000-4000-8000-000000000780', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-COMISION' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 5, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 3320.00, NULL, 0.5000, 16.60, NULL),
  ('c0000000-0000-4000-8000-000000000780', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 6, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 3320.00, NULL, 0.5000, 16.60, NULL),
  ('c0000000-0000-4000-8000-000000000780', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'CNS-SALUD' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 7, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 3320.00, NULL, 10.0000, 332.00, NULL),
  ('c0000000-0000-4000-8000-000000000780', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO-PROF' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 8, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 3320.00, NULL, 1.7100, 56.77, NULL),
  ('c0000000-0000-4000-8000-000000000780', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'PRO-VIVIENDA' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 9, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 3320.00, NULL, 2.0000, 66.40, NULL),
  ('c0000000-0000-4000-8000-000000000780', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO-PAT' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 10, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 3320.00, NULL, 3.0000, 99.60, NULL),
  ('c0000000-0000-4000-8000-000000000781', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'HABER-BASICO' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 1, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 3200.00, 30.00, 100.0000, 3200.00, '30 de 30 días'),
  ('c0000000-0000-4000-8000-000000000781', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-VEJEZ' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 2, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 3200.00, NULL, 10.0000, 320.00, NULL),
  ('c0000000-0000-4000-8000-000000000781', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 3, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 3200.00, NULL, 1.7100, 54.72, NULL),
  ('c0000000-0000-4000-8000-000000000781', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-COMISION' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 4, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 3200.00, NULL, 0.5000, 16.00, NULL),
  ('c0000000-0000-4000-8000-000000000781', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 5, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 3200.00, NULL, 0.5000, 16.00, NULL),
  ('c0000000-0000-4000-8000-000000000781', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'CNS-SALUD' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 6, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 3200.00, NULL, 10.0000, 320.00, NULL),
  ('c0000000-0000-4000-8000-000000000781', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO-PROF' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 7, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 3200.00, NULL, 1.7100, 54.72, NULL),
  ('c0000000-0000-4000-8000-000000000781', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'PRO-VIVIENDA' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 8, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 3200.00, NULL, 2.0000, 64.00, NULL),
  ('c0000000-0000-4000-8000-000000000781', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO-PAT' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 9, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 3200.00, NULL, 3.0000, 96.00, NULL),
  ('c0000000-0000-4000-8000-000000000782', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'HABER-BASICO' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 1, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 3200.00, 30.00, 100.0000, 3200.00, '30 de 30 días'),
  ('c0000000-0000-4000-8000-000000000782', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'HORAS-EXTRA' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 2, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 13.33, 10.50, 100.0000, 280.00, '10,5 h a Bs 13,33 la hora'),
  ('c0000000-0000-4000-8000-000000000782', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'RECARGO-NOCTURNO' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 3, 'INGRESO', 'RECARGO-NOCTURNO', 'Recargo nocturno', 'PORCENTAJE', 13.33, 15.00, 25.0000, 50.00, '15 h a Bs 13,33 la hora'),
  ('c0000000-0000-4000-8000-000000000782', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-VEJEZ' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 4, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 3530.00, NULL, 10.0000, 353.00, NULL),
  ('c0000000-0000-4000-8000-000000000782', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 5, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 3530.00, NULL, 1.7100, 60.36, NULL),
  ('c0000000-0000-4000-8000-000000000782', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-COMISION' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 6, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 3530.00, NULL, 0.5000, 17.65, NULL),
  ('c0000000-0000-4000-8000-000000000782', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 7, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 3530.00, NULL, 0.5000, 17.65, NULL),
  ('c0000000-0000-4000-8000-000000000782', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'CNS-SALUD' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 8, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 3530.00, NULL, 10.0000, 353.00, NULL),
  ('c0000000-0000-4000-8000-000000000782', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO-PROF' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 9, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 3530.00, NULL, 1.7100, 60.36, NULL),
  ('c0000000-0000-4000-8000-000000000782', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'PRO-VIVIENDA' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 10, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 3530.00, NULL, 2.0000, 70.60, NULL),
  ('c0000000-0000-4000-8000-000000000782', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO-PAT' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 11, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 3530.00, NULL, 3.0000, 105.90, NULL),
  ('c0000000-0000-4000-8000-000000000783', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'HABER-BASICO' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 1, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 4000.00, 30.00, 100.0000, 4000.00, '30 de 30 días'),
  ('c0000000-0000-4000-8000-000000000783', NULL, 2, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 4000.00, 30.00, 11.0000, 250.00, '5 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-000000000783', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-VEJEZ' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 3, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 4250.00, NULL, 10.0000, 425.00, NULL),
  ('c0000000-0000-4000-8000-000000000783', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 4, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 4250.00, NULL, 1.7100, 72.68, NULL),
  ('c0000000-0000-4000-8000-000000000783', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-COMISION' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 5, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 4250.00, NULL, 0.5000, 21.25, NULL),
  ('c0000000-0000-4000-8000-000000000783', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 6, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 4250.00, NULL, 0.5000, 21.25, NULL),
  ('c0000000-0000-4000-8000-000000000783', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'CNS-SALUD' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 7, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 4250.00, NULL, 10.0000, 425.00, NULL),
  ('c0000000-0000-4000-8000-000000000783', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO-PROF' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 8, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 4250.00, NULL, 1.7100, 72.68, NULL),
  ('c0000000-0000-4000-8000-000000000783', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'PRO-VIVIENDA' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 9, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 4250.00, NULL, 2.0000, 85.00, NULL),
  ('c0000000-0000-4000-8000-000000000783', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO-PAT' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 10, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 4250.00, NULL, 3.0000, 127.50, NULL),
  ('c0000000-0000-4000-8000-000000000784', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'HABER-BASICO' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 1, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 4000.00, 30.00, 100.0000, 4000.00, '30 de 30 días'),
  ('c0000000-0000-4000-8000-000000000784', NULL, 2, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 4000.00, 30.00, 11.0000, 250.00, '5 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-000000000784', NULL, 3, 'INGRESO', 'BONO-PRODUCTIVIDAD', 'Bono de productividad', 'MONTO_FIJO', NULL, 1.00, 350.0000, 350.00, 'Bono por cumplimiento de meta'),
  ('c0000000-0000-4000-8000-000000000784', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-VEJEZ' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 4, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 4600.00, NULL, 10.0000, 460.00, NULL),
  ('c0000000-0000-4000-8000-000000000784', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 5, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 4600.00, NULL, 1.7100, 78.66, NULL),
  ('c0000000-0000-4000-8000-000000000784', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-COMISION' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 6, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 4600.00, NULL, 0.5000, 23.00, NULL),
  ('c0000000-0000-4000-8000-000000000784', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 7, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 4600.00, NULL, 0.5000, 23.00, NULL),
  ('c0000000-0000-4000-8000-000000000784', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'CNS-SALUD' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 8, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 4600.00, NULL, 10.0000, 460.00, NULL),
  ('c0000000-0000-4000-8000-000000000784', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO-PROF' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 9, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 4600.00, NULL, 1.7100, 78.66, NULL),
  ('c0000000-0000-4000-8000-000000000784', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'PRO-VIVIENDA' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 10, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 4600.00, NULL, 2.0000, 92.00, NULL),
  ('c0000000-0000-4000-8000-000000000784', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO-PAT' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 11, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 4600.00, NULL, 3.0000, 138.00, NULL),
  ('c0000000-0000-4000-8000-000000000785', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'HABER-BASICO' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 1, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 4400.00, 30.00, 100.0000, 4400.00, '30 de 30 días'),
  ('c0000000-0000-4000-8000-000000000785', NULL, 2, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 4400.00, 30.00, 11.0000, 250.00, '5 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-000000000785', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-VEJEZ' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 3, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 4650.00, NULL, 10.0000, 465.00, NULL),
  ('c0000000-0000-4000-8000-000000000785', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 4, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 4650.00, NULL, 1.7100, 79.52, NULL),
  ('c0000000-0000-4000-8000-000000000785', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-COMISION' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 5, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 4650.00, NULL, 0.5000, 23.25, NULL),
  ('c0000000-0000-4000-8000-000000000785', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 6, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 4650.00, NULL, 0.5000, 23.25, NULL),
  ('c0000000-0000-4000-8000-000000000785', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'CNS-SALUD' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 7, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 4650.00, NULL, 10.0000, 465.00, NULL),
  ('c0000000-0000-4000-8000-000000000785', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO-PROF' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 8, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 4650.00, NULL, 1.7100, 79.52, NULL),
  ('c0000000-0000-4000-8000-000000000785', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'PRO-VIVIENDA' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 9, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 4650.00, NULL, 2.0000, 93.00, NULL),
  ('c0000000-0000-4000-8000-000000000785', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO-PAT' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 10, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 4650.00, NULL, 3.0000, 139.50, NULL),
  ('c0000000-0000-4000-8000-000000000786', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'HABER-BASICO' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 1, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 4400.00, 30.00, 100.0000, 4400.00, '30 de 30 días'),
  ('c0000000-0000-4000-8000-000000000786', NULL, 2, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 4400.00, 30.00, 11.0000, 250.00, '5 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-000000000786', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'HORAS-EXTRA' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 3, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 18.33, 5.00, 100.0000, 183.33, '5 h a Bs 18,33 la hora'),
  ('c0000000-0000-4000-8000-000000000786', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-VEJEZ' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 4, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 4833.33, NULL, 10.0000, 483.33, NULL),
  ('c0000000-0000-4000-8000-000000000786', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 5, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 4833.33, NULL, 1.7100, 82.65, NULL),
  ('c0000000-0000-4000-8000-000000000786', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-COMISION' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 6, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 4833.33, NULL, 0.5000, 24.17, NULL),
  ('c0000000-0000-4000-8000-000000000786', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 7, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 4833.33, NULL, 0.5000, 24.17, NULL),
  ('c0000000-0000-4000-8000-000000000786', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'CNS-SALUD' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 8, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 4833.33, NULL, 10.0000, 483.33, NULL),
  ('c0000000-0000-4000-8000-000000000786', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO-PROF' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 9, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 4833.33, NULL, 1.7100, 82.65, NULL),
  ('c0000000-0000-4000-8000-000000000786', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'PRO-VIVIENDA' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 10, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 4833.33, NULL, 2.0000, 96.67, NULL),
  ('c0000000-0000-4000-8000-000000000786', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO-PAT' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 11, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 4833.33, NULL, 3.0000, 145.00, NULL),
  ('c0000000-0000-4000-8000-000000000787', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'HABER-BASICO' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 1, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 3000.00, 30.00, 100.0000, 3000.00, '30 de 30 días'),
  ('c0000000-0000-4000-8000-000000000787', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-VEJEZ' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 2, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 3000.00, NULL, 10.0000, 300.00, NULL),
  ('c0000000-0000-4000-8000-000000000787', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 3, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 3000.00, NULL, 1.7100, 51.30, NULL),
  ('c0000000-0000-4000-8000-000000000787', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-COMISION' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 4, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 3000.00, NULL, 0.5000, 15.00, NULL),
  ('c0000000-0000-4000-8000-000000000787', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 5, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 3000.00, NULL, 0.5000, 15.00, NULL),
  ('c0000000-0000-4000-8000-000000000787', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'CNS-SALUD' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 6, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 3000.00, NULL, 10.0000, 300.00, NULL),
  ('c0000000-0000-4000-8000-000000000787', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO-PROF' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 7, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 3000.00, NULL, 1.7100, 51.30, NULL),
  ('c0000000-0000-4000-8000-000000000787', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'PRO-VIVIENDA' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 8, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 3000.00, NULL, 2.0000, 60.00, NULL),
  ('c0000000-0000-4000-8000-000000000787', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO-PAT' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 9, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 3000.00, NULL, 3.0000, 90.00, NULL),
  ('c0000000-0000-4000-8000-000000000788', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'HABER-BASICO' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 1, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 3000.00, 30.00, 100.0000, 3000.00, '30 de 30 días'),
  ('c0000000-0000-4000-8000-000000000788', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'HORAS-EXTRA' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 2, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 12.50, 5.00, 100.0000, 125.00, '5 h a Bs 12,50 la hora'),
  ('c0000000-0000-4000-8000-000000000788', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-VEJEZ' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 3, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 3125.00, NULL, 10.0000, 312.50, NULL),
  ('c0000000-0000-4000-8000-000000000788', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 4, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 3125.00, NULL, 1.7100, 53.44, NULL),
  ('c0000000-0000-4000-8000-000000000788', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-COMISION' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 5, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 3125.00, NULL, 0.5000, 15.63, NULL),
  ('c0000000-0000-4000-8000-000000000788', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 6, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 3125.00, NULL, 0.5000, 15.63, NULL),
  ('c0000000-0000-4000-8000-000000000788', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'CNS-SALUD' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 7, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 3125.00, NULL, 10.0000, 312.50, NULL),
  ('c0000000-0000-4000-8000-000000000788', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO-PROF' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 8, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 3125.00, NULL, 1.7100, 53.44, NULL),
  ('c0000000-0000-4000-8000-000000000788', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'PRO-VIVIENDA' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 9, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 3125.00, NULL, 2.0000, 62.50, NULL),
  ('c0000000-0000-4000-8000-000000000788', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO-PAT' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 10, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 3125.00, NULL, 3.0000, 93.75, NULL)
ON CONFLICT DO NOTHING;

COMMIT;

-- Colaboradora ACTIVA con planillas cerradas y SIN proceso de desvinculación, para probar el flujo completo
-- desde la pantalla: registrar su baja (proceso INICIADO) -> calcular el sueldo promedio (pasa a EN_CURSO).
--   - Gabriela Rocha Mendoza (...745): mismos montos que Valeria Nina Quisbert de 2026-07 a 2026-10.
--     Con retiro en 2026-11, el promedio es 3350.00 con la observación de que no hay planilla cerrada de 2026-11;
--     con retiro en 2026-10, el promedio es 3350.00 sin observaciones.
-- Requiere el bloque anterior (planillas c...761 a c...764) y que Gabriela exista en EmployeeDB.
BEGIN;

INSERT INTO PLANILLA_EMPLEADOS (
  id_planilla_empleado, id_planilla, id_empleado, nombre_empleado, numero_documento,
  cargo, area, sucursal, id_contrato, numero_contrato, haber_mensual,
  contrato_desde, contrato_hasta, dias_contrato, dias_pagados,
  minutos_extra_habil, minutos_domingo, minutos_nocturnos,
  total_ganado, total_descuentos, liquido_pagable, total_aportes
) VALUES
  (
    'c0000000-0000-4000-8000-000000000801', 'c0000000-0000-4000-8000-000000000761', 'f0000000-0000-4000-8000-000000000745', 'Gabriela Rocha Mendoza', '7108745',
    'Asesor de Atención', 'Atención al cliente', 'Miraflores', 'c0000000-0000-4000-8000-000000000796', 'CTR-2025-745', 3200.00,
    DATE '2026-07-01', DATE '2026-07-31', 30, 30,
    450, 0, 0,
    3400.00, 432.14, 2967.86, 568.14
  ),
  (
    'c0000000-0000-4000-8000-000000000802', 'c0000000-0000-4000-8000-000000000762', 'f0000000-0000-4000-8000-000000000745', 'Gabriela Rocha Mendoza', '7108745',
    'Asesor de Atención', 'Atención al cliente', 'Miraflores', 'c0000000-0000-4000-8000-000000000796', 'CTR-2025-745', 3200.00,
    DATE '2026-08-01', DATE '2026-08-31', 30, 30,
    270, 0, 0,
    3320.00, 421.97, 2898.03, 554.77
  ),
  (
    'c0000000-0000-4000-8000-000000000803', 'c0000000-0000-4000-8000-000000000763', 'f0000000-0000-4000-8000-000000000745', 'Gabriela Rocha Mendoza', '7108745',
    'Asesor de Atención', 'Atención al cliente', 'Miraflores', 'c0000000-0000-4000-8000-000000000796', 'CTR-2025-745', 3200.00,
    DATE '2026-09-01', DATE '2026-09-30', 30, 30,
    0, 0, 0,
    3200.00, 406.72, 2793.28, 534.72
  ),
  (
    'c0000000-0000-4000-8000-000000000804', 'c0000000-0000-4000-8000-000000000764', 'f0000000-0000-4000-8000-000000000745', 'Gabriela Rocha Mendoza', '7108745',
    'Asesor de Atención', 'Atención al cliente', 'Miraflores', 'c0000000-0000-4000-8000-000000000796', 'CTR-2025-745', 3200.00,
    DATE '2026-10-01', DATE '2026-10-31', 30, 30,
    630, 0, 900,
    3530.00, 448.66, 3081.34, 589.86
  )
ON CONFLICT DO NOTHING;

INSERT INTO CALCULOS_PLANILLA (
  id_planilla_empleado, id_vigencia, orden, tipo, codigo, nombre,
  forma_calculo, base, cantidad, valor, resultado, detalle
) VALUES
  ('c0000000-0000-4000-8000-000000000801', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'HABER-BASICO' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 1, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 3200.00, 30.00, 100.0000, 3200.00, '30 de 30 días'),
  ('c0000000-0000-4000-8000-000000000801', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'HORAS-EXTRA' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 2, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 13.33, 7.50, 100.0000, 200.00, '7,5 h a Bs 13,33 la hora'),
  ('c0000000-0000-4000-8000-000000000801', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-VEJEZ' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 3, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 3400.00, NULL, 10.0000, 340.00, NULL),
  ('c0000000-0000-4000-8000-000000000801', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 4, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 3400.00, NULL, 1.7100, 58.14, NULL),
  ('c0000000-0000-4000-8000-000000000801', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-COMISION' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 5, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 3400.00, NULL, 0.5000, 17.00, NULL),
  ('c0000000-0000-4000-8000-000000000801', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 6, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 3400.00, NULL, 0.5000, 17.00, NULL),
  ('c0000000-0000-4000-8000-000000000801', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'CNS-SALUD' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 7, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 3400.00, NULL, 10.0000, 340.00, NULL),
  ('c0000000-0000-4000-8000-000000000801', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO-PROF' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 8, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 3400.00, NULL, 1.7100, 58.14, NULL),
  ('c0000000-0000-4000-8000-000000000801', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'PRO-VIVIENDA' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 9, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 3400.00, NULL, 2.0000, 68.00, NULL),
  ('c0000000-0000-4000-8000-000000000801', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO-PAT' AND v.vigente_desde <= DATE '2026-07-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-07-31') LIMIT 1), 10, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 3400.00, NULL, 3.0000, 102.00, NULL),
  ('c0000000-0000-4000-8000-000000000802', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'HABER-BASICO' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 1, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 3200.00, 30.00, 100.0000, 3200.00, '30 de 30 días'),
  ('c0000000-0000-4000-8000-000000000802', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'HORAS-EXTRA' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 2, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 13.33, 4.50, 100.0000, 120.00, '4,5 h a Bs 13,33 la hora'),
  ('c0000000-0000-4000-8000-000000000802', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-VEJEZ' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 3, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 3320.00, NULL, 10.0000, 332.00, NULL),
  ('c0000000-0000-4000-8000-000000000802', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 4, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 3320.00, NULL, 1.7100, 56.77, NULL),
  ('c0000000-0000-4000-8000-000000000802', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-COMISION' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 5, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 3320.00, NULL, 0.5000, 16.60, NULL),
  ('c0000000-0000-4000-8000-000000000802', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 6, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 3320.00, NULL, 0.5000, 16.60, NULL),
  ('c0000000-0000-4000-8000-000000000802', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'CNS-SALUD' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 7, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 3320.00, NULL, 10.0000, 332.00, NULL),
  ('c0000000-0000-4000-8000-000000000802', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO-PROF' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 8, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 3320.00, NULL, 1.7100, 56.77, NULL),
  ('c0000000-0000-4000-8000-000000000802', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'PRO-VIVIENDA' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 9, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 3320.00, NULL, 2.0000, 66.40, NULL),
  ('c0000000-0000-4000-8000-000000000802', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO-PAT' AND v.vigente_desde <= DATE '2026-08-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-08-31') LIMIT 1), 10, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 3320.00, NULL, 3.0000, 99.60, NULL),
  ('c0000000-0000-4000-8000-000000000803', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'HABER-BASICO' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 1, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 3200.00, 30.00, 100.0000, 3200.00, '30 de 30 días'),
  ('c0000000-0000-4000-8000-000000000803', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-VEJEZ' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 2, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 3200.00, NULL, 10.0000, 320.00, NULL),
  ('c0000000-0000-4000-8000-000000000803', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 3, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 3200.00, NULL, 1.7100, 54.72, NULL),
  ('c0000000-0000-4000-8000-000000000803', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-COMISION' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 4, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 3200.00, NULL, 0.5000, 16.00, NULL),
  ('c0000000-0000-4000-8000-000000000803', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 5, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 3200.00, NULL, 0.5000, 16.00, NULL),
  ('c0000000-0000-4000-8000-000000000803', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'CNS-SALUD' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 6, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 3200.00, NULL, 10.0000, 320.00, NULL),
  ('c0000000-0000-4000-8000-000000000803', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO-PROF' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 7, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 3200.00, NULL, 1.7100, 54.72, NULL),
  ('c0000000-0000-4000-8000-000000000803', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'PRO-VIVIENDA' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 8, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 3200.00, NULL, 2.0000, 64.00, NULL),
  ('c0000000-0000-4000-8000-000000000803', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO-PAT' AND v.vigente_desde <= DATE '2026-09-30' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-09-30') LIMIT 1), 9, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 3200.00, NULL, 3.0000, 96.00, NULL),
  ('c0000000-0000-4000-8000-000000000804', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'HABER-BASICO' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 1, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 3200.00, 30.00, 100.0000, 3200.00, '30 de 30 días'),
  ('c0000000-0000-4000-8000-000000000804', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'HORAS-EXTRA' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 2, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 13.33, 10.50, 100.0000, 280.00, '10,5 h a Bs 13,33 la hora'),
  ('c0000000-0000-4000-8000-000000000804', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'RECARGO-NOCTURNO' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 3, 'INGRESO', 'RECARGO-NOCTURNO', 'Recargo nocturno', 'PORCENTAJE', 13.33, 15.00, 25.0000, 50.00, '15 h a Bs 13,33 la hora'),
  ('c0000000-0000-4000-8000-000000000804', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-VEJEZ' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 4, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 3530.00, NULL, 10.0000, 353.00, NULL),
  ('c0000000-0000-4000-8000-000000000804', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 5, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 3530.00, NULL, 1.7100, 60.36, NULL),
  ('c0000000-0000-4000-8000-000000000804', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-COMISION' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 6, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 3530.00, NULL, 0.5000, 17.65, NULL),
  ('c0000000-0000-4000-8000-000000000804', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 7, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 3530.00, NULL, 0.5000, 17.65, NULL),
  ('c0000000-0000-4000-8000-000000000804', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'CNS-SALUD' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 8, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 3530.00, NULL, 10.0000, 353.00, NULL),
  ('c0000000-0000-4000-8000-000000000804', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-RIESGO-PROF' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 9, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 3530.00, NULL, 1.7100, 60.36, NULL),
  ('c0000000-0000-4000-8000-000000000804', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'PRO-VIVIENDA' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 10, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 3530.00, NULL, 2.0000, 70.60, NULL),
  ('c0000000-0000-4000-8000-000000000804', (SELECT v.id_vigencia FROM VIGENCIAS_CONCEPTO v JOIN CONCEPTOS_PLANILLA c ON c.id_concepto = v.id_concepto WHERE c.codigo = 'SIP-SOLIDARIO-PAT' AND v.vigente_desde <= DATE '2026-10-31' AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= DATE '2026-10-31') LIMIT 1), 11, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 3530.00, NULL, 3.0000, 105.90, NULL)
ON CONFLICT DO NOTHING;

COMMIT;
