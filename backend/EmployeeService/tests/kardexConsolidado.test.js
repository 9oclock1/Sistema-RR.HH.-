jest.mock('../db/pool', () => require('./helpers/bdEnMemoria').crearBdEnMemoria());

const request = require('supertest');
const pool = require('../db/pool');
const app = require('../index');

const id = (n) => `e0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const ANA = id(1);
const LUIS = id(2);
const NUEVO = id(3);
const INEXISTENTE = id(999);

const DEPARTAMENTO = id(10);
const CAJERO = id(20);
const REPONEDOR = id(21);
const SUPERVISOR = id(22);
const SOPOCACHI = id(30);
const MIRAFLORES = id(31);

const SEMILLA = `
INSERT INTO departamentos (id_departamento, codigo, nombre) VALUES ('${DEPARTAMENTO}', 'OPS', 'Operaciones de tienda');
INSERT INTO cargos (id_cargo, id_departamento, codigo, nombre, nivel_salarial, salario_base_referencial, funciones_clave, requisitos_minimos) VALUES
  ('${CAJERO}', '${DEPARTAMENTO}', 'CAJ', 'Cajero', 'Operativo Base', 3000, 'Cobro', 'Bachiller'),
  ('${REPONEDOR}', '${DEPARTAMENTO}', 'REP', 'Reponedor', 'Operativo Base', 3000, 'Reposición', 'Bachiller'),
  ('${SUPERVISOR}', '${DEPARTAMENTO}', 'SUP', 'Supervisor de sucursal', 'Supervisión de Área', 6000, 'Supervisión', 'Licenciatura');
INSERT INTO sucursales (id_sucursal, codigo_sucursal, nombre, direccion) VALUES
  ('${SOPOCACHI}', 'SOP', 'Sucursal Sopocachi', 'Av. 6 de Agosto'),
  ('${MIRAFLORES}', 'MIR', 'Sucursal Miraflores', 'Av. Busch');
INSERT INTO estados_empleado VALUES (1, 'ACTIVO', 'Activo', TRUE);

INSERT INTO empleados (id_empleado, numero_documento, complemento_documento, nombres, primer_apellido, segundo_apellido,
                       fecha_nacimiento, genero, telefono_celular, correo_personal, direccion_domicilio, fecha_ingreso,
                       id_cargo_actual, id_sucursal_actual, id_estado_empleado) VALUES
  ('${ANA}', '7894561', '1A', 'Ana María', 'Peñaranda', 'Núñez', '1990-03-14', 'Femenino', '71234567', 'ana@correo.com',
   'Av. 6 de Agosto N.º 2548', CURRENT_DATE - INTERVAL '3 years 2 months', '${SUPERVISOR}', '${SOPOCACHI}', 1),
  ('${LUIS}', '4567890', NULL, 'Luis', 'Mamani', 'Flores', '1988-07-01', 'Masculino', '72345678', 'luis@correo.com',
   'Calle 21 de Calacoto', CURRENT_DATE - INTERVAL '5 years', '${CAJERO}', '${MIRAFLORES}', 1),
  ('${NUEVO}', '6123450', NULL, 'Rosa', 'Quispe', NULL, '1999-12-24', 'Femenino', '73456789', 'rosa@correo.com',
   'Zona Sur', CURRENT_DATE, '${CAJERO}', '${SOPOCACHI}', 1);

INSERT INTO asignaciones_empleado (id_asignacion, id_empleado, id_cargo, id_sucursal, fecha_inicio, fecha_fin, es_vigente) VALUES
  ('${id(104)}', '${ANA}', '${SUPERVISOR}', '${SOPOCACHI}', (CURRENT_DATE - INTERVAL '6 months')::date, NULL, TRUE),
  ('${id(102)}', '${ANA}', '${CAJERO}', '${MIRAFLORES}', (CURRENT_DATE - INTERVAL '2 years')::date, (CURRENT_DATE - INTERVAL '1 year')::date, FALSE),
  ('${id(101)}', '${ANA}', '${CAJERO}', '${SOPOCACHI}', (CURRENT_DATE - INTERVAL '3 years 2 months')::date, (CURRENT_DATE - INTERVAL '2 years')::date, FALSE),
  ('${id(103)}', '${ANA}', '${REPONEDOR}', '${MIRAFLORES}', (CURRENT_DATE - INTERVAL '1 year')::date, (CURRENT_DATE - INTERVAL '6 months')::date, FALSE),
  ('${id(105)}', '${LUIS}', '${CAJERO}', '${MIRAFLORES}', (CURRENT_DATE - INTERVAL '5 years')::date, NULL, TRUE);

