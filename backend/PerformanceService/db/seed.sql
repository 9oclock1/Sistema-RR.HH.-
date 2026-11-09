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
COMMIT;