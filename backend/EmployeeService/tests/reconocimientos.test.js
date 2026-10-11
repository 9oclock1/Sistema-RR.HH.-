const fs = require('node:fs');
const path = require('node:path');

const CARPETA_TEMPORAL = 'tests/.tmp/reconocimientos';
const CARPETA_PDF = `${CARPETA_TEMPORAL}/reconocimientos_pdf`;
const CARPETA_PDF_MEMORANDUMS = `${CARPETA_TEMPORAL}/memorandums_pdf`;

process.env.RECONOCIMIENTOS_PDF_DIR = CARPETA_PDF;
process.env.MEMORANDUMS_PDF_DIR = CARPETA_PDF_MEMORANDUMS;
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
const TIPO_DISCIPLINARIO = 1;
const TIPO_RECONOCIMIENTO = 2;

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
