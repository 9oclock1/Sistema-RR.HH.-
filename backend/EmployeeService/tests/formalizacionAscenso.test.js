process.env.JWT_SECRET = 'secreto-de-prueba-ascensos';

jest.mock('../db/pool', () => require('./helpers/bdEnMemoria').crearBdEnMemoria());

const jwt = require('jsonwebtoken');
const request = require('supertest');
const pool = require('../db/pool');
const app = require('../index');
const { aplicarAscensosProgramados } = require('../src/jobs/ascensosProgramadosCron');

const id = (n) => `c8400000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const AREA = id(1);
const GERENTE = id(11);
const SUPERVISOR = id(12);
const CAJERO = id(13);
const JEFE_AREA = id(14);
const SOPOCACHI = id(21);
const EL_ALTO = id(22);
const ANA = id(31); // apta en C1: se formaliza con vigencia hoy
const EVA = id(32); // apta en C1 y C3; en C2 se formaliza con vigencia futura
const CARO = id(33); // no apta en C1
const BETO = id(34); // apta en C3; su haber (6000) supera el referencial del cargo (5800)
const CARLA = id(35); // apta en C2, sin contrato registrado
const RITA = id(36); // Administradora de RRHH
const C1 = id(51); // Supervisor de Cajas - Sopocachi, abierta
const C2 = id(52); // Jefe de Área - El Alto, cerrada
const C3 = id(53); // Supervisor de Cajas - El Alto, cerrada
const P_ANA = id(61);
const P_EVA_C1 = id(62);
const P_CARO = id(63);
const P_EVA_C2 = id(64);
const P_CARLA = id(65);
const P_EVA_C3 = id(66);
const P_BETO = id(67);

const empleado = (idEmpleado, doc, nombre, apellido, ingreso) =>
  `('${idEmpleado}', '${doc}', '${nombre}', '${apellido}', '1990-01-01', 'Femenino', '7000${doc}', '${doc}@correo.test', 'La Paz', '${ingreso}', '${CAJERO}', '${SOPOCACHI}', 1)`;

const apta = (idPostulacion, idConvocatoria, idEmpleado, puntaje) =>
  `('${idPostulacion}', '${idConvocatoria}', '${idEmpleado}', 'APTO', 60, TRUE, 85, 'T3', TRUE, ${puntaje}, NULL, now())`;

const SEMILLA = `
INSERT INTO departamentos (id_departamento, codigo, nombre) VALUES ('${AREA}', 'OPE', 'Operaciones');
INSERT INTO cargos (id_cargo, id_departamento, id_cargo_jefe_directo, codigo, nombre, nivel_salarial, salario_base_referencial, funciones_clave, requisitos_minimos) VALUES
  ('${GERENTE}', '${AREA}', NULL, 'GER', 'Gerente de Operaciones', 'Gerencial', 12000, 'Dirección', 'Licenciatura'),
  ('${SUPERVISOR}', '${AREA}', '${GERENTE}', 'SUP', 'Supervisor de Cajas', 'Mando Medio', 5800, 'Supervisión', 'Técnico'),
  ('${CAJERO}', '${AREA}', '${SUPERVISOR}', 'CAJ', 'Cajero', 'Operativo Base', 3200, 'Cobro', 'Bachiller'),
  ('${JEFE_AREA}', '${AREA}', '${GERENTE}', 'JEF', 'Jefe de Área', 'Jefatura', 7000, 'Coordinación', 'Licenciatura');
INSERT INTO sucursales (id_sucursal, codigo_sucursal, nombre, direccion) VALUES
  ('${SOPOCACHI}', 'SOP', 'Sopocachi', 'Av. 6 de Agosto'),
  ('${EL_ALTO}', 'ALT', 'El Alto', 'Av. Juan Pablo II');