INSERT INTO tipos_contrato VALUES (1, 'INDEFINIDO', 'Indefinido'), (2, 'PLAZO_FIJO', 'Plazo fijo');
INSERT INTO tipos_jornada VALUES (1, 'COMPLETA', 'Jornada completa', 48);
INSERT INTO contratos (id_contrato, id_empleado, id_tipo_contrato, id_tipo_jornada, numero_contrato, periodo_vigencia,
                       haber_mensual_pactado, es_adenda, motivo_adenda, registrado_en) VALUES
  ('${id(201)}', '${ANA}', 2, 1, 'CT-0001',
   daterange((CURRENT_DATE - INTERVAL '3 years 2 months')::date, (CURRENT_DATE - INTERVAL '2 years')::date, '[]'),
   3000, FALSE, NULL, now() - INTERVAL '3 years'),
  ('${id(202)}', '${ANA}', 1, 1, 'CT-0002', daterange((CURRENT_DATE - INTERVAL '2 years')::date + 1, NULL),
   3500, FALSE, NULL, now() - INTERVAL '2 years'),
  ('${id(203)}', '${ANA}', 1, 1, 'CT-0002-A1', daterange((CURRENT_DATE - INTERVAL '6 months')::date, NULL),
   6000, TRUE, 'Ascenso a supervisor', now() - INTERVAL '6 months'),
  ('${id(204)}', '${ANA}', 1, 1, 'CT-0002-A2', daterange((CURRENT_DATE + INTERVAL '1 month')::date, NULL),
   6500, TRUE, 'Ajuste salarial programado', now()),
  ('${id(205)}', '${LUIS}', 1, 1, 'CT-0003', daterange((CURRENT_DATE - INTERVAL '5 years')::date, NULL),
   3200, FALSE, NULL, now() - INTERVAL '5 years');

INSERT INTO tipos_memorandum VALUES
  (1, 'DISCIPLINARIO', 'Llamada de atención', 'Falta operativa o de conducta'),
  (2, 'RECONOCIMIENTO', 'Felicitación', 'Mérito laboral');
INSERT INTO memorandums (id_memorandum, id_empleado_receptor, id_tipo_memo, id_empleado_emisor, codigo_cite, asunto,
                         contenido_descripcion, fecha_emision, gestion, numero_correlativo, naturaleza_falta, gravedad_falta,
                         estado_sancion, evidencia_adjunto_url, documento_pdf_url, fue_notificado, fecha_hora_notificacion,
                         acuse_recibo_firmado, fecha_hora_acuse, motivo_anulacion, fecha_hora_anulacion) VALUES
  ('${id(301)}', '${ANA}', 1, '${LUIS}', 'MEM-2026-0001', 'Atrasos reiterados', 'Detalle', '2026-03-01', 2026, 1,
   'CONDUCTA', 'GRAVE', 'BORRADOR', 'uploads/evidencia/marcajes.pdf', 'uploads/memorandums_pdf/MEM-2026-0001.pdf',
   FALSE, NULL, FALSE, NULL, NULL, NULL),
  ('${id(302)}', '${ANA}', 2, '${LUIS}', 'MEM-2026-0002', 'Puntualidad ejemplar', 'Detalle', '2026-05-01', 2026, 2,
   NULL, NULL, 'EMITIDO', NULL, 'uploads/reconocimientos_pdf/MEM-2026-0002.pdf',
   TRUE, '2026-05-02 10:00-04', TRUE, '2026-05-03 16:40-04', NULL, NULL),
  ('${id(303)}', '${ANA}', 1, '${LUIS}', 'MEM-2026-0003', 'Descuadre de caja', 'Detalle', '2026-08-11', 2026, 3,
   'OPERATIVA', 'LEVE', 'BORRADOR', NULL, NULL, TRUE, '2026-08-12 09:15-04', FALSE, NULL, NULL, NULL),
  ('${id(304)}', '${ANA}', 1, '${LUIS}', 'MEM-2026-0004', 'Registro erróneo', 'Detalle', '2026-09-01', 2026, 4,
   'OPERATIVA', 'MODERADA', 'ANULADO', NULL, NULL, FALSE, NULL, FALSE, NULL, 'Se registró por error', now()),
  ('${id(305)}', '${LUIS}', 1, '${ANA}', 'MEM-2026-0005', 'Uso indebido de caja', 'Detalle', '2026-09-15', 2026, 5,
   'CONDUCTA', 'GRAVE', 'BORRADOR', NULL, NULL, FALSE, NULL, FALSE, NULL, NULL, NULL);

