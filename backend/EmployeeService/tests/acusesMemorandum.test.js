// RF-39 (KAN-59): notificación y acuse de recibo de memorándums. Pruebas de KAN-283.
// La base se reemplaza por espías sobre el modelo; las transacciones usan un cliente que solo registra BEGIN/COMMIT/ROLLBACK.
const mockSentencias = [];
jest.mock('../db/pool', () => {
  const cliente = { query: async (sql) => (mockSentencias.push(sql), { rows: [] }), release: () => {} };
  return { query: async () => ({ rows: [] }), connect: async () => cliente, on: () => {} };
});

const request = require('supertest');
const app = require('../index');
const memorandumsModel = require('../src/models/memorandumsModel');
const empleadosModel = require('../src/models/empleadosModel');
const notificacionesService = require('../src/services/notificacionesService');
const acusesMemorandumService = require('../src/services/acusesMemorandumService');

const ID_RECEPTOR = 'e0000000-0000-4000-8000-000000000001';
const ID_EMISOR = 'e0000000-0000-4000-8000-000000000002';
const ID_OTRO = 'e0000000-0000-4000-8000-000000000003';
const ID_RRHH = 'e0000000-0000-4000-8000-000000000004';
const ID_USUARIO = 'a0000000-0000-4000-8000-0000000000aa';
const ID_MEMO = 'b0000000-0000-4000-8000-000000000001';
const ID_MEMO_2 = 'b0000000-0000-4000-8000-000000000002';

const memo = (cambios = {}) => ({
  id_memorandum: ID_MEMO,
  id_empleado_receptor: ID_RECEPTOR,
  id_empleado_emisor: ID_EMISOR,
  codigo_cite: 'MEM-2026-0007',
  asunto: 'Incumplimiento del horario de ingreso',
  contenido_descripcion: 'Ingresó con retraso tres días seguidos.',
  tipo_nombre: 'Llamada de atención',
  es_reconocimiento: false,
  estado_sancion: 'EMITIDO',
  fue_notificado: true,
  fecha_hora_notificacion: '2026-10-10T12:00:00.000Z',
  fecha_limite_acuse: '2026-10-13T12:00:00.000Z',
  fecha_hora_apertura: null,
  estado_acuse: 'PENDIENTE',
  acuse_recibo_firmado: false,
  fecha_hora_acuse: null,
  ip_acuse: null,
  id_usuario_acuse: null,
  comentario_descargo: null,
  receptor_nombre: 'José Peñaranda',
  emisor_nombre: 'María Quispe',
  ...cambios,
});

const comoEmpleado = (peticion, idEmpleado = ID_RECEPTOR) => peticion.set('X-Empleado-Id', idEmpleado);

let enviarAviso;

beforeEach(() => {
  mockSentencias.length = 0;
  delete process.env.MEMORANDUM_PLAZO_ACUSE_HORAS;
  delete process.env.MEMORANDUM_ALERTA_RRHH_IDS;
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest
    .spyOn(empleadosModel, 'obtenerResumen')
    .mockImplementation(async (db, id) => ([ID_RECEPTOR, ID_OTRO].includes(id) ? { id_empleado: id } : null));
  enviarAviso = jest.spyOn(notificacionesService, 'enviarAvisoPrioritario').mockResolvedValue(true);
});

afterEach(() => jest.restoreAllMocks());

