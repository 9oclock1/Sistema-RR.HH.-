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

-- Planilla tributaria y de aportes de ejemplo (RF-48, KAN-68): entidades con su formato de archivo, parametros
-- tributarios con vigencias (el salario minimo cambio el 1 de mayo de 2025), creditos fiscales declarados y dos planillas
-- mensuales CERRADAS (2026-04 y 2026-05) de 10 colaboradores, calculadas con las tasas vigentes del catalogo de conceptos.
--   Con salario minimo 2.750 el minimo no imponible es 5.500: solo pagan RC-IVA los 3 jefes (21, 22 y 23).
--   21 Marcela: declara facturas de Bs 1.200 en abril y 1.500 en mayo, el credito cubre parte del impuesto.
--   22 Jorge: no declara nada, se le retiene todo el impuesto.
--   23 Andrea: declara Bs 4.000 en abril, el credito supera el impuesto y le queda saldo a favor para mayo.
BEGIN;
INSERT INTO ENTIDADES_APORTE (codigo, nombre, formato_archivo, orden) VALUES
  ('LARGO_PLAZO', 'Gestora Publica de la Seguridad Social de Largo Plazo', 'TXT', 1),
  ('CAJA_SALUD', 'Caja Nacional de Salud', 'XLSX', 2),
  ('RIESGO_PROFESIONAL', 'Seguro de Riesgo Profesional', 'TXT', 3),
  ('VIVIENDA', 'Fondo de Vivienda (Pro-Vivienda)', 'XLSX', 4),
  ('SOLIDARIO', 'Fondo Solidario (aporte solidario y nacional solidario)', 'TXT', 5)
ON CONFLICT DO NOTHING;
INSERT INTO CONCEPTOS_ENTIDAD_APORTE (codigo_concepto, codigo_entidad, deduce_sueldo_neto) VALUES
  ('SIP-VEJEZ', 'LARGO_PLAZO', TRUE),
  ('SIP-RIESGO', 'LARGO_PLAZO', TRUE),
  ('SIP-COMISION', 'LARGO_PLAZO', TRUE),
  ('SIP-SOLIDARIO', 'SOLIDARIO', TRUE),
  ('SIP-SOLIDARIO-PAT', 'SOLIDARIO', FALSE),
  ('ANS-13000', 'SOLIDARIO', FALSE),
  ('ANS-25000', 'SOLIDARIO', FALSE),
  ('ANS-35000', 'SOLIDARIO', FALSE),
  ('CNS-SALUD', 'CAJA_SALUD', FALSE),
  ('SIP-RIESGO-PROF', 'RIESGO_PROFESIONAL', FALSE),
  ('PRO-VIVIENDA', 'VIVIENDA', FALSE)
ON CONFLICT DO NOTHING;
INSERT INTO PARAMETROS_TRIBUTARIOS (codigo, nombre, valor, vigente_desde, vigente_hasta) VALUES
  ('SALARIO_MINIMO_NACIONAL', 'Salario minimo nacional (Bs)', 2500, '2024-05-01', '2025-04-30'),
  ('SALARIO_MINIMO_NACIONAL', 'Salario minimo nacional (Bs)', 2750, '2025-05-01', NULL),
  ('MULTIPLO_MINIMO_NO_IMPONIBLE', 'Salarios minimos que forman el minimo no imponible', 2, '2000-01-01', NULL),
  ('ALICUOTA_RCIVA', 'Alicuota del RC-IVA (%)', 13, '2000-01-01', NULL),
  ('ALICUOTA_CREDITO_FISCAL', 'Alicuota del credito fiscal de las facturas (%)', 13, '2000-01-01', NULL)
