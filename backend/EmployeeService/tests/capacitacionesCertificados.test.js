const fs = require('node:fs');
const path = require('node:path');

const CARPETA_TEMPORAL = 'tests/.tmp/capacitaciones';
process.env.CERTIFICADOS_DIR = `${CARPETA_TEMPORAL}/certificados`;

jest.mock('../db/pool', () => require('./helpers/bdEnMemoria').crearBdEnMemoria());

const request = require('supertest');
const pool = require('../db/pool');
const app = require('../index');

const id = (n) => `c0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const ANA = id(1);
const LUIS = id(2);
const INEXISTENTE = id(999);
const CARNET = id(401);
const INDUCCION = id(402);
const CERTIFICACION = id(403);
const CURSO_BAJA = id(404);
const ORDEN_EMITIDA = id(501);
const EN_PROCESO = id(502);

const SEMILLA = `
INSERT INTO departamentos (id_departamento, codigo, nombre) VALUES ('${id(10)}', 'OPS', 'Operaciones');
INSERT INTO cargos (id_cargo, id_departamento, codigo, nombre, salario_base_referencial, funciones_clave, requisitos_minimos)
  VALUES ('${id(20)}', '${id(10)}', 'CAJ', 'Cajero', 3000, 'Cobro', 'Bachiller');
INSERT INTO sucursales (id_sucursal, codigo_sucursal, nombre, direccion) VALUES ('${id(30)}', 'SOP', 'Sopocachi', 'Av. 6 de Agosto');
INSERT INTO estados_empleado VALUES (1, 'ACTIVO', 'Activo', TRUE);
INSERT INTO empleados (id_empleado, numero_documento, nombres, primer_apellido, fecha_nacimiento, genero, telefono_celular,
                       correo_personal, direccion_domicilio, fecha_ingreso, id_cargo_actual, id_sucursal_actual, id_estado_empleado) VALUES
  ('${ANA}', '7894561', 'Ana', 'Peñaranda', '1990-03-14', 'Femenino', '71234567', 'ana@correo.com', 'Sopocachi', '2023-01-02', '${id(20)}', '${id(30)}', 1),
  ('${LUIS}', '4567890', 'Luis', 'Mamani', '1988-07-01', 'Masculino', '72345678', 'luis@correo.com', 'Calacoto', '2022-05-10', '${id(20)}', '${id(30)}', 1);
INSERT INTO cursos_capacitacion (id_curso, codigo, nombre, horas_academicas, tipo_capacitacion, requiere_vencimiento, meses_vigencia, esta_activo) VALUES
  ('${CARNET}', 'BPM-01', 'Manipulación de alimentos', 20, 'CARNET_SANITARIO', TRUE, 12, TRUE),
  ('${INDUCCION}', 'IND-01', 'Inducción institucional', 8, 'INDUCCION', FALSE, NULL, TRUE),
  ('${CERTIFICACION}', 'MON-01', 'Operación de montacargas', 40, 'CERTIFICACION', TRUE, NULL, TRUE),
  ('${CURSO_BAJA}', 'OLD-01', 'Curso antiguo', 4, 'TECNICA', FALSE, NULL, FALSE);
INSERT INTO solicitudes_servicio_capacitacion (id_solicitud_servicio, id_mensaje, id_curso, id_empleado_solicitante, descripcion_requerimiento,
                                               cantidad_participantes, estado, enviada_en, numero_orden_servicio, proveedor_nombre) VALUES
  ('${ORDEN_EMITIDA}', gen_random_uuid(), '${CARNET}', '${LUIS}', 'Curso BPM para cajeros', 12, 'ORDEN_EMITIDA', now(), 'OS-2026-0007', 'Capacita SRL'),
  ('${EN_PROCESO}', gen_random_uuid(), '${CARNET}', '${LUIS}', 'Segundo grupo', 10, 'EN_PROCESO', now(), NULL, NULL);
