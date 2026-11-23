process.env.JWT_SECRET = 'secreto-de-prueba-convocatorias';

jest.mock('../db/pool', () => require('./helpers/bdEnMemoria').crearBdEnMemoria());

const jwt = require('jsonwebtoken');
const request = require('supertest');
const pool = require('../db/pool');
const app = require('../index');
const { cerrarConvocatoriasVencidas } = require('../src/jobs/cierreConvocatoriasCron');
const { hoyEnZona } = require('../src/utils/fechas');

const id = (n) => `c0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const ACTIVA = id(1);
const SUSPENDIDA = id(2);
const DESVINCULADA = id(3);
const RRHH = id(4);
const NUEVO = id(5);
const JEFA_MIRAFLORES = id(6);
const INEXISTENTE = id(99);
const CARGO = id(20);
const CARGO_INACTIVO = id(21);
const CARGO_JEFATURA = id(22);
const SUCURSAL = id(30);
const MIRAFLORES = id(31);

const SEMILLA = `
INSERT INTO departamentos (id_departamento, codigo, nombre) VALUES ('${id(10)}', 'OPS', 'Operaciones');
INSERT INTO cargos (id_cargo, id_departamento, codigo, nombre, salario_base_referencial, funciones_clave, requisitos_minimos, esta_activo)
  VALUES ('${CARGO}', '${id(10)}', 'SUP', 'Supervisor de sucursal', 5000, 'Supervisar', 'Licenciatura', TRUE),
         ('${CARGO_INACTIVO}', '${id(10)}', 'OLD', 'Cargo en desuso', 3000, 'Ninguna', 'Ninguno', FALSE),
         ('${CARGO_JEFATURA}', '${id(10)}', 'JEF', 'Jefe de sucursal', 7000, 'Dirigir', 'Licenciatura', TRUE);
INSERT INTO sucursales (id_sucursal, codigo_sucursal, nombre, direccion) VALUES
  ('${SUCURSAL}', 'SOP', 'Sopocachi', 'Av. 6 de Agosto'),
  ('${MIRAFLORES}', 'MIR', 'Miraflores', 'Av. Busch');
INSERT INTO estados_empleado VALUES (1, 'ACTIVO', 'Activo', TRUE), (2, 'SUSPENDIDO', 'Suspendido', FALSE), (3, 'DESVINCULADO', 'Desvinculado', FALSE);
INSERT INTO empleados (id_empleado, numero_documento, nombres, primer_apellido, fecha_nacimiento, genero, telefono_celular,
                       correo_personal, direccion_domicilio, fecha_ingreso, id_cargo_actual, id_sucursal_actual, id_estado_empleado) VALUES
  ('${ACTIVA}', '4001', 'Ana', 'Peñaranda', '1990-03-14', 'Femenino', '71234567', 'ana@correo.com', 'Sopocachi', '2024-01-01', '${CARGO}', '${SUCURSAL}', 1),
  ('${SUSPENDIDA}', '4002', 'Sofía', 'Vargas', '1988-05-02', 'Femenino', '71234568', 'sofia@correo.com', 'Centro', '2022-01-01', '${CARGO}', '${SUCURSAL}', 2),
  ('${DESVINCULADA}', '4003', 'Diego', 'Rojas', '1985-07-21', 'Masculino', '71234569', 'diego@correo.com', 'Centro', '2019-01-01', '${CARGO}', '${SUCURSAL}', 3),
  ('${RRHH}', '4004', 'Rita', 'Mamani', '1980-01-01', 'Femenino', '71234570', 'rita@correo.com', 'Centro', '2015-01-01', '${CARGO}', '${SUCURSAL}', 1),
  ('${NUEVO}', '4005', 'Nico', 'Flores', '1999-01-01', 'Masculino', '71234571', 'nico@correo.com', 'Centro', CURRENT_DATE - 60, '${CARGO}', '${SUCURSAL}', 1),
  ('${JEFA_MIRAFLORES}', '4006', 'Julia', 'Choque', '1984-06-06', 'Femenino', '71234572', 'julia@correo.com', 'Miraflores', '2016-01-01', '${CARGO_JEFATURA}', '${MIRAFLORES}', 1);
