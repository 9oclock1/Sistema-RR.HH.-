jest.mock('../db/pool', () => require('./helpers/bdEnMemoria').crearBdEnMemoria());

const request = require('supertest');
const pool = require('../db/pool');
const app = require('../index');
const { semaforoMaximo, esBajaTemprana, calcularRotacionTemprana } = require('../src/utils/rotacionTemprana');

const id = (n) => `c1200000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const AREA = { ATENCION: id(1), RRHH: id(2) };
const CARGO = { CAJERO: id(11), ANALISTA: id(12) };
const SUCURSAL = { SOPOCACHI: id(21), MIRAFLORES: id(22) };
const ACTIVO = 1;
const BAJA = 4;

let siguiente = 100;
// [nombre, ingreso, baja, cargo, sucursal]
const colaborador = (nombre, ingreso, baja = null, cargo = CARGO.CAJERO, sucursal = SUCURSAL.SOPOCACHI) => {
  siguiente += 1;
  return `('${id(siguiente)}', '${siguiente}', '${nombre}', 'Prueba', '1995-01-01', 'Femenino', '70000000',
           '${nombre.toLowerCase()}@correo.test', 'La Paz', '${ingreso}', ${baja ? `'${baja}'` : 'NULL'},
           '${cargo}', '${sucursal}', ${baja ? BAJA : ACTIVO})`;
};

// Periodo de prueba: primer semestre de 2026.
//   Ingresos en el periodo: Ana, Beto, Caro, Dani, Eva, Lalo (Atención) y Fito, Gabi (RRHH) -> 8.
//   Bajas en el periodo:    Zoe (ingresó en dic-2025, se fue con 53 días: temprana, aunque ingresó antes del periodo)
//                           Beto (89 días: temprana, en el límite) y Caro (90 días justos: NO temprana)
//                           Fito (RRHH, Miraflores, 30 días: temprana).                     -> 3 / 8 = 37,5 %
//   Fuera del periodo:      Hugo ingresó y se fue en julio; Ivo sigue activo desde 2020; Lalo ingresó en S1
//                           (cuenta como ingreso) pero se fue en julio con 40 días (su baja es del segundo semestre).
const SEMILLA = `
INSERT INTO departamentos (id_departamento, codigo, nombre) VALUES
  ('${AREA.ATENCION}', 'ATC', 'Atención al cliente'), ('${AREA.RRHH}', 'RRHH', 'Recursos Humanos');
INSERT INTO cargos (id_cargo, id_departamento, codigo, nombre, salario_base_referencial, funciones_clave, requisitos_minimos) VALUES
  ('${CARGO.CAJERO}', '${AREA.ATENCION}', 'CAJ', 'Cajero', 3000, 'Cobro', 'Bachiller'),
  ('${CARGO.ANALISTA}', '${AREA.RRHH}', 'ANA', 'Analista', 5000, 'Gestión', 'Licenciatura');
INSERT INTO sucursales (id_sucursal, codigo_sucursal, nombre, direccion) VALUES
  ('${SUCURSAL.SOPOCACHI}', 'SOP', 'Sopocachi', 'Av. 6 de Agosto'), ('${SUCURSAL.MIRAFLORES}', 'MIR', 'Miraflores', 'Av. Busch');
INSERT INTO estados_empleado VALUES (1, 'ACTIVO', 'Activo', TRUE), (4, 'BAJA', 'Baja', FALSE);
INSERT INTO empleados (id_empleado, numero_documento, nombres, primer_apellido, fecha_nacimiento, genero, telefono_celular,
                       correo_personal, direccion_domicilio, fecha_ingreso, fecha_baja, id_cargo_actual, id_sucursal_actual,
                       id_estado_empleado) VALUES
  ${[
    colaborador('Ana', '2026-01-05'),
    colaborador('Beto', '2026-01-10', '2026-04-09'),
    colaborador('Caro', '2026-02-01', '2026-05-02'),
    colaborador('Dani', '2026-03-15', null, CARGO.CAJERO, SUCURSAL.MIRAFLORES),
    colaborador('Eva', '2026-06-30'),
    colaborador('Fito', '2026-04-01', '2026-05-01', CARGO.ANALISTA, SUCURSAL.MIRAFLORES),
    colaborador('Gabi', '2026-05-20', null, CARGO.ANALISTA, SUCURSAL.SOPOCACHI),
    colaborador('Zoe', '2025-12-10', '2026-02-01'),
    colaborador('Hugo', '2026-07-01', '2026-07-20'),
    colaborador('Ivo', '2020-01-01'),
    colaborador('Lalo', '2026-06-10', '2026-07-20'),
  ].join(',\n  ')};
