process.env.JWT_SECRET = 'secreto-de-prueba-postulaciones';

jest.mock('../db/pool', () => require('./helpers/bdEnMemoria').crearBdEnMemoria());

const jwt = require('jsonwebtoken');
const request = require('supertest');
const pool = require('../db/pool');
const app = require('../index');
const { mesesCompletos, puntajeMeritos, evaluarRequisitos, ordenarRanking } = require('../src/utils/meritos');

const id = (n) => `c8100000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const AREA = id(1);
const CAJERO = id(11);
const SUPERVISOR = id(12);
const SUCURSAL = id(21);
const ANA = id(31); // 2019, nota 85: apta
const BETO = id(32); // ingresó hace 3 meses, nota 90: no apto por permanencia
const CARO = id(33); // 2019, nota 60: no apta por nota
const DANI = id(34); // 2018, sin evaluaciones cerradas: no apta
const EVA = id(35); // 2023, nota 95: apta
const FITO = id(36); // PerformanceService no responde al postularse
const ELENA = id(37); // de baja
const SUPER = id(38); // ya es supervisora
const ABIERTA = id(51);
const PROGRAMADA = id(52);
const CERRADA = id(53);

const SEMILLA = `
INSERT INTO departamentos (id_departamento, codigo, nombre) VALUES ('${AREA}', 'ATC', 'Atención al cliente');
INSERT INTO cargos (id_cargo, id_departamento, codigo, nombre, salario_base_referencial, funciones_clave, requisitos_minimos) VALUES
  ('${CAJERO}', '${AREA}', 'CAJ', 'Cajero', 3200, 'Cobro', 'Bachiller'),
  ('${SUPERVISOR}', '${AREA}', 'SUP', 'Supervisor de Cajas', 5800, 'Supervisión', 'Técnico');
INSERT INTO sucursales (id_sucursal, codigo_sucursal, nombre, direccion) VALUES ('${SUCURSAL}', 'SOP', 'Sopocachi', 'Av. 6 de Agosto');
INSERT INTO estados_empleado VALUES (1, 'ACTIVO', 'Activo', TRUE), (4, 'BAJA', 'Baja', FALSE);
INSERT INTO empleados (id_empleado, numero_documento, nombres, primer_apellido, fecha_nacimiento, genero, telefono_celular,
                       correo_personal, direccion_domicilio, fecha_ingreso, id_cargo_actual, id_sucursal_actual, id_estado_empleado) VALUES
  ('${ANA}', '8101', 'Ana', 'Torrez', '1995-02-15', 'Femenino', '70000001', 'ana@correo.test', 'La Paz', '2019-03-01', '${CAJERO}', '${SUCURSAL}', 1),
  ('${BETO}', '8102', 'Beto', 'Rojas', '1999-01-01', 'Masculino', '70000002', 'beto@correo.test', 'La Paz', CURRENT_DATE - interval '3 months 2 days', '${CAJERO}', '${SUCURSAL}', 1),
  ('${CARO}', '8103', 'Caro', 'Vega', '1990-01-01', 'Femenino', '70000003', 'caro@correo.test', 'La Paz', '2019-03-01', '${CAJERO}', '${SUCURSAL}', 1),
  ('${DANI}', '8104', 'Dani', 'Flores', '1990-01-01', 'Masculino', '70000004', 'dani@correo.test', 'La Paz', '2018-03-01', '${CAJERO}', '${SUCURSAL}', 1),
  ('${EVA}', '8105', 'Eva', 'Quispe', '1997-01-01', 'Femenino', '70000005', 'eva@correo.test', 'La Paz', '2023-03-01', '${CAJERO}', '${SUCURSAL}', 1),
  ('${FITO}', '8106', 'Fito', 'Mamani', '1992-01-01', 'Masculino', '70000006', 'fito@correo.test', 'La Paz', '2020-03-01', '${CAJERO}', '${SUCURSAL}', 1),
  ('${ELENA}', '8107', 'Elena', 'Paredes', '1985-01-01', 'Femenino', '70000007', 'elena@correo.test', 'La Paz', '2015-03-01', '${CAJERO}', '${SUCURSAL}', 4),
  ('${SUPER}', '8108', 'Sara', 'Limachi', '1985-01-01', 'Femenino', '70000008', 'sara@correo.test', 'La Paz', '2015-03-01', '${SUPERVISOR}', '${SUCURSAL}', 1);