`;

const insertarConvocatoria = (titulo, inicio, cierre, { cerradaManual = false } = {}) =>
  pool.query(
    `INSERT INTO convocatorias_ascenso
       (id_cargo, id_sucursal, titulo, descripcion_requisitos, nota_minima_desempeno, fecha_inicio_postulacion,
        fecha_cierre_postulacion, esta_abierta, cerrada_en)
     VALUES ($1, $2, $3, 'Requisitos de ejemplo', 70, CURRENT_DATE + $4::int, CURRENT_DATE + $5::int, $6, CASE WHEN $6 THEN NULL ELSE CURRENT_TIMESTAMP END)`,
    [CARGO, SUCURSAL, titulo, inicio, cierre, !cerradaManual]
  );

const desplazar = (dias) => {
  const fecha = new Date(`${hoyEnZona()}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
};

const token = (idEmpleado, rol, { secreto = process.env.JWT_SECRET, expiresIn = 3600 } = {}) =>
  jwt.sign({ rol }, secreto, { algorithm: 'HS256', subject: idEmpleado, expiresIn });

const sesion = (idEmpleado, rol = 'empleado') => ({ Cookie: `rrhh_sesion=${token(idEmpleado, rol)}` });
const cabecerasEmpleado = (idEmpleado) => sesion(idEmpleado, 'empleado');
const cabecerasRrhh = sesion(RRHH, 'admin');

const convocatoriaValida = (cambios = {}) => ({
  id_cargo: CARGO_JEFATURA,
  id_sucursal: SUCURSAL,
  titulo: 'Jefe de sucursal Sopocachi',
  descripcion_requisitos: 'Licenciatura afín y experiencia en atención al cliente.',
  meses_antiguedad_minima: 12,
  nota_minima_desempeno: 75,
  fecha_inicio_postulacion: desplazar(0),
  fecha_cierre_postulacion: desplazar(15),
  ...cambios,
});

const publicar = (cuerpo = convocatoriaValida(), cabeceras = cabecerasRrhh) =>
  request(app).post('/convocatorias').set(cabeceras).send(cuerpo);

const respuestaNotificacion = (cuerpo, estado = 201) => ({
  ok: estado < 400,
  status: estado,
  json: async () => cuerpo,
});

const filaDe = async (titulo) =>
  (await pool.query('SELECT * FROM convocatorias_ascenso WHERE titulo = $1', [titulo])).rows[0];

const titulos = (res) => res.body.convocatorias.map((c) => c.titulo);

let puestosCreados = 0;
const puestoVacante = async () => {
  puestosCreados += 1;
  const idCargo = id(300 + puestosCreados);
  await pool.query(
    `INSERT INTO cargos (id_cargo, id_departamento, codigo, nombre, salario_base_referencial, funciones_clave, requisitos_minimos)
     VALUES ($1, $2, $3, $4, 6000, 'Coordinar', 'Licenciatura')`,
    [idCargo, id(10), `JT${puestosCreados}`, `Jefe de turno ${puestosCreados}`]
  );
  return idCargo;
};

const publicarEnPuestoNuevo = async (cambios = {}) => publicar(convocatoriaValida({ id_cargo: await puestoVacante(), ...cambios }));

const destinatariosAvisados = () =>
  global.fetch.mock.calls.map(([, opciones]) => JSON.parse(opciones.body).id_empleado_destinatario).sort();

const filasDestinatarios = async (idConvocatoria) =>
  (await pool.query('SELECT * FROM destinatarios_convocatoria WHERE id_convocatoria = $1 ORDER BY id_empleado', [idConvocatoria])).rows;

let fetchOriginal;

beforeAll(async () => {
  await pool.preparar(SEMILLA);
  await insertarConvocatoria('Abierta con plazo', -5, 10);
  await insertarConvocatoria('Abierta que cierra hoy', -10, 0);
  await insertarConvocatoria('Programada', 3, 20);
  await insertarConvocatoria('Vencida sin cerrar', -30, -2);
  await insertarConvocatoria('Cerrada por RRHH', -20, 15, { cerradaManual: true });
}, 30000);

afterAll(() => pool.cerrar());

beforeEach(() => {
  fetchOriginal = global.fetch;
  global.fetch = jest.fn().mockResolvedValue(respuestaNotificacion({ mensaje: 'Mensaje directo enviado' }));
});

afterEach(() => {
  global.fetch = fetchOriginal;
});

