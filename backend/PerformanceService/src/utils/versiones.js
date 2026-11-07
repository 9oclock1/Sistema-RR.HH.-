const { ErrorApp } = require("./errores");
const { UUID_RE } = require("./formatos");

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

// Reglas que debe cumplir una versión para publicarse. Cada regla recibe { plantilla, secciones, hoy }
// y devuelve la lista de problemas encontrados ({ campo, mensaje }); vacía si está bien.
// Para exigir algo más (por ejemplo criterios y preguntas) basta con agregar una regla a esta lista.
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
    return [{ campo: "vigencia_hasta", mensaje: `La vigencia terminó el ${plantilla.vigencia_hasta}: actualice las fechas antes de publicar.` }];
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
];

const validarPublicacion = (contexto) => REGLAS_PUBLICACION.flatMap((regla) => regla(contexto));

module.exports = { validarSecciones, validarPublicacion, REGLAS_PUBLICACION, MAX_SECCIONES };
