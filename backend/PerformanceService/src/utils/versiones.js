const { ErrorApp } = require("./errores");
const { UUID_RE } = require("./formatos");
const { balancePesos, describirDesbalance } = require("./ponderacion");
const { validarPlantilla } = require("./validarPlantilla");

const MAX_SECCIONES = 30;

// Cuerpo de PUT .../secciones: { secciones: [{ id_competencia }] }. El orden de la lista es el orden de las secciones.
function validarSecciones(cuerpo) {
  const lista = cuerpo?.secciones;
  if (!Array.isArray(lista))
    throw new ErrorApp(400, "Datos inválidos", [
      { campo: "secciones", mensaje: "Debe enviar la lista de secciones." },
    ]);
  if (lista.length > MAX_SECCIONES)
    throw new ErrorApp(400, "Datos inválidos", [
      { campo: "secciones", mensaje: `Una plantilla admite hasta ${MAX_SECCIONES} secciones.` },
    ]);

  const errores = [];
  const vistas = new Set();
  const competencias = [];

  lista.forEach((item, posicion) => {
    const campo = `secciones[${posicion}].id_competencia`;
    const id = typeof item?.id_competencia === "string" ? item.id_competencia.toLowerCase() : "";
    if (!UUID_RE.test(id)) {
      errores.push({ campo, mensaje: "La competencia debe ser un identificador válido." });
      return;
    }
    if (vistas.has(id)) {
      errores.push({ campo, mensaje: "La competencia está repetida en la plantilla." });
      return;
    }
    vistas.add(id);
    competencias.push(id);
  });

  if (errores.length > 0) throw new ErrorApp(400, "Datos inválidos", errores);
  return competencias;
}

// Cuerpo de PUT .../estructura: { secciones: [{ id_competencia, criterios: [{ nombre, descripcion, preguntas: [...] }] }] }.
// Reemplaza la estructura completa del borrador. La suma de pesos no se exige aquí: un borrador puede guardarse
// desbalanceado y el balance se controla al publicar.
function validarEstructura(cuerpo) {
  if (!Array.isArray(cuerpo?.secciones))
    throw new ErrorApp(400, "Datos inválidos", [{ campo: "secciones", mensaje: "Debe enviar la lista de secciones." }]);
  return validarPlantilla({ secciones: cuerpo.secciones }, { conDatosBase: false });
}

// Reglas que debe cumplir una versión para publicarse. Cada regla recibe { plantilla, secciones, hoy }
// y devuelve la lista de problemas encontrados ({ campo, mensaje }); vacía si está bien.
// Para exigir algo más basta con agregar una regla a esta lista.
const REGLAS_PUBLICACION = [
  function cabeceraCompleta({ plantilla }) {
    const problemas = [];
    if (!plantilla.nombre?.trim()) problemas.push({ campo: "nombre", mensaje: "El nombre de la plantilla está vacío." });
    if (!plantilla.objetivo?.trim()) problemas.push({ campo: "objetivo", mensaje: "El objetivo de la plantilla está vacío." });
    if (!plantilla.id_departamento)
      problemas.push({ campo: "id_departamento", mensaje: "La plantilla no tiene área destino." });
    return problemas;
  },
  function vigenciaNoTerminada({ plantilla, hoy }) {
    if (plantilla.vigencia_hasta >= hoy) return [];
    const salida = plantilla.fue_publicada
      ? "los datos base ya no se pueden cambiar: cree una plantilla nueva con una vigencia vigente."
      : "actualice las fechas antes de publicar.";
    return [{ campo: "vigencia_hasta", mensaje: `La vigencia terminó el ${plantilla.vigencia_hasta}: ${salida}` }];
  },
  function conSecciones({ secciones }) {
    if (secciones.length > 0) return [];
    return [{ campo: "secciones", mensaje: "Agregue al menos una sección de competencia o factor operativo." }];
  },
  function competenciasActivas({ secciones }) {
    return secciones
      .filter((seccion) => !seccion.competencia.esta_activa)
      .map((seccion) => ({
        campo: "secciones",
        mensaje: `La competencia "${seccion.competencia.nombre}" está desactivada: quítela o reemplácela.`,
      }));
  },
  function criteriosYPreguntas({ secciones }) {
    const problemas = [];
    for (const seccion of secciones) {
      const criterios = seccion.criterios ?? [];
      const nombre = seccion.competencia.nombre;
      if (criterios.length === 0) {
        problemas.push({ campo: "criterios", mensaje: `La sección «${nombre}» no tiene criterios: agregue al menos uno.` });
        continue;
      }
      for (const criterio of criterios) {
        if (criterio.preguntas.length === 0)
          problemas.push({
            campo: "preguntas",
            mensaje: `El criterio «${criterio.nombre}» de la sección «${nombre}» no tiene preguntas: agregue al menos una.`,
          });
      }
    }
    return problemas;
  },
  function pesosSuman100({ secciones }) {
    const conCriterios = secciones.map((seccion) => ({ criterios: seccion.criterios ?? [] }));
    const hayPreguntas = conCriterios.some((s) => s.criterios.some((c) => c.preguntas.length > 0));
    if (!hayPreguntas) return [];
    const balance = balancePesos(conCriterios);
    return balance.balanceado ? [] : [{ campo: "peso_porcentual", mensaje: describirDesbalance(balance) }];
  },
];

const validarPublicacion = (contexto) => REGLAS_PUBLICACION.flatMap((regla) => regla(contexto));

module.exports = { validarSecciones, validarEstructura, validarPublicacion, REGLAS_PUBLICACION, MAX_SECCIONES };
