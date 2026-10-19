process.env.NOTIFICATION_SERVICE_URL = 'http://notificaciones.prueba';

jest.mock('../db/pool', () => require('./helpers/bdEnMemoria').crearBdEnMemoria());

const cron = require('node-cron');
const request = require('supertest');
const pool = require('../db/pool');
const app = require('../index');
const { revisarCertificacionesPorVencer, iniciarCronCertificaciones } = require('../src/jobs/certificacionesCron');

const id = (n) => `a1000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const RRHH = id(1);
const LUIS = id(2);
const ROSA = id(3);
const PEDRO_RETIRADO = id(4);
const CARNET = id(401);
const MONTACARGAS = id(402);
const VENCE_HOY = id(501);
const VENCE_EN_12 = id(502);
const VENCE_EN_30 = id(503);
const VENCE_EN_31 = id(504);
const DE_RETIRADO = id(505);
const VENCIDA = id(506);
const PENDIENTES = [VENCE_HOY, VENCE_EN_12, VENCE_EN_30];

const SEMILLA = `
INSERT INTO departamentos (id_departamento, codigo, nombre) VALUES ('${id(10)}', 'OPS', 'Operaciones');
INSERT INTO cargos (id_cargo, id_departamento, codigo, nombre, salario_base_referencial, funciones_clave, requisitos_minimos)
  VALUES ('${id(20)}', '${id(10)}', 'CAJ', 'Cajero', 3000, 'Cobro', 'Bachiller');
INSERT INTO sucursales (id_sucursal, codigo_sucursal, nombre, direccion) VALUES ('${id(30)}', 'SOP', 'Sopocachi', 'Av. 6 de Agosto');
INSERT INTO estados_empleado VALUES (1, 'ACTIVO', 'Activo', TRUE), (2, 'RETIRADO', 'Retirado', FALSE);
INSERT INTO empleados (id_empleado, numero_documento, nombres, primer_apellido, segundo_apellido, fecha_nacimiento, genero, telefono_celular,
                       correo_personal, direccion_domicilio, fecha_ingreso, id_cargo_actual, id_sucursal_actual, id_estado_empleado) VALUES
  ('${RRHH}', '1000001', 'Ana', 'Peñaranda', NULL, '1985-03-14', 'Femenino', '71234567', 'ana@correo.com', 'x', '2018-02-01', '${id(20)}', '${id(30)}', 1),
  ('${LUIS}', '1000002', 'Luis', 'Mamani', 'Flores', '1995-07-01', 'Masculino', '72345678', 'luis@correo.com', 'x', '2022-05-10', '${id(20)}', '${id(30)}', 1),
  ('${ROSA}', '1000003', 'Rosa', 'Quispe', NULL, '1999-12-24', 'Femenino', '73456789', 'rosa@correo.com', 'x', '2023-09-01', '${id(20)}', '${id(30)}', 1),
  ('${PEDRO_RETIRADO}', '1000004', 'Pedro', 'Condori', NULL, '1990-01-20', 'Masculino', '74567890', 'pedro@correo.com', 'x', '2020-01-15', '${id(20)}', '${id(30)}', 2);
INSERT INTO cursos_capacitacion (id_curso, codigo, nombre, horas_academicas, tipo_capacitacion, requiere_vencimiento, meses_vigencia) VALUES
  ('${CARNET}', 'BPM-01', 'Manipulación de alimentos', 20, 'CARNET_SANITARIO', TRUE, 12),
  ('${MONTACARGAS}', 'MON-01', 'Operación de montacargas', 40, 'CERTIFICACION', TRUE, NULL);
INSERT INTO capacitaciones_certificacion (id_capacitacion, id_empleado, id_curso, institucion_emisora, fecha_emision, fecha_vencimiento) VALUES
  ('${VENCE_HOY}', '${LUIS}', '${CARNET}', 'SEDES La Paz', '2025-01-01', CURRENT_DATE),
  ('${VENCE_EN_12}', '${ROSA}', '${MONTACARGAS}', 'INFOCAL', '2025-01-02', CURRENT_DATE + 12),
  ('${VENCE_EN_30}', '${LUIS}', '${MONTACARGAS}', 'INFOCAL', '2025-01-03', CURRENT_DATE + 30),
  ('${VENCE_EN_31}', '${ROSA}', '${CARNET}', 'SEDES La Paz', '2025-01-04', CURRENT_DATE + 31),
  ('${DE_RETIRADO}', '${PEDRO_RETIRADO}', '${CARNET}', 'SEDES La Paz', '2025-01-05', CURRENT_DATE + 5),
  ('${VENCIDA}', '${RRHH}', '${CARNET}', 'SEDES La Paz', '2025-01-06', CURRENT_DATE - 1);
