-- Datos de prueba de PerformanceDB
-- Requiere init.sql y catalogos.sql, que se cargan solos al crear la base.
-- Es SQL puro (sin comandos de psql): se puede correr desde SQLTools, DBeaver o psql.
-- Uso (PowerShell):
--   Get-Content backend/PerformanceService/db/seed.sql | docker exec -i rrhh-postgres psql -U adminRRHH -d PerformanceDB
-- Los ids de personas, áreas y sucursales son los mismos de EmployeeService/db/seed.sql (cárguelo primero):
--   evaluadores 21 (Marcela Quiroga, Sopocachi) y 22 (Jorge Mamani, Miraflores), creador 23, evaluados 31 a 34.
-- Las fechas de los ciclos se calculan respecto de hoy en La Paz cada vez que se ejecuta.
-- Los nombres de los empleados son de demostración; el servicio los actualiza desde EmployeeService.
--
-- Qué queda cargado (el evaluador es id_evaluador salvo la evaluación 124):
--   Ciclo "Evaluación de desempeño 2026-S2" (activo)       -> 121 PENDIENTE, 122 BORRADOR (3 respuestas), 124 de otro evaluador
--   Ciclo "Evaluación de personal nuevo 2026" (activo)     -> 123 PENDIENTE, con una fecha límite más cercana
--   Ciclo "Evaluación de desempeño 2026-S1" (cerrado)      -> 125 ENVIADA (puntaje 87.78), 126 VENCIDA
-- Ciclos de KAN-23 (programación, recordatorios y cierre):
--   "Evaluación de fin de año 2026" (programado, inicia en 15 días)   -> 127, 128 PENDIENTE: aún no aparecen en la bandeja
--   "Evaluación de inducción 2026" (programado, inicia hoy)           -> 129 PENDIENTE: el job debe activarlo
--   "Evaluación de campaña de fin de año" (activo, vence en 3 días)   -> 130 PENDIENTE, 131 BORRADOR, 132 PENDIENTE de otro evaluador,
--                                                                        133 ENVIADA (no se recuerda), 134 PENDIENTE ya recordada (no se repite)
--   "Evaluación de temporada baja" (activo, venció ayer)              -> 135 PENDIENTE, 136 BORRADOR, 137 ENVIADA: el job debe cerrarlo
--                                                                        y dejar 135 y 136 como VENCIDA sin tocar 137
-- KAN-26 (historial de desempeño del evaluado 31):
--   "Evaluación de desempeño 2025-S2" (cerrado)                      -> 138 ENVIADA (72.22)
--   "Evaluación de desempeño 2026-S1" (cerrado)                      -> además de la 125, la 139 de otro evaluador (85.00)
-- KAN-27 (consolidado, brechas y métricas del CRM): ciclo "Evaluación trimestral 2026-T3" (cerrado) con evaluaciones 140 a 148,
--   los mensajes 151 (CRM, PROCESADO) y 152 (EN_DLQ) y las métricas de 6 cajeros y asesores. El detalle está al final de este archivo.
-- La plantilla tiene 6 preguntas con pesos que suman 100; la pregunta 95 es opcional.
BEGIN;
-- Réplica mínima de EmployeeDB.
INSERT INTO DEPARTAMENTOS (id_departamento, nombre)
VALUES (
        'f0000000-0000-4000-8000-000000000001',
        'Atención al cliente'
    ),
    (
        'f0000000-0000-4000-8000-000000000002',
        'Recursos Humanos'
    ) ON CONFLICT DO NOTHING;
INSERT INTO SUCURSALES (id_sucursal, nombre)
VALUES (
        'f0000000-0000-4000-8000-000000000011',
        'Sopocachi'
    ),
    (
        'f0000000-0000-4000-8000-000000000012',
        'Miraflores'
    ) ON CONFLICT DO NOTHING;
INSERT INTO EMPLEADOS (id_empleado, nombres, apellidos)
VALUES ('f0000000-0000-4000-8000-000000000021'::uuid, 'Marcela', 'Quiroga Peña'),
    (
        'f0000000-0000-4000-8000-000000000022'::uuid,
        'Jorge',
        'Mamani Condori'
    ),
    ('f0000000-0000-4000-8000-000000000023'::uuid, 'Andrea', 'Salazar Vega'),
    ('f0000000-0000-4000-8000-000000000031'::uuid, 'Carlos', 'Rojas Vargas'),
    ('f0000000-0000-4000-8000-000000000032'::uuid, 'Lucía', 'Flores Choque'),
    ('f0000000-0000-4000-8000-000000000033'::uuid, 'Diego', 'Quispe Mamani'),
    (
        'f0000000-0000-4000-8000-000000000034'::uuid,
        'Paola',
        'Gutiérrez Limachi'
    ) ON CONFLICT DO NOTHING;
-- Competencias, períodos y plantilla publicada (una competencia por sección).
INSERT INTO COMPETENCIAS (
        id_competencia,
        id_tipo_competencia,
        nombre,
        descripcion
    )
VALUES (
        'f0000000-0000-4000-8000-000000000101',
        1,
        'Atención al cliente',
        'Trato y solución de necesidades del cliente'
    ),
    (
        'f0000000-0000-4000-8000-000000000102',
        1,
        'Trabajo en equipo',
        'Colaboración con los compañeros de la sucursal'
    ),
    (
        'f0000000-0000-4000-8000-000000000103',
        2,
        'Puntualidad y orden',
        'Cumplimiento del horario y de las normas del puesto'
    ) ON CONFLICT DO NOTHING;
INSERT INTO PERIODOS_EVALUACION (id_periodo, nombre, fecha_inicio, fecha_fin)
VALUES (
        'f0000000-0000-4000-8000-000000000041',
        '2026-S1',
        '2026-01-01',
        '2026-06-30'
    ),
    (
        'f0000000-0000-4000-8000-000000000042',
        '2026-S2',
        '2026-07-01',
        '2026-12-31'
    ) ON CONFLICT DO NOTHING;
INSERT INTO PLANTILLAS_EVALUACION (
        id_plantilla,
        id_departamento_destino,
        id_empleado_creador,
        nombre,
        objetivo,
        vigencia_desde,
        vigencia_hasta
    )
VALUES (
        'f0000000-0000-4000-8000-000000000051',
        'f0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000023'::uuid,
        'Evaluación de personal de tienda',
        'Medir la atención al cliente, el trabajo en equipo y la puntualidad del personal de tienda.',
        '2026-01-01',
        '2026-12-31'
    ) ON CONFLICT DO NOTHING;
