const { z } = require("zod");

const AnioFlexible = z
  .union([z.number().int(), z.string(), z.null(), z.undefined()])
  .transform((val) => {
    if (val === null || val === undefined || val === "") return null;
    const num = Number(val);
    return isNaN(num) ? null : num;
  });

// Esquema ítem educativo
const EducacionItemSchema = z.object({
  institucion: z.string().min(1, "La institución es requerida"),
  titulo: z.string().min(1, "El título o grado es requerido"),
  anioFin: AnioFlexible.optional(),
});

// Esquema ítem experiencia laboral
const ExperienciaLaboralItemSchema = z.object({
  puesto: z.string().min(1, "El puesto o cargo es requerido"),
  empresa: z.string().optional().nullable().default("No especificada"),
  anioInicio: AnioFlexible.optional(),
  anioFin: AnioFlexible.optional(),
  esActual: z.boolean().default(false),
});

// Configuración de pesos de evaluación (deben sumar 100%)
const PesosAfinidadSchema = z
  .object({
    pesoEducacion: z.number().min(0).max(100).default(25),
    pesoExperiencia: z.number().min(0).max(100).default(35),
    pesoHabilidades: z.number().min(0).max(100).default(40),
  })
  .refine(
    (data) =>
      Math.round(
        data.pesoEducacion + data.pesoExperiencia + data.pesoHabilidades,
      ) === 100,
    { message: "La suma de los pesos de evaluación debe ser exactamente 100%" },
  );

// Esquema de desglose comparativo de afinidad (RF-12)
const DesgloseAfinidadSchema = z.object({
  porcentajeTotal: z.number().min(0).max(100),
  esApto: z.boolean(),
  motivosNoApto: z.array(z.string()).default([]),
  educacion: z.object({
    nivelRequerido: z.string(),
    nivelDetectado: z.string(),
    enCurso: z.boolean().optional(),
    cumple: z.boolean(),
    porcentajeObtenido: z.number().min(0).max(100),
    pesoAsignado: z.number(),
    puntosAportados: z.number(),
  }),
  experiencia: z.object({
    aniosRequeridos: z.number(),
    aniosDetectados: z.number(),
    cumple: z.boolean(),
    porcentajeObtenido: z.number().min(0).max(100),
    pesoAsignado: z.number(),
    puntosAportados: z.number(),
  }),
  habilidades: z.object({
    totalRequeridas: z.number(),
    totalCumplidas: z.number(),
    totalParciales: z.number().optional(),
    cumplidas: z.array(
      z.object({
        habilidadRequerida: z.string(),
        habilidadCoincidente: z.string(),
        similitud: z.number(),
      }),
    ),
    incumplidas: z.array(z.string()),
    habilidadesExtraCandidato: z.array(z.string()),
    porcentajeObtenido: z.number().min(0).max(100),
    pesoAsignado: z.number(),
    puntosAportados: z.number(),
  }),
  fechaCalculo: z.string(),
});

// Esquema principal columna datos_extraidos_cv
const DatosExtraidosCvSchema = z.object({
  estadoExtraccion: z.enum(["EXITOSA", "FALLIDA", "PENDIENTE"]),
  educacion: z.array(EducacionItemSchema).default([]),
  experienciaLaboral: z.array(ExperienciaLaboralItemSchema).default([]),
  aniosExperienciaEstimados: z.number().min(0).default(0),
  destrezasTecnicas: z.array(z.string().min(1)).default([]),
  esVerificado: z.boolean().default(false),
  modificadoPor: z.string().optional().nullable(),
  fechaVerificacion: z.string().optional().nullable(),
  errorDetalle: z.string().optional().nullable(),
  afinidadDetalle: DesgloseAfinidadSchema.optional().nullable(),
});

// Esquema para el payload de corrección manual
const ActualizarDatosCvManualSchema = z.object({
  educacion: z.array(EducacionItemSchema).default([]),
  experienciaLaboral: z.array(ExperienciaLaboralItemSchema).default([]),
  aniosExperienciaEstimados: z
    .number()
    .min(0, "Los años de experiencia deben ser >= 0"),
  destrezasTecnicas: z.array(z.string()).default([]),
  modificadoPor: z.string().optional().nullable(),
});

module.exports = {
  EducacionItemSchema,
  ExperienciaLaboralItemSchema,
  PesosAfinidadSchema,
  DesgloseAfinidadSchema,
  DatosExtraidosCvSchema,
  ActualizarDatosCvManualSchema,
};
