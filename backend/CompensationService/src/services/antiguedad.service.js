const modelo = require("../models/antiguedad.model");
const empleadosCliente = require("../clients/empleados.cliente");
const { enTransaccion } = require("../config/transaccion");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const { esFecha, esPrimerDiaDeMes, hoyLaPaz, aniosDeServicio } = require("../utils/fechas");
const { validarVigenciaEscala, cierreDeUltimaVigencia, tramoParaAnios, pisoBono, redondear } = require("../utils/antiguedad");

const sinEscalaVigente = () =>
  new ErrorApp(409, "No hay una escala de antigüedad vigente para esa fecha", [
    { campo: "periodo", mensaje: "Registre una vigencia de la escala que cubra este periodo." },
  ]);

async function conTramos(vigencia) {
  if (!vigencia) return null;
  return { ...vigencia, tramos: await modelo.listarTramos(vigencia.id_vigencia) };
}

async function listarEscalas() {
  const vigencias = await modelo.listarVigencias();
  return Promise.all(vigencias.map(conTramos));
}

async function obtenerEscalaVigente(fecha = hoyLaPaz()) {
  if (!esFecha(fecha)) {
    throw new ErrorApp(400, "Fecha inválida", [{ campo: "fecha", mensaje: "Use el formato AAAA-MM-DD." }]);
  }
  const vigencia = await conTramos(await modelo.obtenerVigenciaEnFecha(fecha));
  if (!vigencia) throw sinEscalaVigente();
  return vigencia;
}

// RF-50, criterio 3: una vigencia nueva no modifica los tramos de las anteriores, así los cálculos ya
// hechos conservan su porcentaje histórico.
async function registrarVigencia(datos) {
  const escala = validarVigenciaEscala(datos);
  const id = await enTransaccion(async (cliente) => {
    const ultima = await modelo.ultimaVigencia(cliente);
    const cierre = cierreDeUltimaVigencia(ultima, escala.vigente_desde);
    if (cierre) await modelo.cerrarVigencia(cliente, ultima.id_vigencia, cierre);
    const nueva = await modelo.crearVigencia(cliente, escala);
    await modelo.crearTramos(cliente, nueva, escala.tramos);
    return nueva;
  });
  return conTramos({ id_vigencia: id, vigente_desde: escala.vigente_desde, vigente_hasta: null, motivo: escala.motivo });
}

function validarPeriodo(periodo) {
  if (!esFecha(periodo) || !esPrimerDiaDeMes(periodo)) {
    throw new ErrorApp(400, "Periodo inválido", [
      { campo: "periodo", mensaje: "Use el primer día del mes, por ejemplo 2026-11-01." },
    ]);
  }
}

// RF-50, criterios 1 y 2: la antigüedad y el tramo se recalculan para el periodo solicitado, así un
// colaborador que cumple un nuevo tramo en el mes recibe el nuevo porcentaje desde ese mes.
async function calcularBono(idEmpleado, periodo) {
  validarPeriodo(periodo);
  if (!UUID_RE.test(idEmpleado)) throw new ErrorApp(404, "Colaborador no encontrado");

  const empleado = await empleadosCliente.obtenerEmpleado(idEmpleado);
  if (!empleado) throw new ErrorApp(404, "Colaborador no encontrado");
  if (!empleado.fecha_ingreso) {
    throw new ErrorApp(409, "El colaborador no tiene una fecha de ingreso registrada");
  }

  const aniosServicio = aniosDeServicio(empleado.fecha_ingreso, periodo);
  const escala = await obtenerEscalaVigente(periodo);
  const tramo = tramoParaAnios(escala.tramos, aniosServicio);
  if (!tramo) {
    // Por debajo del primer tramo (hoy, menos de 2 años): no es una falla del cálculo, es que la ley
    // todavía no le da derecho al bono. El código ANTIGUEDAD_INSUFICIENTE le permite al front mostrar
    // el estado "Omitido por error" sin tener que distinguirlo del resto de errores por el texto.
    const piso = pisoBono(escala.tramos);
    if (aniosServicio < piso) {
      throw new ErrorApp(
        409,
        "Omitido por error",
        [{ campo: "anios_servicio", mensaje: `El bono aplica desde los ${piso} años de servicio; el colaborador tiene ${aniosServicio}.` }],
        "ANTIGUEDAD_INSUFICIENTE"
      );
    }
    throw new ErrorApp(409, "La escala vigente no cubre esa antigüedad", [
      { campo: "tramos", mensaje: `No hay un tramo definido para ${aniosServicio} años de servicio.` },
    ]);
  }

  const haberBasico = await empleadosCliente.obtenerHaberVigente(idEmpleado, periodo);
  if (!haberBasico) {
    throw new ErrorApp(409, "El colaborador no tiene un contrato vigente", [
      { campo: "id_empleado", mensaje: "No se puede calcular el bono sin un contrato vigente." },
    ]);
  }

  return {
    id_empleado: idEmpleado,
    periodo,
    anios_servicio: aniosServicio,
    porcentaje: tramo.porcentaje,
    haber_basico: haberBasico,
    monto: redondear(haberBasico * (tramo.porcentaje / 100)),
    id_vigencia_escala: escala.id_vigencia,
  };
}

// KAN-364: el bono como concepto de ingreso en la planilla del periodo, para todos los colaboradores
// activos. Los que no se pueden calcular (sin contrato vigente, sin fecha de ingreso) quedan en "omitidos"
// con el motivo, en vez de interrumpir el cálculo de los demás.
async function calcularBonoPlanilla(periodo) {
  validarPeriodo(periodo);
  const empleados = (await empleadosCliente.listarEmpleados()).filter((e) => e.activo !== false);

  const bonos = [];
  const omitidos = [];
  for (const empleado of empleados) {
    try {
      bonos.push(await calcularBono(empleado.id_empleado, periodo));
    } catch (error) {
      omitidos.push({ id_empleado: empleado.id_empleado, motivo: error.message, codigo: error.codigo });
    }
  }
  return { periodo, bonos, omitidos };
}

module.exports = { listarEscalas, obtenerEscalaVigente, registrarVigencia, calcularBono, calcularBonoPlanilla };
