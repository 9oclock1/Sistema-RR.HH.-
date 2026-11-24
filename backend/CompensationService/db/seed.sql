-- Datos de prueba de CompensationDB: planillas mensuales con su detalle de cálculo, para las boletas de pago (KAN-66).
-- Requiere init.sql, que se carga solo al crear la base. Es SQL puro: se puede correr desde SQLTools, DBeaver o psql.
-- Los colaboradores son los de EmployeeService/db/seed.sql (mismos ids), que conviene cargar antes.
-- Se puede ejecutar varias veces: lo que ya existe no se duplica. Si ya hay una planilla propia de alguno de estos
-- meses, ese mes se omite.
--   Get-Content backend/CompensationService/db/seed.sql | docker exec -i rrhh-postgres psql -U adminRRHH -d CompensationDB
--
-- Qué queda cargado:
--   Junio, julio y agosto de 2026: planillas CERRADAS (Contabilidad y Pagos confirmaron).
--   Septiembre de 2026: planilla APROBADA, Pagos aún no confirma: sus boletas no están disponibles (criterio 4).
--   12 colaboradores por mes, con faltas, horas extra, domingos y horas nocturnas que varían de un mes a otro.
--   Los montos salen del mismo cálculo de la planilla (utils/calculo.js) con los conceptos de init.sql.
--   Las boletas se emiten solas la primera vez que el colaborador abre «Mis boletas de pago».
--   Para probar: elija como usuario de prueba, por ejemplo, a Carlos Rojas o a Ana Torrez.
BEGIN;

-- 2026-06 (CERRADA)
INSERT INTO PLANILLAS (id_planilla, periodo, fecha_inicio, fecha_fin, datos_hasta, estado, generada_por, generada_por_nombre, generada_en,
                       aprobada_por, aprobada_por_nombre, aprobada_en, estado_contabilidad, referencia_contabilidad, respondida_contabilidad_en,
                       estado_pagos, referencia_pagos, respondida_pagos_en, cerrada_en) VALUES
  ('c0000000-0000-4000-8000-000000202606', '2026-06', DATE '2026-06-01', DATE '2026-06-30', DATE '2026-06-30', 'CERRADA', 'f0000000-0000-4000-8000-000000000023', 'Andrea Salazar Vega', TIMESTAMPTZ '2026-07-01 09:00-04',
   'f0000000-0000-4000-8000-000000000023', 'Andrea Salazar Vega', TIMESTAMPTZ '2026-07-01 11:30-04', 'CONFIRMADA', 'AS-202606-041', TIMESTAMPTZ '2026-07-02 10:15-04',
   'CONFIRMADA', 'OP-202606-17', TIMESTAMPTZ '2026-07-02 10:15-04', TIMESTAMPTZ '2026-07-02 10:15-04')
ON CONFLICT DO NOTHING;
INSERT INTO PLANILLA_EMPLEADOS (id_planilla_empleado, id_planilla, id_empleado, nombre_empleado, numero_documento, cargo, area, sucursal,
                               id_contrato, numero_contrato, haber_mensual, contrato_desde, contrato_hasta, dias_contrato,
                               faltas_injustificadas, dias_pagados, minutos_extra_habil, minutos_domingo, minutos_nocturnos,
                               total_ganado, total_descuentos, liquido_pagable, total_aportes)
SELECT v.* FROM (VALUES
  ('c0000000-0000-4000-8000-202606000021'::uuid, 'c0000000-0000-4000-8000-000000202606'::uuid, 'f0000000-0000-4000-8000-000000000021'::uuid, 'Marcela Quiroga Peña', '7102877', 'Jefe de Atención al Cliente', 'Atención al cliente', 'Sopocachi',
   'c0000000-0000-4000-8000-000000000021'::uuid, 'CT-2019-021', 8500::numeric, DATE '2019-03-01', DATE '2026-06-30', 30::smallint,
   1::smallint, 29::smallint, 0, 480, 0,
   9403.83::numeric, 1195.23::numeric, 8208.6::numeric, 1571.38::numeric),
  ('c0000000-0000-4000-8000-202606000022'::uuid, 'c0000000-0000-4000-8000-000000202606'::uuid, 'f0000000-0000-4000-8000-000000000022'::uuid, 'Jorge Mamani Condori', '7103014', 'Jefe de Atención al Cliente', 'Atención al cliente', 'Miraflores',
   'c0000000-0000-4000-8000-000000000022'::uuid, 'CT-2020-022', 8500::numeric, DATE '2020-03-01', DATE '2026-06-30', 30::smallint,
   0::smallint, 30::smallint, 180, 0, 0,
   9647.5::numeric, 1226.2::numeric, 8421.3::numeric, 1612.1::numeric),
  ('c0000000-0000-4000-8000-202606000023'::uuid, 'c0000000-0000-4000-8000-000000202606'::uuid, 'f0000000-0000-4000-8000-000000000023'::uuid, 'Andrea Salazar Vega', '7103151', 'Jefe de Recursos Humanos', 'Recursos Humanos', 'Sopocachi',
   'c0000000-0000-4000-8000-000000000023'::uuid, 'CT-2021-023', 9500::numeric, DATE '2021-03-01', DATE '2026-06-30', 30::smallint,
   0::smallint, 30::smallint, 120, 0, 0,
   10703.33::numeric, 1360.4::numeric, 9342.93::numeric, 1788.53::numeric),
  ('c0000000-0000-4000-8000-202606000024'::uuid, 'c0000000-0000-4000-8000-000000202606'::uuid, 'f0000000-0000-4000-8000-000000000024'::uuid, 'Rosa Mendoza Ticona', '7103288', 'Supervisor de Cajas', 'Atención al cliente', 'Sopocachi',
   'c0000000-0000-4000-8000-000000000024'::uuid, 'CT-2022-024', 5800::numeric, DATE '2022-03-01', DATE '2026-06-30', 30::smallint,
   0::smallint, 30::smallint, 60, 0, 0,
   6138.33::numeric, 780.18::numeric, 5358.15::numeric, 1025.72::numeric),
  ('c0000000-0000-4000-8000-202606000025'::uuid, 'c0000000-0000-4000-8000-000000202606'::uuid, 'f0000000-0000-4000-8000-000000000025'::uuid, 'Luis Vargas Apaza', '7103425', 'Supervisor de Cajas', 'Atención al cliente', 'Miraflores',
   'c0000000-0000-4000-8000-000000000025'::uuid, 'CT-2023-025', 5800::numeric, DATE '2023-03-01', DATE '2026-06-30', 30::smallint,
   0::smallint, 30::smallint, 0, 480, 0,
   6283.33::numeric, 798.61::numeric, 5484.72::numeric, 1049.94::numeric),
  ('c0000000-0000-4000-8000-202606000026'::uuid, 'c0000000-0000-4000-8000-000000202606'::uuid, 'f0000000-0000-4000-8000-000000000026'::uuid, 'Sofía Condori Mamani', '7103562', 'Analista de Recursos Humanos', 'Recursos Humanos', 'Sopocachi',
   'c0000000-0000-4000-8000-000000000026'::uuid, 'CT-2024-026', 5200::numeric, DATE '2024-03-01', DATE '2026-06-30', 30::smallint,
   1::smallint, 29::smallint, 180, 0, 0,
   5408::numeric, 687.36::numeric, 4720.64::numeric, 903.68::numeric),
  ('c0000000-0000-4000-8000-202606000031'::uuid, 'c0000000-0000-4000-8000-000000202606'::uuid, 'f0000000-0000-4000-8000-000000000031'::uuid, 'Carlos Rojas Vargas', '7104247', 'Cajero', 'Atención al cliente', 'Sopocachi',
   'c0000000-0000-4000-8000-000000000031'::uuid, 'CT-2019-031', 3200::numeric, DATE '2019-03-01', DATE '2026-06-30', 30::smallint,
   0::smallint, 30::smallint, 120, 0, 0,
   3605.33::numeric, 458.24::numeric, 3147.09::numeric, 602.45::numeric),
  ('c0000000-0000-4000-8000-202606000032'::uuid, 'c0000000-0000-4000-8000-000000202606'::uuid, 'f0000000-0000-4000-8000-000000000032'::uuid, 'Lucía Flores Choque', '7104384', 'Cajero', 'Atención al cliente', 'Sopocachi',
   'c0000000-0000-4000-8000-000000000032'::uuid, 'CT-2020-032', 3200::numeric, DATE '2020-03-01', DATE '2026-06-30', 30::smallint,
   0::smallint, 30::smallint, 60, 0, 0,
   3578.67::numeric, 454.85::numeric, 3123.82::numeric, 598::numeric),
  ('c0000000-0000-4000-8000-202606000033'::uuid, 'c0000000-0000-4000-8000-000000202606'::uuid, 'f0000000-0000-4000-8000-000000000033'::uuid, 'Diego Quispe Mamani', '7104521', 'Cajero', 'Atención al cliente', 'Miraflores',
   'c0000000-0000-4000-8000-000000000033'::uuid, 'CT-2021-033', 3200::numeric, DATE '2021-03-01', DATE '2026-06-30', 30::smallint,
   0::smallint, 30::smallint, 0, 480, 240,
   3672::numeric, 466.71::numeric, 3205.29::numeric, 613.59::numeric),
  ('c0000000-0000-4000-8000-202606000034'::uuid, 'c0000000-0000-4000-8000-000000202606'::uuid, 'f0000000-0000-4000-8000-000000000034'::uuid, 'Paola Gutiérrez Limachi', '7104658', 'Asesor de Atención', 'Atención al cliente', 'Miraflores',
   'c0000000-0000-4000-8000-000000000034'::uuid, 'CT-2022-034', 3400::numeric, DATE '2022-03-01', DATE '2026-06-30', 30::smallint,
   0::smallint, 30::smallint, 180, 0, 0,
   3655::numeric, 464.56::numeric, 3190.44::numeric, 610.75::numeric),
  ('c0000000-0000-4000-8000-202606000035'::uuid, 'c0000000-0000-4000-8000-000000202606'::uuid, 'f0000000-0000-4000-8000-000000000035'::uuid, 'Ana Torrez Villca', '7104795', 'Cajero', 'Atención al cliente', 'Miraflores',
   'c0000000-0000-4000-8000-000000000035'::uuid, 'CT-2023-035', 3200::numeric, DATE '2023-03-01', DATE '2026-06-30', 30::smallint,
   1::smallint, 29::smallint, 120, 0, 120,
   3308::numeric, 420.45::numeric, 2887.55::numeric, 552.77::numeric),
  ('c0000000-0000-4000-8000-202606000036'::uuid, 'c0000000-0000-4000-8000-000000202606'::uuid, 'f0000000-0000-4000-8000-000000000036'::uuid, 'Mario Fernández Cruz', '7104932', 'Asesor de Atención', 'Atención al cliente', 'Sopocachi',
   'c0000000-0000-4000-8000-000000000036'::uuid, 'CT-2024-036', 3400::numeric, DATE '2024-03-01', DATE '2026-06-30', 30::smallint,
   0::smallint, 30::smallint, 60, 0, 0,
   3598.33::numeric, 457.34::numeric, 3140.99::numeric, 601.28::numeric)
) AS v (id_planilla_empleado, id_planilla, id_empleado, nombre_empleado, numero_documento, cargo, area, sucursal, id_contrato,
         numero_contrato, haber_mensual, contrato_desde, contrato_hasta, dias_contrato, faltas_injustificadas, dias_pagados,
         minutos_extra_habil, minutos_domingo, minutos_nocturnos, total_ganado, total_descuentos, liquido_pagable, total_aportes)
-- Solo si la planilla del mes es la de este archivo.
WHERE EXISTS (SELECT 1 FROM PLANILLAS p WHERE p.id_planilla = v.id_planilla)
ON CONFLICT DO NOTHING;
INSERT INTO CALCULOS_PLANILLA (id_planilla_empleado, id_vigencia, orden, tipo, codigo, nombre, forma_calculo, base, cantidad, valor, resultado, detalle)
SELECT r.id_planilla_empleado,
       (SELECT vc.id_vigencia FROM VIGENCIAS_CONCEPTO vc JOIN CONCEPTOS_PLANILLA cp ON cp.id_concepto = vc.id_concepto
        WHERE cp.codigo = r.codigo_vigencia AND vc.vigente_desde <= DATE '2026-06-30'
          AND (vc.vigente_hasta IS NULL OR vc.vigente_hasta >= DATE '2026-06-30')),
       r.orden, r.tipo, r.codigo, r.nombre, r.forma_calculo, r.base, r.cantidad, r.valor, r.resultado, r.detalle
