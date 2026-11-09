// Reglas de bono por productividad (RF-51, KAN-71) y el mensaje de cierre de ventas del periodo que publica
// Ventas y Marketing (grupo E, projects/project-a96e5fe1-5ba6-4698-a85/topics/ucb-sis323-sub-e) para RRHH
// (grupo F). El formato del sobre (encabezado/datos) es el mismo que usan los demás módulos del ERP (ver
// EmployeeService/comprasPubSubService y AttendanceService/utils/eventos); el esquema de "datos" está
// documentado en db/aclaracion.md.
const { ErrorApp } = require("./errores");
const { UUID_RE } = require("./formatos");

const TIPOS_META = ["VENTAS", "PUNTUALIDAD", "DESEMPENO_CAJA"];
const FORMAS_CALCULO = ["MONTO_FIJO", "PORCENTAJE"];
const ROLES_META = ["VENDEDOR", "CAJERO"];
const PERIODO_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const GRUPO_VENTAS = "E";
const GRUPO_RRHH = "F";
const TIPO_EVENTO_CIERRE_VENTAS = "CIERRE_VENTAS_PERIODO";
const MAXIMO_METRICAS_POR_EVENTO = 500;

// Un mensaje que no se arregla reintentando (JSON inválido, datos fuera de rango) queda FALLIDO sin reintentar
// más; uno que falla por un error pasajero (la base, por ejemplo) se reintenta hasta este tope.
const MAXIMO_INTENTOS_ENTRADA = 5;
const esperaNuevaEntrega = (intentos) => Math.min(1000 * 2 ** intentos, 60 * 1000);

function periodoAFecha(periodo) {
  if (typeof periodo !== "string" || !PERIODO_RE.test(periodo)) return null;
  return `${periodo}-01`;
}

function validarRegla(datos = {}) {
  const errores = [];
  const periodo = periodoAFecha(datos.periodo);
  if (!periodo) errores.push({ campo: "periodo", mensaje: "Use el formato AAAA-MM." });

  if (!TIPOS_META.includes(datos.tipo_meta)) {
    errores.push({ campo: "tipo_meta", mensaje: "Seleccione ventas, puntualidad o desempeño en caja." });
  }

  const umbral = Number(datos.umbral_cumplimiento);
  if (!Number.isFinite(umbral) || umbral <= 0 || umbral > 1000) {
    errores.push({ campo: "umbral_cumplimiento", mensaje: "Ingrese un porcentaje mayor a 0 y hasta 1000." });
  }

  if (!FORMAS_CALCULO.includes(datos.forma_calculo)) {
    errores.push({ campo: "forma_calculo", mensaje: "Use MONTO_FIJO o PORCENTAJE." });
  }

  const valor = Number(datos.valor);
  if (!Number.isFinite(valor) || valor <= 0) {
    errores.push({ campo: "valor", mensaje: "Ingrese un valor mayor a 0." });
  }

  if (errores.length > 0) throw new ErrorApp(400, "Datos de la regla inválidos", errores);
  return { periodo, tipo_meta: datos.tipo_meta, umbral_cumplimiento: umbral, forma_calculo: datos.forma_calculo, valor };
}

// El periodo y el tipo de meta identifican la regla (son su clave): no se pueden cambiar después de crearla,
// solo el umbral y el valor del bono.
function validarEdicionRegla(datos = {}, actual) {
  const errores = [];
  for (const campo of ["periodo", "tipo_meta"]) {
    const nuevo = campo === "periodo" ? periodoAFecha(datos.periodo) : datos[campo];
    if (datos[campo] !== undefined && nuevo !== actual[campo]) {
      errores.push({ campo, mensaje: "No se puede cambiar después de crear la regla." });
    }
  }
  const umbral = datos.umbral_cumplimiento === undefined ? actual.umbral_cumplimiento : Number(datos.umbral_cumplimiento);
  if (!Number.isFinite(umbral) || umbral <= 0 || umbral > 1000) {
    errores.push({ campo: "umbral_cumplimiento", mensaje: "Ingrese un porcentaje mayor a 0 y hasta 1000." });
  }
  const forma = datos.forma_calculo === undefined ? actual.forma_calculo : datos.forma_calculo;
  if (!FORMAS_CALCULO.includes(forma)) errores.push({ campo: "forma_calculo", mensaje: "Use MONTO_FIJO o PORCENTAJE." });
  const valor = datos.valor === undefined ? actual.valor : Number(datos.valor);
  if (!Number.isFinite(valor) || valor <= 0) errores.push({ campo: "valor", mensaje: "Ingrese un valor mayor a 0." });

  if (errores.length > 0) throw new ErrorApp(400, "Datos de la regla inválidos", errores);
  return { umbral_cumplimiento: umbral, forma_calculo: forma, valor };
}

// Solo nos interesan los mensajes de Ventas dirigidos a RRHH con el tipo de cierre de periodo: los demás
// mensajes del tópico (si lo comparte otro módulo) se marcan IGNORADO sin tocar nada.
function esEventoVentas(cuerpo) {
  const encabezado = cuerpo?.encabezado;
  return Boolean(
    encabezado && encabezado.destino?.grupo === GRUPO_RRHH && encabezado.tipo === TIPO_EVENTO_CIERRE_VENTAS
  );
}