INSERT INTO VERSIONES_PLANTILLA (
        id_version,
        id_plantilla,
        id_estado_version,
        id_empleado_publicador,
        numero_version,
        publicada_en
    )
VALUES (
        'f0000000-0000-4000-8000-000000000061',
        'f0000000-0000-4000-8000-000000000051',
        2,
        'f0000000-0000-4000-8000-000000000023'::uuid,
        1,
        '2026-01-10 09:00:00-04'
    ) ON CONFLICT DO NOTHING;
INSERT INTO SECCIONES_PLANTILLA (id_seccion, id_version, id_competencia, orden)
VALUES (
        'f0000000-0000-4000-8000-000000000071',
        'f0000000-0000-4000-8000-000000000061',
        'f0000000-0000-4000-8000-000000000101',
        1
    ),
    (
        'f0000000-0000-4000-8000-000000000072',
        'f0000000-0000-4000-8000-000000000061',
        'f0000000-0000-4000-8000-000000000102',
        2
    ),
    (
        'f0000000-0000-4000-8000-000000000073',
        'f0000000-0000-4000-8000-000000000061',
        'f0000000-0000-4000-8000-000000000103',
        3
    ) ON CONFLICT DO NOTHING;
INSERT INTO CRITERIOS_EVALUACION (
        id_criterio,
        id_seccion,
        nombre,
        descripcion,
        orden
    )
VALUES (
        'f0000000-0000-4000-8000-000000000081',
        'f0000000-0000-4000-8000-000000000071',
        'Trato al cliente',
        'Cortesía y claridad al atender',
        1
    ),
    (
        'f0000000-0000-4000-8000-000000000082',
        'f0000000-0000-4000-8000-000000000071',
        'Resolución de reclamos',
        'Manejo de quejas en el punto de venta',
        2
    ),
    (
        'f0000000-0000-4000-8000-000000000083',
        'f0000000-0000-4000-8000-000000000072',
        'Colaboración',
        'Apoyo y comunicación con el equipo',
        1
    ),
    (
        'f0000000-0000-4000-8000-000000000084',
        'f0000000-0000-4000-8000-000000000073',
        'Cumplimiento de horario',
        'Asistencia puntual al puesto',
        1
    ) ON CONFLICT DO NOTHING;
-- Escalas: 00..01 = Likert de 1 a 5, 00..02 = Nivel de cumplimiento (ambas vienen de init.sql).
-- Pesos: 20 + 15 + 15 + 20 + 10 + 20 = 100.
INSERT INTO PREGUNTAS_EVALUACION (
        id_pregunta,
        id_criterio,
        id_escala,
        texto,
        peso_porcentual,
        es_obligatoria,
        orden
    )
VALUES (
        'f0000000-0000-4000-8000-000000000091',
        'f0000000-0000-4000-8000-000000000081',
        '00000000-0000-4000-8000-000000000001',
        '¿Saluda y atiende al cliente con cortesía?',
        20,
        TRUE,
        1
    ),
    (
        'f0000000-0000-4000-8000-000000000092',
        'f0000000-0000-4000-8000-000000000081',
        '00000000-0000-4000-8000-000000000001',
        '¿Resuelve las dudas del cliente con claridad?',
        15,
        TRUE,
        2
    ),
    (
        'f0000000-0000-4000-8000-000000000093',
        'f0000000-0000-4000-8000-000000000082',
        '00000000-0000-4000-8000-000000000001',
        '¿Gestiona los reclamos con calma y buscando una solución?',
        15,
        TRUE,
        1
    ),
    (
        'f0000000-0000-4000-8000-000000000094',
        'f0000000-0000-4000-8000-000000000083',
        '00000000-0000-4000-8000-000000000001',
        '¿Apoya a sus compañeros cuando el equipo lo necesita?',
        20,
        TRUE,
        1
    ),
    (
        'f0000000-0000-4000-8000-000000000095',
        'f0000000-0000-4000-8000-000000000083',
        '00000000-0000-4000-8000-000000000001',
        '¿Comparte información útil con el equipo?',
        10,
        FALSE,
        2
    ),
    (
        'f0000000-0000-4000-8000-000000000096',
        'f0000000-0000-4000-8000-000000000084',
        '00000000-0000-4000-8000-000000000002',
        '¿Cumple su horario de trabajo?',
        20,
        TRUE,
        1
    ) ON CONFLICT DO NOTHING;
-- Ciclos: dos activos con fechas límite distintas (para el filtro por ciclo) y uno cerrado.
INSERT INTO CICLOS_EVALUACION (
        id_ciclo,
        id_version,
        id_periodo,
        id_estado_ciclo,
        id_empleado_creador,
        nombre,
        fecha_inicio,
        fecha_limite,
        cerrado_en
    )
VALUES (
        'f0000000-0000-4000-8000-000000000111',
        'f0000000-0000-4000-8000-000000000061',
        'f0000000-0000-4000-8000-000000000042',
        2,
        'f0000000-0000-4000-8000-000000000023'::uuid,
        'Evaluación de desempeño 2026-S2',
        CURRENT_DATE - 20,
        CURRENT_DATE + 25,
        NULL
    ),
    (
        'f0000000-0000-4000-8000-000000000113',
        'f0000000-0000-4000-8000-000000000061',
        'f0000000-0000-4000-8000-000000000042',
        2,
        'f0000000-0000-4000-8000-000000000023'::uuid,
        'Evaluación de personal nuevo 2026',
        CURRENT_DATE - 10,
        CURRENT_DATE + 7,
        NULL
    ),
    (
        'f0000000-0000-4000-8000-000000000112',
        'f0000000-0000-4000-8000-000000000061',
        'f0000000-0000-4000-8000-000000000041',
        3,
        'f0000000-0000-4000-8000-000000000023'::uuid,
        'Evaluación de desempeño 2026-S1',
        '2026-06-01',
        '2026-07-03',
        '2026-07-05 08:00:00-04'
    ) ON CONFLICT DO NOTHING;
INSERT INTO EVALUACIONES (
        id_evaluacion,
        id_ciclo,
        id_empleado_evaluado,
        id_empleado_evaluador,
        id_departamento,
        id_sucursal,
        id_estado_evaluacion,
        puntaje_final,
        fortalezas,
        aspectos_mejora,
        comentarios_generales,
        enviada_en
    )