INSERT INTO estados_empleado VALUES (1, 'ACTIVO', 'Activo', TRUE), (4, 'BAJA', 'Baja', FALSE);
INSERT INTO empleados (id_empleado, numero_documento, nombres, primer_apellido, fecha_nacimiento, genero, telefono_celular,
                       correo_personal, direccion_domicilio, fecha_ingreso, id_cargo_actual, id_sucursal_actual, id_estado_empleado) VALUES
  ${empleado(ANA, '8401', 'Ana', 'Torrez', '2019-03-01')},
  ${empleado(EVA, '8402', 'Eva', 'Quispe', '2020-03-01')},
  ${empleado(CARO, '8403', 'Caro', 'Vega', '2019-03-01')},
  ${empleado(BETO, '8404', 'Beto', 'Rojas', '2018-03-01')},
  ${empleado(CARLA, '8405', 'Carla', 'Mendoza', '2019-03-01')},
  ${empleado(RITA, '8406', 'Rita', 'Vargas', '2015-01-01')};
INSERT INTO asignaciones_empleado (id_asignacion, id_empleado, id_cargo, id_sucursal, fecha_inicio, es_vigente) VALUES
  ('${id(71)}', '${ANA}', '${CAJERO}', '${SOPOCACHI}', '2019-03-01', TRUE),
  ('${id(72)}', '${EVA}', '${CAJERO}', '${SOPOCACHI}', '2020-03-01', TRUE);
INSERT INTO tipos_contrato VALUES (1, 'INDEFINIDO', 'Indefinido'), (2, 'PLAZO_FIJO', 'Plazo fijo');
INSERT INTO tipos_jornada VALUES (1, 'COMPLETA', 'Jornada completa', 48);
INSERT INTO contratos (id_contrato, id_empleado, id_tipo_contrato, id_tipo_jornada, numero_contrato, periodo_vigencia,
                       haber_mensual_pactado, tipo_modificacion) VALUES
  ('${id(81)}', '${ANA}', 1, 1, 'CT-ANA', daterange('2019-03-01', NULL), 3500, 'CONTRATO_INICIAL'),
  ('${id(82)}', '${EVA}', 1, 1, 'CT-EVA', daterange('2020-03-01', NULL), 3300, 'CONTRATO_INICIAL'),
  ('${id(83)}', '${CARO}', 1, 1, 'CT-CARO', daterange('2019-03-01', NULL), 3300, 'CONTRATO_INICIAL'),
  ('${id(84)}', '${BETO}', 1, 1, 'CT-BETO', daterange('2018-03-01', NULL), 6000, 'CONTRATO_INICIAL');
INSERT INTO convocatorias_ascenso (id_convocatoria, id_cargo, id_sucursal, titulo, descripcion_requisitos, meses_antiguedad_minima,
                                   nota_minima_desempeno, fecha_inicio_postulacion, fecha_cierre_postulacion, esta_abierta, cerrada_en) VALUES
  ('${C1}', '${SUPERVISOR}', '${SOPOCACHI}', 'Supervisor de Cajas - Sopocachi', 'Un año', 12, 70, CURRENT_DATE - 5, CURRENT_DATE + 10, TRUE, NULL),
  ('${C2}', '${JEFE_AREA}', '${EL_ALTO}', 'Jefe de Área - El Alto', 'Un año', 12, 70, CURRENT_DATE - 30, CURRENT_DATE - 1, FALSE, now()),
  ('${C3}', '${SUPERVISOR}', '${EL_ALTO}', 'Supervisor de Cajas - El Alto', 'Un año', 12, 70, CURRENT_DATE - 30, CURRENT_DATE - 1, FALSE, now());
