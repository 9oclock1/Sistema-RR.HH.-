const indicadoresService = require('../services/indicadoresService');

// GET /empleados/indicadores/rotacion-temprana?desde=AAAA-MM-DD&hasta=AAAA-MM-DD[&departamento=uuid][&sucursal=uuid]
const obtenerRotacionTemprana = async (req, res) => {
  const { desde, hasta, departamento, sucursal } = req.query;
  res.status(200).json(await indicadoresService.obtenerRotacionTemprana({ desde, hasta, departamento, sucursal }));
};

module.exports = { obtenerRotacionTemprana };
