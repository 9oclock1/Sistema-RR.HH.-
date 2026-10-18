process.env.NOTIFICATION_SERVICE_URL = 'http://notificaciones.prueba';

jest.mock('../db/pool', () => require('./helpers/bdEnMemoria').crearBdEnMemoria());

const cron = require('node-cron');
const pool = require('../db/pool');
const { revisarCertificacionesPorVencer, iniciarCronCertificaciones } = require('../src/jobs/certificacionesCron');

const id = (n) => `a1000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const RRHH = id(1);
const LUIS = id(2);
const ROSA = id(3);
const PEDRO_RETIRADO = id(4);
const CARNET = id(401);
const MONTACARGAS = id(402);

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
  ('${id(501)}', '${LUIS}', '${CARNET}', 'SEDES La Paz', '2025-01-01', CURRENT_DATE + 30),
  ('${id(502)}', '${ROSA}', '${MONTACARGAS}', 'INFOCAL', '2025-01-02', CURRENT_DATE + 30),
  ('${id(503)}', '${LUIS}', '${MONTACARGAS}', 'INFOCAL', '2025-01-03', CURRENT_DATE + 29),
  ('${id(504)}', '${ROSA}', '${CARNET}', 'SEDES La Paz', '2025-01-04', CURRENT_DATE + 31),
  ('${id(505)}', '${PEDRO_RETIRADO}', '${CARNET}', 'SEDES La Paz', '2025-01-05', CURRENT_DATE + 30),
  ('${id(506)}', '${RRHH}', '${CARNET}', 'SEDES La Paz', '2025-01-06', CURRENT_DATE - 1);
`;

const respuesta = (status, cuerpo = {}) =>
  Promise.resolve({ ok: status < 400, status, json: async () => cuerpo, text: async () => JSON.stringify(cuerpo) });

const enviados = (fetchSimulado) =>
  fetchSimulado.mock.calls.map(([url, opciones]) => ({ url, opciones, cuerpo: JSON.parse(opciones.body) }));

const fechaRelativa = async (dias) => {
  const { rows } = await pool.query(`SELECT (CURRENT_DATE + ${dias})::date AS fecha`);
  return rows[0].fecha;
};

let fetchSimulado;
let log;

beforeAll(() => pool.preparar(SEMILLA), 30000);

afterAll(() => pool.cerrar());