describe('Criterio 1: alerta de alta prioridad en el portal y por correo al emitir', () => {
  beforeEach(() => {
    jest.spyOn(memorandumsModel, 'bloquearSinNotificar').mockResolvedValue(memo({ fue_notificado: false }));
  });

  test('avisa al receptor con prioridad alta, correo y enlace a «Mis memorándums», y abre el plazo de 72 horas', async () => {
    const marcar = jest.spyOn(memorandumsModel, 'marcarNotificado').mockResolvedValue({ id_memorandum: ID_MEMO });

    await expect(acusesMemorandumService.notificarEmision(ID_MEMO)).resolves.toBe(true);

    expect(enviarAviso).toHaveBeenCalledTimes(1);
    const aviso = enviarAviso.mock.calls[0][0];
    expect(aviso).toMatchObject({
      idRemitente: ID_EMISOR,
      idDestinatario: ID_RECEPTOR,
      asunto: 'Memorándum MEM-2026-0007: llamada de atención',
      enlace: '/comunicaciones/memorandums',
    });
    expect(aviso.contenido).toContain('acusar recibo');
    expect(aviso.contenido).toContain('72 horas');
    expect(marcar).toHaveBeenCalledWith(expect.anything(), ID_MEMO, 72);
    expect(mockSentencias).toEqual(['BEGIN', 'COMMIT']);
  });

  test('identifica los memorándums de felicitación', async () => {
    memorandumsModel.bloquearSinNotificar.mockResolvedValue(memo({ fue_notificado: false, es_reconocimiento: true }));
    jest.spyOn(memorandumsModel, 'marcarNotificado').mockResolvedValue({});

    await acusesMemorandumService.notificarEmision(ID_MEMO);

    expect(enviarAviso.mock.calls[0][0].asunto).toBe('Memorándum MEM-2026-0007: felicitación');
  });

  test('el plazo de acuse es configurable', async () => {
    process.env.MEMORANDUM_PLAZO_ACUSE_HORAS = '48';
    const marcar = jest.spyOn(memorandumsModel, 'marcarNotificado').mockResolvedValue({});

    await acusesMemorandumService.notificarEmision(ID_MEMO);

    expect(marcar).toHaveBeenCalledWith(expect.anything(), ID_MEMO, 48);
    expect(enviarAviso.mock.calls[0][0].contenido).toContain('48 horas');
  });

  test('si NotificationService no acepta el aviso, no marca el memorándum como notificado', async () => {
    enviarAviso.mockResolvedValue(false);
    const marcar = jest.spyOn(memorandumsModel, 'marcarNotificado');

    await expect(acusesMemorandumService.notificarEmision(ID_MEMO)).resolves.toBe(false);
    expect(marcar).not.toHaveBeenCalled();
  });

  test('no vuelve a avisar un memorándum ya notificado o que otro proceso está avisando', async () => {
    memorandumsModel.bloquearSinNotificar.mockResolvedValue(null);

    await expect(acusesMemorandumService.notificarEmision(ID_MEMO)).resolves.toBe(false);
    expect(enviarAviso).not.toHaveBeenCalled();
  });

  test('un error de base al notificar no hace fallar la emisión', async () => {
    jest.spyOn(memorandumsModel, 'marcarNotificado').mockRejectedValue(new Error('conexión perdida'));

    await expect(acusesMemorandumService.notificarEmision(ID_MEMO)).resolves.toBe(false);
    expect(mockSentencias).toEqual(['BEGIN', 'ROLLBACK']);
  });
});

describe('Portal del colaborador: GET /memorandums/recibidos', () => {
  test('lista los memorándums emitidos a su nombre con la cantidad pendiente de acuse', async () => {
    jest
      .spyOn(memorandumsModel, 'listarRecibidos')
      .mockResolvedValue([
        memo(),
        memo({ id_memorandum: ID_MEMO_2, estado_acuse: 'RECIBIDO', acuse_recibo_firmado: true }),
      ]);

    const respuesta = await comoEmpleado(request(app).get('/memorandums/recibidos'));

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.pendientes).toBe(1);
    expect(respuesta.body.plazo_horas).toBe(72);
    expect(respuesta.body.memorandums.map((m) => m.estado_acuse_nombre)).toEqual([
      'Pendiente de acuse',
      'Notificado y Recibido',
    ]);
    expect(memorandumsModel.listarRecibidos).toHaveBeenCalledWith(expect.anything(), ID_RECEPTOR);
  });

  test('exige identificarse como empleado', async () => {
    const respuesta = await request(app).get('/memorandums/recibidos');
    expect(respuesta.status).toBe(401);
  });

  test('rechaza un identificador con formato inválido', async () => {
    const respuesta = await request(app).get('/memorandums/recibidos').set('X-Empleado-Id', 'abc');
    expect(respuesta.status).toBe(400);
  });

  test('rechaza un identificador que no corresponde a ningún empleado', async () => {
    const respuesta = await comoEmpleado(request(app).get('/memorandums/recibidos'), ID_EMISOR);
    expect(respuesta.status).toBe(403);
  });
});