INSERT INTO cursos_capacitacion (id_curso, codigo, nombre, horas_academicas) VALUES
  ('${id(401)}', 'BPM-01', 'Manipulación de alimentos', 20),
  ('${id(402)}', 'CAJ-02', 'Operación de caja', 10);
INSERT INTO capacitaciones_certificacion (id_capacitacion, id_empleado, id_curso, institucion_emisora, fecha_emision,
                                          fecha_vencimiento) VALUES
  ('${id(501)}', '${ANA}', '${id(401)}', 'SENASAG', '2024-01-10', CURRENT_DATE - 1),
  ('${id(502)}', '${ANA}', '${id(402)}', 'Capacitación interna', '2025-06-01', CURRENT_DATE),
  ('${id(503)}', '${ANA}', '${id(401)}', 'SENASAG', '2026-02-01', NULL),
  ('${id(504)}', '${LUIS}', '${id(401)}', 'SENASAG', '2023-01-10', CURRENT_DATE - 30);
`;

const kardex = (idEmpleado, rol = 'admin') => {
  const peticion = request(app).get(`/empleados/${idEmpleado}/kardex`);
  return rol === null ? peticion : peticion.set('X-Rol', rol);
};

const kardexDe = async (idEmpleado) => {
  const { status, body } = await kardex(idEmpleado);
  expect(status).toBe(200);
  return body;
};

const fechaRelativa = async (expresion) => {
  const { rows } = await pool.query(`SELECT (${expresion})::date AS fecha`);
  return rows[0].fecha;
};

beforeAll(() => pool.preparar(SEMILLA), 30000);

afterAll(() => pool.cerrar());

beforeEach(() => pool.reiniciarRegistro());

describe('GET /empleados/:id/kardex (KAN-267)', () => {
  describe('control de acceso por rol', () => {
    test.each(['admin', 'gerente'])('el rol %s consulta el Kardex completo', async (rol) => {
      const { status, body } = await kardex(ANA, rol);

      expect(status).toBe(200);
      expect(Object.keys(body)).toEqual([
        'id_empleado',
        'datos_personales',
        'resumen',
        'contratos',
        'trayectoria',
        'memorandums',
        'capacitaciones',
      ]);
    });

    test('reconoce el rol sin importar mayúsculas ni espacios', async () => {
      const { status } = await kardex(ANA, '  Gerente ');

      expect(status).toBe(200);
    });

    test.each(['supervisor', 'reclutador', 'empleado', 'root'])(
      'el rol %s recibe 403 y no se consulta la base de datos',
      async (rol) => {
        const { status, body } = await kardex(ANA, rol);

        expect(status).toBe(403);
        expect(body).toEqual({ error: 'Su rol no tiene permiso para consultar este recurso.' });
        expect(pool.consultas).toHaveLength(0);
      }
    );

    test('sin X-Rol responde 401 y no se consulta la base de datos', async () => {
      const { status, body } = await kardex(ANA, null);

      expect(status).toBe(401);
      expect(body).toEqual({ error: 'Identifíquese para continuar.' });
      expect(pool.consultas).toHaveLength(0);
    });

    test('un rol no autorizado recibe 403 antes de que se valide el id', async () => {
      const { status } = await kardex('no-es-un-uuid', 'empleado');

      expect(status).toBe(403);
    });
  });

  describe('validación de la petición', () => {
    test('un id que no es UUID responde 400', async () => {
      const { status, body } = await kardex('no-es-un-uuid');

      expect(status).toBe(400);
      expect(body.errores).toEqual([{ campo: 'id', mensaje: "El campo 'id' debe ser un UUID válido." }]);
    });

    test('un empleado inexistente responde 404', async () => {
      const { status, body } = await kardex(INEXISTENTE);

      expect(status).toBe(404);
      expect(body).toEqual({ error: 'El empleado solicitado no existe.' });
    });
  });

  describe('datos personales y posición actual', () => {
    test('los datos personales corresponden al empleado consultado', async () => {
      const { id_empleado, datos_personales } = await kardexDe(ANA);

      expect(id_empleado).toBe(ANA);
      expect(datos_personales).toEqual({
        numero_documento: '7894561',
        complemento_documento: '1A',
        nombres: 'Ana María',
        primer_apellido: 'Peñaranda',
        segundo_apellido: 'Núñez',
        nombre_completo: 'Ana María Peñaranda Núñez',
        fecha_nacimiento: '1990-03-14',
        genero: 'Femenino',
        telefono_celular: '71234567',
        correo_personal: 'ana@correo.com',
        direccion_domicilio: 'Av. 6 de Agosto N.º 2548',
        fecha_ingreso: await fechaRelativa("CURRENT_DATE - INTERVAL '3 years 2 months'"),
        estado: { codigo: 'ACTIVO', nombre: 'Activo' },
      });
    });

    test('la antigüedad se calcula desde la fecha de ingreso', async () => {
      const { resumen } = await kardexDe(ANA);

      expect(resumen.antiguedad).toEqual({ anios: 3, meses: 2 });
    });

    test('el cargo y la sucursal actuales coinciden con la asignación vigente de la trayectoria', async () => {
      const { resumen, trayectoria } = await kardexDe(ANA);
      const vigente = trayectoria.find((hito) => hito.es_vigente);

      expect(resumen.cargo_actual).toMatchObject({ id_cargo: SUPERVISOR, nombre: 'Supervisor de sucursal' });
      expect(resumen.area).toEqual({ id_departamento: DEPARTAMENTO, nombre: 'Operaciones de tienda' });
      expect(resumen.sucursal).toEqual({ id_sucursal: SOPOCACHI, nombre: 'Sucursal Sopocachi', ciudad: 'La Paz' });
      expect(vigente).toMatchObject({ id_cargo: resumen.cargo_actual.id_cargo, id_sucursal: resumen.sucursal.id_sucursal });
      expect(resumen.cargo_actual.vigente_desde).toBe(vigente.fecha_inicio);
    });
  });

  describe('integridad de contratos y adendas', () => {
    test('los totales del resumen coinciden con la lista de contratos', async () => {
      const { resumen, contratos } = await kardexDe(ANA);

      expect(resumen.totales.contratos).toBe(contratos.filter((c) => !c.es_adenda).length);
      expect(resumen.totales.adendas).toBe(contratos.filter((c) => c.es_adenda).length);
      expect(resumen.totales).toMatchObject({ contratos: 2, adendas: 2 });
    });

    test('el contrato vigente es el que cubre la fecha de hoy y empezó más tarde', async () => {
      const { resumen, contratos } = await kardexDe(ANA);

      expect(contratos.map(({ numero_contrato, esta_vigente }) => ({ numero_contrato, esta_vigente }))).toEqual([
        { numero_contrato: 'CT-0002-A2', esta_vigente: false },
        { numero_contrato: 'CT-0002-A1', esta_vigente: true },
        { numero_contrato: 'CT-0002', esta_vigente: true },
        { numero_contrato: 'CT-0001', esta_vigente: false },
      ]);
      expect(resumen.contrato_vigente).toEqual({
        id_contrato: id(203),
        numero_contrato: 'CT-0002-A1',
        tipo_contrato: 'Indefinido',
        tipo_jornada: 'Jornada completa',
        fecha_inicio: await fechaRelativa("CURRENT_DATE - INTERVAL '6 months'"),
        fecha_fin: null,
        haber_mensual_pactado: '6000.00',
      });
    });

    test('la fecha de fin de un contrato a plazo es su último día incluido', async () => {
      const { contratos } = await kardexDe(ANA);
      const plazoFijo = contratos.find((c) => c.numero_contrato === 'CT-0001');

      expect(plazoFijo.fecha_fin).toBe(await fechaRelativa("CURRENT_DATE - INTERVAL '2 years'"));
    });
  });

  describe('integridad del historial disciplinario', () => {
    test('el balance disciplinario coincide con la lista de memorándums', async () => {
      const { resumen, memorandums } = await kardexDe(ANA);
      const balance = resumen.balance_disciplinario;
      const sanciones = memorandums.filter((m) => !m.es_reconocimiento);

      expect(balance.total_sanciones).toBe(sanciones.length);
      expect(balance.total_reconocimientos).toBe(memorandums.filter((m) => m.es_reconocimiento).length);
      expect(balance.sanciones_graves + balance.sanciones_moderadas + balance.sanciones_leves).toBe(sanciones.length);
      expect(balance.memorandums_sin_acuse).toBe(memorandums.filter((m) => !m.acuse_recibo_firmado).length);
      expect(balance.fecha_ultima_sancion).toBe(sanciones.map((m) => m.fecha_emision).sort().at(-1));
      expect(balance).toEqual({
        total_sanciones: 2,
        sanciones_leves: 1,
        sanciones_moderadas: 0,
        sanciones_graves: 1,
        total_reconocimientos: 1,
        memorandums_sin_acuse: 2,
        fecha_ultima_sancion: '2026-08-11',
      });
    });

    test('los memorándums anulados no aparecen en la lista ni cuentan en el balance', async () => {
      const { memorandums } = await kardexDe(ANA);

      expect(memorandums.map((m) => m.codigo_cite)).toEqual(['MEM-2026-0003', 'MEM-2026-0002', 'MEM-2026-0001']);
    });

    test('los memorándums de otros empleados no se mezclan, aunque el consultado sea el emisor', async () => {
      const ana = await kardexDe(ANA);
      const luis = await kardexDe(LUIS);

      expect(ana.memorandums.map((m) => m.codigo_cite)).not.toContain('MEM-2026-0005');
      expect(luis.memorandums.map((m) => m.codigo_cite)).toEqual(['MEM-2026-0005']);
      expect(luis.resumen.balance_disciplinario).toMatchObject({ total_sanciones: 1, sanciones_graves: 1, total_reconocimientos: 0 });
    });

    test('cada memorándum muestra sus respaldos y su estado de confirmación', async () => {
      const { memorandums } = await kardexDe(ANA);
      const porCite = Object.fromEntries(memorandums.map((m) => [m.codigo_cite, m]));

      expect(porCite['MEM-2026-0001']).toMatchObject({
        evidencia_adjunto_url: 'uploads/evidencia/marcajes.pdf',
        documento_pdf_url: 'uploads/memorandums_pdf/MEM-2026-0001.pdf',
        fue_notificado: false,
        acuse_recibo_firmado: false,
        emisor_nombre: 'Luis Mamani Flores',
      });
      expect(porCite['MEM-2026-0003']).toMatchObject({ fue_notificado: true, acuse_recibo_firmado: false, fecha_hora_acuse: null });
      expect(porCite['MEM-2026-0002']).toMatchObject({ es_reconocimiento: true, fue_notificado: true, acuse_recibo_firmado: true });
      expect(new Date(porCite['MEM-2026-0002'].fecha_hora_acuse).toISOString()).toBe('2026-05-03T20:40:00.000Z');
    });
  });

  describe('integridad de capacitaciones', () => {
    test('las capacitaciones vencidas del resumen coinciden con la lista', async () => {
      const { resumen, capacitaciones } = await kardexDe(ANA);

      expect(resumen.totales.capacitaciones).toBe(capacitaciones.length);
      expect(resumen.totales.capacitaciones_vencidas).toBe(capacitaciones.filter((c) => !c.esta_vigente).length);
      expect(resumen.totales).toMatchObject({ capacitaciones: 3, capacitaciones_vencidas: 1 });
    });

    test('una certificación que vence hoy sigue vigente y una sin vencimiento nunca vence', async () => {
      const { capacitaciones } = await kardexDe(ANA);
      const porId = Object.fromEntries(capacitaciones.map((c) => [c.id_capacitacion, c.esta_vigente]));

      expect(porId).toEqual({ [id(501)]: false, [id(502)]: true, [id(503)]: true });
    });
  });

  describe('integridad de la trayectoria', () => {
    test('la trayectoria sale en orden cronológico aunque se haya registrado en otro orden', async () => {
      const { trayectoria } = await kardexDe(ANA);

      expect(trayectoria.map((hito) => hito.id_asignacion)).toEqual([id(101), id(102), id(103), id(104)]);
    });

    test('distingue el ingreso, el traslado, el cambio de cargo y el ascenso', async () => {
      const { trayectoria } = await kardexDe(ANA);

      expect(
        trayectoria.map(({ cargo, sucursal, cargo_anterior, sucursal_anterior, cambio_cargo, cambio_sucursal, es_ascenso }) => ({
          cargo,
          sucursal,
          cargo_anterior,
          sucursal_anterior,
          cambio_cargo,
          cambio_sucursal,
          es_ascenso,
        }))
      ).toEqual([
        { cargo: 'Cajero', sucursal: 'Sucursal Sopocachi', cargo_anterior: null, sucursal_anterior: null, cambio_cargo: false, cambio_sucursal: false, es_ascenso: false },
        { cargo: 'Cajero', sucursal: 'Sucursal Miraflores', cargo_anterior: 'Cajero', sucursal_anterior: 'Sucursal Sopocachi', cambio_cargo: false, cambio_sucursal: true, es_ascenso: false },
        { cargo: 'Reponedor', sucursal: 'Sucursal Miraflores', cargo_anterior: 'Cajero', sucursal_anterior: 'Sucursal Miraflores', cambio_cargo: true, cambio_sucursal: false, es_ascenso: false },
        { cargo: 'Supervisor de sucursal', sucursal: 'Sucursal Sopocachi', cargo_anterior: 'Reponedor', sucursal_anterior: 'Sucursal Miraflores', cambio_cargo: true, cambio_sucursal: true, es_ascenso: true },
      ]);
    });

    test('el total de asignaciones del resumen coincide con la trayectoria', async () => {
      const { resumen, trayectoria } = await kardexDe(ANA);

      expect(resumen.totales.asignaciones).toBe(trayectoria.length);
      expect(trayectoria.filter((hito) => hito.es_vigente)).toHaveLength(1);
    });
  });

  describe('colaborador sin historial', () => {
    test('devuelve totales en cero, listas vacías y ningún contrato vigente', async () => {
      const { resumen, contratos, trayectoria, memorandums, capacitaciones } = await kardexDe(NUEVO);

      expect(resumen.antiguedad).toEqual({ anios: 0, meses: 0 });
      expect(resumen.cargo_actual.vigente_desde).toBeNull();
      expect(resumen.contrato_vigente).toBeNull();
      expect(resumen.balance_disciplinario).toEqual({
        total_sanciones: 0,
        sanciones_leves: 0,
        sanciones_moderadas: 0,
        sanciones_graves: 0,
        total_reconocimientos: 0,
        memorandums_sin_acuse: 0,
        fecha_ultima_sancion: null,
      });
      expect(resumen.totales).toEqual({ contratos: 0, adendas: 0, asignaciones: 0, capacitaciones: 0, capacitaciones_vencidas: 0 });
      expect({ contratos, trayectoria, memorandums, capacitaciones }).toEqual({
        contratos: [],
        trayectoria: [],
        memorandums: [],
        capacitaciones: [],
      });
    });
  });

  describe('armado del Kardex', () => {
    test('lanza las cinco consultas a la vez y no consulta nada más', async () => {
      await kardexDe(ANA);

      expect(pool.consultas).toHaveLength(5);
      expect(pool.maximoEnCurso).toBe(5);
      expect(pool.consultas[0]).toMatch(/FROM vw_kardex_resumen WHERE id_empleado = \$1/);
    });
  });
});