`;

const S1 = { desde: '2026-01-01', hasta: '2026-06-30' };
const RUTA = '/empleados/indicadores/rotacion-temprana';
const consultar = (parametros, rol = 'gerente') => {
  const peticion = request(app).get(RUTA).query(parametros);
  return rol ? peticion.set('X-Rol', rol) : peticion;
};

beforeAll(() => pool.preparar(SEMILLA), 30000);
afterAll(() => pool.cerrar());

describe('KPI-12: fórmula y semáforo', () => {
  test('una baja es temprana solo si se va antes de cumplir 90 días', () => {
    expect(esBajaTemprana({ fecha_ingreso: '2026-01-10', fecha_baja: '2026-04-09' })).toBe(true); // 89 días
    expect(esBajaTemprana({ fecha_ingreso: '2026-02-01', fecha_baja: '2026-05-02' })).toBe(false); // 90 días
  });

  test('semáforo de meta máxima (<= 15 %): verde, amarillo hasta 16,5 % y rojo después', () => {
    expect(semaforoMaximo(0, 15)).toBe('VERDE');
    expect(semaforoMaximo(15, 15)).toBe('VERDE');
    expect(semaforoMaximo(15.01, 15)).toBe('AMARILLO');
    expect(semaforoMaximo(16.5, 15)).toBe('AMARILLO');
    expect(semaforoMaximo(16.51, 15)).toBe('ROJO');
    expect(semaforoMaximo(null, 15)).toBeNull();
  });

  test('sin ingresos en el periodo el KPI queda sin valor ni semáforo', () => {
    const kpi = calcularRotacionTemprana({ ingresos: [], bajas: [] }, S1);
    expect(kpi.valor).toBeNull();
    expect(kpi.semaforo).toBeNull();
  });
});

describe('GET /empleados/indicadores/rotacion-temprana', () => {
  test('criterio 3: bajas con menos de 90 días del periodo sobre los ingresos del periodo', async () => {
    const res = await consultar(S1);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      codigo: 'KPI-12',
      meta: 15,
      sentido_meta: 'MAXIMO',
      ingresos_periodo: 8,
      bajas_periodo: 4,
      bajas_tempranas: 3,
      valor: 37.5,
      semaforo: 'ROJO',
    });
    expect(res.body.detalle_bajas_tempranas.map((b) => [b.nombre_completo, b.dias_antiguedad])).toEqual([
      ['Zoe Prueba', 53],
      ['Beto Prueba', 89],
      ['Fito Prueba', 30],
    ]);
  });

  test('criterio 2: se recalcula al filtrar por área', async () => {
    const res = await consultar({ ...S1, departamento: AREA.RRHH });
    expect(res.body).toMatchObject({ ingresos_periodo: 2, bajas_tempranas: 1, valor: 50, semaforo: 'ROJO' });
  });

  test('criterio 2: se recalcula al filtrar por sucursal', async () => {
    const res = await consultar({ ...S1, sucursal: SUCURSAL.MIRAFLORES });
    expect(res.body).toMatchObject({ ingresos_periodo: 2, bajas_tempranas: 1, valor: 50 });
  });

  test('criterio 2: se recalcula al cambiar de periodo (Hugo y Lalo se van en julio; solo Hugo ingresó en S2)', async () => {
    const res = await consultar({ desde: '2026-07-01', hasta: '2026-12-31' });
    expect(res.body).toMatchObject({ ingresos_periodo: 1, bajas_periodo: 2, bajas_tempranas: 2, valor: 200, semaforo: 'ROJO' });
  });

  test('un periodo sin bajas tempranas cumple la meta', async () => {
    const res = await consultar({ desde: '2025-12-01', hasta: '2025-12-31' });
    expect(res.body).toMatchObject({ ingresos_periodo: 1, bajas_tempranas: 0, valor: 0, semaforo: 'VERDE' });
  });

  test('valida las fechas y los filtros', async () => {
    expect((await consultar({ hasta: '2026-06-30' })).status).toBe(400);
    expect((await consultar({ desde: '2026-02-30', hasta: '2026-06-30' })).status).toBe(400);
    expect((await consultar({ desde: '2026-06-30', hasta: '2026-01-01' })).status).toBe(400);
    expect((await consultar({ ...S1, sucursal: 'no-es-uuid' })).status).toBe(400);
  });

  test('solo el Gerente y el Administrador de RRHH lo consultan', async () => {
    expect((await consultar(S1, 'admin')).status).toBe(200);
    expect((await consultar(S1, 'empleado')).status).toBe(403);
    expect((await consultar(S1, 'supervisor')).status).toBe(403);
    expect((await consultar(S1, null)).status).toBe(401);
  });
});