describe('Criterio 2: el colaborador abre y lee el memorándum', () => {
  test('devuelve el contenido y registra la apertura', async () => {
    jest.spyOn(memorandumsModel, 'bloquearRecibido').mockResolvedValue(memo());
    const apertura = jest
      .spyOn(memorandumsModel, 'registrarApertura')
      .mockResolvedValue('2026-10-11T14:00:00.000Z');

    const respuesta = await comoEmpleado(request(app).get(`/memorandums/recibidos/${ID_MEMO}`));

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({
      contenido_descripcion: 'Ingresó con retraso tres días seguidos.',
      fecha_hora_apertura: '2026-10-11T14:00:00.000Z',
      estado_acuse_nombre: 'Pendiente de acuse',
    });
    expect(respuesta.body).not.toHaveProperty('estado_sancion');
    expect(apertura).toHaveBeenCalledWith(expect.anything(), ID_MEMO);
    expect(memorandumsModel.bloquearRecibido).toHaveBeenCalledWith(expect.anything(), ID_MEMO, ID_RECEPTOR);
  });

  test('no muestra memorándums de otro colaborador', async () => {
    jest.spyOn(memorandumsModel, 'bloquearRecibido').mockResolvedValue(null);
    const apertura = jest.spyOn(memorandumsModel, 'registrarApertura');

    const respuesta = await comoEmpleado(request(app).get(`/memorandums/recibidos/${ID_MEMO}`), ID_OTRO);

    expect(respuesta.status).toBe(404);
    expect(apertura).not.toHaveBeenCalled();
  });

  test('un memorándum anulado ya no está disponible', async () => {
    jest.spyOn(memorandumsModel, 'bloquearRecibido').mockResolvedValue(memo({ estado_sancion: 'ANULADO' }));

    const respuesta = await comoEmpleado(request(app).get(`/memorandums/recibidos/${ID_MEMO}`));

    expect(respuesta.status).toBe(404);
  });
});

