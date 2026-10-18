const fs = require('node:fs');
const path = require('node:path');

const CARPETA_TEMPORAL = 'tests/.tmp/reconocimientos';
const CARPETA_PDF = `${CARPETA_TEMPORAL}/reconocimientos_pdf`;
const CARPETA_PDF_MEMORANDUMS = `${CARPETA_TEMPORAL}/memorandums_pdf`;

process.env.RECONOCIMIENTOS_PDF_DIR = CARPETA_PDF;
process.env.MEMORANDUMS_PDF_DIR = CARPETA_PDF_MEMORANDUMS;
process.env.EVIDENCIA_DIR = `${CARPETA_TEMPORAL}/evidencia`;
process.env.INSTITUCION_NOMBRE = 'Supermercados Ejemplo S.A.';

jest.mock('../db/pool', () => require('./helpers/poolFalso').crearPoolFalso());

const request = require('supertest');
const pool = require('../db/pool');
const app = require('../index');
const pdfGeneratorService = require('../src/services/pdfGeneratorService');
const pdfReconocimientosService = require('../src/services/pdfReconocimientosService');
const { textoDelPdf, paginasDelPdf } = require('./helpers/textoPdf');

const ID_RECEPTOR = 'e0000000-0000-4000-8000-000000000001';
const ID_EMISOR = 'e0000000-0000-4000-8000-000000000002';
const ID_INEXISTENTE = 'e0000000-0000-4000-8000-00000000dead';
const TIPO_DISCIPLINARIO = 1;
const TIPO_RECONOCIMIENTO = 2;

const CONTADOR = /INSERT INTO correlativos_memorandum/i;
const TIPO_MEMO = /FROM tipos_memorandum WHERE id_tipo_memo/i;
const INSERT_MEMORANDUM = /INSERT INTO memorandums/i;
const UPDATE_PDF = /UPDATE memorandums SET documento_pdf_url/i;

const reconocimientoValido = (cambios = {}) => ({
  id_empleado_receptor: ID_RECEPTOR,
  id_empleado_emisor: ID_EMISOR,
  id_tipo_memo: TIPO_RECONOCIMIENTO,
  asunto: 'Puntualidad ejemplar durante el tercer trimestre',
  contenido_descripcion: 'Registró asistencia perfecta y ningún retraso durante el tercer trimestre de la gestión.',
  ...cambios,
});

const crear = (cuerpo = reconocimientoValido()) => request(app).post('/reconocimientos').send(cuerpo);

const crearLlamadaDeAtencion = () => {
  const campos = {
    id_empleado_receptor: ID_RECEPTOR,
    id_empleado_emisor: ID_EMISOR,
    id_tipo_memo: TIPO_DISCIPLINARIO,
    asunto: 'Incumplimiento del horario de ingreso',
    contenido_descripcion: 'Ingresó con retraso sin justificación.',
    naturaleza_falta: 'CONDUCTA',
    gravedad_falta: 'MODERADA',
  };
  const peticion = request(app).post('/memorandums');
  Object.entries(campos).forEach(([campo, valor]) => peticion.field(campo, String(valor)));
  return peticion;
};

const enDisco = (ruta) => path.join(process.cwd(), ruta);
const archivosEn = (carpeta) => (fs.existsSync(carpeta) ? fs.readdirSync(carpeta) : []);
const leerPdf = (respuesta) => fs.readFileSync(enDisco(respuesta.body.documento_pdf_url));
const sinEspacios = (texto) => texto.replace(/\s+/g, '');
const limpiarTemporales = () => fs.rmSync(CARPETA_TEMPORAL, { recursive: true, force: true });

beforeEach(() => {
  limpiarTemporales();
  pool.reiniciar();
});

afterEach(() => jest.restoreAllMocks());

afterAll(limpiarTemporales);

