const jwt = require('jsonwebtoken');
const HttpError = require('../utils/HttpError');

const COOKIE = 'rrhh_sesion';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESION_INVALIDA = 'Su sesión no es válida o venció. Inicie sesión otra vez.';

const sinSesion = (mensaje) => new HttpError(401, mensaje, { codigo: 'SIN_SESION' });

function leerToken(req) {
  const [tipo, valor] = (req.get('Authorization') ?? '').split(' ');
  if (tipo === 'Bearer' && valor) return valor;
  for (const parte of String(req.headers.cookie ?? '').split(';')) {
    const [clave, ...resto] = parte.trim().split('=');
    if (clave === COOKIE) return decodeURIComponent(resto.join('='));
  }
  return null;
}

const autenticar = (req, res, next) => {
  const secreto = process.env.JWT_SECRET;
  if (!secreto) throw new Error('Falta la variable de entorno JWT_SECRET');
  const token = leerToken(req);
  if (!token) throw sinSesion('Inicie sesión para continuar.');
  let datos;
  try {
    datos = jwt.verify(token, secreto, { algorithms: ['HS256'] });
  } catch {
    throw sinSesion(SESION_INVALIDA);
  }
  if (typeof datos.sub !== 'string' || !UUID_REGEX.test(datos.sub) || typeof datos.rol !== 'string') {
    throw sinSesion(SESION_INVALIDA);
  }
  req.identidad = { idEmpleado: datos.sub.toLowerCase(), rol: datos.rol.trim().toLowerCase() };
  next();
};

const exigirRolSesion = (...rolesPermitidos) => (req, res, next) => {
  if (!rolesPermitidos.includes(req.identidad?.rol)) {
    throw new HttpError(403, 'Su rol no tiene permiso para consultar este recurso.');
  }
  next();
};

module.exports = { autenticar, exigirRolSesion, ROLES_RRHH: ['admin', 'gerente'] };