INSERT INTO postulaciones_ascenso (id_postulacion, id_convocatoria, id_empleado, estado_postulacion, meses_permanencia, cumple_antiguedad,
                                   nota_ultima_evaluacion, ciclo_ultima_evaluacion, cumple_nota_evaluacion, puntaje_meritos,
                                   motivos_no_apto, validada_en) VALUES
  ${apta(P_ANA, C1, ANA, 86)},
  ${apta(P_EVA_C1, C1, EVA, 80)},
  ('${P_CARO}', '${C1}', '${CARO}', 'NO_APTO', 60, TRUE, 60, 'T3', FALSE, NULL, ARRAY['Nota insuficiente'], now()),
  ${apta(P_EVA_C2, C2, EVA, 82)},
  ${apta(P_CARLA, C2, CARLA, 81)},
  ${apta(P_EVA_C3, C3, EVA, 80)},
  ${apta(P_BETO, C3, BETO, 84)};
`;

const sesion = (rol, sub = RITA) =>
  `rrhh_sesion=${jwt.sign({ rol }, process.env.JWT_SECRET, { algorithm: 'HS256', subject: sub, expiresIn: 3600 })}`;
const ADMIN = sesion('admin');

const formalizar = (idConvocatoria, idPostulacion, cuerpo = {}, cookie = ADMIN) => {
  const peticion = request(app).post(`/convocatorias/${idConvocatoria}/postulaciones/${idPostulacion}/formalizacion`);
  if (cookie) peticion.set('Cookie', cookie);
  return peticion.send(cuerpo);
};

const consultar = async (sql, params = []) => (await pool.query(sql, params)).rows;
const asignacionActual = async (idEmpleado) =>
  (await consultar('SELECT id_cargo_actual, id_sucursal_actual FROM empleados WHERE id_empleado = $1', [idEmpleado]))[0];
const avisoPara = (idEmpleado) => avisos.find((a) => a.id_empleado_destinatario === idEmpleado);
const historialContratos = (idEmpleado) =>
  request(app).get(`/contratos?id_empleado=${idEmpleado}`).set('X-Rol', 'admin');

let hoy;
let enQuinceDias;
let avisos = [];
let notificacionCaida = false;
let fetchOriginal;

beforeAll(async () => {
  fetchOriginal = global.fetch;
  global.fetch = jest.fn(async (url, opciones = {}) => {
    if (!String(url).endsWith('/comunicaciones/directa')) throw new Error(`Llamada no esperada: ${url}`);
    if (notificacionCaida) return { ok: false, status: 503, json: async () => ({ error: 'Servicio no disponible' }) };
    avisos.push(JSON.parse(opciones.body));
    return { ok: true, status: 201, json: async () => ({}) };
  });
  await pool.preparar(SEMILLA);
  [{ hoy, en_quince: enQuinceDias }] = await consultar(
    "SELECT to_char(CURRENT_DATE, 'YYYY-MM-DD') AS hoy, to_char(CURRENT_DATE + 15, 'YYYY-MM-DD') AS en_quince"
  );
}, 30000);

afterAll(async () => {
  global.fetch = fetchOriginal;
  await pool.cerrar();
});

beforeEach(() => {
  notificacionCaida = false;
});

describe('acceso y validaciones', () => {
  test('solo el Administrador de RRHH con sesión formaliza', async () => {
    expect((await formalizar(C1, P_ANA, {}, null)).status).toBe(401);
    expect((await formalizar(C1, P_ANA, {}, sesion('gerente'))).status).toBe(403);
    expect((await formalizar(C1, P_ANA, {}, sesion('empleado', ANA))).status).toBe(403);
  });

  test('rechaza datos inválidos, fechas pasadas y un haber menor al vigente sin cambiar nada', async () => {
    const invalida = await formalizar(C1, P_ANA, { fecha_vigencia: '2026-02-30', haber_mensual_pactado: -5 });
    expect(invalida.status).toBe(400);
    expect(invalida.body.errores.map((e) => e.campo)).toEqual(['fecha_vigencia', 'haber_mensual_pactado']);

    const pasada = await formalizar(C1, P_ANA, { fecha_vigencia: '2020-01-01' });
    expect(pasada.status).toBe(400);
    expect(pasada.body.codigo).toBe('FECHA_PASADA');

    const menor = await formalizar(C1, P_ANA, { haber_mensual_pactado: 3000 });
    expect(menor.status).toBe(409);
    expect(menor.body.codigo).toBe('HABER_MENOR');

    expect(await asignacionActual(ANA)).toEqual({ id_cargo_actual: CAJERO, id_sucursal_actual: SOPOCACHI });
    expect((await historialContratos(ANA)).body).toHaveLength(1);
  });

  test('solo un postulante apto, de esta convocatoria y con contrato', async () => {
    expect((await formalizar(C1, P_CARO)).body.codigo).toBe('POSTULANTE_NO_APTO');
    expect((await formalizar(C1, P_EVA_C2)).status).toBe(404);
    expect((await formalizar(id(99), P_ANA)).status).toBe(404);
    expect((await formalizar(C2, P_CARLA)).body.codigo).toBe('SIN_CONTRATO');
  });
});

describe('criterios 1, 2 y 4: formalizar con vigencia hoy', () => {
  let respuesta;

  beforeAll(async () => {
    respuesta = await formalizar(C1, P_ANA, { haber_mensual_pactado: '6000.50', observaciones: 'Primer lugar del ranking.' });
  });

  test('criterio 1: actualiza cargo, sucursal y asignación con la fecha de vigencia, y devuelve nivel salarial y jerárquico', async () => {
    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toMatchObject({
      id_postulacion: P_ANA,
      id_empleado: ANA,
      cargo_destino: { id_cargo: SUPERVISOR, nombre: 'Supervisor de Cajas', nivel_salarial: 'Mando Medio', cargo_jefe_directo: 'Gerente de Operaciones' },
      sucursal_destino: { id_sucursal: SOPOCACHI, nombre: 'Sopocachi' },
      ascenso: { estado: 'APLICADO', fecha_vigencia: hoy, fecha_formalizacion: hoy, haber_mensual_pactado: 6000.5, formalizado_por: RITA },
    });
    expect(respuesta.body.ascenso.aplicado_en).not.toBeNull();

    expect(await asignacionActual(ANA)).toEqual({ id_cargo_actual: SUPERVISOR, id_sucursal_actual: SOPOCACHI });
    const asignaciones = await consultar(
      `SELECT id_cargo, to_char(fecha_inicio, 'YYYY-MM-DD') AS desde, to_char(fecha_fin, 'YYYY-MM-DD') AS hasta, es_vigente
         FROM asignaciones_empleado WHERE id_empleado = $1 ORDER BY fecha_inicio`,
      [ANA]
    );
    expect(asignaciones).toEqual([
      { id_cargo: CAJERO, desde: '2019-03-01', hasta: hoy, es_vigente: false },
      { id_cargo: SUPERVISOR, desde: hoy, hasta: null, es_vigente: true },
    ]);
  });

  test('criterio 2: queda como adenda ASCENSO en el historial contractual del Kardex', async () => {
    const { body: historial } = await historialContratos(ANA);
    expect(historial).toHaveLength(2);
    const adenda = historial[1];
    expect(adenda).toMatchObject({
      tipo_modificacion: 'ASCENSO',
      es_adenda: true,
      numero_contrato: respuesta.body.ascenso.numero_contrato,
      numero_contrato_anterior: 'CT-ANA',
      fecha_vigencia: hoy,
      tipo_contrato_codigo: 'INDEFINIDO',
      es_version_vigente: true,
      registrado_por: RITA,
    });
    expect(Number(adenda.haber_mensual_pactado)).toBe(6000.5);
    expect(adenda.justificacion).toBe(
      'Ascenso por la convocatoria interna «Supervisor de Cajas - Sopocachi»: de «Cajero» a «Supervisor de Cajas» (nivel salarial Mando Medio). Primer lugar del ranking.'
    );
    expect(adenda.numero_contrato).toBe(`ASC-${P_ANA.replaceAll('-', '').toUpperCase()}`);

    const kardex = await request(app).get(`/empleados/${ANA}/kardex`).set('X-Rol', 'admin');
    expect(kardex.status).toBe(200);
    expect(JSON.stringify(kardex.body)).toContain(adenda.numero_contrato);
  });

  test('criterio 4: cierra la convocatoria y notifica al empleado promovido', async () => {
    const convocatoria = await request(app).get(`/convocatorias/${C1}`).set('Cookie', ADMIN);
    expect(convocatoria.body).toMatchObject({ estado: 'CERRADA', esta_abierta: false, acepta_postulaciones: false });
    expect(respuesta.body.convocatoria.estado).toBe('CERRADA');

    expect(respuesta.body.ascenso.notificado_en).not.toBeNull();
    expect(respuesta.body.ascenso.error_notificacion).toBeNull();
    const aviso = avisoPara(ANA);
    expect(aviso.asunto).toBe('Ascenso formalizado: Supervisor de Cajas');
    expect(aviso.contenido).toContain('Nuevo cargo: Supervisor de Cajas (Sopocachi).');
    expect(aviso.contenido).toContain('Nivel salarial: Mando Medio.');
    expect(aviso.contenido).toContain('Reporta a: Gerente de Operaciones.');
    expect(aviso.contenido).toContain(respuesta.body.ascenso.numero_contrato);

    const postulacionCerrada = await request(app).post(`/convocatorias/${C1}/postulaciones`).set('X-Empleado-Id', CARO).set('X-Rol', 'empleado');
    expect(postulacionCerrada.body.codigo).toBe('CONVOCATORIA_NO_VIGENTE');
  });

  test('una convocatoria cubre una sola vacante y la postulación formalizada no se vuelve a validar', async () => {
    expect((await formalizar(C1, P_ANA)).body.codigo).toBe('YA_FORMALIZADO');
    expect((await formalizar(C1, P_EVA_C1)).body.codigo).toBe('CONVOCATORIA_RESUELTA');
    const revalidar = await request(app).post(`/convocatorias/${C1}/postulaciones/${P_ANA}/validacion`).set('X-Rol', 'admin');
    expect(revalidar.body.codigo).toBe('YA_FORMALIZADO');

    const { body } = await request(app).get(`/convocatorias/${C1}/postulaciones`).set('X-Rol', 'admin');
    expect(body.ascenso_formalizado).toMatchObject({ id_postulacion: P_ANA, ascenso: { estado: 'APLICADO' } });
    expect(body.ranking.find((p) => p.id_postulacion === P_EVA_C1).ascenso).toBeNull();
  });
});

describe('criterio 3: vigencia futura', () => {
  let respuesta;

  beforeAll(async () => {
    respuesta = await formalizar(C2, P_EVA_C2, { fecha_vigencia: enQuinceDias });
  });

  test('queda programado: el cargo no cambia todavía y el haber por defecto es el referencial del cargo', async () => {
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.ascenso).toMatchObject({ estado: 'PROGRAMADO', fecha_vigencia: enQuinceDias, haber_mensual_pactado: 7000, aplicado_en: null });
    expect(await asignacionActual(EVA)).toEqual({ id_cargo_actual: CAJERO, id_sucursal_actual: SOPOCACHI });
    expect(avisoPara(EVA).contenido).toContain('Nuevo cargo: Jefe de Área (El Alto).');
  });

  test('la planilla toma el nuevo haber desde la fecha de vigencia (versiones vigentes del contrato)', async () => {
    const { body } = await request(app).get(`/contratos/vigentes?desde=${hoy}&hasta=${enQuinceDias}`).set('X-Rol', 'admin');
    const tramos = body.filter((v) => v.id_empleado === EVA).map((v) => [v.vigente_desde, v.vigente_hasta, v.haber_mensual_pactado]);
    const [{ ayer }] = await consultar("SELECT to_char(CURRENT_DATE + 14, 'YYYY-MM-DD') AS ayer");
    expect(tramos).toEqual([
      ['2020-03-01', ayer, 3300],
      [enQuinceDias, null, 7000],
    ]);
  });

  test('con un ascenso programado no se formaliza otro para el mismo empleado', async () => {
    const res = await formalizar(C3, P_EVA_C3);
    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('ASCENSO_PROGRAMADO');
  });

  test('el job no lo aplica antes de la fecha', async () => {
    expect((await aplicarAscensosProgramados()).aplicados).toEqual([]);
    expect(await asignacionActual(EVA)).toEqual({ id_cargo_actual: CAJERO, id_sucursal_actual: SOPOCACHI });
  });

  test('al llegar la fecha el job aplica el cambio; si falla, queda programado con el error y reintenta al día siguiente', async () => {
    // Simula que llegó la fecha de vigencia.
    await pool.query(`UPDATE postulaciones_ascenso SET fecha_vigencia_ascenso = CURRENT_DATE WHERE id_postulacion = $1`, [P_EVA_C2]);
    await pool.query(`UPDATE cargos SET esta_activo = FALSE WHERE id_cargo = $1`, [JEFE_AREA]);

    const fallo = await aplicarAscensosProgramados();
    expect(fallo.aplicados).toEqual([]);
    expect(fallo.fallidos.map((f) => f.id_postulacion)).toEqual([P_EVA_C2]);
    const [pendiente] = await consultar('SELECT estado_ascenso, error_aplicacion_ascenso FROM postulaciones_ascenso WHERE id_postulacion = $1', [P_EVA_C2]);
    expect(pendiente.estado_ascenso).toBe('PROGRAMADO');
    expect(pendiente.error_aplicacion_ascenso).toContain('no está activo');

    await pool.query(`UPDATE cargos SET esta_activo = TRUE WHERE id_cargo = $1`, [JEFE_AREA]);
    expect((await aplicarAscensosProgramados()).aplicados).toEqual([P_EVA_C2]);
    expect(await asignacionActual(EVA)).toEqual({ id_cargo_actual: JEFE_AREA, id_sucursal_actual: EL_ALTO });
    const [aplicado] = await consultar(
      'SELECT estado_ascenso, ascenso_aplicado_en IS NOT NULL AS aplicado, error_aplicacion_ascenso FROM postulaciones_ascenso WHERE id_postulacion = $1',
      [P_EVA_C2]
    );
    expect(aplicado).toEqual({ estado_ascenso: 'APLICADO', aplicado: true, error_aplicacion_ascenso: null });
    expect((await aplicarAscensosProgramados()).aplicados).toEqual([]);
  });
});

describe('notificación fallida', () => {
  test('el ascenso queda formalizado aunque NotificationService falle, y el aviso se reintenta', async () => {
    notificacionCaida = true;
    const res = await formalizar(C3, P_BETO);
    expect(res.status).toBe(201);
    // El haber vigente de Beto (6000) supera el referencial del cargo (5800): se conserva el mayor.
    expect(res.body.ascenso).toMatchObject({ estado: 'APLICADO', haber_mensual_pactado: 6000, notificado_en: null });
    expect(res.body.ascenso.error_notificacion).toContain('503');
    expect(await asignacionActual(BETO)).toEqual({ id_cargo_actual: SUPERVISOR, id_sucursal_actual: EL_ALTO });

    notificacionCaida = false;
    const reintento = () =>
      request(app).post(`/convocatorias/${C3}/postulaciones/${P_BETO}/formalizacion/notificacion`).set('Cookie', ADMIN);
    const ok = await reintento();
    expect(ok.status).toBe(200);
    expect(ok.body.ascenso.notificado_en).not.toBeNull();
    expect(ok.body.ascenso.error_notificacion).toBeNull();
    expect(avisos.filter((a) => a.id_empleado_destinatario === BETO)).toHaveLength(1);
    expect((await reintento()).body.codigo).toBe('YA_NOTIFICADO');
  });
});
