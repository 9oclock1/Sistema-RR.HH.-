const modelo = require("../models/anticipos.model");
const empleadosCliente = require("../clients/empleados.cliente");
const { enTransaccion } = require("../config/transaccion");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const { esFecha, esPrimerDiaDeMes } = require("../utils/fechas");
const { validarDatosPrestamo, calcularCuotas, validarTopeDescuento, validarOrdenCierre } = require("../utils/anticipos");

const noEncontrado = () => new ErrorApp(404, "Anticipo o préstamo no encontrado");

function validarPeriodo(periodo) {
  if (!esFecha(periodo) || !esPrimerDiaDeMes(periodo)) {
    throw new ErrorApp(400, "Periodo inválido", [
      { campo: "periodo", mensaje: "Use el primer día del mes, por ejemplo 2026-11-01." },
    ]);
  }
}

async function listar({ id_empleado, estado } = {}) {
  return modelo.listar({ id_empleado, estado });
}

async function buscar(id) {
  const prestamo = UUID_RE.test(id) ? await modelo.obtener(id) : undefined;
  if (!prestamo) throw noEncontrado();
  return prestamo;
}

async function obtener(id) {
  const prestamo = await buscar(id);
  return { ...prestamo, cuotas: await modelo.listarCuotas(id) };
}

// AC1: el Contador registra monto, número de cuotas y mes de inicio; el sistema genera el plan de cuotas.
// AC2: si la cuota supera el porcentaje máximo de descuento sobre el líquido pagable, se rechaza con el límite.
async function crear(datos) {
  const prestamo = validarDatosPrestamo(datos);

  const empleado = await empleadosCliente.obtenerEmpleado(prestamo.id_empleado);
  if (!empleado) {
    throw new ErrorApp(404, "El colaborador no existe", [{ campo: "id_empleado", mensaje: "Colaborador no encontrado." }]);
  }

  const liquidoPagable = await empleadosCliente.obtenerHaberVigente(prestamo.id_empleado);
  if (!liquidoPagable) {
    throw new ErrorApp(409, "El colaborador no tiene un contrato vigente", [
      { campo: "id_empleado", mensaje: "No se puede calcular el tope de descuento sin un contrato vigente." },
    ]);
  }

  const cuotas = calcularCuotas(prestamo);
  const comprometidoPorPeriodo = await modelo.sumarComprometidoPorPeriodo(prestamo.id_empleado);
  const { porcentaje_cuota } = validarTopeDescuento(cuotas, liquidoPagable, comprometidoPorPeriodo);

  const id = await enTransaccion(async (cliente) => {
    const nuevo = await modelo.crear(cliente, {
      ...prestamo,
      liquido_pagable_referencial: liquidoPagable,
      porcentaje_cuota,
    });
    await modelo.crearCuotas(cliente, nuevo, cuotas);
    return nuevo;
  });
  return obtener(id);
}

// AC3: la planilla del mes consulta aquí las cuotas pendientes de ese periodo para incluirlas como deducción.
async function listarDeducciones(periodo) {
  validarPeriodo(periodo);
  return modelo.listarCuotasDelPeriodo(periodo);
}

// AC4: al cerrar la planilla del periodo, las cuotas quedan pagadas y el saldo pendiente del préstamo se actualiza.
async function cerrarPeriodo(periodo) {
  validarPeriodo(periodo);
  const periodoPendienteMasAntiguo = await modelo.obtenerPeriodoPendienteMasAntiguo();
  validarOrdenCierre(periodo, periodoPendienteMasAntiguo);
  const cuotasCerradas = await enTransaccion((cliente) => modelo.cerrarPeriodo(cliente, periodo));
  return { periodo, cuotas_cerradas: cuotasCerradas };
}

module.exports = { listar, obtener, crear, listarDeducciones, cerrarPeriodo };