FROM (VALUES
  ('c0000000-0000-4000-8000-202606000021'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 8500::numeric, 29::numeric, 100::numeric, 8216.67::numeric, '29 de 30 días'),
  ('c0000000-0000-4000-8000-202606000021'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 8500::numeric, 29::numeric, 11::numeric, 903.83::numeric, '7 años de servicio · 29 de 30 días'),
  ('c0000000-0000-4000-8000-202606000021'::uuid, 'DOMINICAL', 3::smallint, 'INGRESO', 'DOMINICAL', 'Domingos, feriados y descansos trabajados', 'PORCENTAJE', 35.42::numeric, 8::numeric, 100::numeric, 283.33::numeric, '8 h a Bs 35,42 la hora'),
  ('c0000000-0000-4000-8000-202606000021'::uuid, 'SIP-COMISION', 4::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 9403.83::numeric, NULL::numeric, 0.5::numeric, 47.02::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000021'::uuid, 'SIP-RIESGO', 5::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 9403.83::numeric, NULL::numeric, 1.71::numeric, 160.81::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000021'::uuid, 'SIP-SOLIDARIO', 6::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 9403.83::numeric, NULL::numeric, 0.5::numeric, 47.02::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000021'::uuid, 'SIP-VEJEZ', 7::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 9403.83::numeric, NULL::numeric, 10::numeric, 940.38::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000021'::uuid, 'CNS-SALUD', 8::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 9403.83::numeric, NULL::numeric, 10::numeric, 940.38::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000021'::uuid, 'PRO-VIVIENDA', 9::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 9403.83::numeric, NULL::numeric, 2::numeric, 188.08::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000021'::uuid, 'SIP-RIESGO-PROF', 10::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 9403.83::numeric, NULL::numeric, 1.71::numeric, 160.81::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000021'::uuid, 'SIP-SOLIDARIO-PAT', 11::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 9403.83::numeric, NULL::numeric, 3::numeric, 282.11::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000022'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 8500::numeric, 30::numeric, 100::numeric, 8500::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202606000022'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 8500::numeric, 30::numeric, 11::numeric, 935::numeric, '6 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202606000022'::uuid, 'HORAS-EXTRA', 3::smallint, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 35.42::numeric, 3::numeric, 100::numeric, 212.5::numeric, '3 h a Bs 35,42 la hora'),
  ('c0000000-0000-4000-8000-202606000022'::uuid, 'SIP-COMISION', 4::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 9647.5::numeric, NULL::numeric, 0.5::numeric, 48.24::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000022'::uuid, 'SIP-RIESGO', 5::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 9647.5::numeric, NULL::numeric, 1.71::numeric, 164.97::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000022'::uuid, 'SIP-SOLIDARIO', 6::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 9647.5::numeric, NULL::numeric, 0.5::numeric, 48.24::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000022'::uuid, 'SIP-VEJEZ', 7::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 9647.5::numeric, NULL::numeric, 10::numeric, 964.75::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000022'::uuid, 'CNS-SALUD', 8::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 9647.5::numeric, NULL::numeric, 10::numeric, 964.75::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000022'::uuid, 'PRO-VIVIENDA', 9::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 9647.5::numeric, NULL::numeric, 2::numeric, 192.95::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000022'::uuid, 'SIP-RIESGO-PROF', 10::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 9647.5::numeric, NULL::numeric, 1.71::numeric, 164.97::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000022'::uuid, 'SIP-SOLIDARIO-PAT', 11::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 9647.5::numeric, NULL::numeric, 3::numeric, 289.43::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000023'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 9500::numeric, 30::numeric, 100::numeric, 9500::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202606000023'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 9500::numeric, 30::numeric, 11::numeric, 1045::numeric, '5 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202606000023'::uuid, 'HORAS-EXTRA', 3::smallint, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 39.58::numeric, 2::numeric, 100::numeric, 158.33::numeric, '2 h a Bs 39,58 la hora'),
  ('c0000000-0000-4000-8000-202606000023'::uuid, 'SIP-COMISION', 4::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 10703.33::numeric, NULL::numeric, 0.5::numeric, 53.52::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000023'::uuid, 'SIP-RIESGO', 5::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 10703.33::numeric, NULL::numeric, 1.71::numeric, 183.03::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000023'::uuid, 'SIP-SOLIDARIO', 6::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 10703.33::numeric, NULL::numeric, 0.5::numeric, 53.52::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000023'::uuid, 'SIP-VEJEZ', 7::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 10703.33::numeric, NULL::numeric, 10::numeric, 1070.33::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000023'::uuid, 'CNS-SALUD', 8::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 10703.33::numeric, NULL::numeric, 10::numeric, 1070.33::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000023'::uuid, 'PRO-VIVIENDA', 9::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 10703.33::numeric, NULL::numeric, 2::numeric, 214.07::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000023'::uuid, 'SIP-RIESGO-PROF', 10::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 10703.33::numeric, NULL::numeric, 1.71::numeric, 183.03::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000023'::uuid, 'SIP-SOLIDARIO-PAT', 11::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 10703.33::numeric, NULL::numeric, 3::numeric, 321.1::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000024'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 5800::numeric, 30::numeric, 100::numeric, 5800::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202606000024'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 5800::numeric, 30::numeric, 5::numeric, 290::numeric, '4 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202606000024'::uuid, 'HORAS-EXTRA', 3::smallint, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 24.17::numeric, 1::numeric, 100::numeric, 48.33::numeric, '1 h a Bs 24,17 la hora'),
  ('c0000000-0000-4000-8000-202606000024'::uuid, 'SIP-COMISION', 4::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 6138.33::numeric, NULL::numeric, 0.5::numeric, 30.69::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000024'::uuid, 'SIP-RIESGO', 5::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 6138.33::numeric, NULL::numeric, 1.71::numeric, 104.97::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000024'::uuid, 'SIP-SOLIDARIO', 6::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 6138.33::numeric, NULL::numeric, 0.5::numeric, 30.69::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000024'::uuid, 'SIP-VEJEZ', 7::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 6138.33::numeric, NULL::numeric, 10::numeric, 613.83::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000024'::uuid, 'CNS-SALUD', 8::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 6138.33::numeric, NULL::numeric, 10::numeric, 613.83::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000024'::uuid, 'PRO-VIVIENDA', 9::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 6138.33::numeric, NULL::numeric, 2::numeric, 122.77::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000024'::uuid, 'SIP-RIESGO-PROF', 10::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 6138.33::numeric, NULL::numeric, 1.71::numeric, 104.97::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000024'::uuid, 'SIP-SOLIDARIO-PAT', 11::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 6138.33::numeric, NULL::numeric, 3::numeric, 184.15::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000025'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 5800::numeric, 30::numeric, 100::numeric, 5800::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202606000025'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 5800::numeric, 30::numeric, 5::numeric, 290::numeric, '3 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202606000025'::uuid, 'DOMINICAL', 3::smallint, 'INGRESO', 'DOMINICAL', 'Domingos, feriados y descansos trabajados', 'PORCENTAJE', 24.17::numeric, 8::numeric, 100::numeric, 193.33::numeric, '8 h a Bs 24,17 la hora'),
  ('c0000000-0000-4000-8000-202606000025'::uuid, 'SIP-COMISION', 4::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 6283.33::numeric, NULL::numeric, 0.5::numeric, 31.42::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000025'::uuid, 'SIP-RIESGO', 5::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 6283.33::numeric, NULL::numeric, 1.71::numeric, 107.44::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000025'::uuid, 'SIP-SOLIDARIO', 6::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 6283.33::numeric, NULL::numeric, 0.5::numeric, 31.42::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000025'::uuid, 'SIP-VEJEZ', 7::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 6283.33::numeric, NULL::numeric, 10::numeric, 628.33::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000025'::uuid, 'CNS-SALUD', 8::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 6283.33::numeric, NULL::numeric, 10::numeric, 628.33::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000025'::uuid, 'PRO-VIVIENDA', 9::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 6283.33::numeric, NULL::numeric, 2::numeric, 125.67::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000025'::uuid, 'SIP-RIESGO-PROF', 10::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 6283.33::numeric, NULL::numeric, 1.71::numeric, 107.44::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000025'::uuid, 'SIP-SOLIDARIO-PAT', 11::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 6283.33::numeric, NULL::numeric, 3::numeric, 188.5::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000026'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 5200::numeric, 29::numeric, 100::numeric, 5026.67::numeric, '29 de 30 días'),
  ('c0000000-0000-4000-8000-202606000026'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 5200::numeric, 29::numeric, 5::numeric, 251.33::numeric, '2 años de servicio · 29 de 30 días'),
  ('c0000000-0000-4000-8000-202606000026'::uuid, 'HORAS-EXTRA', 3::smallint, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 21.67::numeric, 3::numeric, 100::numeric, 130::numeric, '3 h a Bs 21,67 la hora'),
  ('c0000000-0000-4000-8000-202606000026'::uuid, 'SIP-COMISION', 4::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 5408::numeric, NULL::numeric, 0.5::numeric, 27.04::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000026'::uuid, 'SIP-RIESGO', 5::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 5408::numeric, NULL::numeric, 1.71::numeric, 92.48::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000026'::uuid, 'SIP-SOLIDARIO', 6::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 5408::numeric, NULL::numeric, 0.5::numeric, 27.04::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000026'::uuid, 'SIP-VEJEZ', 7::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 5408::numeric, NULL::numeric, 10::numeric, 540.8::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000026'::uuid, 'CNS-SALUD', 8::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 5408::numeric, NULL::numeric, 10::numeric, 540.8::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000026'::uuid, 'PRO-VIVIENDA', 9::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 5408::numeric, NULL::numeric, 2::numeric, 108.16::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000026'::uuid, 'SIP-RIESGO-PROF', 10::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 5408::numeric, NULL::numeric, 1.71::numeric, 92.48::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000026'::uuid, 'SIP-SOLIDARIO-PAT', 11::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 5408::numeric, NULL::numeric, 3::numeric, 162.24::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000031'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 3200::numeric, 30::numeric, 100::numeric, 3200::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202606000031'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 3200::numeric, 30::numeric, 11::numeric, 352::numeric, '7 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202606000031'::uuid, 'HORAS-EXTRA', 3::smallint, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 13.33::numeric, 2::numeric, 100::numeric, 53.33::numeric, '2 h a Bs 13,33 la hora'),
  ('c0000000-0000-4000-8000-202606000031'::uuid, 'SIP-COMISION', 4::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 3605.33::numeric, NULL::numeric, 0.5::numeric, 18.03::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000031'::uuid, 'SIP-RIESGO', 5::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 3605.33::numeric, NULL::numeric, 1.71::numeric, 61.65::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000031'::uuid, 'SIP-SOLIDARIO', 6::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 3605.33::numeric, NULL::numeric, 0.5::numeric, 18.03::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000031'::uuid, 'SIP-VEJEZ', 7::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 3605.33::numeric, NULL::numeric, 10::numeric, 360.53::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000031'::uuid, 'CNS-SALUD', 8::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 3605.33::numeric, NULL::numeric, 10::numeric, 360.53::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000031'::uuid, 'PRO-VIVIENDA', 9::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 3605.33::numeric, NULL::numeric, 2::numeric, 72.11::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000031'::uuid, 'SIP-RIESGO-PROF', 10::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 3605.33::numeric, NULL::numeric, 1.71::numeric, 61.65::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000031'::uuid, 'SIP-SOLIDARIO-PAT', 11::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 3605.33::numeric, NULL::numeric, 3::numeric, 108.16::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000032'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 3200::numeric, 30::numeric, 100::numeric, 3200::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202606000032'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 3200::numeric, 30::numeric, 11::numeric, 352::numeric, '6 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202606000032'::uuid, 'HORAS-EXTRA', 3::smallint, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 13.33::numeric, 1::numeric, 100::numeric, 26.67::numeric, '1 h a Bs 13,33 la hora'),
  ('c0000000-0000-4000-8000-202606000032'::uuid, 'SIP-COMISION', 4::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 3578.67::numeric, NULL::numeric, 0.5::numeric, 17.89::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000032'::uuid, 'SIP-RIESGO', 5::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 3578.67::numeric, NULL::numeric, 1.71::numeric, 61.2::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000032'::uuid, 'SIP-SOLIDARIO', 6::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 3578.67::numeric, NULL::numeric, 0.5::numeric, 17.89::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000032'::uuid, 'SIP-VEJEZ', 7::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 3578.67::numeric, NULL::numeric, 10::numeric, 357.87::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000032'::uuid, 'CNS-SALUD', 8::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 3578.67::numeric, NULL::numeric, 10::numeric, 357.87::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000032'::uuid, 'PRO-VIVIENDA', 9::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 3578.67::numeric, NULL::numeric, 2::numeric, 71.57::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000032'::uuid, 'SIP-RIESGO-PROF', 10::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 3578.67::numeric, NULL::numeric, 1.71::numeric, 61.2::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000032'::uuid, 'SIP-SOLIDARIO-PAT', 11::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 3578.67::numeric, NULL::numeric, 3::numeric, 107.36::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000033'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 3200::numeric, 30::numeric, 100::numeric, 3200::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202606000033'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 3200::numeric, 30::numeric, 11::numeric, 352::numeric, '5 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202606000033'::uuid, 'DOMINICAL', 3::smallint, 'INGRESO', 'DOMINICAL', 'Domingos, feriados y descansos trabajados', 'PORCENTAJE', 13.33::numeric, 8::numeric, 100::numeric, 106.67::numeric, '8 h a Bs 13,33 la hora'),
  ('c0000000-0000-4000-8000-202606000033'::uuid, 'RECARGO-NOCTURNO', 4::smallint, 'INGRESO', 'RECARGO-NOCTURNO', 'Recargo nocturno', 'PORCENTAJE', 13.33::numeric, 4::numeric, 25::numeric, 13.33::numeric, '4 h a Bs 13,33 la hora'),
  ('c0000000-0000-4000-8000-202606000033'::uuid, 'SIP-COMISION', 5::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 3672::numeric, NULL::numeric, 0.5::numeric, 18.36::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000033'::uuid, 'SIP-RIESGO', 6::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 3672::numeric, NULL::numeric, 1.71::numeric, 62.79::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000033'::uuid, 'SIP-SOLIDARIO', 7::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 3672::numeric, NULL::numeric, 0.5::numeric, 18.36::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000033'::uuid, 'SIP-VEJEZ', 8::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 3672::numeric, NULL::numeric, 10::numeric, 367.2::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000033'::uuid, 'CNS-SALUD', 9::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 3672::numeric, NULL::numeric, 10::numeric, 367.2::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000033'::uuid, 'PRO-VIVIENDA', 10::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 3672::numeric, NULL::numeric, 2::numeric, 73.44::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000033'::uuid, 'SIP-RIESGO-PROF', 11::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 3672::numeric, NULL::numeric, 1.71::numeric, 62.79::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000033'::uuid, 'SIP-SOLIDARIO-PAT', 12::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 3672::numeric, NULL::numeric, 3::numeric, 110.16::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000034'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 3400::numeric, 30::numeric, 100::numeric, 3400::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202606000034'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 3400::numeric, 30::numeric, 5::numeric, 170::numeric, '4 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202606000034'::uuid, 'HORAS-EXTRA', 3::smallint, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 14.17::numeric, 3::numeric, 100::numeric, 85::numeric, '3 h a Bs 14,17 la hora'),
  ('c0000000-0000-4000-8000-202606000034'::uuid, 'SIP-COMISION', 4::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 3655::numeric, NULL::numeric, 0.5::numeric, 18.28::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000034'::uuid, 'SIP-RIESGO', 5::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 3655::numeric, NULL::numeric, 1.71::numeric, 62.5::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000034'::uuid, 'SIP-SOLIDARIO', 6::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 3655::numeric, NULL::numeric, 0.5::numeric, 18.28::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000034'::uuid, 'SIP-VEJEZ', 7::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 3655::numeric, NULL::numeric, 10::numeric, 365.5::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000034'::uuid, 'CNS-SALUD', 8::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 3655::numeric, NULL::numeric, 10::numeric, 365.5::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000034'::uuid, 'PRO-VIVIENDA', 9::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 3655::numeric, NULL::numeric, 2::numeric, 73.1::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000034'::uuid, 'SIP-RIESGO-PROF', 10::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 3655::numeric, NULL::numeric, 1.71::numeric, 62.5::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000034'::uuid, 'SIP-SOLIDARIO-PAT', 11::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 3655::numeric, NULL::numeric, 3::numeric, 109.65::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000035'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 3200::numeric, 29::numeric, 100::numeric, 3093.33::numeric, '29 de 30 días'),
  ('c0000000-0000-4000-8000-202606000035'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 3200::numeric, 29::numeric, 5::numeric, 154.67::numeric, '3 años de servicio · 29 de 30 días'),
  ('c0000000-0000-4000-8000-202606000035'::uuid, 'HORAS-EXTRA', 3::smallint, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 13.33::numeric, 2::numeric, 100::numeric, 53.33::numeric, '2 h a Bs 13,33 la hora'),
  ('c0000000-0000-4000-8000-202606000035'::uuid, 'RECARGO-NOCTURNO', 4::smallint, 'INGRESO', 'RECARGO-NOCTURNO', 'Recargo nocturno', 'PORCENTAJE', 13.33::numeric, 2::numeric, 25::numeric, 6.67::numeric, '2 h a Bs 13,33 la hora'),
  ('c0000000-0000-4000-8000-202606000035'::uuid, 'SIP-COMISION', 5::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 3308::numeric, NULL::numeric, 0.5::numeric, 16.54::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000035'::uuid, 'SIP-RIESGO', 6::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 3308::numeric, NULL::numeric, 1.71::numeric, 56.57::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000035'::uuid, 'SIP-SOLIDARIO', 7::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 3308::numeric, NULL::numeric, 0.5::numeric, 16.54::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000035'::uuid, 'SIP-VEJEZ', 8::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 3308::numeric, NULL::numeric, 10::numeric, 330.8::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000035'::uuid, 'CNS-SALUD', 9::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 3308::numeric, NULL::numeric, 10::numeric, 330.8::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000035'::uuid, 'PRO-VIVIENDA', 10::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 3308::numeric, NULL::numeric, 2::numeric, 66.16::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000035'::uuid, 'SIP-RIESGO-PROF', 11::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 3308::numeric, NULL::numeric, 1.71::numeric, 56.57::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000035'::uuid, 'SIP-SOLIDARIO-PAT', 12::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 3308::numeric, NULL::numeric, 3::numeric, 99.24::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000036'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 3400::numeric, 30::numeric, 100::numeric, 3400::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202606000036'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 3400::numeric, 30::numeric, 5::numeric, 170::numeric, '2 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202606000036'::uuid, 'HORAS-EXTRA', 3::smallint, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 14.17::numeric, 1::numeric, 100::numeric, 28.33::numeric, '1 h a Bs 14,17 la hora'),
  ('c0000000-0000-4000-8000-202606000036'::uuid, 'SIP-COMISION', 4::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 3598.33::numeric, NULL::numeric, 0.5::numeric, 17.99::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000036'::uuid, 'SIP-RIESGO', 5::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 3598.33::numeric, NULL::numeric, 1.71::numeric, 61.53::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000036'::uuid, 'SIP-SOLIDARIO', 6::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 3598.33::numeric, NULL::numeric, 0.5::numeric, 17.99::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000036'::uuid, 'SIP-VEJEZ', 7::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 3598.33::numeric, NULL::numeric, 10::numeric, 359.83::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000036'::uuid, 'CNS-SALUD', 8::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 3598.33::numeric, NULL::numeric, 10::numeric, 359.83::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000036'::uuid, 'PRO-VIVIENDA', 9::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 3598.33::numeric, NULL::numeric, 2::numeric, 71.97::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000036'::uuid, 'SIP-RIESGO-PROF', 10::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 3598.33::numeric, NULL::numeric, 1.71::numeric, 61.53::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202606000036'::uuid, 'SIP-SOLIDARIO-PAT', 11::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 3598.33::numeric, NULL::numeric, 3::numeric, 107.95::numeric, NULL::varchar)
) AS r (id_planilla_empleado, codigo_vigencia, orden, tipo, codigo, nombre, forma_calculo, base, cantidad, valor, resultado, detalle)
JOIN PLANILLA_EMPLEADOS pe ON pe.id_planilla_empleado = r.id_planilla_empleado
ON CONFLICT DO NOTHING;

-- 2026-07 (CERRADA)
INSERT INTO PLANILLAS (id_planilla, periodo, fecha_inicio, fecha_fin, datos_hasta, estado, generada_por, generada_por_nombre, generada_en,
                       aprobada_por, aprobada_por_nombre, aprobada_en, estado_contabilidad, referencia_contabilidad, respondida_contabilidad_en,
                       estado_pagos, referencia_pagos, respondida_pagos_en, cerrada_en) VALUES
  ('c0000000-0000-4000-8000-000000202607', '2026-07', DATE '2026-07-01', DATE '2026-07-31', DATE '2026-07-31', 'CERRADA', 'f0000000-0000-4000-8000-000000000023', 'Andrea Salazar Vega', TIMESTAMPTZ '2026-08-01 09:00-04',
   'f0000000-0000-4000-8000-000000000023', 'Andrea Salazar Vega', TIMESTAMPTZ '2026-08-01 11:00-04', 'CONFIRMADA', 'AS-202607-042', TIMESTAMPTZ '2026-08-03 09:40-04',
   'CONFIRMADA', 'OP-202607-18', TIMESTAMPTZ '2026-08-03 09:40-04', TIMESTAMPTZ '2026-08-03 09:40-04')
ON CONFLICT DO NOTHING;
INSERT INTO PLANILLA_EMPLEADOS (id_planilla_empleado, id_planilla, id_empleado, nombre_empleado, numero_documento, cargo, area, sucursal,
                               id_contrato, numero_contrato, haber_mensual, contrato_desde, contrato_hasta, dias_contrato,
                               faltas_injustificadas, dias_pagados, minutos_extra_habil, minutos_domingo, minutos_nocturnos,
                               total_ganado, total_descuentos, liquido_pagable, total_aportes)
SELECT v.* FROM (VALUES
  ('c0000000-0000-4000-8000-202607000021'::uuid, 'c0000000-0000-4000-8000-000000202607'::uuid, 'f0000000-0000-4000-8000-000000000021'::uuid, 'Marcela Quiroga Peña', '7102877', 'Jefe de Atención al Cliente', 'Atención al cliente', 'Sopocachi',
   'c0000000-0000-4000-8000-000000000021'::uuid, 'CT-2019-021', 8500::numeric, DATE '2019-03-01', DATE '2026-07-31', 30::smallint,
   0::smallint, 30::smallint, 180, 0, 0,
   9647.5::numeric, 1226.2::numeric, 8421.3::numeric, 1612.1::numeric),
  ('c0000000-0000-4000-8000-202607000022'::uuid, 'c0000000-0000-4000-8000-000000202607'::uuid, 'f0000000-0000-4000-8000-000000000022'::uuid, 'Jorge Mamani Condori', '7103014', 'Jefe de Atención al Cliente', 'Atención al cliente', 'Miraflores',
   'c0000000-0000-4000-8000-000000000022'::uuid, 'CT-2020-022', 8500::numeric, DATE '2020-03-01', DATE '2026-07-31', 30::smallint,
   0::smallint, 30::smallint, 120, 480, 0,
   9860::numeric, 1253.21::numeric, 8606.79::numeric, 1647.61::numeric),
  ('c0000000-0000-4000-8000-202607000023'::uuid, 'c0000000-0000-4000-8000-000000202607'::uuid, 'f0000000-0000-4000-8000-000000000023'::uuid, 'Andrea Salazar Vega', '7103151', 'Jefe de Recursos Humanos', 'Recursos Humanos', 'Sopocachi',
   'c0000000-0000-4000-8000-000000000023'::uuid, 'CT-2021-023', 9500::numeric, DATE '2021-03-01', DATE '2026-07-31', 30::smallint,
   0::smallint, 30::smallint, 60, 0, 0,
   10624.17::numeric, 1350.33::numeric, 9273.84::numeric, 1775.3::numeric),
  ('c0000000-0000-4000-8000-202607000024'::uuid, 'c0000000-0000-4000-8000-000000202607'::uuid, 'f0000000-0000-4000-8000-000000000024'::uuid, 'Rosa Mendoza Ticona', '7103288', 'Supervisor de Cajas', 'Atención al cliente', 'Sopocachi',
   'c0000000-0000-4000-8000-000000000024'::uuid, 'CT-2022-024', 5800::numeric, DATE '2022-03-01', DATE '2026-07-31', 30::smallint,
   0::smallint, 30::smallint, 0, 0, 0,
   6090::numeric, 774.04::numeric, 5315.96::numeric, 1017.64::numeric),
  ('c0000000-0000-4000-8000-202607000025'::uuid, 'c0000000-0000-4000-8000-000000202607'::uuid, 'f0000000-0000-4000-8000-000000000025'::uuid, 'Luis Vargas Apaza', '7103425', 'Supervisor de Cajas', 'Atención al cliente', 'Miraflores',
   'c0000000-0000-4000-8000-000000000025'::uuid, 'CT-2023-025', 5800::numeric, DATE '2023-03-01', DATE '2026-07-31', 30::smallint,
   1::smallint, 29::smallint, 180, 0, 0,
   6032::numeric, 766.67::numeric, 5265.33::numeric, 1007.95::numeric),
  ('c0000000-0000-4000-8000-202607000026'::uuid, 'c0000000-0000-4000-8000-000000202607'::uuid, 'f0000000-0000-4000-8000-000000000026'::uuid, 'Sofía Condori Mamani', '7103562', 'Analista de Recursos Humanos', 'Recursos Humanos', 'Sopocachi',
   'c0000000-0000-4000-8000-000000000026'::uuid, 'CT-2024-026', 5200::numeric, DATE '2024-03-01', DATE '2026-07-31', 30::smallint,
   0::smallint, 30::smallint, 120, 480, 0,
   5720::numeric, 727.01::numeric, 4992.99::numeric, 955.81::numeric),
  ('c0000000-0000-4000-8000-202607000031'::uuid, 'c0000000-0000-4000-8000-000000202607'::uuid, 'f0000000-0000-4000-8000-000000000031'::uuid, 'Carlos Rojas Vargas', '7104247', 'Cajero', 'Atención al cliente', 'Sopocachi',
   'c0000000-0000-4000-8000-000000000031'::uuid, 'CT-2019-031', 3200::numeric, DATE '2019-03-01', DATE '2026-07-31', 30::smallint,
   0::smallint, 30::smallint, 60, 0, 0,
   3578.67::numeric, 454.85::numeric, 3123.82::numeric, 598::numeric),
  ('c0000000-0000-4000-8000-202607000032'::uuid, 'c0000000-0000-4000-8000-000000202607'::uuid, 'f0000000-0000-4000-8000-000000000032'::uuid, 'Lucía Flores Choque', '7104384', 'Cajero', 'Atención al cliente', 'Sopocachi',
   'c0000000-0000-4000-8000-000000000032'::uuid, 'CT-2020-032', 3200::numeric, DATE '2020-03-01', DATE '2026-07-31', 30::smallint,
   0::smallint, 30::smallint, 0, 0, 0,
   3552::numeric, 451.46::numeric, 3100.54::numeric, 593.54::numeric),
  ('c0000000-0000-4000-8000-202607000033'::uuid, 'c0000000-0000-4000-8000-000000202607'::uuid, 'f0000000-0000-4000-8000-000000000033'::uuid, 'Diego Quispe Mamani', '7104521', 'Cajero', 'Atención al cliente', 'Miraflores',
   'c0000000-0000-4000-8000-000000000033'::uuid, 'CT-2021-033', 3200::numeric, DATE '2021-03-01', DATE '2026-07-31', 30::smallint,
   0::smallint, 30::smallint, 180, 0, 0,
   3632::numeric, 461.63::numeric, 3170.37::numeric, 606.91::numeric),
  ('c0000000-0000-4000-8000-202607000034'::uuid, 'c0000000-0000-4000-8000-000000202607'::uuid, 'f0000000-0000-4000-8000-000000000034'::uuid, 'Paola Gutiérrez Limachi', '7104658', 'Asesor de Atención', 'Atención al cliente', 'Miraflores',
   'c0000000-0000-4000-8000-000000000034'::uuid, 'CT-2022-034', 3400::numeric, DATE '2022-03-01', DATE '2026-07-31', 30::smallint,
   1::smallint, 29::smallint, 120, 480, 0,
   3621::numeric, 460.24::numeric, 3160.76::numeric, 605.07::numeric),
  ('c0000000-0000-4000-8000-202607000035'::uuid, 'c0000000-0000-4000-8000-000000202607'::uuid, 'f0000000-0000-4000-8000-000000000035'::uuid, 'Ana Torrez Villca', '7104795', 'Cajero', 'Atención al cliente', 'Miraflores',
   'c0000000-0000-4000-8000-000000000035'::uuid, 'CT-2023-035', 3200::numeric, DATE '2023-03-01', DATE '2026-07-31', 30::smallint,
   0::smallint, 30::smallint, 60, 0, 240,
   3400::numeric, 432.14::numeric, 2967.86::numeric, 568.14::numeric),
  ('c0000000-0000-4000-8000-202607000036'::uuid, 'c0000000-0000-4000-8000-000000202607'::uuid, 'f0000000-0000-4000-8000-000000000036'::uuid, 'Mario Fernández Cruz', '7104932', 'Asesor de Atención', 'Atención al cliente', 'Sopocachi',
   'c0000000-0000-4000-8000-000000000036'::uuid, 'CT-2024-036', 3400::numeric, DATE '2024-03-01', DATE '2026-07-31', 30::smallint,
   0::smallint, 30::smallint, 0, 0, 0,
   3570::numeric, 453.75::numeric, 3116.25::numeric, 596.55::numeric)
) AS v (id_planilla_empleado, id_planilla, id_empleado, nombre_empleado, numero_documento, cargo, area, sucursal, id_contrato,
         numero_contrato, haber_mensual, contrato_desde, contrato_hasta, dias_contrato, faltas_injustificadas, dias_pagados,
         minutos_extra_habil, minutos_domingo, minutos_nocturnos, total_ganado, total_descuentos, liquido_pagable, total_aportes)
-- Solo si la planilla del mes es la de este archivo.
WHERE EXISTS (SELECT 1 FROM PLANILLAS p WHERE p.id_planilla = v.id_planilla)
ON CONFLICT DO NOTHING;
INSERT INTO CALCULOS_PLANILLA (id_planilla_empleado, id_vigencia, orden, tipo, codigo, nombre, forma_calculo, base, cantidad, valor, resultado, detalle)
SELECT r.id_planilla_empleado,
       (SELECT vc.id_vigencia FROM VIGENCIAS_CONCEPTO vc JOIN CONCEPTOS_PLANILLA cp ON cp.id_concepto = vc.id_concepto
        WHERE cp.codigo = r.codigo_vigencia AND vc.vigente_desde <= DATE '2026-07-31'
          AND (vc.vigente_hasta IS NULL OR vc.vigente_hasta >= DATE '2026-07-31')),
       r.orden, r.tipo, r.codigo, r.nombre, r.forma_calculo, r.base, r.cantidad, r.valor, r.resultado, r.detalle
FROM (VALUES
  ('c0000000-0000-4000-8000-202607000021'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 8500::numeric, 30::numeric, 100::numeric, 8500::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202607000021'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 8500::numeric, 30::numeric, 11::numeric, 935::numeric, '7 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202607000021'::uuid, 'HORAS-EXTRA', 3::smallint, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 35.42::numeric, 3::numeric, 100::numeric, 212.5::numeric, '3 h a Bs 35,42 la hora'),
  ('c0000000-0000-4000-8000-202607000021'::uuid, 'SIP-COMISION', 4::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 9647.5::numeric, NULL::numeric, 0.5::numeric, 48.24::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000021'::uuid, 'SIP-RIESGO', 5::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 9647.5::numeric, NULL::numeric, 1.71::numeric, 164.97::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000021'::uuid, 'SIP-SOLIDARIO', 6::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 9647.5::numeric, NULL::numeric, 0.5::numeric, 48.24::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000021'::uuid, 'SIP-VEJEZ', 7::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 9647.5::numeric, NULL::numeric, 10::numeric, 964.75::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000021'::uuid, 'CNS-SALUD', 8::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 9647.5::numeric, NULL::numeric, 10::numeric, 964.75::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000021'::uuid, 'PRO-VIVIENDA', 9::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 9647.5::numeric, NULL::numeric, 2::numeric, 192.95::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000021'::uuid, 'SIP-RIESGO-PROF', 10::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 9647.5::numeric, NULL::numeric, 1.71::numeric, 164.97::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000021'::uuid, 'SIP-SOLIDARIO-PAT', 11::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 9647.5::numeric, NULL::numeric, 3::numeric, 289.43::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000022'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 8500::numeric, 30::numeric, 100::numeric, 8500::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202607000022'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 8500::numeric, 30::numeric, 11::numeric, 935::numeric, '6 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202607000022'::uuid, 'HORAS-EXTRA', 3::smallint, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 35.42::numeric, 2::numeric, 100::numeric, 141.67::numeric, '2 h a Bs 35,42 la hora'),
  ('c0000000-0000-4000-8000-202607000022'::uuid, 'DOMINICAL', 4::smallint, 'INGRESO', 'DOMINICAL', 'Domingos, feriados y descansos trabajados', 'PORCENTAJE', 35.42::numeric, 8::numeric, 100::numeric, 283.33::numeric, '8 h a Bs 35,42 la hora'),
  ('c0000000-0000-4000-8000-202607000022'::uuid, 'SIP-COMISION', 5::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 9860::numeric, NULL::numeric, 0.5::numeric, 49.3::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000022'::uuid, 'SIP-RIESGO', 6::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 9860::numeric, NULL::numeric, 1.71::numeric, 168.61::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000022'::uuid, 'SIP-SOLIDARIO', 7::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 9860::numeric, NULL::numeric, 0.5::numeric, 49.3::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000022'::uuid, 'SIP-VEJEZ', 8::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 9860::numeric, NULL::numeric, 10::numeric, 986::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000022'::uuid, 'CNS-SALUD', 9::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 9860::numeric, NULL::numeric, 10::numeric, 986::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000022'::uuid, 'PRO-VIVIENDA', 10::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 9860::numeric, NULL::numeric, 2::numeric, 197.2::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000022'::uuid, 'SIP-RIESGO-PROF', 11::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 9860::numeric, NULL::numeric, 1.71::numeric, 168.61::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000022'::uuid, 'SIP-SOLIDARIO-PAT', 12::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 9860::numeric, NULL::numeric, 3::numeric, 295.8::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000023'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 9500::numeric, 30::numeric, 100::numeric, 9500::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202607000023'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 9500::numeric, 30::numeric, 11::numeric, 1045::numeric, '5 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202607000023'::uuid, 'HORAS-EXTRA', 3::smallint, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 39.58::numeric, 1::numeric, 100::numeric, 79.17::numeric, '1 h a Bs 39,58 la hora'),
  ('c0000000-0000-4000-8000-202607000023'::uuid, 'SIP-COMISION', 4::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 10624.17::numeric, NULL::numeric, 0.5::numeric, 53.12::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000023'::uuid, 'SIP-RIESGO', 5::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 10624.17::numeric, NULL::numeric, 1.71::numeric, 181.67::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000023'::uuid, 'SIP-SOLIDARIO', 6::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 10624.17::numeric, NULL::numeric, 0.5::numeric, 53.12::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000023'::uuid, 'SIP-VEJEZ', 7::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 10624.17::numeric, NULL::numeric, 10::numeric, 1062.42::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000023'::uuid, 'CNS-SALUD', 8::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 10624.17::numeric, NULL::numeric, 10::numeric, 1062.42::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000023'::uuid, 'PRO-VIVIENDA', 9::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 10624.17::numeric, NULL::numeric, 2::numeric, 212.48::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000023'::uuid, 'SIP-RIESGO-PROF', 10::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 10624.17::numeric, NULL::numeric, 1.71::numeric, 181.67::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000023'::uuid, 'SIP-SOLIDARIO-PAT', 11::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 10624.17::numeric, NULL::numeric, 3::numeric, 318.73::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000024'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 5800::numeric, 30::numeric, 100::numeric, 5800::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202607000024'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 5800::numeric, 30::numeric, 5::numeric, 290::numeric, '4 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202607000024'::uuid, 'SIP-COMISION', 3::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 6090::numeric, NULL::numeric, 0.5::numeric, 30.45::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000024'::uuid, 'SIP-RIESGO', 4::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 6090::numeric, NULL::numeric, 1.71::numeric, 104.14::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000024'::uuid, 'SIP-SOLIDARIO', 5::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 6090::numeric, NULL::numeric, 0.5::numeric, 30.45::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000024'::uuid, 'SIP-VEJEZ', 6::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 6090::numeric, NULL::numeric, 10::numeric, 609::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000024'::uuid, 'CNS-SALUD', 7::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 6090::numeric, NULL::numeric, 10::numeric, 609::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000024'::uuid, 'PRO-VIVIENDA', 8::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 6090::numeric, NULL::numeric, 2::numeric, 121.8::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000024'::uuid, 'SIP-RIESGO-PROF', 9::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 6090::numeric, NULL::numeric, 1.71::numeric, 104.14::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000024'::uuid, 'SIP-SOLIDARIO-PAT', 10::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 6090::numeric, NULL::numeric, 3::numeric, 182.7::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000025'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 5800::numeric, 29::numeric, 100::numeric, 5606.67::numeric, '29 de 30 días'),
  ('c0000000-0000-4000-8000-202607000025'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 5800::numeric, 29::numeric, 5::numeric, 280.33::numeric, '3 años de servicio · 29 de 30 días'),
  ('c0000000-0000-4000-8000-202607000025'::uuid, 'HORAS-EXTRA', 3::smallint, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 24.17::numeric, 3::numeric, 100::numeric, 145::numeric, '3 h a Bs 24,17 la hora'),
  ('c0000000-0000-4000-8000-202607000025'::uuid, 'SIP-COMISION', 4::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 6032::numeric, NULL::numeric, 0.5::numeric, 30.16::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000025'::uuid, 'SIP-RIESGO', 5::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 6032::numeric, NULL::numeric, 1.71::numeric, 103.15::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000025'::uuid, 'SIP-SOLIDARIO', 6::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 6032::numeric, NULL::numeric, 0.5::numeric, 30.16::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000025'::uuid, 'SIP-VEJEZ', 7::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 6032::numeric, NULL::numeric, 10::numeric, 603.2::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000025'::uuid, 'CNS-SALUD', 8::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 6032::numeric, NULL::numeric, 10::numeric, 603.2::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000025'::uuid, 'PRO-VIVIENDA', 9::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 6032::numeric, NULL::numeric, 2::numeric, 120.64::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000025'::uuid, 'SIP-RIESGO-PROF', 10::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 6032::numeric, NULL::numeric, 1.71::numeric, 103.15::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000025'::uuid, 'SIP-SOLIDARIO-PAT', 11::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 6032::numeric, NULL::numeric, 3::numeric, 180.96::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000026'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 5200::numeric, 30::numeric, 100::numeric, 5200::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202607000026'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 5200::numeric, 30::numeric, 5::numeric, 260::numeric, '2 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202607000026'::uuid, 'HORAS-EXTRA', 3::smallint, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 21.67::numeric, 2::numeric, 100::numeric, 86.67::numeric, '2 h a Bs 21,67 la hora'),
  ('c0000000-0000-4000-8000-202607000026'::uuid, 'DOMINICAL', 4::smallint, 'INGRESO', 'DOMINICAL', 'Domingos, feriados y descansos trabajados', 'PORCENTAJE', 21.67::numeric, 8::numeric, 100::numeric, 173.33::numeric, '8 h a Bs 21,67 la hora'),
  ('c0000000-0000-4000-8000-202607000026'::uuid, 'SIP-COMISION', 5::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 5720::numeric, NULL::numeric, 0.5::numeric, 28.6::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000026'::uuid, 'SIP-RIESGO', 6::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 5720::numeric, NULL::numeric, 1.71::numeric, 97.81::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000026'::uuid, 'SIP-SOLIDARIO', 7::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 5720::numeric, NULL::numeric, 0.5::numeric, 28.6::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000026'::uuid, 'SIP-VEJEZ', 8::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 5720::numeric, NULL::numeric, 10::numeric, 572::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000026'::uuid, 'CNS-SALUD', 9::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 5720::numeric, NULL::numeric, 10::numeric, 572::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000026'::uuid, 'PRO-VIVIENDA', 10::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 5720::numeric, NULL::numeric, 2::numeric, 114.4::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000026'::uuid, 'SIP-RIESGO-PROF', 11::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 5720::numeric, NULL::numeric, 1.71::numeric, 97.81::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000026'::uuid, 'SIP-SOLIDARIO-PAT', 12::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 5720::numeric, NULL::numeric, 3::numeric, 171.6::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000031'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 3200::numeric, 30::numeric, 100::numeric, 3200::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202607000031'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 3200::numeric, 30::numeric, 11::numeric, 352::numeric, '7 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202607000031'::uuid, 'HORAS-EXTRA', 3::smallint, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 13.33::numeric, 1::numeric, 100::numeric, 26.67::numeric, '1 h a Bs 13,33 la hora'),
  ('c0000000-0000-4000-8000-202607000031'::uuid, 'SIP-COMISION', 4::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 3578.67::numeric, NULL::numeric, 0.5::numeric, 17.89::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000031'::uuid, 'SIP-RIESGO', 5::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 3578.67::numeric, NULL::numeric, 1.71::numeric, 61.2::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000031'::uuid, 'SIP-SOLIDARIO', 6::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 3578.67::numeric, NULL::numeric, 0.5::numeric, 17.89::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000031'::uuid, 'SIP-VEJEZ', 7::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 3578.67::numeric, NULL::numeric, 10::numeric, 357.87::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000031'::uuid, 'CNS-SALUD', 8::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 3578.67::numeric, NULL::numeric, 10::numeric, 357.87::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000031'::uuid, 'PRO-VIVIENDA', 9::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 3578.67::numeric, NULL::numeric, 2::numeric, 71.57::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000031'::uuid, 'SIP-RIESGO-PROF', 10::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 3578.67::numeric, NULL::numeric, 1.71::numeric, 61.2::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000031'::uuid, 'SIP-SOLIDARIO-PAT', 11::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 3578.67::numeric, NULL::numeric, 3::numeric, 107.36::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000032'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 3200::numeric, 30::numeric, 100::numeric, 3200::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202607000032'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 3200::numeric, 30::numeric, 11::numeric, 352::numeric, '6 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202607000032'::uuid, 'SIP-COMISION', 3::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 3552::numeric, NULL::numeric, 0.5::numeric, 17.76::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000032'::uuid, 'SIP-RIESGO', 4::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 3552::numeric, NULL::numeric, 1.71::numeric, 60.74::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000032'::uuid, 'SIP-SOLIDARIO', 5::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 3552::numeric, NULL::numeric, 0.5::numeric, 17.76::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000032'::uuid, 'SIP-VEJEZ', 6::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 3552::numeric, NULL::numeric, 10::numeric, 355.2::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000032'::uuid, 'CNS-SALUD', 7::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 3552::numeric, NULL::numeric, 10::numeric, 355.2::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000032'::uuid, 'PRO-VIVIENDA', 8::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 3552::numeric, NULL::numeric, 2::numeric, 71.04::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000032'::uuid, 'SIP-RIESGO-PROF', 9::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 3552::numeric, NULL::numeric, 1.71::numeric, 60.74::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000032'::uuid, 'SIP-SOLIDARIO-PAT', 10::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 3552::numeric, NULL::numeric, 3::numeric, 106.56::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000033'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 3200::numeric, 30::numeric, 100::numeric, 3200::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202607000033'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 3200::numeric, 30::numeric, 11::numeric, 352::numeric, '5 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202607000033'::uuid, 'HORAS-EXTRA', 3::smallint, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 13.33::numeric, 3::numeric, 100::numeric, 80::numeric, '3 h a Bs 13,33 la hora'),
  ('c0000000-0000-4000-8000-202607000033'::uuid, 'SIP-COMISION', 4::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 3632::numeric, NULL::numeric, 0.5::numeric, 18.16::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000033'::uuid, 'SIP-RIESGO', 5::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 3632::numeric, NULL::numeric, 1.71::numeric, 62.11::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000033'::uuid, 'SIP-SOLIDARIO', 6::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 3632::numeric, NULL::numeric, 0.5::numeric, 18.16::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000033'::uuid, 'SIP-VEJEZ', 7::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 3632::numeric, NULL::numeric, 10::numeric, 363.2::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000033'::uuid, 'CNS-SALUD', 8::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 3632::numeric, NULL::numeric, 10::numeric, 363.2::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000033'::uuid, 'PRO-VIVIENDA', 9::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 3632::numeric, NULL::numeric, 2::numeric, 72.64::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000033'::uuid, 'SIP-RIESGO-PROF', 10::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 3632::numeric, NULL::numeric, 1.71::numeric, 62.11::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000033'::uuid, 'SIP-SOLIDARIO-PAT', 11::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 3632::numeric, NULL::numeric, 3::numeric, 108.96::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000034'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 3400::numeric, 29::numeric, 100::numeric, 3286.67::numeric, '29 de 30 días'),
  ('c0000000-0000-4000-8000-202607000034'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 3400::numeric, 29::numeric, 5::numeric, 164.33::numeric, '4 años de servicio · 29 de 30 días'),
  ('c0000000-0000-4000-8000-202607000034'::uuid, 'HORAS-EXTRA', 3::smallint, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 14.17::numeric, 2::numeric, 100::numeric, 56.67::numeric, '2 h a Bs 14,17 la hora'),
  ('c0000000-0000-4000-8000-202607000034'::uuid, 'DOMINICAL', 4::smallint, 'INGRESO', 'DOMINICAL', 'Domingos, feriados y descansos trabajados', 'PORCENTAJE', 14.17::numeric, 8::numeric, 100::numeric, 113.33::numeric, '8 h a Bs 14,17 la hora'),
  ('c0000000-0000-4000-8000-202607000034'::uuid, 'SIP-COMISION', 5::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 3621::numeric, NULL::numeric, 0.5::numeric, 18.11::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000034'::uuid, 'SIP-RIESGO', 6::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 3621::numeric, NULL::numeric, 1.71::numeric, 61.92::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000034'::uuid, 'SIP-SOLIDARIO', 7::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 3621::numeric, NULL::numeric, 0.5::numeric, 18.11::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000034'::uuid, 'SIP-VEJEZ', 8::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 3621::numeric, NULL::numeric, 10::numeric, 362.1::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000034'::uuid, 'CNS-SALUD', 9::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 3621::numeric, NULL::numeric, 10::numeric, 362.1::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000034'::uuid, 'PRO-VIVIENDA', 10::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 3621::numeric, NULL::numeric, 2::numeric, 72.42::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000034'::uuid, 'SIP-RIESGO-PROF', 11::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 3621::numeric, NULL::numeric, 1.71::numeric, 61.92::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000034'::uuid, 'SIP-SOLIDARIO-PAT', 12::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 3621::numeric, NULL::numeric, 3::numeric, 108.63::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000035'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 3200::numeric, 30::numeric, 100::numeric, 3200::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202607000035'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 3200::numeric, 30::numeric, 5::numeric, 160::numeric, '3 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202607000035'::uuid, 'HORAS-EXTRA', 3::smallint, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 13.33::numeric, 1::numeric, 100::numeric, 26.67::numeric, '1 h a Bs 13,33 la hora'),
  ('c0000000-0000-4000-8000-202607000035'::uuid, 'RECARGO-NOCTURNO', 4::smallint, 'INGRESO', 'RECARGO-NOCTURNO', 'Recargo nocturno', 'PORCENTAJE', 13.33::numeric, 4::numeric, 25::numeric, 13.33::numeric, '4 h a Bs 13,33 la hora'),
  ('c0000000-0000-4000-8000-202607000035'::uuid, 'SIP-COMISION', 5::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 3400::numeric, NULL::numeric, 0.5::numeric, 17::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000035'::uuid, 'SIP-RIESGO', 6::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 3400::numeric, NULL::numeric, 1.71::numeric, 58.14::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000035'::uuid, 'SIP-SOLIDARIO', 7::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 3400::numeric, NULL::numeric, 0.5::numeric, 17::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000035'::uuid, 'SIP-VEJEZ', 8::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 3400::numeric, NULL::numeric, 10::numeric, 340::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000035'::uuid, 'CNS-SALUD', 9::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 3400::numeric, NULL::numeric, 10::numeric, 340::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000035'::uuid, 'PRO-VIVIENDA', 10::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 3400::numeric, NULL::numeric, 2::numeric, 68::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000035'::uuid, 'SIP-RIESGO-PROF', 11::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 3400::numeric, NULL::numeric, 1.71::numeric, 58.14::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000035'::uuid, 'SIP-SOLIDARIO-PAT', 12::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 3400::numeric, NULL::numeric, 3::numeric, 102::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000036'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 3400::numeric, 30::numeric, 100::numeric, 3400::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202607000036'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 3400::numeric, 30::numeric, 5::numeric, 170::numeric, '2 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202607000036'::uuid, 'SIP-COMISION', 3::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 3570::numeric, NULL::numeric, 0.5::numeric, 17.85::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000036'::uuid, 'SIP-RIESGO', 4::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 3570::numeric, NULL::numeric, 1.71::numeric, 61.05::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000036'::uuid, 'SIP-SOLIDARIO', 5::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 3570::numeric, NULL::numeric, 0.5::numeric, 17.85::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000036'::uuid, 'SIP-VEJEZ', 6::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 3570::numeric, NULL::numeric, 10::numeric, 357::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000036'::uuid, 'CNS-SALUD', 7::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 3570::numeric, NULL::numeric, 10::numeric, 357::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000036'::uuid, 'PRO-VIVIENDA', 8::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 3570::numeric, NULL::numeric, 2::numeric, 71.4::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000036'::uuid, 'SIP-RIESGO-PROF', 9::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 3570::numeric, NULL::numeric, 1.71::numeric, 61.05::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202607000036'::uuid, 'SIP-SOLIDARIO-PAT', 10::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 3570::numeric, NULL::numeric, 3::numeric, 107.1::numeric, NULL::varchar)
) AS r (id_planilla_empleado, codigo_vigencia, orden, tipo, codigo, nombre, forma_calculo, base, cantidad, valor, resultado, detalle)
JOIN PLANILLA_EMPLEADOS pe ON pe.id_planilla_empleado = r.id_planilla_empleado
ON CONFLICT DO NOTHING;

-- 2026-08 (CERRADA)
INSERT INTO PLANILLAS (id_planilla, periodo, fecha_inicio, fecha_fin, datos_hasta, estado, generada_por, generada_por_nombre, generada_en,
                       aprobada_por, aprobada_por_nombre, aprobada_en, estado_contabilidad, referencia_contabilidad, respondida_contabilidad_en,
                       estado_pagos, referencia_pagos, respondida_pagos_en, cerrada_en) VALUES
  ('c0000000-0000-4000-8000-000000202608', '2026-08', DATE '2026-08-01', DATE '2026-08-31', DATE '2026-08-31', 'CERRADA', 'f0000000-0000-4000-8000-000000000023', 'Andrea Salazar Vega', TIMESTAMPTZ '2026-09-01 09:00-04',
   'f0000000-0000-4000-8000-000000000023', 'Andrea Salazar Vega', TIMESTAMPTZ '2026-09-01 12:10-04', 'CONFIRMADA', 'AS-202608-043', TIMESTAMPTZ '2026-09-02 16:20-04',
   'CONFIRMADA', 'OP-202608-19', TIMESTAMPTZ '2026-09-02 16:20-04', TIMESTAMPTZ '2026-09-02 16:20-04')
ON CONFLICT DO NOTHING;
INSERT INTO PLANILLA_EMPLEADOS (id_planilla_empleado, id_planilla, id_empleado, nombre_empleado, numero_documento, cargo, area, sucursal,
                               id_contrato, numero_contrato, haber_mensual, contrato_desde, contrato_hasta, dias_contrato,
                               faltas_injustificadas, dias_pagados, minutos_extra_habil, minutos_domingo, minutos_nocturnos,
                               total_ganado, total_descuentos, liquido_pagable, total_aportes)
SELECT v.* FROM (VALUES
  ('c0000000-0000-4000-8000-202608000021'::uuid, 'c0000000-0000-4000-8000-000000202608'::uuid, 'f0000000-0000-4000-8000-000000000021'::uuid, 'Marcela Quiroga Peña', '7102877', 'Jefe de Atención al Cliente', 'Atención al cliente', 'Sopocachi',
   'c0000000-0000-4000-8000-000000000021'::uuid, 'CT-2019-021', 8500::numeric, DATE '2019-03-01', DATE '2026-08-31', 30::smallint,
   0::smallint, 30::smallint, 120, 0, 0,
   9576.67::numeric, 1217.19::numeric, 8359.48::numeric, 1600.26::numeric),
  ('c0000000-0000-4000-8000-202608000022'::uuid, 'c0000000-0000-4000-8000-000000202608'::uuid, 'f0000000-0000-4000-8000-000000000022'::uuid, 'Jorge Mamani Condori', '7103014', 'Jefe de Atención al Cliente', 'Atención al cliente', 'Miraflores',
   'c0000000-0000-4000-8000-000000000022'::uuid, 'CT-2020-022', 8500::numeric, DATE '2020-03-01', DATE '2026-08-31', 30::smallint,
   0::smallint, 30::smallint, 60, 0, 0,
   9505.83::numeric, 1208.19::numeric, 8297.64::numeric, 1588.42::numeric),
  ('c0000000-0000-4000-8000-202608000023'::uuid, 'c0000000-0000-4000-8000-000000202608'::uuid, 'f0000000-0000-4000-8000-000000000023'::uuid, 'Andrea Salazar Vega', '7103151', 'Jefe de Recursos Humanos', 'Recursos Humanos', 'Sopocachi',
   'c0000000-0000-4000-8000-000000000023'::uuid, 'CT-2021-023', 9500::numeric, DATE '2021-03-01', DATE '2026-08-31', 30::smallint,
   0::smallint, 30::smallint, 0, 480, 0,
   10861.67::numeric, 1380.52::numeric, 9481.15::numeric, 1814.98::numeric),
  ('c0000000-0000-4000-8000-202608000024'::uuid, 'c0000000-0000-4000-8000-000000202608'::uuid, 'f0000000-0000-4000-8000-000000000024'::uuid, 'Rosa Mendoza Ticona', '7103288', 'Supervisor de Cajas', 'Atención al cliente', 'Sopocachi',
   'c0000000-0000-4000-8000-000000000024'::uuid, 'CT-2022-024', 5800::numeric, DATE '2022-03-01', DATE '2026-08-31', 30::smallint,
   1::smallint, 29::smallint, 180, 0, 0,
   6032::numeric, 766.67::numeric, 5265.33::numeric, 1007.95::numeric),
  ('c0000000-0000-4000-8000-202608000025'::uuid, 'c0000000-0000-4000-8000-000000202608'::uuid, 'f0000000-0000-4000-8000-000000000025'::uuid, 'Luis Vargas Apaza', '7103425', 'Supervisor de Cajas', 'Atención al cliente', 'Miraflores',
   'c0000000-0000-4000-8000-000000000025'::uuid, 'CT-2023-025', 5800::numeric, DATE '2023-03-01', DATE '2026-08-31', 30::smallint,
   0::smallint, 30::smallint, 120, 0, 0,
   6186.67::numeric, 786.32::numeric, 5400.35::numeric, 1033.79::numeric),
  ('c0000000-0000-4000-8000-202608000026'::uuid, 'c0000000-0000-4000-8000-000000202608'::uuid, 'f0000000-0000-4000-8000-000000000026'::uuid, 'Sofía Condori Mamani', '7103562', 'Analista de Recursos Humanos', 'Recursos Humanos', 'Sopocachi',
   'c0000000-0000-4000-8000-000000000026'::uuid, 'CT-2024-026', 5200::numeric, DATE '2024-03-01', DATE '2026-08-31', 30::smallint,
   0::smallint, 30::smallint, 60, 0, 0,
   5503.33::numeric, 699.48::numeric, 4803.85::numeric, 919.61::numeric),
  ('c0000000-0000-4000-8000-202608000031'::uuid, 'c0000000-0000-4000-8000-000000202608'::uuid, 'f0000000-0000-4000-8000-000000000031'::uuid, 'Carlos Rojas Vargas', '7104247', 'Cajero', 'Atención al cliente', 'Sopocachi',
   'c0000000-0000-4000-8000-000000000031'::uuid, 'CT-2019-031', 3200::numeric, DATE '2019-03-01', DATE '2026-08-31', 30::smallint,
   0::smallint, 30::smallint, 0, 480, 0,
   3658.67::numeric, 465.01::numeric, 3193.66::numeric, 611.36::numeric),
  ('c0000000-0000-4000-8000-202608000032'::uuid, 'c0000000-0000-4000-8000-000000202608'::uuid, 'f0000000-0000-4000-8000-000000000032'::uuid, 'Lucía Flores Choque', '7104384', 'Cajero', 'Atención al cliente', 'Sopocachi',
   'c0000000-0000-4000-8000-000000000032'::uuid, 'CT-2020-032', 3200::numeric, DATE '2020-03-01', DATE '2026-08-31', 30::smallint,
   0::smallint, 30::smallint, 180, 0, 0,
   3632::numeric, 461.63::numeric, 3170.37::numeric, 606.91::numeric),
  ('c0000000-0000-4000-8000-202608000033'::uuid, 'c0000000-0000-4000-8000-000000202608'::uuid, 'f0000000-0000-4000-8000-000000000033'::uuid, 'Diego Quispe Mamani', '7104521', 'Cajero', 'Atención al cliente', 'Miraflores',
   'c0000000-0000-4000-8000-000000000033'::uuid, 'CT-2021-033', 3200::numeric, DATE '2021-03-01', DATE '2026-08-31', 30::smallint,
   1::smallint, 29::smallint, 120, 0, 120,
   3493.6::numeric, 444.04::numeric, 3049.56::numeric, 583.78::numeric),
  ('c0000000-0000-4000-8000-202608000034'::uuid, 'c0000000-0000-4000-8000-000000202608'::uuid, 'f0000000-0000-4000-8000-000000000034'::uuid, 'Paola Gutiérrez Limachi', '7104658', 'Asesor de Atención', 'Atención al cliente', 'Miraflores',
   'c0000000-0000-4000-8000-000000000034'::uuid, 'CT-2022-034', 3400::numeric, DATE '2022-03-01', DATE '2026-08-31', 30::smallint,
   0::smallint, 30::smallint, 60, 0, 0,
   3598.33::numeric, 457.34::numeric, 3140.99::numeric, 601.28::numeric),
  ('c0000000-0000-4000-8000-202608000035'::uuid, 'c0000000-0000-4000-8000-000000202608'::uuid, 'f0000000-0000-4000-8000-000000000035'::uuid, 'Ana Torrez Villca', '7104795', 'Cajero', 'Atención al cliente', 'Miraflores',
   'c0000000-0000-4000-8000-000000000035'::uuid, 'CT-2023-035', 3200::numeric, DATE '2023-03-01', DATE '2026-08-31', 30::smallint,
   0::smallint, 30::smallint, 0, 480, 0,
   3466.67::numeric, 440.61::numeric, 3026.06::numeric, 579.28::numeric),
  ('c0000000-0000-4000-8000-202608000036'::uuid, 'c0000000-0000-4000-8000-000000202608'::uuid, 'f0000000-0000-4000-8000-000000000036'::uuid, 'Mario Fernández Cruz', '7104932', 'Asesor de Atención', 'Atención al cliente', 'Sopocachi',
   'c0000000-0000-4000-8000-000000000036'::uuid, 'CT-2024-036', 3400::numeric, DATE '2024-03-01', DATE '2026-08-31', 30::smallint,
   0::smallint, 30::smallint, 180, 0, 0,
   3655::numeric, 464.56::numeric, 3190.44::numeric, 610.75::numeric)
) AS v (id_planilla_empleado, id_planilla, id_empleado, nombre_empleado, numero_documento, cargo, area, sucursal, id_contrato,
         numero_contrato, haber_mensual, contrato_desde, contrato_hasta, dias_contrato, faltas_injustificadas, dias_pagados,
         minutos_extra_habil, minutos_domingo, minutos_nocturnos, total_ganado, total_descuentos, liquido_pagable, total_aportes)
-- Solo si la planilla del mes es la de este archivo.
WHERE EXISTS (SELECT 1 FROM PLANILLAS p WHERE p.id_planilla = v.id_planilla)
ON CONFLICT DO NOTHING;
INSERT INTO CALCULOS_PLANILLA (id_planilla_empleado, id_vigencia, orden, tipo, codigo, nombre, forma_calculo, base, cantidad, valor, resultado, detalle)
SELECT r.id_planilla_empleado,
       (SELECT vc.id_vigencia FROM VIGENCIAS_CONCEPTO vc JOIN CONCEPTOS_PLANILLA cp ON cp.id_concepto = vc.id_concepto
        WHERE cp.codigo = r.codigo_vigencia AND vc.vigente_desde <= DATE '2026-08-31'
          AND (vc.vigente_hasta IS NULL OR vc.vigente_hasta >= DATE '2026-08-31')),
       r.orden, r.tipo, r.codigo, r.nombre, r.forma_calculo, r.base, r.cantidad, r.valor, r.resultado, r.detalle
FROM (VALUES
  ('c0000000-0000-4000-8000-202608000021'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 8500::numeric, 30::numeric, 100::numeric, 8500::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202608000021'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 8500::numeric, 30::numeric, 11::numeric, 935::numeric, '7 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202608000021'::uuid, 'HORAS-EXTRA', 3::smallint, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 35.42::numeric, 2::numeric, 100::numeric, 141.67::numeric, '2 h a Bs 35,42 la hora'),
  ('c0000000-0000-4000-8000-202608000021'::uuid, 'SIP-COMISION', 4::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 9576.67::numeric, NULL::numeric, 0.5::numeric, 47.88::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000021'::uuid, 'SIP-RIESGO', 5::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 9576.67::numeric, NULL::numeric, 1.71::numeric, 163.76::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000021'::uuid, 'SIP-SOLIDARIO', 6::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 9576.67::numeric, NULL::numeric, 0.5::numeric, 47.88::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000021'::uuid, 'SIP-VEJEZ', 7::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 9576.67::numeric, NULL::numeric, 10::numeric, 957.67::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000021'::uuid, 'CNS-SALUD', 8::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 9576.67::numeric, NULL::numeric, 10::numeric, 957.67::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000021'::uuid, 'PRO-VIVIENDA', 9::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 9576.67::numeric, NULL::numeric, 2::numeric, 191.53::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000021'::uuid, 'SIP-RIESGO-PROF', 10::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 9576.67::numeric, NULL::numeric, 1.71::numeric, 163.76::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000021'::uuid, 'SIP-SOLIDARIO-PAT', 11::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 9576.67::numeric, NULL::numeric, 3::numeric, 287.3::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000022'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 8500::numeric, 30::numeric, 100::numeric, 8500::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202608000022'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 8500::numeric, 30::numeric, 11::numeric, 935::numeric, '6 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202608000022'::uuid, 'HORAS-EXTRA', 3::smallint, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 35.42::numeric, 1::numeric, 100::numeric, 70.83::numeric, '1 h a Bs 35,42 la hora'),
  ('c0000000-0000-4000-8000-202608000022'::uuid, 'SIP-COMISION', 4::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 9505.83::numeric, NULL::numeric, 0.5::numeric, 47.53::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000022'::uuid, 'SIP-RIESGO', 5::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 9505.83::numeric, NULL::numeric, 1.71::numeric, 162.55::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000022'::uuid, 'SIP-SOLIDARIO', 6::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 9505.83::numeric, NULL::numeric, 0.5::numeric, 47.53::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000022'::uuid, 'SIP-VEJEZ', 7::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 9505.83::numeric, NULL::numeric, 10::numeric, 950.58::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000022'::uuid, 'CNS-SALUD', 8::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 9505.83::numeric, NULL::numeric, 10::numeric, 950.58::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000022'::uuid, 'PRO-VIVIENDA', 9::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 9505.83::numeric, NULL::numeric, 2::numeric, 190.12::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000022'::uuid, 'SIP-RIESGO-PROF', 10::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 9505.83::numeric, NULL::numeric, 1.71::numeric, 162.55::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000022'::uuid, 'SIP-SOLIDARIO-PAT', 11::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 9505.83::numeric, NULL::numeric, 3::numeric, 285.17::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000023'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 9500::numeric, 30::numeric, 100::numeric, 9500::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202608000023'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 9500::numeric, 30::numeric, 11::numeric, 1045::numeric, '5 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202608000023'::uuid, 'DOMINICAL', 3::smallint, 'INGRESO', 'DOMINICAL', 'Domingos, feriados y descansos trabajados', 'PORCENTAJE', 39.58::numeric, 8::numeric, 100::numeric, 316.67::numeric, '8 h a Bs 39,58 la hora'),
  ('c0000000-0000-4000-8000-202608000023'::uuid, 'SIP-COMISION', 4::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 10861.67::numeric, NULL::numeric, 0.5::numeric, 54.31::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000023'::uuid, 'SIP-RIESGO', 5::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 10861.67::numeric, NULL::numeric, 1.71::numeric, 185.73::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000023'::uuid, 'SIP-SOLIDARIO', 6::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 10861.67::numeric, NULL::numeric, 0.5::numeric, 54.31::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000023'::uuid, 'SIP-VEJEZ', 7::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 10861.67::numeric, NULL::numeric, 10::numeric, 1086.17::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000023'::uuid, 'CNS-SALUD', 8::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 10861.67::numeric, NULL::numeric, 10::numeric, 1086.17::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000023'::uuid, 'PRO-VIVIENDA', 9::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 10861.67::numeric, NULL::numeric, 2::numeric, 217.23::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000023'::uuid, 'SIP-RIESGO-PROF', 10::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 10861.67::numeric, NULL::numeric, 1.71::numeric, 185.73::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000023'::uuid, 'SIP-SOLIDARIO-PAT', 11::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 10861.67::numeric, NULL::numeric, 3::numeric, 325.85::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000024'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 5800::numeric, 29::numeric, 100::numeric, 5606.67::numeric, '29 de 30 días'),
  ('c0000000-0000-4000-8000-202608000024'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 5800::numeric, 29::numeric, 5::numeric, 280.33::numeric, '4 años de servicio · 29 de 30 días'),
  ('c0000000-0000-4000-8000-202608000024'::uuid, 'HORAS-EXTRA', 3::smallint, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 24.17::numeric, 3::numeric, 100::numeric, 145::numeric, '3 h a Bs 24,17 la hora'),
  ('c0000000-0000-4000-8000-202608000024'::uuid, 'SIP-COMISION', 4::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 6032::numeric, NULL::numeric, 0.5::numeric, 30.16::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000024'::uuid, 'SIP-RIESGO', 5::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 6032::numeric, NULL::numeric, 1.71::numeric, 103.15::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000024'::uuid, 'SIP-SOLIDARIO', 6::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 6032::numeric, NULL::numeric, 0.5::numeric, 30.16::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000024'::uuid, 'SIP-VEJEZ', 7::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 6032::numeric, NULL::numeric, 10::numeric, 603.2::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000024'::uuid, 'CNS-SALUD', 8::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 6032::numeric, NULL::numeric, 10::numeric, 603.2::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000024'::uuid, 'PRO-VIVIENDA', 9::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 6032::numeric, NULL::numeric, 2::numeric, 120.64::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000024'::uuid, 'SIP-RIESGO-PROF', 10::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 6032::numeric, NULL::numeric, 1.71::numeric, 103.15::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000024'::uuid, 'SIP-SOLIDARIO-PAT', 11::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 6032::numeric, NULL::numeric, 3::numeric, 180.96::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000025'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 5800::numeric, 30::numeric, 100::numeric, 5800::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202608000025'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 5800::numeric, 30::numeric, 5::numeric, 290::numeric, '3 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202608000025'::uuid, 'HORAS-EXTRA', 3::smallint, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 24.17::numeric, 2::numeric, 100::numeric, 96.67::numeric, '2 h a Bs 24,17 la hora'),
  ('c0000000-0000-4000-8000-202608000025'::uuid, 'SIP-COMISION', 4::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 6186.67::numeric, NULL::numeric, 0.5::numeric, 30.93::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000025'::uuid, 'SIP-RIESGO', 5::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 6186.67::numeric, NULL::numeric, 1.71::numeric, 105.79::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000025'::uuid, 'SIP-SOLIDARIO', 6::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 6186.67::numeric, NULL::numeric, 0.5::numeric, 30.93::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000025'::uuid, 'SIP-VEJEZ', 7::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 6186.67::numeric, NULL::numeric, 10::numeric, 618.67::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000025'::uuid, 'CNS-SALUD', 8::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 6186.67::numeric, NULL::numeric, 10::numeric, 618.67::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000025'::uuid, 'PRO-VIVIENDA', 9::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 6186.67::numeric, NULL::numeric, 2::numeric, 123.73::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000025'::uuid, 'SIP-RIESGO-PROF', 10::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 6186.67::numeric, NULL::numeric, 1.71::numeric, 105.79::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000025'::uuid, 'SIP-SOLIDARIO-PAT', 11::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 6186.67::numeric, NULL::numeric, 3::numeric, 185.6::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000026'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 5200::numeric, 30::numeric, 100::numeric, 5200::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202608000026'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 5200::numeric, 30::numeric, 5::numeric, 260::numeric, '2 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202608000026'::uuid, 'HORAS-EXTRA', 3::smallint, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 21.67::numeric, 1::numeric, 100::numeric, 43.33::numeric, '1 h a Bs 21,67 la hora'),
  ('c0000000-0000-4000-8000-202608000026'::uuid, 'SIP-COMISION', 4::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 5503.33::numeric, NULL::numeric, 0.5::numeric, 27.52::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000026'::uuid, 'SIP-RIESGO', 5::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 5503.33::numeric, NULL::numeric, 1.71::numeric, 94.11::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000026'::uuid, 'SIP-SOLIDARIO', 6::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 5503.33::numeric, NULL::numeric, 0.5::numeric, 27.52::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000026'::uuid, 'SIP-VEJEZ', 7::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 5503.33::numeric, NULL::numeric, 10::numeric, 550.33::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000026'::uuid, 'CNS-SALUD', 8::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 5503.33::numeric, NULL::numeric, 10::numeric, 550.33::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000026'::uuid, 'PRO-VIVIENDA', 9::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 5503.33::numeric, NULL::numeric, 2::numeric, 110.07::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000026'::uuid, 'SIP-RIESGO-PROF', 10::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 5503.33::numeric, NULL::numeric, 1.71::numeric, 94.11::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000026'::uuid, 'SIP-SOLIDARIO-PAT', 11::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 5503.33::numeric, NULL::numeric, 3::numeric, 165.1::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000031'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 3200::numeric, 30::numeric, 100::numeric, 3200::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202608000031'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 3200::numeric, 30::numeric, 11::numeric, 352::numeric, '7 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202608000031'::uuid, 'DOMINICAL', 3::smallint, 'INGRESO', 'DOMINICAL', 'Domingos, feriados y descansos trabajados', 'PORCENTAJE', 13.33::numeric, 8::numeric, 100::numeric, 106.67::numeric, '8 h a Bs 13,33 la hora'),
  ('c0000000-0000-4000-8000-202608000031'::uuid, 'SIP-COMISION', 4::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 3658.67::numeric, NULL::numeric, 0.5::numeric, 18.29::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000031'::uuid, 'SIP-RIESGO', 5::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 3658.67::numeric, NULL::numeric, 1.71::numeric, 62.56::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000031'::uuid, 'SIP-SOLIDARIO', 6::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 3658.67::numeric, NULL::numeric, 0.5::numeric, 18.29::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000031'::uuid, 'SIP-VEJEZ', 7::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 3658.67::numeric, NULL::numeric, 10::numeric, 365.87::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000031'::uuid, 'CNS-SALUD', 8::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 3658.67::numeric, NULL::numeric, 10::numeric, 365.87::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000031'::uuid, 'PRO-VIVIENDA', 9::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 3658.67::numeric, NULL::numeric, 2::numeric, 73.17::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000031'::uuid, 'SIP-RIESGO-PROF', 10::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 3658.67::numeric, NULL::numeric, 1.71::numeric, 62.56::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000031'::uuid, 'SIP-SOLIDARIO-PAT', 11::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 3658.67::numeric, NULL::numeric, 3::numeric, 109.76::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000032'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 3200::numeric, 30::numeric, 100::numeric, 3200::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202608000032'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 3200::numeric, 30::numeric, 11::numeric, 352::numeric, '6 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202608000032'::uuid, 'HORAS-EXTRA', 3::smallint, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 13.33::numeric, 3::numeric, 100::numeric, 80::numeric, '3 h a Bs 13,33 la hora'),
  ('c0000000-0000-4000-8000-202608000032'::uuid, 'SIP-COMISION', 4::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 3632::numeric, NULL::numeric, 0.5::numeric, 18.16::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000032'::uuid, 'SIP-RIESGO', 5::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 3632::numeric, NULL::numeric, 1.71::numeric, 62.11::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000032'::uuid, 'SIP-SOLIDARIO', 6::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 3632::numeric, NULL::numeric, 0.5::numeric, 18.16::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000032'::uuid, 'SIP-VEJEZ', 7::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 3632::numeric, NULL::numeric, 10::numeric, 363.2::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000032'::uuid, 'CNS-SALUD', 8::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 3632::numeric, NULL::numeric, 10::numeric, 363.2::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000032'::uuid, 'PRO-VIVIENDA', 9::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 3632::numeric, NULL::numeric, 2::numeric, 72.64::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000032'::uuid, 'SIP-RIESGO-PROF', 10::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 3632::numeric, NULL::numeric, 1.71::numeric, 62.11::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000032'::uuid, 'SIP-SOLIDARIO-PAT', 11::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 3632::numeric, NULL::numeric, 3::numeric, 108.96::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000033'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 3200::numeric, 29::numeric, 100::numeric, 3093.33::numeric, '29 de 30 días'),
  ('c0000000-0000-4000-8000-202608000033'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 3200::numeric, 29::numeric, 11::numeric, 340.27::numeric, '5 años de servicio · 29 de 30 días'),
  ('c0000000-0000-4000-8000-202608000033'::uuid, 'HORAS-EXTRA', 3::smallint, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 13.33::numeric, 2::numeric, 100::numeric, 53.33::numeric, '2 h a Bs 13,33 la hora'),
  ('c0000000-0000-4000-8000-202608000033'::uuid, 'RECARGO-NOCTURNO', 4::smallint, 'INGRESO', 'RECARGO-NOCTURNO', 'Recargo nocturno', 'PORCENTAJE', 13.33::numeric, 2::numeric, 25::numeric, 6.67::numeric, '2 h a Bs 13,33 la hora'),
  ('c0000000-0000-4000-8000-202608000033'::uuid, 'SIP-COMISION', 5::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 3493.6::numeric, NULL::numeric, 0.5::numeric, 17.47::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000033'::uuid, 'SIP-RIESGO', 6::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 3493.6::numeric, NULL::numeric, 1.71::numeric, 59.74::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000033'::uuid, 'SIP-SOLIDARIO', 7::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 3493.6::numeric, NULL::numeric, 0.5::numeric, 17.47::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000033'::uuid, 'SIP-VEJEZ', 8::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 3493.6::numeric, NULL::numeric, 10::numeric, 349.36::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000033'::uuid, 'CNS-SALUD', 9::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 3493.6::numeric, NULL::numeric, 10::numeric, 349.36::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000033'::uuid, 'PRO-VIVIENDA', 10::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 3493.6::numeric, NULL::numeric, 2::numeric, 69.87::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000033'::uuid, 'SIP-RIESGO-PROF', 11::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 3493.6::numeric, NULL::numeric, 1.71::numeric, 59.74::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000033'::uuid, 'SIP-SOLIDARIO-PAT', 12::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 3493.6::numeric, NULL::numeric, 3::numeric, 104.81::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000034'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 3400::numeric, 30::numeric, 100::numeric, 3400::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202608000034'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 3400::numeric, 30::numeric, 5::numeric, 170::numeric, '4 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202608000034'::uuid, 'HORAS-EXTRA', 3::smallint, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 14.17::numeric, 1::numeric, 100::numeric, 28.33::numeric, '1 h a Bs 14,17 la hora'),
  ('c0000000-0000-4000-8000-202608000034'::uuid, 'SIP-COMISION', 4::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 3598.33::numeric, NULL::numeric, 0.5::numeric, 17.99::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000034'::uuid, 'SIP-RIESGO', 5::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 3598.33::numeric, NULL::numeric, 1.71::numeric, 61.53::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000034'::uuid, 'SIP-SOLIDARIO', 6::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 3598.33::numeric, NULL::numeric, 0.5::numeric, 17.99::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000034'::uuid, 'SIP-VEJEZ', 7::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 3598.33::numeric, NULL::numeric, 10::numeric, 359.83::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000034'::uuid, 'CNS-SALUD', 8::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 3598.33::numeric, NULL::numeric, 10::numeric, 359.83::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000034'::uuid, 'PRO-VIVIENDA', 9::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 3598.33::numeric, NULL::numeric, 2::numeric, 71.97::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000034'::uuid, 'SIP-RIESGO-PROF', 10::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 3598.33::numeric, NULL::numeric, 1.71::numeric, 61.53::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000034'::uuid, 'SIP-SOLIDARIO-PAT', 11::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 3598.33::numeric, NULL::numeric, 3::numeric, 107.95::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000035'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 3200::numeric, 30::numeric, 100::numeric, 3200::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202608000035'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 3200::numeric, 30::numeric, 5::numeric, 160::numeric, '3 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202608000035'::uuid, 'DOMINICAL', 3::smallint, 'INGRESO', 'DOMINICAL', 'Domingos, feriados y descansos trabajados', 'PORCENTAJE', 13.33::numeric, 8::numeric, 100::numeric, 106.67::numeric, '8 h a Bs 13,33 la hora'),
  ('c0000000-0000-4000-8000-202608000035'::uuid, 'SIP-COMISION', 4::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 3466.67::numeric, NULL::numeric, 0.5::numeric, 17.33::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000035'::uuid, 'SIP-RIESGO', 5::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 3466.67::numeric, NULL::numeric, 1.71::numeric, 59.28::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000035'::uuid, 'SIP-SOLIDARIO', 6::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 3466.67::numeric, NULL::numeric, 0.5::numeric, 17.33::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000035'::uuid, 'SIP-VEJEZ', 7::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 3466.67::numeric, NULL::numeric, 10::numeric, 346.67::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000035'::uuid, 'CNS-SALUD', 8::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 3466.67::numeric, NULL::numeric, 10::numeric, 346.67::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000035'::uuid, 'PRO-VIVIENDA', 9::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 3466.67::numeric, NULL::numeric, 2::numeric, 69.33::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000035'::uuid, 'SIP-RIESGO-PROF', 10::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 3466.67::numeric, NULL::numeric, 1.71::numeric, 59.28::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000035'::uuid, 'SIP-SOLIDARIO-PAT', 11::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 3466.67::numeric, NULL::numeric, 3::numeric, 104::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000036'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 3400::numeric, 30::numeric, 100::numeric, 3400::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202608000036'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 3400::numeric, 30::numeric, 5::numeric, 170::numeric, '2 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202608000036'::uuid, 'HORAS-EXTRA', 3::smallint, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 14.17::numeric, 3::numeric, 100::numeric, 85::numeric, '3 h a Bs 14,17 la hora'),
  ('c0000000-0000-4000-8000-202608000036'::uuid, 'SIP-COMISION', 4::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 3655::numeric, NULL::numeric, 0.5::numeric, 18.28::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000036'::uuid, 'SIP-RIESGO', 5::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 3655::numeric, NULL::numeric, 1.71::numeric, 62.5::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000036'::uuid, 'SIP-SOLIDARIO', 6::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 3655::numeric, NULL::numeric, 0.5::numeric, 18.28::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000036'::uuid, 'SIP-VEJEZ', 7::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 3655::numeric, NULL::numeric, 10::numeric, 365.5::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000036'::uuid, 'CNS-SALUD', 8::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 3655::numeric, NULL::numeric, 10::numeric, 365.5::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000036'::uuid, 'PRO-VIVIENDA', 9::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 3655::numeric, NULL::numeric, 2::numeric, 73.1::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000036'::uuid, 'SIP-RIESGO-PROF', 10::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 3655::numeric, NULL::numeric, 1.71::numeric, 62.5::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202608000036'::uuid, 'SIP-SOLIDARIO-PAT', 11::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 3655::numeric, NULL::numeric, 3::numeric, 109.65::numeric, NULL::varchar)
) AS r (id_planilla_empleado, codigo_vigencia, orden, tipo, codigo, nombre, forma_calculo, base, cantidad, valor, resultado, detalle)
JOIN PLANILLA_EMPLEADOS pe ON pe.id_planilla_empleado = r.id_planilla_empleado
ON CONFLICT DO NOTHING;

-- 2026-09 (APROBADA)
INSERT INTO PLANILLAS (id_planilla, periodo, fecha_inicio, fecha_fin, datos_hasta, estado, generada_por, generada_por_nombre, generada_en,
                       aprobada_por, aprobada_por_nombre, aprobada_en, estado_contabilidad, referencia_contabilidad, respondida_contabilidad_en,
                       estado_pagos, referencia_pagos, respondida_pagos_en, cerrada_en) VALUES
  ('c0000000-0000-4000-8000-000000202609', '2026-09', DATE '2026-09-01', DATE '2026-09-30', DATE '2026-09-30', 'APROBADA', 'f0000000-0000-4000-8000-000000000023', 'Andrea Salazar Vega', TIMESTAMPTZ '2026-10-01 09:00-04',
   'f0000000-0000-4000-8000-000000000023', 'Andrea Salazar Vega', TIMESTAMPTZ '2026-10-01 11:45-04', 'CONFIRMADA', 'AS-202609-044', TIMESTAMPTZ '2026-10-02 10:05-04',
   'PENDIENTE', NULL, NULL, NULL)
ON CONFLICT DO NOTHING;
INSERT INTO PLANILLA_EMPLEADOS (id_planilla_empleado, id_planilla, id_empleado, nombre_empleado, numero_documento, cargo, area, sucursal,
                               id_contrato, numero_contrato, haber_mensual, contrato_desde, contrato_hasta, dias_contrato,
                               faltas_injustificadas, dias_pagados, minutos_extra_habil, minutos_domingo, minutos_nocturnos,
                               total_ganado, total_descuentos, liquido_pagable, total_aportes)
SELECT v.* FROM (VALUES
  ('c0000000-0000-4000-8000-202609000021'::uuid, 'c0000000-0000-4000-8000-000000202609'::uuid, 'f0000000-0000-4000-8000-000000000021'::uuid, 'Marcela Quiroga Peña', '7102877', 'Jefe de Atención al Cliente', 'Atención al cliente', 'Sopocachi',
   'c0000000-0000-4000-8000-000000000021'::uuid, 'CT-2019-021', 8500::numeric, DATE '2019-03-01', DATE '2026-09-30', 30::smallint,
   0::smallint, 30::smallint, 60, 0, 0,
   9505.83::numeric, 1208.19::numeric, 8297.64::numeric, 1588.42::numeric),
  ('c0000000-0000-4000-8000-202609000022'::uuid, 'c0000000-0000-4000-8000-000000202609'::uuid, 'f0000000-0000-4000-8000-000000000022'::uuid, 'Jorge Mamani Condori', '7103014', 'Jefe de Atención al Cliente', 'Atención al cliente', 'Miraflores',
   'c0000000-0000-4000-8000-000000000022'::uuid, 'CT-2020-022', 8500::numeric, DATE '2020-03-01', DATE '2026-09-30', 30::smallint,
   0::smallint, 30::smallint, 0, 0, 0,
   9435::numeric, 1199.2::numeric, 8235.8::numeric, 1576.59::numeric),
  ('c0000000-0000-4000-8000-202609000023'::uuid, 'c0000000-0000-4000-8000-000000202609'::uuid, 'f0000000-0000-4000-8000-000000000023'::uuid, 'Andrea Salazar Vega', '7103151', 'Jefe de Recursos Humanos', 'Recursos Humanos', 'Sopocachi',
   'c0000000-0000-4000-8000-000000000023'::uuid, 'CT-2021-023', 9500::numeric, DATE '2021-03-01', DATE '2026-09-30', 30::smallint,
   1::smallint, 29::smallint, 180, 0, 0,
   10431::numeric, 1325.79::numeric, 9105.21::numeric, 1743.02::numeric),
  ('c0000000-0000-4000-8000-202609000024'::uuid, 'c0000000-0000-4000-8000-000000202609'::uuid, 'f0000000-0000-4000-8000-000000000024'::uuid, 'Rosa Mendoza Ticona', '7103288', 'Supervisor de Cajas', 'Atención al cliente', 'Sopocachi',
   'c0000000-0000-4000-8000-000000000024'::uuid, 'CT-2022-024', 5800::numeric, DATE '2022-03-01', DATE '2026-09-30', 30::smallint,
   0::smallint, 30::smallint, 120, 480, 0,
   6380::numeric, 810.9::numeric, 5569.1::numeric, 1066.1::numeric),
  ('c0000000-0000-4000-8000-202609000025'::uuid, 'c0000000-0000-4000-8000-000000202609'::uuid, 'f0000000-0000-4000-8000-000000000025'::uuid, 'Luis Vargas Apaza', '7103425', 'Supervisor de Cajas', 'Atención al cliente', 'Miraflores',
   'c0000000-0000-4000-8000-000000000025'::uuid, 'CT-2023-025', 5800::numeric, DATE '2023-03-01', DATE '2026-09-30', 30::smallint,
   0::smallint, 30::smallint, 60, 0, 0,
   6138.33::numeric, 780.18::numeric, 5358.15::numeric, 1025.72::numeric),
  ('c0000000-0000-4000-8000-202609000026'::uuid, 'c0000000-0000-4000-8000-000000202609'::uuid, 'f0000000-0000-4000-8000-000000000026'::uuid, 'Sofía Condori Mamani', '7103562', 'Analista de Recursos Humanos', 'Recursos Humanos', 'Sopocachi',
   'c0000000-0000-4000-8000-000000000026'::uuid, 'CT-2024-026', 5200::numeric, DATE '2024-03-01', DATE '2026-09-30', 30::smallint,
   0::smallint, 30::smallint, 0, 0, 0,
   5460::numeric, 693.97::numeric, 4766.03::numeric, 912.37::numeric),
  ('c0000000-0000-4000-8000-202609000031'::uuid, 'c0000000-0000-4000-8000-000000202609'::uuid, 'f0000000-0000-4000-8000-000000000031'::uuid, 'Carlos Rojas Vargas', '7104247', 'Cajero', 'Atención al cliente', 'Sopocachi',
   'c0000000-0000-4000-8000-000000000031'::uuid, 'CT-2019-031', 3200::numeric, DATE '2019-03-01', DATE '2026-09-30', 30::smallint,
   0::smallint, 30::smallint, 180, 0, 0,
   3632::numeric, 461.63::numeric, 3170.37::numeric, 606.91::numeric),
  ('c0000000-0000-4000-8000-202609000032'::uuid, 'c0000000-0000-4000-8000-000000202609'::uuid, 'f0000000-0000-4000-8000-000000000032'::uuid, 'Lucía Flores Choque', '7104384', 'Cajero', 'Atención al cliente', 'Sopocachi',
   'c0000000-0000-4000-8000-000000000032'::uuid, 'CT-2020-032', 3200::numeric, DATE '2020-03-01', DATE '2026-09-30', 30::smallint,
   1::smallint, 29::smallint, 120, 480, 0,
   3593.6::numeric, 456.75::numeric, 3136.85::numeric, 600.49::numeric),
  ('c0000000-0000-4000-8000-202609000033'::uuid, 'c0000000-0000-4000-8000-000000202609'::uuid, 'f0000000-0000-4000-8000-000000000033'::uuid, 'Diego Quispe Mamani', '7104521', 'Cajero', 'Atención al cliente', 'Miraflores',
   'c0000000-0000-4000-8000-000000000033'::uuid, 'CT-2021-033', 3200::numeric, DATE '2021-03-01', DATE '2026-09-30', 30::smallint,
   0::smallint, 30::smallint, 60, 0, 240,
   3592::numeric, 456.54::numeric, 3135.46::numeric, 600.22::numeric),
  ('c0000000-0000-4000-8000-202609000034'::uuid, 'c0000000-0000-4000-8000-000000202609'::uuid, 'f0000000-0000-4000-8000-000000000034'::uuid, 'Paola Gutiérrez Limachi', '7104658', 'Asesor de Atención', 'Atención al cliente', 'Miraflores',
   'c0000000-0000-4000-8000-000000000034'::uuid, 'CT-2022-034', 3400::numeric, DATE '2022-03-01', DATE '2026-09-30', 30::smallint,
   0::smallint, 30::smallint, 0, 0, 0,
   3570::numeric, 453.75::numeric, 3116.25::numeric, 596.55::numeric),
  ('c0000000-0000-4000-8000-202609000035'::uuid, 'c0000000-0000-4000-8000-000000202609'::uuid, 'f0000000-0000-4000-8000-000000000035'::uuid, 'Ana Torrez Villca', '7104795', 'Cajero', 'Atención al cliente', 'Miraflores',
   'c0000000-0000-4000-8000-000000000035'::uuid, 'CT-2023-035', 3200::numeric, DATE '2023-03-01', DATE '2026-09-30', 30::smallint,
   0::smallint, 30::smallint, 180, 0, 120,
   3446.67::numeric, 438.07::numeric, 3008.6::numeric, 575.94::numeric),
  ('c0000000-0000-4000-8000-202609000036'::uuid, 'c0000000-0000-4000-8000-000000202609'::uuid, 'f0000000-0000-4000-8000-000000000036'::uuid, 'Mario Fernández Cruz', '7104932', 'Asesor de Atención', 'Atención al cliente', 'Sopocachi',
   'c0000000-0000-4000-8000-000000000036'::uuid, 'CT-2024-036', 3400::numeric, DATE '2024-03-01', DATE '2026-09-30', 30::smallint,
   0::smallint, 30::smallint, 120, 480, 0,
   3740::numeric, 475.35::numeric, 3264.65::numeric, 624.95::numeric)
) AS v (id_planilla_empleado, id_planilla, id_empleado, nombre_empleado, numero_documento, cargo, area, sucursal, id_contrato,
         numero_contrato, haber_mensual, contrato_desde, contrato_hasta, dias_contrato, faltas_injustificadas, dias_pagados,
         minutos_extra_habil, minutos_domingo, minutos_nocturnos, total_ganado, total_descuentos, liquido_pagable, total_aportes)
-- Solo si la planilla del mes es la de este archivo.
WHERE EXISTS (SELECT 1 FROM PLANILLAS p WHERE p.id_planilla = v.id_planilla)
ON CONFLICT DO NOTHING;
INSERT INTO CALCULOS_PLANILLA (id_planilla_empleado, id_vigencia, orden, tipo, codigo, nombre, forma_calculo, base, cantidad, valor, resultado, detalle)
SELECT r.id_planilla_empleado,
       (SELECT vc.id_vigencia FROM VIGENCIAS_CONCEPTO vc JOIN CONCEPTOS_PLANILLA cp ON cp.id_concepto = vc.id_concepto
        WHERE cp.codigo = r.codigo_vigencia AND vc.vigente_desde <= DATE '2026-09-30'
          AND (vc.vigente_hasta IS NULL OR vc.vigente_hasta >= DATE '2026-09-30')),
       r.orden, r.tipo, r.codigo, r.nombre, r.forma_calculo, r.base, r.cantidad, r.valor, r.resultado, r.detalle
FROM (VALUES
  ('c0000000-0000-4000-8000-202609000021'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 8500::numeric, 30::numeric, 100::numeric, 8500::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202609000021'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 8500::numeric, 30::numeric, 11::numeric, 935::numeric, '7 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202609000021'::uuid, 'HORAS-EXTRA', 3::smallint, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 35.42::numeric, 1::numeric, 100::numeric, 70.83::numeric, '1 h a Bs 35,42 la hora'),
  ('c0000000-0000-4000-8000-202609000021'::uuid, 'SIP-COMISION', 4::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 9505.83::numeric, NULL::numeric, 0.5::numeric, 47.53::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000021'::uuid, 'SIP-RIESGO', 5::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 9505.83::numeric, NULL::numeric, 1.71::numeric, 162.55::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000021'::uuid, 'SIP-SOLIDARIO', 6::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 9505.83::numeric, NULL::numeric, 0.5::numeric, 47.53::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000021'::uuid, 'SIP-VEJEZ', 7::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 9505.83::numeric, NULL::numeric, 10::numeric, 950.58::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000021'::uuid, 'CNS-SALUD', 8::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 9505.83::numeric, NULL::numeric, 10::numeric, 950.58::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000021'::uuid, 'PRO-VIVIENDA', 9::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 9505.83::numeric, NULL::numeric, 2::numeric, 190.12::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000021'::uuid, 'SIP-RIESGO-PROF', 10::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 9505.83::numeric, NULL::numeric, 1.71::numeric, 162.55::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000021'::uuid, 'SIP-SOLIDARIO-PAT', 11::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 9505.83::numeric, NULL::numeric, 3::numeric, 285.17::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000022'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 8500::numeric, 30::numeric, 100::numeric, 8500::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202609000022'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 8500::numeric, 30::numeric, 11::numeric, 935::numeric, '6 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202609000022'::uuid, 'SIP-COMISION', 3::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 9435::numeric, NULL::numeric, 0.5::numeric, 47.18::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000022'::uuid, 'SIP-RIESGO', 4::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 9435::numeric, NULL::numeric, 1.71::numeric, 161.34::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000022'::uuid, 'SIP-SOLIDARIO', 5::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 9435::numeric, NULL::numeric, 0.5::numeric, 47.18::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000022'::uuid, 'SIP-VEJEZ', 6::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 9435::numeric, NULL::numeric, 10::numeric, 943.5::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000022'::uuid, 'CNS-SALUD', 7::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 9435::numeric, NULL::numeric, 10::numeric, 943.5::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000022'::uuid, 'PRO-VIVIENDA', 8::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 9435::numeric, NULL::numeric, 2::numeric, 188.7::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000022'::uuid, 'SIP-RIESGO-PROF', 9::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 9435::numeric, NULL::numeric, 1.71::numeric, 161.34::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000022'::uuid, 'SIP-SOLIDARIO-PAT', 10::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 9435::numeric, NULL::numeric, 3::numeric, 283.05::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000023'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 9500::numeric, 29::numeric, 100::numeric, 9183.33::numeric, '29 de 30 días'),
  ('c0000000-0000-4000-8000-202609000023'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 9500::numeric, 29::numeric, 11::numeric, 1010.17::numeric, '5 años de servicio · 29 de 30 días'),
  ('c0000000-0000-4000-8000-202609000023'::uuid, 'HORAS-EXTRA', 3::smallint, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 39.58::numeric, 3::numeric, 100::numeric, 237.5::numeric, '3 h a Bs 39,58 la hora'),
  ('c0000000-0000-4000-8000-202609000023'::uuid, 'SIP-COMISION', 4::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 10431::numeric, NULL::numeric, 0.5::numeric, 52.16::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000023'::uuid, 'SIP-RIESGO', 5::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 10431::numeric, NULL::numeric, 1.71::numeric, 178.37::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000023'::uuid, 'SIP-SOLIDARIO', 6::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 10431::numeric, NULL::numeric, 0.5::numeric, 52.16::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000023'::uuid, 'SIP-VEJEZ', 7::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 10431::numeric, NULL::numeric, 10::numeric, 1043.1::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000023'::uuid, 'CNS-SALUD', 8::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 10431::numeric, NULL::numeric, 10::numeric, 1043.1::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000023'::uuid, 'PRO-VIVIENDA', 9::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 10431::numeric, NULL::numeric, 2::numeric, 208.62::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000023'::uuid, 'SIP-RIESGO-PROF', 10::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 10431::numeric, NULL::numeric, 1.71::numeric, 178.37::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000023'::uuid, 'SIP-SOLIDARIO-PAT', 11::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 10431::numeric, NULL::numeric, 3::numeric, 312.93::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000024'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 5800::numeric, 30::numeric, 100::numeric, 5800::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202609000024'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 5800::numeric, 30::numeric, 5::numeric, 290::numeric, '4 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202609000024'::uuid, 'HORAS-EXTRA', 3::smallint, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 24.17::numeric, 2::numeric, 100::numeric, 96.67::numeric, '2 h a Bs 24,17 la hora'),
  ('c0000000-0000-4000-8000-202609000024'::uuid, 'DOMINICAL', 4::smallint, 'INGRESO', 'DOMINICAL', 'Domingos, feriados y descansos trabajados', 'PORCENTAJE', 24.17::numeric, 8::numeric, 100::numeric, 193.33::numeric, '8 h a Bs 24,17 la hora'),
  ('c0000000-0000-4000-8000-202609000024'::uuid, 'SIP-COMISION', 5::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 6380::numeric, NULL::numeric, 0.5::numeric, 31.9::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000024'::uuid, 'SIP-RIESGO', 6::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 6380::numeric, NULL::numeric, 1.71::numeric, 109.1::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000024'::uuid, 'SIP-SOLIDARIO', 7::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 6380::numeric, NULL::numeric, 0.5::numeric, 31.9::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000024'::uuid, 'SIP-VEJEZ', 8::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 6380::numeric, NULL::numeric, 10::numeric, 638::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000024'::uuid, 'CNS-SALUD', 9::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 6380::numeric, NULL::numeric, 10::numeric, 638::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000024'::uuid, 'PRO-VIVIENDA', 10::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 6380::numeric, NULL::numeric, 2::numeric, 127.6::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000024'::uuid, 'SIP-RIESGO-PROF', 11::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 6380::numeric, NULL::numeric, 1.71::numeric, 109.1::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000024'::uuid, 'SIP-SOLIDARIO-PAT', 12::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 6380::numeric, NULL::numeric, 3::numeric, 191.4::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000025'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 5800::numeric, 30::numeric, 100::numeric, 5800::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202609000025'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 5800::numeric, 30::numeric, 5::numeric, 290::numeric, '3 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202609000025'::uuid, 'HORAS-EXTRA', 3::smallint, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 24.17::numeric, 1::numeric, 100::numeric, 48.33::numeric, '1 h a Bs 24,17 la hora'),
  ('c0000000-0000-4000-8000-202609000025'::uuid, 'SIP-COMISION', 4::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 6138.33::numeric, NULL::numeric, 0.5::numeric, 30.69::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000025'::uuid, 'SIP-RIESGO', 5::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 6138.33::numeric, NULL::numeric, 1.71::numeric, 104.97::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000025'::uuid, 'SIP-SOLIDARIO', 6::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 6138.33::numeric, NULL::numeric, 0.5::numeric, 30.69::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000025'::uuid, 'SIP-VEJEZ', 7::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 6138.33::numeric, NULL::numeric, 10::numeric, 613.83::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000025'::uuid, 'CNS-SALUD', 8::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 6138.33::numeric, NULL::numeric, 10::numeric, 613.83::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000025'::uuid, 'PRO-VIVIENDA', 9::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 6138.33::numeric, NULL::numeric, 2::numeric, 122.77::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000025'::uuid, 'SIP-RIESGO-PROF', 10::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 6138.33::numeric, NULL::numeric, 1.71::numeric, 104.97::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000025'::uuid, 'SIP-SOLIDARIO-PAT', 11::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 6138.33::numeric, NULL::numeric, 3::numeric, 184.15::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000026'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 5200::numeric, 30::numeric, 100::numeric, 5200::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202609000026'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 5200::numeric, 30::numeric, 5::numeric, 260::numeric, '2 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202609000026'::uuid, 'SIP-COMISION', 3::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 5460::numeric, NULL::numeric, 0.5::numeric, 27.3::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000026'::uuid, 'SIP-RIESGO', 4::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 5460::numeric, NULL::numeric, 1.71::numeric, 93.37::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000026'::uuid, 'SIP-SOLIDARIO', 5::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 5460::numeric, NULL::numeric, 0.5::numeric, 27.3::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000026'::uuid, 'SIP-VEJEZ', 6::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 5460::numeric, NULL::numeric, 10::numeric, 546::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000026'::uuid, 'CNS-SALUD', 7::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 5460::numeric, NULL::numeric, 10::numeric, 546::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000026'::uuid, 'PRO-VIVIENDA', 8::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 5460::numeric, NULL::numeric, 2::numeric, 109.2::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000026'::uuid, 'SIP-RIESGO-PROF', 9::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 5460::numeric, NULL::numeric, 1.71::numeric, 93.37::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000026'::uuid, 'SIP-SOLIDARIO-PAT', 10::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 5460::numeric, NULL::numeric, 3::numeric, 163.8::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000031'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 3200::numeric, 30::numeric, 100::numeric, 3200::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202609000031'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 3200::numeric, 30::numeric, 11::numeric, 352::numeric, '7 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202609000031'::uuid, 'HORAS-EXTRA', 3::smallint, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 13.33::numeric, 3::numeric, 100::numeric, 80::numeric, '3 h a Bs 13,33 la hora'),
  ('c0000000-0000-4000-8000-202609000031'::uuid, 'SIP-COMISION', 4::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 3632::numeric, NULL::numeric, 0.5::numeric, 18.16::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000031'::uuid, 'SIP-RIESGO', 5::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 3632::numeric, NULL::numeric, 1.71::numeric, 62.11::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000031'::uuid, 'SIP-SOLIDARIO', 6::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 3632::numeric, NULL::numeric, 0.5::numeric, 18.16::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000031'::uuid, 'SIP-VEJEZ', 7::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 3632::numeric, NULL::numeric, 10::numeric, 363.2::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000031'::uuid, 'CNS-SALUD', 8::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 3632::numeric, NULL::numeric, 10::numeric, 363.2::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000031'::uuid, 'PRO-VIVIENDA', 9::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 3632::numeric, NULL::numeric, 2::numeric, 72.64::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000031'::uuid, 'SIP-RIESGO-PROF', 10::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 3632::numeric, NULL::numeric, 1.71::numeric, 62.11::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000031'::uuid, 'SIP-SOLIDARIO-PAT', 11::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 3632::numeric, NULL::numeric, 3::numeric, 108.96::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000032'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 3200::numeric, 29::numeric, 100::numeric, 3093.33::numeric, '29 de 30 días'),
  ('c0000000-0000-4000-8000-202609000032'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 3200::numeric, 29::numeric, 11::numeric, 340.27::numeric, '6 años de servicio · 29 de 30 días'),
  ('c0000000-0000-4000-8000-202609000032'::uuid, 'HORAS-EXTRA', 3::smallint, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 13.33::numeric, 2::numeric, 100::numeric, 53.33::numeric, '2 h a Bs 13,33 la hora'),
  ('c0000000-0000-4000-8000-202609000032'::uuid, 'DOMINICAL', 4::smallint, 'INGRESO', 'DOMINICAL', 'Domingos, feriados y descansos trabajados', 'PORCENTAJE', 13.33::numeric, 8::numeric, 100::numeric, 106.67::numeric, '8 h a Bs 13,33 la hora'),
  ('c0000000-0000-4000-8000-202609000032'::uuid, 'SIP-COMISION', 5::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 3593.6::numeric, NULL::numeric, 0.5::numeric, 17.97::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000032'::uuid, 'SIP-RIESGO', 6::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 3593.6::numeric, NULL::numeric, 1.71::numeric, 61.45::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000032'::uuid, 'SIP-SOLIDARIO', 7::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 3593.6::numeric, NULL::numeric, 0.5::numeric, 17.97::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000032'::uuid, 'SIP-VEJEZ', 8::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 3593.6::numeric, NULL::numeric, 10::numeric, 359.36::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000032'::uuid, 'CNS-SALUD', 9::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 3593.6::numeric, NULL::numeric, 10::numeric, 359.36::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000032'::uuid, 'PRO-VIVIENDA', 10::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 3593.6::numeric, NULL::numeric, 2::numeric, 71.87::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000032'::uuid, 'SIP-RIESGO-PROF', 11::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 3593.6::numeric, NULL::numeric, 1.71::numeric, 61.45::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000032'::uuid, 'SIP-SOLIDARIO-PAT', 12::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 3593.6::numeric, NULL::numeric, 3::numeric, 107.81::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000033'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 3200::numeric, 30::numeric, 100::numeric, 3200::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202609000033'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 3200::numeric, 30::numeric, 11::numeric, 352::numeric, '5 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202609000033'::uuid, 'HORAS-EXTRA', 3::smallint, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 13.33::numeric, 1::numeric, 100::numeric, 26.67::numeric, '1 h a Bs 13,33 la hora'),
  ('c0000000-0000-4000-8000-202609000033'::uuid, 'RECARGO-NOCTURNO', 4::smallint, 'INGRESO', 'RECARGO-NOCTURNO', 'Recargo nocturno', 'PORCENTAJE', 13.33::numeric, 4::numeric, 25::numeric, 13.33::numeric, '4 h a Bs 13,33 la hora'),
  ('c0000000-0000-4000-8000-202609000033'::uuid, 'SIP-COMISION', 5::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 3592::numeric, NULL::numeric, 0.5::numeric, 17.96::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000033'::uuid, 'SIP-RIESGO', 6::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 3592::numeric, NULL::numeric, 1.71::numeric, 61.42::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000033'::uuid, 'SIP-SOLIDARIO', 7::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 3592::numeric, NULL::numeric, 0.5::numeric, 17.96::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000033'::uuid, 'SIP-VEJEZ', 8::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 3592::numeric, NULL::numeric, 10::numeric, 359.2::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000033'::uuid, 'CNS-SALUD', 9::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 3592::numeric, NULL::numeric, 10::numeric, 359.2::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000033'::uuid, 'PRO-VIVIENDA', 10::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 3592::numeric, NULL::numeric, 2::numeric, 71.84::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000033'::uuid, 'SIP-RIESGO-PROF', 11::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 3592::numeric, NULL::numeric, 1.71::numeric, 61.42::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000033'::uuid, 'SIP-SOLIDARIO-PAT', 12::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 3592::numeric, NULL::numeric, 3::numeric, 107.76::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000034'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 3400::numeric, 30::numeric, 100::numeric, 3400::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202609000034'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 3400::numeric, 30::numeric, 5::numeric, 170::numeric, '4 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202609000034'::uuid, 'SIP-COMISION', 3::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 3570::numeric, NULL::numeric, 0.5::numeric, 17.85::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000034'::uuid, 'SIP-RIESGO', 4::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 3570::numeric, NULL::numeric, 1.71::numeric, 61.05::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000034'::uuid, 'SIP-SOLIDARIO', 5::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 3570::numeric, NULL::numeric, 0.5::numeric, 17.85::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000034'::uuid, 'SIP-VEJEZ', 6::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 3570::numeric, NULL::numeric, 10::numeric, 357::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000034'::uuid, 'CNS-SALUD', 7::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 3570::numeric, NULL::numeric, 10::numeric, 357::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000034'::uuid, 'PRO-VIVIENDA', 8::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 3570::numeric, NULL::numeric, 2::numeric, 71.4::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000034'::uuid, 'SIP-RIESGO-PROF', 9::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 3570::numeric, NULL::numeric, 1.71::numeric, 61.05::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000034'::uuid, 'SIP-SOLIDARIO-PAT', 10::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 3570::numeric, NULL::numeric, 3::numeric, 107.1::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000035'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 3200::numeric, 30::numeric, 100::numeric, 3200::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202609000035'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 3200::numeric, 30::numeric, 5::numeric, 160::numeric, '3 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202609000035'::uuid, 'HORAS-EXTRA', 3::smallint, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 13.33::numeric, 3::numeric, 100::numeric, 80::numeric, '3 h a Bs 13,33 la hora'),
  ('c0000000-0000-4000-8000-202609000035'::uuid, 'RECARGO-NOCTURNO', 4::smallint, 'INGRESO', 'RECARGO-NOCTURNO', 'Recargo nocturno', 'PORCENTAJE', 13.33::numeric, 2::numeric, 25::numeric, 6.67::numeric, '2 h a Bs 13,33 la hora'),
  ('c0000000-0000-4000-8000-202609000035'::uuid, 'SIP-COMISION', 5::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 3446.67::numeric, NULL::numeric, 0.5::numeric, 17.23::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000035'::uuid, 'SIP-RIESGO', 6::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 3446.67::numeric, NULL::numeric, 1.71::numeric, 58.94::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000035'::uuid, 'SIP-SOLIDARIO', 7::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 3446.67::numeric, NULL::numeric, 0.5::numeric, 17.23::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000035'::uuid, 'SIP-VEJEZ', 8::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 3446.67::numeric, NULL::numeric, 10::numeric, 344.67::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000035'::uuid, 'CNS-SALUD', 9::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 3446.67::numeric, NULL::numeric, 10::numeric, 344.67::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000035'::uuid, 'PRO-VIVIENDA', 10::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 3446.67::numeric, NULL::numeric, 2::numeric, 68.93::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000035'::uuid, 'SIP-RIESGO-PROF', 11::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 3446.67::numeric, NULL::numeric, 1.71::numeric, 58.94::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000035'::uuid, 'SIP-SOLIDARIO-PAT', 12::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 3446.67::numeric, NULL::numeric, 3::numeric, 103.4::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000036'::uuid, 'HABER-BASICO', 1::smallint, 'INGRESO', 'HABER-BASICO', 'Haber básico', 'PORCENTAJE', 3400::numeric, 30::numeric, 100::numeric, 3400::numeric, '30 de 30 días'),
  ('c0000000-0000-4000-8000-202609000036'::uuid, NULL::varchar, 2::smallint, 'INGRESO', 'BONO-ANTIGUEDAD', 'Bono de antigüedad', 'PORCENTAJE', 3400::numeric, 30::numeric, 5::numeric, 170::numeric, '2 años de servicio · 30 de 30 días'),
  ('c0000000-0000-4000-8000-202609000036'::uuid, 'HORAS-EXTRA', 3::smallint, 'INGRESO', 'HORAS-EXTRA', 'Horas extraordinarias', 'PORCENTAJE', 14.17::numeric, 2::numeric, 100::numeric, 56.67::numeric, '2 h a Bs 14,17 la hora'),
  ('c0000000-0000-4000-8000-202609000036'::uuid, 'DOMINICAL', 4::smallint, 'INGRESO', 'DOMINICAL', 'Domingos, feriados y descansos trabajados', 'PORCENTAJE', 14.17::numeric, 8::numeric, 100::numeric, 113.33::numeric, '8 h a Bs 14,17 la hora'),
  ('c0000000-0000-4000-8000-202609000036'::uuid, 'SIP-COMISION', 5::smallint, 'DESCUENTO', 'SIP-COMISION', 'Comisión de administración de pensiones', 'PORCENTAJE', 3740::numeric, NULL::numeric, 0.5::numeric, 18.7::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000036'::uuid, 'SIP-RIESGO', 6::smallint, 'DESCUENTO', 'SIP-RIESGO', 'Aporte laboral por riesgo común', 'PORCENTAJE', 3740::numeric, NULL::numeric, 1.71::numeric, 63.95::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000036'::uuid, 'SIP-SOLIDARIO', 7::smallint, 'DESCUENTO', 'SIP-SOLIDARIO', 'Aporte solidario del asegurado', 'PORCENTAJE', 3740::numeric, NULL::numeric, 0.5::numeric, 18.7::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000036'::uuid, 'SIP-VEJEZ', 8::smallint, 'DESCUENTO', 'SIP-VEJEZ', 'Aporte laboral de vejez', 'PORCENTAJE', 3740::numeric, NULL::numeric, 10::numeric, 374::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000036'::uuid, 'CNS-SALUD', 9::smallint, 'APORTE', 'CNS-SALUD', 'Seguro de salud (Caja Nacional de Salud)', 'PORCENTAJE', 3740::numeric, NULL::numeric, 10::numeric, 374::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000036'::uuid, 'PRO-VIVIENDA', 10::smallint, 'APORTE', 'PRO-VIVIENDA', 'Aporte patronal para vivienda', 'PORCENTAJE', 3740::numeric, NULL::numeric, 2::numeric, 74.8::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000036'::uuid, 'SIP-RIESGO-PROF', 11::smallint, 'APORTE', 'SIP-RIESGO-PROF', 'Aporte patronal por riesgo profesional', 'PORCENTAJE', 3740::numeric, NULL::numeric, 1.71::numeric, 63.95::numeric, NULL::varchar),
  ('c0000000-0000-4000-8000-202609000036'::uuid, 'SIP-SOLIDARIO-PAT', 12::smallint, 'APORTE', 'SIP-SOLIDARIO-PAT', 'Aporte patronal solidario', 'PORCENTAJE', 3740::numeric, NULL::numeric, 3::numeric, 112.2::numeric, NULL::varchar)
) AS r (id_planilla_empleado, codigo_vigencia, orden, tipo, codigo, nombre, forma_calculo, base, cantidad, valor, resultado, detalle)
JOIN PLANILLA_EMPLEADOS pe ON pe.id_planilla_empleado = r.id_planilla_empleado
ON CONFLICT DO NOTHING;

COMMIT;

-- Comprobación: tres planillas cerradas y una aprobada, 12 colaboradores cada una, totales que cuadran con el detalle.
-- SELECT p.periodo, p.estado, COUNT(DISTINCT pe.id_planilla_empleado) AS colaboradores,
--        bool_and(pe.total_ganado = (SELECT SUM(k.resultado) FROM CALCULOS_PLANILLA k
--                                     WHERE k.id_planilla_empleado = pe.id_planilla_empleado AND k.tipo = 'INGRESO')) AS cuadra
-- FROM PLANILLAS p JOIN PLANILLA_EMPLEADOS pe USING (id_planilla) GROUP BY p.periodo, p.estado ORDER BY p.periodo;

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
-- Hay una sola planilla por periodo (uq_planilla_periodo): estos colaboradores se agregan a la planilla que ya
-- exista de cada mes (la de 2026-07 a 2026-09 del bloque de boletas de arriba) y solo se crea la de 2026-10.
-- La de 2026-09 está APROBADA (Pagos aún no confirma), así que todavía no cuenta para el promedio: mientras
-- tanto, cada caso informa que falta la planilla cerrada de 2026-09. Al confirmar Pagos esa planilla (Planilla
-- mensual > Simular confirmación) se cierra y, al recalcular, salen los resultados de la lista de abajo.
-- Primero ejecute el seed de EmployeeService para contar con Fernando Choque Ticona en EmployeeDB:
--   Get-Content -Encoding UTF8 backend/EmployeeService/db/seed.sql | docker exec -i rrhh-postgres psql -U adminRRHH -d EmployeeDB
--
-- Casos cubiertos por colaborador:
--   - Elena Paredes Gómez (...037): salarios variables con horas extra y bono de productividad, 15 días en 2026-10 (julio queda fuera).
--   - Luciano Morales Chávez (...741): bono de antigüedad, dominical y 20 días pagados en 2026-10.
--   - Valeria Nina Quisbert (...742): 3 meses completos (30 días) con horas extra y recargo nocturno, sin observaciones.
--   - Rodrigo Apaza Calle (...743): cambio de haber mensual (4000 -> 4400) y retiro en 2026-11 sin planilla cerrada de 2026-11.
--   - Fernando Choque Ticona (...744): antigüedad menor a tres meses (ingresó 2026-09-01, solo 2 planillas cerradas).
-- Con 2026-09 todavía APROBADA, el promedio usa 2026-07, 2026-08 y 2026-10 (Fernando, solo 2026-10: 1 mes).
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
    'c0000000-0000-4000-8000-000000000771', (SELECT id_planilla FROM PLANILLAS WHERE periodo = '2026-07'), 'f0000000-0000-4000-8000-000000000037', 'Elena Paredes Gómez', '7105069',
    'Cajero', 'Atención al cliente', 'Sopocachi', 'c0000000-0000-4000-8000-000000000791', 'CTR-2019-037', 4500.00,
    DATE '2026-07-01', DATE '2026-07-31', 30, 30,
    0, 0, 0,
    4900.00, 622.79, 4277.21, 818.79
  ),
  (
    'c0000000-0000-4000-8000-000000000772', (SELECT id_planilla FROM PLANILLAS WHERE periodo = '2026-08'), 'f0000000-0000-4000-8000-000000000037', 'Elena Paredes Gómez', '7105069',
    'Cajero', 'Atención al cliente', 'Sopocachi', 'c0000000-0000-4000-8000-000000000791', 'CTR-2019-037', 4500.00,
    DATE '2026-08-01', DATE '2026-08-31', 30, 30,
    600, 0, 0,
    5275.00, 670.46, 4604.54, 881.45
  ),
  (
    'c0000000-0000-4000-8000-000000000773', (SELECT id_planilla FROM PLANILLAS WHERE periodo = '2026-09'), 'f0000000-0000-4000-8000-000000000037', 'Elena Paredes Gómez', '7105069',
    'Cajero', 'Atención al cliente', 'Sopocachi', 'c0000000-0000-4000-8000-000000000791', 'CTR-2019-037', 4500.00,
    DATE '2026-09-01', DATE '2026-09-30', 30, 30,
    0, 0, 0,
    5200.00, 660.92, 4539.08, 868.92
  ),
  (
    'c0000000-0000-4000-8000-000000000774', (SELECT id_planilla FROM PLANILLAS WHERE periodo = '2026-10'), 'f0000000-0000-4000-8000-000000000037', 'Elena Paredes Gómez', '7105069',
    'Cajero', 'Atención al cliente', 'Sopocachi', 'c0000000-0000-4000-8000-000000000791', 'CTR-2019-037', 4500.00,
    DATE '2026-10-01', DATE '2026-10-15', 15, 15,
    0, 0, 0,
    2450.00, 311.40, 2138.60, 409.40
  ),
  (
    'c0000000-0000-4000-8000-000000000775', (SELECT id_planilla FROM PLANILLAS WHERE periodo = '2026-07'), 'f0000000-0000-4000-8000-000000000741', 'Luciano Morales Chávez', '7108741',
    'Cajero', 'Atención al cliente', 'Sopocachi', 'c0000000-0000-4000-8000-000000000792', 'CTR-2022-741', 3800.00,
    DATE '2026-07-01', DATE '2026-07-31', 30, 30,
    0, 0, 0,
    4050.00, 514.76, 3535.24, 676.76
  ),
  (
    'c0000000-0000-4000-8000-000000000776', (SELECT id_planilla FROM PLANILLAS WHERE periodo = '2026-08'), 'f0000000-0000-4000-8000-000000000741', 'Luciano Morales Chávez', '7108741',
    'Cajero', 'Atención al cliente', 'Sopocachi', 'c0000000-0000-4000-8000-000000000792', 'CTR-2022-741', 3800.00,
    DATE '2026-08-01', DATE '2026-08-31', 30, 30,
    0, 600, 0,
    4208.33, 534.87, 3673.46, 703.21
  ),
  (
    'c0000000-0000-4000-8000-000000000777', (SELECT id_planilla FROM PLANILLAS WHERE periodo = '2026-09'), 'f0000000-0000-4000-8000-000000000741', 'Luciano Morales Chávez', '7108741',
    'Cajero', 'Atención al cliente', 'Sopocachi', 'c0000000-0000-4000-8000-000000000792', 'CTR-2022-741', 3800.00,
    DATE '2026-09-01', DATE '2026-09-30', 30, 30,
    0, 0, 0,
    4050.00, 514.76, 3535.24, 676.76
  ),
  (
    'c0000000-0000-4000-8000-000000000778', (SELECT id_planilla FROM PLANILLAS WHERE periodo = '2026-10'), 'f0000000-0000-4000-8000-000000000741', 'Luciano Morales Chávez', '7108741',
    'Cajero', 'Atención al cliente', 'Sopocachi', 'c0000000-0000-4000-8000-000000000792', 'CTR-2022-741', 3800.00,
    DATE '2026-10-01', DATE '2026-10-20', 20, 20,
    0, 0, 0,
    2700.00, 343.17, 2356.83, 451.17
  ),
  (
    'c0000000-0000-4000-8000-000000000779', (SELECT id_planilla FROM PLANILLAS WHERE periodo = '2026-07'), 'f0000000-0000-4000-8000-000000000742', 'Valeria Nina Quisbert', '7108742',
    'Asesor de Atención', 'Atención al cliente', 'Miraflores', 'c0000000-0000-4000-8000-000000000793', 'CTR-2024-742', 3200.00,
    DATE '2026-07-01', DATE '2026-07-31', 30, 30,
    450, 0, 0,
    3400.00, 432.14, 2967.86, 568.14
  ),
  (
    'c0000000-0000-4000-8000-000000000780', (SELECT id_planilla FROM PLANILLAS WHERE periodo = '2026-08'), 'f0000000-0000-4000-8000-000000000742', 'Valeria Nina Quisbert', '7108742',
    'Asesor de Atención', 'Atención al cliente', 'Miraflores', 'c0000000-0000-4000-8000-000000000793', 'CTR-2024-742', 3200.00,
    DATE '2026-08-01', DATE '2026-08-31', 30, 30,
    270, 0, 0,
    3320.00, 421.97, 2898.03, 554.77
  ),
  (
    'c0000000-0000-4000-8000-000000000781', (SELECT id_planilla FROM PLANILLAS WHERE periodo = '2026-09'), 'f0000000-0000-4000-8000-000000000742', 'Valeria Nina Quisbert', '7108742',
    'Asesor de Atención', 'Atención al cliente', 'Miraflores', 'c0000000-0000-4000-8000-000000000793', 'CTR-2024-742', 3200.00,
    DATE '2026-09-01', DATE '2026-09-30', 30, 30,
    0, 0, 0,
    3200.00, 406.72, 2793.28, 534.72
  ),
  (
    'c0000000-0000-4000-8000-000000000782', (SELECT id_planilla FROM PLANILLAS WHERE periodo = '2026-10'), 'f0000000-0000-4000-8000-000000000742', 'Valeria Nina Quisbert', '7108742',
    'Asesor de Atención', 'Atención al cliente', 'Miraflores', 'c0000000-0000-4000-8000-000000000793', 'CTR-2024-742', 3200.00,
    DATE '2026-10-01', DATE '2026-10-31', 30, 30,
    630, 0, 900,
    3530.00, 448.66, 3081.34, 589.86
  ),
  (
    'c0000000-0000-4000-8000-000000000783', (SELECT id_planilla FROM PLANILLAS WHERE periodo = '2026-07'), 'f0000000-0000-4000-8000-000000000743', 'Rodrigo Apaza Calle', '7108743',
    'Cajero', 'Atención al cliente', 'Miraflores', 'c0000000-0000-4000-8000-000000000794', 'CTR-2021-743', 4000.00,
    DATE '2026-07-01', DATE '2026-07-31', 30, 30,
    0, 0, 0,
    4250.00, 540.18, 3709.82, 710.18
  ),
  (
    'c0000000-0000-4000-8000-000000000784', (SELECT id_planilla FROM PLANILLAS WHERE periodo = '2026-08'), 'f0000000-0000-4000-8000-000000000743', 'Rodrigo Apaza Calle', '7108743',
    'Cajero', 'Atención al cliente', 'Miraflores', 'c0000000-0000-4000-8000-000000000794', 'CTR-2021-743', 4000.00,
    DATE '2026-08-01', DATE '2026-08-31', 30, 30,
    0, 0, 0,
    4600.00, 584.66, 4015.34, 768.66
  ),
  (
    'c0000000-0000-4000-8000-000000000785', (SELECT id_planilla FROM PLANILLAS WHERE periodo = '2026-09'), 'f0000000-0000-4000-8000-000000000743', 'Rodrigo Apaza Calle', '7108743',
    'Cajero', 'Atención al cliente', 'Miraflores', 'c0000000-0000-4000-8000-000000000794', 'CTR-2021-743', 4400.00,
    DATE '2026-09-01', DATE '2026-09-30', 30, 30,
    0, 0, 0,
    4650.00, 591.02, 4058.98, 777.02
  ),
  (
    'c0000000-0000-4000-8000-000000000786', (SELECT id_planilla FROM PLANILLAS WHERE periodo = '2026-10'), 'f0000000-0000-4000-8000-000000000743', 'Rodrigo Apaza Calle', '7108743',
    'Cajero', 'Atención al cliente', 'Miraflores', 'c0000000-0000-4000-8000-000000000794', 'CTR-2021-743', 4400.00,
    DATE '2026-10-01', DATE '2026-10-31', 30, 30,
    300, 0, 0,
    4833.33, 614.32, 4219.01, 807.65
  ),
  (
    'c0000000-0000-4000-8000-000000000787', (SELECT id_planilla FROM PLANILLAS WHERE periodo = '2026-09'), 'f0000000-0000-4000-8000-000000000744', 'Fernando Choque Ticona', '7108744',
    'Asesor de Atención', 'Atención al cliente', 'Sopocachi', 'c0000000-0000-4000-8000-000000000795', 'CTR-2026-744', 3000.00,
    DATE '2026-09-01', DATE '2026-09-30', 30, 30,
    0, 0, 0,
    3000.00, 381.30, 2618.70, 501.30
  ),
  (
    'c0000000-0000-4000-8000-000000000788', (SELECT id_planilla FROM PLANILLAS WHERE periodo = '2026-10'), 'f0000000-0000-4000-8000-000000000744', 'Fernando Choque Ticona', '7108744',
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
--     con retiro en 2026-10, el promedio es 3350.00 sin observaciones (una vez cerrada la planilla de 2026-09;
--     antes, 3416.67 con 2026-07, 2026-08 y 2026-10 y la observación de que falta 2026-09).
-- Requiere el bloque anterior (planillas de 2026-07 a 2026-10) y que Gabriela exista en EmployeeDB.
BEGIN;

INSERT INTO PLANILLA_EMPLEADOS (
  id_planilla_empleado, id_planilla, id_empleado, nombre_empleado, numero_documento,
  cargo, area, sucursal, id_contrato, numero_contrato, haber_mensual,
  contrato_desde, contrato_hasta, dias_contrato, dias_pagados,
  minutos_extra_habil, minutos_domingo, minutos_nocturnos,
  total_ganado, total_descuentos, liquido_pagable, total_aportes
) VALUES
  (
    'c0000000-0000-4000-8000-000000000801', (SELECT id_planilla FROM PLANILLAS WHERE periodo = '2026-07'), 'f0000000-0000-4000-8000-000000000745', 'Gabriela Rocha Mendoza', '7108745',
    'Asesor de Atención', 'Atención al cliente', 'Miraflores', 'c0000000-0000-4000-8000-000000000796', 'CTR-2025-745', 3200.00,
    DATE '2026-07-01', DATE '2026-07-31', 30, 30,
    450, 0, 0,
    3400.00, 432.14, 2967.86, 568.14
  ),
  (
    'c0000000-0000-4000-8000-000000000802', (SELECT id_planilla FROM PLANILLAS WHERE periodo = '2026-08'), 'f0000000-0000-4000-8000-000000000745', 'Gabriela Rocha Mendoza', '7108745',
    'Asesor de Atención', 'Atención al cliente', 'Miraflores', 'c0000000-0000-4000-8000-000000000796', 'CTR-2025-745', 3200.00,
    DATE '2026-08-01', DATE '2026-08-31', 30, 30,
    270, 0, 0,
    3320.00, 421.97, 2898.03, 554.77
  ),
  (
    'c0000000-0000-4000-8000-000000000803', (SELECT id_planilla FROM PLANILLAS WHERE periodo = '2026-09'), 'f0000000-0000-4000-8000-000000000745', 'Gabriela Rocha Mendoza', '7108745',
    'Asesor de Atención', 'Atención al cliente', 'Miraflores', 'c0000000-0000-4000-8000-000000000796', 'CTR-2025-745', 3200.00,
    DATE '2026-09-01', DATE '2026-09-30', 30, 30,
    0, 0, 0,
    3200.00, 406.72, 2793.28, 534.72
  ),
  (
    'c0000000-0000-4000-8000-000000000804', (SELECT id_planilla FROM PLANILLAS WHERE periodo = '2026-10'), 'f0000000-0000-4000-8000-000000000745', 'Gabriela Rocha Mendoza', '7108745',
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

-- Procesos por desahucio con 1 año exacto, 91 y 90 días de servicio (RF-56, KAN-76). Las líneas de planilla se
-- enlazan por periodo para usar la planilla que exista de agosto a octubre de 2026.
BEGIN;

INSERT INTO PROCESOS_DESVINCULACION (
  id_proceso, id_empleado, nombre_empleado, fecha_ingreso, codigo_causal,
  fecha_retiro, corresponde_desahucio, observaciones, estado, registrado_por, registrado_por_rol
) VALUES
  (
    'c0000000-0000-4000-8000-000000000a41',
    'f0000000-0000-4000-8000-000000000a61',
    'Sofía Mamani Lima',
    '2025-11-01',
    'DESAHUCIO',
    '2026-10-31',
    TRUE,
    'Preaviso de desahucio entregado tras un año de servicio.',
    'INICIADO',
    'f0000000-0000-4000-8000-000000000023',
    'admin'
  ),
  (
    'c0000000-0000-4000-8000-000000000a42',
    'f0000000-0000-4000-8000-000000000a62',
    'Marco Condori Flores',
    '2026-08-02',
    'DESAHUCIO',
    '2026-10-31',
    TRUE,
    'Desahucio comunicado al concluir el tercer mes de servicio.',
    'INICIADO',
    'f0000000-0000-4000-8000-000000000023',
    'admin'
  ),
  (
    'c0000000-0000-4000-8000-000000000a43',
    'f0000000-0000-4000-8000-000000000a63',
    'Lucía Vargas Ríos',
    '2026-08-03',
    'DESAHUCIO',
    '2026-10-31',
    TRUE,
    'Desahucio comunicado dentro del período de prueba.',
    'INICIADO',
    'f0000000-0000-4000-8000-000000000023',
    'admin'
  )
ON CONFLICT DO NOTHING;

INSERT INTO DOCUMENTOS_DESVINCULACION (
  id_proceso, nombre_archivo, tipo_mime, tamano_bytes, contenido
) VALUES
  (
    'c0000000-0000-4000-8000-000000000a41',
    'desahucio-sofia-mamani.pdf',
    'application/pdf',
    octet_length(convert_to(E'%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'UTF8')),
    convert_to(E'%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'UTF8')
  ),
  (
    'c0000000-0000-4000-8000-000000000a42',
    'desahucio-marco-condori.pdf',
    'application/pdf',
    octet_length(convert_to(E'%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'UTF8')),
    convert_to(E'%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'UTF8')
  ),
  (
    'c0000000-0000-4000-8000-000000000a43',
    'desahucio-lucia-vargas.pdf',
    'application/pdf',
    octet_length(convert_to(E'%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'UTF8')),
    convert_to(E'%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'UTF8')
  )
ON CONFLICT DO NOTHING;

INSERT INTO PLANILLA_EMPLEADOS (
  id_planilla_empleado, id_planilla, id_empleado, nombre_empleado, numero_documento,
  cargo, area, sucursal, id_contrato, numero_contrato, haber_mensual,
  contrato_desde, contrato_hasta, dias_contrato, dias_pagados,
  minutos_extra_habil, minutos_domingo, minutos_nocturnos,
  total_ganado, total_descuentos, liquido_pagable, total_aportes
)
SELECT v.id_planilla_empleado::uuid, p.id_planilla, v.id_empleado::uuid, v.nombre_empleado, v.numero_documento,
       v.cargo, v.area, v.sucursal, v.id_contrato::uuid, v.numero_contrato, v.haber_mensual,
       v.contrato_desde, v.contrato_hasta, v.dias, v.dias,
       0, 0, 0,
       v.total_ganado, v.total_descuentos, v.liquido_pagable, v.total_aportes
  FROM (VALUES
    ('c0000000-0000-4000-8000-000000000a81', '2026-08', 'f0000000-0000-4000-8000-000000000a61', 'Sofía Mamani Lima', '7108761', 'Cajero', 'Atención al cliente', 'Sopocachi', 'c0000000-0000-4000-8000-000000000a91', 'CTR-2025-761', 3800.00, DATE '2026-08-01', DATE '2026-08-31', 30, 30, 3800.00, 482.98, 3317.02, 634.98),
    ('c0000000-0000-4000-8000-000000000a82', '2026-09', 'f0000000-0000-4000-8000-000000000a61', 'Sofía Mamani Lima', '7108761', 'Cajero', 'Atención al cliente', 'Sopocachi', 'c0000000-0000-4000-8000-000000000a91', 'CTR-2025-761', 3800.00, DATE '2026-09-01', DATE '2026-09-30', 30, 30, 3800.00, 482.98, 3317.02, 634.98),
    ('c0000000-0000-4000-8000-000000000a83', '2026-10', 'f0000000-0000-4000-8000-000000000a61', 'Sofía Mamani Lima', '7108761', 'Cajero', 'Atención al cliente', 'Sopocachi', 'c0000000-0000-4000-8000-000000000a91', 'CTR-2025-761', 3800.00, DATE '2026-10-01', DATE '2026-10-31', 30, 30, 3800.00, 482.98, 3317.02, 634.98),
    ('c0000000-0000-4000-8000-000000000a84', '2026-08', 'f0000000-0000-4000-8000-000000000a62', 'Marco Condori Flores', '7108762', 'Asesor de Atención', 'Atención al cliente', 'Miraflores', 'c0000000-0000-4000-8000-000000000a92', 'CTR-2026-762', 3300.00, DATE '2026-08-02', DATE '2026-08-31', 29, 29, 3190.00, 405.45, 2784.55, 533.05),
    ('c0000000-0000-4000-8000-000000000a85', '2026-09', 'f0000000-0000-4000-8000-000000000a62', 'Marco Condori Flores', '7108762', 'Asesor de Atención', 'Atención al cliente', 'Miraflores', 'c0000000-0000-4000-8000-000000000a92', 'CTR-2026-762', 3300.00, DATE '2026-09-01', DATE '2026-09-30', 30, 30, 3300.00, 419.43, 2880.57, 551.43),
    ('c0000000-0000-4000-8000-000000000a86', '2026-10', 'f0000000-0000-4000-8000-000000000a62', 'Marco Condori Flores', '7108762', 'Asesor de Atención', 'Atención al cliente', 'Miraflores', 'c0000000-0000-4000-8000-000000000a92', 'CTR-2026-762', 3300.00, DATE '2026-10-01', DATE '2026-10-31', 30, 30, 3300.00, 419.43, 2880.57, 551.43),
    ('c0000000-0000-4000-8000-000000000a87', '2026-08', 'f0000000-0000-4000-8000-000000000a63', 'Lucía Vargas Ríos', '7108763', 'Asesor de Atención', 'Atención al cliente', 'Miraflores', 'c0000000-0000-4000-8000-000000000a93', 'CTR-2026-763', 3300.00, DATE '2026-08-03', DATE '2026-08-31', 28, 28, 3080.00, 391.47, 2688.53, 514.67),
    ('c0000000-0000-4000-8000-000000000a88', '2026-09', 'f0000000-0000-4000-8000-000000000a63', 'Lucía Vargas Ríos', '7108763', 'Asesor de Atención', 'Atención al cliente', 'Miraflores', 'c0000000-0000-4000-8000-000000000a93', 'CTR-2026-763', 3300.00, DATE '2026-09-01', DATE '2026-09-30', 30, 30, 3300.00, 419.43, 2880.57, 551.43),
    ('c0000000-0000-4000-8000-000000000a89', '2026-10', 'f0000000-0000-4000-8000-000000000a63', 'Lucía Vargas Ríos', '7108763', 'Asesor de Atención', 'Atención al cliente', 'Miraflores', 'c0000000-0000-4000-8000-000000000a93', 'CTR-2026-763', 3300.00, DATE '2026-10-01', DATE '2026-10-31', 30, 30, 3300.00, 419.43, 2880.57, 551.43)
  ) AS v (
    id_planilla_empleado, periodo, id_empleado, nombre_empleado, numero_documento,
    cargo, area, sucursal, id_contrato, numero_contrato, haber_mensual,
    contrato_desde, contrato_hasta, dias, dias_pagados,
    total_ganado, total_descuentos, liquido_pagable, total_aportes
  )
  JOIN PLANILLAS p ON p.periodo = v.periodo
ON CONFLICT DO NOTHING;

COMMIT;

-- Planilla tributaria y de aportes de ejemplo (RF-48, KAN-68): entidades con su formato de archivo, parametros
-- tributarios con vigencias (el salario minimo cambio el 1 de mayo de 2025), valores de la UFV, creditos fiscales declarados
-- y dos planillas mensuales CERRADAS (2026-04 y 2026-05) de 10 colaboradores, calculadas con las tasas vigentes del catalogo.
--   Con salario minimo 2.750 el minimo no imponible es 5.500 y el computo del 13 % de 2 salarios minimos es 715: en la
--   practica solo retiene quien tiene un sueldo neto mayor a 11.000.
--   22 Jorge: en mayo cobra un bono de productividad de 6.500 (total ganado 15.000, con el Aporte Nacional Solidario sobre
--      el excedente de 13.000). Declara facturas de Bs 1.000: el credito reduce su retencion pero no la cubre.
--   21 Marcela: trae un saldo a favor inicial de 80 del sistema anterior y declara facturas en abril y mayo. No tiene
--      impuesto despues del computo, asi que todo su credito pasa como saldo a favor al mes siguiente.
--   23 Andrea: declara Bs 4.000 en abril y 3.000 en mayo. El saldo de abril pasa solo a mayo, actualizado con la UFV,
--      si se genera primero la planilla tributaria de abril.
-- Los valores de la UFV son de ejemplo: reemplacelos con los que publica el Banco Central de Bolivia.
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
INSERT INTO VALORES_UFV (fecha, valor) VALUES
  ('2026-03-31', 2.71250),
  ('2026-04-30', 2.71840),
  ('2026-05-31', 2.72460),
  ('2026-06-30', 2.73010),
  ('2026-07-31', 2.73590),
  ('2026-08-31', 2.74120),
  ('2026-09-30', 2.74700),
  ('2026-10-31', 2.75260)
ON CONFLICT DO NOTHING;
INSERT INTO CREDITOS_FISCALES_DECLARADOS (id_empleado, periodo, monto_facturas, saldo_inicial_favor) VALUES
  ('f0000000-0000-4000-8000-000000000021', '2026-04', 1200.00, 80.00),
  ('f0000000-0000-4000-8000-000000000021', '2026-05', 1500.00, 0),
  ('f0000000-0000-4000-8000-000000000022', '2026-05', 1000.00, 0),
  ('f0000000-0000-4000-8000-000000000023', '2026-04', 4000.00, 0),
  ('f0000000-0000-4000-8000-000000000023', '2026-05', 3000.00, 0),
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
  v_bono numeric(12,2);
  v_total numeric(12,2);
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

      v_bono := CASE WHEN p = '2026-05' AND emp.id_empleado = 'f0000000-0000-4000-8000-000000000022' THEN 6500.00 ELSE 0 END;
      v_total := emp.haber + v_bono;

      INSERT INTO calculos_planilla (id_planilla_empleado, id_vigencia, orden, tipo, codigo, nombre, forma_calculo, base, cantidad, valor, resultado)
      SELECT v_pe, vg.id_vigencia, 1, 'INGRESO', co.codigo, co.nombre, 'PORCENTAJE', emp.haber, 30, vg.valor, emp.haber
      FROM conceptos_planilla co
      JOIN vigencias_concepto vg ON vg.id_concepto = co.id_concepto
        AND v_fin BETWEEN vg.vigente_desde AND COALESCE(vg.vigente_hasta, 'infinity'::date)
      WHERE co.codigo = 'HABER-BASICO';

      v_orden := 1;
      IF v_bono > 0 THEN
        v_orden := v_orden + 1;
        INSERT INTO calculos_planilla (id_planilla_empleado, id_vigencia, orden, tipo, codigo, nombre, forma_calculo, base, cantidad, valor, resultado)
        SELECT v_pe, NULL, v_orden, 'INGRESO', co.codigo, co.nombre, 'MONTO_FIJO', NULL, NULL, v_bono, v_bono
        FROM conceptos_planilla co WHERE co.codigo = 'BONO-PRODUCTIVIDAD';
      END IF;
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
        VALUES (v_pe, c.id_vigencia, v_orden, c.tipo, c.codigo, c.nombre, 'PORCENTAJE', v_total, NULL, c.valor, round(v_total * c.valor / 100, 2));
      END LOOP;

      FOR c IN
        SELECT co.codigo, co.nombre, vg.id_vigencia, vg.valor, substr(co.codigo, 5)::numeric AS umbral
        FROM conceptos_planilla co
        JOIN vigencias_concepto vg ON vg.id_concepto = co.id_concepto
          AND v_fin BETWEEN vg.vigente_desde AND COALESCE(vg.vigente_hasta, 'infinity'::date)
        WHERE co.codigo LIKE 'ANS-%' AND co.esta_activo
        ORDER BY co.codigo
      LOOP
        CONTINUE WHEN v_total <= c.umbral;
        v_orden := v_orden + 1;
        INSERT INTO calculos_planilla (id_planilla_empleado, id_vigencia, orden, tipo, codigo, nombre, forma_calculo, base, cantidad, valor, resultado)
        VALUES (v_pe, c.id_vigencia, v_orden, 'DESCUENTO', c.codigo, c.nombre, 'PORCENTAJE', v_total - c.umbral, NULL, c.valor,
                round((v_total - c.umbral) * c.valor / 100, 2));
      END LOOP;

      SELECT COALESCE(sum(resultado) FILTER (WHERE tipo = 'DESCUENTO'), 0), COALESCE(sum(resultado) FILTER (WHERE tipo = 'APORTE'), 0)
        INTO v_descuentos, v_aportes
      FROM calculos_planilla WHERE id_planilla_empleado = v_pe;
      UPDATE planilla_empleados
      SET total_ganado = v_total, total_descuentos = v_descuentos, liquido_pagable = v_total - v_descuentos, total_aportes = v_aportes
      WHERE id_planilla_empleado = v_pe;
    END LOOP;
  END LOOP;
END $$;
COMMIT;

-- Datos de ejemplo de finiquitos (RF-58, KAN-78):
--   1. Listos para emitir el finiquito: Valeria Nina Quisbert (...0743) y Rodrigo Apaza Calle (...0744)
--      con promedio indemnizable, beneficios sociales y saldos proporcionales al día entre sí, más un
--      anticipo ACTIVO (...0b01) de Rodrigo por Bs 800,00 para demostrar el descuento y su saldo al pagarse.
--   2. Finiquito PAGADO con cadena completa: Elena Paredes Gómez (...0741, FIN-2026-000001), integraciones
--      CONFIRMADA, eventos SALIENTE y RESPUESTA_SIMULADA ENTREGADO, mensajes PROCESADO y proceso CERRADO
--      (sin PDF guardado; se genera al descargarse por primera vez).
--   3. Finiquito APROBADO con Contabilidad RECHAZADA: Luciano Morales Chávez (...0742, FIN-2026-000002),
--      Pagos CONFIRMADA y Contabilidad rechazada por cuenta inexistente, listo para probar "Reenviar".
--   4. Mensajes simulados en bandeja de entrada: un mensaje EN_DLQ sin id_finiquito (3 intentos fallidos)
--      y un mensaje IGNORADO como respuesta tardía a un envío previo de Luciano.
BEGIN;

UPDATE PROCESOS_DESVINCULACION
   SET estado = 'EN_CURSO', actualizado_en = CURRENT_TIMESTAMP
 WHERE id_proceso IN (
   'c0000000-0000-4000-8000-000000000742',
   'c0000000-0000-4000-8000-000000000743',
   'c0000000-0000-4000-8000-000000000744'
 )
   AND estado = 'INICIADO';

UPDATE PROCESOS_DESVINCULACION
   SET estado = 'CERRADO', actualizado_en = CURRENT_TIMESTAMP
 WHERE id_proceso = 'c0000000-0000-4000-8000-000000000741'
   AND estado <> 'CERRADO';

INSERT INTO PRESTAMOS (
  id_prestamo, id_empleado, tipo, monto, numero_cuotas, mes_inicio, motivo,
  liquido_pagable_referencial, porcentaje_cuota, saldo_pendiente, estado,
  registrado_por, creado_en, actualizado_en
) VALUES (
  'c0000000-0000-4000-8000-000000000b01',
  'f0000000-0000-4000-8000-000000000743',
  'ANTICIPO',
  800.00,
  1,
  DATE '2026-11-01',
  'Anticipo de sueldo para gastos médicos',
  4219.01,
  18.96,
  800.00,
  'ACTIVO',
  'Andrea Salazar Vega',
  TIMESTAMPTZ '2026-11-02T10:00:00-04:00',
  TIMESTAMPTZ '2026-11-02T10:00:00-04:00'
)
ON CONFLICT DO NOTHING;

INSERT INTO CUOTAS_PRESTAMO (
  id_cuota, id_prestamo, numero_cuota, periodo, monto, estado, pagada_en
) VALUES (
  'c0000000-0000-4000-8000-000000000b02',
  'c0000000-0000-4000-8000-000000000b01',
  1,
  DATE '2026-11-01',
  800.00,
  'PENDIENTE',
  NULL
)
ON CONFLICT DO NOTHING;

INSERT INTO PROMEDIOS_INDEMNIZABLES (
  id_proceso, periodo_limite, meses_considerados, total_considerado, promedio,
  observaciones, calculado_por, calculado_por_rol, calculado_en
) VALUES
  (
    'c0000000-0000-4000-8000-000000000741', '2026-10', 3, 12925.00, 4308.33,
    ARRAY['En 2026-10 se pagaron 15 de 30 días.'],
    'f0000000-0000-4000-8000-000000000023', 'admin', TIMESTAMPTZ '2026-10-18T10:30:00-04:00'
  ),
  (
    'c0000000-0000-4000-8000-000000000742', '2026-10', 3, 10958.33, 3652.78,
    ARRAY['En 2026-10 se pagaron 20 de 30 días.'],
    'f0000000-0000-4000-8000-000000000023', 'admin', TIMESTAMPTZ '2026-10-22T09:30:00-04:00'
  ),
  (
    'c0000000-0000-4000-8000-000000000743', '2026-10', 3, 10050.00, 3350.00,
    '{}'::text[],
    'f0000000-0000-4000-8000-000000000023', 'admin', TIMESTAMPTZ '2026-11-05T09:30:00-04:00'
  ),
  (
    'c0000000-0000-4000-8000-000000000744', '2026-11', 3, 14083.33, 4694.44,
    ARRAY['No hay una planilla cerrada de 2026-11 (mes del retiro): si se cierra después, recalcule el promedio.'],
    'f0000000-0000-4000-8000-000000000023', 'admin', TIMESTAMPTZ '2026-11-12T09:30:00-04:00'
  )
ON CONFLICT DO NOTHING;

INSERT INTO DETALLE_PROMEDIO_INDEMNIZABLE (
  id_proceso, periodo, id_planilla, id_planilla_empleado, dias_pagados, haber_mensual, total_ganado
) VALUES
  ('c0000000-0000-4000-8000-000000000741', '2026-08', 'c0000000-0000-4000-8000-000000000762', 'c0000000-0000-4000-8000-000000000772', 30, 4500.00, 5275.00),
  ('c0000000-0000-4000-8000-000000000741', '2026-09', 'c0000000-0000-4000-8000-000000000763', 'c0000000-0000-4000-8000-000000000773', 30, 4500.00, 5200.00),
  ('c0000000-0000-4000-8000-000000000741', '2026-10', 'c0000000-0000-4000-8000-000000000764', 'c0000000-0000-4000-8000-000000000774', 15, 4500.00, 2450.00),
  ('c0000000-0000-4000-8000-000000000742', '2026-08', 'c0000000-0000-4000-8000-000000000762', 'c0000000-0000-4000-8000-000000000776', 30, 3800.00, 4208.33),
  ('c0000000-0000-4000-8000-000000000742', '2026-09', 'c0000000-0000-4000-8000-000000000763', 'c0000000-0000-4000-8000-000000000777', 30, 3800.00, 4050.00),
  ('c0000000-0000-4000-8000-000000000742', '2026-10', 'c0000000-0000-4000-8000-000000000764', 'c0000000-0000-4000-8000-000000000778', 20, 3800.00, 2700.00),
  ('c0000000-0000-4000-8000-000000000743', '2026-08', 'c0000000-0000-4000-8000-000000000762', 'c0000000-0000-4000-8000-000000000780', 30, 3200.00, 3320.00),
  ('c0000000-0000-4000-8000-000000000743', '2026-09', 'c0000000-0000-4000-8000-000000000763', 'c0000000-0000-4000-8000-000000000781', 30, 3200.00, 3200.00),
  ('c0000000-0000-4000-8000-000000000743', '2026-10', 'c0000000-0000-4000-8000-000000000764', 'c0000000-0000-4000-8000-000000000782', 30, 3200.00, 3530.00),
  ('c0000000-0000-4000-8000-000000000744', '2026-08', 'c0000000-0000-4000-8000-000000000762', 'c0000000-0000-4000-8000-000000000784', 30, 4000.00, 4600.00),
  ('c0000000-0000-4000-8000-000000000744', '2026-09', 'c0000000-0000-4000-8000-000000000763', 'c0000000-0000-4000-8000-000000000785', 30, 4400.00, 4650.00),
  ('c0000000-0000-4000-8000-000000000744', '2026-10', 'c0000000-0000-4000-8000-000000000764', 'c0000000-0000-4000-8000-000000000786', 30, 4400.00, 4833.33)
ON CONFLICT DO NOTHING;

INSERT INTO BENEFICIOS_SOCIALES (
  id_proceso, promedio_base, fecha_ingreso, fecha_retiro, dias_servicio,
  anios_servicio, meses_servicio, dias_fraccion,
  corresponde_indemnizacion, motivo_indemnizacion, monto_indemnizacion,
  corresponde_desahucio, motivo_desahucio, monto_desahucio, total,
  calculado_por, calculado_por_rol, calculado_en
) VALUES
  (
    'c0000000-0000-4000-8000-000000000741', 4308.33, DATE '2019-03-01', DATE '2026-10-15', 2786,
    7, 7, 15,
    FALSE, 'Despido por causa justificada: no corresponde indemnización (LGT, art. 16).', 0.00,
    FALSE, 'Despido por causa justificada: no corresponde desahucio (LGT, art. 16).', 0.00, 0.00,
    'f0000000-0000-4000-8000-000000000023', 'admin', TIMESTAMPTZ '2026-10-18T10:35:00-04:00'
  ),
  (
    'c0000000-0000-4000-8000-000000000742', 3652.78, DATE '2022-05-01', DATE '2026-10-20', 1634,
    4, 5, 20,
    TRUE, 'Renuncia voluntaria con más de 90 días de antigüedad (DS 110, art. 1).', 16336.04,
    FALSE, 'Renuncia voluntaria: no corresponde desahucio.', 0.00, 16336.04,
    'f0000000-0000-4000-8000-000000000023', 'admin', TIMESTAMPTZ '2026-10-22T09:35:00-04:00'
  ),
  (
    'c0000000-0000-4000-8000-000000000743', 3350.00, DATE '2024-02-01', DATE '2026-10-31', 1004,
    2, 9, 0,
    TRUE, 'Conclusión de contrato con más de 90 días de antigüedad (DS 110, art. 1).', 9212.50,
    FALSE, 'Conclusión de contrato: no corresponde desahucio.', 0.00, 9212.50,
    'f0000000-0000-4000-8000-000000000023', 'admin', TIMESTAMPTZ '2026-11-05T09:35:00-04:00'
  ),
  (
    'c0000000-0000-4000-8000-000000000744', 4694.44, DATE '2021-08-01', DATE '2026-11-10', 1928,
    5, 3, 10,
    TRUE, 'Desahucio con más de 90 días de antigüedad (DS 110, art. 1).', 24776.21,
    TRUE, 'Desahucio sin preaviso de 90 días (LGT, art. 12).', 14083.32, 38859.53,
    'f0000000-0000-4000-8000-000000000023', 'admin', TIMESTAMPTZ '2026-11-12T09:35:00-04:00'
  )
ON CONFLICT DO NOTHING;

INSERT INTO DETALLE_BENEFICIOS_SOCIALES (
  id_proceso, orden, codigo_concepto, descripcion, unidad, cantidad, divisor, monto
) VALUES
  ('c0000000-0000-4000-8000-000000000742', 1, 'INDEMNIZACION', 'Años de servicio', 'ANIO', 4, 1, 14611.12),
  ('c0000000-0000-4000-8000-000000000742', 2, 'INDEMNIZACION', 'Meses de servicio (duodécimas)', 'MES', 5, 12, 1521.99),
  ('c0000000-0000-4000-8000-000000000742', 3, 'INDEMNIZACION', 'Días de servicio', 'DIA', 20, 360, 202.93),
  ('c0000000-0000-4000-8000-000000000743', 1, 'INDEMNIZACION', 'Años de servicio', 'ANIO', 2, 1, 6700.00),
  ('c0000000-0000-4000-8000-000000000743', 2, 'INDEMNIZACION', 'Meses de servicio (duodécimas)', 'MES', 9, 12, 2512.50),
  ('c0000000-0000-4000-8000-000000000744', 1, 'INDEMNIZACION', 'Años de servicio', 'ANIO', 5, 1, 23472.20),
  ('c0000000-0000-4000-8000-000000000744', 2, 'INDEMNIZACION', 'Meses de servicio (duodécimas)', 'MES', 3, 12, 1173.61),
  ('c0000000-0000-4000-8000-000000000744', 3, 'INDEMNIZACION', 'Días de servicio', 'DIA', 10, 360, 130.40),
  ('c0000000-0000-4000-8000-000000000744', 4, 'DESAHUCIO', 'Desahucio (tres sueldos promedio)', 'SUELDO', 3, 1, 14083.32)
ON CONFLICT DO NOTHING;

INSERT INTO SALDOS_PROPORCIONALES (
  id_proceso, promedio, salario_diario, gestion_aguinaldo, aguinaldo_desde, aguinaldo_hasta,
  aguinaldo_meses, aguinaldo_dias, monto_aguinaldo, anios_servicio, dias_acumulados,
  dias_gozados, dias_pendientes, monto_vacaciones_pendientes, anio_en_curso_desde,
  anio_en_curso_meses, anio_en_curso_dias, dias_escala, dias_duodecima,
  monto_duodecima_vacaciones, total, observaciones, calculado_por, calculado_en
) VALUES
  (
    'c0000000-0000-4000-8000-000000000741', 4308.33, 143.61, 2026, DATE '2025-12-01', DATE '2026-10-15',
    10, 15, 3769.79, 7, 115, 0, 115, 16515.27, DATE '2026-03-01',
    7, 15, 20, 12.50, 1795.14, 22080.20, '{}'::text[],
    'f0000000-0000-4000-8000-000000000023', TIMESTAMPTZ '2026-10-18T10:40:00-04:00'
  ),
  (
    'c0000000-0000-4000-8000-000000000742', 3652.78, 121.76, 2026, DATE '2025-12-01', DATE '2026-10-20',
    10, 20, 3246.92, 4, 60, 0, 60, 7305.56, DATE '2026-05-01',
    5, 20, 15, 7.08, 862.46, 11414.94, '{}'::text[],
    'f0000000-0000-4000-8000-000000000023', TIMESTAMPTZ '2026-10-22T09:40:00-04:00'
  ),
  (
    'c0000000-0000-4000-8000-000000000743', 3350.00, 111.67, 2026, DATE '2025-12-01', DATE '2026-10-31',
    11, 0, 3070.83, 2, 30, 0, 30, 3350.00, DATE '2026-02-01',
    9, 0, 15, 11.25, 1256.25, 7677.08, '{}'::text[],
    'f0000000-0000-4000-8000-000000000023', TIMESTAMPTZ '2026-11-05T09:40:00-04:00'
  ),
  (
    'c0000000-0000-4000-8000-000000000744', 4694.44, 156.48, 2026, DATE '2025-12-01', DATE '2026-11-10',
    11, 10, 4433.64, 5, 75, 0, 75, 11736.10, DATE '2026-08-01',
    3, 10, 20, 5.56, 869.34, 17039.08, '{}'::text[],
    'f0000000-0000-4000-8000-000000000023', TIMESTAMPTZ '2026-11-12T09:40:00-04:00'
  )
ON CONFLICT DO NOTHING;

INSERT INTO FINIQUITOS (
  id_finiquito, id_proceso, numero_documento, estado, fecha_retiro, codigo_causal,
  promedio_base, anios_servicio, meses_servicio, dias_fraccion,
  total_ingresos, total_descuentos, liquido_pagable,
  estado_pagos, referencia_pagos, motivo_pagos, respondida_pagos_en,
  estado_contabilidad, referencia_contabilidad, motivo_contabilidad, respondida_contabilidad_en,
  generado_por, generado_en, aprobado_por, aprobado_por_rol, aprobado_en, pagado_en
) VALUES
  (
    'c0000000-0000-4000-8000-000000000b11',
    'c0000000-0000-4000-8000-000000000741',
    'FIN-2026-000001',
    'PAGADO',
    DATE '2026-10-15',
    'DESPIDO_LEGAL',
    4308.33, 7, 7, 15,
    22080.20, 0.00, 22080.20,
    'CONFIRMADA', 'OP-FIN-2026-000001', NULL, TIMESTAMPTZ '2026-10-18T11:00:10-04:00',
    'CONFIRMADA', 'AS-FIN-2026-000001', NULL, TIMESTAMPTZ '2026-10-18T11:00:15-04:00',
    'f0000000-0000-4000-8000-000000000023', TIMESTAMPTZ '2026-10-18T10:50:00-04:00',
    'f0000000-0000-4000-8000-000000000023', 'admin', TIMESTAMPTZ '2026-10-18T11:00:00-04:00',
    TIMESTAMPTZ '2026-10-18T11:00:15-04:00'
  ),
  (
    'c0000000-0000-4000-8000-000000000b51',
    'c0000000-0000-4000-8000-000000000742',
    'FIN-2026-000002',
    'APROBADO',
    DATE '2026-10-20',
    'RENUNCIA',
    3652.78, 4, 5, 20,
    27750.98, 0.00, 27750.98,
    'CONFIRMADA', 'OP-FIN-2026-000002', NULL, TIMESTAMPTZ '2026-10-22T10:00:10-04:00',
    'RECHAZADA', NULL, 'La cuenta 2.1.5.03 no existe en el plan de cuentas', TIMESTAMPTZ '2026-10-22T10:05:12-04:00',
    'f0000000-0000-4000-8000-000000000023', TIMESTAMPTZ '2026-10-22T09:50:00-04:00',
    'f0000000-0000-4000-8000-000000000023', 'admin', TIMESTAMPTZ '2026-10-22T10:00:00-04:00',
    NULL
  )
ON CONFLICT DO NOTHING;

INSERT INTO DETALLE_FINIQUITO (
  id_finiquito, orden, tipo, codigo, concepto, detalle, monto, id_prestamo, saldo_prestamo
) VALUES
  ('c0000000-0000-4000-8000-000000000b11', 1, 'INGRESO', 'AGUINALDO_DUODECIMAS', 'Aguinaldo (duodécimas)', 'Gestión 2026: 10 meses y 15 días', 3769.79, NULL, NULL),
  ('c0000000-0000-4000-8000-000000000b11', 2, 'INGRESO', 'VACACIONES_PENDIENTES', 'Vacaciones no gozadas', '115 días pendientes', 16515.27, NULL, NULL),
  ('c0000000-0000-4000-8000-000000000b11', 3, 'INGRESO', 'VACACIONES_DUODECIMAS', 'Vacaciones (duodécimas del año en curso)', '7 meses y 15 días', 1795.14, NULL, NULL),
  ('c0000000-0000-4000-8000-000000000b51', 1, 'INGRESO', 'INDEMNIZACION', 'Indemnización por tiempo de servicio', '4 años, 5 meses y 20 días', 16336.04, NULL, NULL),
  ('c0000000-0000-4000-8000-000000000b51', 2, 'INGRESO', 'AGUINALDO_DUODECIMAS', 'Aguinaldo (duodécimas)', 'Gestión 2026: 10 meses y 20 días', 3246.92, NULL, NULL),
  ('c0000000-0000-4000-8000-000000000b51', 3, 'INGRESO', 'VACACIONES_PENDIENTES', 'Vacaciones no gozadas', '60 días pendientes', 7305.56, NULL, NULL),
  ('c0000000-0000-4000-8000-000000000b51', 4, 'INGRESO', 'VACACIONES_DUODECIMAS', 'Vacaciones (duodécimas del año en curso)', '5 meses y 20 días', 862.46, NULL, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO EVENTOS_FINIQUITO (
  id_evento, id_mensaje, id_finiquito, sentido, destino, tipo_evento, topico, carga,
  estado, intentos, ultimo_error, proximo_intento_en, id_pubsub, entregado_en, creado_en
) VALUES
  (
    'c0000000-0000-4000-8000-000000000b21',
    'c0000000-0000-4000-8000-000000000b31',
    'c0000000-0000-4000-8000-000000000b11',
    'SALIENTE', 'PAGOS', 'FINIQUITO_APROBADO_ORDEN_PAGO', 'ucb-sis323-sub-f',
    '{
      "encabezado":{"id_mensaje":"c0000000-0000-4000-8000-000000000b31","origen":{"grupo":"F","modulo":"RRHH"},"destino":{"grupo":"A","modulo":"Pagos y Facturación"},"tipo":"FINIQUITO_APROBADO_ORDEN_PAGO","fecha":"2026-10-18T15:00:00.000Z","version_esquema":1},
      "datos":{"id_finiquito":"c0000000-0000-4000-8000-000000000b11","numero_documento":"FIN-2026-000001","id_proceso":"c0000000-0000-4000-8000-000000000741","prioridad":"URGENTE","moneda":"BOB","colaborador":{"id_empleado":"f0000000-0000-4000-8000-000000000037","nombre_completo":"Elena Paredes Gómez"},"fecha_retiro":"2026-10-15","causal":{"codigo":"DESPIDO_LEGAL","nombre":"Despido legal (causa justificada)"},"conceptos":[{"codigo":"AGUINALDO_DUODECIMAS","concepto":"Aguinaldo (duodécimas)","monto":3769.79},{"codigo":"VACACIONES_PENDIENTES","concepto":"Vacaciones no gozadas","monto":16515.27},{"codigo":"VACACIONES_DUODECIMAS","concepto":"Vacaciones (duodécimas del año en curso)","monto":1795.14}],"descuentos":[],"total_ingresos":22080.2,"total_descuentos":0,"liquido_pagable":22080.2,"aprobado":{"por":{"id_empleado":"f0000000-0000-4000-8000-000000000023","nombre_completo":"Andrea Salazar Vega"},"en":"2026-10-18T15:00:00.000Z"}}
    }'::jsonb,
    'ENTREGADO', 1, NULL, TIMESTAMPTZ '2026-10-18T11:00:01-04:00', 'seed-elena-pagos-saliente',
    TIMESTAMPTZ '2026-10-18T11:00:02-04:00', TIMESTAMPTZ '2026-10-18T11:00:01-04:00'
  ),
  (
    'c0000000-0000-4000-8000-000000000b22',
    'c0000000-0000-4000-8000-000000000b32',
    'c0000000-0000-4000-8000-000000000b11',
    'SALIENTE', 'CONTABILIDAD', 'FINIQUITO_APROBADO_ASIENTO', 'ucb-sis323-sub-f',
    '{
      "encabezado":{"id_mensaje":"c0000000-0000-4000-8000-000000000b32","origen":{"grupo":"F","modulo":"RRHH"},"destino":{"grupo":"D","modulo":"Contabilidad"},"tipo":"FINIQUITO_APROBADO_ASIENTO","fecha":"2026-10-18T15:00:00.000Z","version_esquema":1},
      "datos":{"id_finiquito":"c0000000-0000-4000-8000-000000000b11","numero_documento":"FIN-2026-000001","id_proceso":"c0000000-0000-4000-8000-000000000741","colaborador":{"id_empleado":"f0000000-0000-4000-8000-000000000037","nombre_completo":"Elena Paredes Gómez"},"fecha":"2026-10-15","glosa":"Liquidación final de Elena Paredes Gómez según finiquito FIN-2026-000001","asiento":{"renglones":[{"cuenta":{"codigo":"2.1.5.02","nombre":"Provisión para aguinaldos"},"debe":3769.79,"haber":0,"concepto":"Desafectación de provisión para aguinaldos"},{"cuenta":{"codigo":"2.1.5.03","nombre":"Provisión para vacaciones"},"debe":18310.41,"haber":0,"concepto":"Desafectación de provisión para vacaciones"},{"cuenta":{"codigo":"2.1.2.02","nombre":"Finiquitos por pagar"},"debe":0,"haber":22080.2,"concepto":"Finiquitos por pagar"}],"total_debe":22080.2,"total_haber":22080.2}}
    }'::jsonb,
    'ENTREGADO', 1, NULL, TIMESTAMPTZ '2026-10-18T11:00:01-04:00', 'seed-elena-contabilidad-saliente',
    TIMESTAMPTZ '2026-10-18T11:00:02-04:00', TIMESTAMPTZ '2026-10-18T11:00:01-04:00'
  ),
  (
    'c0000000-0000-4000-8000-000000000b23',
    'c0000000-0000-4000-8000-000000000b33',
    'c0000000-0000-4000-8000-000000000b11',
    'RESPUESTA_SIMULADA', 'PAGOS', 'CONFIRMACION_ORDEN_PAGO_FINIQUITO', 'ucb-sis323-sub-f',
    '{"encabezado":{"id_mensaje":"c0000000-0000-4000-8000-000000000b33","origen":{"grupo":"A","modulo":"Pagos y Facturación"},"destino":{"grupo":"F","modulo":"RRHH"},"tipo":"CONFIRMACION_ORDEN_PAGO_FINIQUITO","fecha":"2026-10-18T15:00:05.000Z","version_esquema":1},"datos":{"id_finiquito":"c0000000-0000-4000-8000-000000000b11","id_mensaje_origen":"c0000000-0000-4000-8000-000000000b31","resultado":"CONFIRMADA","referencia":"OP-FIN-2026-000001","motivo":null}}'::jsonb,
    'ENTREGADO', 1, NULL, TIMESTAMPTZ '2026-10-18T11:00:05-04:00', 'seed-elena-pagos-respuesta',
    TIMESTAMPTZ '2026-10-18T11:00:08-04:00', TIMESTAMPTZ '2026-10-18T11:00:05-04:00'
  ),
  (
    'c0000000-0000-4000-8000-000000000b24',
    'c0000000-0000-4000-8000-000000000b34',
    'c0000000-0000-4000-8000-000000000b11',
    'RESPUESTA_SIMULADA', 'CONTABILIDAD', 'CONFIRMACION_ASIENTO_FINIQUITO', 'ucb-sis323-sub-f',
    '{"encabezado":{"id_mensaje":"c0000000-0000-4000-8000-000000000b34","origen":{"grupo":"D","modulo":"Contabilidad"},"destino":{"grupo":"F","modulo":"RRHH"},"tipo":"CONFIRMACION_ASIENTO_FINIQUITO","fecha":"2026-10-18T15:00:09.000Z","version_esquema":1},"datos":{"id_finiquito":"c0000000-0000-4000-8000-000000000b11","id_mensaje_origen":"c0000000-0000-4000-8000-000000000b32","resultado":"CONFIRMADA","referencia":"AS-FIN-2026-000001","motivo":null}}'::jsonb,
    'ENTREGADO', 1, NULL, TIMESTAMPTZ '2026-10-18T11:00:09-04:00', 'seed-elena-contabilidad-respuesta',
    TIMESTAMPTZ '2026-10-18T11:00:12-04:00', TIMESTAMPTZ '2026-10-18T11:00:09-04:00'
  ),
  (
    'c0000000-0000-4000-8000-000000000b61',
    'c0000000-0000-4000-8000-000000000b71',
    'c0000000-0000-4000-8000-000000000b51',
    'SALIENTE', 'PAGOS', 'FINIQUITO_APROBADO_ORDEN_PAGO', 'ucb-sis323-sub-f',
    '{
      "encabezado":{"id_mensaje":"c0000000-0000-4000-8000-000000000b71","origen":{"grupo":"F","modulo":"RRHH"},"destino":{"grupo":"A","modulo":"Pagos y Facturación"},"tipo":"FINIQUITO_APROBADO_ORDEN_PAGO","fecha":"2026-10-22T14:00:00.000Z","version_esquema":1},
      "datos":{"id_finiquito":"c0000000-0000-4000-8000-000000000b51","numero_documento":"FIN-2026-000002","id_proceso":"c0000000-0000-4000-8000-000000000742","prioridad":"URGENTE","moneda":"BOB","colaborador":{"id_empleado":"f0000000-0000-4000-8000-000000000741","nombre_completo":"Luciano Morales Chávez"},"fecha_retiro":"2026-10-20","causal":{"codigo":"RENUNCIA","nombre":"Renuncia voluntaria"},"conceptos":[{"codigo":"INDEMNIZACION","concepto":"Indemnización por tiempo de servicio","monto":16336.04},{"codigo":"AGUINALDO_DUODECIMAS","concepto":"Aguinaldo (duodécimas)","monto":3246.92},{"codigo":"VACACIONES_PENDIENTES","concepto":"Vacaciones no gozadas","monto":7305.56},{"codigo":"VACACIONES_DUODECIMAS","concepto":"Vacaciones (duodécimas del año en curso)","monto":862.46}],"descuentos":[],"total_ingresos":27750.98,"total_descuentos":0,"liquido_pagable":27750.98,"aprobado":{"por":{"id_empleado":"f0000000-0000-4000-8000-000000000023","nombre_completo":"Andrea Salazar Vega"},"en":"2026-10-22T14:00:00.000Z"}}
    }'::jsonb,
    'ENTREGADO', 1, NULL, TIMESTAMPTZ '2026-10-22T10:00:01-04:00', 'seed-luciano-pagos-saliente',
    TIMESTAMPTZ '2026-10-22T10:00:02-04:00', TIMESTAMPTZ '2026-10-22T10:00:01-04:00'
  ),
  (
    'c0000000-0000-4000-8000-000000000b62',
    'c0000000-0000-4000-8000-000000000b72',
    'c0000000-0000-4000-8000-000000000b51',
    'SALIENTE', 'CONTABILIDAD', 'FINIQUITO_APROBADO_ASIENTO', 'ucb-sis323-sub-f',
    '{
      "encabezado":{"id_mensaje":"c0000000-0000-4000-8000-000000000b72","origen":{"grupo":"F","modulo":"RRHH"},"destino":{"grupo":"D","modulo":"Contabilidad"},"tipo":"FINIQUITO_APROBADO_ASIENTO","fecha":"2026-10-22T14:00:00.000Z","version_esquema":1},
      "datos":{"id_finiquito":"c0000000-0000-4000-8000-000000000b51","numero_documento":"FIN-2026-000002","id_proceso":"c0000000-0000-4000-8000-000000000742","colaborador":{"id_empleado":"f0000000-0000-4000-8000-000000000741","nombre_completo":"Luciano Morales Chávez"},"fecha":"2026-10-20","glosa":"Liquidación final de Luciano Morales Chávez según finiquito FIN-2026-000002","asiento":{"renglones":[{"cuenta":{"codigo":"2.1.5.01","nombre":"Previsión para indemnizaciones"},"debe":16336.04,"haber":0,"concepto":"Desafectación de previsión para indemnizaciones y desahucio"},{"cuenta":{"codigo":"2.1.5.02","nombre":"Provisión para aguinaldos"},"debe":3246.92,"haber":0,"concepto":"Desafectación de provisión para aguinaldos"},{"cuenta":{"codigo":"2.1.5.03","nombre":"Provisión para vacaciones"},"debe":8168.02,"haber":0,"concepto":"Desafectación de provisión para vacaciones"},{"cuenta":{"codigo":"2.1.2.02","nombre":"Finiquitos por pagar"},"debe":0,"haber":27750.98,"concepto":"Finiquitos por pagar"}],"total_debe":27750.98,"total_haber":27750.98}}
    }'::jsonb,
    'ENTREGADO', 1, NULL, TIMESTAMPTZ '2026-10-22T10:00:01-04:00', 'seed-luciano-contabilidad-saliente-1',
    TIMESTAMPTZ '2026-10-22T10:00:02-04:00', TIMESTAMPTZ '2026-10-22T10:00:01-04:00'
  ),
  (
    'c0000000-0000-4000-8000-000000000b63',
    'c0000000-0000-4000-8000-000000000b73',
    'c0000000-0000-4000-8000-000000000b51',
    'RESPUESTA_SIMULADA', 'PAGOS', 'CONFIRMACION_ORDEN_PAGO_FINIQUITO', 'ucb-sis323-sub-f',
    '{"encabezado":{"id_mensaje":"c0000000-0000-4000-8000-000000000b73","origen":{"grupo":"A","modulo":"Pagos y Facturación"},"destino":{"grupo":"F","modulo":"RRHH"},"tipo":"CONFIRMACION_ORDEN_PAGO_FINIQUITO","fecha":"2026-10-22T14:00:05.000Z","version_esquema":1},"datos":{"id_finiquito":"c0000000-0000-4000-8000-000000000b51","id_mensaje_origen":"c0000000-0000-4000-8000-000000000b71","resultado":"CONFIRMADA","referencia":"OP-FIN-2026-000002","motivo":null}}'::jsonb,
    'ENTREGADO', 1, NULL, TIMESTAMPTZ '2026-10-22T10:00:05-04:00', 'seed-luciano-pagos-respuesta',
    TIMESTAMPTZ '2026-10-22T10:00:08-04:00', TIMESTAMPTZ '2026-10-22T10:00:05-04:00'
  ),
  (
    'c0000000-0000-4000-8000-000000000b64',
    'c0000000-0000-4000-8000-000000000b74',
    'c0000000-0000-4000-8000-000000000b51',
    'SALIENTE', 'CONTABILIDAD', 'FINIQUITO_APROBADO_ASIENTO', 'ucb-sis323-sub-f',
    '{
      "encabezado":{"id_mensaje":"c0000000-0000-4000-8000-000000000b74","origen":{"grupo":"F","modulo":"RRHH"},"destino":{"grupo":"D","modulo":"Contabilidad"},"tipo":"FINIQUITO_APROBADO_ASIENTO","fecha":"2026-10-22T14:04:00.000Z","version_esquema":1},
      "datos":{"id_finiquito":"c0000000-0000-4000-8000-000000000b51","numero_documento":"FIN-2026-000002","id_proceso":"c0000000-0000-4000-8000-000000000742","colaborador":{"id_empleado":"f0000000-0000-4000-8000-000000000741","nombre_completo":"Luciano Morales Chávez"},"fecha":"2026-10-20","glosa":"Liquidación final de Luciano Morales Chávez según finiquito FIN-2026-000002","asiento":{"renglones":[{"cuenta":{"codigo":"2.1.5.01","nombre":"Previsión para indemnizaciones"},"debe":16336.04,"haber":0,"concepto":"Desafectación de previsión para indemnizaciones y desahucio"},{"cuenta":{"codigo":"2.1.5.02","nombre":"Provisión para aguinaldos"},"debe":3246.92,"haber":0,"concepto":"Desafectación de provisión para aguinaldos"},{"cuenta":{"codigo":"2.1.5.03","nombre":"Provisión para vacaciones"},"debe":8168.02,"haber":0,"concepto":"Desafectación de provisión para vacaciones"},{"cuenta":{"codigo":"2.1.2.02","nombre":"Finiquitos por pagar"},"debe":0,"haber":27750.98,"concepto":"Finiquitos por pagar"}],"total_debe":27750.98,"total_haber":27750.98}}
    }'::jsonb,
    'ENTREGADO', 1, NULL, TIMESTAMPTZ '2026-10-22T10:04:00-04:00', 'seed-luciano-contabilidad-saliente-2',
    TIMESTAMPTZ '2026-10-22T10:04:01-04:00', TIMESTAMPTZ '2026-10-22T10:04:00-04:00'
  ),
  (
    'c0000000-0000-4000-8000-000000000b65',
    'c0000000-0000-4000-8000-000000000b75',
    'c0000000-0000-4000-8000-000000000b51',
    'RESPUESTA_SIMULADA', 'CONTABILIDAD', 'CONFIRMACION_ASIENTO_FINIQUITO', 'ucb-sis323-sub-f',
    '{"encabezado":{"id_mensaje":"c0000000-0000-4000-8000-000000000b75","origen":{"grupo":"D","modulo":"Contabilidad"},"destino":{"grupo":"F","modulo":"RRHH"},"tipo":"CONFIRMACION_ASIENTO_FINIQUITO","fecha":"2026-10-22T14:05:08.000Z","version_esquema":1},"datos":{"id_finiquito":"c0000000-0000-4000-8000-000000000b51","id_mensaje_origen":"c0000000-0000-4000-8000-000000000b74","resultado":"RECHAZADA","referencia":null,"motivo":"La cuenta 2.1.5.03 no existe en el plan de cuentas"}}'::jsonb,
    'ENTREGADO', 1, NULL, TIMESTAMPTZ '2026-10-22T10:05:08-04:00', 'seed-luciano-contabilidad-rechazo',
    TIMESTAMPTZ '2026-10-22T10:05:10-04:00', TIMESTAMPTZ '2026-10-22T10:05:08-04:00'
  ),
  (
    'c0000000-0000-4000-8000-000000000b66',
    'c0000000-0000-4000-8000-000000000b76',
    'c0000000-0000-4000-8000-000000000b51',
    'RESPUESTA_SIMULADA', 'CONTABILIDAD', 'CONFIRMACION_ASIENTO_FINIQUITO', 'ucb-sis323-sub-f',
    '{"encabezado":{"id_mensaje":"c0000000-0000-4000-8000-000000000b76","origen":{"grupo":"D","modulo":"Contabilidad"},"destino":{"grupo":"F","modulo":"RRHH"},"tipo":"CONFIRMACION_ASIENTO_FINIQUITO","fecha":"2026-10-22T14:05:25.000Z","version_esquema":1},"datos":{"id_finiquito":"c0000000-0000-4000-8000-000000000b51","id_mensaje_origen":"c0000000-0000-4000-8000-000000000b72","resultado":"CONFIRMADA","referencia":"AS-FIN-2026-000002-ANT","motivo":null}}'::jsonb,
    'ENTREGADO', 1, NULL, TIMESTAMPTZ '2026-10-22T10:05:25-04:00', 'seed-luciano-contabilidad-tardia',
    TIMESTAMPTZ '2026-10-22T10:05:30-04:00', TIMESTAMPTZ '2026-10-22T10:05:25-04:00'
  )
ON CONFLICT DO NOTHING;

INSERT INTO MENSAJES_FINIQUITO_ENTRANTES (
  id_entrante, id_mensaje, origen, tipo_evento, id_finiquito, destino, carga,
  estado, intentos, ultimo_error, recibido_en, procesado_en
) VALUES
  (
    'c0000000-0000-4000-8000-000000000b41',
    'c0000000-0000-4000-8000-000000000b33',
    'A', 'CONFIRMACION_ORDEN_PAGO_FINIQUITO', 'c0000000-0000-4000-8000-000000000b11', 'PAGOS',
    '{"encabezado":{"id_mensaje":"c0000000-0000-4000-8000-000000000b33","origen":{"grupo":"A","modulo":"Pagos y Facturación"},"destino":{"grupo":"F","modulo":"RRHH"},"tipo":"CONFIRMACION_ORDEN_PAGO_FINIQUITO","fecha":"2026-10-18T15:00:05.000Z","version_esquema":1},"datos":{"id_finiquito":"c0000000-0000-4000-8000-000000000b11","id_mensaje_origen":"c0000000-0000-4000-8000-000000000b31","resultado":"CONFIRMADA","referencia":"OP-FIN-2026-000001","motivo":null}}',
    'PROCESADO', 1, NULL, TIMESTAMPTZ '2026-10-18T11:00:09-04:00', TIMESTAMPTZ '2026-10-18T11:00:10-04:00'
  ),
  (
    'c0000000-0000-4000-8000-000000000b42',
    'c0000000-0000-4000-8000-000000000b34',
    'D', 'CONFIRMACION_ASIENTO_FINIQUITO', 'c0000000-0000-4000-8000-000000000b11', 'CONTABILIDAD',
    '{"encabezado":{"id_mensaje":"c0000000-0000-4000-8000-000000000b34","origen":{"grupo":"D","modulo":"Contabilidad"},"destino":{"grupo":"F","modulo":"RRHH"},"tipo":"CONFIRMACION_ASIENTO_FINIQUITO","fecha":"2026-10-18T15:00:09.000Z","version_esquema":1},"datos":{"id_finiquito":"c0000000-0000-4000-8000-000000000b11","id_mensaje_origen":"c0000000-0000-4000-8000-000000000b32","resultado":"CONFIRMADA","referencia":"AS-FIN-2026-000001","motivo":null}}',
    'PROCESADO', 1, NULL, TIMESTAMPTZ '2026-10-18T11:00:14-04:00', TIMESTAMPTZ '2026-10-18T11:00:15-04:00'
  ),
  (
    'c0000000-0000-4000-8000-000000000b81',
    'c0000000-0000-4000-8000-000000000b73',
    'A', 'CONFIRMACION_ORDEN_PAGO_FINIQUITO', 'c0000000-0000-4000-8000-000000000b51', 'PAGOS',
    '{"encabezado":{"id_mensaje":"c0000000-0000-4000-8000-000000000b73","origen":{"grupo":"A","modulo":"Pagos y Facturación"},"destino":{"grupo":"F","modulo":"RRHH"},"tipo":"CONFIRMACION_ORDEN_PAGO_FINIQUITO","fecha":"2026-10-22T14:00:05.000Z","version_esquema":1},"datos":{"id_finiquito":"c0000000-0000-4000-8000-000000000b51","id_mensaje_origen":"c0000000-0000-4000-8000-000000000b71","resultado":"CONFIRMADA","referencia":"OP-FIN-2026-000002","motivo":null}}',
    'PROCESADO', 1, NULL, TIMESTAMPTZ '2026-10-22T10:00:09-04:00', TIMESTAMPTZ '2026-10-22T10:00:10-04:00'
  ),
  (
    'c0000000-0000-4000-8000-000000000b82',
    'c0000000-0000-4000-8000-000000000b75',
    'D', 'CONFIRMACION_ASIENTO_FINIQUITO', 'c0000000-0000-4000-8000-000000000b51', 'CONTABILIDAD',
    '{"encabezado":{"id_mensaje":"c0000000-0000-4000-8000-000000000b75","origen":{"grupo":"D","modulo":"Contabilidad"},"destino":{"grupo":"F","modulo":"RRHH"},"tipo":"CONFIRMACION_ASIENTO_FINIQUITO","fecha":"2026-10-22T14:05:08.000Z","version_esquema":1},"datos":{"id_finiquito":"c0000000-0000-4000-8000-000000000b51","id_mensaje_origen":"c0000000-0000-4000-8000-000000000b74","resultado":"RECHAZADA","referencia":null,"motivo":"La cuenta 2.1.5.03 no existe en el plan de cuentas"}}',
    'PROCESADO', 1, NULL, TIMESTAMPTZ '2026-10-22T10:05:11-04:00', TIMESTAMPTZ '2026-10-22T10:05:12-04:00'
  ),
  (
    'c0000000-0000-4000-8000-000000000b83',
    'c0000000-0000-4000-8000-000000000b76',
    'D', 'CONFIRMACION_ASIENTO_FINIQUITO', 'c0000000-0000-4000-8000-000000000b51', 'CONTABILIDAD',
    '{"encabezado":{"id_mensaje":"c0000000-0000-4000-8000-000000000b76","origen":{"grupo":"D","modulo":"Contabilidad"},"destino":{"grupo":"F","modulo":"RRHH"},"tipo":"CONFIRMACION_ASIENTO_FINIQUITO","fecha":"2026-10-22T14:05:25.000Z","version_esquema":1},"datos":{"id_finiquito":"c0000000-0000-4000-8000-000000000b51","id_mensaje_origen":"c0000000-0000-4000-8000-000000000b72","resultado":"CONFIRMADA","referencia":"AS-FIN-2026-000002-ANT","motivo":null}}',
    'IGNORADO', 1, 'Respuesta a un envío anterior o desconocido.', TIMESTAMPTZ '2026-10-22T10:05:31-04:00', TIMESTAMPTZ '2026-10-22T10:05:32-04:00'
  ),
  (
    'c0000000-0000-4000-8000-000000000b91',
    'invalido-seed-dlq-0001',
    NULL, NULL, NULL, NULL,
    '{"encabezado":{"tipo":"MENSAJE_TRUNCO"}',
    'EN_DLQ', 3, 'El mensaje no es un JSON válido.', TIMESTAMPTZ '2026-11-10T16:15:00-04:00', NULL
  )
ON CONFLICT DO NOTHING;

SELECT setval(
  'seq_numero_finiquito',
  GREATEST((SELECT CASE WHEN is_called THEN last_value ELSE 1 END FROM seq_numero_finiquito), 2),
  true
);

COMMIT;