describe('identidad tomada de la sesión (JWT de AuthService)', () => {
  test.each([
    ['GET', '/convocatorias'],
    ['GET', '/convocatorias/gestion'],
    ['POST', '/convocatorias'],
  ])('%s %s sin sesión responde 401', async (metodo, ruta) => {
    const res = await request(app)[metodo.toLowerCase()](ruta).set({ 'X-Rol': 'admin', 'X-Empleado-Id': RRHH });
    expect(res.status).toBe(401);
    expect(res.body.codigo).toBe('SIN_SESION');
  });

  test('un token firmado con otro secreto no vale', async () => {
    const res = await request(app)
      .get('/convocatorias')
      .set({ Cookie: `rrhh_sesion=${token(ACTIVA, 'empleado', { secreto: 'otro-secreto' })}` });
    expect(res.status).toBe(401);
  });

  test('un token vencido no vale', async () => {
    const res = await request(app)
      .get('/convocatorias')
      .set({ Cookie: `rrhh_sesion=${token(ACTIVA, 'empleado', { expiresIn: -10 })}` });
    expect(res.status).toBe(401);
  });

  test('también acepta el token en Authorization: Bearer', async () => {
    const res = await request(app).get('/convocatorias').set('Authorization', `Bearer ${token(ACTIVA, 'empleado')}`);
    expect(res.status).toBe(200);
  });

  test('un empleado de baja no puede hacerse pasar por uno activo con X-Empleado-Id', async () => {
    const res = await request(app).get('/convocatorias').set({ ...cabecerasEmpleado(DESVINCULADA), 'X-Empleado-Id': ACTIVA });
    expect(res.status).toBe(403);
  });

  test('X-Rol no eleva los permisos de la sesión', async () => {
    const gestion = await request(app).get('/convocatorias/gestion').set({ ...cabecerasEmpleado(ACTIVA), 'X-Rol': 'admin' });
    expect(gestion.status).toBe(403);
    const publicacion = await publicar(convocatoriaValida(), { ...cabecerasEmpleado(ACTIVA), 'X-Rol': 'admin' });
    expect(publicacion.status).toBe(403);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('visibilidad de las convocatorias internas según el estado del empleado (KAN-80)', () => {
  test('un empleado activo ve las convocatorias vigentes: abiertas y programadas', async () => {
    const res = await request(app).get('/convocatorias').set(cabecerasEmpleado(ACTIVA));
    expect(res.status).toBe(200);
    expect(titulos(res).sort()).toEqual(['Abierta con plazo', 'Abierta que cierra hoy', 'Programada']);
    expect(res.body.total).toBe(3);
  });

  test('las vigentes salen primero las abiertas y por cierre más próximo', async () => {
    const res = await request(app).get('/convocatorias').set(cabecerasEmpleado(ACTIVA));
    expect(titulos(res)).toEqual(['Abierta que cierra hoy', 'Abierta con plazo', 'Programada']);
  });

  test('cada convocatoria indica si acepta postulaciones y cuántos días faltan', async () => {
    const res = await request(app).get('/convocatorias').set(cabecerasEmpleado(ACTIVA));
    const por = Object.fromEntries(res.body.convocatorias.map((c) => [c.titulo, c]));
    expect(por['Abierta con plazo']).toMatchObject({ estado: 'ABIERTA', acepta_postulaciones: true, dias_para_cierre: 10 });
    expect(por['Abierta que cierra hoy']).toMatchObject({ estado: 'ABIERTA', dias_para_cierre: 0 });
    expect(por.Programada).toMatchObject({ estado: 'PROGRAMADA', acepta_postulaciones: false, dias_para_cierre: 20 });
  });

  test('el empleado activo puede pedir las cerradas con el filtro de estado', async () => {
    const res = await request(app).get('/convocatorias?estado=cerrada').set(cabecerasEmpleado(ACTIVA));
    expect(res.status).toBe(200);
    expect(titulos(res).sort()).toEqual(['Cerrada por RRHH', 'Vencida sin cerrar']);
    expect(res.body.convocatorias.every((c) => c.acepta_postulaciones === false && c.dias_para_cierre === null)).toBe(true);
  });

  test('un filtro de estado inválido responde 400', async () => {
    const res = await request(app).get('/convocatorias?estado=pendiente').set(cabecerasEmpleado(ACTIVA));
    expect(res.status).toBe(400);
  });

  test.each([
    ['suspendido', SUSPENDIDA],
    ['desvinculado', DESVINCULADA],
    ['inexistente', INEXISTENTE],
  ])('un empleado %s no ve ninguna convocatoria', async (_estado, idEmpleado) => {
    const res = await request(app).get('/convocatorias').set(cabecerasEmpleado(idEmpleado));
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/empleados activos/i);
    expect(res.body.convocatorias).toBeUndefined();
  });

  test('un empleado no activo tampoco accede al detalle', async () => {
    const { id_convocatoria: idConvocatoria } = await filaDe('Abierta con plazo');
    const res = await request(app).get(`/convocatorias/${idConvocatoria}`).set(cabecerasEmpleado(DESVINCULADA));
    expect(res.status).toBe(403);
  });

  test('un empleado activo ve el detalle de una convocatoria', async () => {
    const { id_convocatoria: idConvocatoria } = await filaDe('Abierta con plazo');
    const res = await request(app).get(`/convocatorias/${idConvocatoria}`).set(cabecerasEmpleado(ACTIVA));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ titulo: 'Abierta con plazo', cargo: 'Supervisor de sucursal', sucursal: 'Sopocachi', estado: 'ABIERTA' });
  });

  test('una convocatoria inexistente responde 404 al empleado activo', async () => {
    const res = await request(app).get(`/convocatorias/${INEXISTENTE}`).set(cabecerasEmpleado(ACTIVA));
    expect(res.status).toBe(404);
  });

  test('RRHH consulta el detalle sin ser empleado activo identificado', async () => {
    const { id_convocatoria: idConvocatoria } = await filaDe('Programada');
    const res = await request(app).get(`/convocatorias/${idConvocatoria}`).set(sesion(INEXISTENTE, 'gerente'));
    expect(res.status).toBe(200);
  });

  test('la vista de gestión muestra todas las convocatorias a RRHH y gerencia', async () => {
    for (const rol of ['admin', 'gerente']) {
      const res = await request(app).get('/convocatorias/gestion').set(sesion(RRHH, rol));
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(5);
    }
  });

  test('la vista de gestión no está disponible para el rol empleado', async () => {
    const res = await request(app).get('/convocatorias/gestion').set(cabecerasEmpleado(ACTIVA));
    expect(res.status).toBe(403);
  });

  test('solo el administrador de RRHH publica convocatorias', async () => {
    for (const rol of ['empleado', 'gerente', 'supervisor']) {
      const res = await publicar(convocatoriaValida(), sesion(RRHH, rol));
      expect(res.status).toBe(403);
    }
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('validación de la publicación', () => {
  const rechaza = async (cambios, campo) => {
    const res = await publicar(convocatoriaValida(cambios));
    expect(res.status).toBe(400);
    if (campo) expect(res.body.errores.map((e) => e.campo)).toContain(campo);
    expect(global.fetch).not.toHaveBeenCalled();
  };

  test('exige los datos obligatorios', async () => {
    const res = await publicar({});
    expect(res.status).toBe(400);
    expect(res.body.errores.map((e) => e.campo)).toEqual(
      expect.arrayContaining(['id_cargo', 'id_sucursal', 'titulo', 'descripcion_requisitos', 'nota_minima_desempeno', 'fecha_cierre_postulacion'])
    );
  });

  test('rechaza un cargo inactivo', () => rechaza({ id_cargo: CARGO_INACTIVO }, 'id_cargo'));
  test('rechaza un cargo que no existe', () => rechaza({ id_cargo: INEXISTENTE }, 'id_cargo'));
  test('rechaza una sucursal que no existe', () => rechaza({ id_sucursal: INEXISTENTE }, 'id_sucursal'));
  test('rechaza una nota mayor a 100', () => rechaza({ nota_minima_desempeno: 101 }, 'nota_minima_desempeno'));
  test('rechaza una nota con más de 2 decimales', () => rechaza({ nota_minima_desempeno: '70.555' }, 'nota_minima_desempeno'));
  test('rechaza antigüedad negativa', () => rechaza({ meses_antiguedad_minima: -1 }, 'meses_antiguedad_minima'));
  test('rechaza un inicio anterior a hoy', () => rechaza({ fecha_inicio_postulacion: desplazar(-1) }, 'fecha_inicio_postulacion'));
  test('rechaza un cierre anterior al inicio', () =>
    rechaza({ fecha_inicio_postulacion: desplazar(5), fecha_cierre_postulacion: desplazar(4) }, 'fecha_cierre_postulacion'));
  test('rechaza fechas con formato inválido', () => rechaza({ fecha_cierre_postulacion: '31/12/2030' }, 'fecha_cierre_postulacion'));
  test('rechaza una fecha de calendario inexistente', () => rechaza({ fecha_cierre_postulacion: '2030-02-31' }, 'fecha_cierre_postulacion'));
});

describe('el cargo debe estar vacante en la sucursal', () => {
  test('no se publica un cargo que un empleado activo ya ocupa en esa sucursal', async () => {
    const res = await publicar(convocatoriaValida({ id_cargo: CARGO, titulo: 'Supervisor ocupado' }));
    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('CARGO_OCUPADO');
    expect(res.body.error).toMatch(/Supervisor de sucursal/);
    expect(res.body.error).toMatch(/Ana Peñaranda/);
    expect(res.body.error).not.toMatch(/Sofía|Diego/);
    expect(await filaDe('Supervisor ocupado')).toBeUndefined();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('un cargo ocupado en otra sucursal sí está vacante en esta', async () => {
    const res = await publicar(convocatoriaValida({ titulo: 'Jefatura vacante en Sopocachi' }));
    expect(res.status).toBe(201);
  });

  test('el mismo cargo sí está ocupado en la sucursal donde trabaja su titular', async () => {
    const res = await publicar(convocatoriaValida({ id_sucursal: MIRAFLORES, titulo: 'Jefatura ocupada en Miraflores' }));
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Julia Choque/);
  });

  test('un cargo que solo ocupan empleados de baja o suspendidos está vacante', async () => {
    const idCargo = await puestoVacante();
    await pool.query('UPDATE empleados SET id_cargo_actual = $1 WHERE id_empleado IN ($2, $3)', [idCargo, SUSPENDIDA, DESVINCULADA]);
    const res = await publicar(convocatoriaValida({ id_cargo: idCargo, titulo: 'Puesto que dejó un empleado de baja' }));
    await pool.query('UPDATE empleados SET id_cargo_actual = $1 WHERE id_empleado IN ($2, $3)', [CARGO, SUSPENDIDA, DESVINCULADA]);
    expect(res.status).toBe(201);
  });

  test('no se publica una segunda convocatoria vigente para el mismo cargo y sucursal', async () => {
    const idCargo = await puestoVacante();
    expect((await publicar(convocatoriaValida({ id_cargo: idCargo, titulo: 'Primera del puesto' }))).status).toBe(201);
    const repetida = await publicar(convocatoriaValida({ id_cargo: idCargo, titulo: 'Segunda del puesto' }));
    expect(repetida.status).toBe(409);
    expect(repetida.body.codigo).toBe('CONVOCATORIA_DUPLICADA');
    expect(repetida.body.error).toMatch(/Primera del puesto/);
  });
});

describe('aviso a los empleados elegibles', () => {
  test('al publicar se envía un mensaje directo a cada empleado activo que cumple la antigüedad mínima', async () => {
    const res = await publicarEnPuestoNuevo({ titulo: 'Notificada correctamente' });
    expect(res.status).toBe(201);
    expect(res.body.estado).toBe('ABIERTA');
    expect(res.body.notificacion).toMatchObject({ estado: 'ENTREGADA', destinatarios: 3, error: null });
    expect(res.body.notificacion.notificada_en).toBeTruthy();

    expect(destinatariosAvisados()).toEqual([ACTIVA, JEFA_MIRAFLORES, RRHH].sort());
    for (const [url, opciones] of global.fetch.mock.calls) {
      expect(url).toMatch(/\/comunicaciones\/directa$/);
      expect(opciones.method).toBe('POST');
      expect(opciones.headers).toMatchObject({ 'X-Rol': 'admin', 'X-Usuario-Id': RRHH });
    }
    const cuerpo = JSON.parse(global.fetch.mock.calls.find(([, o]) => JSON.parse(o.body).id_empleado_destinatario === ACTIVA)[1].body);
    expect(cuerpo.requiere_confirmacion).toBe(false);
    expect(cuerpo.asunto).toContain('Notificada correctamente');
    expect(cuerpo.contenido).toMatch(/^Ana,/);
    expect(cuerpo.contenido).toMatch(/Jefe de turno \d+/);
    expect(cuerpo.contenido).toContain('Sopocachi');
    expect(cuerpo.contenido).toContain('12 meses');
    expect(cuerpo.contenido).toContain('75');
    expect(cuerpo.contenido).toMatch(/\d{2}\/\d{2}\/\d{4}/);

    const filas = await filasDestinatarios(res.body.id_convocatoria);
    expect(filas.map((f) => f.id_empleado)).toEqual([ACTIVA, JEFA_MIRAFLORES, RRHH].sort());
    expect(filas.every((f) => f.notificado_en !== null && f.ultimo_error === null)).toBe(true);
  });

  test('no se avisa a quien no cumple la antigüedad, ni a los inactivos, ni a quien ya ocupa el cargo', async () => {
    const idCargo = await puestoVacante();
    await pool.query('UPDATE empleados SET id_cargo_actual = $1 WHERE id_empleado = $2', [idCargo, JEFA_MIRAFLORES]);
    const res = await publicar(convocatoriaValida({ id_cargo: idCargo, titulo: 'Solo elegibles' }));
    await pool.query('UPDATE empleados SET id_cargo_actual = $1 WHERE id_empleado = $2', [CARGO_JEFATURA, JEFA_MIRAFLORES]);
    expect(res.status).toBe(201);
    expect(destinatariosAvisados()).toEqual([ACTIVA, RRHH].sort());
  });

  test('la antigüedad se cuenta hasta la fecha de cierre', async () => {
    const res = await publicarEnPuestoNuevo({ titulo: 'Exige tres años', meses_antiguedad_minima: 36 });
    expect(res.body.notificacion.destinatarios).toBe(2);
    expect(destinatariosAvisados()).toEqual([JEFA_MIRAFLORES, RRHH].sort());
    const filas = await filasDestinatarios(res.body.id_convocatoria);
    expect(filas.every((f) => f.meses_antiguedad >= 36)).toBe(true);
  });

  test('si nadie cumple la antigüedad, se publica sin avisos', async () => {
    const res = await publicarEnPuestoNuevo({ titulo: 'Nadie cumple', meses_antiguedad_minima: 600 });
    expect(res.status).toBe(201);
    expect(res.body.notificacion).toMatchObject({ estado: 'ENTREGADA', destinatarios: 0 });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('si NotificationService no responde, la convocatoria se publica igual y queda como fallida', async () => {
    global.fetch.mockRejectedValue(new Error('connect ECONNREFUSED'));
    const res = await publicarEnPuestoNuevo({ titulo: 'Sin servicio de mensajes' });
    expect(res.status).toBe(201);
    expect(res.body.notificacion.estado).toBe('FALLIDA');
    expect(res.body.notificacion.error).toMatch(/No se entregaron 3 de 3 avisos/);
    expect(res.body.notificacion.error).toMatch(/ECONNREFUSED/);
    expect(res.body.notificacion.destinatarios).toBeNull();
    expect((await filaDe('Sin servicio de mensajes')).estado_notificacion).toBe('FALLIDA');
  });

  test('el reintento solo reenvía a quienes no recibieron el aviso', async () => {
    global.fetch.mockImplementation(async (url, opciones) =>
      JSON.parse(opciones.body).id_empleado_destinatario === ACTIVA
        ? respuestaNotificacion({ error: 'Caído' }, 503)
        : respuestaNotificacion({ mensaje: 'ok' })
    );
    const creada = await publicarEnPuestoNuevo({ titulo: 'Para reintentar' });
    expect(creada.body.notificacion.estado).toBe('FALLIDA');
    expect(creada.body.notificacion.error).toMatch(/No se entregaron 1 de 3 avisos: NotificationService respondió 503/);
    const pendiente = (await filasDestinatarios(creada.body.id_convocatoria)).find((f) => f.id_empleado === ACTIVA);
    expect(pendiente).toMatchObject({ notificado_en: null });
    expect(pendiente.ultimo_error).toMatch(/503/);

    global.fetch.mockReset();
    global.fetch.mockResolvedValue(respuestaNotificacion({ mensaje: 'ok' }));
    const reintento = await request(app).post(`/convocatorias/${creada.body.id_convocatoria}/notificacion`).set(cabecerasRrhh);
    expect(reintento.status).toBe(200);
    expect(reintento.body.notificacion).toMatchObject({ estado: 'ENTREGADA', destinatarios: 3, error: null });
    expect(destinatariosAvisados()).toEqual([ACTIVA]);

    const repetido = await request(app).post(`/convocatorias/${creada.body.id_convocatoria}/notificacion`).set(cabecerasRrhh);
    expect(repetido.status).toBe(409);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('no se notifica una convocatoria cerrada', async () => {
    const { id_convocatoria: idConvocatoria } = await filaDe('Cerrada por RRHH');
    const res = await request(app).post(`/convocatorias/${idConvocatoria}/notificacion`).set(cabecerasRrhh);
    expect(res.status).toBe(409);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('reintentar la notificación de una convocatoria inexistente responde 404', async () => {
    const res = await request(app).post(`/convocatorias/${INEXISTENTE}/notificacion`).set(cabecerasRrhh);
    expect(res.status).toBe(404);
  });

  test('solo el administrador puede reintentar una notificación', async () => {
    const { id_convocatoria: idConvocatoria } = await filaDe('Abierta con plazo');
    for (const cabeceras of [cabecerasEmpleado(ACTIVA), sesion(RRHH, 'gerente')]) {
      const res = await request(app).post(`/convocatorias/${idConvocatoria}/notificacion`).set(cabeceras);
      expect(res.status).toBe(403);
    }
  });

  test('una convocatoria programada se publica y notifica sin abrirse todavía', async () => {
    const res = await publicarEnPuestoNuevo({ titulo: 'Programada nueva', fecha_inicio_postulacion: desplazar(7), fecha_cierre_postulacion: desplazar(30) });
    expect(res.status).toBe(201);
    expect(res.body.estado).toBe('PROGRAMADA');
    expect(res.body.acepta_postulaciones).toBe(false);
    expect(res.body.notificacion.estado).toBe('ENTREGADA');
  });
});

describe('cierre automático al vencer la fecha de cierre', () => {
  test('una convocatoria vencida figura como cerrada aunque el proceso aún no haya corrido', async () => {
    const vigentes = await request(app).get('/convocatorias').set(cabecerasEmpleado(ACTIVA));
    expect(titulos(vigentes)).not.toContain('Vencida sin cerrar');
    const fila = await filaDe('Vencida sin cerrar');
    expect(fila.esta_abierta).toBe(true);
  });

  test('el cierre automático cierra solo las vencidas que seguían abiertas', async () => {
    const cerradas = await cerrarConvocatoriasVencidas();
    const vencida = await filaDe('Vencida sin cerrar');
    expect(cerradas).toEqual([vencida.id_convocatoria]);
    expect(vencida.esta_abierta).toBe(false);
    expect(vencida.cerrada_en).not.toBeNull();
  });

  test('una convocatoria que cierra hoy sigue abierta hasta el día siguiente', async () => {
    const fila = await filaDe('Abierta que cierra hoy');
    expect(fila.esta_abierta).toBe(true);
    expect(fila.cerrada_en).toBeNull();
  });

  test('las convocatorias vigentes y la cerrada por RRHH no se modifican', async () => {
    const [vigente, programada, manual] = await Promise.all([filaDe('Abierta con plazo'), filaDe('Programada'), filaDe('Cerrada por RRHH')]);
    expect([vigente.esta_abierta, programada.esta_abierta, manual.esta_abierta]).toEqual([true, true, false]);
  });

  test('volver a correr el cierre no cierra nada más', async () => {
    expect(await cerrarConvocatoriasVencidas()).toEqual([]);
  });

  test('el cierre automático no envía notificaciones', async () => {
    await cerrarConvocatoriasVencidas();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('tras el cierre, la convocatoria deja de estar visible entre las vigentes y sigue consultable entre las cerradas', async () => {
    const vigentes = await request(app).get('/convocatorias').set(cabecerasEmpleado(ACTIVA));
    expect(titulos(vigentes)).not.toContain('Vencida sin cerrar');
    const cerradas = await request(app).get('/convocatorias?estado=CERRADA').set(cabecerasEmpleado(ACTIVA));
    expect(titulos(cerradas)).toContain('Vencida sin cerrar');
  });
});
