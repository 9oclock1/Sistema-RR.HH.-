const fs = require('node:fs');

const CARPETA_TEMPORAL = 'tests/.tmp/planesAscenso';
process.env.CERTIFICADOS_DIR = `${CARPETA_TEMPORAL}/certificados`;

jest.mock('../db/pool', () => require('./helpers/bdEnMemoria').crearBdEnMemoria());

const request = require('supertest');
const pool = require('../db/pool');
const app = require('../index');
const { estadoCurso, restarMeses, calcularAvance } = require('../src/utils/planesAscenso');

const id = (n) => `b8300000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const AREA = id(1);
const CAJERO = id(11);
const SUPERVISOR = id(12);
const JEFE_SIN_CURSOS = id(13);
const SOPOCACHI = id(21);
const MIRAFLORES = id(22);
const ANA = id(31);
const BETO = id(32);
const ELENA = id(33);
const RRHH = id(34);
const ARQUEO = id(41);
const LIDERAZGO = id(42);
const SEGURIDAD = id(43);
const OPCIONAL = id(44);

// Supervisor de Cajas exige arqueo, liderazgo y seguridad (obligatorios) y un curso opcional.
// Ana: arqueo al día y un certificado de seguridad vencido; sin liderazgo. Beto: los tres obligatorios al día.
const SEMILLA = `
INSERT INTO departamentos (id_departamento, codigo, nombre) VALUES ('${AREA}', 'ATC', 'Atención al cliente');
INSERT INTO cargos (id_cargo, id_departamento, codigo, nombre, salario_base_referencial, funciones_clave, requisitos_minimos) VALUES
  ('${CAJERO}', '${AREA}', 'CAJ', 'Cajero', 3200, 'Cobro', 'Bachiller'),
  ('${SUPERVISOR}', '${AREA}', 'SUP', 'Supervisor de Cajas', 5800, 'Supervisión', 'Técnico'),
  ('${JEFE_SIN_CURSOS}', '${AREA}', 'JEF', 'Jefe de Atención', 8500, 'Jefatura', 'Licenciatura');
INSERT INTO sucursales (id_sucursal, codigo_sucursal, nombre, direccion) VALUES
  ('${SOPOCACHI}', 'SOP', 'Sopocachi', 'Av. 6 de Agosto'), ('${MIRAFLORES}', 'MIR', 'Miraflores', 'Av. Busch');
INSERT INTO estados_empleado VALUES (1, 'ACTIVO', 'Activo', TRUE), (4, 'BAJA', 'Baja', FALSE);
INSERT INTO empleados (id_empleado, numero_documento, nombres, primer_apellido, fecha_nacimiento, genero, telefono_celular,
                       correo_personal, direccion_domicilio, fecha_ingreso, id_cargo_actual, id_sucursal_actual, id_estado_empleado) VALUES
  ('${ANA}', '8301', 'Ana', 'Torrez', '1995-02-15', 'Femenino', '70000001', 'ana@correo.test', 'La Paz', '2020-03-01', '${CAJERO}', '${SOPOCACHI}', 1),
  ('${BETO}', '8302', 'Beto', 'Rojas', '1991-07-15', 'Masculino', '70000002', 'beto@correo.test', 'La Paz', '2019-03-01', '${CAJERO}', '${SOPOCACHI}', 1),
  ('${ELENA}', '8303', 'Elena', 'Paredes', '1985-04-15', 'Femenino', '70000003', 'elena@correo.test', 'La Paz', '2019-03-01', '${CAJERO}', '${SOPOCACHI}', 4),
  ('${RRHH}', '8304', 'Andrea', 'Salazar', '1987-03-15', 'Femenino', '70000004', 'andrea@correo.test', 'La Paz', '2018-03-01', '${JEFE_SIN_CURSOS}', '${SOPOCACHI}', 1);
INSERT INTO asignaciones_empleado (id_asignacion, id_empleado, id_cargo, id_sucursal, fecha_inicio) VALUES
  ('${id(51)}', '${ANA}', '${CAJERO}', '${SOPOCACHI}', '2020-03-01'),
  ('${id(52)}', '${BETO}', '${CAJERO}', '${SOPOCACHI}', '2019-03-01');