describe('POST /reconocimientos (KAN-274)', () => {
  describe('generación del documento de reconocimiento', () => {
    test('responde 201 con la ruta del PDF y genera un documento válido con el nombre del CITE', async () => {
      const respuesta = await crear();

      expect(respuesta.status).toBe(201);
      expect(respuesta.body).toMatchObject({
        codigo_cite: 'REC-2026-0001',
        estado_sancion: 'EMITIDO',
        naturaleza_falta: null,
        gravedad_falta: null,
        documento_pdf_url: `/${CARPETA_PDF}/REC-2026-0001.pdf`,
      });

      const pdf = leerPdf(respuesta);
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
      expect(pdf.toString('latin1').trimEnd().endsWith('%%EOF')).toBe(true);
      expect(paginasDelPdf(pdf)).toBe(1);
    });

    test('crea la carpeta de salida si todavía no existe', async () => {
      expect(fs.existsSync(CARPETA_PDF)).toBe(false);

      await crear();

      expect(archivosEn(CARPETA_PDF)).toEqual(['REC-2026-0001.pdf']);
    });

    test('el documento lleva el membrete y el formato institucional de reconocimiento', async () => {
      const texto = textoDelPdf(leerPdf(await crear()));

      expect(texto).toContain('Supermercados Ejemplo S.A.');
      expect(texto).toContain('Gerencia de Recursos Humanos');
      expect(texto).toContain('RECONOCIMIENTO INSTITUCIONAL');
      expect(texto).toContain('MEMORÁNDUM DE FELICITACIÓN');
      expect(texto).toContain('DESEMPEÑO DESTACADO');
      expect(texto).toContain('CITE: REC-2026-0001');
      expect(texto).toContain('¡Felicitaciones!');
      expect(texto).toContain('Página 1 de 1');
    });

    test('no usa la redacción ni los bloques del memorándum disciplinario', async () => {
      const texto = textoDelPdf(leerPdf(await crear()));

      expect(texto).not.toMatch(/llamada de atenci/i);
      expect(texto).not.toMatch(/amonest/i);
      expect(texto).not.toMatch(/sanci/i);
      expect(texto).not.toMatch(/falta/i);
      expect(texto).not.toContain('GRAVEDAD');
      expect(texto).not.toContain('Recibí conforme');
    });

    test('el documento identifica al empleado reconocido, a quien lo otorga y la fecha', async () => {
      const texto = textoDelPdf(leerPdf(await crear()));

      expect(texto).toContain('SE OTORGA A\nJosé Ángel Peñaranda Núñez');
      expect(texto).toContain('Cajero de sucursal · Sucursal Sopocachi · C.I. 7894561-1A');
      expect(texto).toContain('La Paz, 10 de octubre de 2026');
      expect(texto).toContain('María Fernanda Quispe\nSupervisor de sucursal\nOtorgado por');
    });

    test('el documento detalla el motivo, el tipo de reconocimiento y el texto redactado', async () => {
      const texto = textoDelPdf(leerPdf(await crear()));

      expect(texto).toContain('MOTIVO DEL RECONOCIMIENTO\nPuntualidad ejemplar durante el tercer trimestre\nFelicitación por puntualidad');
      expect(sinEspacios(texto)).toContain(sinEspacios('Registró asistencia perfecta y ningún retraso durante el tercer trimestre de la gestión.'));
      expect(sinEspacios(texto)).toContain(sinEspacios('como antecedente favorable para futuras evaluaciones de desempeño y promociones'));
    });

    test('imprime bien las tildes y la ñ aunque lleguen como caracteres combinantes', async () => {
      const asunto = 'Atención al cliente y desempeño sobresaliente';
      const descompuesto = asunto.normalize('NFD');
      expect(descompuesto).not.toBe(asunto);

      const texto = textoDelPdf(leerPdf(await crear(reconocimientoValido({ asunto: descompuesto }))));

      expect(texto).toContain(asunto);
    });

    test('los saltos de línea CRLF no dejan símbolos extraños en el documento', async () => {
      const respuesta = await crear(reconocimientoValido({ contenido_descripcion: 'Primer mérito.\r\n\r\nSegundo mérito.' }));

      const lineas = textoDelPdf(leerPdf(respuesta)).split('\n');

      expect(lineas).toContain('Primer mérito.');
      expect(lineas).toContain('Segundo mérito.');
      expect(lineas).not.toContain('Ð');
    });

    test('un texto largo ocupa varias páginas, todas con membrete y numeración, y cierra con la firma', async () => {
      const parrafo = 'Mantuvo un desempeño sobresaliente y un trato cordial con clientes y compañeros.';
      const respuesta = await crear(reconocimientoValido({ contenido_descripcion: Array(60).fill(parrafo).join('\n\n') }));

      const pdf = leerPdf(respuesta);
      const texto = textoDelPdf(pdf);
      const paginas = paginasDelPdf(pdf);

      expect(paginas).toBeGreaterThan(1);
      expect(texto.match(/Supermercados Ejemplo S\.A\./g)).toHaveLength(paginas);
      expect(texto).toContain(`Página ${paginas} de ${paginas}`);
      expect(texto.match(/DESEMPEÑO DESTACADO/g)).toHaveLength(1);
      expect(texto.match(/Otorgado por/g)).toHaveLength(1);
    });

    test('usa la plantilla de reconocimiento y no la del memorándum disciplinario', async () => {
      const disciplinario = jest.spyOn(pdfGeneratorService, 'generarPdfMemorandum');
      const reconocimiento = jest.spyOn(pdfReconocimientosService, 'generarPdfReconocimiento');

      await crear();

      expect(disciplinario).not.toHaveBeenCalled();
      expect(reconocimiento).toHaveBeenCalledWith(
        expect.objectContaining({
          codigo_cite: 'REC-2026-0001',
          tipo_nombre: 'Felicitación por puntualidad',
          receptor_nombre: 'José Ángel Peñaranda Núñez',
          emisor_nombre: 'María Fernanda Quispe',
        })
      );
      expect(archivosEn(CARPETA_PDF_MEMORANDUMS)).toHaveLength(0);
    });
  });

  describe('registro de la ruta del documento', () => {
    test('guarda la ruta del PDF en el reconocimiento antes de confirmar la transacción', async () => {
      const respuesta = await crear();

      expect(pool.memorandums[0].documento_pdf_url).toBe(respuesta.body.documento_pdf_url);
      expect(pool.posicionDe(INSERT_MEMORANDUM)).toBeLessThan(pool.posicionDe(UPDATE_PDF));
      expect(pool.posicionDe(UPDATE_PDF)).toBeLessThan(pool.consultas.indexOf('COMMIT'));
      expect(pool.consultas).not.toContain('ROLLBACK');
    });

    test('si falla la generación del PDF responde 500, no guarda el reconocimiento ni consume correlativo', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(pdfReconocimientosService, 'generarPdfReconocimiento').mockRejectedValueOnce(new Error('disco lleno'));

      const fallido = await crear();
      const siguiente = await crear();

      expect(fallido.status).toBe(500);
      expect(fallido.body).toEqual({ error: 'Error interno del servidor.' });
      expect(siguiente.body.codigo_cite).toBe('REC-2026-0001');
      expect(pool.memorandums).toHaveLength(1);
    });

    test('si falla el guardado de la ruta, el PDF ya generado se elimina del disco', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const generar = jest.spyOn(pdfReconocimientosService, 'generarPdfReconocimiento');
      pool.reiniciar({ errorAlGuardarPdf: new Error('connection terminated unexpectedly') });

      const respuesta = await crear();

      expect(respuesta.status).toBe(500);
      expect(generar).toHaveBeenCalledTimes(1);
      expect(archivosEn(CARPETA_PDF)).toHaveLength(0);
      expect(pool.memorandums).toHaveLength(0);
    });

    test('un tipo de memorándum disciplinario se rechaza con 400 sin generar documento', async () => {
      const generar = jest.spyOn(pdfReconocimientosService, 'generarPdfReconocimiento');

      const respuesta = await crear(reconocimientoValido({ id_tipo_memo: TIPO_DISCIPLINARIO }));

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error).toBe("El tipo de memorándum 'Llamada de atención' no corresponde a un reconocimiento.");
      expect(generar).not.toHaveBeenCalled();
      expect(archivosEn(CARPETA_PDF)).toHaveLength(0);
    });
  });
});

