const fs = require('node:fs');
const path = require('node:path');

const CARPETA_TEMPORAL = 'tests/.tmp/memorandums';
const CARPETA_PDF = `${CARPETA_TEMPORAL}/memorandums_pdf`;
const CARPETA_EVIDENCIA = `${CARPETA_TEMPORAL}/evidencia`;

process.env.MEMORANDUMS_PDF_DIR = CARPETA_PDF;
process.env.EVIDENCIA_DIR = CARPETA_EVIDENCIA;
process.env.INSTITUCION_NOMBRE = 'Supermercados Ejemplo S.A.';

jest.mock('../db/pool', () => require('./helpers/poolFalso').crearPoolFalso());

const request = require('supertest');
const pool = require('../db/pool');
const app = require('../index');
const pdfGeneratorService = require('../src/services/pdfGeneratorService');
const { textoDelPdf, paginasDelPdf } = require('./helpers/textoPdf');

const ID_RECEPTOR = 'e0000000-0000-4000-8000-000000000001';
const ID_EMISOR = 'e0000000-0000-4000-8000-000000000002';
const ID_OTRO_EMPLEADO = 'e0000000-0000-4000-8000-000000000003';
const ID_INEXISTENTE = 'e0000000-0000-4000-8000-00000000dead';
const TIPO_DISCIPLINARIO = 1;

const CONTADOR = /INSERT INTO correlativos_memorandum/i;
const INSERT_MEMORANDUM = /INSERT INTO memorandums/i;
const UPDATE_PDF = /UPDATE memorandums SET documento_pdf_url/i;

const memorandumValido = (cambios = {}) => ({
  id_empleado_receptor: ID_RECEPTOR,
  id_empleado_emisor: ID_EMISOR,
  id_tipo_memo: TIPO_DISCIPLINARIO,
  asunto: 'Incumplimiento reiterado del horario de ingreso',
  contenido_descripcion: 'Ingresó con retraso los días 5, 6 y 8 de octubre sin presentar justificación.',
  naturaleza_falta: 'CONDUCTA',
  gravedad_falta: 'MODERADA',
  ...cambios,
});

const EVIDENCIA_PDF = { contenido: Buffer.from('%PDF-1.4 evidencia'), filename: 'foto del turno.pdf', contentType: 'application/pdf' };

const crear = (campos = memorandumValido(), evidencia) => {
  const peticion = request(app).post('/memorandums');
  Object.entries(campos).forEach(([campo, valor]) => peticion.field(campo, String(valor)));
  if (evidencia) {
    peticion.attach('evidencia', evidencia.contenido, { filename: evidencia.filename, contentType: evidencia.contentType });
  }
  return peticion;
};

const crearVarios = async (cantidad, campos) => {
  const respuestas = [];
  for (let i = 0; i < cantidad; i += 1) respuestas.push(await crear(campos));
  return respuestas;
};

const enDisco = (ruta) => path.join(process.cwd(), ruta);
const archivosEn = (carpeta) => (fs.existsSync(carpeta) ? fs.readdirSync(carpeta) : []);
const leerPdf = (respuesta) => fs.readFileSync(enDisco(respuesta.body.memorandum.documento_pdf_url));
const sinEspacios = (texto) => texto.replace(/\s+/g, '');
const limpiarTemporales = () => fs.rmSync(CARPETA_TEMPORAL, { recursive: true, force: true });

const amonestacionPrevia = (cambios = {}) => ({
  id_empleado_receptor: ID_RECEPTOR,
  estado_sancion: 'EMITIDO',
  naturaleza_falta: 'CONDUCTA',
  fecha_emision: '2026-09-01',
  ...cambios,
});

beforeEach(() => {
  limpiarTemporales();
  pool.reiniciar();
});

afterEach(() => jest.restoreAllMocks());

afterAll(limpiarTemporales);

