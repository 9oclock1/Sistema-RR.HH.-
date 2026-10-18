const fs = require('node:fs');

const CARPETA_TEMPORAL = 'tests/.tmp/kardexCapacitaciones';
process.env.CERTIFICADOS_DIR = `${CARPETA_TEMPORAL}/certificados`;

jest.mock('../db/pool', () => require('./helpers/bdEnMemoria').crearBdEnMemoria());

const request = require('supertest');
const pool = require('../db/pool');
const app = require('../index');

const id = (n) => `b1000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const ROSA = id(1);
const LUIS = id(2);
const CARNET = id(401);
const INDUCCION = id(402);
const MONTACARGAS = id(403);
const ORDEN = id(501);

const SEMILLA = `
INSERT INTO departamentos (id_departamento, codigo, nombre) VALUES ('${id(10)}', 'OPS', 'Operaciones');
INSERT INTO cargos (id_cargo, id_departamento, codigo, nombre, salario_base_referencial, funciones_clave, requisitos_minimos)
  VALUES ('${id(20)}', '${id(10)}', 'CAJ', 'Cajero', 3000, 'Cobro', 'Bachiller');
INSERT INTO sucursales (id_sucursal, codigo_sucursal, nombre, direccion) VALUES ('${id(30)}', 'SOP', 'Sopocachi', 'Av. 6 de Agosto');
INSERT INTO estados_empleado VALUES (1, 'ACTIVO', 'Activo', TRUE);
INSERT INTO empleados (id_empleado, numero_documento, nombres, primer_apellido, fecha_nacimiento, genero, telefono_celular,
                       correo_personal, direccion_domicilio, fecha_ingreso, id_cargo_actual, id_sucursal_actual, id_estado_empleado) VALUES
  ('${ROSA}', '2000001', 'Rosa', 'Quispe', '1999-12-24', 'Femenino', '73456789', 'rosa@correo.com', 'x', '2023-09-01', '${id(20)}', '${id(30)}', 1),
  ('${LUIS}', '2000002', 'Luis', 'Mamani', '1995-07-01', 'Masculino', '72345678', 'luis@correo.com', 'x', '2022-05-10', '${id(20)}', '${id(30)}', 1);
INSERT INTO cursos_capacitacion (id_curso, codigo, nombre, horas_academicas, tipo_capacitacion, requiere_vencimiento, meses_vigencia) VALUES
  ('${CARNET}', 'BPM-01', 'Manipulación de alimentos', 20, 'CARNET_SANITARIO', TRUE, 12),
  ('${INDUCCION}', 'IND-01', 'Inducción institucional', 8, 'INDUCCION', FALSE, NULL),
  ('${MONTACARGAS}', 'MON-01', 'Operación de montacargas', 40, 'CERTIFICACION', TRUE, NULL);
INSERT INTO solicitudes_servicio_capacitacion (id_solicitud_servicio, id_curso, id_empleado_solicitante, descripcion_requerimiento,
                                               cantidad_participantes, estado, enviada_en, numero_orden_servicio, proveedor_nombre) VALUES
  ('${ORDEN}', '${CARNET}', '${LUIS}', 'Curso BPM', 10, 'ORDEN_EMITIDA', now(), 'OS-2026-0042', 'Capacita SRL');
INSERT INTO capacitaciones_certificacion (id_capacitacion, id_empleado, id_curso, institucion_emisora, fecha_inicio, fecha_fin,
                                          fecha_emision, fecha_vencimiento, id_solicitud_servicio,
                                          certificado_adjunto_url, certificado_nombre_original, certificado_tipo_mime, certificado_tamano_bytes) VALUES
  ('${id(601)}', '${ROSA}', '${CARNET}', 'SEDES La Paz', NULL, NULL, '2025-01-10', CURRENT_DATE - 1, NULL, NULL, NULL, NULL, NULL),
  ('${id(602)}', '${ROSA}', '${MONTACARGAS}', 'INFOCAL', '2025-03-01', '2025-03-20', '2025-03-25', CURRENT_DATE, NULL,
   '/uploads/certificados/x.pdf', 'montacargas.pdf', 'application/pdf', 1200),
  ('${id(603)}', '${ROSA}', '${CARNET}', 'Capacita SRL', '2025-05-01', '2025-05-02', '2025-05-03', CURRENT_DATE + 30, '${ORDEN}',
   NULL, NULL, NULL, NULL),
  ('${id(604)}', '${ROSA}', '${MONTACARGAS}', 'INFOCAL', NULL, NULL, '2025-06-01', CURRENT_DATE + 31, NULL, NULL, NULL, NULL, NULL),
  ('${id(605)}', '${ROSA}', '${INDUCCION}', 'Gerencia de RRHH', '2023-09-01', '2023-09-01', '2023-09-02', NULL, NULL, NULL, NULL, NULL, NULL);