VALUES -- Ciclo S2 activo: PENDIENTE del evaluador.
    (
        'f0000000-0000-4000-8000-000000000121',
        'f0000000-0000-4000-8000-000000000111',
        'f0000000-0000-4000-8000-000000000031'::uuid,
        'f0000000-0000-4000-8000-000000000021'::uuid,
        'f0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000011',
        1,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL
    ),
    -- Ciclo S2 activo: BORRADOR con tres respuestas.
    (
        'f0000000-0000-4000-8000-000000000122',
        'f0000000-0000-4000-8000-000000000111',
        'f0000000-0000-4000-8000-000000000032'::uuid,
        'f0000000-0000-4000-8000-000000000021'::uuid,
        'f0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000011',
        2,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL
    ),
    -- Ciclo de personal nuevo: PENDIENTE con fecha límite cercana.
    (
        'f0000000-0000-4000-8000-000000000123',
        'f0000000-0000-4000-8000-000000000113',
        'f0000000-0000-4000-8000-000000000033'::uuid,
        'f0000000-0000-4000-8000-000000000021'::uuid,
        'f0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000012',
        1,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL
    ),
    -- Asignada a otro evaluador: sirve para probar que no se puede abrir ni responder.
    (
        'f0000000-0000-4000-8000-000000000124',
        'f0000000-0000-4000-8000-000000000111',
        'f0000000-0000-4000-8000-000000000034'::uuid,
        'f0000000-0000-4000-8000-000000000022'::uuid,
        'f0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000012',
        1,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL
    ),
    -- Ciclo S1 cerrado: ENVIADA con el puntaje congelado (ver cálculo en aclaracion.md).
    (
        'f0000000-0000-4000-8000-000000000125',
        'f0000000-0000-4000-8000-000000000112',
        'f0000000-0000-4000-8000-000000000031'::uuid,
        'f0000000-0000-4000-8000-000000000021'::uuid,
        'f0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000011',
        3,
        87.78,
        'Atiende con amabilidad y apoya mucho al equipo.',
        'Mejorar el manejo de reclamos complejos.',
        'Buen desempeño general en el semestre.',
        '2026-07-02 15:30:00-04'
    ),
    -- Ciclo S1 cerrado: VENCIDA, nunca se envió.
    (
        'f0000000-0000-4000-8000-000000000126',
        'f0000000-0000-4000-8000-000000000112',
        'f0000000-0000-4000-8000-000000000032'::uuid,
        'f0000000-0000-4000-8000-000000000021'::uuid,
        'f0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000011',
        4,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL
    ) ON CONFLICT DO NOTHING;
-- KAN-23: ciclos programados y activos para probar la activación, los recordatorios y el cierre automático.
INSERT INTO CICLOS_EVALUACION (
        id_ciclo,
        id_version,
        id_periodo,
        id_estado_ciclo,
        id_empleado_creador,
        nombre,
        fecha_inicio,
        fecha_limite,
        cerrado_en
    )
