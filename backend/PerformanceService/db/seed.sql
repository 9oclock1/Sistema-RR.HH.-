-- Datos de prueba de PerformanceDB
-- Requiere que init.sql ya se haya ejecutado.
-- NO formatear con un formateador de SQL: los comandos de psql (\set, \if, \else, \endif) deben ir
-- cada uno en su propia línea y el formateador los une y rompe el archivo.
-- Uso (PowerShell):
--   Get-Content backend/PerformanceService/db/seed.sql | docker exec -i rrhh-postgres psql -U adminRRHH -d PerformanceDB
--
-- Para que la bandeja salga con TU usuario de prueba del portal, pasa su id_empleado (el de
-- EmployeeService) como evaluador. Las demás variables son opcionales:
--   ... psql -U adminRRHH -d PerformanceDB -v id_evaluador=<uuid> -v id_evaluado_1=<uuid> ...
-- Variables: id_evaluador, id_evaluador_2, id_creador, id_evaluado_1 .. id_evaluado_4.
-- Los nombres de los empleados son de demostración; el servicio los actualiza desde EmployeeService.
--
-- Qué queda cargado (el evaluador es id_evaluador salvo la evaluación 124):
--   Ciclo "Evaluación de desempeño 2026-S2" (activo)       -> 121 PENDIENTE, 122 BORRADOR (3 respuestas), 124 de otro evaluador
--   Ciclo "Evaluación de personal nuevo 2026" (activo)     -> 123 PENDIENTE, con una fecha límite más cercana
--   Ciclo "Evaluación de desempeño 2026-S1" (cerrado)      -> 125 ENVIADA (puntaje 87.78), 126 VENCIDA
-- La plantilla tiene 6 preguntas con pesos que suman 100; la pregunta 95 es opcional.
\set ON_ERROR_STOP on
\if :{?id_evaluador}
\else
  \set id_evaluador 'f0000000-0000-4000-8000-000000000021'
\endif
\if :{?id_evaluador_2}
\else
  \set id_evaluador_2 'f0000000-0000-4000-8000-000000000022'
\endif
\if :{?id_creador}
\else
  \set id_creador 'f0000000-0000-4000-8000-000000000023'
\endif
\if :{?id_evaluado_1}
\else
  \set id_evaluado_1 'f0000000-0000-4000-8000-000000000031'
\endif
\if :{?id_evaluado_2}
\else
  \set id_evaluado_2 'f0000000-0000-4000-8000-000000000032'
\endif
\if :{?id_evaluado_3}
\else
  \set id_evaluado_3 'f0000000-0000-4000-8000-000000000033'
\endif
\if :{?id_evaluado_4}
\else
  \set id_evaluado_4 'f0000000-0000-4000-8000-000000000034'
\endif
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
VALUES (:'id_evaluador'::uuid, 'Marcela', 'Quiroga Peña'),
    (
        :'id_evaluador_2'::uuid,
        'Jorge',
        'Mamani Condori'
    ),
    (:'id_creador'::uuid, 'Andrea', 'Salazar Vega'),
    (:'id_evaluado_1'::uuid, 'Carlos', 'Rojas Vargas'),
    (:'id_evaluado_2'::uuid, 'Lucía', 'Flores Choque'),
    (:'id_evaluado_3'::uuid, 'Diego', 'Quispe Mamani'),
    (
        :'id_evaluado_4'::uuid,
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
        :'id_creador'::uuid,
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
        :'id_creador'::uuid,
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
        :'id_creador'::uuid,
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
        :'id_creador'::uuid,
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
        :'id_creador'::uuid,
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
        :'id_evaluado_1'::uuid,
        :'id_evaluador'::uuid,
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
        :'id_evaluado_2'::uuid,
        :'id_evaluador'::uuid,
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
        :'id_evaluado_3'::uuid,
        :'id_evaluador'::uuid,
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
        :'id_evaluado_4'::uuid,
        :'id_evaluador_2'::uuid,
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
        :'id_evaluado_1'::uuid,
        :'id_evaluador'::uuid,
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
        :'id_evaluado_2'::uuid,
        :'id_evaluador'::uuid,
        'f0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000011',
        4,
        NULL,
        NULL,
        NULL,
        NULL,
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
            )
    ) AS r (id_evaluacion, id_pregunta, valor)
    JOIN PREGUNTAS_EVALUACION p ON p.id_pregunta = r.id_pregunta
    JOIN NIVELES_ESCALA n ON n.id_escala = p.id_escala
    AND n.valor = r.valor ON CONFLICT DO NOTHING;
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
COMMIT;