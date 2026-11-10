const { ErrorApp } = require("./errores");
const { UUID_RE } = require("./formatos");
const { ESTADO_EVALUACION, nombreCompleto } = require("./evaluaciones");
const { promediar } = require("./historialDesempeno");

const AGRUPACIONES = {
  departamento: { id: "id_departamento", nombre: "departamento" },
  sucursal: { id: "id_sucursal", nombre: "sucursal" },
};

const centesimas = (numero) => Math.round(numero * 100);
const aNumero = (centesimasTotales) => centesimasTotales / 100;

// Brecha de productividad: el promedio queda ESTRICTAMENTE por debajo del umbral del ciclo.
// Un promedio igual al umbral no es brecha y un grupo sin evaluaciones enviadas (null) tampoco.
const esBrecha = (puntaje, umbral) =>
  puntaje !== null && centesimas(puntaje) < centesimas(umbral);

// Diferencia con 2 decimales, calculada en centésimas.
const diferencia = (a, b) =>
  a === null || b === null ? null : aNumero(centesimas(a) - centesimas(b));

function validarIdCiclo(idCiclo) {
  const id = typeof idCiclo === "string" ? idCiclo.trim().toLowerCase() : "";
  if (!UUID_RE.test(id)) throw new ErrorApp(404, "Ciclo no encontrado");
  return id;
}

function validarAgrupacion(valor) {
  if (valor === undefined) return "departamento";
  if (!Object.hasOwn(AGRUPACIONES, valor)) {
    throw new ErrorApp(400, "Datos inválidos", [
      { campo: "por", mensaje: "Use «departamento» o «sucursal»." },
    ]);
  }
  return valor;
}

function validarUmbral(datos) {
  const valor = datos?.umbral_brecha;
  const valido =
    typeof valor === "number" &&
    Number.isFinite(valor) &&
    valor >= 0 &&
    valor <= 100 &&
    Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-6;
  if (!valido) {
    throw new ErrorApp(400, "Datos inválidos", [
      {
        campo: "umbral_brecha",
        mensaje: "Debe ser un número entre 0 y 100 con hasta 2 decimales.",
      },
    ]);
  }
  return aNumero(centesimas(valor));
}

// Filtros opcionales del listado de colaboradores: deben ser identificadores válidos.
function validarFiltrosColaboradores({ departamento, sucursal } = {}) {
  const errores = [];
  const leer = (valor, campo) => {
    if (valor === undefined) return null;
    const id = typeof valor === "string" ? valor.trim().toLowerCase() : "";
    if (UUID_RE.test(id)) return id;
    errores.push({ campo, mensaje: "Debe ser un identificador válido." });
    return null;
  };
  const filtros = {
    departamento: leer(departamento, "departamento"),
    sucursal: leer(sucursal, "sucursal"),
  };
  if (errores.length > 0) throw new ErrorApp(400, "Filtros inválidos", errores);
  return filtros;
}

const resumirCrm = (colaboradores) => {
  const conMetricas = colaboradores.filter((c) => c.crm);
  const sumar = (campo) =>
    conMetricas.reduce((total, c) => total + c.crm[campo], 0);
  return {
    colaboradores_con_metricas: conMetricas.length,
    cantidad_quejas: sumar("cantidad_quejas"),
    cantidad_felicitaciones: sumar("cantidad_felicitaciones"),
    // Promedio simple de los promedios de cada colaborador; quien no tuvo casos (null) no cuenta.
    minutos_resolucion_promedio: promediar(
      conMetricas.map((c) => c.crm.minutos_resolucion_promedio),
    ),
  };
};

// Una fila por colaborador evaluado en el ciclo. Quien tiene varios evaluadores aporta UN solo puntaje (el promedio
// de sus evaluaciones enviadas), así nadie pesa el doble en los promedios del área, la sucursal o la competencia.
// filas: evaluaciones del ciclo (cualquier estado). resultados: Map id_evaluacion -> calcularResultado().
// metricas: filas de METRICAS_CRM del ciclo.
function armarColaboradores(filas, resultados, metricas) {
  const porEmpleado = new Map();
  for (const fila of filas) {
    if (!porEmpleado.has(fila.id_empleado)) {
      porEmpleado.set(fila.id_empleado, {
        id_empleado: fila.id_empleado,
        nombre_completo: nombreCompleto({
          nombres: fila.nombres ?? "",
          apellidos: fila.apellidos ?? "",
        }),
        id_departamento: fila.id_departamento,
        departamento: fila.departamento,
        id_sucursal: fila.id_sucursal,
        sucursal: fila.sucursal,
        puntajes: [],
        evaluaciones_vencidas: 0,
        competencias: new Map(),
      });
    }
    const colaborador = porEmpleado.get(fila.id_empleado);
    if (fila.id_estado_evaluacion === ESTADO_EVALUACION.VENCIDA)
      colaborador.evaluaciones_vencidas += 1;
    if (fila.id_estado_evaluacion !== ESTADO_EVALUACION.ENVIADA) continue;

    colaborador.puntajes.push(fila.puntaje_final);
    for (const seccion of resultados.get(fila.id_evaluacion)?.secciones ?? []) {
      if (!colaborador.competencias.has(seccion.id_competencia)) {
        colaborador.competencias.set(seccion.id_competencia, {
          id_competencia: seccion.id_competencia,
          competencia: seccion.competencia,
          puntajes: [],
        });
      }
      colaborador.competencias
        .get(seccion.id_competencia)
        .puntajes.push(seccion.puntaje);
    }
  }

  const crmPorEmpleado = new Map(metricas.map((m) => [m.id_empleado, m]));
  return [...porEmpleado.values()].map(
    ({ puntajes, competencias, ...colaborador }) => {
      const metrica = crmPorEmpleado.get(colaborador.id_empleado);
      return {
        ...colaborador,
        evaluaciones_enviadas: puntajes.length,
        puntaje: promediar(puntajes),
        competencias: [...competencias.values()].map(
          ({ puntajes: valores, ...competencia }) => ({
            ...competencia,
            puntaje: promediar(valores),
          }),
        ),
        crm: metrica
          ? {
              cantidad_quejas: metrica.cantidad_quejas,
              cantidad_felicitaciones: metrica.cantidad_felicitaciones,
              minutos_resolucion_promedio: metrica.minutos_resolucion_promedio,
            }
          : null,
      };
    },
  );
}

