const modelo = require("../models/calendarioAusencias.model");
const empleados = require("./empleados.service");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const { UMBRAL_PREDETERMINADO, TIPOS, leerRango, validarUmbral, calcularDias } = require("../utils/calendarioAusencias");

// KAN-55 (RF-35): calendario consolidado de ausencias aprobadas por sucursal y área.
// RRHH (gerente y admin) ve cualquier sucursal; el supervisor, solo la suya. `rol` e `idEmpleado` llegan por cabecera
// hasta contar con autenticación.
const ROLES_RRHH = ["admin", "gerente"];
const ROL_SUPERVISOR = "supervisor";

async function resolverAcceso({ idEmpleado, rol } = {}) {
  const codigo = (rol || "").trim().toLowerCase();
  if (ROLES_RRHH.includes(codigo)) return { tipo: "RRHH", idEmpleado: UUID_RE.test(idEmpleado ?? "") ? idEmpleado : null };
  if (codigo !== ROL_SUPERVISOR) {
    throw new ErrorApp(403, "El calendario de ausencias está disponible para RRHH y supervisores.");
  }
  if (!idEmpleado) throw new ErrorApp(401, "Identifíquese como supervisor para ver el calendario.");
  if (!UUID_RE.test(idEmpleado)) throw new ErrorApp(400, "El identificador del supervisor no es válido.");

  const ubicacion = await empleados.obtenerUbicacionConArea(idEmpleado);
  if (!ubicacion) throw new ErrorApp(403, "El identificador no corresponde a un empleado registrado.");
  if (!ubicacion.id_sucursal) throw new ErrorApp(403, "No tiene una sucursal asignada: no hay personal que mostrar.");
  return { tipo: "SUPERVISOR", idEmpleado, idSucursal: ubicacion.id_sucursal };
}

const soloRrhh = (acceso) => {
  if (acceso.tipo !== "RRHH") throw new ErrorApp(403, "Solo RRHH puede configurar los umbrales de cobertura.");
};

// Filtros que puede usar quien consulta: el supervisor solo ve su sucursal.
async function alcance(identidad) {
  const acceso = await resolverAcceso(identidad);
  const [sucursales, areas] = await Promise.all([empleados.listarSucursales(), empleados.listarAreas()]);
  return {
    tipo: acceso.tipo,
    sucursal_fija: acceso.tipo === "SUPERVISOR" ? acceso.idSucursal : null,
    sucursales: acceso.tipo === "SUPERVISOR" ? sucursales.filter((s) => s.id_sucursal === acceso.idSucursal) : sucursales,
    areas,
    tipos: TIPOS,
    umbral_predeterminado: UMBRAL_PREDETERMINADO,
    puede_configurar: acceso.tipo === "RRHH",
  };
}

function leerAlcance({ id_sucursal, id_departamento }, acceso) {
  const errores = [];
  if (id_departamento && !UUID_RE.test(id_departamento)) errores.push({ campo: "id_departamento", mensaje: "Área inválida." });
  const sucursal = id_sucursal || (acceso.tipo === "SUPERVISOR" ? acceso.idSucursal : null);
  if (!sucursal) errores.push({ campo: "id_sucursal", mensaje: "Seleccione una sucursal." });
  else if (!UUID_RE.test(sucursal)) errores.push({ campo: "id_sucursal", mensaje: "Sucursal inválida." });
  if (errores.length > 0) throw new ErrorApp(400, "Filtros inválidos", errores);
  if (acceso.tipo === "SUPERVISOR" && sucursal.toLowerCase() !== acceso.idSucursal.toLowerCase()) {
    throw new ErrorApp(403, "Solo puede ver el calendario de su sucursal.");
  }
  return { idSucursal: sucursal.toLowerCase(), idDepartamento: id_departamento ? id_departamento.toLowerCase() : null };
}

async function nombreDe(buscar, id) {
  if (!id) return null;
  return (await buscar(id).catch(() => null))?.nombre ?? null;
}

// Criterios 1 a 4: ausencias aprobadas del personal de la sucursal (y área) en el rango, con el aviso de baja cobertura por día.
async function consultar(filtros = {}, identidad = {}) {
  const acceso = await resolverAcceso(identidad);
  const { idSucursal, idDepartamento } = leerAlcance(filtros, acceso);
  const rango = leerRango(filtros, await modelo.hoy());

  const personal = (await empleados.listarPorArea(idSucursal, idDepartamento)).filter((p) => p.activo);
  const ids = personal.map((p) => p.id_empleado);
  const [aprobadas, turnos, feriados, umbrales, sucursal, area] = await Promise.all([
    modelo.listarAprobadas(ids, rango.desde, rango.hasta),
    modelo.listarTurnos(ids, rango.desde, rango.hasta),
    modelo.listarFeriados(rango.desde, rango.hasta),
    modelo.listarUmbrales(),
    nombreDe(empleados.obtenerSucursal, idSucursal),
    nombreDe(empleados.obtenerArea, idDepartamento),
  ]);

  const personaDe = new Map(personal.map((p) => [p.id_empleado, p]));
  const ausencias = aprobadas.map((a) => {
    const persona = personaDe.get(a.id_empleado);
    return {
      clave: `${a.categoria}-${a.id_solicitud}`,
      categoria: a.categoria,
      id_solicitud: a.id_solicitud,
      tipo: { codigo: a.tipo_codigo, nombre: a.tipo_nombre },
      empleado: {
        id_empleado: a.id_empleado,
        nombre_completo: persona?.nombre_completo ?? "Empleado no encontrado",
        cargo: persona?.cargo ?? null,
        area: persona?.area ?? null,
        id_departamento: persona?.id_departamento ?? null,
      },
      fecha_inicio: a.fecha_inicio,
      fecha_fin: a.fecha_fin,
      dias: a.dias,
      con_goce_haberes: a.es_con_goce_haberes,
    };
  });

  const dias = calcularDias({ ...rango, idSucursal, personal, ausencias, turnos, feriados, umbrales });
  return {
    filtros: {
      ...rango,
      sucursal: { id_sucursal: idSucursal, nombre: sucursal },
      area: idDepartamento ? { id_departamento: idDepartamento, nombre: area } : null,
    },
    equipo: { activos: personal.length },
    ausencias,
    dias,
    resumen: {
      colaboradores_ausentes: new Set(ausencias.map((a) => a.empleado.id_empleado)).size,
      dias_con_baja_cobertura: dias.filter((d) => d.baja_cobertura).length,
    },
  };
}

async function listarUmbrales(identidad) {
  await resolverAcceso(identidad);
  return { predeterminado: UMBRAL_PREDETERMINADO, umbrales: await modelo.listarUmbrales() };
}

async function guardarUmbral(datos, identidad) {
  const acceso = await resolverAcceso(identidad);
  soloRrhh(acceso);
  const umbral = validarUmbral(datos);
  return modelo.guardarUmbral({ ...umbral, idEmpleado: acceso.idEmpleado });
}

async function eliminarUmbral(idUmbral, identidad) {
  const acceso = await resolverAcceso(identidad);
  soloRrhh(acceso);
  if (!UUID_RE.test(idUmbral)) throw new ErrorApp(404, "Umbral no encontrado");
  if (!(await modelo.eliminarUmbral(idUmbral))) throw new ErrorApp(404, "Umbral no encontrado");
  return { eliminado: true };
}

module.exports = { resolverAcceso, alcance, consultar, listarUmbrales, guardarUmbral, eliminarUmbral };
