const CARPETA_TEMPORAL = 'tests/.tmp/contratos-cronologia';
process.env.CONTRATOS_DIR = `${CARPETA_TEMPORAL}/documentos`;

jest.mock('../db/pool', () => require('./helpers/bdEnMemoria').crearBdEnMemoria());

const fs = require('node:fs');
const request = require('supertest');
const pool = require('../db/pool');
const app = require('../index');

const id = (n) => `d0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const ANA = id(1);
const LUIS = id(2);
const ROSA = id(3);
const PEDRO = id(4);
const MARIO = id(5);
const RRHH = id(6);
const INEXISTENTE = id(999);

const CT_ANA = id(201);
const CT_LUIS = id(202);
const CT_ROSA = id(203);
const CT_MARIO = id(204);
const CT_MARIO_A1 = id(205);
const CT_MARIO_A2 = id(206);

const SEMILLA = `
INSERT INTO departamentos (id_departamento, codigo, nombre) VALUES ('${id(10)}', 'OPS', 'Operaciones');
INSERT INTO cargos (id_cargo, id_departamento, codigo, nombre, salario_base_referencial, funciones_clave, requisitos_minimos)
  VALUES ('${id(20)}', '${id(10)}', 'CAJ', 'Cajero', 3000, 'Cobro', 'Bachiller');
INSERT INTO sucursales (id_sucursal, codigo_sucursal, nombre, direccion) VALUES ('${id(30)}', 'SOP', 'Sopocachi', 'Av. 6 de Agosto');
INSERT INTO estados_empleado VALUES (1, 'ACTIVO', 'Activo', TRUE);
INSERT INTO empleados (id_empleado, numero_documento, nombres, primer_apellido, fecha_nacimiento, genero, telefono_celular,
                       correo_personal, direccion_domicilio, fecha_ingreso, id_cargo_actual, id_sucursal_actual, id_estado_empleado) VALUES
  ('${ANA}', '1001', 'Ana', 'Peñaranda', '1990-03-14', 'Femenino', '71234567', 'ana@correo.com', 'Sopocachi', '2026-01-01', '${id(20)}', '${id(30)}', 1),
  ('${LUIS}', '1002', 'Luis', 'Mamani', '1988-07-01', 'Masculino', '72345678', 'luis@correo.com', 'Calacoto', '2025-11-01', '${id(20)}', '${id(30)}', 1),
  ('${ROSA}', '1003', 'Rosa', 'Quispe', '1999-12-24', 'Femenino', '73456789', 'rosa@correo.com', 'Zona Sur', '2018-02-01', '${id(20)}', '${id(30)}', 1),
  ('${PEDRO}', '1004', 'Pedro', 'Condori', '1985-05-05', 'Masculino', '74567890', 'pedro@correo.com', 'El Alto', '2020-01-15', '${id(20)}', '${id(30)}', 1),
  ('${MARIO}', '1005', 'Mario', 'Ticona', '1992-09-09', 'Masculino', '75678901', 'mario@correo.com', 'Miraflores', '2024-01-01', '${id(20)}', '${id(30)}', 1),
  ('${RRHH}', '1006', 'Rita', 'Vargas', '1980-01-01', 'Femenino', '76789012', 'rita@correo.com', 'Centro', '2015-01-01', '${id(20)}', '${id(30)}', 1);
INSERT INTO tipos_contrato VALUES (1, 'INDEFINIDO', 'Indefinido'), (2, 'PLAZO_FIJO', 'Plazo fijo');
INSERT INTO tipos_jornada VALUES (1, 'COMPLETA', 'Jornada completa', 48), (2, 'PARCIAL', 'Medio tiempo', 24);
INSERT INTO contratos (id_contrato, id_empleado, id_tipo_contrato, id_tipo_jornada, numero_contrato, periodo_vigencia,
                       haber_mensual_pactado, es_adenda, motivo_adenda, tipo_modificacion, id_contrato_anterior, registrado_en) VALUES
  ('${CT_ANA}', '${ANA}', 2, 1, 'CT-ANA', daterange('2026-01-01', '2026-12-31', '[]'), 3500, FALSE, NULL, 'CONTRATO_INICIAL', NULL, now() - INTERVAL '1 year'),
  ('${CT_LUIS}', '${LUIS}', 2, 2, 'CT-LUIS', daterange('2025-11-01', '2026-10-31', '[]'), 2500, FALSE, NULL, 'CONTRATO_INICIAL', NULL, now() - INTERVAL '1 year'),
  ('${CT_ROSA}', '${ROSA}', 1, 1, 'CT-ROSA', daterange('2018-02-01', NULL), 6000, FALSE, NULL, 'CONTRATO_INICIAL', NULL, now() - INTERVAL '8 years'),
  ('${CT_MARIO}', '${MARIO}', 1, 1, 'CT-MARIO', daterange((CURRENT_DATE - 400)::date, NULL), 4000, FALSE, NULL, 'CONTRATO_INICIAL', NULL, now() - INTERVAL '400 days'),
  ('${CT_MARIO_A1}', '${MARIO}', 1, 2, 'CT-MARIO-A1', daterange((CURRENT_DATE - 30)::date, NULL), 4000, TRUE, 'Medio tiempo', 'CAMBIO_JORNADA', '${CT_MARIO}', now() - INTERVAL '30 days'),
  ('${CT_MARIO_A2}', '${MARIO}', 1, 2, 'CT-MARIO-A2', daterange((CURRENT_DATE + 30)::date, NULL), 4500, TRUE, 'Ajuste programado', 'AJUSTE_SALARIAL', '${CT_MARIO_A1}', now());
