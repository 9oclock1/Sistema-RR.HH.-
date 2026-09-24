// controllers/departamentos.controller.js
const service = require('../services/departamentos.service');

async function crear(req, res) {
  try {
    const area = await service.registrarArea(req.body);
    return res.status(201).json(area); // Criterio 1: se guarda y se puede listar
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

async function listarActivas(req, res) {
  try {
    const areas = await service.listarAreasActivas();
    return res.status(200).json(areas);
  } catch (err) {
    return res.status(500).json({ error: 'Error al listar áreas.' });
  }
}

async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const area = await service.modificarArea(id, req.body);
    return res.status(200).json(area); // Criterio 2: id_departamento no cambia
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

async function darDeBaja(req, res) {
  try {
    const { id } = req.params;
    const area = await service.darDeBajaArea(id);
    return res.status(200).json({
      mensaje: 'Área dada de baja correctamente.',
      area,
    }); // Criterio 3
  } catch (err) {
    // Criterio 4: 409 + motivo exacto que arma el trigger
    return res.status(err.status || 500).json({ error: err.message });
  }
}

module.exports = { crear, listarActivas, actualizar, darDeBaja };