VALUES (
        'f0000000-0000-4000-8000-000000000114',
        'f0000000-0000-4000-8000-000000000061',
        'f0000000-0000-4000-8000-000000000042',
        1,
        'f0000000-0000-4000-8000-000000000023'::uuid,
        'Evaluación de fin de año 2026',
        (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date + 15,
        (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date + 45,
        NULL
    ),
    (
        'f0000000-0000-4000-8000-000000000115',
        'f0000000-0000-4000-8000-000000000061',
        'f0000000-0000-4000-8000-000000000042',
        1,
        'f0000000-0000-4000-8000-000000000023'::uuid,
        'Evaluación de inducción 2026',
        (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date,
        (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date + 30,
        NULL
    ),
    (
        'f0000000-0000-4000-8000-000000000116',
        'f0000000-0000-4000-8000-000000000061',
        'f0000000-0000-4000-8000-000000000042',
        2,
        'f0000000-0000-4000-8000-000000000023'::uuid,
        'Evaluación de campaña de fin de año',
        (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date - 27,
        (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date + 3,
        NULL
    ),
    (
        'f0000000-0000-4000-8000-000000000117',
        'f0000000-0000-4000-8000-000000000061',
        'f0000000-0000-4000-8000-000000000042',
        2,
        'f0000000-0000-4000-8000-000000000023'::uuid,
        'Evaluación de temporada baja',
        (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date - 40,
        (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date - 1,
        NULL
    ) ON CONFLICT DO NOTHING;
INSERT INTO EVALUACIONES (
        id_evaluacion,
        id_ciclo,
        id_empleado_evaluado,
        id_empleado_evaluador,
        id_departamento,
        id_sucursal,
        id_estado_evaluacion,
        puntaje_final,
        enviada_en,
        recordatorio_enviado_en
    )
VALUES
    (
        'f0000000-0000-4000-8000-000000000127',
        'f0000000-0000-4000-8000-000000000114',
        'f0000000-0000-4000-8000-000000000031'::uuid,
        'f0000000-0000-4000-8000-000000000021'::uuid,
        'f0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000011',
        1,
        NULL,
        NULL,
        NULL
    ),
    (
        'f0000000-0000-4000-8000-000000000128',
        'f0000000-0000-4000-8000-000000000114',
        'f0000000-0000-4000-8000-000000000032'::uuid,
        'f0000000-0000-4000-8000-000000000021'::uuid,
        'f0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000011',
        1,
        NULL,
        NULL,
        NULL
    ),
    (
        'f0000000-0000-4000-8000-000000000129',
        'f0000000-0000-4000-8000-000000000115',
        'f0000000-0000-4000-8000-000000000033'::uuid,
        'f0000000-0000-4000-8000-000000000022'::uuid,
        'f0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000012',
        1,
        NULL,
        NULL,
        NULL
    ),
    (
        'f0000000-0000-4000-8000-000000000130',
        'f0000000-0000-4000-8000-000000000116',
        'f0000000-0000-4000-8000-000000000031'::uuid,
        'f0000000-0000-4000-8000-000000000021'::uuid,
        'f0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000011',
        1,
        NULL,
        NULL,
        NULL
    ),
    (
        'f0000000-0000-4000-8000-000000000131',
        'f0000000-0000-4000-8000-000000000116',
        'f0000000-0000-4000-8000-000000000032'::uuid,
        'f0000000-0000-4000-8000-000000000021'::uuid,
        'f0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000011',
        2,
        NULL,
        NULL,
        NULL
    ),
    (
        'f0000000-0000-4000-8000-000000000132',
        'f0000000-0000-4000-8000-000000000116',
        'f0000000-0000-4000-8000-000000000033'::uuid,
        'f0000000-0000-4000-8000-000000000022'::uuid,
        'f0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000012',
        1,
        NULL,
        NULL,
        NULL
    ),
    (
        'f0000000-0000-4000-8000-000000000133',
        'f0000000-0000-4000-8000-000000000116',
        'f0000000-0000-4000-8000-000000000034'::uuid,
        'f0000000-0000-4000-8000-000000000021'::uuid,
        'f0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000012',
        3,
        87.78,
        CURRENT_TIMESTAMP - INTERVAL '2 days',
        NULL
    ),
    (
        'f0000000-0000-4000-8000-000000000134',
        'f0000000-0000-4000-8000-000000000116',
        'f0000000-0000-4000-8000-000000000031'::uuid,
        'f0000000-0000-4000-8000-000000000022'::uuid,
        'f0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000011',
        1,
        NULL,
        NULL,
        CURRENT_TIMESTAMP - INTERVAL '1 day'
    ),
    (
        'f0000000-0000-4000-8000-000000000135',
        'f0000000-0000-4000-8000-000000000117',
        'f0000000-0000-4000-8000-000000000031'::uuid,
        'f0000000-0000-4000-8000-000000000021'::uuid,
        'f0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000011',
        1,
        NULL,
        NULL,
        NULL
    ),
    (
        'f0000000-0000-4000-8000-000000000136',
        'f0000000-0000-4000-8000-000000000117',
        'f0000000-0000-4000-8000-000000000032'::uuid,
        'f0000000-0000-4000-8000-000000000021'::uuid,
        'f0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000011',
        2,
        NULL,
        NULL,
        NULL
    ),
    (
        'f0000000-0000-4000-8000-000000000137',
        'f0000000-0000-4000-8000-000000000117',
        'f0000000-0000-4000-8000-000000000033'::uuid,
        'f0000000-0000-4000-8000-000000000022'::uuid,
        'f0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000012',
        3,
        87.78,
        CURRENT_TIMESTAMP - INTERVAL '4 days',
        NULL
    ) ON CONFLICT DO NOTHING;
-- Respuestas: se indica el valor del nivel y se busca el id_nivel de la escala de cada pregunta.
INSERT INTO RESPUESTAS_EVALUACION (id_evaluacion, id_pregunta, id_nivel)
SELECT r.id_evaluacion,
    r.id_pregunta,
    n.id_nivel
FROM (
        VALUES -- 122 (BORRADOR): faltan las preguntas 93, 94 y 96.
            (
                'f0000000-0000-4000-8000-000000000122'::uuid,
                'f0000000-0000-4000-8000-000000000091'::uuid,
                4
            ),
            (
                'f0000000-0000-4000-8000-000000000122'::uuid,
                'f0000000-0000-4000-8000-000000000092'::uuid,
                3
            ),
            (
                'f0000000-0000-4000-8000-000000000122'::uuid,
                'f0000000-0000-4000-8000-000000000095'::uuid,
                5
            ),
            -- 125 (ENVIADA): la pregunta opcional 95 queda sin responder.
            (
                'f0000000-0000-4000-8000-000000000125'::uuid,
                'f0000000-0000-4000-8000-000000000091'::uuid,
                5
            ),
            (
                'f0000000-0000-4000-8000-000000000125'::uuid,
                'f0000000-0000-4000-8000-000000000092'::uuid,
                4
            ),
            (
                'f0000000-0000-4000-8000-000000000125'::uuid,
                'f0000000-0000-4000-8000-000000000093'::uuid,
                4
            ),
            (
                'f0000000-0000-4000-8000-000000000125'::uuid,
                'f0000000-0000-4000-8000-000000000094'::uuid,
                5
            ),
            (
                'f0000000-0000-4000-8000-000000000125'::uuid,
                'f0000000-0000-4000-8000-000000000096'::uuid,
                3
            ),
            -- KAN-23: 131 y 136 (BORRADOR) con dos respuestas; 133 y 137 (ENVIADA) con las mismas respuestas que la 125.
            (
                'f0000000-0000-4000-8000-000000000131'::uuid,
                'f0000000-0000-4000-8000-000000000091'::uuid,
                4
            ),
            (
                'f0000000-0000-4000-8000-000000000131'::uuid,
                'f0000000-0000-4000-8000-000000000092'::uuid,
                3
            ),
            (
                'f0000000-0000-4000-8000-000000000136'::uuid,
                'f0000000-0000-4000-8000-000000000091'::uuid,
                2
            ),
            (
                'f0000000-0000-4000-8000-000000000136'::uuid,
                'f0000000-0000-4000-8000-000000000093'::uuid,
                3
            ),
            (
                'f0000000-0000-4000-8000-000000000133'::uuid,
                'f0000000-0000-4000-8000-000000000091'::uuid,
                5
            ),
            (
                'f0000000-0000-4000-8000-000000000133'::uuid,
                'f0000000-0000-4000-8000-000000000092'::uuid,
                4
            ),
            (
                'f0000000-0000-4000-8000-000000000133'::uuid,
                'f0000000-0000-4000-8000-000000000093'::uuid,
                4
            ),
            (
                'f0000000-0000-4000-8000-000000000133'::uuid,
                'f0000000-0000-4000-8000-000000000094'::uuid,
                5
            ),
            (
                'f0000000-0000-4000-8000-000000000133'::uuid,
                'f0000000-0000-4000-8000-000000000096'::uuid,
                3
            ),
            (
                'f0000000-0000-4000-8000-000000000137'::uuid,
                'f0000000-0000-4000-8000-000000000091'::uuid,
                5
            ),
            (
                'f0000000-0000-4000-8000-000000000137'::uuid,
                'f0000000-0000-4000-8000-000000000092'::uuid,
                4
            ),
            (
                'f0000000-0000-4000-8000-000000000137'::uuid,
                'f0000000-0000-4000-8000-000000000093'::uuid,
                4
            ),
            (
                'f0000000-0000-4000-8000-000000000137'::uuid,
                'f0000000-0000-4000-8000-000000000094'::uuid,
                5
            ),
            (
                'f0000000-0000-4000-8000-000000000137'::uuid,
                'f0000000-0000-4000-8000-000000000096'::uuid,
                3
            )
    ) AS r (id_evaluacion, id_pregunta, valor)
    JOIN PREGUNTAS_EVALUACION p ON p.id_pregunta = r.id_pregunta
    JOIN NIVELES_ESCALA n ON n.id_escala = p.id_escala
    AND n.valor = r.valor ON CONFLICT DO NOTHING;
INSERT INTO COMPETENCIAS (
        id_competencia,
        id_tipo_competencia,
        nombre,
        descripcion
    )
VALUES (
        'f0000000-0000-4000-8000-000000000104',
        2,
        'Cumplimiento de metas',
        'Logro de los objetivos operativos asignados al puesto'
    ) ON CONFLICT DO NOTHING;
INSERT INTO PLANTILLAS_EVALUACION (
        id_plantilla,
        id_departamento_destino,
        id_empleado_creador,
        nombre,
        objetivo,
        vigencia_desde,
        vigencia_hasta
    )
VALUES (
        'f0000000-0000-4000-8000-000000000052',
        'f0000000-0000-4000-8000-000000000002',
        'f0000000-0000-4000-8000-000000000023'::uuid,
        'Evaluación de personal administrativo',
        'Medir el trabajo en equipo y el cumplimiento de metas del personal administrativo.',
        '2027-01-01',
        '2027-12-31'
    ),
    (
        'f0000000-0000-4000-8000-000000000053',
        'f0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000023'::uuid,
        'Evaluación de personal de tienda',
        'Medir la atención al cliente del personal de tienda durante la gestión 2027.',
        '2027-01-01',
        '2027-12-31'
    ) ON CONFLICT DO NOTHING;
INSERT INTO VERSIONES_PLANTILLA (
        id_version,
        id_plantilla,
        id_estado_version,
        numero_version
    )
VALUES (
        'f0000000-0000-4000-8000-000000000062',
        'f0000000-0000-4000-8000-000000000052',
        1,
        1
    ),
    (
        'f0000000-0000-4000-8000-000000000063',
        'f0000000-0000-4000-8000-000000000053',
        1,
        1
    ) ON CONFLICT DO NOTHING;
INSERT INTO SECCIONES_PLANTILLA (id_seccion, id_version, id_competencia, orden)
VALUES (
        'f0000000-0000-4000-8000-000000000074',
        'f0000000-0000-4000-8000-000000000062',
        'f0000000-0000-4000-8000-000000000102',
        1
    ),
    (
        'f0000000-0000-4000-8000-000000000075',
        'f0000000-0000-4000-8000-000000000062',
        'f0000000-0000-4000-8000-000000000103',
        2
    ),
    (
        'f0000000-0000-4000-8000-000000000076',
        'f0000000-0000-4000-8000-000000000062',
        'f0000000-0000-4000-8000-000000000104',
        3
    ) ON CONFLICT DO NOTHING;
-- KAN-26: compromisos de desarrollo de la evaluación enviada 125 (ids fijos para no duplicar al repetir).
INSERT INTO COMPROMISOS_DESARROLLO (id_compromiso, id_evaluacion, descripcion, fecha_objetivo)
VALUES (
        'f0000000-0000-4000-8000-000000000131',
        'f0000000-0000-4000-8000-000000000125',
        'Completar el curso interno de manejo de reclamos complejos.',
        '2026-09-30'
    ),
    (
        'f0000000-0000-4000-8000-000000000132',
        'f0000000-0000-4000-8000-000000000125',
        'Acompañar a un compañero nuevo durante su primer mes en tienda.',
        '2026-12-15'
    ) ON CONFLICT DO NOTHING;
-- Consulta de evaluaciones individuales: historial del evaluado 1 en dos periodos.
--   Periodo 2025-S2, ciclo cerrado 118: 138 ENVIADA (72.22).
--   Ciclo 2026-S1 (cerrado): además de la 125 (87.78), la 139 de un segundo evaluador (85.00).
--   Consolidado 2026-S1 = (87.78 + 85.00) / 2 = 86.39, variación +14.17 respecto de 2025-S2.
INSERT INTO PERIODOS_EVALUACION (id_periodo, nombre, fecha_inicio, fecha_fin)
VALUES (
        'f0000000-0000-4000-8000-000000000043',
        '2025-S2',
        '2025-07-01',
        '2025-12-31'
    ) ON CONFLICT DO NOTHING;
INSERT INTO CICLOS_EVALUACION (
        id_ciclo,
        id_version,
        id_periodo,
        id_estado_ciclo,
        id_empleado_creador,
        nombre,
        fecha_inicio,
        fecha_limite,
        cerrado_en
    )
VALUES (
        'f0000000-0000-4000-8000-000000000118',
        'f0000000-0000-4000-8000-000000000061',
        'f0000000-0000-4000-8000-000000000043',
        3,
        'f0000000-0000-4000-8000-000000000023'::uuid,
        'Evaluación de desempeño 2025-S2',
        '2025-12-01',
        '2025-12-20',
        '2025-12-22 08:00:00-04'
    ) ON CONFLICT DO NOTHING;
INSERT INTO EVALUACIONES (
        id_evaluacion,
        id_ciclo,
        id_empleado_evaluado,
        id_empleado_evaluador,
        id_departamento,
        id_sucursal,
        id_estado_evaluacion,
        puntaje_final,
        fortalezas,
        aspectos_mejora,
        comentarios_generales,
        enviada_en
    )
VALUES (
        'f0000000-0000-4000-8000-000000000138',
        'f0000000-0000-4000-8000-000000000118',
        'f0000000-0000-4000-8000-000000000031'::uuid,
        'f0000000-0000-4000-8000-000000000021'::uuid,
        'f0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000011',
        3,
        72.22,
        'Buena disposición para aprender.',
        'Puntualidad y resolución de reclamos.',
        'Primer semestre en tienda: base sólida para crecer.',
        '2025-12-18 10:00:00-04'
    ),
    (
        'f0000000-0000-4000-8000-000000000139',
        'f0000000-0000-4000-8000-000000000112',
        'f0000000-0000-4000-8000-000000000031'::uuid,
        'f0000000-0000-4000-8000-000000000022'::uuid,
        'f0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000011',
        3,
        85.00,
        'Colabora con el equipo en horas de alta demanda.',
        NULL,
        'Desempeño consistente durante el semestre.',
        '2026-07-01 17:00:00-04'
    ) ON CONFLICT DO NOTHING;
-- 138: (20·80 + 15·60 + 15·60 + 20·80 + 20·75) / 90 = 72.22. 139: (20·80 + 15·80 + 15·60 + 20·100 + 10·80 + 20·100) / 100 = 85.00.
INSERT INTO RESPUESTAS_EVALUACION (id_evaluacion, id_pregunta, id_nivel)
SELECT r.id_evaluacion,
    r.id_pregunta,
    n.id_nivel
FROM (
        VALUES ('f0000000-0000-4000-8000-000000000138'::uuid, 'f0000000-0000-4000-8000-000000000091'::uuid, 4),
            ('f0000000-0000-4000-8000-000000000138'::uuid, 'f0000000-0000-4000-8000-000000000092'::uuid, 3),
            ('f0000000-0000-4000-8000-000000000138'::uuid, 'f0000000-0000-4000-8000-000000000093'::uuid, 3),
            ('f0000000-0000-4000-8000-000000000138'::uuid, 'f0000000-0000-4000-8000-000000000094'::uuid, 4),
            ('f0000000-0000-4000-8000-000000000138'::uuid, 'f0000000-0000-4000-8000-000000000096'::uuid, 3),
            ('f0000000-0000-4000-8000-000000000139'::uuid, 'f0000000-0000-4000-8000-000000000091'::uuid, 4),
            ('f0000000-0000-4000-8000-000000000139'::uuid, 'f0000000-0000-4000-8000-000000000092'::uuid, 4),
            ('f0000000-0000-4000-8000-000000000139'::uuid, 'f0000000-0000-4000-8000-000000000093'::uuid, 3),
            ('f0000000-0000-4000-8000-000000000139'::uuid, 'f0000000-0000-4000-8000-000000000094'::uuid, 5),
            ('f0000000-0000-4000-8000-000000000139'::uuid, 'f0000000-0000-4000-8000-000000000095'::uuid, 4),
            ('f0000000-0000-4000-8000-000000000139'::uuid, 'f0000000-0000-4000-8000-000000000096'::uuid, 4)
    ) AS r (id_evaluacion, id_pregunta, valor)
    JOIN PREGUNTAS_EVALUACION p ON p.id_pregunta = r.id_pregunta
    JOIN NIVELES_ESCALA n ON n.id_escala = p.id_escala
    AND n.valor = r.valor ON CONFLICT DO NOTHING;
-- KAN-27: ciclo cerrado con evaluaciones de las dos áreas y sucursales para probar el consolidado, la comparativa y las brechas.
INSERT INTO EMPLEADOS (id_empleado, nombres, apellidos)
VALUES ('f0000000-0000-4000-8000-000000000024'::uuid, 'Rosa', 'Mendoza Ticona'),
    ('f0000000-0000-4000-8000-000000000025'::uuid, 'Luis', 'Vargas Apaza'),
    ('f0000000-0000-4000-8000-000000000026'::uuid, 'Sofía', 'Condori Mamani'),
    ('f0000000-0000-4000-8000-000000000035'::uuid, 'Ana', 'Torrez Villca'),
    ('f0000000-0000-4000-8000-000000000036'::uuid, 'Mario', 'Fernández Cruz') ON CONFLICT DO NOTHING;
INSERT INTO PERIODOS_EVALUACION (id_periodo, nombre, fecha_inicio, fecha_fin)
VALUES ('f0000000-0000-4000-8000-000000000044', '2026-T3', '2026-07-01', '2026-09-30') ON CONFLICT DO NOTHING;
INSERT INTO CICLOS_EVALUACION (
        id_ciclo, id_version, id_periodo, id_estado_ciclo, id_empleado_creador, nombre, fecha_inicio, fecha_limite, umbral_brecha, cerrado_en
    )
VALUES ('f0000000-0000-4000-8000-000000000119', 'f0000000-0000-4000-8000-000000000061', 'f0000000-0000-4000-8000-000000000044', 3, 'f0000000-0000-4000-8000-000000000023'::uuid, 'Evaluación trimestral 2026-T3', '2026-09-28', '2026-10-10', 60.00, '2026-10-12 08:00:00-04') ON CONFLICT DO NOTHING;
INSERT INTO EVALUACIONES (
        id_evaluacion, id_ciclo, id_empleado_evaluado, id_empleado_evaluador, id_departamento, id_sucursal, id_estado_evaluacion, puntaje_final, enviada_en
    )
VALUES
    ('f0000000-0000-4000-8000-000000000140', 'f0000000-0000-4000-8000-000000000119', 'f0000000-0000-4000-8000-000000000031'::uuid, 'f0000000-0000-4000-8000-000000000024'::uuid, 'f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000011', 3, 92.00, '2026-10-05 10:00:00-04'),
    ('f0000000-0000-4000-8000-000000000141', 'f0000000-0000-4000-8000-000000000119', 'f0000000-0000-4000-8000-000000000032'::uuid, 'f0000000-0000-4000-8000-000000000024'::uuid, 'f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000011', 3, 78.89, '2026-10-05 11:00:00-04'),
    ('f0000000-0000-4000-8000-000000000142', 'f0000000-0000-4000-8000-000000000119', 'f0000000-0000-4000-8000-000000000033'::uuid, 'f0000000-0000-4000-8000-000000000025'::uuid, 'f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000012', 3, 53.00, '2026-10-06 09:30:00-04'),
    ('f0000000-0000-4000-8000-000000000143', 'f0000000-0000-4000-8000-000000000119', 'f0000000-0000-4000-8000-000000000035'::uuid, 'f0000000-0000-4000-8000-000000000025'::uuid, 'f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000012', 3, 55.00, '2026-10-06 10:30:00-04'),
    ('f0000000-0000-4000-8000-000000000144', 'f0000000-0000-4000-8000-000000000119', 'f0000000-0000-4000-8000-000000000034'::uuid, 'f0000000-0000-4000-8000-000000000022'::uuid, 'f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000012', 3, 67.00, '2026-10-07 15:00:00-04'),
    ('f0000000-0000-4000-8000-000000000145', 'f0000000-0000-4000-8000-000000000119', 'f0000000-0000-4000-8000-000000000036'::uuid, 'f0000000-0000-4000-8000-000000000021'::uuid, 'f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000011', 3, 97.00, '2026-10-07 16:00:00-04'),
    ('f0000000-0000-4000-8000-000000000146', 'f0000000-0000-4000-8000-000000000119', 'f0000000-0000-4000-8000-000000000024'::uuid, 'f0000000-0000-4000-8000-000000000021'::uuid, 'f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000011', 3, 79.00, '2026-10-08 09:00:00-04'),
    ('f0000000-0000-4000-8000-000000000147', 'f0000000-0000-4000-8000-000000000119', 'f0000000-0000-4000-8000-000000000026'::uuid, 'f0000000-0000-4000-8000-000000000023'::uuid, 'f0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000011', 3, 50.00, '2026-10-08 10:00:00-04'),
    ('f0000000-0000-4000-8000-000000000148', 'f0000000-0000-4000-8000-000000000119', 'f0000000-0000-4000-8000-000000000025'::uuid, 'f0000000-0000-4000-8000-000000000022'::uuid, 'f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000012', 4, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO RESPUESTAS_EVALUACION (id_evaluacion, id_pregunta, id_nivel)
SELECT r.id_evaluacion, r.id_pregunta, n.id_nivel
FROM (
        VALUES
            ('f0000000-0000-4000-8000-000000000140'::uuid, 'f0000000-0000-4000-8000-000000000091'::uuid, 5),
            ('f0000000-0000-4000-8000-000000000140'::uuid, 'f0000000-0000-4000-8000-000000000092'::uuid, 4),
            ('f0000000-0000-4000-8000-000000000140'::uuid, 'f0000000-0000-4000-8000-000000000093'::uuid, 4),
            ('f0000000-0000-4000-8000-000000000140'::uuid, 'f0000000-0000-4000-8000-000000000094'::uuid, 5),
            ('f0000000-0000-4000-8000-000000000140'::uuid, 'f0000000-0000-4000-8000-000000000095'::uuid, 4),
            ('f0000000-0000-4000-8000-000000000140'::uuid, 'f0000000-0000-4000-8000-000000000096'::uuid, 4),
            ('f0000000-0000-4000-8000-000000000141'::uuid, 'f0000000-0000-4000-8000-000000000091'::uuid, 4),
            ('f0000000-0000-4000-8000-000000000141'::uuid, 'f0000000-0000-4000-8000-000000000092'::uuid, 4),
            ('f0000000-0000-4000-8000-000000000141'::uuid, 'f0000000-0000-4000-8000-000000000093'::uuid, 4),
            ('f0000000-0000-4000-8000-000000000141'::uuid, 'f0000000-0000-4000-8000-000000000094'::uuid, 4),
            ('f0000000-0000-4000-8000-000000000141'::uuid, 'f0000000-0000-4000-8000-000000000096'::uuid, 3),
            ('f0000000-0000-4000-8000-000000000142'::uuid, 'f0000000-0000-4000-8000-000000000091'::uuid, 3),
            ('f0000000-0000-4000-8000-000000000142'::uuid, 'f0000000-0000-4000-8000-000000000092'::uuid, 2),
            ('f0000000-0000-4000-8000-000000000142'::uuid, 'f0000000-0000-4000-8000-000000000093'::uuid, 3),
            ('f0000000-0000-4000-8000-000000000142'::uuid, 'f0000000-0000-4000-8000-000000000094'::uuid, 3),
            ('f0000000-0000-4000-8000-000000000142'::uuid, 'f0000000-0000-4000-8000-000000000095'::uuid, 2),
            ('f0000000-0000-4000-8000-000000000142'::uuid, 'f0000000-0000-4000-8000-000000000096'::uuid, 2),
            ('f0000000-0000-4000-8000-000000000143'::uuid, 'f0000000-0000-4000-8000-000000000091'::uuid, 3),
            ('f0000000-0000-4000-8000-000000000143'::uuid, 'f0000000-0000-4000-8000-000000000092'::uuid, 3),
            ('f0000000-0000-4000-8000-000000000143'::uuid, 'f0000000-0000-4000-8000-000000000093'::uuid, 2),
            ('f0000000-0000-4000-8000-000000000143'::uuid, 'f0000000-0000-4000-8000-000000000094'::uuid, 3),
            ('f0000000-0000-4000-8000-000000000143'::uuid, 'f0000000-0000-4000-8000-000000000095'::uuid, 3),
            ('f0000000-0000-4000-8000-000000000143'::uuid, 'f0000000-0000-4000-8000-000000000096'::uuid, 2),
            ('f0000000-0000-4000-8000-000000000144'::uuid, 'f0000000-0000-4000-8000-000000000091'::uuid, 4),
            ('f0000000-0000-4000-8000-000000000144'::uuid, 'f0000000-0000-4000-8000-000000000092'::uuid, 3),
            ('f0000000-0000-4000-8000-000000000144'::uuid, 'f0000000-0000-4000-8000-000000000093'::uuid, 3),
            ('f0000000-0000-4000-8000-000000000144'::uuid, 'f0000000-0000-4000-8000-000000000094'::uuid, 3),
            ('f0000000-0000-4000-8000-000000000144'::uuid, 'f0000000-0000-4000-8000-000000000095'::uuid, 3),
            ('f0000000-0000-4000-8000-000000000144'::uuid, 'f0000000-0000-4000-8000-000000000096'::uuid, 3),
            ('f0000000-0000-4000-8000-000000000145'::uuid, 'f0000000-0000-4000-8000-000000000091'::uuid, 5),
            ('f0000000-0000-4000-8000-000000000145'::uuid, 'f0000000-0000-4000-8000-000000000092'::uuid, 5),
            ('f0000000-0000-4000-8000-000000000145'::uuid, 'f0000000-0000-4000-8000-000000000093'::uuid, 4),
            ('f0000000-0000-4000-8000-000000000145'::uuid, 'f0000000-0000-4000-8000-000000000094'::uuid, 5),
            ('f0000000-0000-4000-8000-000000000145'::uuid, 'f0000000-0000-4000-8000-000000000095'::uuid, 5),
            ('f0000000-0000-4000-8000-000000000145'::uuid, 'f0000000-0000-4000-8000-000000000096'::uuid, 4),
            ('f0000000-0000-4000-8000-000000000146'::uuid, 'f0000000-0000-4000-8000-000000000091'::uuid, 4),
            ('f0000000-0000-4000-8000-000000000146'::uuid, 'f0000000-0000-4000-8000-000000000092'::uuid, 4),
            ('f0000000-0000-4000-8000-000000000146'::uuid, 'f0000000-0000-4000-8000-000000000093'::uuid, 4),
            ('f0000000-0000-4000-8000-000000000146'::uuid, 'f0000000-0000-4000-8000-000000000094'::uuid, 4),
            ('f0000000-0000-4000-8000-000000000146'::uuid, 'f0000000-0000-4000-8000-000000000095'::uuid, 4),
            ('f0000000-0000-4000-8000-000000000146'::uuid, 'f0000000-0000-4000-8000-000000000096'::uuid, 3),
            ('f0000000-0000-4000-8000-000000000147'::uuid, 'f0000000-0000-4000-8000-000000000091'::uuid, 3),
            ('f0000000-0000-4000-8000-000000000147'::uuid, 'f0000000-0000-4000-8000-000000000092'::uuid, 2),
            ('f0000000-0000-4000-8000-000000000147'::uuid, 'f0000000-0000-4000-8000-000000000093'::uuid, 2),
            ('f0000000-0000-4000-8000-000000000147'::uuid, 'f0000000-0000-4000-8000-000000000094'::uuid, 3),
            ('f0000000-0000-4000-8000-000000000147'::uuid, 'f0000000-0000-4000-8000-000000000095'::uuid, 2),
            ('f0000000-0000-4000-8000-000000000147'::uuid, 'f0000000-0000-4000-8000-000000000096'::uuid, 2)
    ) AS r (id_evaluacion, id_pregunta, valor)
    JOIN PREGUNTAS_EVALUACION p ON p.id_pregunta = r.id_pregunta
    JOIN NIVELES_ESCALA n ON n.id_escala = p.id_escala
    AND n.valor = r.valor ON CONFLICT DO NOTHING;
-- Respuesta del CRM ya recibida y procesada (formato de la respuesta simulada) y un mensaje que agotó sus reintentos (DLQ).
INSERT INTO MENSAJES_ENTRANTES (
        id_mensaje, id_modulo_origen, id_estado_mensaje, id_mensaje_externo, tipo_evento, carga, intentos, ultimo_error, recibido_en, procesado_en
    )
VALUES (
        'f0000000-0000-4000-8000-000000000151', 1, 2, 'c3b1f6a2-5d0e-4c11-9a52-7e8f0b1d2a01', 'METRICAS_DESEMPENO_CRM',
        '{"encabezado":{"id_mensaje":"c3b1f6a2-5d0e-4c11-9a52-7e8f0b1d2a01","origen":{"grupo":"B","modulo":"CRM"},"destino":{"grupo":"F","modulo":"RRHH"},"tipo":"METRICAS_DESEMPENO_CRM","fecha":"2026-10-12T12:05:00.000Z","version_esquema":1},"datos":{"id_ciclo":"f0000000-0000-4000-8000-000000000119","periodo":{"nombre":"2026-T3","fecha_inicio":"2026-07-01","fecha_fin":"2026-09-30"},"metricas":[{"id_empleado":"f0000000-0000-4000-8000-000000000031","cantidad_quejas":6,"cantidad_felicitaciones":0,"minutos_resolucion_promedio":14.5},{"id_empleado":"f0000000-0000-4000-8000-000000000032","cantidad_quejas":2,"cantidad_felicitaciones":4,"minutos_resolucion_promedio":22},{"id_empleado":"f0000000-0000-4000-8000-000000000033","cantidad_quejas":9,"cantidad_felicitaciones":1,"minutos_resolucion_promedio":48.5},{"id_empleado":"f0000000-0000-4000-8000-000000000035","cantidad_quejas":7,"cantidad_felicitaciones":2,"minutos_resolucion_promedio":41},{"id_empleado":"f0000000-0000-4000-8000-000000000034","cantidad_quejas":3,"cantidad_felicitaciones":5,"minutos_resolucion_promedio":19},{"id_empleado":"f0000000-0000-4000-8000-000000000036","cantidad_quejas":0,"cantidad_felicitaciones":8,"minutos_resolucion_promedio":null}]}}',
        1, NULL, '2026-10-12 08:05:00-04', '2026-10-12 08:05:01-04'
    ),
    (
        'f0000000-0000-4000-8000-000000000152', 1, 3, 'c3b1f6a2-5d0e-4c11-9a52-7e8f0b1d2a02', 'METRICAS_DESEMPENO_CRM',
        '{"encabezado":{"id_mensaje":"c3b1f6a2-5d0e-4c11-9a52-7e8f0b1d2a02","tipo":"METRICAS_DESEMPENO_CRM","datos":',
        5, 'El mensaje no es un JSON válido', '2026-10-13 09:00:00-04', NULL
    ) ON CONFLICT DO NOTHING;
-- Quejas, felicitaciones y minutos promedio de resolución solo de los cajeros y asesores del ciclo (el CRM no mide a los demás).
INSERT INTO METRICAS_CRM (id_ciclo, id_empleado, id_mensaje, cantidad_quejas, cantidad_felicitaciones, minutos_resolucion_promedio)
VALUES
    ('f0000000-0000-4000-8000-000000000119', 'f0000000-0000-4000-8000-000000000031'::uuid, 'f0000000-0000-4000-8000-000000000151', 6, 0, 14.50),
    ('f0000000-0000-4000-8000-000000000119', 'f0000000-0000-4000-8000-000000000032'::uuid, 'f0000000-0000-4000-8000-000000000151', 2, 4, 22.00),
    ('f0000000-0000-4000-8000-000000000119', 'f0000000-0000-4000-8000-000000000033'::uuid, 'f0000000-0000-4000-8000-000000000151', 9, 1, 48.50),
    ('f0000000-0000-4000-8000-000000000119', 'f0000000-0000-4000-8000-000000000035'::uuid, 'f0000000-0000-4000-8000-000000000151', 7, 2, 41.00),
    ('f0000000-0000-4000-8000-000000000119', 'f0000000-0000-4000-8000-000000000034'::uuid, 'f0000000-0000-4000-8000-000000000151', 3, 5, 19.00),
    ('f0000000-0000-4000-8000-000000000119', 'f0000000-0000-4000-8000-000000000036'::uuid, 'f0000000-0000-4000-8000-000000000151', 0, 8, NULL)
 ON CONFLICT DO NOTHING;
COMMIT;
