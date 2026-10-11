const fs = require('node:fs');
const path = require('node:path');

const CARPETA_TEMPORAL = 'tests/.tmp/kardex';

process.env.RECONOCIMIENTOS_PDF_DIR = `${CARPETA_TEMPORAL}/reconocimientos_pdf`;
process.env.MEMORANDUMS_PDF_DIR = `${CARPETA_TEMPORAL}/memorandums_pdf`;
process.env.EVIDENCIA_DIR = `${CARPETA_TEMPORAL}/evidencia`;

jest.mock('../db/pool', () => require('./helpers/poolFalso').crearPoolFalso());

const request = require('supertest');
const pool = require('../db/pool');
const app = require('../index');

const ID_RECEPTOR = 'e0000000-0000-4000-8000-000000000001';
const ID_EMISOR = 'e0000000-0000-4000-8000-000000000002';
const ID_OTRO_EMPLEADO = 'e0000000-0000-4000-8000-000000000003';
const ID_INEXISTENTE = 'e0000000-0000-4000-8000-00000000dead';
const TIPO_DISCIPLINARIO = 1;
const TIPO_RECONOCIMIENTO = 2;

const CONSULTA_KARDEX = /WHERE m\.id_empleado_receptor = \$1 AND m\.estado_sancion <> 'ANULADO' ORDER BY m\.fecha_emision DESC, m\.numero_correlativo DESC/i;
const CONSULTA_ALERTA = /COUNT\(\*\)::int AS total FROM memorandums .*AND naturaleza_falta IS NOT NULL/i;

const kardex = (idEmpleado = ID_RECEPTOR) => request(app).get(`/empleados/${idEmpleado}/memorandums`);

const emitirReconocimiento = (cambios = {}) =>
  request(app)
    .post('/reconocimientos')
    .send({
      id_empleado_receptor: ID_RECEPTOR,
      id_empleado_emisor: ID_EMISOR,
      id_tipo_memo: TIPO_RECONOCIMIENTO,
      asunto: 'Puntualidad ejemplar durante el tercer trimestre',
      contenido_descripcion: 'Registró asistencia perfecta y ningún retraso.',
      ...cambios,
    });

const emitirLlamadaDeAtencion = (cambios = {}) => {
  const campos = {
    id_empleado_receptor: ID_RECEPTOR,
    id_empleado_emisor: ID_EMISOR,
    id_tipo_memo: TIPO_DISCIPLINARIO,
    asunto: 'Incumplimiento del horario de ingreso',
    contenido_descripcion: 'Ingresó con retraso sin justificación.',
    naturaleza_falta: 'CONDUCTA',
    gravedad_falta: 'MODERADA',
    ...cambios,
  };
  const peticion = request(app).post('/memorandums');
  Object.entries(campos).forEach(([campo, valor]) => peticion.field(campo, String(valor)));
  return peticion;
};

let secuencia = 0;
const registrado = (cambios = {}) => {
  secuencia += 1;
  return {
    id_memorandum: `00000000-0000-4000-8000-${String(secuencia).padStart(12, '0')}`,
    id_empleado_receptor: ID_RECEPTOR,
    id_empleado_emisor: ID_EMISOR,
    id_tipo_memo: TIPO_DISCIPLINARIO,
    codigo_cite: `MEM-2026-${String(secuencia).padStart(4, '0')}`,
    asunto: 'Asunto registrado',
    fecha_emision: '2026-09-01',
    gestion: 2026,
    numero_correlativo: secuencia,
    naturaleza_falta: 'CONDUCTA',
    gravedad_falta: 'LEVE',
    estado_sancion: 'BORRADOR',
    documento_pdf_url: null,
    ...cambios,
  };
};

const reconocimientoRegistrado = (cambios = {}) =>
  registrado({
    id_tipo_memo: TIPO_RECONOCIMIENTO,
    naturaleza_falta: null,
    gravedad_falta: null,
    estado_sancion: 'EMITIDO',
    ...cambios,
  });

const limpiarTemporales = () => fs.rmSync(CARPETA_TEMPORAL, { recursive: true, force: true });

beforeEach(() => {
  limpiarTemporales();
  secuencia = 0;
  pool.reiniciar();
});

afterAll(limpiarTemporales);