describe('POST /reconocimientos (KAN-277)', () => {
  describe('registro del reconocimiento', () => {
    test('queda emitido, sin datos de falta y vinculado al empleado reconocido y a quien lo otorga', async () => {
      const { status, body } = await crear();

      expect(status).toBe(201);
      expect(body).toMatchObject({
        id_empleado_receptor: ID_RECEPTOR,
        id_empleado_emisor: ID_EMISOR,
        id_tipo_memo: TIPO_RECONOCIMIENTO,
        asunto: 'Puntualidad ejemplar durante el tercer trimestre',
        contenido_descripcion: 'Registró asistencia perfecta y ningún retraso durante el tercer trimestre de la gestión.',
        fecha_emision: '2026-10-10',
        gestion: 2026,
        numero_correlativo: 1,
        estado_sancion: 'EMITIDO',
        naturaleza_falta: null,
        gravedad_falta: null,
        evidencia_adjunto_url: null,
      });
      expect(body.id_memorandum).toMatch(/^[0-9a-f-]{36}$/);
      expect(pool.memorandums).toHaveLength(1);
      expect(pool.memorandums[0].id_empleado_receptor).toBe(ID_RECEPTOR);
    });

    test('acepta el tipo de memorándum enviado como texto', async () => {
      const { status, body } = await crear(reconocimientoValido({ id_tipo_memo: '2' }));

      expect(status).toBe(201);
      expect(body.id_tipo_memo).toBe(TIPO_RECONOCIMIENTO);
    });

    test('descarta los datos de falta aunque lleguen en la solicitud', async () => {
      const { status, body } = await crear(reconocimientoValido({ naturaleza_falta: 'CONDUCTA', gravedad_falta: 'GRAVE' }));

      expect(status).toBe(201);
      expect(body.naturaleza_falta).toBeNull();
      expect(body.gravedad_falta).toBeNull();
    });

    test('recorta los espacios sobrantes del asunto y del texto', async () => {
      const { body } = await crear(reconocimientoValido({ asunto: '  Puntualidad  ', contenido_descripcion: '\n Mérito destacado. \n' }));

      expect(body.asunto).toBe('Puntualidad');
      expect(body.contenido_descripcion).toBe('Mérito destacado.');
    });

    test('acepta un asunto de exactamente 150 caracteres', async () => {
      const { status, body } = await crear(reconocimientoValido({ asunto: 'a'.repeat(150) }));

      expect(status).toBe(201);
      expect(body.asunto).toHaveLength(150);
    });
  });

  describe('validación de los datos', () => {
    test('rechaza con 400 una solicitud vacía y enumera los campos que faltan', async () => {
      const respuesta = await crear({});

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error).toBe(
        'Faltan los campos obligatorios: id_empleado_receptor, id_empleado_emisor, id_tipo_memo, asunto, contenido_descripcion.'
      );
      expect(respuesta.body.campos_faltantes).toEqual([
        'id_empleado_receptor',
        'id_empleado_emisor',
        'id_tipo_memo',
        'asunto',
        'contenido_descripcion',
      ]);
    });

    test.each([
      ['id_empleado_receptor', 'abc', "El campo 'id_empleado_receptor' debe ser un UUID válido."],
      ['id_empleado_emisor', 12345, "El campo 'id_empleado_emisor' debe ser un UUID válido."],
      ['id_tipo_memo', 'dos', "El campo 'id_tipo_memo' debe ser un número entero positivo."],
      ['id_tipo_memo', 0, "El campo 'id_tipo_memo' debe ser un número entero positivo."],
      ['id_tipo_memo', 40000, "El campo 'id_tipo_memo' debe ser un número entero positivo."],
      ['asunto', 'a'.repeat(151), "El campo 'asunto' no puede superar los 150 caracteres."],
      ['asunto', 123, "El campo 'asunto' debe ser texto."],
      ['contenido_descripcion', ['texto'], "El campo 'contenido_descripcion' debe ser texto."],
    ])('rechaza con 400 un valor inválido en %s (%p)', async (campo, valor, mensaje) => {
      const respuesta = await crear(reconocimientoValido({ [campo]: valor }));

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.errores).toEqual([{ campo, mensaje }]);
      expect(pool.memorandums).toHaveLength(0);
    });

    test.each(['asunto', 'contenido_descripcion'])('rechaza con 400 un %s que solo tiene espacios', async (campo) => {
      const respuesta = await crear(reconocimientoValido({ [campo]: '   ' }));

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.campos_faltantes).toEqual([campo]);
    });

    test('rechaza con 400 que el empleado se reconozca a sí mismo', async () => {
      const respuesta = await crear(reconocimientoValido({ id_empleado_emisor: ID_RECEPTOR }));

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error).toBe('El empleado reconocido no puede ser el mismo que emite el reconocimiento.');
    });

    test('rechaza con 400 un tipo de memorándum que no existe', async () => {
      const mensaje = 'No existe un tipo de memorándum con id_tipo_memo = 99.';

      const respuesta = await crear(reconocimientoValido({ id_tipo_memo: 99 }));

      expect(respuesta.status).toBe(400);
      expect(respuesta.body).toEqual({ error: mensaje, campos_faltantes: [], errores: [{ campo: 'id_tipo_memo', mensaje }] });
    });

    test.each(['id_empleado_receptor', 'id_empleado_emisor'])('rechaza con 400 un %s que no existe y no deja registro ni PDF', async (campo) => {
      const mensaje = `No existe un registro con ${campo} = ${ID_INEXISTENTE}.`;

      const respuesta = await crear(reconocimientoValido({ [campo]: ID_INEXISTENTE }));

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.errores).toEqual([{ campo, mensaje }]);
      expect(pool.memorandums).toHaveLength(0);
      expect(archivosEn(CARPETA_PDF)).toHaveLength(0);
    });

    test('rechaza con 400 un cuerpo que no es JSON válido', async () => {
      const respuesta = await request(app).post('/reconocimientos').set('Content-Type', 'application/json').send('{"asunto":');

      expect(respuesta.status).toBe(400);
      expect(respuesta.body).toEqual({ error: 'El cuerpo de la petición no es un JSON válido.' });
    });

    test('una solicitud inválida no llega a la base de datos', async () => {
      const respuesta = await crear(reconocimientoValido({ asunto: '' }));

      expect(respuesta.status).toBe(400);
      expect(pool.conexiones).toBe(0);
      expect(pool.consultas).toHaveLength(0);
    });
  });

  describe('correlativo institucional', () => {
    test('numera en secuencia y sin saltos los reconocimientos consecutivos', async () => {
      const respuestas = [await crear(), await crear(), await crear()];

      expect(respuestas.map((r) => r.body.codigo_cite)).toEqual(['REC-2026-0001', 'REC-2026-0002', 'REC-2026-0003']);
      expect(respuestas.map((r) => r.body.numero_correlativo)).toEqual([1, 2, 3]);
    });

    test('comparte la numeración con las llamadas de atención sin repetir ningún número', async () => {
      const primera = await crearLlamadaDeAtencion();
      const reconocimiento = await crear();
      const segunda = await crearLlamadaDeAtencion();

      expect(primera.body.memorandum.codigo_cite).toBe('MEM-2026-0001');
      expect(reconocimiento.body.codigo_cite).toBe('REC-2026-0002');
      expect(segunda.body.memorandum.codigo_cite).toBe('MEM-2026-0003');
    });

    test('continúa desde el último número emitido en la gestión', async () => {
      pool.reiniciar({ ultimoNumero: 99 });

      const { body } = await crear();

      expect(body).toMatchObject({ codigo_cite: 'REC-2026-0100', numero_correlativo: 100 });
    });

    test('reinicia la numeración al cambiar de gestión', async () => {
      pool.reiniciar({ hoy: '2027-01-02', contadores: { 2026: 57 } });

      const { body } = await crear();

      expect(body).toMatchObject({ codigo_cite: 'REC-2027-0001', gestion: 2027, numero_correlativo: 1, fecha_emision: '2027-01-02' });
    });

    test('un intento que falla al guardar no consume número', async () => {
      const fallido = await crear(reconocimientoValido({ id_empleado_receptor: ID_INEXISTENTE }));
      const siguiente = await crear();

      expect(fallido.status).toBe(400);
      expect(siguiente.body.codigo_cite).toBe('REC-2026-0001');
    });

    test('un tipo que no es de reconocimiento se rechaza antes de pedir correlativo', async () => {
      const respuesta = await crear(reconocimientoValido({ id_tipo_memo: TIPO_DISCIPLINARIO }));

      expect(respuesta.status).toBe(400);
      expect(pool.huboConsulta(CONTADOR)).toBe(false);
      expect(pool.consultas.at(-1)).toBe('ROLLBACK');
    });

    test('valida el tipo, pide el correlativo y guarda el reconocimiento en una sola transacción', async () => {
      await crear();

      const posiciones = [
        pool.consultas.indexOf('BEGIN'),
        pool.posicionDe(TIPO_MEMO),
        pool.posicionDe(CONTADOR),
        pool.posicionDe(INSERT_MEMORANDUM),
        pool.posicionDe(UPDATE_PDF),
        pool.consultas.indexOf('COMMIT'),
      ];

      expect(posiciones).toEqual([...posiciones].sort((a, b) => a - b));
      expect(posiciones).not.toContain(-1);
      expect(pool.conexiones).toBe(1);
      expect(pool.liberaciones).toBe(1);
    });
  });
});
