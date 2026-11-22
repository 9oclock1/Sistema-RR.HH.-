const pool = require('../../db/pool');
const indicadoresModel = require('../models/indicadoresModel');
const { validarFiltrosRotacion, calcularRotacionTemprana } = require('../utils/rotacionTemprana');

// KPI-12: bajas con menos de 90 días de antigüedad dadas dentro del periodo, sobre los ingresos del mismo periodo.
// Una baja cuenta aunque el colaborador haya ingresado antes del periodo (por ejemplo, ingresó a fin de mes y se
// fue al mes siguiente): el numerador mira cuándo se fue, el denominador cuántos entraron en el periodo.
const obtenerRotacionTemprana = async (consulta) => {
  const filtros = validarFiltrosRotacion(consulta);
  const [ingresos, bajas] = await Promise.all([
    indicadoresModel.listarIngresos(pool, filtros),
    indicadoresModel.listarBajas(pool, filtros),
  ]);
  return {
    ...calcularRotacionTemprana({ ingresos, bajas }, filtros),
    filtros: { departamento: filtros.departamento, sucursal: filtros.sucursal },
  };
};

module.exports = { obtenerRotacionTemprana };
