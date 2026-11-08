const modelo = require("../models/historialQuejaModel");
const casosModelo = require("../models/casosQuejaModel");
const seguimientoModelo = require("../models/seguimientoQuejaModel");
const quejasModelo = require("../models/quejasModel");
const { ErrorApp } = require("../utils/errores");
const { descifrarTexto } = require("../utils/cifrado");
const { normalizarUuid, nombreCompleto } = require("../utils/casosQueja");
const { leerFiltrosHistorial, duracionDias, armarCsv, sufijoArchivo } = require("../utils/historialQueja");

const NO_ENCONTRADA = "No se encontró una queja cerrada con ese identificador.";

const empleado = (id, nombres, apellidos) => (id ? { id_empleado: id, nombre_completo: nombreCompleto(nombres, apellidos) } : null);

function resumenDe(fila) {
  return {
    id_queja: fila.id_queja,
    codigo_seguimiento: fila.codigo_seguimiento,
    es_anonima: fila.es_anonima,
    categoria: { id: fila.id_categoria_queja, codigo: fila.categoria_codigo, nombre: fila.categoria_nombre },
    prioridad: fila.id_prioridad_queja
      ? { id: fila.id_prioridad_queja, codigo: fila.prioridad_codigo, nombre: fila.prioridad_nombre }
      : null,
    estado: { id: fila.id_estado_queja, codigo: fila.estado_codigo, nombre: fila.estado_nombre, es_final: fila.es_final },
    sucursal: fila.id_sucursal ? { id_sucursal: fila.id_sucursal, nombre: fila.sucursal_nombre } : null,
    responsable: empleado(fila.id_empleado_responsable, fila.responsable_nombres, fila.responsable_apellidos),
    registrada_en: fila.creado_en,
    derivada_en: fila.derivada_en ?? null,
    cerrada_en: fila.cerrada_en,
    duracion_dias: duracionDias(fila.creado_en, fila.cerrada_en),
    total_acciones: fila.acciones,
  };
}

async function listarCatalogos() {
  const [categorias, sucursales] = await Promise.all([quejasModelo.listarCategorias(), modelo.listarSucursales()]);
  return { categorias, sucursales };
}

async function listar(consulta) {
  const filtros = leerFiltrosHistorial(consulta);
  const [filas, total] = await Promise.all([modelo.listarCerradas(filtros), modelo.contarCerradas(filtros)]);
  return { casos: filas.map(resumenDe), total, pagina: filtros.pagina, limite: filtros.limite };
}

async function exportar(consulta) {
  const filtros = leerFiltrosHistorial(consulta, { paginar: false });
  const filas = await modelo.listarCerradas(filtros);
  return {
    nombreArchivo: `historial-quejas-${sufijoArchivo()}.csv`,
    contenido: armarCsv(filas.map(resumenDe)),
    total: filas.length,
  };
}

async function obtener(idQueja) {
  const id = normalizarUuid(idQueja);
  if (!id) throw new ErrorApp(404, NO_ENCONTRADA);
  const fila = await modelo.obtenerCerrada(id);
  if (!fila) throw new ErrorApp(404, NO_ENCONTRADA);

  const [historial, asignaciones, acciones] = await Promise.all([
    casosModelo.listarHistorial(id),
    casosModelo.listarAsignaciones(id),
    seguimientoModelo.listarAcciones(id),
  ]);

  return {
    ...resumenDe(fila),
    derivaciones: asignaciones.map((asignacion) => ({
      id_asignacion: asignacion.id_asignacion,
      responsable: empleado(
        asignacion.id_empleado_responsable,
        asignacion.responsable_nombres,
        asignacion.responsable_apellidos,
      ),
      asignador: empleado(asignacion.id_empleado_asignador, asignacion.asignador_nombres, asignacion.asignador_apellidos),
      comentario: asignacion.comentario,
      asignada_en: asignacion.asignada_en,
    })),
    historial: historial.map((paso) => ({
      estado: { codigo: paso.estado_codigo, nombre: paso.estado_nombre },
      estado_anterior: paso.anterior_codigo ? { codigo: paso.anterior_codigo, nombre: paso.anterior_nombre } : null,
      fecha: paso.fecha_cambio,
      registrado_por: empleado(paso.id_empleado_responsable, paso.nombres, paso.apellidos),
    })),
    acciones: acciones.map((accion) => ({
      id_accion: accion.id_accion,
      tipo: { codigo: accion.tipo_codigo, nombre: accion.tipo_nombre },
      descripcion: descifrarTexto(accion.descripcion),
      registrada_por: empleado(accion.id_empleado_registrador, accion.nombres, accion.apellidos),
      registrada_en: accion.creado_en,
    })),
    resolucion: fila.resolucion ? { descripcion: descifrarTexto(fila.resolucion) } : null,
  };
}

module.exports = { listarCatalogos, listar, exportar, obtener };