describe('GET /empleados/:id/memorandums (KAN-277)', () => {
  describe('visualización del reconocimiento en el Kardex', () => {
    test('un reconocimiento recién emitido aparece de inmediato en el Kardex del empleado', async () => {
      const emitido = await emitirReconocimiento();

      const { status, body } = await kardex();

      expect(status).toBe(200);
      expect(body).toEqual([
        {
          id_memorandum: emitido.body.id_memorandum,
          codigo_cite: 'REC-2026-0001',
          asunto: 'Puntualidad ejemplar durante el tercer trimestre',
          fecha_emision: '2026-10-10',
          gravedad_falta: null,
          documento_pdf_url: emitido.body.documento_pdf_url,
          tipo_nombre: 'Felicitación por puntualidad',
          es_reconocimiento: true,
        },
      ]);
    });

    test('la ruta del documento que muestra el Kardex corresponde a un PDF que existe', async () => {
      await emitirReconocimiento();

      const { body } = await kardex();
      const pdf = fs.readFileSync(path.join(process.cwd(), body[0].documento_pdf_url));

      expect(body[0].documento_pdf_url).toBe(`/${CARPETA_TEMPORAL}/reconocimientos_pdf/REC-2026-0001.pdf`);
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    });

    test('distingue los reconocimientos de las llamadas de atención', async () => {
      await emitirLlamadaDeAtencion({ gravedad_falta: 'GRAVE' });
      await emitirReconocimiento();

      const { body } = await kardex();

      expect(body.map(({ codigo_cite, es_reconocimiento, gravedad_falta, tipo_nombre }) => ({ codigo_cite, es_reconocimiento, gravedad_falta, tipo_nombre }))).toEqual([
        { codigo_cite: 'REC-2026-0002', es_reconocimiento: true, gravedad_falta: null, tipo_nombre: 'Felicitación por puntualidad' },
        { codigo_cite: 'MEM-2026-0001', es_reconocimiento: false, gravedad_falta: 'GRAVE', tipo_nombre: 'Llamada de atención' },
      ]);
    });

    test('ordena del más reciente al más antiguo y, en la misma fecha, por correlativo', async () => {
      pool.reiniciar({
        memorandums: [
          registrado({ codigo_cite: 'MEM-2026-0001', fecha_emision: '2026-03-10' }),
          reconocimientoRegistrado({ codigo_cite: 'REC-2026-0002', fecha_emision: '2026-08-20' }),
          registrado({ codigo_cite: 'MEM-2026-0003', fecha_emision: '2026-08-20' }),
          reconocimientoRegistrado({ codigo_cite: 'REC-2026-0004', fecha_emision: '2026-05-05' }),
        ],
      });

      const { body } = await kardex();

      expect(body.map((memo) => memo.codigo_cite)).toEqual(['MEM-2026-0003', 'REC-2026-0002', 'REC-2026-0004', 'MEM-2026-0001']);
      expect(pool.huboConsulta(CONSULTA_KARDEX)).toBe(true);
    });

    test('solo trae los memorándums del empleado consultado', async () => {
      await emitirReconocimiento({ id_empleado_receptor: ID_OTRO_EMPLEADO });
      await emitirReconocimiento();

      const propio = await kardex(ID_RECEPTOR);
      const ajeno = await kardex(ID_OTRO_EMPLEADO);
      const emisor = await kardex(ID_EMISOR);

      expect(propio.body.map((memo) => memo.codigo_cite)).toEqual(['REC-2026-0002']);
      expect(ajeno.body.map((memo) => memo.codigo_cite)).toEqual(['REC-2026-0001']);
      expect(emisor.body).toEqual([]);
    });

    test('no muestra los memorándums anulados', async () => {
      pool.reiniciar({
        memorandums: [reconocimientoRegistrado({ codigo_cite: 'REC-2026-0001' }), reconocimientoRegistrado({ codigo_cite: 'REC-2026-0002', estado_sancion: 'ANULADO' })],
      });

      const { body } = await kardex();

      expect(body.map((memo) => memo.codigo_cite)).toEqual(['REC-2026-0001']);
    });

    test('no expone el texto completo del memorándum en el listado', async () => {
      await emitirReconocimiento();

      const { body } = await kardex();

      expect(Object.keys(body[0]).sort()).toEqual(
        ['asunto', 'codigo_cite', 'documento_pdf_url', 'es_reconocimiento', 'fecha_emision', 'gravedad_falta', 'id_memorandum', 'tipo_nombre'].sort()
      );
    });

    test('un empleado sin memorándums devuelve una lista vacía', async () => {
      const { status, body } = await kardex();

      expect(status).toBe(200);
      expect(body).toEqual([]);
    });

    test('responde 404 si el empleado no existe', async () => {
      const { status, body } = await kardex(ID_INEXISTENTE);

      expect(status).toBe(404);
      expect(body).toEqual({ error: 'El empleado solicitado no existe.' });
    });

    test('responde 400 si el identificador no es un UUID', async () => {
      const { status, body } = await kardex('abc');

      expect(status).toBe(400);
      expect(body.errores).toEqual([{ campo: 'id', mensaje: "El campo 'id' debe ser un UUID válido." }]);
    });

    test('un reconocimiento que no llegó a guardarse no aparece en el Kardex', async () => {
      const fallido = await emitirReconocimiento({ id_tipo_memo: TIPO_DISCIPLINARIO });

      const { body } = await kardex();

      expect(fallido.status).toBe(400);
      expect(body).toEqual([]);
    });
  });

  describe('el reconocimiento como antecedente favorable', () => {
    test('los reconocimientos no cuentan para la alerta roja por acumulación de faltas', async () => {
      for (let i = 0; i < 4; i += 1) await emitirReconocimiento();

      const { status, body } = await emitirLlamadaDeAtencion();

      expect(status).toBe(201);
      expect(body.alerta_roja).toBe(false);
      expect(pool.huboConsulta(CONSULTA_ALERTA)).toBe(true);
    });

    test('tampoco descuentan las llamadas de atención ya acumuladas', async () => {
      pool.reiniciar({
        ultimoNumero: 5,
        memorandums: [registrado(), registrado(), registrado(), reconocimientoRegistrado(), reconocimientoRegistrado()],
      });

      const { body } = await emitirLlamadaDeAtencion();

      expect(body.alerta_roja).toBe(true);
    });

    test('el Kardex permite contar por separado méritos y llamadas de atención', async () => {
      await emitirReconocimiento();
      await emitirLlamadaDeAtencion();
      await emitirReconocimiento({ asunto: 'Rendimiento operativo sobresaliente' });

      const { body } = await kardex();

      expect(body.filter((memo) => memo.es_reconocimiento)).toHaveLength(2);
      expect(body.filter((memo) => !memo.es_reconocimiento)).toHaveLength(1);
    });
  });
});