`;

const PDF = { contenido: Buffer.from('%PDF-1.4 certificado'), filename: 'carnet sanitario año 2026.pdf', contentType: 'application/pdf' };
const PNG = {
  contenido: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('imagen')]),
  filename: 'escaneo.png',
  contentType: 'image/png',
};
const JPG = { contenido: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), filename: 'foto.jpg', contentType: 'image/jpeg' };
const WEBP = {
  contenido: Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x10, 0, 0, 0]), Buffer.from('WEBPVP8 ')]),
  filename: 'foto.webp',
  contentType: 'image/webp',
};
const PDF_FALSO = { contenido: Buffer.from('MZ ejecutable'), filename: 'certificado.pdf', contentType: 'application/pdf' };
const DOCX = { contenido: Buffer.from('PK documento'), filename: 'certificado.docx', contentType: 'application/msword' };

const conRol = (peticion, rol = 'admin') => (rol === null ? peticion : peticion.set('X-Rol', rol));

const enviarFormulario = (peticion, campos, archivo) => {
  Object.entries(campos).forEach(([campo, valor]) => peticion.field(campo, String(valor)));
  if (archivo) peticion.attach('certificado', archivo.contenido, { filename: archivo.filename, contentType: archivo.contentType });
  return peticion;
};

const registrar = (campos, archivo, rol) => enviarFormulario(conRol(request(app).post('/capacitaciones'), rol), campos, archivo);

const capacitacionValida = (cambios = {}) => ({
  id_empleado: ANA,
  id_curso: INDUCCION,
  institucion_emisora: 'Gerencia de RRHH',
  fecha_inicio: '2026-02-02',
  fecha_fin: '2026-02-03',
  fecha_emision: '2026-02-04',
  ...cambios,
});

const descargar = (idCapacitacion) =>
  conRol(request(app).get(`/capacitaciones/${idCapacitacion}/certificado`))
    .buffer(true)
    .parse((res, cb) => {
      const partes = [];
      res.on('data', (parte) => partes.push(parte));
      res.on('end', () => cb(null, Buffer.concat(partes)));
    });

const archivosGuardados = () => {
  const carpeta = path.join(process.cwd(), process.env.CERTIFICADOS_DIR);
  return fs.existsSync(carpeta) ? fs.readdirSync(carpeta) : [];
};
const enDisco = (url) => path.join(process.cwd(), url);
const limpiarTemporales = () => fs.rmSync(CARPETA_TEMPORAL, { recursive: true, force: true });

const fechaRelativa = async (dias) => {
  const { rows } = await pool.query(`SELECT (CURRENT_DATE + ${dias})::date AS fecha`);
  return rows[0].fecha;
};

beforeAll(() => {
  limpiarTemporales();
  return pool.preparar(SEMILLA);
}, 30000);

afterAll(async () => {
  await pool.cerrar();
  limpiarTemporales();
});

beforeEach(() => pool.reiniciarRegistro());

describe('carga de comprobantes de capacitación (KAN-296)', () => {
  describe('control de acceso', () => {
    test.each([
      ['get', '/capacitaciones'],
      ['post', '/capacitaciones'],
      ['get', `/capacitaciones/${id(900)}/certificado`],
      ['put', `/capacitaciones/${id(900)}/certificado`],
    ])('%s %s sin X-Rol responde 401 sin consultar la BD', async (metodo, ruta) => {
      const { status } = await request(app)[metodo](ruta);

      expect(status).toBe(401);
      expect(pool.consultas).toHaveLength(0);
    });

    test.each(['empleado', 'supervisor', 'reclutador'])('el rol %s no puede subir certificados y el archivo no se guarda', async (rol) => {
      const antes = archivosGuardados();
      const { status } = await registrar(capacitacionValida(), PDF, rol);

      expect(status).toBe(403);
      expect(archivosGuardados()).toEqual(antes);
    });
  });

  describe('registro con certificado', () => {
    test('guarda el PDF en disco con sus metadatos y nombre original', async () => {
      const { status, body } = await registrar(capacitacionValida(), PDF);

      expect(status).toBe(201);
      expect(body).toMatchObject({
        id_empleado: ANA,
        empleado: 'Ana Peñaranda',
        curso: 'Inducción institucional',
        tipo_capacitacion: 'INDUCCION',
        institucion_emisora: 'Gerencia de RRHH',
        fecha_inicio: '2026-02-02',
        fecha_fin: '2026-02-03',
        fecha_emision: '2026-02-04',
        fecha_vencimiento: null,
        estado_vigencia: 'SIN_VENCIMIENTO',
        certificado_nombre_original: 'carnet sanitario año 2026.pdf',
        certificado_tipo_mime: 'application/pdf',
        certificado_tamano_bytes: PDF.contenido.length,
      });
      expect(body.certificado_adjunto_url).toMatch(/^\/tests\/\.tmp\/capacitaciones\/certificados\/[0-9a-f-]{36}\.pdf$/);
      expect(fs.readFileSync(enDisco(body.certificado_adjunto_url))).toEqual(PDF.contenido);
    });

    test.each([
      ['PNG', PNG, /\.png$/],
      ['JPG', JPG, /\.jpg$/],
      ['WEBP', WEBP, /\.webp$/],
    ])('acepta certificados en imagen %s', async (formato, archivo, extension) => {
      const fecha = { PNG: '2026-03-01', JPG: '2026-03-02', WEBP: '2026-03-03' }[formato];
      const { status, body } = await registrar(capacitacionValida({ fecha_emision: fecha }), archivo);

      expect(status).toBe(201);
      expect(body.certificado_tipo_mime).toBe(archivo.contentType);
      expect(body.certificado_adjunto_url).toMatch(extension);
    });

    test('el certificado es opcional', async () => {
      const { status, body } = await registrar(capacitacionValida({ fecha_emision: '2026-03-04' }));

      expect(status).toBe(201);
      expect(body).toMatchObject({
        certificado_adjunto_url: null,
        certificado_nombre_original: null,
        certificado_tipo_mime: null,
        certificado_tamano_bytes: null,
      });
    });

    test('completa el vencimiento con la vigencia del curso respetando el fin de mes', async () => {
      const { status, body } = await registrar(
        { id_empleado: LUIS, id_curso: CARNET, institucion_emisora: 'SEDES La Paz', fecha_emision: '2024-02-29' },
        PNG
      );

      expect(status).toBe(201);
      expect(body.fecha_vencimiento).toBe('2025-02-28');
    });

    test('respeta el vencimiento indicado aunque el curso tenga vigencia propia', async () => {
      const { status, body } = await registrar({
        id_empleado: LUIS,
        id_curso: CARNET,
        institucion_emisora: 'SEDES La Paz',
        fecha_emision: '2025-06-01',
        fecha_vencimiento: '2025-12-01',
      });

      expect(status).toBe(201);
      expect(body.fecha_vencimiento).toBe('2025-12-01');
    });
  });

  describe('rechazo de comprobantes inválidos', () => {
    test.each([
      ['un formato no permitido', DOCX],
      ['un archivo cuyo contenido no coincide con su tipo', PDF_FALSO],
    ])('rechaza %s y no deja el archivo en disco', async (descripcion, archivo) => {
      const antes = archivosGuardados();
      const { status, body } = await registrar(capacitacionValida({ fecha_emision: '2026-02-05' }), archivo);

      expect(status).toBe(400);
      expect(body.errores[0].campo).toBe('certificado');
      expect(archivosGuardados()).toEqual(antes);
    });

    test('rechaza un archivo que supera el tamaño máximo', async () => {
      const grande = { ...PDF, contenido: Buffer.concat([PDF.contenido, Buffer.alloc(5 * 1024 * 1024)]) };
      const antes = archivosGuardados();
      const { status, body } = await registrar(capacitacionValida({ fecha_emision: '2026-02-05' }), grande);

      expect(status).toBe(400);
      expect(body.error).toMatch(/tamaño máximo/);
      expect(archivosGuardados()).toEqual(antes);
    });

    test('si el registro falla después de subir el archivo, el archivo se descarta', async () => {
      const antes = archivosGuardados();
      const { status } = await registrar(capacitacionValida({ id_curso: CERTIFICACION, fecha_emision: '2026-02-06' }), PDF);

      expect(status).toBe(400);
      expect(archivosGuardados()).toEqual(antes);
    });

    test('exige el vencimiento si el curso lo requiere y no tiene vigencia propia', async () => {
      const { status, body } = await registrar(capacitacionValida({ id_curso: CERTIFICACION, fecha_emision: '2026-02-07' }));

      expect(status).toBe(400);
      expect(body.errores).toEqual([
        { campo: 'fecha_vencimiento', mensaje: 'El curso «Operación de montacargas» exige indicar la fecha de vencimiento.' },
      ]);
    });

    test.each([
      [{ fecha_emision: '2026-02-30' }, 'fecha_emision'],
      [{ fecha_emision: '' }, 'fecha_emision'],
      [{ institucion_emisora: '' }, 'institucion_emisora'],
      [{ fecha_fin: '2026-02-01' }, 'fecha_fin'],
      [{ fecha_emision: '2026-02-02' }, 'fecha_emision'],
      [{ fecha_vencimiento: '2026-02-08' }, 'fecha_vencimiento'],
      [{ id_curso: CURSO_BAJA }, 'id_curso'],
      [{ id_curso: INEXISTENTE }, 'id_curso'],
      [{ id_empleado: INEXISTENTE }, 'id_empleado'],
      [{ id_empleado: 'no-es-uuid' }, 'id_empleado'],
    ])('rechaza %j', async (cambios, campo) => {
      const { status, body } = await registrar(capacitacionValida({ fecha_emision: '2026-02-08', ...cambios }));

      expect(status).toBe(400);
      expect(body.errores.map((e) => e.campo)).toContain(campo);
    });

    test('no acepta certificados emitidos en el futuro', async () => {
      const manana = await fechaRelativa(1);
      const { fecha_inicio, fecha_fin, ...sinFechasDeCurso } = capacitacionValida({ fecha_emision: manana });
      const { status, body } = await registrar(sinFechasDeCurso);

      expect(status).toBe(400);
      expect(body.errores[0].campo).toBe('fecha_emision');
    });

    test('no registra dos veces el mismo curso con la misma fecha de emisión', async () => {
      const { status, body } = await registrar(capacitacionValida());

      expect(status).toBe(409);
      expect(body.errores[0].campo).toBe('fecha_emision');
    });
  });

  describe('orden de servicio de Compras', () => {
    const externa = (cambios) =>
      capacitacionValida({ id_curso: CARNET, institucion_emisora: 'Capacita SRL', fecha_emision: '2026-03-10', ...cambios });

    test('vincula una orden emitida y devuelve su número y proveedor', async () => {
      const { status, body } = await registrar(externa({ id_solicitud_servicio: ORDEN_EMITIDA }), PDF);

      expect(status).toBe(201);
      expect(body).toMatchObject({
        id_solicitud_servicio: ORDEN_EMITIDA,
        numero_orden_servicio: 'OS-2026-0007',
        proveedor_nombre: 'Capacita SRL',
      });
    });

    test.each([
      ['sin orden emitida', { id_solicitud_servicio: EN_PROCESO, fecha_emision: '2026-03-11' }],
      ['de otro curso', { id_solicitud_servicio: ORDEN_EMITIDA, id_curso: INDUCCION, fecha_emision: '2026-03-12' }],
      ['inexistente', { id_solicitud_servicio: INEXISTENTE, fecha_emision: '2026-03-13' }],
    ])('rechaza una solicitud %s', async (descripcion, cambios) => {
      const { status, body } = await registrar(externa(cambios));

      expect(status).toBe(400);
      expect(body.errores[0].campo).toBe('id_solicitud_servicio');
    });
  });

  describe('descarga, reemplazo y eliminación del certificado', () => {
    let capacitacion;

    beforeAll(async () => {
      ({ body: capacitacion } = await registrar(capacitacionValida({ fecha_emision: '2026-05-04' }), PDF));
    });

    test('descarga el certificado con su nombre y tipo originales', async () => {
      const { status, headers, body } = await descargar(capacitacion.id_capacitacion);

      expect(status).toBe(200);
      expect(headers['content-type']).toMatch(/^application\/pdf/);
      expect(headers['content-disposition']).toBe('attachment; filename="carnet sanitario año 2026.pdf"');
      expect(body).toEqual(PDF.contenido);
    });

    test('editar los datos no cambia de colaborador ni toca el certificado', async () => {
      const { status, body } = await conRol(request(app).put(`/capacitaciones/${capacitacion.id_capacitacion}`)).send(
        capacitacionValida({ id_empleado: LUIS, institucion_emisora: 'Escuela de Gestores', fecha_emision: '2026-05-05' })
      );

      expect(status).toBe(200);
      expect(body).toMatchObject({
        id_empleado: ANA,
        institucion_emisora: 'Escuela de Gestores',
        fecha_emision: '2026-05-05',
        certificado_adjunto_url: capacitacion.certificado_adjunto_url,
      });
    });

    test('reemplaza el certificado y borra el archivo anterior', async () => {
      const { status, body } = await enviarFormulario(
        conRol(request(app).put(`/capacitaciones/${capacitacion.id_capacitacion}/certificado`)),
        {},
        PNG
      );

      expect(status).toBe(200);
      expect(body).toMatchObject({ certificado_tipo_mime: 'image/png', certificado_nombre_original: 'escaneo.png' });
      expect(fs.existsSync(enDisco(capacitacion.certificado_adjunto_url))).toBe(false);
      expect(fs.existsSync(enDisco(body.certificado_adjunto_url))).toBe(true);
      capacitacion = body;
    });

    test('pide el archivo al reemplazar el certificado', async () => {
      const { status, body } = await conRol(request(app).put(`/capacitaciones/${capacitacion.id_capacitacion}/certificado`));

      expect(status).toBe(400);
      expect(body.campos_faltantes).toEqual(['certificado']);
    });

    test('un reemplazo inválido no toca el certificado vigente', async () => {
      const { status } = await enviarFormulario(
        conRol(request(app).put(`/capacitaciones/${capacitacion.id_capacitacion}/certificado`)),
        {},
        PDF_FALSO
      );
      const { body } = await conRol(request(app).get(`/capacitaciones/${capacitacion.id_capacitacion}`));

      expect(status).toBe(400);
      expect(body.certificado_adjunto_url).toBe(capacitacion.certificado_adjunto_url);
      expect(fs.existsSync(enDisco(capacitacion.certificado_adjunto_url))).toBe(true);
    });

    test('quita el certificado y su archivo', async () => {
      const quitado = await conRol(request(app).delete(`/capacitaciones/${capacitacion.id_capacitacion}/certificado`));
      const otraVez = await conRol(request(app).delete(`/capacitaciones/${capacitacion.id_capacitacion}/certificado`));
      const descarga = await conRol(request(app).get(`/capacitaciones/${capacitacion.id_capacitacion}/certificado`));

      expect(quitado.status).toBe(200);
      expect(quitado.body.capacitacion).toMatchObject({
        certificado_adjunto_url: null,
        certificado_nombre_original: null,
        certificado_tipo_mime: null,
        certificado_tamano_bytes: null,
      });
      expect(fs.existsSync(enDisco(capacitacion.certificado_adjunto_url))).toBe(false);
      expect(otraVez.status).toBe(404);
      expect(descarga.status).toBe(404);
    });

    test('si el archivo desapareció del disco, la descarga responde 404', async () => {
      const { body: registro } = await registrar(capacitacionValida({ fecha_emision: '2026-05-20' }), PDF);
      fs.rmSync(enDisco(registro.certificado_adjunto_url));

      const { status, body } = await conRol(request(app).get(`/capacitaciones/${registro.id_capacitacion}/certificado`));

      expect(status).toBe(404);
      expect(body.error).toBe('El archivo del certificado no está disponible.');
    });

    test('eliminar la capacitación borra también su certificado', async () => {
      const { body: conArchivo } = await registrar(capacitacionValida({ fecha_emision: '2026-06-01' }), PDF);
      const eliminada = await conRol(request(app).delete(`/capacitaciones/${conArchivo.id_capacitacion}`));
      const consulta = await conRol(request(app).get(`/capacitaciones/${conArchivo.id_capacitacion}`));

      expect(eliminada.status).toBe(200);
      expect(fs.existsSync(enDisco(conArchivo.certificado_adjunto_url))).toBe(false);
      expect(consulta.status).toBe(404);
    });
  });
});
