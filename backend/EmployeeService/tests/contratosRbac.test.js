const CARPETA_TEMPORAL = 'tests/.tmp/contratos-rbac';
process.env.CONTRATOS_DIR = `${CARPETA_TEMPORAL}/documentos`;

jest.mock('../db/pool', () => require('./helpers/bdEnMemoria').crearBdEnMemoria());

const fs = require('node:fs');
const path = require('node:path');
const request = require('supertest');
const pool = require('../db/pool');
const app = require('../index');

const id = (n) => `b0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const ANA = id(1);
const RRHH = id(2);
const GERENTE = id(3);

const CT_ANA = id(201);

const SEMILLA = `
INSERT INTO departamentos (id_departamento, codigo, nombre) VALUES ('${id(10)}', 'OPS', 'Operaciones');
INSERT INTO cargos (id_cargo, id_departamento, codigo, nombre, salario_base_referencial, funciones_clave, requisitos_minimos)
  VALUES ('${id(20)}', '${id(10)}', 'CAJ', 'Cajero', 3000, 'Cobro', 'Bachiller');
INSERT INTO sucursales (id_sucursal, codigo_sucursal, nombre, direccion) VALUES ('${id(30)}', 'SOP', 'Sopocachi', 'Av. 6 de Agosto');
INSERT INTO estados_empleado VALUES (1, 'ACTIVO', 'Activo', TRUE);
INSERT INTO empleados (id_empleado, numero_documento, nombres, primer_apellido, fecha_nacimiento, genero, telefono_celular,
                       correo_personal, direccion_domicilio, fecha_ingreso, id_cargo_actual, id_sucursal_actual, id_estado_empleado) VALUES
  ('${ANA}', '3001', 'Ana', 'Peñaranda', '1990-03-14', 'Femenino', '71234567', 'ana@correo.com', 'Sopocachi', '2026-01-01', '${id(20)}', '${id(30)}', 1),
  ('${RRHH}', '3002', 'Rita', 'Vargas', '1980-01-01', 'Femenino', '76789012', 'rita@correo.com', 'Centro', '2015-01-01', '${id(20)}', '${id(30)}', 1),
  ('${GERENTE}', '3003', 'Gonzalo', 'Rojas', '1978-04-04', 'Masculino', '77890123', 'gonzalo@correo.com', 'Centro', '2012-01-01', '${id(20)}', '${id(30)}', 1);
INSERT INTO tipos_contrato VALUES (1, 'INDEFINIDO', 'Indefinido'), (2, 'PLAZO_FIJO', 'Plazo fijo');
INSERT INTO tipos_jornada VALUES (1, 'COMPLETA', 'Jornada completa', 48), (2, 'PARCIAL', 'Medio tiempo', 24);
INSERT INTO contratos (id_contrato, id_empleado, id_tipo_contrato, id_tipo_jornada, numero_contrato, periodo_vigencia,
                       haber_mensual_pactado, tipo_modificacion) VALUES
  ('${CT_ANA}', '${ANA}', 2, 1, 'CT-ANA', daterange('2026-01-01', '2026-12-31', '[]'), 3500, 'CONTRATO_INICIAL');
