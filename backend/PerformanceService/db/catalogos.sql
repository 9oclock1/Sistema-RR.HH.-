BEGIN;
INSERT INTO CATALOGOS_ESTADO_VERSION (id_estado_version, codigo, nombre)
VALUES (1, 'BORRADOR', 'Borrador'),
    (2, 'PUBLICADA', 'Publicada'),
    (3, 'ARCHIVADA', 'Archivada')
ON CONFLICT DO NOTHING;
INSERT INTO CATALOGOS_TIPO_COMPETENCIA (id_tipo_competencia, codigo, nombre)
VALUES (1, 'COMPETENCIA_LABORAL', 'Competencia laboral'),
    (2, 'FACTOR_OPERATIVO', 'Factor operativo')
ON CONFLICT DO NOTHING;
INSERT INTO CATALOGOS_TIPO_ESCALA (id_tipo_escala, codigo, nombre)
VALUES (1, 'CUANTITATIVA', 'Cuantitativa'),
    (2, 'CUALITATIVA', 'Cualitativa')
ON CONFLICT DO NOTHING;
INSERT INTO CATALOGOS_ESTADO_CICLO (id_estado_ciclo, codigo, nombre)
VALUES (1, 'PROGRAMADO', 'Programado'),
    (2, 'ACTIVO', 'Activo'),
    (3, 'CERRADO', 'Cerrado')
ON CONFLICT DO NOTHING;
INSERT INTO CATALOGOS_ESTADO_EVALUACION (id_estado_evaluacion, codigo, nombre)
VALUES (1, 'PENDIENTE', 'Pendiente'),
    (2, 'BORRADOR', 'Borrador'),
    (3, 'ENVIADA', 'Enviada'),
    (4, 'VENCIDA', 'Vencida')
ON CONFLICT DO NOTHING;
INSERT INTO CATALOGOS_ESTADO_EVENTO (id_estado_evento, codigo, nombre)
VALUES (1, 'PENDIENTE', 'Pendiente'),
    (2, 'ENTREGADO', 'Entregado'),
    (3, 'FALLIDO', 'Fallido')
ON CONFLICT DO NOTHING;
INSERT INTO CATALOGOS_ESTADO_MENSAJE (id_estado_mensaje, codigo, nombre)
VALUES (1, 'RECIBIDO', 'Recibido'),
    (2, 'PROCESADO', 'Procesado'),
    (3, 'EN_DLQ', 'En cola de errores')
ON CONFLICT DO NOTHING;
INSERT INTO CATALOGOS_MODULO_EXTERNO (id_modulo_externo, codigo, nombre, grupo)
VALUES (1, 'CRM', 'CRM', 'B')
ON CONFLICT DO NOTHING;
INSERT INTO CATALOGOS_CATEGORIA_QUEJA (id_categoria_queja, codigo, nombre)
VALUES (1, 'CLIMA_LABORAL', 'Clima laboral'),
    (2, 'ACOSO', 'Acoso'),
    (3, 'CONDICIONES_TRABAJO', 'Condiciones de trabajo'),
    (4, 'OTRO', 'Otro')
ON CONFLICT DO NOTHING;
INSERT INTO CATALOGOS_ESTADO_QUEJA (id_estado_queja, codigo, nombre, es_final)
VALUES (1, 'REGISTRADA', 'Registrada', FALSE),
    (2, 'ASIGNADA', 'Asignada', FALSE),
    (3, 'EN_ATENCION', 'En atención', FALSE),
    (4, 'RESUELTA', 'Resuelta', TRUE),
    (5, 'DESESTIMADA', 'Desestimada', TRUE)
ON CONFLICT DO NOTHING;
INSERT INTO CATALOGOS_TIPO_ACCION_QUEJA (id_tipo_accion_queja, codigo, nombre)
VALUES (1, 'PREVENTIVA', 'Preventiva'),
    (2, 'CORRECTIVA', 'Correctiva')
ON CONFLICT DO NOTHING;
-- Escalas de partida: KAN-22 pide la etiqueta de cada nivel de la escala Likert de 1 a 5.
INSERT INTO ESCALAS_VALORACION (id_escala, id_tipo_escala, nombre, descripcion)
VALUES (
        '00000000-0000-4000-8000-000000000001',
        1,
        'Likert de 1 a 5',
        'Escala cuantitativa de cinco niveles'
    ),
    (
        '00000000-0000-4000-8000-000000000002',
        2,
        'Nivel de cumplimiento',
        'Escala cualitativa de cuatro niveles'
    )
ON CONFLICT DO NOTHING;
INSERT INTO NIVELES_ESCALA (id_escala, valor, etiqueta)
VALUES ('00000000-0000-4000-8000-000000000001', 1, 'Muy deficiente'),
    ('00000000-0000-4000-8000-000000000001', 2, 'Deficiente'),
    ('00000000-0000-4000-8000-000000000001', 3, 'Aceptable'),
    ('00000000-0000-4000-8000-000000000001', 4, 'Bueno'),
    ('00000000-0000-4000-8000-000000000001', 5, 'Excelente'),
    ('00000000-0000-4000-8000-000000000002', 1, 'No cumple'),
    ('00000000-0000-4000-8000-000000000002', 2, 'Cumple parcialmente'),
    ('00000000-0000-4000-8000-000000000002', 3, 'Cumple'),
    ('00000000-0000-4000-8000-000000000002', 4, 'Supera lo esperado')
ON CONFLICT DO NOTHING;
COMMIT;
