jest.mock('../db/pool', () => require('./helpers/bdEnMemoria').crearBdEnMemoria());

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
const INEXISTENTE = id(99);
const CARGO = id(20);
const CARGO_INACTIVO = id(21);
const SUCURSAL = id(30);

const SEMILLA = `
INSERT INTO departamentos (id_departamento, codigo, nombre) VALUES ('${id(10)}', 'OPS', 'Operaciones');
INSERT INTO cargos (id_cargo, id_departamento, codigo, nombre, salario_base_referencial, funciones_clave, requisitos_minimos, esta_activo)
  VALUES ('${CARGO}', '${id(10)}', 'SUP', 'Supervisor de sucursal', 5000, 'Supervisar', 'Licenciatura', TRUE),
         ('${CARGO_INACTIVO}', '${id(10)}', 'OLD', 'Cargo en desuso', 3000, 'Ninguna', 'Ninguno', FALSE);
INSERT INTO sucursales (id_sucursal, codigo_sucursal, nombre, direccion) VALUES ('${SUCURSAL}', 'SOP', 'Sopocachi', 'Av. 6 de Agosto');
INSERT INTO estados_empleado VALUES (1, 'ACTIVO', 'Activo', TRUE), (2, 'SUSPENDIDO', 'Suspendido', FALSE), (3, 'DESVINCULADO', 'Desvinculado', FALSE);
INSERT INTO empleados (id_empleado, numero_documento, nombres, primer_apellido, fecha_nacimiento, genero, telefono_celular,
                       correo_personal, direccion_domicilio, fecha_ingreso, id_cargo_actual, id_sucursal_actual, id_estado_empleado) VALUES
  ('${ACTIVA}', '4001', 'Ana', 'Peñaranda', '1990-03-14', 'Femenino', '71234567', 'ana@correo.com', 'Sopocachi', '2024-01-01', '${CARGO}', '${SUCURSAL}', 1),
  ('${SUSPENDIDA}', '4002', 'Sofía', 'Vargas', '1988-05-02', 'Femenino', '71234568', 'sofia@correo.com', 'Centro', '2022-01-01', '${CARGO}', '${SUCURSAL}', 2),
  ('${DESVINCULADA}', '4003', 'Diego', 'Rojas', '1985-07-21', 'Masculino', '71234569', 'diego@correo.com', 'Centro', '2019-01-01', '${CARGO}', '${SUCURSAL}', 3),
  ('${RRHH}', '4004', 'Rita', 'Mamani', '1980-01-01', 'Femenino', '71234570', 'rita@correo.com', 'Centro', '2015-01-01', '${CARGO}', '${SUCURSAL}', 1);
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

const cabecerasEmpleado = (idEmpleado, rol = 'empleado') => ({ 'X-Rol': rol, 'X-Empleado-Id': idEmpleado, 'X-Usuario-Id': idEmpleado });
const cabecerasRrhh = { 'X-Rol': 'admin', 'X-Empleado-Id': RRHH, 'X-Usuario-Id': RRHH };

const convocatoriaValida = (cambios = {}) => ({
  id_cargo: CARGO,
  id_sucursal: SUCURSAL,
  titulo: 'Supervisor de sucursal Sopocachi',
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
  global.fetch = jest.fn().mockResolvedValue(respuestaNotificacion({ cantidad_destinatarios: 3 }));
});

afterEach(() => {
  global.fetch = fetchOriginal;
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

  test('sin identificar al empleado responde 401', async () => {
    const res = await request(app).get('/convocatorias');
    expect(res.status).toBe(401);
  });

  test('una convocatoria inexistente responde 404 al empleado activo', async () => {
    const res = await request(app).get(`/convocatorias/${INEXISTENTE}`).set(cabecerasEmpleado(ACTIVA));
    expect(res.status).toBe(404);
  });

  test('RRHH consulta el detalle sin ser empleado activo identificado', async () => {
    const { id_convocatoria: idConvocatoria } = await filaDe('Programada');
    const res = await request(app).get(`/convocatorias/${idConvocatoria}`).set({ 'X-Rol': 'gerente' });
    expect(res.status).toBe(200);
  });

  test('la vista de gestión muestra todas las convocatorias a RRHH y gerencia', async () => {
    for (const rol of ['admin', 'gerente']) {
      const res = await request(app).get('/convocatorias/gestion').set({ 'X-Rol': rol });
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
      const res = await publicar(convocatoriaValida(), { ...cabecerasRrhh, 'X-Rol': rol });
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

describe('notificación de la convocatoria a los empleados activos', () => {
  test('al publicar se envía un comunicado institucional general y queda registrado', async () => {
    const res = await publicar(convocatoriaValida({ titulo: 'Notificada correctamente' }));
    expect(res.status).toBe(201);
    expect(res.body.estado).toBe('ABIERTA');
    expect(res.body.notificacion).toMatchObject({ estado: 'ENTREGADA', destinatarios: 3, error: null });
    expect(res.body.notificacion.notificada_en).toBeTruthy();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opciones] = global.fetch.mock.calls[0];
    expect(url).toMatch(/\/comunicaciones\/institucional$/);
    expect(opciones.method).toBe('POST');
    expect(opciones.headers).toMatchObject({ 'X-Rol': 'admin', 'X-Usuario-Id': RRHH });
    const cuerpo = JSON.parse(opciones.body);
    expect(cuerpo).toMatchObject({ tipo_codigo: 'COMUNICADO', alcance_codigo: 'GENERAL', requiere_confirmacion: false });
    expect(cuerpo.asunto).toContain('Notificada correctamente');
    expect(cuerpo.contenido).toContain('Supervisor de sucursal');
    expect(cuerpo.contenido).toContain('Sopocachi');
    expect(cuerpo.contenido).toContain('75');
    expect(cuerpo.contenido).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(cuerpo.contenido).toMatch(/empleados activos/i);
  });

  test('si NotificationService falla, la convocatoria se publica igual y queda como fallida', async () => {
    global.fetch.mockResolvedValue(respuestaNotificacion({ error: 'Sin plantillas' }, 500));
    const res = await publicar(convocatoriaValida({ titulo: 'Notificación fallida' }));
    expect(res.status).toBe(201);
    expect(res.body.notificacion.estado).toBe('FALLIDA');
    expect(res.body.notificacion.error).toMatch(/500/);
    expect(res.body.notificacion.destinatarios).toBeNull();
    expect((await filaDe('Notificación fallida')).estado_notificacion).toBe('FALLIDA');
  });

  test('si NotificationService no responde, la convocatoria se publica igual', async () => {
    global.fetch.mockRejectedValue(new Error('connect ECONNREFUSED'));
    const res = await publicar(convocatoriaValida({ titulo: 'Sin servicio de mensajes' }));
    expect(res.status).toBe(201);
    expect(res.body.notificacion.estado).toBe('FALLIDA');
    expect(res.body.notificacion.error).toMatch(/ECONNREFUSED/);
  });

  test('una convocatoria fallida se reintenta una vez y luego ya no', async () => {
    global.fetch.mockResolvedValueOnce(respuestaNotificacion({ error: 'Caído' }, 503));
    const creada = await publicar(convocatoriaValida({ titulo: 'Para reintentar' }));
    expect(creada.body.notificacion.estado).toBe('FALLIDA');
    const idConvocatoria = creada.body.id_convocatoria;

    const reintento = await request(app).post(`/convocatorias/${idConvocatoria}/notificacion`).set(cabecerasRrhh);
    expect(reintento.status).toBe(200);
    expect(reintento.body.notificacion).toMatchObject({ estado: 'ENTREGADA', destinatarios: 3, error: null });

    const repetido = await request(app).post(`/convocatorias/${idConvocatoria}/notificacion`).set(cabecerasRrhh);
    expect(repetido.status).toBe(409);
    expect(global.fetch).toHaveBeenCalledTimes(2);
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
    const res = await request(app).post(`/convocatorias/${idConvocatoria}/notificacion`).set(cabecerasEmpleado(ACTIVA));
    expect(res.status).toBe(403);
  });

  test('una convocatoria programada se publica y notifica sin abrirse todavía', async () => {
    const res = await publicar(convocatoriaValida({ titulo: 'Programada nueva', fecha_inicio_postulacion: desplazar(7), fecha_cierre_postulacion: desplazar(30) }));
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
