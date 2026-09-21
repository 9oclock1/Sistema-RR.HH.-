const pool = require("../db");
const MAX_NIVEL_SALARIAL = 9999999999.99;

const SELECT_CARGO = `
  SELECT c.id,
         c.nombre,
         c.nivel_salarial::float8 AS nivel_salarial,
         c.funciones_clave,
         c.perfil_requerido,
         c.area_id,
         d.nombre AS area_nombre,
         c.activo,
         c.fecha_modificacion,
         c.created_at
  FROM cargos c
  LEFT JOIN departamentos d ON d.id = c.area_id
`;

const estaVacio = (valor) =>
  valor === undefined ||
  valor === null ||
  (typeof valor === "string" && valor.trim() === "");

const textoOpcional = (valor) => (estaVacio(valor) ? null : String(valor).trim());

const esIdValido = (valor) => Number.isInteger(valor) && valor > 0;

//valida el cuerpo de alta/edicion devuelve { datos } o { error }
function validarCargo(body) {
  const b = body || {};
  const camposFaltantes = [];
  const camposInvalidos = {};

  if (estaVacio(b.nombre)) camposFaltantes.push("nombre");
  if (estaVacio(b.nivel_salarial)) camposFaltantes.push("nivel_salarial");

  if (camposFaltantes.length > 0) {
    return {
      error: {
        error: "Faltan campos obligatorios",
        campos_faltantes: camposFaltantes,
      },
    };
  }

  const nombre = String(b.nombre).trim();
  if (nombre.length > 100) {
    camposInvalidos.nombre = "Máximo 100 caracteres";
  }

  const nivelSalarial = Number(b.nivel_salarial);
  if (
    typeof b.nivel_salarial === "boolean" ||
    !Number.isFinite(nivelSalarial) ||
    nivelSalarial < 0 ||
    nivelSalarial > MAX_NIVEL_SALARIAL
  ) {
    camposInvalidos.nivel_salarial = "Debe ser un número mayor o igual a 0";
  }

  let areaId = null;
  if (!estaVacio(b.area_id)) {
    areaId = Number(b.area_id);
    if (!esIdValido(areaId)) {
      camposInvalidos.area_id = "Debe ser un id de área válido";
    }
  }

  if (Object.keys(camposInvalidos).length > 0) {
    return { error: { error: "Datos inválidos", campos_invalidos: camposInvalidos } };
  }

  return {
    datos: {
      nombre,
      nivelSalarial,
      funcionesClave: textoOpcional(b.funciones_clave),
      perfilRequerido: textoOpcional(b.perfil_requerido),
      areaId,
    },
  };
}

// Errores de BD conocidos: FK de área inexistente (23503).
function responderErrorBD(res, error) {
  if (error.code === "23503") {
    return res.status(400).json({
      error: "Datos inválidos",
      campos_invalidos: { area_id: "El área indicada no existe" },
    });
  }
  console.error("Error en cargos:", error);
  return res.status(500).json({ error: "Error interno del servidor" });
}

async function buscarCargo(id) {
  const { rows } = await pool.query(`${SELECT_CARGO} WHERE c.id = $1`, [id]);
  return rows[0] || null;
}

// GET /cargos          
// GET /cargos?area_id=1 
async function listarCargos(req, res) {
  try {
    const { area_id } = req.query;
    const params = [];
    let where = "";

    if (!estaVacio(area_id)) {
      const areaId = Number(area_id);
      if (!esIdValido(areaId)) {
        return res.status(400).json({
          error: "Datos inválidos",
          campos_invalidos: { area_id: "Debe ser un id de área válido" },
        });
      }
      params.push(areaId);
      where = "WHERE c.area_id = $1";
    }

    const { rows } = await pool.query(
      `${SELECT_CARGO} ${where} ORDER BY c.nombre, c.id`,
      params
    );
    res.json(rows);
  } catch (error) {
    responderErrorBD(res, error);
  }
}

// GET /cargos/:id
async function obtenerCargo(req, res) {
  try {
    const id = Number(req.params.id);
    if (!esIdValido(id)) {
      return res.status(400).json({ error: "El id del cargo no es válido" });
    }
    const cargo = await buscarCargo(id);
    if (!cargo) return res.status(404).json({ error: "Cargo no encontrado" });
    res.json(cargo);
  } catch (error) {
    responderErrorBD(res, error);
  }
}

// POST /cargos
async function crearCargo(req, res) {
  try {
    const { datos, error } = validarCargo(req.body);
    if (error) return res.status(400).json(error);

    const { rows } = await pool.query(
      `INSERT INTO cargos (nombre, nivel_salarial, funciones_clave, perfil_requerido, area_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [datos.nombre, datos.nivelSalarial, datos.funcionesClave, datos.perfilRequerido, datos.areaId]
    );

    const cargo = await buscarCargo(rows[0].id);
    res.status(201).json(cargo);
  } catch (error) {
    responderErrorBD(res, error);
  }
}

// PUT /cargos/:id
// Reemplaza los datos del cargo, fecha_modificacion solo cambia cuando el nivel salarial recibido es distinto al guardado
async function actualizarCargo(req, res) {
  try {
    const id = Number(req.params.id);
    if (!esIdValido(id)) {
      return res.status(400).json({ error: "El id del cargo no es válido" });
    }

    const { datos, error } = validarCargo(req.body);
    if (error) return res.status(400).json(error);

    const { rowCount } = await pool.query(
      `UPDATE cargos
          SET nombre = $1,
              nivel_salarial = $2,
              funciones_clave = $3,
              perfil_requerido = $4,
              area_id = $5,
              fecha_modificacion = CASE
                WHEN $2::numeric IS DISTINCT FROM nivel_salarial THEN NOW()
                ELSE fecha_modificacion
              END
        WHERE id = $6`,
      [datos.nombre, datos.nivelSalarial, datos.funcionesClave, datos.perfilRequerido, datos.areaId, id]
    );

    if (rowCount === 0) return res.status(404).json({ error: "Cargo no encontrado" });

    const cargo = await buscarCargo(id);
    res.json(cargo);
  } catch (error) {
    responderErrorBD(res, error);
  }
}

module.exports = { listarCargos, obtenerCargo, crearCargo, actualizarCargo };