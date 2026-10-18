const { parentPort } = require('node:worker_threads');
const { PGlite } = require('@electric-sql/pglite');

const TIPO_DATE = 1082;
const OPCIONES = { parsers: { [TIPO_DATE]: (valor) => valor } };

let bd = null;

const acciones = {
  preparar: async ({ esquema, semilla }) => {
    bd = new PGlite();
    await bd.exec("SET TimeZone = 'America/La_Paz'");
    await bd.exec(esquema);
    await bd.exec(semilla);
  },
  query: async ({ sql, params }) => (await bd.query(sql, params, OPCIONES)).rows,
  cerrar: async () => {
    await bd?.close();
  },
};

parentPort.on('message', async ({ id, accion, datos }) => {
  try {
    parentPort.postMessage({ id, resultado: await acciones[accion](datos) });
  } catch ({ message, code, detail }) {
    parentPort.postMessage({ id, error: { message, code, detail } });
  }
});
