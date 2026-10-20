const { ErrorApp } = require("./errores");
const { esFechaValida, sumarDias } = require("./periodos");

// KAN-55 (RF-35): calendario consolidado de ausencias aprobadas y detección de baja cobertura.

// Cabe un trimestre: la vista mensual pide hasta 6 semanas y el supervisor puede mirar unos días más allá.
const DIAS_MAXIMOS = 92;

// Mientras RRHH no configure un umbral para el área, se tolera hasta este porcentaje de ausentes y se exige este mínimo.
const UMBRAL_PREDETERMINADO = { max_ausentes_porcentaje: 30, min_presentes: 1 };

const SIN_ID = "00000000-0000-0000-0000-000000000000";

// Tipos de ausencia con un código estable para el color del calendario. Los de licencia salen de CATALOGOS_TIPO_LICENCIA.
const TIPOS = [
  { codigo: "VACACIONES", nombre: "Vacaciones", categoria: "VACACIONES" },
  { codigo: "MEDICA", nombre: "Licencia médica", categoria: "LICENCIA" },
  { codigo: "MATERNIDAD", nombre: "Maternidad", categoria: "LICENCIA" },
  { codigo: "PATERNIDAD", nombre: "Paternidad", categoria: "LICENCIA" },
  { codigo: "DUELO", nombre: "Duelo", categoria: "LICENCIA" },
  { codigo: "ACADEMICA", nombre: "Académica", categoria: "LICENCIA" },
  { codigo: "PERSONAL", nombre: "Permiso personal", categoria: "LICENCIA" },
];

const diasEntre = (desde, hasta) => Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000);
const esFinDeSemana = (fecha) => [0, 6].includes(new Date(`${fecha}T00:00:00Z`).getUTCDay());

const primerDiaDelMes = (hoy) => `${hoy.slice(0, 8)}01`;
function ultimoDiaDelMes(hoy) {
  const [anio, mes] = hoy.split("-").map(Number);
  return new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10);
}

// Rango de la consulta: por defecto, el mes en curso.
function leerRango({ desde, hasta } = {}, hoy) {
  const inicio = desde || primerDiaDelMes(hoy);
  // Un `desde` inválido se informa abajo; no se intenta sumarle días.
  const fin = hasta || (desde ? (esFechaValida(desde) ? sumarDias(desde, 30) : desde) : ultimoDiaDelMes(hoy));
  const errores = [];
  if (!esFechaValida(inicio)) errores.push({ campo: "desde", mensaje: "Use el formato AAAA-MM-DD." });
  if (!esFechaValida(fin)) errores.push({ campo: "hasta", mensaje: "Use el formato AAAA-MM-DD." });
  if (errores.length === 0) {
    if (inicio > fin) errores.push({ campo: "desde", mensaje: "La fecha inicial no puede ser posterior a la final." });
    else if (diasEntre(inicio, fin) + 1 > DIAS_MAXIMOS) {
      errores.push({ campo: "hasta", mensaje: `Consulte como máximo ${DIAS_MAXIMOS} días.` });
    }
  }
  if (errores.length > 0) throw new ErrorApp(400, "Rango de fechas inválido", errores);
  return { desde: inicio, hasta: fin };
}

// Umbral que rige para un área en una sucursal: gana el más específico (sucursal y área, luego solo área,
// luego solo sucursal, luego el general) y, sin ninguno, el predeterminado.
function resolverUmbral(umbrales, idSucursal, idDepartamento) {
  const coincide = (u, suc, dep) => (u.id_sucursal ?? null) === suc && (u.id_departamento ?? null) === dep;
  const candidatos = [
    [idSucursal ?? null, idDepartamento ?? null],
    [null, idDepartamento ?? null],
    [idSucursal ?? null, null],
    [null, null],
  ];
  for (const [suc, dep] of candidatos) {
    const umbral = umbrales.find((u) => coincide(u, suc, dep));
    if (umbral) {
      return {
        max_ausentes_porcentaje: umbral.max_ausentes_porcentaje,
        min_presentes: umbral.min_presentes,
        origen: suc && dep ? "SUCURSAL_Y_AREA" : dep ? "AREA" : suc ? "SUCURSAL" : "GENERAL",
      };
    }
  }
  return { ...UMBRAL_PREDETERMINADO, origen: "PREDETERMINADO" };
}

