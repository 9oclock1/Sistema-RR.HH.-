const { esVacio, invalido, cuerpoComoObjeto, normalizarTexto, normalizarUuid, lanzarSiHayErrores } = require('./comunes');
const { normalizarOpcion, normalizarEntero, normalizarFecha } = require('./capacitacionesValidator');

const ESTADOS_SOLICITUD = ['PENDIENTE_ENVIO', 'ENVIADA', 'EN_PROCESO', 'ORDEN_EMITIDA', 'RECHAZADA', 'CANCELADA'];
const ESTADOS_RESPUESTA_COMPRAS = ['EN_PROCESO', 'ORDEN_EMITIDA', 'RECHAZADA'];
const MONTO_REGEX = /^\d{1,10}(\.\d{1,2})?$/;

const normalizarMonto = (valor, campo, errores) => {
  if (esVacio(valor)) return null;
  const texto = typeof valor === 'number' && Number.isFinite(valor) ? String(valor) : valor;
  if (typeof texto !== 'string' || !MONTO_REGEX.test(texto.trim())) {
    errores.push(invalido(campo, `El campo '${campo}' debe ser un monto positivo con hasta 2 decimales.`));
    return null;
  }
  return texto.trim();
};

const validarSolicitudCompra = (body) => {
  const datos = cuerpoComoObjeto(body);
  const errores = [];

  const solicitud = {
    id_empleado_solicitante: normalizarUuid(datos.id_empleado_solicitante, 'id_empleado_solicitante', { requerido: true }, errores),
    descripcion_requerimiento: normalizarTexto(datos.descripcion_requerimiento, 'descripcion_requerimiento', { requerido: true }, errores),
    cantidad_participantes: normalizarEntero(datos.cantidad_participantes, 'cantidad_participantes', { requerido: true }, errores),
    fecha_requerida: normalizarFecha(datos.fecha_requerida, 'fecha_requerida', {}, errores),
    monto_estimado: normalizarMonto(datos.monto_estimado, 'monto_estimado', errores),
  };

  lanzarSiHayErrores(errores);
  return solicitud;
};

const validarRespuestaCompras = (body) => {
  const datos = cuerpoComoObjeto(body);
  const errores = [];

  const respuesta = {
    id_mensaje_externo: normalizarTexto(datos.id_mensaje_externo, 'id_mensaje_externo', { requerido: true, maxLength: 64 }, errores),
    estado: normalizarOpcion(datos.estado, 'estado', ESTADOS_RESPUESTA_COMPRAS, { requerido: true }, errores),
    numero_orden_servicio: normalizarTexto(datos.numero_orden_servicio, 'numero_orden_servicio', { maxLength: 40 }, errores),
    proveedor_nombre: normalizarTexto(datos.proveedor_nombre, 'proveedor_nombre', { maxLength: 150 }, errores),
    proveedor_nit: normalizarTexto(datos.proveedor_nit, 'proveedor_nit', { maxLength: 20 }, errores),
    monto_adjudicado: normalizarMonto(datos.monto_adjudicado, 'monto_adjudicado', errores),
    detalle: normalizarTexto(datos.detalle, 'detalle', {}, errores),
  };

  if (respuesta.estado === 'ORDEN_EMITIDA') {
    if (!respuesta.numero_orden_servicio) {
      errores.push(invalido('numero_orden_servicio', 'Una orden emitida debe indicar el número de orden de servicio.'));
    }
    if (!respuesta.proveedor_nombre) {
      errores.push(invalido('proveedor_nombre', 'Una orden emitida debe indicar el proveedor.'));
    }
  }

  lanzarSiHayErrores(errores);
  return respuesta;
};

const validarFiltrosSolicitudes = (query) => {
  const datos = cuerpoComoObjeto(query);
  const errores = [];

  const filtros = {
    id_curso: normalizarUuid(datos.id_curso, 'id_curso', {}, errores),
    estado: normalizarOpcion(datos.estado, 'estado', ESTADOS_SOLICITUD, {}, errores),
  };

  lanzarSiHayErrores(errores);
  return filtros;
};

module.exports = { validarSolicitudCompra, validarRespuestaCompras, validarFiltrosSolicitudes };
