const CARPETA_TEMPORAL = 'tests/.tmp/contratos-inmutabilidad';
process.env.CONTRATOS_DIR = `${CARPETA_TEMPORAL}/documentos`;

jest.mock('../db/pool', () => require('./helpers/bdEnMemoria').crearBdEnMemoria());

const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const request = require('supertest');
const pool = require('../db/pool');
const app = require('../index');

const id = (n) => `f0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const ANA = id(1);
const LUIS = id(2);
const RRHH = id(3);
const INEXISTENTE = id(999);

const CT_ANA = id(201);
const CT_LUIS = id(202);

const SEMILLA = `
INSERT INTO departamentos (id_departamento, codigo, nombre) VALUES ('${id(10)}', 'OPS', 'Operaciones');
INSERT INTO cargos (id_cargo, id_departamento, codigo, nombre, salario_base_referencial, funciones_clave, requisitos_minimos)
  VALUES ('${id(20)}', '${id(10)}', 'CAJ', 'Cajero', 3000, 'Cobro', 'Bachiller');
INSERT INTO sucursales (id_sucursal, codigo_sucursal, nombre, direccion) VALUES ('${id(30)}', 'SOP', 'Sopocachi', 'Av. 6 de Agosto');
INSERT INTO estados_empleado VALUES (1, 'ACTIVO', 'Activo', TRUE);
INSERT INTO empleados (id_empleado, numero_documento, nombres, primer_apellido, fecha_nacimiento, genero, telefono_celular,
                       correo_personal, direccion_domicilio, fecha_ingreso, id_cargo_actual, id_sucursal_actual, id_estado_empleado) VALUES
  ('${ANA}', '2001', 'Ana', 'Peñaranda', '1990-03-14', 'Femenino', '71234567', 'ana@correo.com', 'Sopocachi', '2026-01-01', '${id(20)}', '${id(30)}', 1),
  ('${LUIS}', '2002', 'Luis', 'Mamani', '1988-07-01', 'Masculino', '72345678', 'luis@correo.com', 'Calacoto', '2025-11-01', '${id(20)}', '${id(30)}', 1),
  ('${RRHH}', '2003', 'Rita', 'Vargas', '1980-01-01', 'Femenino', '76789012', 'rita@correo.com', 'Centro', '2015-01-01', '${id(20)}', '${id(30)}', 1);
INSERT INTO tipos_contrato VALUES (1, 'INDEFINIDO', 'Indefinido'), (2, 'PLAZO_FIJO', 'Plazo fijo');
INSERT INTO tipos_jornada VALUES (1, 'COMPLETA', 'Jornada completa', 48), (2, 'PARCIAL', 'Medio tiempo', 24);
INSERT INTO contratos (id_contrato, id_empleado, id_tipo_contrato, id_tipo_jornada, numero_contrato, periodo_vigencia,
                       haber_mensual_pactado, tipo_modificacion, registrado_en) VALUES
  ('${CT_ANA}', '${ANA}', 2, 1, 'CT-ANA', daterange('2026-01-01', '2026-12-31', '[]'), 3500, 'CONTRATO_INICIAL', now() - INTERVAL '1 year'),
  ('${CT_LUIS}', '${LUIS}', 2, 2, 'CT-LUIS', daterange('2025-11-01', '2026-10-31', '[]'), 2500, 'CONTRATO_INICIAL', now() - INTERVAL '1 year');
