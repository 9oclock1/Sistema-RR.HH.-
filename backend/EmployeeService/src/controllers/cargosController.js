const cargosService = require('../services/cargosService');

const obtenerCargos = async (req, res) => {
    try {
        const areaId = req.query.area_id ? parseInt(req.query.area_id) : null;
        const cargos = await cargosService.listarCargos(areaId);
        res.status(200).json(cargos);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const crearCargo = async (req, res) => {
    try {
        const { nombre, id_nivel_salarial, id_departamento, perfil_requerido } = req.body;

        if (!nombre || !id_nivel_salarial) {
            return res.status(400).json({ 
                error: 'Faltan campos obligatorios', 
                campos_faltantes: ['nombre', 'id_nivel_salarial'] 
            });
        }

        const nuevoCargo = await cargosService.registrarCargo({
            nombre,
            id_nivel_salarial,
            id_departamento,
            perfil_requerido
        });

        res.status(201).json(nuevoCargo);
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor', detalle: error.message });
    }
};

module.exports = { obtenerCargos, crearCargo };