describe('Criterio 3: acuse de recibo con marca de tiempo, IP y usuario', () => {
  const acusar = (cuerpo = {}, idEmpleado = ID_RECEPTOR) =>
    comoEmpleado(request(app).post(`/memorandums/recibidos/${ID_MEMO}/acuse`), idEmpleado)
      .set('X-Forwarded-For', '181.115.10.20')
      .send(cuerpo);

  let registrar;

  beforeEach(() => {
    jest.spyOn(memorandumsModel, 'bloquearRecibido').mockResolvedValue(memo());
    registrar = jest.spyOn(memorandumsModel, 'registrarAcuse').mockImplementation(async (db, id, datos) => ({
      id_memorandum: id,
      estado_acuse: 'RECIBIDO',
      fecha_hora_apertura: '2026-10-11T14:00:00.000Z',
      fecha_hora_acuse: '2026-10-11T14:05:00.000Z',
      ip_acuse: datos.ip,
      id_usuario_acuse: datos.idUsuario,
      comentario_descargo: datos.comentario,
    }));
  });

  test('guarda la IP del cliente, el usuario y el descargo, y deja el memorándum «Notificado y Recibido»', async () => {
    const respuesta = await acusar({ comentario: '  El retraso se debió a un corte de transporte.  ' }).set(
      'X-Usuario-Id',
      ID_USUARIO
    );

    expect(respuesta.status).toBe(200);
    expect(registrar).toHaveBeenCalledWith(expect.anything(), ID_MEMO, {
      ip: '181.115.10.20',
      idUsuario: ID_USUARIO,
      comentario: 'El retraso se debió a un corte de transporte.',
    });
    expect(respuesta.body).toMatchObject({
      estado_acuse: 'RECIBIDO',
      estado_acuse_nombre: 'Notificado y Recibido',
      fecha_hora_acuse: '2026-10-11T14:05:00.000Z',
      codigo_cite: 'MEM-2026-0007',
    });
    expect(mockSentencias).toEqual(['BEGIN', 'COMMIT']);
  });

  test('el descargo es opcional y, sin cuenta de usuario, el usuario es el mismo empleado', async () => {
    const respuesta = await acusar({ comentario: '   ' });

    expect(respuesta.status).toBe(200);
    expect(registrar).toHaveBeenCalledWith(expect.anything(), ID_MEMO, {
      ip: '181.115.10.20',
      idUsuario: ID_RECEPTOR,
      comentario: null,
    });
  });

  test('se puede acusar recibo aunque el plazo ya haya vencido', async () => {
    memorandumsModel.bloquearRecibido.mockResolvedValue(memo({ estado_acuse: 'VENCIDO' }));

    const respuesta = await acusar();

    expect(respuesta.status).toBe(200);
  });

  test('no permite acusar recibo dos veces y conserva la marca original', async () => {
    memorandumsModel.bloquearRecibido.mockResolvedValue(
      memo({ estado_acuse: 'RECIBIDO', acuse_recibo_firmado: true, fecha_hora_acuse: '2026-10-11T14:05:00.000Z' })
    );

    const respuesta = await acusar();

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error).toMatch(/^Ya acusó recibo de este memorándum \(.+\)\.$/);
    expect(registrar).not.toHaveBeenCalled();
    expect(mockSentencias).toEqual(['BEGIN', 'ROLLBACK']);
  });

  test('solo el receptor puede acusar recibo', async () => {
    memorandumsModel.bloquearRecibido.mockResolvedValue(null);

    const respuesta = await acusar({}, ID_OTRO);

    expect(respuesta.status).toBe(404);
    expect(registrar).not.toHaveBeenCalled();
  });

  test('limita el descargo a 2000 caracteres', async () => {
    const respuesta = await acusar({ comentario: 'a'.repeat(2001) });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.errores).toEqual([
      { campo: 'comentario', mensaje: "El campo 'comentario' no puede superar los 2000 caracteres." },
    ]);
    expect(registrar).not.toHaveBeenCalled();
  });
});

