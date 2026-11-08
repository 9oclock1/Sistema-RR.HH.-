const MOTIVO = {
  NO_DISPONIBLE: "NO_DISPONIBLE",
  SIN_CARGO_SUPERIOR: "SIN_CARGO_SUPERIOR",
  SIN_EVALUADOR_EN_SUCURSAL: "SIN_EVALUADOR_EN_SUCURSAL",
};

const minusculas = (valor) =>
  typeof valor === "string" ? valor.toLowerCase() : null;
const porNombre = (a, b) =>
  String(a.nombre_completo ?? "").localeCompare(
    String(b.nombre_completo ?? ""),
    "es",
  ) || String(a.id_empleado).localeCompare(String(b.id_empleado));

const describirEvaluado = (empleado) => ({
  id_empleado: minusculas(empleado.id_empleado),
  nombre_completo: empleado.nombre_completo ?? null,
  cargo: empleado.cargo ?? null,
  id_departamento: minusculas(empleado.id_departamento),
  area: empleado.area ?? null,
  id_sucursal: minusculas(empleado.id_sucursal),
  sucursal: empleado.sucursal ?? null,
});

const describirEvaluador = (empleado) => ({
  id_empleado: minusculas(empleado.id_empleado),
  nombre_completo: empleado.nombre_completo ?? null,
  cargo: empleado.cargo ?? null,
});

// Quienes se evalúan: área ∩ sucursal (o la que se haya elegido sola) más los colaboradores elegidos uno por uno.
function seleccionarEvaluados(activos, { areas, sucursales, colaboradores }) {
  const idsAreas = new Set(areas.map(minusculas));
  const idsSucursales = new Set(sucursales.map(minusculas));
  const seleccionados = new Map();
  const omitidos = [];

  if (idsAreas.size > 0 || idsSucursales.size > 0) {
    for (const empleado of activos) {
      const enArea =
        idsAreas.size === 0 ||
        idsAreas.has(minusculas(empleado.id_departamento));
      const enSucursal =
        idsSucursales.size === 0 ||
        idsSucursales.has(minusculas(empleado.id_sucursal));
      if (enArea && enSucursal)
        seleccionados.set(minusculas(empleado.id_empleado), empleado);
    }
  }

  const activosPorId = new Map(
    activos.map((empleado) => [minusculas(empleado.id_empleado), empleado]),
  );
  for (const id of colaboradores.map(minusculas)) {
    if (seleccionados.has(id)) continue;
    const empleado = activosPorId.get(id);
    if (empleado) {
      seleccionados.set(id, empleado);
    } else {
      omitidos.push({
        id_empleado: id,
        nombre_completo: null,
        codigo: MOTIVO.NO_DISPONIBLE,
        motivo: "El colaborador no existe o no está activo.",
      });
    }
  }
  return { evaluados: [...seleccionados.values()].sort(porNombre), omitidos };
}

// El evaluador es quien ocupa, en la misma sucursal del evaluado, el cargo jefe directo de su cargo.
// Si hay más de uno se toma el primero por nombre, para que el resultado sea siempre el mismo.
function resolverAsignaciones({
  empleados,
  cargos,
  alcance,
  idDepartamentoPlantilla = null,
}) {
  const activos = empleados.filter((empleado) => empleado.activo !== false);
  const cargosPorId = new Map(
    cargos.map((cargo) => [minusculas(cargo.id_cargo), cargo]),
  );
  const { evaluados, omitidos } = seleccionarEvaluados(activos, alcance);

  const asignaciones = [];
  for (const evaluado of evaluados) {
    const cargo = cargosPorId.get(minusculas(evaluado.id_cargo));
    const idCargoSuperior = minusculas(cargo?.id_cargo_superior);
    if (!idCargoSuperior) {
      omitidos.push({
        ...describirEvaluado(evaluado),
        codigo: MOTIVO.SIN_CARGO_SUPERIOR,
        motivo: "Su cargo no tiene un cargo superior en la jerarquía.",
      });
      continue;
    }

    const evaluador = activos
      .filter(
        (candidato) =>
          minusculas(candidato.id_cargo) === idCargoSuperior &&
          minusculas(candidato.id_sucursal) ===
            minusculas(evaluado.id_sucursal) &&
          minusculas(candidato.id_empleado) !==
            minusculas(evaluado.id_empleado),
      )
      .sort(porNombre)[0];
    if (!evaluador) {
      omitidos.push({
        ...describirEvaluado(evaluado),
        codigo: MOTIVO.SIN_EVALUADOR_EN_SUCURSAL,
        motivo: `Nadie ocupa el cargo superior «${cargo.superior_nombre ?? "sin nombre"}» en su sucursal.`,
      });
      continue;
    }
    asignaciones.push({
      evaluado: describirEvaluado(evaluado),
      evaluador: describirEvaluador(evaluador),
    });
  }

  const advertencias = [];
  if (idDepartamentoPlantilla) {
    const deOtraArea = asignaciones
      .map((asignacion) => asignacion.evaluado)
      .filter(
        (evaluado) =>
          evaluado.id_departamento !== minusculas(idDepartamentoPlantilla),
      );
    if (deOtraArea.length > 0) {
      advertencias.push({
        codigo: "OTRA_AREA",
        mensaje: `${deOtraArea.length} colaborador(es) pertenecen a un área distinta de la que va dirigida la plantilla.`,
        empleados: deOtraArea.map((evaluado) => evaluado.id_empleado),
      });
    }
  }

  return { asignaciones, omitidos, advertencias };
}

module.exports = { MOTIVO, resolverAsignaciones };
