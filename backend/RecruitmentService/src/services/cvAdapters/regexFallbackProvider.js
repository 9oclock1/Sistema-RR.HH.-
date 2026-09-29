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
  "Liderazgo",
  "Comunicación asertiva",
  "Gestión de activos",
  "Resolución de problemas",
  "Elaboración de reportes",
  "Trabajo en equipo",
];

export const RegexFallbackProvider = {
  async extract(rawText) {
    // Destrezas
    const destrezasDetectadas = DICCIONARIO_DESTREZAS.filter((tech) => {
      const regex = new RegExp(`\\b${tech.replace(".", "\\.")}\\b`, "i");
      return regex.test(rawText);
    });

    // Experiencias basadas en rangos de fechas
    const aniosMatches = [
      ...rawText.matchAll(
        /\b(19\d\d|20\d\d)\s*(?:-|a|al|hasta)\s*(19\d\d|20\d\d|presente|actualidad)\b/gi,
      ),
    ];

    const experienciaLaboral = [];
    aniosMatches.forEach((m, idx) => {
      const inicio = parseInt(m[1], 10);
      const esActual = /presente|actualidad/i.test(m[2]);
      const fin = esActual ? null : parseInt(m[2], 10);

      experienciaLaboral.push({
        puesto: `Experiencia detectada #${idx + 1}`,
        empresa: "No especificada",
        anioInicio: inicio,
        anioFin: fin,
        esActual,
      });
    });

    // Educación
    const educacion = [];
    const eduMatch = rawText.match(
      /(?:Universidad|Instituto|Colegio|Licenciatura|Ingenier[ií]a|Maestr[ií]a)[^\n.]+/gi,
    );
    if (eduMatch) {
      eduMatch.slice(0, 3).forEach((item) => {
        educacion.push({
          institucion: item.trim(),
          titulo: "Grado académico detectado",
          anioFin: null,
        });
      });
    }

    return {
      educacion,
      experienciaLaboral,
      destrezasTecnicas: destrezasDetectadas,
    };
  },
};
