const DICCIONARIO_DESTREZAS = [
  "JavaScript",
  "TypeScript",
  "Node.js",
  "Express",
  "React",
  "Vue",
  "Angular",
  "Python",
  "FastAPI",
  "Django",
  "Java",
  "Spring Boot",
  "C#",
  ".NET",
  "PostgreSQL",
  "MySQL",
  "MongoDB",
  "Redis",
  "Docker",
  "Git",
  "Linux",
  "HTML",
  "CSS",
  "Tailwind",
  "Figma",
  "AWS",
  "Azure",
  "GCP",
];

export const RegexFallbackProvider = {
  async extract(rawText) {
    // busqueda de destrezas tecnicas concordancia lexica
    const destrezasDetectadas = DICCIONARIO_DESTREZAS.filter((tech) => {
      const regex = new RegExp(`\\b${tech.replace(".", "\\.")}\\b`, "i");
      return regex.test(rawText);
    });

    // estimación de años a partir de la busqueda de rangos numéricos
    const aniosMatches = [
      ...rawText.matchAll(
        /\b(19\d\d|20\d\d)\s*(?:-|a|al|hasta)\s*(19\d\d|20\d\d|presente|actualidad)\b/gi,
      ),
    ];
    let totalAnios = 0;
    const anioActual = new Date().getFullYear();

    aniosMatches.forEach((m) => {
      const inicio = parseInt(m[1], 10);
      const fin = /presente|actualidad/i.test(m[2])
        ? anioActual
        : parseInt(m[2], 10);
      const diff = fin - inicio;
      if (diff > 0 && diff <= 40) {
        totalAnios += diff;
      }
    });

    // extraccion de formacion educacional buscando instituciones
    const educacion = [];
    const eduMatch = rawText.match(
      /(?:Universidad|Instituto|Colegio|Licenciatura|Ingenier[ií]a)[^\n.]+/i,
    );
    if (eduMatch) {
      educacion.push({
        institucion: eduMatch[0].trim(),
        titulo: "Grado académico detectado",
        anioFin: null,
      });
    }

    return {
      educacion,
      aniosExperienciaEstimados: Math.min(totalAnios, 35),
      destrezasTecnicas: destrezasDetectadas,
    };
  },
};