INSERT INTO cursos_capacitacion (id_curso, codigo, nombre, horas_academicas, tipo_capacitacion, requiere_vencimiento, meses_vigencia) VALUES
  ('${ARQUEO}', 'ARQ', 'Arqueo de caja', 16, 'TECNICA', FALSE, NULL),
  ('${LIDERAZGO}', 'LID', 'Liderazgo de equipos', 32, 'TECNICA', FALSE, NULL),
  ('${SEGURIDAD}', 'SEG', 'Seguridad y primeros auxilios', 12, 'CERTIFICACION', TRUE, 24),
  ('${OPCIONAL}', 'OPC', 'Excel intermedio', 20, 'TECNICA', FALSE, NULL);
INSERT INTO requisitos_capacitacion_cargo (id_requisito_cargo, id_cargo, id_curso, es_obligatorio) VALUES
  ('${id(61)}', '${SUPERVISOR}', '${ARQUEO}', TRUE),
  ('${id(62)}', '${SUPERVISOR}', '${LIDERAZGO}', TRUE),
  ('${id(63)}', '${SUPERVISOR}', '${SEGURIDAD}', TRUE),
  ('${id(64)}', '${SUPERVISOR}', '${OPCIONAL}', FALSE);
INSERT INTO capacitaciones_certificacion (id_capacitacion, id_empleado, id_curso, institucion_emisora, fecha_emision, fecha_vencimiento) VALUES
  ('${id(71)}', '${ANA}', '${ARQUEO}', 'Instituto Financiero', '2025-01-10', NULL),
  ('${id(72)}', '${ANA}', '${SEGURIDAD}', 'Cruz Roja', '2020-01-10', '2022-01-10'),
  ('${id(73)}', '${BETO}', '${ARQUEO}', 'Instituto Financiero', '2024-05-10', NULL),
  ('${id(74)}', '${BETO}', '${LIDERAZGO}', 'Escuela de Gestión', '2025-03-10', NULL),
  ('${id(75)}', '${BETO}', '${SEGURIDAD}', 'Cruz Roja', '2025-09-12', '2099-09-12');
