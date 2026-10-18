const fs = require('node:fs');
const path = require('node:path');
const { Worker } = require('node:worker_threads');

const ESQUEMA = fs.readFileSync(path.join(__dirname, '../../db/init.sql'), 'utf8');

// PGlite corre en un hilo aparte: usa import() dinámicos que la VM de Jest no admite.
const crearBdEnMemoria = () => {
  let hilo = null;
  let siguienteId = 0;
  const pendientes = new Map();
  let consultas = [];
  let enCurso = 0;
  let maximoEnCurso = 0;

  const enviar = (accion, datos) =>
    new Promise((resolver, rechazar) => {
      siguienteId += 1;
      pendientes.set(siguienteId, { resolver, rechazar });
      hilo.postMessage({ id: siguienteId, accion, datos });
    });

  const alResponder = ({ id, resultado, error }) => {
    const { resolver, rechazar } = pendientes.get(id);
    pendientes.delete(id);
    if (error) rechazar(Object.assign(new Error(error.message), error));
    else resolver(resultado);
  };

  const alFallar = (error) => {
    pendientes.forEach(({ rechazar }) => rechazar(error));
    pendientes.clear();
  };

  const preparar = (semilla = '') => {
    hilo = new Worker(path.join(__dirname, 'bdEnMemoria.worker.js'));
    hilo.on('message', alResponder);
    hilo.on('error', alFallar);
    return enviar('preparar', { esquema: ESQUEMA, semilla });
  };

  const query = async (sql, params = []) => {
    consultas.push(sql.replace(/\s+/g, ' ').trim());
    enCurso += 1;
    maximoEnCurso = Math.max(maximoEnCurso, enCurso);
    try {
      return { rows: await enviar('query', { sql, params }) };
    } finally {
      enCurso -= 1;
    }
  };

  const cerrar = async () => {
    if (!hilo) return;
    await enviar('cerrar');
    await hilo.terminate();
    hilo = null;
  };

  const reiniciarRegistro = () => {
    consultas = [];
    maximoEnCurso = 0;
  };

  return {
    query,
    connect: async () => ({ query, release: () => {} }),
    on: () => {},
    preparar,
    cerrar,
    reiniciarRegistro,
    get consultas() {
      return consultas;
    },
    get maximoEnCurso() {
      return maximoEnCurso;
    },
  };
};

module.exports = { crearBdEnMemoria };