// Promedio por competencia entre los colaboradores dados; la más baja primero.
function resumirCompetencias(colaboradores, umbral) {
  const porCompetencia = new Map();
  for (const colaborador of colaboradores) {
    for (const {
      id_competencia: id,
      competencia,
      puntaje,
    } of colaborador.competencias) {
      if (!porCompetencia.has(id))
        porCompetencia.set(id, {
          id_competencia: id,
          competencia,
          puntajes: [],
        });
      porCompetencia.get(id).puntajes.push(puntaje);
    }
  }
  return ordenarPorPuntaje(
    [...porCompetencia.values()].map(({ puntajes, ...competencia }) => {
      const puntaje = promediar(puntajes);
      return { ...competencia, puntaje, es_brecha: esBrecha(puntaje, umbral) };
    }),
  );
}

// De menor a mayor puntaje; los que no tienen puntaje van al final.
function ordenarPorPuntaje(lista) {
  return [...lista].sort((a, b) => {
    if (a.puntaje === null || b.puntaje === null)
      return (a.puntaje === null) - (b.puntaje === null);
    return a.puntaje - b.puntaje;
  });
}

// Áreas o sucursales del ciclo con su promedio, su diferencia con el promedio global y si son brecha.
function resumirGrupos(colaboradores, tipo, umbral, promedioGlobal) {
  const { id: claveId, nombre: claveNombre } = AGRUPACIONES[tipo];
  const grupos = new Map();
  for (const colaborador of colaboradores) {
    const id = colaborador[claveId];
    if (!grupos.has(id))
      grupos.set(id, {
        id,
        nombre: colaborador[claveNombre],
        colaboradores: [],
      });
    grupos.get(id).colaboradores.push(colaborador);
  }

  return ordenarPorPuntaje(
    [...grupos.values()].map(({ colaboradores: miembros, ...grupo }) => {
      const puntaje = promediar(miembros.map((m) => m.puntaje));
      const competencias = resumirCompetencias(miembros, umbral);
      const brecha = esBrecha(puntaje, umbral);
      return {
        ...grupo,
        asignados: miembros.length,
        evaluados: miembros.filter((m) => m.puntaje !== null).length,
        evaluaciones_enviadas: miembros.reduce(
          (total, m) => total + m.evaluaciones_enviadas,
          0,
        ),
        evaluaciones_vencidas: miembros.reduce(
          (total, m) => total + m.evaluaciones_vencidas,
          0,
        ),
        puntaje,
        sin_datos: puntaje === null,
        diferencia_global: diferencia(puntaje, promedioGlobal),
        es_brecha: brecha,
        puntos_bajo_umbral: brecha ? diferencia(umbral, puntaje) : 0,
        competencia_mas_baja:
          competencias.find((c) => c.puntaje !== null) ?? null,
        competencias,
        crm: resumirCrm(miembros),
      };
    }),
  );
}

// Promedio de todos los colaboradores evaluados del ciclo (cada uno cuenta una vez).
const promedioGlobal = (colaboradores) =>
  promediar(colaboradores.map((c) => c.puntaje));

// Datos globales del ciclo: cuántos se evaluaron de los asignados y cuántas áreas o sucursales son brecha.
function resumirCiclo(colaboradores, departamentos, sucursales) {
  const evaluados = colaboradores.filter((c) => c.puntaje !== null).length;
  const suma = (campo) =>
    colaboradores.reduce((total, c) => total + c[campo], 0);
  return {
    promedio_global: promedioGlobal(colaboradores),
    asignados: colaboradores.length,
    evaluados,
    cobertura_porcentual:
      colaboradores.length === 0
        ? null
        : aNumero(Math.round((evaluados * 10000) / colaboradores.length)),
    evaluaciones_enviadas: suma("evaluaciones_enviadas"),
    evaluaciones_vencidas: suma("evaluaciones_vencidas"),
    departamentos_en_brecha: departamentos.filter((g) => g.es_brecha).length,
    sucursales_en_brecha: sucursales.filter((g) => g.es_brecha).length,
  };
}

// Colaboradores filtrados por área y sucursal; el de menor puntaje primero y quienes no tienen puntaje al final.
function listarColaboradores(
  colaboradores,
  { departamento, sucursal },
  umbral,
) {
  return ordenarPorPuntaje(
    colaboradores
      .filter(
        (c) =>
          (!departamento || c.id_departamento === departamento) &&
          (!sucursal || c.id_sucursal === sucursal),
      )
      .map((c) => ({ ...c, bajo_umbral: esBrecha(c.puntaje, umbral) })),
  );
}

module.exports = {
  AGRUPACIONES,
  esBrecha,
  diferencia,
  validarIdCiclo,
  validarAgrupacion,
  validarUmbral,
  validarFiltrosColaboradores,
  armarColaboradores,
  promedioGlobal,
  resumirCompetencias,
  resumirGrupos,
  resumirCiclo,
  resumirCrm,
  listarColaboradores,
};
