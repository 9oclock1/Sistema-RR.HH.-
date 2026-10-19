const modelo = require("../models/rolesTurno.model");
const empleados = require("./empleados.service");
const eventos = require("./eventos.service");
const { enTransaccion } = require("../config/transaccion");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const { validarDescansos, DESCANSO_MINIMO_HORAS } = require("../utils/descansos");
const { validarNuevoRol, validarCambios } = require("../utils/validarRol");
const { PERIODO_ROL, calcularPeriodo, diasDelPeriodo, sumarDias, esFechaValida } = require("../utils/periodos");

const MAXIMO_DIAS_CONSULTA = 62;

const horasMinimas = () => Number(process.env.DESCANSO_MINIMO_HORAS) || DESCANSO_MINIMO_HORAS;

const noEncontrado = () => new ErrorApp(404, "Rol de turnos no encontrado");

const fechaCorta = (fecha) => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}/${fecha.slice(0, 4)}`;

const hora = (valor) => valor?.slice(0, 5) ?? null;

async function buscar(id) {
  const rol = UUID_RE.test(id) ? await modelo.obtener(id) : undefined;
  if (!rol) throw noEncontrado();
  return rol;
}

const resumirRol = (rol) => ({
  id_rol: rol.id_rol,
  id_sucursal: rol.id_sucursal,
  id_departamento: rol.id_departamento,
  periodo: { codigo: rol.periodo_codigo, nombre: rol.periodo_nombre },
  fecha_inicio: rol.fecha_inicio,
  fecha_fin: rol.fecha_fin,
  estado: { codigo: rol.estado_codigo, nombre: rol.estado_nombre },
  version_publicada: rol.version_publicada,
  tiene_cambios_sin_publicar: rol.tiene_cambios_sin_publicar,
  publicado_en: rol.publicado_en,
});

// Personal de la matriz: el activo del área hoy, más quien ya tenga celdas en el rol.
async function armarPersonal(rol, asignaciones) {
  const actuales = (await empleados.listarPorArea(rol.id_sucursal, rol.id_departamento)).filter((e) => e.activo);
  const vigentes = new Set(actuales.map((e) => e.id_empleado));
  const otros = [...new Set(asignaciones.map((a) => a.id_empleado))].filter((id) => !vigentes.has(id));
  const fuera = await Promise.all(
    otros.map(async (id) => ({
      id_empleado: id,
      nombre_completo: await empleados.obtenerNombre(id),
      cargo: null,
      vigente: false,
    }))
  );
  return [
    ...actuales.map(({ id_empleado, nombre_completo, cargo }) => ({ id_empleado, nombre_completo, cargo, vigente: true })),
    ...fuera,
  ];
}

async function calcularAlertas(rol, asignaciones, personal) {
  const ids = personal.map((p) => p.id_empleado);
  const vecinas = await modelo.listarAsignacionesVecinas(
    rol.id_rol,
    ids,
    sumarDias(rol.fecha_inicio, -1),
    sumarDias(rol.fecha_fin, 1)
  );
  const todas = [...asignaciones, ...vecinas];
  const turnos = new Map(
    (await modelo.listarTurnos([...new Set(todas.map((a) => a.id_turno).filter(Boolean))])).map((t) => [t.id_turno, t])
  );
  const alertas = validarDescansos(
    todas.map((a) => ({ id_empleado: a.id_empleado, fecha: a.fecha, turno: a.id_turno ? turnos.get(a.id_turno) : null })),
    { horasMinimas: horasMinimas() }
  );
  const enPeriodo = (fecha) => fecha >= rol.fecha_inicio && fecha <= rol.fecha_fin;
  return {
    turnos,
    alertas: alertas.filter((a) => enPeriodo(a.fecha) || enPeriodo(a.fecha_anterior)),
  };
}

async function armarDetalle(rol) {
  const asignaciones = await modelo.listarAsignaciones(rol.id_rol);
  const [sucursal, area, personal, eventosDelRol] = await Promise.all([
    empleados.obtenerSucursal(rol.id_sucursal),
    empleados.obtenerArea(rol.id_departamento),
    armarPersonal(rol, asignaciones),
    eventos.listarDeRol(rol.id_rol),
  ]);
  const { turnos, alertas } = await calcularAlertas(rol, asignaciones, personal);
  const dias = diasDelPeriodo(rol.fecha_inicio, rol.fecha_fin);
  const vigentes = personal.filter((p) => p.vigente);
  const llenas = new Set(asignaciones.map((a) => `${a.id_empleado}|${a.fecha}`));
  let celdasVacias = 0;
  for (const p of vigentes) {
    for (const dia of dias) if (!llenas.has(`${p.id_empleado}|${dia}`)) celdasVacias += 1;
  }
  const usados = new Set(asignaciones.map((a) => a.id_turno).filter(Boolean));

  return {
    ...resumirRol(rol),
    sucursal: sucursal ?? { id_sucursal: rol.id_sucursal, nombre: "Sucursal no disponible" },
    area: area ?? { id_departamento: rol.id_departamento, codigo: null, nombre: "Área no disponible" },
    descanso_minimo_horas: horasMinimas(),
    dias,
    empleados: personal,
    asignaciones,
    turnos: [...usados].map((id) => {
      const t = turnos.get(id);
      return { ...t, hora_inicio: hora(t.hora_inicio), hora_fin: hora(t.hora_fin) };
    }),
    alertas,
    celdas_vacias: celdasVacias,
    eventos: eventosDelRol,
  };
}

async function listar({ id_sucursal, id_departamento } = {}) {
  const errores = [];
  if (id_sucursal !== undefined && !UUID_RE.test(id_sucursal)) {
    errores.push({ campo: "id_sucursal", mensaje: "Identificador de sucursal inválido." });
  }
  if (id_departamento !== undefined && !UUID_RE.test(id_departamento)) {
    errores.push({ campo: "id_departamento", mensaje: "Identificador de área inválido." });
  }
  if (errores.length > 0) throw new ErrorApp(400, "Filtros inválidos", errores);
  const roles = await modelo.listar({
    idSucursal: id_sucursal?.toLowerCase() ?? null,
    idDepartamento: id_departamento?.toLowerCase() ?? null,
  });
  return roles.map(resumirRol);
}

async function crear(datos) {
  const nuevo = validarNuevoRol(datos);
  const [sucursal, area] = await Promise.all([
    empleados.obtenerSucursal(nuevo.id_sucursal),
    empleados.obtenerArea(nuevo.id_departamento),
  ]);
  const errores = [];
  if (!sucursal) errores.push({ campo: "id_sucursal", mensaje: "La sucursal no existe o no está activa." });
  if (!area) errores.push({ campo: "id_departamento", mensaje: "El área no existe o no está activa." });
  if (errores.length > 0) throw new ErrorApp(400, "Datos del rol inválidos", errores);

  const fila = { ...nuevo, id_periodo_rol: PERIODO_ROL[nuevo.periodo], ...calcularPeriodo(nuevo.periodo, nuevo.fecha) };
  try {
    return await armarDetalle(await modelo.crear(fila));
  } catch (error) {
    if (error.code !== "23P01") throw error;
    const existente = await modelo.buscarSolapado(fila);
    const rango = existente
      ? ` (${existente.periodo_nombre.toLowerCase()}, del ${fechaCorta(existente.fecha_inicio)} al ${fechaCorta(existente.fecha_fin)})`
      : "";
    throw new ErrorApp(409, `Ya existe un rol de turnos para esta área y sucursal que incluye esas fechas${rango}.`, [
      { campo: "fecha", mensaje: "Abra el rol existente o elija otro periodo." },
    ]);
  }
}

async function obtener(id) {
  return armarDetalle(await buscar(id));
}

async function validarTurnosAsignables(cambios) {
  const ids = [...new Set(cambios.map((c) => c.id_turno).filter(Boolean))];
  const turnos = new Map((await modelo.listarTurnos(ids)).map((t) => [t.id_turno, t]));
  const errores = ids
    .filter((id) => !turnos.get(id)?.esta_activo)
    .map((id) => ({
      campo: "id_turno",
      mensaje: turnos.has(id) ? `El turno ${turnos.get(id).nombre} está inactivo.` : `El turno ${id} no existe.`,
    }));
  if (errores.length > 0) throw new ErrorApp(400, "Hay turnos que no se pueden asignar", errores);
}

async function guardarAsignaciones(id, cuerpo) {
  const rol = await buscar(id);
  const cambios = validarCambios(cuerpo, rol);
  await validarTurnosAsignables(cambios);

  const personal = await armarPersonal(rol, await modelo.listarAsignaciones(rol.id_rol));
  const conocidos = new Set(personal.map((p) => p.id_empleado));
  const ajenos = [...new Set(cambios.map((c) => c.id_empleado))].filter((idEmpleado) => !conocidos.has(idEmpleado));
  if (ajenos.length > 0) {
    throw new ErrorApp(
      400,
      "Hay empleados que no pertenecen al área de este rol",
      ajenos.map((idEmpleado) => ({ campo: "id_empleado", mensaje: `El empleado ${idEmpleado} no es parte del personal activo del área.` }))
    );
  }

  await enTransaccion(async (cliente) => {
    if (!(await modelo.bloquear(cliente, rol.id_rol))) throw noEncontrado();
    await modelo.aplicarCambios(cliente, rol.id_rol, cambios);
  });
  return obtener(rol.id_rol);
}

function verificarPublicable(detalle) {
  const vigentes = detalle.empleados.filter((p) => p.vigente);
  if (vigentes.length === 0) {
    throw new ErrorApp(409, "No se puede publicar: el área no tiene personal activo en esta sucursal.");
  }
  if (detalle.version_publicada > 0 && !detalle.tiene_cambios_sin_publicar) {
    throw new ErrorApp(409, "No hay cambios por publicar: el rol ya está publicado tal como está.");
  }

  const detalles = [];
  if (detalle.celdas_vacias > 0) {
    detalles.push({
      campo: "asignaciones",
      mensaje: `Faltan ${detalle.celdas_vacias} celda(s) por completar: asigne un turno o un descanso a cada colaborador en cada día.`,
    });
  }
  const inactivos = detalle.turnos.filter((t) => !t.esta_activo);
  for (const turno of inactivos) {
    detalles.push({ campo: "id_turno", mensaje: `El turno ${turno.nombre} está inactivo; reemplácelo antes de publicar.` });
  }
  for (const alerta of detalle.alertas) {
    const nombre = detalle.empleados.find((p) => p.id_empleado === alerta.id_empleado)?.nombre_completo;
    detalles.push({ campo: "alertas", mensaje: `${nombre ?? "Empleado"}: ${alerta.mensaje}` });
  }
  if (detalles.length > 0) {
    throw new ErrorApp(409, "No se puede publicar el rol: corrija las observaciones.", detalles);
  }
  return vigentes.map((p) => p.id_empleado);
}

async function publicar(id) {
  const rol = await buscar(id);
  const detalle = await armarDetalle(rol);
  const ids = verificarPublicable(detalle);

  try {
    await enTransaccion(async (cliente) => {
      if (!(await modelo.bloquear(cliente, rol.id_rol))) throw noEncontrado();
      const actual = await modelo.obtener(rol.id_rol, cliente);
      // Otro guardado pudo llegar entre la validación y el bloqueo.
      if (actual.actualizado_en.getTime() !== rol.actualizado_en.getTime()) {
        throw new ErrorApp(409, "El rol cambió mientras se publicaba. Revise los cambios y vuelva a publicar.");
      }
      const publicado = await modelo.publicar(cliente, rol.id_rol, ids);
      await eventos.registrarPublicacion(cliente, { ...detalle, ...resumirRol(publicado) });
    });
  } catch (error) {
    if (error.code !== "23505" || error.constraint !== "uq_turno_publicado_empleado_fecha") throw error;
    throw new ErrorApp(
      409,
      "No se puede publicar: hay colaboradores con turnos ya publicados en otro rol para esas fechas.",
      [{ campo: "asignaciones", mensaje: "Revise si el colaborador cambió de área y quite sus días del otro rol." }]
    );
  }
  return obtener(rol.id_rol);
}

async function eliminar(id) {
  const rol = await buscar(id);
  if (rol.version_publicada > 0) {
    throw new ErrorApp(409, "No se puede eliminar un rol que ya fue publicado.");
  }
  if (!(await modelo.eliminarBorrador(rol.id_rol))) {
    throw new ErrorApp(409, "No se puede eliminar un rol que ya fue publicado.");
  }
}

async function misTurnos(idEmpleado, { desde, hasta } = {}) {
  if (!UUID_RE.test(idEmpleado)) throw new ErrorApp(403, "El usuario no corresponde a un empleado registrado.");
  const hoy = await modelo.hoy();
  const inicio = desde ?? hoy;
  if (!esFechaValida(inicio)) {
    throw new ErrorApp(400, "Rango de fechas inválido", [{ campo: "desde", mensaje: "Use el formato AAAA-MM-DD." }]);
  }
  const fin = hasta ?? sumarDias(inicio, 6);

  const errores = [];
  if (!esFechaValida(fin)) errores.push({ campo: "hasta", mensaje: "Use el formato AAAA-MM-DD." });
  if (errores.length === 0 && (fin < inicio || diasDelPeriodo(inicio, fin).length > MAXIMO_DIAS_CONSULTA)) {
    errores.push({ campo: "hasta", mensaje: `Consulte entre 1 y ${MAXIMO_DIAS_CONSULTA} días a partir de "desde".` });
  }
  if (errores.length > 0) throw new ErrorApp(400, "Rango de fechas inválido", errores);

  const publicados = await modelo.listarPublicadosDeEmpleado(idEmpleado.toLowerCase(), inicio, fin);
  return {
    hoy,
    desde: inicio,
    hasta: fin,
    turnos: publicados.map((t) => ({
      fecha: t.fecha,
      descanso: t.descanso,
      turno: t.descanso ? null : { nombre: t.nombre_turno, hora_inicio: hora(t.hora_inicio), hora_fin: hora(t.hora_fin) },
    })),
  };
}

module.exports = { listar, crear, obtener, guardarAsignaciones, publicar, eliminar, misTurnos };
