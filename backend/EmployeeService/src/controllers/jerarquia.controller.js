// src/controllers/jerarquia.controller.js
const service = require('../services/jerarquia.service');

function responderError(res, err, mensajeGenerico) {
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(err);
  return res.status(500).json({ error: mensajeGenerico });
}

async function listarCargos(req, res) {
  try {
    return res.status(200).json(await service.listarCargos());
  } catch (err) {
    return responderError(res, err, 'Error al listar los cargos.');
  }
}

async function listarSubordinados(req, res) {
  try {
    return res.status(200).json(await service.listarSubordinados(req.params.id));
  } catch (err) {
    return responderError(res, err, 'Error al consultar los subordinados.');
  }
}

async function listarHistorial(req, res) {
  try {
    return res.status(200).json(await service.listarHistorial(req.params.id));
  } catch (err) {
    return responderError(res, err, 'Error al consultar el historial.');
  }
}

async function asignarSuperior(req, res) {
  try {
    const { id_cargo_superior } = req.body ?? {};
    if (id_cargo_superior === undefined) {
      return res.status(400).json({ error: 'Debes indicar id_cargo_superior (o null para quitarlo).' });
    }
    const superior = id_cargo_superior === '' ? null : id_cargo_superior;
    return res.status(200).json(await service.asignarSuperior(req.params.id, superior));
  } catch (err) {
    return responderError(res, err, 'Error al asignar el superior.');
  }
}

module.exports = { listarCargos, listarSubordinados, listarHistorial, asignarSuperior };