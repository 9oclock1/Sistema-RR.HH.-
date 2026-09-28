// src/services/organigrama.service.js
const model = require('../models/organigrama.model');

// Criterio 1: árbol anidado. Criterio 4: se arma en caliente desde la base en cada request.
function construirArbol(filas) {
  const porId = new Map();
  const raices = [];

  filas.forEach((f) => {
    porId.set(f.id_cargo, {
      id_cargo: f.id_cargo,
      codigo: f.codigo,
      cargo: f.cargo,
      departamento: f.departamento,
      nivel_jerarquico: f.nivel_jerarquico,
      empleados: f.empleados,
      hijos: [],
    });
  });

  filas.forEach((f) => {
    const nodo = porId.get(f.id_cargo);
    const padre = f.id_cargo_superior && porId.get(f.id_cargo_superior);
    if (padre) padre.hijos.push(nodo);
    else raices.push(nodo);
  });

  return raices;
}

async function obtenerArbolOrganigrama() {
  return construirArbol(await model.obtenerCargosConOcupantes());
}

// Criterio 3: mismo árbol que se ve en pantalla, con fecha de generación
async function obtenerOrganigramaParaExportar() {
  const filas = await model.obtenerCargosConOcupantes();
  return {
    generado_en: new Date().toISOString(),
    total_cargos: filas.length,
    arbol: construirArbol(filas),
  };
}

module.exports = { obtenerArbolOrganigrama, obtenerOrganigramaParaExportar };