`;

const kardex = (idEmpleado, rol = 'admin') => {
  const peticion = request(app).get(`/empleados/${idEmpleado}/kardex`);
  return rol === null ? peticion : peticion.set('X-Rol', rol);
};

const capacitacionesDe = async (idEmpleado) => {
  const { status, body } = await kardex(idEmpleado);
  expect(status).toBe(200);
  return body;
};

const porId = (capacitaciones) => Object.fromEntries(capacitaciones.map((c) => [c.id_capacitacion, c]));

beforeAll(() => {
  fs.rmSync(CARPETA_TEMPORAL, { recursive: true, force: true });
  return pool.preparar(SEMILLA);
}, 30000);

afterAll(async () => {
  await pool.cerrar();
  fs.rmSync(CARPETA_TEMPORAL, { recursive: true, force: true });
});

describe('capacitaciones en el Kardex (KAN-296)', () => {
  describe('estado de vigencia', () => {
    test.each([
      [id(601), 'VENCIDA', -1, false],
      [id(602), 'POR_VENCER', 0, true],
      [id(603), 'POR_VENCER', 30, true],
      [id(604), 'VIGENTE', 31, true],
      [id(605), 'SIN_VENCIMIENTO', null, true],
    ])('la capacitación %s se muestra como %s', async (idCapacitacion, estado, dias, vigente) => {
      const { capacitaciones } = await capacitacionesDe(ROSA);

      expect(porId(capacitaciones)[idCapacitacion]).toMatchObject({
        estado_vigencia: estado,
        dias_para_vencer: dias,
        esta_vigente: vigente,
      });
    });

    test('el total de vencidas del resumen coincide con la pestaña', async () => {
      const { resumen, capacitaciones } = await capacitacionesDe(ROSA);

      expect(resumen.totales.capacitaciones).toBe(capacitaciones.length);
      expect(resumen.totales.capacitaciones_vencidas).toBe(capacitaciones.filter((c) => c.estado_vigencia === 'VENCIDA').length);
    });
  });

  describe('datos que muestra la pestaña', () => {
    test('incluye curso, tipo, institución, fechas de realización y certificado', async () => {
      const { capacitaciones } = await capacitacionesDe(ROSA);

      expect(porId(capacitaciones)[id(602)]).toEqual({
        id_capacitacion: id(602),
        id_curso: MONTACARGAS,
        curso_codigo: 'MON-01',
        curso: 'Operación de montacargas',
        horas_academicas: 40,
        tipo_capacitacion: 'CERTIFICACION',
        institucion_emisora: 'INFOCAL',
        fecha_inicio: '2025-03-01',
        fecha_fin: '2025-03-20',
        fecha_emision: '2025-03-25',
        fecha_vencimiento: expect.any(String),
        esta_vigente: true,
        estado_vigencia: 'POR_VENCER',
        dias_para_vencer: 0,
        certificado_adjunto_url: '/uploads/certificados/x.pdf',
        certificado_nombre_original: 'montacargas.pdf',
        numero_orden_servicio: null,
      });
    });

    test('muestra el número de la orden de servicio de Compras cuando la hay', async () => {
      const { capacitaciones } = await capacitacionesDe(ROSA);

      expect(porId(capacitaciones)[id(603)].numero_orden_servicio).toBe('OS-2026-0042');
    });

    test('ordena de la emisión más reciente a la más antigua', async () => {
      const { capacitaciones } = await capacitacionesDe(ROSA);
      const fechas = capacitaciones.map((c) => c.fecha_emision);

      expect(fechas).toEqual([...fechas].sort().reverse());
    });

    test('un colaborador sin capacitaciones tiene la pestaña vacía', async () => {
      const { capacitaciones, resumen } = await capacitacionesDe(LUIS);

      expect(capacitaciones).toEqual([]);
      expect(resumen.totales).toMatchObject({ capacitaciones: 0, capacitaciones_vencidas: 0 });
    });
  });

  describe('vínculo automático con el registro', () => {
    test('una capacitación registrada aparece de inmediato en el Kardex y deja de aparecer al eliminarla', async () => {
      const registro = await request(app)
        .post('/capacitaciones')
        .set('X-Rol', 'admin')
        .field('id_empleado', LUIS)
        .field('id_curso', CARNET)
        .field('institucion_emisora', 'SEDES La Paz')
        .field('fecha_emision', '2026-01-15')
        .attach('certificado', Buffer.from('%PDF-1.4 carnet'), { filename: 'carnet.pdf', contentType: 'application/pdf' });

      const conRegistro = await capacitacionesDe(LUIS);
      await request(app).delete(`/capacitaciones/${registro.body.id_capacitacion}`).set('X-Rol', 'admin');
      const sinRegistro = await capacitacionesDe(LUIS);

      expect(registro.status).toBe(201);
      expect(conRegistro.capacitaciones).toEqual([
        expect.objectContaining({
          id_capacitacion: registro.body.id_capacitacion,
          fecha_vencimiento: '2027-01-15',
          certificado_nombre_original: 'carnet.pdf',
        }),
      ]);
      expect(conRegistro.resumen.totales.capacitaciones).toBe(1);
      expect(sinRegistro.capacitaciones).toEqual([]);
    });

    test('editar la capacitación actualiza su estado en el Kardex', async () => {
      const { body: original } = await request(app).get(`/capacitaciones/${id(601)}`).set('X-Rol', 'admin');
      const { rows } = await pool.query('SELECT (CURRENT_DATE + 200)::date AS fecha');

      await request(app)
        .put(`/capacitaciones/${id(601)}`)
        .set('X-Rol', 'admin')
        .send({ id_curso: CARNET, institucion_emisora: 'SEDES La Paz', fecha_emision: '2025-01-10', fecha_vencimiento: rows[0].fecha });
      const { capacitaciones } = await capacitacionesDe(ROSA);

      expect(original.estado_vigencia).toBe('VENCIDA');
      expect(porId(capacitaciones)[id(601)]).toMatchObject({ estado_vigencia: 'VIGENTE', dias_para_vencer: 200 });
    });
  });

  describe('acceso', () => {
    test.each(['supervisor', 'empleado'])('el rol %s no ve las capacitaciones del Kardex', async (rol) => {
      const { status, body } = await kardex(ROSA, rol);

      expect(status).toBe(403);
      expect(body.capacitaciones).toBeUndefined();
    });
  });
});