const numeroValido = (valor, { permiteCero = false } = {}) =>
  typeof valor === "number" && Number.isFinite(valor) && (permiteCero ? valor >= 0 : valor > 0);

function leerMetrica(m, i) {
  const errores = [];
  const prefijo = `datos.metricas[${i}]`;
  if (!UUID_RE.test(m?.id_empleado ?? "")) errores.push(`${prefijo}.id_empleado debe ser un UUID.`);
  if (!ROLES_META.includes(m?.rol)) errores.push(`${prefijo}.rol debe ser VENDEDOR o CAJERO.`);
  if (!numeroValido(m?.monto_ventas, { permiteCero: true })) errores.push(`${prefijo}.monto_ventas debe ser un número mayor o igual a 0.`);
  if (!numeroValido(m?.cuota_asignada)) errores.push(`${prefijo}.cuota_asignada debe ser un número mayor a 0.`);
  if (errores.length > 0) return { errores };
  const cumplimiento = Math.round((m.monto_ventas / m.cuota_asignada) * 10000) / 100;
  return {
    id_empleado: m.id_empleado.toLowerCase(),
    rol: m.rol,
    monto_ventas: m.monto_ventas,
    cuota_asignada: m.cuota_asignada,
    porcentaje_cumplimiento: cumplimiento,
  };
}

// Devuelve { errores } si el mensaje completo no se puede aplicar (sobre inválido, periodo inválido, sin
// metricas), o { periodo, metricas, omitidos } si al menos un colaborador es válido. Un dato inválido o
// repetido en UN colaborador no descarta a los demás (criterio de resiliencia, RF-51): esa fila queda en
// "omitidos" con el motivo, igual que calcularBonoPlanilla hace con los colaboradores sin contrato vigente.
function leerEventoVentas(cuerpo) {
  const { encabezado, datos } = cuerpo;
  const errores = [];
  if (encabezado.origen?.grupo !== GRUPO_VENTAS) {
    errores.push(`El tipo ${encabezado.tipo} solo lo envía el grupo ${GRUPO_VENTAS} (Ventas y Marketing).`);
  }
  if (!datos || typeof datos !== "object") {
    errores.push("Falta el bloque datos.");
    return { errores };
  }
  const periodo = periodoAFecha(datos.periodo);
  if (!periodo) errores.push("datos.periodo debe tener el formato AAAA-MM.");
  const metricas = Array.isArray(datos.metricas) ? datos.metricas : null;
  if (!metricas || metricas.length === 0) errores.push("datos.metricas debe ser una lista con al menos un elemento.");
  else if (metricas.length > MAXIMO_METRICAS_POR_EVENTO) {
    errores.push(`datos.metricas admite hasta ${MAXIMO_METRICAS_POR_EVENTO} colaboradores por mensaje.`);
  }
  if (errores.length > 0) return { errores };

  const vistos = new Set();
  const validas = [];
  const omitidos = [];
  metricas.forEach((m, i) => {
    const leida = leerMetrica(m, i);
    if (leida.errores) {
      omitidos.push({ indice: i, id_empleado: typeof m?.id_empleado === "string" ? m.id_empleado : null, motivo: leida.errores.join(" ") });
      return;
    }
    if (vistos.has(leida.id_empleado)) {
      omitidos.push({ indice: i, id_empleado: leida.id_empleado, motivo: "Colaborador repetido en el mismo mensaje: se usó su primera aparición." });
      return;
    }
    vistos.add(leida.id_empleado);
    validas.push(leida);
  });

  if (validas.length === 0) {
    return { errores: omitidos.map((o) => `datos.metricas[${o.indice}]: ${o.motivo}`) };
  }
  return { periodo, metricas: validas, omitidos };
}

// Monto del bono cuando la regla es de monto fijo; en porcentaje lo calcula la planilla sobre el haber básico
// (igual que BONOS_CONDICION), porque este servicio no conoce el haber del colaborador al procesar el periodo.
function montoDeRegla(regla) {
  return regla.forma_calculo === "MONTO_FIJO" ? Number(regla.valor) : null;
}

// RF-51, criterio 3: solo se asigna el bono a quienes superan el umbral de la regla de su tipo de meta.
function cumpleUmbral(regla, metrica) {
  return metrica.porcentaje_cumplimiento >= Number(regla.umbral_cumplimiento);
}

module.exports = {
  TIPOS_META,
  FORMAS_CALCULO,
  ROLES_META,
  GRUPO_VENTAS,
  GRUPO_RRHH,
  TIPO_EVENTO_CIERRE_VENTAS,
  MAXIMO_INTENTOS_ENTRADA,
  esperaNuevaEntrega,
  periodoAFecha,
  validarRegla,
  validarEdicionRegla,
  esEventoVentas,
  leerEventoVentas,
  montoDeRegla,
  cumpleUmbral,
};
