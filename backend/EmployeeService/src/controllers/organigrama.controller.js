// src/controllers/organigrama.controller.js
const service = require('../services/organigrama.service');

async function obtenerArbol(req, res) {
  try {
    const arbol = await service.obtenerArbolOrganigrama();
    return res.status(200).json(arbol); // Criterio 1
  } catch (err) {
    console.error('Error al construir el organigrama:', err);
    return res.status(500).json({ error: 'Error al construir el organigrama.' });
  }
}

/**
 * Criterio 3: genera un archivo descargable con la estructura vigente.
 * Se exporta como JSON (estructura completa y vigente al momento de pedirlo).
 */
async function exportar(req, res) {
  try {
    const datos = await service.obtenerOrganigramaParaExportar();
    const fecha = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Disposition', `attachment; filename="organigrama_${fecha}.json"`);
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).send(JSON.stringify(datos, null, 2));
  } catch (err) {
    console.error('Error al exportar el organigrama:', err);
    return res.status(500).json({ error: 'Error al exportar el organigrama.' });
  }
}

module.exports = { obtenerArbol, exportar };