`;

const respuesta = (status, cuerpo = {}) =>
  Promise.resolve({ ok: status < 400, status, json: async () => cuerpo, text: async () => JSON.stringify(cuerpo) });

const enviados = (fetchSimulado) =>
  fetchSimulado.mock.calls.map(([url, opciones]) => ({ url, opciones, cuerpo: JSON.parse(opciones.body) }));

const paraEmpleado = (fetchSimulado, idEmpleado) =>
  enviados(fetchSimulado).filter((m) => m.cuerpo.id_empleado_destinatario === idEmpleado);

const fechaRelativa = async (dias) => {
  const { rows } = await pool.query(`SELECT (CURRENT_DATE + ${dias})::date AS fecha`);
  return rows[0].fecha;
};

const marcadas = async () => {
  const { rows } = await pool.query(
    'SELECT id_capacitacion FROM capacitaciones_certificacion WHERE alerta_vencimiento_enviada_en IS NOT NULL ORDER BY id_capacitacion'
  );
  return rows.map((fila) => fila.id_capacitacion);
};

let fetchSimulado;
let log;

beforeAll(() => pool.preparar(SEMILLA), 30000);

afterAll(() => pool.cerrar());

beforeEach(async () => {
  await pool.query('UPDATE capacitaciones_certificacion SET alerta_vencimiento_enviada_en = NULL');
  process.env.ALERTAS_ID_EMPLEADO_RRHH = RRHH;
  delete process.env.NOTIFICACIONES_SIMULADAS;
  fetchSimulado = jest.spyOn(global, 'fetch').mockImplementation(() => respuesta(201, { exito: true }));
  log = jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('alertas de caducidad de certificaciones (KAN-296)', () => {
  describe('selección de certificaciones', () => {
    test('alerta todo lo que vence entre hoy y los próximos 30 días, solo de colaboradores activos', async () => {
      const resultado = await revisarCertificacionesPorVencer();

      expect(resultado).toEqual({
        total: 3,
        colaboradores_notificados: 3,
        fallidos: 0,
        rrhh_notificado: true,
        alertas_marcadas: 3,
      });
      expect(paraEmpleado(fetchSimulado, LUIS)).toHaveLength(2);
      expect(paraEmpleado(fetchSimulado, ROSA)).toHaveLength(1);
      expect(paraEmpleado(fetchSimulado, PEDRO_RETIRADO)).toHaveLength(0);
      expect(await marcadas()).toEqual([...PENDIENTES].sort());
    });

    test('lo que vence en 31 días, ya venció o es de un colaborador retirado no genera alerta', async () => {
      await revisarCertificacionesPorVencer();
      const resumen = paraEmpleado(fetchSimulado, RRHH)[0].cuerpo.contenido;

      expect(resumen).not.toContain(await fechaRelativa(31));
      expect(resumen).not.toContain(await fechaRelativa(-1));
      expect(resumen).not.toContain('Pedro Condori');
      expect(await marcadas()).not.toEqual(expect.arrayContaining([VENCE_EN_31, VENCIDA, DE_RETIRADO]));
    });

    test('una alerta ya enviada no se vuelve a enviar en las siguientes revisiones', async () => {
      await revisarCertificacionesPorVencer();
      fetchSimulado.mockClear();

      const segunda = await revisarCertificacionesPorVencer();

      expect(segunda).toMatchObject({ total: 0, alertas_marcadas: 0 });
      expect(fetchSimulado).not.toHaveBeenCalled();
    });

    test('un certificado registrado después que vence en menos de 30 días se alerta en la siguiente revisión', async () => {
      await revisarCertificacionesPorVencer();
      fetchSimulado.mockClear();
      await request(app)
        .post('/capacitaciones')
        .set('X-Rol', 'admin')
        .field('id_empleado', ROSA)
        .field('id_curso', MONTACARGAS)
        .field('institucion_emisora', 'INFOCAL')
        .field('fecha_emision', '2025-02-01')
        .field('fecha_vencimiento', await fechaRelativa(7));

      const resultado = await revisarCertificacionesPorVencer();

      expect(resultado).toMatchObject({ total: 1, alertas_marcadas: 1 });
      expect(paraEmpleado(fetchSimulado, ROSA)[0].cuerpo.asunto).toBe('Su certificación «Operación de montacargas» vence en 7 días');
      await pool.query(`DELETE FROM capacitaciones_certificacion WHERE fecha_emision = '2025-02-01'`);
    });
  });

  describe('reinicio de la alerta al editar', () => {
    const editar = async (idCapacitacion, cambios) => {
      const { body: actual } = await request(app).get(`/capacitaciones/${idCapacitacion}`).set('X-Rol', 'admin');
      return request(app)
        .put(`/capacitaciones/${idCapacitacion}`)
        .set('X-Rol', 'admin')
        .send({
          id_curso: actual.id_curso,
          institucion_emisora: actual.institucion_emisora,
          fecha_emision: actual.fecha_emision,
          fecha_vencimiento: actual.fecha_vencimiento,
          ...cambios,
        });
    };

    test('cambiar la fecha de vencimiento borra la marca y la certificación vuelve a alertarse', async () => {
      await revisarCertificacionesPorVencer();
      fetchSimulado.mockClear();
      const original = await fechaRelativa(12);

      const editada = await editar(VENCE_EN_12, { fecha_vencimiento: await fechaRelativa(20) });
      const resultado = await revisarCertificacionesPorVencer();
      await editar(VENCE_EN_12, { fecha_vencimiento: original });

      expect(editada.body.alerta_vencimiento_enviada_en).toBeNull();
      expect(resultado).toMatchObject({ total: 1, alertas_marcadas: 1 });
      expect(paraEmpleado(fetchSimulado, ROSA)[0].cuerpo.asunto).toContain('vence en 20 días');
    });

    test('editar otros datos sin tocar la fecha de vencimiento conserva la marca', async () => {
      await revisarCertificacionesPorVencer();

      const editada = await editar(VENCE_EN_12, { institucion_emisora: 'INFOCAL El Alto' });
      const resultado = await revisarCertificacionesPorVencer();
      await editar(VENCE_EN_12, { institucion_emisora: 'INFOCAL' });

      expect(editada.body.alerta_vencimiento_enviada_en).not.toBeNull();
      expect(resultado.total).toBe(0);
    });
  });

  describe('mensajes al colaborador y a RRHH', () => {
    test('el asunto indica los días que faltan para el vencimiento', async () => {
      await revisarCertificacionesPorVencer();
      const asuntos = [...paraEmpleado(fetchSimulado, LUIS), ...paraEmpleado(fetchSimulado, ROSA)].map((m) => m.cuerpo.asunto);

      expect(asuntos.sort()).toEqual(
        [
          'Su certificación «Manipulación de alimentos» vence hoy',
          'Su certificación «Operación de montacargas» vence en 12 días',
          'Su certificación «Operación de montacargas» vence en 30 días',
        ].sort()
      );
    });

    test('cada colaborador recibe un mensaje directo con su certificación y fecha de vencimiento', async () => {
      await revisarCertificacionesPorVencer();
      const vence = await fechaRelativa(30);
      const paraLuis = paraEmpleado(fetchSimulado, LUIS).find((m) => m.cuerpo.asunto.includes('30 días'));

      expect(paraLuis.url).toBe('http://notificaciones.prueba/comunicaciones/directa');
      expect(paraLuis.opciones.method).toBe('POST');
      expect(paraLuis.opciones.headers).toMatchObject({ 'X-Usuario-Id': RRHH, 'X-Rol': 'admin', 'Content-Type': 'application/json' });
      expect(paraLuis.cuerpo).toMatchObject({ requiere_confirmacion: false, remitente_nombre: 'Sistema de RRHH (alertas automáticas)' });
      expect(paraLuis.cuerpo.contenido).toContain('Estimado(a) Luis Mamani Flores');
      expect(paraLuis.cuerpo.contenido).toContain(`vence el ${vence}`);
    });

    test('RRHH recibe un único resumen con todas las certificaciones y su plazo', async () => {
      await revisarCertificacionesPorVencer();
      const paraRrhh = paraEmpleado(fetchSimulado, RRHH);

      expect(paraRrhh).toHaveLength(1);
      expect(paraRrhh[0].cuerpo.asunto).toBe('3 certificación(es) del personal vencen en los próximos 30 días');
      expect(paraRrhh[0].cuerpo.contenido).toContain('- Luis Mamani Flores: «Manipulación de alimentos» (BPM-01)');
      expect(paraRrhh[0].cuerpo.contenido).toContain('(vence hoy)');
      expect(paraRrhh[0].cuerpo.contenido).toContain('- Rosa Quispe: «Operación de montacargas» (MON-01)');
      expect(paraRrhh[0].cuerpo.contenido).toContain('(vence en 12 días)');
    });
  });

  describe('fallos de envío', () => {
    test('si falla el aviso a un colaborador, esa alerta no se marca y RRHH sabe que no se le pudo avisar', async () => {
      fetchSimulado.mockImplementation((url, opciones) =>
        JSON.parse(opciones.body).id_empleado_destinatario === ROSA ? respuesta(422, { error: 'inactivo' }) : respuesta(201)
      );

      const resultado = await revisarCertificacionesPorVencer();
      const resumen = paraEmpleado(fetchSimulado, RRHH)[0].cuerpo.contenido;

      expect(resultado).toMatchObject({ total: 3, colaboradores_notificados: 2, fallidos: 1, rrhh_notificado: true, alertas_marcadas: 2 });
      expect(resumen).toMatch(/Rosa Quispe: .* — no se pudo avisar al colaborador/);
      expect(await marcadas()).toEqual([VENCE_HOY, VENCE_EN_30].sort());
    });

    test('la alerta fallida se reintenta en la siguiente revisión', async () => {
      fetchSimulado.mockImplementationOnce(() => respuesta(201)).mockImplementationOnce(() => respuesta(503));
      await revisarCertificacionesPorVencer();
      fetchSimulado.mockReset();
      fetchSimulado.mockImplementation(() => respuesta(201));

      const segunda = await revisarCertificacionesPorVencer();

      expect(segunda).toMatchObject({ total: 1, colaboradores_notificados: 1, alertas_marcadas: 1 });
      expect(await marcadas()).toEqual([...PENDIENTES].sort());
    });

    test('si falla el aviso a RRHH no se marca ninguna alerta', async () => {
      fetchSimulado.mockImplementation((url, opciones) =>
        JSON.parse(opciones.body).id_empleado_destinatario === RRHH ? respuesta(500) : respuesta(201)
      );

      const resultado = await revisarCertificacionesPorVencer();

      expect(resultado).toMatchObject({ colaboradores_notificados: 3, rrhh_notificado: false, alertas_marcadas: 0 });
      expect(await marcadas()).toEqual([]);
    });

    test('si NotificationService no responde, el job no se cae y no marca nada', async () => {
      fetchSimulado.mockRejectedValue(new Error('ECONNREFUSED'));

      const resultado = await revisarCertificacionesPorVencer();

      expect(resultado).toEqual({ total: 3, colaboradores_notificados: 0, fallidos: 3, rrhh_notificado: false, alertas_marcadas: 0 });
      expect(await marcadas()).toEqual([]);
    });
  });

  describe('modo simulado', () => {
    test.each([
      ['sin administrador de RRHH configurado', () => delete process.env.ALERTAS_ID_EMPLEADO_RRHH],
      ['con NOTIFICACIONES_SIMULADAS=true', () => (process.env.NOTIFICACIONES_SIMULADAS = 'true')],
    ])('%s no llama a NotificationService ni marca las alertas como enviadas', async (descripcion, configurar) => {
      configurar();

      const resultado = await revisarCertificacionesPorVencer();
      const salida = log.mock.calls.flat().join('\n');

      expect(resultado).toMatchObject({ total: 3, alertas_marcadas: 0 });
      expect(fetchSimulado).not.toHaveBeenCalled();
      expect(salida).toContain(`[notificaciones simuladas] Para: ${LUIS} <luis@correo.com>`);
      expect(await marcadas()).toEqual([]);
    });
  });

  describe('programación del job', () => {
    afterEach(() => {
      delete process.env.CRON_CERTIFICACIONES;
      delete process.env.CRON_CERTIFICACIONES_ACTIVO;
    });

    test('se programa a diario a las 08:00 en la zona horaria de La Paz', () => {
      const programar = jest.spyOn(cron, 'schedule').mockReturnValue({ name: 'simulada' });

      const tarea = iniciarCronCertificaciones();

      expect(tarea).toEqual({ name: 'simulada' });
      expect(programar).toHaveBeenCalledWith(
        '0 8 * * *',
        expect.any(Function),
        expect.objectContaining({ timezone: 'America/La_Paz', noOverlap: true })
      );
    });

    test('una expresión cron inválida no programa el job', () => {
      const programar = jest.spyOn(cron, 'schedule');
      process.env.CRON_CERTIFICACIONES = 'cada mañana';

      expect(iniciarCronCertificaciones()).toBeNull();
      expect(programar).not.toHaveBeenCalled();
    });

    test('se puede desactivar con CRON_CERTIFICACIONES_ACTIVO=false', () => {
      const programar = jest.spyOn(cron, 'schedule');
      process.env.CRON_CERTIFICACIONES_ACTIVO = 'false';

      expect(iniciarCronCertificaciones()).toBeNull();
      expect(programar).not.toHaveBeenCalled();
    });

    test('un error dentro de la ejecución programada no tumba el proceso', async () => {
      const programar = jest.spyOn(cron, 'schedule').mockReturnValue({});
      iniciarCronCertificaciones();
      const ejecutar = programar.mock.calls[0][1];
      jest.spyOn(pool, 'query').mockRejectedValueOnce(new Error('BD caída'));

      await expect(ejecutar()).resolves.toBeUndefined();
      expect(console.error).toHaveBeenCalledWith('[certificaciones] Falló la revisión de certificaciones por vencer', expect.any(Error));
    });
  });
});