`;

const PDF = { contenido: Buffer.from('%PDF-1.4 adenda firmada'), filename: 'adenda firmada.pdf', contentType: 'application/pdf' };

const registrar = (campos, { rol = 'admin', usuario = RRHH, documento = PDF } = {}) => {
  const peticion = request(app).post('/contratos/modificaciones').set('X-Rol', rol);
  if (usuario) peticion.set('X-Usuario-Id', usuario);
  Object.entries(campos).forEach(([campo, valor]) => peticion.field(campo, String(valor)));
  if (documento) peticion.attach('documento', documento.contenido, { filename: documento.filename, contentType: documento.contentType });
  return peticion;
};

const historial = async (idEmpleado) => {
  const { status, body } = await request(app).get(`/contratos?id_empleado=${idEmpleado}`).set('X-Rol', 'admin');
  expect(status).toBe(200);
  return body;
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

const renovacion = (cambios = {}) => ({
  id_empleado: LUIS,
  tipo_modificacion: 'RENOVACION',
  numero_contrato: 'CT-LUIS-2',
  fecha_vigencia: '2026-11-01',
  fecha_fin: '2027-10-31',
  justificacion: 'Renovación anual del contrato a plazo fijo.',
  ...cambios,
});

const fechaRelativa = async (dias) => {
  const { rows } = await pool.query(`SELECT (CURRENT_DATE + ${dias})::date AS fecha`);
  return rows[0].fecha;
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

describe('consistencia cronológica de contratos y adendas (KAN-301)', () => {
  describe('datos exigidos para formalizar una modificación', () => {
    test.each(['id_empleado', 'tipo_modificacion', 'numero_contrato', 'fecha_vigencia', 'justificacion'])(
      'sin %s responde 400 indicando el campo faltante',
      async (campo) => {
        const campos = adenda();
        delete campos[campo];
        const { status, body } = await registrar(campos);

        expect(status).toBe(400);
        expect(body.campos_faltantes).toContain(campo);
      }
    );

    test('sin documento de respaldo firmado responde 400', async () => {
      const { status, body } = await registrar(adenda(), { documento: null });

      expect(status).toBe(400);
      expect(body.campos_faltantes).toEqual(['documento']);
    });

    test.each([
      ['un cambio de jornada sin la nueva jornada', { tipo_modificacion: 'CAMBIO_JORNADA', haber_mensual_pactado: '' }, 'id_tipo_jornada'],
      ['un ajuste salarial sin el nuevo haber', { haber_mensual_pactado: '' }, 'haber_mensual_pactado'],
      ['un tipo de cambio fuera del catálogo', { tipo_modificacion: 'CONTRATO_INICIAL' }, 'tipo_modificacion'],
      ['una fecha de vigencia que no existe', { fecha_vigencia: '2026-02-30' }, 'fecha_vigencia'],
    ])('rechaza %s', async (descripcion, cambios, campo) => {
      const { status, body } = await registrar(adenda(cambios));

      expect(status).toBe(400);
      expect(body.errores.map((e) => e.campo)).toContain(campo);
    });
  });

  describe('bloqueo de fechas inconsistentes en adendas', () => {
    test.each([
      ['anterior al inicio del contrato vigente', '2025-12-01', /posterior al 2026-01-01/],
      ['el mismo día en que empieza la versión vigente', '2026-01-01', /posterior al 2026-01-01/],
      ['posterior al fin del contrato', '2027-01-15', /termina el 2026-12-31/],
    ])('rechaza una vigencia %s', async (descripcion, fecha, mensaje) => {
      const { status, body } = await registrar(adenda({ fecha_vigencia: fecha }));

      expect(status).toBe(409);
      expect(body.errores).toEqual([{ campo: 'fecha_vigencia', mensaje: expect.stringMatching(mensaje) }]);
    });

    test('una adenda no puede cambiar la fecha de fin del contrato', async () => {
      const { status, body } = await registrar(adenda({ fecha_fin: '2027-06-30' }));

      expect(status).toBe(400);
      expect(body.errores.map((e) => e.campo)).toContain('fecha_fin');
    });

    test('los intentos rechazados no agregan versiones al historial', async () => {
      expect(await historial(ANA)).toHaveLength(1);
    });
  });

  describe('bloqueo de solapamientos en renovaciones', () => {
    test.each([
      ['empieza antes del fin del contrato vigente', '2026-10-01'],
      ['empieza el mismo día en que termina el contrato vigente', '2026-10-31'],
    ])('rechaza una renovación que %s', async (descripcion, fecha) => {
      const { status, body } = await registrar(renovacion({ fecha_vigencia: fecha }));

      expect(status).toBe(409);
      expect(body.error).toMatch(/después del 2026-10-31/);
    });

    test('rechaza una renovación cuyo fin es anterior a su vigencia', async () => {
      const { status, body } = await registrar(renovacion({ fecha_fin: '2026-10-15' }));

      expect(status).toBe(400);
      expect(body.errores.map((e) => e.campo)).toContain('fecha_fin');
    });

    test('una renovación a plazo fijo sin fecha de fin se rechaza', async () => {
      const { status, body } = await registrar(renovacion({ fecha_fin: '' }));

      expect(status).toBe(400);
      expect(body.errores).toEqual([{ campo: 'fecha_fin', mensaje: 'El contrato de tipo «Plazo fijo» debe indicar su fecha de fin.' }]);
    });

    test('una renovación indefinida con fecha de fin se rechaza', async () => {
      const { status, body } = await registrar(renovacion({ id_tipo_contrato: '1' }));

      expect(status).toBe(400);
      expect(body.errores).toEqual([{ campo: 'fecha_fin', mensaje: 'Un contrato indefinido no tiene fecha de fin.' }]);
    });

    test('una renovación con un tipo de contrato inexistente se rechaza', async () => {
      const { status, body } = await registrar(renovacion({ id_tipo_contrato: '9' }));

      expect(status).toBe(400);
      expect(body.errores[0].campo).toBe('id_tipo_contrato');
    });

    test('las renovaciones rechazadas no agregan versiones al historial', async () => {
      expect(await historial(LUIS)).toHaveLength(1);
    });

    test('un contrato indefinido no se renueva, se modifica con adendas', async () => {
      const { status, body } = await registrar(renovacion({ id_empleado: ROSA, numero_contrato: 'CT-ROSA-2', fecha_fin: '' }));

      expect(status).toBe(409);
      expect(body.error).toMatch(/indefinido/);
    });

    test('un colaborador sin contrato inicial no puede registrar modificaciones', async () => {
      const { status, body } = await registrar(adenda({ id_empleado: PEDRO, numero_contrato: 'CT-PEDRO-A1' }));

      expect(status).toBe(409);
      expect(body.error).toMatch(/contrato inicial/);
    });

    test('acepta la renovación que empieza al día siguiente del fin y la encadena al contrato anterior', async () => {
      const { status, body } = await registrar(renovacion());

      expect(status).toBe(201);
      expect(body).toMatchObject({
        tipo_modificacion: 'RENOVACION',
        es_adenda: false,
        id_contrato_anterior: CT_LUIS,
        numero_contrato_anterior: 'CT-LUIS',
        fecha_vigencia: '2026-11-01',
        fecha_fin_contrato: '2027-10-31',
        numero_version: 2,
      });
    });

    test('una segunda renovación debe empezar después del fin de la renovación vigente', async () => {
      const { status, body } = await registrar(renovacion({ numero_contrato: 'CT-LUIS-3', fecha_vigencia: '2027-06-01', fecha_fin: '2028-05-31' }));

      expect(status).toBe(409);
      expect(body.error).toMatch(/después del 2027-10-31/);
    });

    test('se puede renovar después de un periodo sin contrato', async () => {
      const { status, body } = await registrar(
        renovacion({ numero_contrato: 'CT-LUIS-3', fecha_vigencia: '2028-01-01', fecha_fin: '', id_tipo_contrato: '1' })
      );

      expect(status).toBe(201);
      expect(body).toMatchObject({ fecha_vigencia: '2028-01-01', fecha_fin_contrato: null, tipo_contrato: 'Indefinido' });
    });
  });

  describe('la versión de referencia avanza con cada registro', () => {
    test('después de una adenda, la siguiente debe ser posterior a ella y no solo al contrato', async () => {
      expect((await registrar(adenda())).status).toBe(201);

      const anterior = await registrar(adenda({ numero_contrato: 'CT-ANA-A2', fecha_vigencia: '2026-05-01', haber_mensual_pactado: '3900' }));
      const mismoDia = await registrar(adenda({ numero_contrato: 'CT-ANA-A2', fecha_vigencia: '2026-06-01', haber_mensual_pactado: '3900' }));

      expect(anterior.status).toBe(409);
      expect(anterior.body.error).toMatch(/posterior al 2026-06-01, inicio de la versión vigente del contrato CT-ANA-A1/);
      expect(mismoDia.status).toBe(409);
    });

    test('una adenda posterior a la última versión se acepta', async () => {
      const { status, body } = await registrar(
        adenda({ tipo_modificacion: 'CAMBIO_JORNADA', numero_contrato: 'CT-ANA-A2', fecha_vigencia: '2026-09-01', id_tipo_jornada: '2', haber_mensual_pactado: '' })
      );

      expect(status).toBe(201);
      expect(body).toMatchObject({ numero_version: 3, tipo_jornada: 'Medio tiempo', haber_mensual_pactado: '3800.00' });
    });
  });

  describe('línea de tiempo cronológica', () => {
    test('las versiones salen en orden cronológico, numeradas y encadenadas a la anterior', async () => {
      const versiones = await historial(ANA);

      expect(versiones.map(({ numero_version, numero_contrato, fecha_vigencia }) => [numero_version, numero_contrato, fecha_vigencia])).toEqual([
        [1, 'CT-ANA', '2026-01-01'],
        [2, 'CT-ANA-A1', '2026-06-01'],
        [3, 'CT-ANA-A2', '2026-09-01'],
      ]);
      versiones.forEach((version, i) => {
        expect(version.id_contrato_anterior).toBe(i === 0 ? null : versiones[i - 1].id_contrato);
      });
    });

    test('cada versión rige hasta el día anterior a la siguiente y la última hasta el fin del contrato', async () => {
      const versiones = await historial(ANA);

      expect(versiones.map((v) => v.vigente_hasta)).toEqual(['2026-05-31', '2026-08-31', '2026-12-31']);
      expect(versiones.every((v) => v.fecha_fin_contrato === '2026-12-31')).toBe(true);
    });

    test('las adendas conservan el tipo de contrato y solo cambian lo que modifican', async () => {
      const versiones = await historial(ANA);

      expect(versiones.map(({ tipo_contrato, tipo_jornada, haber_mensual_pactado }) => [tipo_contrato, tipo_jornada, haber_mensual_pactado])).toEqual([
        ['Plazo fijo', 'Jornada completa', '3500.00'],
        ['Plazo fijo', 'Jornada completa', '3800.00'],
        ['Plazo fijo', 'Medio tiempo', '3800.00'],
      ]);
    });

    test('una renovación cierra la vigencia del contrato anterior en su fecha de fin', async () => {
      const versiones = await historial(LUIS);

      expect(versiones.map(({ numero_contrato, fecha_vigencia, vigente_hasta }) => [numero_contrato, fecha_vigencia, vigente_hasta])).toEqual([
        ['CT-LUIS', '2025-11-01', '2026-10-31'],
        ['CT-LUIS-2', '2026-11-01', '2027-10-31'],
        ['CT-LUIS-3', '2028-01-01', null],
      ]);
    });

    test('solo la versión que rige hoy está vigente; la programada no', async () => {
      const versiones = await historial(MARIO);
      const [inicioA2, finA1] = [await fechaRelativa(30), await fechaRelativa(29)];

      expect(versiones.map(({ numero_contrato, es_version_vigente }) => [numero_contrato, es_version_vigente])).toEqual([
        ['CT-MARIO', false],
        ['CT-MARIO-A1', true],
        ['CT-MARIO-A2', false],
      ]);
      expect(versiones[1].vigente_hasta).toBe(finA1);
      expect(versiones[2]).toMatchObject({ fecha_vigencia: inicioA2, vigente_hasta: null });
    });

    test('el Kardex muestra como contrato vigente la versión de hoy y cuenta las adendas', async () => {
      const { status, body } = await request(app).get(`/empleados/${MARIO}/kardex`).set('X-Rol', 'gerente');

      expect(status).toBe(200);
      expect(body.resumen.contrato_vigente).toMatchObject({ numero_contrato: 'CT-MARIO-A1', tipo_jornada: 'Medio tiempo' });
      expect(body.resumen.totales).toMatchObject({ contratos: 1, adendas: 2 });
    });

    test('el historial de un colaborador inexistente responde 404 y sin colaborador 400', async () => {
      const inexistente = await request(app).get(`/contratos?id_empleado=${INEXISTENTE}`).set('X-Rol', 'admin');
      const sinColaborador = await request(app).get('/contratos').set('X-Rol', 'admin');

      expect(inexistente.status).toBe(404);
      expect(sinColaborador.status).toBe(400);
      expect(sinColaborador.body.campos_faltantes).toEqual(['id_empleado']);
    });

    test('un colaborador sin contratos tiene un historial vacío', async () => {
      expect(await historial(PEDRO)).toEqual([]);
    });
  });
});
