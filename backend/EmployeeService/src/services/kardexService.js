const pool = require('../../db/pool');
const kardexModel = require('../models/kardexModel');
const { noEncontrado } = require('./empleadosService');

const aContratoVigente = (fila) => {
  if (!fila.contrato_vigente_id) return null;
  return {
    id_contrato: fila.contrato_vigente_id,
    numero_contrato: fila.contrato_vigente_numero,
    tipo_contrato: fila.contrato_vigente_tipo,
    tipo_jornada: fila.contrato_vigente_jornada,
    fecha_inicio: fila.contrato_vigente_desde,
    fecha_fin: fila.contrato_vigente_hasta,
    haber_mensual_pactado: fila.contrato_vigente_haber,
  };
};

const aKardex = (fila, { contratos, trayectoria, memorandums, capacitaciones }) => ({
  id_empleado: fila.id_empleado,
  datos_personales: {
    numero_documento: fila.numero_documento,
    complemento_documento: fila.complemento_documento,
    nombres: fila.nombres,
    primer_apellido: fila.primer_apellido,
    segundo_apellido: fila.segundo_apellido,
    nombre_completo: fila.nombre_completo,
    fecha_nacimiento: fila.fecha_nacimiento,
    genero: fila.genero,
    telefono_celular: fila.telefono_celular,
    correo_personal: fila.correo_personal,
    direccion_domicilio: fila.direccion_domicilio,
    fecha_ingreso: fila.fecha_ingreso,
    estado: { codigo: fila.estado_codigo, nombre: fila.estado_nombre },
  },
  resumen: {
    antiguedad: { anios: fila.antiguedad_anios, meses: fila.antiguedad_meses },
    cargo_actual: {
      id_cargo: fila.id_cargo,
      codigo: fila.cargo_codigo,
      nombre: fila.cargo_nombre,
      nivel_salarial: fila.cargo_nivel_salarial,
      vigente_desde: fila.vigente_desde,
    },
    area: { id_departamento: fila.id_departamento, nombre: fila.area_nombre },
    sucursal: { id_sucursal: fila.id_sucursal, nombre: fila.sucursal_nombre, ciudad: fila.sucursal_ciudad },
    contrato_vigente: aContratoVigente(fila),
    balance_disciplinario: {
      total_sanciones: fila.total_sanciones,
      sanciones_leves: fila.sanciones_leves,
      sanciones_moderadas: fila.sanciones_moderadas,
      sanciones_graves: fila.sanciones_graves,
      total_reconocimientos: fila.total_reconocimientos,
      memorandums_sin_acuse: fila.memorandums_sin_acuse,
      fecha_ultima_sancion: fila.fecha_ultima_sancion,
    },
    totales: {
      contratos: fila.total_contratos,
      adendas: fila.total_adendas,
      asignaciones: fila.total_asignaciones,
      capacitaciones: fila.total_capacitaciones,
      capacitaciones_vencidas: fila.capacitaciones_vencidas,
    },
  },
  contratos,
  trayectoria,
  memorandums,
  capacitaciones,
});

const obtenerKardex = async (idEmpleado) => {
  const [resumen, contratos, trayectoria, memorandums, capacitaciones] = await Promise.all([
    kardexModel.obtenerResumen(pool, idEmpleado),
    kardexModel.listarContratos(pool, idEmpleado),
    kardexModel.listarTrayectoria(pool, idEmpleado),
    kardexModel.listarMemorandums(pool, idEmpleado),
    kardexModel.listarCapacitaciones(pool, idEmpleado),
  ]);
  if (!resumen) throw noEncontrado();
  return aKardex(resumen, { contratos, trayectoria, memorandums, capacitaciones });
};

module.exports = { obtenerKardex };