ON CONFLICT DO NOTHING;
INSERT INTO CREDITOS_FISCALES_DECLARADOS (id_empleado, periodo, monto_facturas, saldo_anterior_favor) VALUES
  ('f0000000-0000-4000-8000-000000000021', '2026-04', 1200.00, 0),
  ('f0000000-0000-4000-8000-000000000021', '2026-05', 1500.00, 0),
  ('f0000000-0000-4000-8000-000000000023', '2026-04', 4000.00, 0),
  ('f0000000-0000-4000-8000-000000000023', '2026-05', 3000.00, 156.97),
  ('f0000000-0000-4000-8000-000000000024', '2026-04', 800.00, 0),
  ('f0000000-0000-4000-8000-000000000026', '2026-05', 500.00, 0)
ON CONFLICT DO NOTHING;
DO $$
DECLARE
  periodos text[] := ARRAY['2026-04', '2026-05'];
  p text;
  v_inicio date;
  v_fin date;
  v_planilla uuid;
  v_pe uuid;
  v_orden int;
  v_descuentos numeric(12,2);
  v_aportes numeric(12,2);
  emp record;
  c record;
BEGIN
  FOREACH p IN ARRAY periodos LOOP
    IF EXISTS (SELECT 1 FROM planillas WHERE periodo = p) THEN
      CONTINUE;
    END IF;
    v_inicio := to_date(p || '-01', 'YYYY-MM-DD');
    v_fin := (v_inicio + interval '1 month' - interval '1 day')::date;
    INSERT INTO planillas (
      periodo, fecha_inicio, fecha_fin, datos_hasta, estado, generada_por, generada_por_nombre, generada_en,
      aprobada_por, aprobada_por_nombre, aprobada_en, estado_contabilidad, estado_pagos, referencia_contabilidad,
      respondida_contabilidad_en, referencia_pagos, respondida_pagos_en, cerrada_en
    ) VALUES (
      p, v_inicio, v_fin, v_fin, 'CERRADA', 'f0000000-0000-4000-8000-000000000023', 'Andrea Salazar Vega',
      (v_fin + 1)::timestamptz + interval '9 hours', 'f0000000-0000-4000-8000-000000000023', 'Andrea Salazar Vega',
      (v_fin + 2)::timestamptz + interval '9 hours', 'CONFIRMADA', 'CONFIRMADA', 'ASI-' || replace(p, '-', ''),
      (v_fin + 2)::timestamptz + interval '10 hours', 'ORD-' || replace(p, '-', ''),
      (v_fin + 2)::timestamptz + interval '11 hours', (v_fin + 2)::timestamptz + interval '11 hours'
    ) RETURNING id_planilla INTO v_planilla;

    FOR emp IN
      SELECT * FROM (VALUES
        ('f0000000-0000-4000-8000-000000000021'::uuid, 'Marcela Quiroga Peña', '7102877', 'Jefe de Atención al Cliente', 'Atención al cliente', 'Sopocachi', 8500.00),
        ('f0000000-0000-4000-8000-000000000022'::uuid, 'Jorge Mamani Condori', '7103014', 'Jefe de Atención al Cliente', 'Atención al cliente', 'Miraflores', 8500.00),
        ('f0000000-0000-4000-8000-000000000023'::uuid, 'Andrea Salazar Vega', '7103151', 'Jefe de Recursos Humanos', 'Recursos Humanos', 'Sopocachi', 9500.00),
        ('f0000000-0000-4000-8000-000000000024'::uuid, 'Rosa Mendoza Ticona', '7103288', 'Supervisor de Cajas', 'Atención al cliente', 'Sopocachi', 5800.00),
        ('f0000000-0000-4000-8000-000000000025'::uuid, 'Luis Vargas Apaza', '7103425', 'Supervisor de Cajas', 'Atención al cliente', 'Miraflores', 5800.00),
        ('f0000000-0000-4000-8000-000000000026'::uuid, 'Sofía Condori Mamani', '7103562', 'Analista de Recursos Humanos', 'Recursos Humanos', 'Sopocachi', 5200.00),
        ('f0000000-0000-4000-8000-000000000031'::uuid, 'Carlos Rojas Vargas', '7104247', 'Cajero', 'Atención al cliente', 'Sopocachi', 3200.00),
        ('f0000000-0000-4000-8000-000000000032'::uuid, 'Lucía Flores Choque', '7104384', 'Cajero', 'Atención al cliente', 'Sopocachi', 3200.00),
        ('f0000000-0000-4000-8000-000000000033'::uuid, 'Diego Quispe Mamani', '7104521', 'Cajero', 'Atención al cliente', 'Miraflores', 3200.00),
        ('f0000000-0000-4000-8000-000000000034'::uuid, 'Paola Gutiérrez Limachi', '7104658', 'Asesor de Atención', 'Atención al cliente', 'Miraflores', 3400.00)
      ) AS e (id_empleado, nombre, documento, cargo, area, sucursal, haber)
    LOOP
      INSERT INTO planilla_empleados (
        id_planilla, id_empleado, nombre_empleado, numero_documento, cargo, area, sucursal, id_contrato, numero_contrato,
        haber_mensual, contrato_desde, contrato_hasta, dias_contrato, dias_pagados
      ) VALUES (
        v_planilla, emp.id_empleado, emp.nombre, emp.documento, emp.cargo, emp.area, emp.sucursal,
        overlay('f0000000-0000-4000-8000-000000000b00' placing right(emp.id_empleado::text, 2) from 35 for 2)::uuid,
        'CT-2026-00' || right(emp.id_empleado::text, 2), emp.haber, '2026-01-01', '2026-12-31', 30, 30
      ) RETURNING id_planilla_empleado INTO v_pe;

      INSERT INTO calculos_planilla (id_planilla_empleado, id_vigencia, orden, tipo, codigo, nombre, forma_calculo, base, cantidad, valor, resultado)
      SELECT v_pe, vg.id_vigencia, 1, 'INGRESO', co.codigo, co.nombre, 'PORCENTAJE', emp.haber, 30, vg.valor, emp.haber
      FROM conceptos_planilla co
      JOIN vigencias_concepto vg ON vg.id_concepto = co.id_concepto
        AND v_fin BETWEEN vg.vigente_desde AND COALESCE(vg.vigente_hasta, 'infinity'::date)
      WHERE co.codigo = 'HABER-BASICO';

      v_orden := 1;
      FOR c IN
        SELECT co.codigo, co.nombre, co.tipo, vg.id_vigencia, vg.valor
        FROM conceptos_planilla co
        JOIN vigencias_concepto vg ON vg.id_concepto = co.id_concepto
          AND v_fin BETWEEN vg.vigente_desde AND COALESCE(vg.vigente_hasta, 'infinity'::date)
        WHERE co.tipo IN ('DESCUENTO', 'APORTE') AND co.esta_activo AND co.codigo NOT LIKE 'ANS-%'
        ORDER BY co.tipo, co.codigo
      LOOP
        v_orden := v_orden + 1;
        INSERT INTO calculos_planilla (id_planilla_empleado, id_vigencia, orden, tipo, codigo, nombre, forma_calculo, base, cantidad, valor, resultado)
        VALUES (v_pe, c.id_vigencia, v_orden, c.tipo, c.codigo, c.nombre, 'PORCENTAJE', emp.haber, NULL, c.valor, round(emp.haber * c.valor / 100, 2));
      END LOOP;

      SELECT COALESCE(sum(resultado) FILTER (WHERE tipo = 'DESCUENTO'), 0), COALESCE(sum(resultado) FILTER (WHERE tipo = 'APORTE'), 0)
        INTO v_descuentos, v_aportes
      FROM calculos_planilla WHERE id_planilla_empleado = v_pe;
      UPDATE planilla_empleados
      SET total_ganado = emp.haber, total_descuentos = v_descuentos, liquido_pagable = emp.haber - v_descuentos, total_aportes = v_aportes
      WHERE id_planilla_empleado = v_pe;
    END LOOP;
  END LOOP;
END $$;
COMMIT;