`;

const ADMIN = { 'X-Rol': 'admin', 'X-Empleado-Id': RRHH };
const asignar = (cuerpo, cabeceras = ADMIN) => request(app).post('/planes-ascenso').set(cabeceras).send(cuerpo);
const consultar = (idPlan, rol = 'admin') => request(app).get(`/planes-ascenso/${idPlan}`).set('X-Rol', rol);
const formalizar = (idPlan, cuerpo = {}) => request(app).post(`/planes-ascenso/${idPlan}/formalizacion`).set(ADMIN).send(cuerpo);
const estados = (plan) => Object.fromEntries(plan.cursos.map((c) => [c.codigo, c.estado]));

let planAna;
let planBeto;

beforeAll(() => {
  fs.rmSync(CARPETA_TEMPORAL, { recursive: true, force: true });
  return pool.preparar(SEMILLA);
}, 30000);

afterAll(async () => {
  await pool.cerrar();
  fs.rmSync(CARPETA_TEMPORAL, { recursive: true, force: true });
});

describe('estado de un curso y avance (reglas puras)', () => {
  test('sin certificado, vencido o demasiado antiguo queda pendiente; vigente queda cumplido', () => {
    const hoy = '2026-11-22';
    expect(estadoCurso({ fecha_emision: null }, hoy)).toMatchObject({ estado: 'PENDIENTE', motivo: 'Sin registro en el Kardex.' });
    expect(estadoCurso({ fecha_emision: '2024-01-10', fecha_vencimiento: '2026-11-21' }, hoy).estado).toBe('PENDIENTE');
    expect(estadoCurso({ fecha_emision: '2024-01-10', fecha_vencimiento: '2026-11-22' }, hoy).estado).toBe('CUMPLIDO');
    expect(estadoCurso({ fecha_emision: '2025-11-21', meses_validez_requerida: 12 }, hoy).estado).toBe('PENDIENTE');
    expect(estadoCurso({ fecha_emision: '2025-11-22', meses_validez_requerida: 12 }, hoy).estado).toBe('CUMPLIDO');
  });

  test('restar meses respeta el fin de mes', () => {
    expect(restarMeses('2026-03-31', 1)).toBe('2026-02-28');
    expect(restarMeses('2026-01-15', 13)).toBe('2024-12-15');
  });

  test('el avance se mide sobre los cursos obligatorios', () => {
    const cursos = [
      { es_obligatorio: true, estado: 'CUMPLIDO' },
      { es_obligatorio: true, estado: 'PENDIENTE' },
      { es_obligatorio: true, estado: 'PENDIENTE' },
      { es_obligatorio: false, estado: 'CUMPLIDO' },
    ];
    expect(calcularAvance(cursos)).toEqual({ cursos_requeridos: 3, cursos_cumplidos: 1, cursos_pendientes: 2, porcentaje: 33.33 });
  });
});

describe('criterio 1: asignar el plan lista los cursos requeridos con su estado', () => {
  test('el plan de Ana para Supervisor de Cajas muestra cada curso pendiente o cumplido según su Kardex', async () => {
    const res = await asignar({ id_empleado: ANA, id_cargo_destino: SUPERVISOR, observaciones: 'Candidata a supervisión' });
    planAna = res.body.id_plan;

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      estado: 'EN_CURSO',
      asignado_por: RRHH,
      empleado: { nombre_completo: 'Ana Torrez', cargo_actual: { nombre: 'Cajero' } },
      cargo_destino: { nombre: 'Supervisor de Cajas' },
      avance: { cursos_requeridos: 3, cursos_cumplidos: 1, cursos_pendientes: 2, porcentaje: 33.33 },
    });
    expect(estados(res.body)).toEqual({ ARQ: 'CUMPLIDO', LID: 'PENDIENTE', SEG: 'PENDIENTE', OPC: 'PENDIENTE' });
    const seguridad = res.body.cursos.find((c) => c.codigo === 'SEG');
    expect(seguridad.motivo).toBe('El certificado venció el 2022-01-10: debe renovarlo.');
    expect(seguridad.certificado).toMatchObject({ institucion_emisora: 'Cruz Roja', fecha_emision: '2020-01-10' });
    expect(res.body.cursos.find((c) => c.codigo === 'OPC').es_obligatorio).toBe(false);
  });

  test('un cargo sin capacitaciones requeridas no admite plan', async () => {
    const res = await asignar({ id_empleado: BETO, id_cargo_destino: JEFE_SIN_CURSOS });
    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('CARGO_SIN_CAPACITACIONES');
  });

  test('rechaza empleados de baja, el mismo cargo que ya ocupa y un segundo plan en curso', async () => {
    expect((await asignar({ id_empleado: ELENA, id_cargo_destino: SUPERVISOR })).body.codigo).toBe('EMPLEADO_INACTIVO');
    expect((await asignar({ id_empleado: RRHH, id_cargo_destino: JEFE_SIN_CURSOS })).body.codigo).toBe('MISMO_CARGO');
    const duplicado = await asignar({ id_empleado: ANA, id_cargo_destino: SUPERVISOR });
    expect(duplicado.status).toBe(409);
    expect(duplicado.body).toMatchObject({ codigo: 'PLAN_EN_CURSO', id_plan: planAna });
  });

  test('valida los datos y solo el Administrador asigna planes', async () => {
    expect((await asignar({ id_empleado: 'x', id_cargo_destino: SUPERVISOR })).status).toBe(400);
    expect((await asignar({ id_empleado: BETO, id_cargo_destino: SUPERVISOR }, { 'X-Rol': 'gerente' })).status).toBe(403);
    expect((await asignar({ id_empleado: BETO, id_cargo_destino: id(99) })).status).toBe(404);
  });
});

describe('criterio 2: una capacitación aprobada registrada en el Kardex marca el curso como cumplido', () => {
  test('al registrar liderazgo para Ana, el seguimiento lo muestra cumplido y sube el avance', async () => {
    const registro = await request(app)
      .post('/capacitaciones')
      .set('X-Rol', 'admin')
      .field('id_empleado', ANA)
      .field('id_curso', LIDERAZGO)
      .field('institucion_emisora', 'Escuela de Gestión')
      .field('fecha_emision', '2026-03-20')
      .attach('certificado', Buffer.from('%PDF-1.4 liderazgo'), { filename: 'liderazgo.pdf', contentType: 'application/pdf' });
    expect(registro.status).toBe(201);

    const res = await consultar(planAna);
    expect(estados(res.body)).toMatchObject({ ARQ: 'CUMPLIDO', LID: 'CUMPLIDO', SEG: 'PENDIENTE' });
    expect(res.body.avance).toMatchObject({ cursos_cumplidos: 2, cursos_pendientes: 1, porcentaje: 66.67 });
  });
});

describe('criterio 3: advertencia al formalizar un ascenso con cursos pendientes', () => {
  test('sin confirmar, responde la advertencia con los cursos pendientes y no cambia nada', async () => {
    const res = await formalizar(planAna);

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      codigo: 'CURSOS_PENDIENTES',
      advertencia: 'Ana Torrez tiene 1 curso pendiente del plan para «Supervisor de Cajas»: Seguridad y primeros auxilios.',
      cursos_pendientes: [{ codigo: 'SEG', motivo: 'El certificado venció el 2022-01-10: debe renovarlo.' }],
      avance: { porcentaje: 66.67 },
    });
    const despues = (await consultar(planAna)).body;
    expect(despues.estado).toBe('EN_CURSO');
    expect(despues.empleado.cargo_actual.nombre).toBe('Cajero');
  });

  test('confirmada la advertencia, formaliza el ascenso, cambia el cargo y deja constancia de los pendientes', async () => {
    const res = await formalizar(planAna, { confirmar_pendientes: true, id_sucursal: MIRAFLORES });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      estado: 'FORMALIZADO',
      advertencia: expect.stringContaining('1 curso pendiente'),
      formalizacion: { cursos_pendientes: 1, con_pendientes: true, formalizado_por: RRHH },
      empleado: { cargo_actual: { nombre: 'Supervisor de Cajas' }, sucursal_actual: { nombre: 'Miraflores' } },
    });
    expect((await formalizar(planAna, { confirmar_pendientes: true })).body.codigo).toBe('PLAN_FORMALIZADO');
  });

  test('con todos los cursos cumplidos se formaliza sin advertencia', async () => {
    const asignado = await asignar({ id_empleado: BETO, id_cargo_destino: SUPERVISOR });
    planBeto = asignado.body.id_plan;
    expect(asignado.body.avance.porcentaje).toBe(100);

    const res = await formalizar(planBeto);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ estado: 'FORMALIZADO', advertencia: null, formalizacion: { con_pendientes: false } });
  });
});

describe('criterio 4: el Administrador ve el porcentaje de avance de cada candidato', () => {
  test('el listado trae a cada candidato con su avance y se filtra por estado', async () => {
    await asignar({ id_empleado: RRHH, id_cargo_destino: SUPERVISOR });

    const enCurso = await request(app).get('/planes-ascenso').set('X-Rol', 'admin');
    const todos = await request(app).get('/planes-ascenso?estado=TODOS').set('X-Rol', 'gerente');

    expect(enCurso.status).toBe(200);
    expect(enCurso.body.planes.map((p) => [p.empleado.nombre_completo, p.avance.porcentaje])).toEqual([['Andrea Salazar', 0]]);
    expect(todos.body.planes.map((p) => [p.empleado.nombre_completo, p.estado, p.avance.porcentaje])).toEqual([
      ['Andrea Salazar', 'EN_CURSO', 0],
      ['Ana Torrez', 'FORMALIZADO', 66.67],
      ['Beto Rojas', 'FORMALIZADO', 100],
    ]);
  });

  test('solo RRHH y la gerencia consultan el seguimiento', async () => {
    expect((await request(app).get('/planes-ascenso').set('X-Rol', 'empleado')).status).toBe(403);
    expect((await request(app).get('/planes-ascenso')).status).toBe(401);
    expect((await request(app).get('/planes-ascenso?estado=OTRO').set('X-Rol', 'admin')).status).toBe(400);
  });
});