`;

const PDF = { contenido: Buffer.from('%PDF-1.4 adenda firmada por ambas partes'), filename: 'adenda año 2026.pdf', contentType: 'application/pdf' };

const registrar = (campos, { usuario = RRHH, documento = PDF } = {}) => {
  const peticion = request(app).post('/contratos/modificaciones').set('X-Rol', 'admin');
  if (usuario) peticion.set('X-Usuario-Id', usuario);
  Object.entries(campos).forEach(([campo, valor]) => peticion.field(campo, String(valor)));
  if (documento) peticion.attach('documento', documento.contenido, { filename: documento.filename, contentType: documento.contentType });
  return peticion;
};

const adenda = (cambios = {}) => ({
  id_empleado: ANA,
  tipo_modificacion: 'AJUSTE_SALARIAL',
  numero_contrato: 'CT-ANA-A1',
  fecha_vigencia: '2026-06-01',
  haber_mensual_pactado: '3800',
  justificacion: 'Incremento por evaluación de desempeño.',
  ...cambios,
});

const filasDe = async (idEmpleado) => {
  const { rows } = await pool.query(
    'SELECT row_to_json(c)::text AS fila FROM contratos c WHERE id_empleado = $1 ORDER BY registrado_en, id_contrato',
    [idEmpleado]
  );
  return rows.map((r) => r.fila);
};

const totalContratos = async () => (await pool.query('SELECT count(*)::int AS total FROM contratos')).rows[0].total;

const archivosGuardados = () => {
  const carpeta = path.join(process.cwd(), process.env.CONTRATOS_DIR);
  return fs.existsSync(carpeta) ? fs.readdirSync(carpeta) : [];
};

const descargar = (idContrato) =>
  request(app)
    .get(`/contratos/${idContrato}/documento`)
    .set('X-Rol', 'admin')
    .buffer(true)
    .parse((res, cb) => {
      const partes = [];
      res.on('data', (parte) => partes.push(parte));
      res.on('end', () => cb(null, Buffer.concat(partes)));
    });

const insertarDirecto = (cambios = {}) => {
  const fila = {
    id_contrato: randomUUID(),
    id_empleado: ANA,
    numero_contrato: `DIRECTO-${randomUUID().slice(0, 8)}`,
    periodo: '[2026-11-01,2027-01-01)',
    es_adenda: true,
    tipo_modificacion: 'AJUSTE_SALARIAL',
    id_contrato_anterior: CT_ANA,
    documento_adjunto_url: null,
    ...cambios,
  };
  return pool.query(
    `INSERT INTO contratos (id_contrato, id_empleado, id_tipo_contrato, id_tipo_jornada, numero_contrato, periodo_vigencia,
                            haber_mensual_pactado, es_adenda, tipo_modificacion, id_contrato_anterior, documento_adjunto_url)
     VALUES ($1, $2, 2, 1, $3, $4::daterange, 4000, $5, $6, $7, $8)`,
    [fila.id_contrato, fila.id_empleado, fila.numero_contrato, fila.periodo, fila.es_adenda, fila.tipo_modificacion,
      fila.id_contrato_anterior, fila.documento_adjunto_url]
  );
};

const limpiarTemporales = () => fs.rmSync(CARPETA_TEMPORAL, { recursive: true, force: true });

beforeAll(() => {
  limpiarTemporales();
  return pool.preparar(SEMILLA);
}, 30000);

afterAll(async () => {
  await pool.cerrar();
  limpiarTemporales();
});

beforeEach(() => pool.reiniciarRegistro());

describe('inmutabilidad de las versiones pasadas (KAN-301)', () => {
  let primeraAdenda;

  describe('registrar una modificación no altera las versiones anteriores', () => {
    test('una adenda deja idénticas, columna por columna, las versiones anteriores', async () => {
      const antes = await filasDe(ANA);
      const { status, body } = await registrar(adenda());
      const despues = await filasDe(ANA);

      expect(status).toBe(201);
      expect(despues).toHaveLength(antes.length + 1);
      expect(despues.slice(0, antes.length)).toEqual(antes);
      primeraAdenda = body;
    });

    test('una segunda adenda tampoco cambia el contrato ni la primera adenda', async () => {
      const antes = await filasDe(ANA);
      const { status } = await registrar(
        adenda({ tipo_modificacion: 'CAMBIO_JORNADA', numero_contrato: 'CT-ANA-A2', fecha_vigencia: '2026-09-01', id_tipo_jornada: '2', haber_mensual_pactado: '' })
      );

      expect(status).toBe(201);
      expect((await filasDe(ANA)).slice(0, antes.length)).toEqual(antes);
    });

    test('una renovación deja idéntico el contrato renovado', async () => {
      const antes = await filasDe(LUIS);
      const { status } = await registrar({
        id_empleado: LUIS,
        tipo_modificacion: 'RENOVACION',
        numero_contrato: 'CT-LUIS-2',
        fecha_vigencia: '2026-11-01',
        fecha_fin: '2027-10-31',
        justificacion: 'Renovación anual.',
      });

      expect(status).toBe(201);
      expect((await filasDe(LUIS)).slice(0, antes.length)).toEqual(antes);
    });

    test('el registro solo inserta: nunca ejecuta UPDATE ni DELETE sobre contratos', async () => {
      const { status } = await registrar(adenda({ numero_contrato: 'CT-ANA-A3', fecha_vigencia: '2026-10-01', haber_mensual_pactado: '4000' }));

      expect(status).toBe(201);
      expect(pool.consultas.filter((sql) => /^INSERT INTO contratos/i.test(sql))).toHaveLength(1);
      expect(pool.consultas.filter((sql) => /^(UPDATE|DELETE)\b[^;]*\bcontratos\b/i.test(sql))).toEqual([]);
    });

    test('la nueva versión apunta a la que reemplaza y hereda lo que no modifica', async () => {
      expect(primeraAdenda).toMatchObject({
        id_contrato_anterior: CT_ANA,
        numero_contrato_anterior: 'CT-ANA',
        es_adenda: true,
        tipo_contrato: 'Plazo fijo',
        tipo_jornada: 'Jornada completa',
        haber_mensual_pactado: '3800.00',
        fecha_fin_contrato: '2026-12-31',
        justificacion: 'Incremento por evaluación de desempeño.',
      });
    });
  });

  describe('no existen operaciones de edición ni borrado', () => {
    test.each([
      ['put', `/contratos/${CT_ANA}`],
      ['patch', `/contratos/${CT_ANA}`],
      ['delete', `/contratos/${CT_ANA}`],
      ['put', `/contratos/${CT_ANA}/documento`],
      ['delete', `/contratos/${CT_ANA}/documento`],
    ])('%s %s responde 404 y no toca el historial', async (metodo, ruta) => {
      const antes = await filasDe(ANA);
      const { status } = await request(app)[metodo](ruta).set('X-Rol', 'admin').send({ haber_mensual_pactado: '1' });

      expect(status).toBe(404);
      expect(await filasDe(ANA)).toEqual(antes);
    });
  });

  describe('los registros rechazados no dejan rastro', () => {
    test('una vigencia inconsistente no inserta filas ni deja el documento en disco', async () => {
      const [total, archivos] = [await totalContratos(), archivosGuardados()];
      const { status } = await registrar(adenda({ numero_contrato: 'CT-ANA-X', fecha_vigencia: '2026-02-01' }));

      expect(status).toBe(409);
      expect(await totalContratos()).toBe(total);
      expect(archivosGuardados()).toEqual(archivos);
    });

    test('un fallo de la base de datos después de subir el archivo descarta el documento', async () => {
      const [total, archivos] = [await totalContratos(), archivosGuardados()];
      const { status, body } = await registrar(adenda({ numero_contrato: 'CT-ANA-X', fecha_vigencia: '2026-11-01' }), { usuario: INEXISTENTE });

      expect(status).toBe(400);
      expect(body.errores[0].campo).toBe('registrado_por');
      expect(await totalContratos()).toBe(total);
      expect(archivosGuardados()).toEqual(archivos);
    });

    test('un número de contrato ya registrado no se puede reutilizar', async () => {
      const { status, body } = await registrar(adenda({ numero_contrato: 'CT-ANA', fecha_vigencia: '2026-11-01' }));

      expect(status).toBe(409);
      expect(body.errores).toEqual([{ campo: 'numero_contrato', mensaje: expect.stringContaining('CT-ANA') }]);
    });
  });

  describe('garantías de la base de datos, sin triggers', () => {
    test('no hay triggers propios sobre la tabla de contratos', async () => {
      const { rows } = await pool.query(
        "SELECT count(*)::int AS total FROM pg_trigger WHERE tgrelid = 'contratos'::regclass AND NOT tgisinternal"
      );

      expect(rows[0].total).toBe(0);
    });

    test('impide que dos versiones reemplacen a la misma, aunque se inserte por fuera del backend', async () => {
      await expect(insertarDirecto()).rejects.toMatchObject({
        code: '23505',
        message: expect.stringContaining('uq_contrato_version_anterior'),
      });
    });

    test.each([
      ['una adenda sin versión anterior', { id_contrato_anterior: null }, 'ck_contrato_version_encadenada'],
      ['un tipo de cambio que no coincide con es_adenda', { es_adenda: false }, 'ck_contrato_adenda_segun_tipo'],
      ['una versión sin fecha de vigencia', { periodo: '(,2027-01-01)' }, 'ck_contrato_fecha_vigencia'],
      ['un documento con datos incompletos', { documento_adjunto_url: '/uploads/contratos/x.pdf' }, 'ck_contrato_documento_completo'],
      ['una versión que se reemplaza a sí misma', { id_contrato: id(777), id_contrato_anterior: id(777) }, 'ck_contrato_no_se_reemplaza'],
    ])('rechaza %s', async (descripcion, cambios, restriccion) => {
      await expect(insertarDirecto(cambios)).rejects.toMatchObject({ code: '23514', message: expect.stringContaining(restriccion) });
    });
  });

  describe('el documento firmado se conserva íntegro', () => {
    test('la descarga es idéntica al archivo subido y conserva su nombre original', async () => {
      const { status, body, headers } = await descargar(primeraAdenda.id_contrato);

      expect(status).toBe(200);
      expect(body).toEqual(PDF.contenido);
      expect(headers['content-type']).toMatch(/^application\/pdf/);
      expect(decodeURIComponent(headers['content-disposition'])).toContain('adenda año 2026.pdf');
    });

    test('el hash SHA-256 guardado corresponde al archivo en disco', async () => {
      const enDisco = fs.readFileSync(path.join(process.cwd(), primeraAdenda.documento_adjunto_url));

      expect(primeraAdenda.documento_hash_sha256).toBe(createHash('sha256').update(PDF.contenido).digest('hex'));
      expect(createHash('sha256').update(enDisco).digest('hex')).toBe(primeraAdenda.documento_hash_sha256);
    });

    test('una versión sin documento responde 404 al descargar', async () => {
      const { status } = await descargar(CT_ANA);

      expect(status).toBe(404);
    });
  });
});