describe('POST /memorandums (KAN-272)', () => {
  describe('generación del documento oficial', () => {
    test('responde 201 y genera un PDF válido con el nombre del CITE', async () => {
      const respuesta = await crear();

      expect(respuesta.status).toBe(201);
      expect(respuesta.body.memorandum.documento_pdf_url).toBe(`/${CARPETA_PDF}/MEM-2026-0001.pdf`);

      const pdf = leerPdf(respuesta);
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
      expect(pdf.toString('latin1').trimEnd().endsWith('%%EOF')).toBe(true);
      expect(paginasDelPdf(pdf)).toBe(1);
    });

    test('el documento lleva el membrete institucional y el CITE', async () => {
      const texto = textoDelPdf(leerPdf(await crear()));

      expect(texto).toContain('Supermercados Ejemplo S.A.');
      expect(texto).toContain('Gerencia de Recursos Humanos');
      expect(texto).toContain('MEMORÁNDUM');
      expect(texto).toContain('LLAMADA DE ATENCIÓN');
      expect(texto).toContain('CITE: MEM-2026-0001');
      expect(texto).toContain('Página 1 de 1');
    });

    test('el documento identifica al empleado amonestado, al emisor y la fecha', async () => {
      const texto = textoDelPdf(leerPdf(await crear()));

      expect(texto).toContain('José Ángel Peñaranda Núñez');
      expect(texto).toContain('Cajero de sucursal · Sucursal Sopocachi · C.I. 7894561-1A');
      expect(texto).toContain('María Fernanda Quispe');
      expect(texto).toContain('Supervisor de sucursal');
      expect(texto).toContain('La Paz, 10 de octubre de 2026');
    });

    test('el documento detalla el asunto, la falta y la descripción', async () => {
      const texto = textoDelPdf(leerPdf(await crear(memorandumValido({ naturaleza_falta: 'OPERATIVA', gravedad_falta: 'GRAVE' }))));

      expect(texto).toContain('Incumplimiento reiterado del horario de ingreso');
      expect(texto).toContain('NATURALEZA DE LA FALTA\nOperativa');
      expect(texto).toContain('GRAVEDAD\nGrave');
      expect(sinEspacios(texto)).toContain(sinEspacios('Ingresó con retraso los días 5, 6 y 8 de octubre sin presentar justificación.'));
    });

    test('el documento queda listo para firma, con el bloque de emisión y el de recepción', async () => {
      const texto = textoDelPdf(leerPdf(await crear()));

      expect(texto).toContain('Emitido por');
      expect(texto).toContain('Recibí conforme');
      expect(texto).toContain('C.I. 7894561-1A');
      expect(sinEspacios(texto)).toContain(sinEspacios('queda registrada en su expediente personal (Kardex)'));
    });

    test('menciona la evidencia solo cuando se adjuntó', async () => {
      const sinEvidencia = textoDelPdf(leerPdf(await crear()));
      const conEvidencia = textoDelPdf(leerPdf(await crear(memorandumValido(), EVIDENCIA_PDF)));

      expect(sinEvidencia).not.toContain('Adj.:');
      expect(conEvidencia).toContain('Adj.: evidencia de respaldo registrada en el sistema.');
    });

    test('una descripción larga ocupa varias páginas y todas llevan membrete y numeración', async () => {
      const parrafo = 'Ingresó con retraso y no presentó justificación alguna a su supervisor inmediato.';
      const respuesta = await crear(memorandumValido({ contenido_descripcion: Array(60).fill(parrafo).join('\n\n') }));

      const pdf = leerPdf(respuesta);
      const texto = textoDelPdf(pdf);
      const paginas = paginasDelPdf(pdf);

      expect(paginas).toBeGreaterThan(1);
      expect(texto.match(/Supermercados Ejemplo S\.A\./g)).toHaveLength(paginas);
      expect(texto).toContain(`Página 1 de ${paginas}`);
      expect(texto).toContain(`Página ${paginas} de ${paginas}`);
    });

    test('los saltos de línea CRLF del formulario no dejan símbolos extraños en el documento', async () => {
      const respuesta = await crear(memorandumValido({ contenido_descripcion: 'Primer hecho.\r\n\r\nSegundo hecho.' }));

      const lineas = textoDelPdf(leerPdf(respuesta)).split('\n');

      expect(lineas).toContain('Primer hecho.');
      expect(lineas).toContain('Segundo hecho.');
      expect(lineas).not.toContain('Ð');
    });

    test('guarda la ruta del PDF en el memorándum antes de confirmar la transacción', async () => {
      const respuesta = await crear();

      expect(pool.memorandums[0].documento_pdf_url).toBe(respuesta.body.memorandum.documento_pdf_url);
      expect(pool.posicionDe(INSERT_MEMORANDUM)).toBeLessThan(pool.posicionDe(UPDATE_PDF));
      expect(pool.posicionDe(UPDATE_PDF)).toBeLessThan(pool.consultas.indexOf('COMMIT'));
      expect(pool.consultas).not.toContain('ROLLBACK');
    });

    test('si falla la generación del PDF responde 500 y no queda ningún memorándum guardado', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(pdfGeneratorService, 'generarPdfMemorandum').mockRejectedValueOnce(new Error('disco lleno'));

      const respuesta = await crear(memorandumValido(), EVIDENCIA_PDF);

      expect(respuesta.status).toBe(500);
      expect(respuesta.body).toEqual({ error: 'Error interno del servidor.' });
      expect(pool.memorandums).toHaveLength(0);
      expect(pool.consultas.at(-1)).toBe('ROLLBACK');
      expect(archivosEn(CARPETA_EVIDENCIA)).toHaveLength(0);
    });

    test('si falla el guardado de la ruta, el PDF ya generado se elimina del disco', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const generar = jest.spyOn(pdfGeneratorService, 'generarPdfMemorandum');
      pool.reiniciar({ errorAlGuardarPdf: new Error('connection terminated unexpectedly') });

      const respuesta = await crear();

      expect(respuesta.status).toBe(500);
      expect(generar).toHaveBeenCalledTimes(1);
      expect(archivosEn(CARPETA_PDF)).toHaveLength(0);
      expect(pool.memorandums).toHaveLength(0);
    });
  });

  describe('numeración secuencial correlativa', () => {
    test('el primer memorándum de la gestión recibe MEM-2026-0001', async () => {
      const { body } = await crear();

      expect(body.memorandum).toMatchObject({ codigo_cite: 'MEM-2026-0001', gestion: 2026, numero_correlativo: 1 });
    });

    test('numera en secuencia y sin saltos los memorándums consecutivos', async () => {
      const respuestas = await crearVarios(3);

      expect(respuestas.map((r) => r.body.memorandum.codigo_cite)).toEqual(['MEM-2026-0001', 'MEM-2026-0002', 'MEM-2026-0003']);
      expect(respuestas.map((r) => r.body.memorandum.numero_correlativo)).toEqual([1, 2, 3]);
    });

    test('el correlativo es único para toda la institución: no depende del empleado ni del emisor', async () => {
      const primero = await crear(memorandumValido({ id_empleado_receptor: ID_OTRO_EMPLEADO }));
      const segundo = await crear(memorandumValido({ id_empleado_receptor: ID_RECEPTOR, id_empleado_emisor: ID_OTRO_EMPLEADO }));

      expect(primero.body.memorandum.codigo_cite).toBe('MEM-2026-0001');
      expect(segundo.body.memorandum.codigo_cite).toBe('MEM-2026-0002');
    });

    test('continúa desde el último número emitido en la gestión', async () => {
      pool.reiniciar({ ultimoNumero: 99 });

      const { body } = await crear();

      expect(body.memorandum.numero_correlativo).toBe(100);
      expect(body.memorandum.codigo_cite).toBe('MEM-2026-0100');
    });

    test('no trunca el correlativo al pasar de cuatro dígitos', async () => {
      pool.reiniciar({ ultimoNumero: 9999 });

      const { body } = await crear();

      expect(body.memorandum.codigo_cite).toBe('MEM-2026-10000');
    });

    test('reinicia la numeración al cambiar de gestión', async () => {
      pool.reiniciar({ hoy: '2027-01-02', contadores: { 2026: 57 } });

      const { body } = await crear();

      expect(body.memorandum).toMatchObject({ codigo_cite: 'MEM-2027-0001', gestion: 2027, numero_correlativo: 1, fecha_emision: '2027-01-02' });
    });

    test('un intento que falla al guardar no consume número', async () => {
      const fallido = await crear(memorandumValido({ id_empleado_receptor: ID_INEXISTENTE }));
      const siguiente = await crear();

      expect(fallido.status).toBe(400);
      expect(siguiente.body.memorandum.codigo_cite).toBe('MEM-2026-0001');
    });

    test('un fallo al generar el PDF tampoco consume número', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(pdfGeneratorService, 'generarPdfMemorandum').mockRejectedValueOnce(new Error('disco lleno'));

      const fallido = await crear();
      const siguiente = await crear();

      expect(fallido.status).toBe(500);
      expect(siguiente.body.memorandum.codigo_cite).toBe('MEM-2026-0001');
    });

    test('una solicitud inválida no llega a pedir correlativo', async () => {
      const respuesta = await crear(memorandumValido({ gravedad_falta: 'ENORME' }));

      expect(respuesta.status).toBe(400);
      expect(pool.huboConsulta(CONTADOR)).toBe(false);
      expect(pool.conexiones).toBe(0);
    });

    test('pide el correlativo y guarda el memorándum en la misma transacción', async () => {
      await crear();

      const inicio = pool.consultas.indexOf('BEGIN');
      const fin = pool.consultas.indexOf('COMMIT');

      expect(inicio).toBeLessThan(pool.posicionDe(CONTADOR));
      expect(pool.posicionDe(CONTADOR)).toBeLessThan(pool.posicionDe(INSERT_MEMORANDUM));
      expect(pool.posicionDe(INSERT_MEMORANDUM)).toBeLessThan(fin);
      expect(pool.conexiones).toBe(1);
      expect(pool.liberaciones).toBe(1);
    });
  });

  describe('vinculación al Kardex del empleado', () => {
    test('el memorándum queda asociado al empleado amonestado y a quien lo emite', async () => {
      const { body } = await crear();

      expect(body.memorandum).toMatchObject({
        id_empleado_receptor: ID_RECEPTOR,
        id_empleado_emisor: ID_EMISOR,
        id_tipo_memo: TIPO_DISCIPLINARIO,
        naturaleza_falta: 'CONDUCTA',
        gravedad_falta: 'MODERADA',
        estado_sancion: 'BORRADOR',
        fecha_emision: '2026-10-10',
      });
      expect(pool.memorandums).toHaveLength(1);
      expect(pool.memorandums[0].id_empleado_receptor).toBe(ID_RECEPTOR);
    });

    test('el documento se arma con los datos del empleado al que se vincula', async () => {
      const generar = jest.spyOn(pdfGeneratorService, 'generarPdfMemorandum');

      await crear(memorandumValido({ id_empleado_receptor: ID_OTRO_EMPLEADO }));

      expect(generar).toHaveBeenCalledWith(
        expect.objectContaining({
          codigo_cite: 'MEM-2026-0001',
          receptor_nombre: 'Luis Alberto Mamani Flores',
          receptor_documento: '6123450',
          receptor_cargo: 'Reponedor',
          receptor_sucursal: 'Sucursal Miraflores',
          emisor_nombre: 'María Fernanda Quispe',
        })
      );
    });

    test('rechaza con 400 un empleado amonestado que no existe y no deja memorándum ni PDF', async () => {
      const mensaje = `No existe un registro con id_empleado_receptor = ${ID_INEXISTENTE}.`;

      const respuesta = await crear(memorandumValido({ id_empleado_receptor: ID_INEXISTENTE }));

      expect(respuesta.status).toBe(400);
      expect(respuesta.body).toEqual({
        error: mensaje,
        campos_faltantes: [],
        errores: [{ campo: 'id_empleado_receptor', mensaje }],
      });
      expect(pool.memorandums).toHaveLength(0);
      expect(archivosEn(CARPETA_PDF)).toHaveLength(0);
    });

    test('rechaza con 400 un emisor que no existe', async () => {
      const respuesta = await crear(memorandumValido({ id_empleado_emisor: ID_INEXISTENTE }));

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.errores).toEqual([
        { campo: 'id_empleado_emisor', mensaje: `No existe un registro con id_empleado_emisor = ${ID_INEXISTENTE}.` },
      ]);
    });

    test('rechaza con 400 que el empleado se amoneste a sí mismo', async () => {
      const respuesta = await crear(memorandumValido({ id_empleado_emisor: ID_RECEPTOR }));

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error).toBe('El empleado amonestado no puede ser el mismo que emite el memorándum.');
    });

    test('la evidencia adjunta queda guardada y vinculada al memorándum', async () => {
      const { status, body } = await crear(memorandumValido(), EVIDENCIA_PDF);

      expect(status).toBe(201);
      expect(body.memorandum.evidencia_adjunto_url).toMatch(new RegExp(`^/${CARPETA_EVIDENCIA}/[0-9a-f-]{36}\\.pdf$`));
      expect(fs.readFileSync(enDisco(body.memorandum.evidencia_adjunto_url))).toEqual(EVIDENCIA_PDF.contenido);
    });

    test('sin evidencia el memorándum se registra igual', async () => {
      const { status, body } = await crear();

      expect(status).toBe(201);
      expect(body.memorandum.evidencia_adjunto_url).toBeNull();
    });

    test('descarta la evidencia si el memorándum no llega a guardarse', async () => {
      const respuesta = await crear(memorandumValido({ id_empleado_receptor: ID_INEXISTENTE }), EVIDENCIA_PDF);

      expect(respuesta.status).toBe(400);
      expect(archivosEn(CARPETA_EVIDENCIA)).toHaveLength(0);
    });

    test('rechaza con 400 una evidencia de formato no permitido', async () => {
      const ejecutable = { contenido: Buffer.from('MZ'), filename: 'virus.exe', contentType: 'application/x-msdownload' };

      const respuesta = await crear(memorandumValido(), ejecutable);

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error).toBe('Formato de evidencia no permitido. Solo se aceptan archivos PDF, JPG o PNG.');
      expect(pool.memorandums).toHaveLength(0);
    });
  });

  describe('alerta roja por acumulación en el expediente', () => {
    test('las tres primeras amonestaciones del empleado no disparan la alerta y la cuarta sí', async () => {
      const respuestas = await crearVarios(4);

      expect(respuestas.map((r) => r.body.alerta_roja)).toEqual([false, false, false, true]);
    });

    test('la alerta se calcula con el expediente previo del empleado', async () => {
      pool.reiniciar({ memorandums: [amonestacionPrevia(), amonestacionPrevia(), amonestacionPrevia()] });

      const { body } = await crear();

      expect(body.alerta_roja).toBe(true);
    });

    test('las amonestaciones de otros empleados no cuentan', async () => {
      await crearVarios(3, memorandumValido({ id_empleado_receptor: ID_OTRO_EMPLEADO }));

      const { body } = await crear();

      expect(body.alerta_roja).toBe(false);
    });

    test.each([
      ['anuladas', { estado_sancion: 'ANULADO' }],
      ['de hace más de seis meses', { fecha_emision: '2026-04-09' }],
    ])('no cuentan las %s', async (_caso, cambios) => {
      pool.reiniciar({ memorandums: [amonestacionPrevia(), amonestacionPrevia(), amonestacionPrevia(cambios)] });

      const { body } = await crear();

      expect(body.alerta_roja).toBe(false);
    });

    test('cuenta una amonestación emitida justo hace seis meses', async () => {
      pool.reiniciar({ memorandums: [amonestacionPrevia(), amonestacionPrevia(), amonestacionPrevia({ fecha_emision: '2026-04-10' })] });

      const { body } = await crear();

      expect(body.alerta_roja).toBe(true);
    });
  });

  describe('datos obligatorios de la amonestación', () => {
    test('rechaza con 400 un formulario vacío y enumera los campos que faltan', async () => {
      const respuesta = await crear({});

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.campos_faltantes).toEqual([
        'id_empleado_receptor',
        'id_empleado_emisor',
        'id_tipo_memo',
        'asunto',
        'contenido_descripcion',
        'naturaleza_falta',
        'gravedad_falta',
      ]);
    });

    test.each([
      ['gravedad_falta', 'ENORME', "El campo 'gravedad_falta' debe ser uno de: LEVE, MODERADA, GRAVE."],
      ['naturaleza_falta', 'PERSONAL', "El campo 'naturaleza_falta' debe ser uno de: OPERATIVA, CONDUCTA."],
    ])('rechaza con 400 un valor desconocido en %s', async (campo, valor, mensaje) => {
      const respuesta = await crear(memorandumValido({ [campo]: valor }));

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.errores).toEqual([{ campo, mensaje }]);
    });

    test.each(['leve', 'Moderada', 'GRAVE'])('acepta la gravedad «%s» sin importar mayúsculas', async (gravedad) => {
      const { status, body } = await crear(memorandumValido({ gravedad_falta: gravedad }));

      expect(status).toBe(201);
      expect(body.memorandum.gravedad_falta).toBe(gravedad.toUpperCase());
    });
  });
});