INSERT INTO convocatorias_ascenso (id_convocatoria, id_cargo, id_sucursal, titulo, descripcion_requisitos, meses_antiguedad_minima,
                                   nota_minima_desempeno, fecha_inicio_postulacion, fecha_cierre_postulacion) VALUES
  ('${ABIERTA}', '${SUPERVISOR}', '${SUCURSAL}', 'Supervisor de Cajas - Sopocachi', 'Un año en la empresa', 12, 70, CURRENT_DATE - 5, CURRENT_DATE + 10),
  ('${PROGRAMADA}', '${SUPERVISOR}', '${SUCURSAL}', 'Supervisor de Cajas - próxima', 'Un año en la empresa', 12, 70, CURRENT_DATE + 5, CURRENT_DATE + 20),
  ('${CERRADA}', '${SUPERVISOR}', '${SUCURSAL}', 'Supervisor de Cajas - anterior', 'Un año en la empresa', 12, 70, CURRENT_DATE - 30, CURRENT_DATE - 1);
`;

// Historial de PerformanceService por empleado: ciclos cerrados, del más reciente al más antiguo.
const HISTORIAL = {
  [ANA]: [{ id_ciclo: 'c2', nombre: 'Trimestral 2026-T3', puntaje_final: 85 }, { id_ciclo: 'c1', nombre: 'Trimestral 2026-T2', puntaje_final: 50 }],
  [BETO]: [{ id_ciclo: 'c2', nombre: 'Trimestral 2026-T3', puntaje_final: 90 }],
  [CARO]: [{ id_ciclo: 'c2', nombre: 'Trimestral 2026-T3', puntaje_final: 60 }, { id_ciclo: 'c1', nombre: 'Trimestral 2026-T2', puntaje_final: 99 }],
  [DANI]: [],
  [EVA]: [{ id_ciclo: 'c2', nombre: 'Trimestral 2026-T3', puntaje_final: 95 }],
  [FITO]: [{ id_ciclo: 'c2', nombre: 'Trimestral 2026-T3', puntaje_final: 80 }],
};
let performanceCaido = false;

const responder = (status, cuerpo) => ({ ok: status < 400, status, json: async () => cuerpo });

const ADMIN = { 'X-Rol': 'admin' };
const postular = (idConvocatoria, idEmpleado) =>
  request(app).post(`/convocatorias/${idConvocatoria}/postulaciones`).set('X-Empleado-Id', idEmpleado).set('X-Rol', 'empleado');
const verPostulaciones = (idConvocatoria, cabeceras = ADMIN) => request(app).get(`/convocatorias/${idConvocatoria}/postulaciones`).set(cabeceras);

let fetchOriginal;

beforeAll(() => {
  fetchOriginal = global.fetch;
  global.fetch = jest.fn(async (url, opciones = {}) => {
    const coincide = String(url).match(/\/evaluaciones\/historial\/([0-9a-f-]+)$/);
    if (!coincide) throw new Error(`Llamada no esperada: ${url}`);
    if (performanceCaido || coincide[1] === FITO) throw new Error('connect ECONNREFUSED');
    expect(opciones.headers['X-Empleado-Id']).toBe(coincide[1]);
    return responder(200, { ciclos: HISTORIAL[coincide[1]] ?? [] });
  });
  return pool.preparar(SEMILLA);
}, 30000);

afterAll(async () => {
  global.fetch = fetchOriginal;
  await pool.cerrar();
});

describe('reglas de méritos', () => {
  test('meses completos de permanencia', () => {
    expect(mesesCompletos('2026-01-15', '2026-11-14')).toBe(9);
    expect(mesesCompletos('2026-01-15', '2026-11-15')).toBe(10);
    expect(mesesCompletos('2026-11-20', '2026-11-22')).toBe(0);
  });

  test('puntaje de méritos: 70 % nota + 30 % antigüedad con tope de 60 meses', () => {
    expect(puntajeMeritos(80, 60)).toBe(86);
    expect(puntajeMeritos(80, 120)).toBe(86);
    expect(puntajeMeritos(90, 30)).toBe(78);
  });

  test('cada requisito incumplido deja su motivo', () => {
    const convocatoria = { meses_antiguedad_minima: 12, nota_minima_desempeno: 70 };
    const resultado = evaluarRequisitos({ meses: 3, ultimaEvaluacion: { nota: 60, ciclo: 'T3' } }, convocatoria);
    expect(resultado).toMatchObject({ estado: 'NO_APTO', cumple_antiguedad: false, cumple_nota_evaluacion: false, puntaje_meritos: null });
    expect(resultado.motivos_no_apto).toEqual([
      'Permanencia insuficiente: tiene 3 meses y la convocatoria exige 12 meses.',
      'Nota de la última evaluación insuficiente: obtuvo 60 (T3) y la mínima es 70.',
    ]);
    expect(evaluarRequisitos({ meses: 12, ultimaEvaluacion: { nota: 70, ciclo: 'T3' } }, convocatoria).estado).toBe('APTO');
  });

  test('a igual puntaje desempata la mejor nota', () => {
    const ranking = ordenarRanking([
      { id: 'a', puntaje_meritos: 80, nota_ultima_evaluacion: 70, meses_permanencia: 60 },
      { id: 'b', puntaje_meritos: 80, nota_ultima_evaluacion: 75, meses_permanencia: 40 },
    ]);
    expect(ranking.map((p) => [p.id, p.posicion])).toEqual([['b', 1], ['a', 2]]);
  });
});

describe('criterio 1: un empleado activo se postula a una convocatoria vigente una sola vez', () => {
  test('registra la postulación y la valida enseguida', async () => {
    const res = await postular(ABIERTA, ANA);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id_convocatoria: ABIERTA, id_empleado: ANA, nombre_completo: 'Ana Torrez', estado_postulacion: 'APTO' });
  });

  test('una segunda postulación de la misma persona se rechaza', async () => {
    const res = await postular(ABIERTA, ANA);
    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('YA_POSTULADO');
    const { body } = await verPostulaciones(ABIERTA);
    expect(body.totales.postulaciones).toBe(1);
  });

  test('rechaza convocatorias no vigentes, empleados de baja y a quien ya ocupa el cargo', async () => {
    expect((await postular(PROGRAMADA, EVA)).body.codigo).toBe('CONVOCATORIA_NO_VIGENTE');
    expect((await postular(CERRADA, EVA)).body.codigo).toBe('CONVOCATORIA_NO_VIGENTE');
    expect((await postular(ABIERTA, ELENA)).status).toBe(403);
    expect((await postular(ABIERTA, SUPER)).body.codigo).toBe('MISMO_CARGO');
    expect((await postular(id(99), EVA)).status).toBe(404);
    expect((await request(app).post(`/convocatorias/${ABIERTA}/postulaciones`)).status).toBe(401);
  });

  test('el empleado ve su postulación en su portal de convocatorias', async () => {
    const sesionAna = jwt.sign({ rol: 'empleado' }, process.env.JWT_SECRET, { algorithm: 'HS256', subject: ANA, expiresIn: 3600 });
    const lista = await request(app).get('/convocatorias').set('Cookie', `rrhh_sesion=${sesionAna}`);
    const abierta = lista.body.convocatorias.find((c) => c.id_convocatoria === ABIERTA);
    expect(abierta.mi_postulacion).toMatchObject({ estado_postulacion: 'APTO' });
    expect((await request(app).get(`/convocatorias/${ABIERTA}/postulaciones/mia`).set('X-Empleado-Id', EVA)).status).toBe(404);
  });
});

describe('criterios 2 y 3: validación de permanencia y nota de la última evaluación', () => {
  test('toma la nota del ciclo cerrado más reciente y calcula el puntaje de méritos', async () => {
    const { body } = await request(app).get(`/convocatorias/${ABIERTA}/postulaciones/mia`).set('X-Empleado-Id', ANA);
    expect(body).toMatchObject({
      cumple_antiguedad: true,
      nota_ultima_evaluacion: 85,
      ciclo_ultima_evaluacion: 'Trimestral 2026-T3',
      cumple_nota_evaluacion: true,
      motivos_no_apto: null,
    });
    expect(body.meses_permanencia).toBeGreaterThanOrEqual(80);
    expect(body.puntaje_meritos).toBe(puntajeMeritos(85, body.meses_permanencia));
  });

  test('sin la permanencia mínima queda no apto con el motivo', async () => {
    const { body } = await postular(ABIERTA, BETO);
    expect(body).toMatchObject({ estado_postulacion: 'NO_APTO', meses_permanencia: 3, cumple_antiguedad: false, cumple_nota_evaluacion: true });
    expect(body.motivos_no_apto).toEqual(['Permanencia insuficiente: tiene 3 meses y la convocatoria exige 12 meses.']);
  });

  test('con la última nota debajo de la mínima queda no apta, aunque una nota anterior fuera alta', async () => {
    const { body } = await postular(ABIERTA, CARO);
    expect(body).toMatchObject({ estado_postulacion: 'NO_APTO', nota_ultima_evaluacion: 60, cumple_nota_evaluacion: false });
    expect(body.motivos_no_apto).toEqual(['Nota de la última evaluación insuficiente: obtuvo 60 (Trimestral 2026-T3) y la mínima es 70.']);
  });

  test('sin evaluaciones cerradas queda no apto explicando por qué', async () => {
    const { body } = await postular(ABIERTA, DANI);
    expect(body.estado_postulacion).toBe('NO_APTO');
    expect(body.motivos_no_apto).toEqual(['No tiene evaluaciones de desempeño cerradas: no hay una nota que comparar con la mínima.']);
  });

  test('si PerformanceService no responde queda pendiente con el error, y RRHH la vuelve a validar', async () => {
    const res = await postular(ABIERTA, FITO);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ estado_postulacion: 'PENDIENTE_VALIDACION', validada_en: null });
    expect(res.body.error_validacion).toMatch(/ECONNREFUSED/);

    global.fetch.mockImplementationOnce(async () => responder(200, { ciclos: HISTORIAL[FITO] }));
    const revalidada = await request(app).post(`/convocatorias/${ABIERTA}/postulaciones/${res.body.id_postulacion}/validacion`).set(ADMIN);
    expect(revalidada.status).toBe(200);
    expect(revalidada.body).toMatchObject({ estado_postulacion: 'APTO', nota_ultima_evaluacion: 80, error_validacion: null });
  });
});

describe('criterio 4: al cerrar la convocatoria RRHH ve el ranking de aptos por puntaje de méritos', () => {
  test('ranking de aptos ordenado, no aptos con sus motivos y ranking definitivo al cerrar', async () => {
    await postular(ABIERTA, EVA);
    const abierta = await verPostulaciones(ABIERTA);
    expect(abierta.body.ranking_definitivo).toBe(false);

    await pool.query(`UPDATE convocatorias_ascenso SET fecha_cierre_postulacion = CURRENT_DATE - 1 WHERE id_convocatoria = '${ABIERTA}'`);
    const { status, body } = await verPostulaciones(ABIERTA, { 'X-Rol': 'gerente' });

    expect(status).toBe(200);
    expect(body.convocatoria.estado).toBe('CERRADA');
    expect(body.ranking_definitivo).toBe(true);
    expect(body.totales).toEqual({ postulaciones: 6, aptos: 3, no_aptos: 3, pendientes: 0 });
    const ranking = body.ranking.map((p) => [p.posicion, p.nombre_completo]);
    const puntajes = body.ranking.map((p) => p.puntaje_meritos);
    expect(puntajes).toEqual([...puntajes].sort((a, b) => b - a));
    expect(ranking.map(([, nombre]) => nombre).sort()).toEqual(['Ana Torrez', 'Eva Quispe', 'Fito Mamani']);
    expect(ranking.map(([posicion]) => posicion)).toEqual([1, 2, 3]);
    expect(body.no_aptos.map((p) => p.nombre_completo).sort()).toEqual(['Beto Rojas', 'Caro Vega', 'Dani Flores']);
    expect(body.no_aptos.every((p) => p.motivos_no_apto.length > 0)).toBe(true);
    expect((await postular(ABIERTA, SUPER)).body.codigo).toBe('CONVOCATORIA_NO_VIGENTE');
  });

  test('solo RRHH y la gerencia revisan las postulaciones; revalidar es del Administrador', async () => {
    expect((await verPostulaciones(ABIERTA, { 'X-Rol': 'empleado' })).status).toBe(403);
    expect((await request(app).get(`/convocatorias/${ABIERTA}/postulaciones`)).status).toBe(401);
    expect((await request(app).post(`/convocatorias/${ABIERTA}/postulaciones/${id(77)}/validacion`).set('X-Rol', 'gerente')).status).toBe(403);
  });
});