beforeEach(() => {
  process.env.ALERTAS_ID_EMPLEADO_RRHH = RRHH;
  delete process.env.NOTIFICACIONES_SIMULADAS;
  fetchSimulado = jest.spyOn(global, 'fetch').mockImplementation(() => respuesta(201, { exito: true }));
  log = jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('alertas de caducidad de certificaciones (KAN-296)', () => {
  describe('selección de certificaciones', () => {
    test('alerta solo lo que vence en exactamente 30 días y de colaboradores activos', async () => {
      const resultado = await revisarCertificacionesPorVencer();
      const destinatarios = enviados(fetchSimulado).map((m) => m.cuerpo.id_empleado_destinatario);

      expect(resultado).toEqual({ total: 2, colaboradores_notificados: 2, fallidos: 0, rrhh_notificado: true });
      expect(destinatarios.sort()).toEqual([LUIS, ROSA, RRHH].sort());
      expect(destinatarios).not.toContain(PEDRO_RETIRADO);
    });

    test('lo que vence en 29 o 31 días, o ya venció, no genera alerta', async () => {
      await revisarCertificacionesPorVencer();
      const contenidos = enviados(fetchSimulado).map((m) => m.cuerpo.contenido).join('\n');
      const en29 = await fechaRelativa(29);
      const en31 = await fechaRelativa(31);
      const ayer = await fechaRelativa(-1);

      expect(contenidos).not.toContain(en29);
      expect(contenidos).not.toContain(en31);
      expect(contenidos).not.toContain(ayer);
    });

    test('sin certificaciones por vencer no se envía ningún mensaje', async () => {
      await pool.query(`UPDATE capacitaciones_certificacion SET fecha_vencimiento = fecha_vencimiento + 100 WHERE fecha_vencimiento = CURRENT_DATE + 30`);
      try {
        const resultado = await revisarCertificacionesPorVencer();

        expect(resultado).toEqual({ total: 0, colaboradores_notificados: 0, fallidos: 0, rrhh_notificado: false });
        expect(fetchSimulado).not.toHaveBeenCalled();
      } finally {
        await pool.query(`UPDATE capacitaciones_certificacion SET fecha_vencimiento = fecha_vencimiento - 100 WHERE fecha_vencimiento = CURRENT_DATE + 130`);
      }
    });
  });

  describe('mensajes al colaborador y a RRHH', () => {
    test('cada colaborador recibe un mensaje directo con su certificación y fecha de vencimiento', async () => {
      await revisarCertificacionesPorVencer();
      const vence = await fechaRelativa(30);
      const paraLuis = enviados(fetchSimulado).find((m) => m.cuerpo.id_empleado_destinatario === LUIS);

      expect(paraLuis.url).toBe('http://notificaciones.prueba/comunicaciones/directa');
      expect(paraLuis.opciones.method).toBe('POST');
      expect(paraLuis.opciones.headers).toMatchObject({ 'X-Usuario-Id': RRHH, 'X-Rol': 'admin', 'Content-Type': 'application/json' });
      expect(paraLuis.cuerpo).toMatchObject({
        asunto: 'Su certificación «Manipulación de alimentos» vence en 30 días',
        requiere_confirmacion: false,
        remitente_nombre: 'Sistema de RRHH (alertas automáticas)',
      });
      expect(paraLuis.cuerpo.contenido).toContain('Estimado(a) Luis Mamani Flores');
      expect(paraLuis.cuerpo.contenido).toContain(`vence el ${vence}`);
    });

    test('RRHH recibe un único resumen con todas las certificaciones por vencer', async () => {
      await revisarCertificacionesPorVencer();
      const paraRrhh = enviados(fetchSimulado).filter((m) => m.cuerpo.id_empleado_destinatario === RRHH);

      expect(paraRrhh).toHaveLength(1);
      expect(paraRrhh[0].cuerpo.asunto).toBe('2 certificación(es) del personal vencen en 30 días');
      expect(paraRrhh[0].cuerpo.contenido).toContain('- Luis Mamani Flores: «Manipulación de alimentos» (BPM-01)');
      expect(paraRrhh[0].cuerpo.contenido).toContain('- Rosa Quispe: «Operación de montacargas» (MON-01)');
    });

    test('si falla el aviso a un colaborador, se sigue con los demás y RRHH igual es alertado', async () => {
      fetchSimulado.mockImplementation((url, opciones) =>
        JSON.parse(opciones.body).id_empleado_destinatario === LUIS ? respuesta(422, { error: 'inactivo' }) : respuesta(201)
      );

      const resultado = await revisarCertificacionesPorVencer();

      expect(resultado).toEqual({ total: 2, colaboradores_notificados: 1, fallidos: 1, rrhh_notificado: true });
    });

    test('si NotificationService no responde, el job no se cae y reporta los fallos', async () => {
      fetchSimulado.mockRejectedValue(new Error('ECONNREFUSED'));

      const resultado = await revisarCertificacionesPorVencer();

      expect(resultado).toEqual({ total: 2, colaboradores_notificados: 0, fallidos: 2, rrhh_notificado: false });
    });
  });

  describe('modo simulado', () => {
    test.each([
      ['sin administrador de RRHH configurado', () => delete process.env.ALERTAS_ID_EMPLEADO_RRHH],
      ['con NOTIFICACIONES_SIMULADAS=true', () => (process.env.NOTIFICACIONES_SIMULADAS = 'true')],
    ])('%s no llama a NotificationService y deja el aviso en el log', async (descripcion, configurar) => {
      configurar();

      const resultado = await revisarCertificacionesPorVencer();
      const salida = log.mock.calls.flat().join('\n');

      expect(resultado.colaboradores_notificados).toBe(2);
      expect(fetchSimulado).not.toHaveBeenCalled();
      expect(salida).toContain('[notificaciones simuladas] Para: ' + LUIS + ' <luis@correo.com>');
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