`;

const PDF = { contenido: Buffer.from('%PDF-1.4 adenda firmada'), filename: 'adenda.pdf', contentType: 'application/pdf' };

const ROLES_SIN_ACCESO = ['empleado', 'supervisor', 'reclutador'];

let siguienteAdenda = 0;
const adenda = (cambios = {}) => {
  siguienteAdenda += 1;
  return {
    id_empleado: ANA,
    tipo_modificacion: 'AJUSTE_CONDICIONES',
    numero_contrato: `CT-ANA-A${siguienteAdenda}`,
    fecha_vigencia: new Date(Date.UTC(2026, 0, 1 + siguienteAdenda * 7)).toISOString().slice(0, 10),
    justificacion: 'Cambio de sucursal de trabajo acordado.',
    ...cambios,
  };
};

const registrar = (campos, cabeceras = {}) => {
  const peticion = request(app).post('/contratos/modificaciones').set(cabeceras);
  Object.entries(campos).forEach(([campo, valor]) => peticion.field(campo, String(valor)));
  return peticion.attach('documento', PDF.contenido, { filename: PDF.filename, contentType: PDF.contentType });
};

const RUTAS = [
  ['GET', '/contratos', (r) => r.get(`/contratos?id_empleado=${ANA}`)],
  ['GET', '/contratos/catalogos', (r) => r.get('/contratos/catalogos')],
  ['GET', '/contratos/:id/documento', (r) => r.get(`/contratos/${CT_ANA}/documento`)],
];

const archivosGuardados = () => {
  const carpeta = path.join(process.cwd(), process.env.CONTRATOS_DIR);
  return fs.existsSync(carpeta) ? fs.readdirSync(carpeta) : [];
};
const totalContratos = async () => (await pool.query('SELECT count(*)::int AS total FROM contratos')).rows[0].total;
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

describe('restricciones RBAC de contratos y adendas (KAN-301)', () => {
  describe('sin identificación', () => {
    test.each(RUTAS)('%s %s sin X-Rol responde 401 sin consultar la BD', async (metodo, ruta, peticion) => {
      const { status } = await peticion(request(app));

      expect(status).toBe(401);
      expect(pool.consultas).toHaveLength(0);
    });

    test('POST /contratos/modificaciones sin X-Rol responde 401 sin guardar el documento', async () => {
      const antes = archivosGuardados();
      const { status } = await registrar(adenda());

      expect(status).toBe(401);
      expect(pool.consultas).toHaveLength(0);
      expect(archivosGuardados()).toEqual(antes);
    });
  });

  describe('roles sin permiso', () => {
    test.each(ROLES_SIN_ACCESO.flatMap((rol) => RUTAS.map(([metodo, ruta, peticion]) => [rol, metodo, ruta, peticion])))(
      'el rol %s recibe 403 en %s %s sin consultar la BD',
      async (rol, metodo, ruta, peticion) => {
        const { status, body } = await peticion(request(app)).set('X-Rol', rol);

        expect(status).toBe(403);
        expect(body.error).toMatch(/no tiene permiso/);
        expect(pool.consultas).toHaveLength(0);
      }
    );

    test.each(ROLES_SIN_ACCESO)('el rol %s no puede registrar modificaciones y no se guarda nada', async (rol) => {
      const [antes, total] = [archivosGuardados(), await totalContratos()];
      pool.reiniciarRegistro();
      const { status } = await registrar(adenda(), { 'X-Rol': rol, 'X-Usuario-Id': ANA });

      expect(status).toBe(403);
      expect(pool.consultas).toHaveLength(0);
      expect(archivosGuardados()).toEqual(antes);
      expect(await totalContratos()).toBe(total);
    });

    test('un rol desconocido también recibe 403', async () => {
      const { status } = await request(app).get('/contratos/catalogos').set('X-Rol', 'root');

      expect(status).toBe(403);
    });
  });

  describe('Administrador de RRHH y Gerente de talento', () => {
    test.each(['admin', 'gerente'])('el rol %s consulta el historial y los catálogos', async (rol) => {
      const historial = await request(app).get(`/contratos?id_empleado=${ANA}`).set('X-Rol', rol);
      const catalogos = await request(app).get('/contratos/catalogos').set('X-Rol', rol);

      expect(historial.status).toBe(200);
      expect(catalogos.status).toBe(200);
      expect(catalogos.body.tipos_modificacion).toEqual(['RENOVACION', 'CAMBIO_JORNADA', 'AJUSTE_SALARIAL', 'AJUSTE_CONDICIONES']);
    });

    test.each([
      ['admin', RRHH, 'Rita Vargas'],
      ['gerente', GERENTE, 'Gonzalo Rojas'],
    ])('el rol %s registra una adenda y queda como autor', async (rol, usuario, nombre) => {
      const { status, body } = await registrar(adenda(), { 'X-Rol': rol, 'X-Usuario-Id': usuario });

      expect(status).toBe(201);
      expect(body).toMatchObject({ registrado_por: usuario, registrado_por_nombre: nombre, registrado_rol: rol });
    });

    test('el rol se reconoce sin importar mayúsculas ni espacios y se guarda normalizado', async () => {
      const { status, body } = await registrar(adenda(), { 'X-Rol': '  GERENTE ', 'X-Usuario-Id': GERENTE });

      expect(status).toBe(201);
      expect(body.registrado_rol).toBe('gerente');
    });

    test('la autoría sale de las cabeceras, no del cuerpo de la petición', async () => {
      const { status, body } = await registrar(adenda({ registrado_rol: 'admin', registrado_por: RRHH }), {
        'X-Rol': 'gerente',
        'X-Usuario-Id': GERENTE,
      });

      expect(status).toBe(201);
      expect(body).toMatchObject({ registrado_rol: 'gerente', registrado_por: GERENTE });
    });

    test('el rol con permiso descarga el documento firmado', async () => {
      const { body: version } = await registrar(adenda(), { 'X-Rol': 'admin', 'X-Usuario-Id': RRHH });
      const { status } = await request(app).get(`/contratos/${version.id_contrato}/documento`).set('X-Rol', 'gerente');

      expect(status).toBe(200);
    });
  });

  describe('identidad de quien registra', () => {
    test('un X-Usuario-Id que no es UUID responde 400 y no se guarda el documento', async () => {
      const antes = archivosGuardados();
      const { status, body } = await registrar(adenda(), { 'X-Rol': 'admin', 'X-Usuario-Id': 'rita' });

      expect(status).toBe(400);
      expect(body.errores[0].campo).toBe('X-Usuario-Id');
      expect(archivosGuardados()).toEqual(antes);
    });

    test('sin X-Usuario-Id responde 401, no registra la versión y descarta el documento', async () => {
      const [antes, total] = [archivosGuardados(), await totalContratos()];
      const { status, body } = await registrar(adenda(), { 'X-Rol': 'admin' });

      expect(status).toBe(401);
      expect(body.campos_faltantes).toEqual(['X-Usuario-Id']);
      expect(await totalContratos()).toBe(total);
      expect(archivosGuardados()).toEqual(antes);
    });

    test('un X-Usuario-Id que no corresponde a un empleado responde 400 y no registra la versión', async () => {
      const total = await totalContratos();
      const { status, body } = await registrar(adenda(), { 'X-Rol': 'admin', 'X-Usuario-Id': id(999) });

      expect(status).toBe(400);
      expect(body.errores[0].campo).toBe('registrado_por');
      expect(await totalContratos()).toBe(total);
    });

    test('cada versión registrada conserva su autor en el historial', async () => {
      const { body } = await request(app).get(`/contratos?id_empleado=${ANA}`).set('X-Rol', 'admin');
      const modificaciones = body.filter((version) => version.tipo_modificacion !== 'CONTRATO_INICIAL');

      expect(modificaciones.length).toBeGreaterThan(0);
      modificaciones.forEach((version) => {
        expect(version.registrado_por).not.toBeNull();
        expect(version.registrado_por_nombre).toEqual(expect.any(String));
      });
    });
  });
});