function validarUmbral({ id_sucursal, id_departamento, max_ausentes_porcentaje, min_presentes } = {}) {
  const errores = [];
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  for (const [campo, valor] of [["id_sucursal", id_sucursal], ["id_departamento", id_departamento]]) {
    if (valor && !uuid.test(valor)) errores.push({ campo, mensaje: "Identificador inválido." });
  }
  const maximo = Number(max_ausentes_porcentaje);
  if (!Number.isInteger(maximo) || maximo < 1 || maximo > 100) {
    errores.push({ campo: "max_ausentes_porcentaje", mensaje: "Ingrese un porcentaje entero entre 1 y 100." });
  }
  const minimo = min_presentes === undefined || min_presentes === "" ? UMBRAL_PREDETERMINADO.min_presentes : Number(min_presentes);
  if (!Number.isInteger(minimo) || minimo < 0 || minimo > 999) {
    errores.push({ campo: "min_presentes", mensaje: "Ingrese un número entero de personas, de 0 en adelante." });
  }
  if (errores.length > 0) throw new ErrorApp(400, "Umbral de cobertura inválido", errores);
  return {
    idSucursal: id_sucursal ? id_sucursal.toLowerCase() : null,
    idDepartamento: id_departamento ? id_departamento.toLowerCase() : null,
    maxAusentesPorcentaje: maximo,
    minPresentes: minimo,
  };
}

// Un día se trabaja si el rol publicado dice que se trabaja; sin turno publicado, de lunes a viernes salvo feriados.
function trabajaEseDia(fecha, turnoPublicado, feriado) {
  if (turnoPublicado !== undefined) return !turnoPublicado.es_descanso;
  return !esFinDeSemana(fecha) && !feriado;
}

const AREA_SIN_DATO = "sin-area";

// Cobertura día por día (criterio 3). Para cada área se cuenta a quienes deben trabajar ese día (`programados`)
// y cuántos de ellos están ausentes con una ausencia aprobada; hay alerta si se supera el porcentaje tolerado o
// quedan menos presentes que el mínimo.
// personal: [{ id_empleado, id_departamento, area, activo }]. ausencias: aprobadas, con fecha_inicio y fecha_fin.
// turnos: [{ id_empleado, fecha, es_descanso }]. feriados: [{ fecha, nombre }].
function calcularDias({ desde, hasta, idSucursal = null, personal, ausencias, turnos = [], feriados = [], umbrales = [] }) {
  const activos = personal.filter((p) => p.activo);
  const areaDe = (p) => p.id_departamento ?? AREA_SIN_DATO;
  const porArea = new Map();
  for (const p of activos) {
    if (!porArea.has(areaDe(p))) porArea.set(areaDe(p), { id_departamento: p.id_departamento ?? null, area: p.area ?? "Sin área", empleados: [] });
    porArea.get(areaDe(p)).empleados.push(p.id_empleado);
  }
  const umbralDe = new Map([...porArea].map(([clave, area]) => [clave, resolverUmbral(umbrales, idSucursal, area.id_departamento)]));

  const feriadoDe = new Map(feriados.map((f) => [f.fecha, f.nombre]));
  const turnoDe = new Map(turnos.map((t) => [`${t.id_empleado}|${t.fecha}`, t]));
  const porEmpleado = new Map();
  for (const ausencia of ausencias) {
    const id = ausencia.empleado.id_empleado;
    if (!porEmpleado.has(id)) porEmpleado.set(id, []);
    porEmpleado.get(id).push(ausencia);
  }

  const dias = [];
  const total = diasEntre(desde, hasta);
  for (let i = 0; i <= total; i++) {
    const fecha = sumarDias(desde, i);
    const feriado = feriadoDe.get(fecha) ?? null;
    const ausentesDelDia = new Set();
    for (const [id, lista] of porEmpleado) {
      if (lista.some((a) => a.fecha_inicio <= fecha && a.fecha_fin >= fecha)) ausentesDelDia.add(id);
    }

    const alertas = [];
    let laborable = false;
    for (const [clave, area] of porArea) {
      const programados = area.empleados.filter((id) => trabajaEseDia(fecha, turnoDe.get(`${id}|${fecha}`), feriado));
      if (programados.length === 0) continue;
      laborable = true;
      const ausentes = programados.filter((id) => ausentesDelDia.has(id)).length;
      if (ausentes === 0) continue;
      const presentes = programados.length - ausentes;
      const porcentaje = Math.round((ausentes / programados.length) * 1000) / 10;
      const umbral = umbralDe.get(clave);
      const motivos = [];
      if (porcentaje > umbral.max_ausentes_porcentaje) motivos.push("PORCENTAJE");
      if (presentes < umbral.min_presentes) motivos.push("MINIMO_PRESENTES");
      if (motivos.length > 0) {
        alertas.push({
          id_departamento: area.id_departamento,
          area: area.area,
          programados: programados.length,
          ausentes,
          presentes,
          porcentaje_ausentes: porcentaje,
          max_ausentes_porcentaje: umbral.max_ausentes_porcentaje,
          min_presentes: umbral.min_presentes,
          motivos,
        });
      }
    }
    dias.push({
      fecha,
      laborable: laborable || (activos.length === 0 && !esFinDeSemana(fecha) && !feriado),
      feriado,
      ausentes: ausentesDelDia.size,
      baja_cobertura: alertas.length > 0,
      alertas,
    });
  }
  return dias;
}

module.exports = {
  DIAS_MAXIMOS,
  UMBRAL_PREDETERMINADO,
  SIN_ID,
  TIPOS,
  leerRango,
  resolverUmbral,
  validarUmbral,
  calcularDias,
};