describe('Criterio 4: alerta a RRHH cuando vence el plazo sin acuse', () => {
  let marcarVencido;

  beforeEach(() => {
    jest.spyOn(memorandumsModel, 'listarSinNotificar').mockResolvedValue([]);
    jest
      .spyOn(memorandumsModel, 'bloquearVencidos')
      .mockResolvedValueOnce([ID_MEMO])
      .mockResolvedValue([]);
    jest.spyOn(memorandumsModel, 'obtenerParaAviso').mockResolvedValue(memo());
    marcarVencido = jest.spyOn(memorandumsModel, 'marcarVencido').mockResolvedValue({ id_memorandum: ID_MEMO });
  });

  test('alerta a quien emitió el memorándum para el seguimiento presencial y lo marca vencido', async () => {
    const resultado = await acusesMemorandumService.procesarPendientes();

    expect(resultado).toEqual({ notificados: 0, alertados: 1, fallidos: 0 });
    expect(enviarAviso).toHaveBeenCalledTimes(1);
    const alerta = enviarAviso.mock.calls[0][0];
    expect(alerta).toMatchObject({
      idRemitente: notificacionesService.USUARIO_SISTEMA,
      idDestinatario: ID_EMISOR,
      asunto: 'Sin acuse de recibo: memorándum MEM-2026-0007',
      enlace: '/disciplina/acuses',
    });
    expect(alerta.contenido).toContain('José Peñaranda no acusó recibo');
    expect(alerta.contenido).toContain('El plazo para acusar recibo venció el ');
    expect(alerta.contenido).toContain('seguimiento presencial');
    expect(marcarVencido).toHaveBeenCalledWith(expect.anything(), ID_MEMO);
  });

  test('también alerta al personal de RRHH configurado, sin duplicar al emisor', async () => {
    process.env.MEMORANDUM_ALERTA_RRHH_IDS = `${ID_RRHH}, ${ID_EMISOR}`;

    await acusesMemorandumService.procesarPendientes();

    expect(enviarAviso.mock.calls.map(([aviso]) => aviso.idDestinatario)).toEqual([ID_EMISOR, ID_RRHH]);
  });

  test('si la alerta no sale, el memorándum sigue pendiente y no bloquea a los demás', async () => {
    memorandumsModel.bloquearVencidos
      .mockReset()
      .mockResolvedValueOnce([ID_MEMO])
      .mockResolvedValueOnce([ID_MEMO_2])
      .mockResolvedValue([]);
    memorandumsModel.obtenerParaAviso.mockImplementation(async (db, id) => memo({ id_memorandum: id }));
    enviarAviso.mockResolvedValueOnce(false).mockResolvedValue(true);

    const resultado = await acusesMemorandumService.procesarPendientes();

    expect(resultado).toEqual({ notificados: 0, alertados: 1, fallidos: 1 });
    expect(marcarVencido).toHaveBeenCalledTimes(1);
    expect(marcarVencido).toHaveBeenCalledWith(expect.anything(), ID_MEMO_2);
    expect(memorandumsModel.bloquearVencidos).toHaveBeenNthCalledWith(2, expect.anything(), 1, [ID_MEMO]);
    expect(mockSentencias).toEqual(['BEGIN', 'ROLLBACK', 'BEGIN', 'COMMIT', 'BEGIN', 'COMMIT']);
  });

  test('basta con que alguien de RRHH reciba la alerta', async () => {
    process.env.MEMORANDUM_ALERTA_RRHH_IDS = ID_RRHH;
    enviarAviso.mockImplementation(async ({ idDestinatario }) => idDestinatario === ID_RRHH);

    const resultado = await acusesMemorandumService.procesarPendientes();

    expect(resultado.alertados).toBe(1);
  });

  test('reintenta los avisos de emisión que no llegaron', async () => {
    memorandumsModel.listarSinNotificar.mockResolvedValue([ID_MEMO_2]);
    jest.spyOn(memorandumsModel, 'bloquearSinNotificar').mockResolvedValue(memo({ id_memorandum: ID_MEMO_2 }));
    jest.spyOn(memorandumsModel, 'marcarNotificado').mockResolvedValue({});

    const resultado = await acusesMemorandumService.procesarPendientes();

    expect(resultado.notificados).toBe(1);
    expect(memorandumsModel.marcarNotificado).toHaveBeenCalledWith(expect.anything(), ID_MEMO_2, 72);
  });
});

describe('Vista de RRHH: GET /memorandums/seguimiento', () => {
  test('lista el estado del acuse de cada memorándum, con filtro opcional', async () => {
    const listar = jest.spyOn(memorandumsModel, 'listarSeguimiento').mockResolvedValue([memo({ estado_acuse: 'VENCIDO' })]);

    const respuesta = await request(app).get('/memorandums/seguimiento?estado_acuse=vencido');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body[0].estado_acuse_nombre).toBe('Sin acuse (plazo vencido)');
    expect(listar).toHaveBeenCalledWith(expect.anything(), 'VENCIDO');
  });

  test('rechaza un filtro desconocido', async () => {
    const respuesta = await request(app).get('/memorandums/seguimiento?estado_acuse=LEIDO');
    expect(respuesta.status).toBe(400);
  });
});
