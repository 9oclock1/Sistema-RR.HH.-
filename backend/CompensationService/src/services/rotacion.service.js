const modelo = require("../models/rotacion.model");
const empleadosCliente = require("../clients/empleados.cliente");
const { hoyLaPaz } = require("../utils/fechas");
const { validarConsulta, resolverAlcance, calcularTablero } = require("../utils/rotacion");

async function obtenerTablero(consulta, identidad) {
  const hoy = hoyLaPaz();
  const { periodo, idSucursal, idDepartamento } = validarConsulta(consulta, hoy);
  const [empleados, bajas, causales] = await Promise.all([
    empleadosCliente.listarEmpleados(),
    modelo.listarBajas(),
    modelo.listarCausales(),
  ]);
  const alcance = resolverAlcance(identidad, empleados, idSucursal);
  const tablero = calcularTablero({
    empleados,
    bajas,
    causales,
    periodo,
    idSucursal: alcance.id_sucursal,
    idDepartamento,
    hoy,
  });
  return {
    ...tablero,
    filtros: { id_sucursal: alcance.id_sucursal, id_departamento: idDepartamento },
    alcance: { rol: alcance.rol, sucursal_fija: alcance.sucursal_fija },
  };
}

module.exports = { obtenerTablero };
