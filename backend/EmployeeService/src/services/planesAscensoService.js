const { randomUUID } = require('node:crypto');
const pool = require('../../db/pool');
const modelo = require('../models/planesAscensoModel');
const { aplicarAsignacion } = require('./asignacionesService');
const HttpError = require('../utils/HttpError');
const { withTransaction } = require('../utils/transaction');
const { aCurso, calcularAvance, pendientesDe, advertenciaPendientes } = require('../utils/planesAscenso');

const NO_ENCONTRADO = 'No se encontró el plan de ascenso solicitado.';

const conflicto = (mensaje, codigo, extra = {}) => new HttpError(409, mensaje, { codigo, ...extra });

const formatearPlan = (fila, cursos) => ({
  id_plan: fila.id_plan,
  estado: fila.estado,
  observaciones: fila.observaciones,
  empleado: {
    id_empleado: fila.id_empleado,
    nombre_completo: fila.nombre_completo,
    numero_documento: fila.numero_documento,
    activo: fila.empleado_activo,
    cargo_actual: { id_cargo: fila.id_cargo_actual, nombre: fila.cargo_actual },
    sucursal_actual: { id_sucursal: fila.id_sucursal_actual, nombre: fila.sucursal_actual },
  },
  cargo_destino: { id_cargo: fila.id_cargo_destino, nombre: fila.cargo_destino, area: fila.area_destino },
  avance: calcularAvance(cursos),
  cursos,
  asignado_por: fila.asignado_por,
  asignado_en: fila.asignado_en,
  formalizacion:
    fila.estado === 'FORMALIZADO'
      ? {
          formalizado_en: fila.formalizado_en,
          formalizado_por: fila.formalizado_por,
          cursos_pendientes: fila.cursos_pendientes_al_formalizar,
          con_pendientes: fila.cursos_pendientes_al_formalizar > 0,
        }
      : null,
});

// El estado de cada curso se calcula al consultar, contra el Kardex: un certificado recién registrado (criterio 2)
// aparece como cumplido en la siguiente consulta del seguimiento, sin pasos manuales.
const conCursos = async (db, filas) => {
  const { hoy, filas: cursos } = await modelo.listarCursos(db, filas.map((f) => f.id_plan));
  const porPlan = new Map(filas.map((f) => [f.id_plan, []]));
  for (const curso of cursos) porPlan.get(curso.id_plan).push(aCurso(curso, hoy));
  return filas.map((fila) => formatearPlan(fila, porPlan.get(fila.id_plan)));
};

// Criterio 4: el seguimiento de todos los candidatos con su porcentaje de avance.
const listar = async ({ estado }) => {
  const planes = await conCursos(pool, await modelo.listar(pool, { estado }));
  return { planes, total: planes.length };
};

const obtenerDesde = async (db, idPlan) => {
  const fila = await modelo.obtener(db, idPlan);
  if (!fila) throw new HttpError(404, NO_ENCONTRADO);
  return (await conCursos(db, [fila]))[0];
};

const obtener = (idPlan) => obtenerDesde(pool, idPlan);

// Criterio 1: el cargo destino debe tener capacitaciones requeridas; el plan lista esos cursos con su estado.
const asignar = async (datos, { idEmpleado } = {}) => {
  const [empleado, cargo] = await Promise.all([
    modelo.obtenerEmpleado(pool, datos.id_empleado),
    modelo.obtenerCargo(pool, datos.id_cargo_destino),
  ]);
  if (!empleado) throw new HttpError(404, 'El empleado no existe.');
  if (!cargo) throw new HttpError(404, 'El cargo destino no existe.');
  if (!empleado.activo) throw conflicto('Solo se asigna un plan de ascenso a empleados activos.', 'EMPLEADO_INACTIVO');
  if (!cargo.esta_activo) throw conflicto(`El cargo «${cargo.nombre}» no está activo.`, 'CARGO_INACTIVO');
  if (empleado.id_cargo_actual === cargo.id_cargo) {
    throw conflicto(`${empleado.nombre_completo} ya ocupa el cargo «${cargo.nombre}».`, 'MISMO_CARGO');
  }
  if (cargo.cursos_requeridos === 0) {
    throw conflicto(
      `El cargo «${cargo.nombre}» no tiene capacitaciones requeridas: no hay un plan que seguir.`,
      'CARGO_SIN_CAPACITACIONES'
    );
  }
  const abierto = await modelo.obtenerPlanEnCurso(pool, empleado.id_empleado);
  if (abierto) {
    throw conflicto(`${empleado.nombre_completo} ya tiene un plan de ascenso en curso.`, 'PLAN_EN_CURSO', {
      id_plan: abierto.id_plan,
    });
  }

  const idPlan = randomUUID();
  try {
    await modelo.insertar(pool, { ...datos, id_plan: idPlan, asignado_por: idEmpleado ?? null });
  } catch (error) {
    // Dos asignaciones simultáneas: el índice único de planes en curso deja pasar solo una.
    if (error.code === '23505') {
      throw conflicto(`${empleado.nombre_completo} ya tiene un plan de ascenso en curso.`, 'PLAN_EN_CURSO');
    }
    throw error;
  }
  return obtener(idPlan);
};

// Criterio 3: con cursos pendientes no se formaliza sin más: se responde una advertencia con la lista de pendientes.
// Si el Administrador la confirma (confirmar_pendientes), el ascenso se formaliza igual y queda constancia de cuántos
// cursos faltaban. Formalizar cambia el cargo del empleado (nueva asignación) y cierra el plan en la misma transacción.
const formalizar = async (idPlan, { id_sucursal: idSucursal, fecha_inicio: fechaInicio, confirmar_pendientes: confirmar }, { idEmpleado } = {}) =>
  withTransaction(async (client) => {
    const bloqueado = await modelo.bloquear(client, idPlan);
    if (!bloqueado) throw new HttpError(404, NO_ENCONTRADO);
    if (bloqueado.estado !== 'EN_CURSO') throw conflicto('El ascenso de este plan ya fue formalizado.', 'PLAN_FORMALIZADO');

    const plan = await obtenerDesde(client, idPlan);
    const pendientes = pendientesDe(plan.cursos);
    const advertencia = pendientes.length > 0 ? advertenciaPendientes(plan, pendientes) : null;
    if (advertencia && !confirmar) {
      throw conflicto(`Advertencia: ${advertencia} Confirme si desea formalizar el ascenso de todos modos.`, 'CURSOS_PENDIENTES', {
        advertencia,
        cursos_pendientes: pendientes,
        avance: plan.avance,
      });
    }

    await aplicarAsignacion(client, {
      id_empleado: plan.empleado.id_empleado,
      id_cargo: plan.cargo_destino.id_cargo,
      id_sucursal: idSucursal ?? plan.empleado.sucursal_actual.id_sucursal,
      fecha_inicio: fechaInicio,
    });
    await modelo.marcarFormalizado(client, idPlan, { formalizadoPor: idEmpleado ?? null, pendientes: pendientes.length });

    return { ...(await obtenerDesde(client, idPlan)), advertencia };
  });

module.exports = { listar, obtener, asignar, formalizar };
