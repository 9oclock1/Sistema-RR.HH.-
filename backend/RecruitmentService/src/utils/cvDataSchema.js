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

module.exports = { EducacionItemSchema, ExperienciaLaboralItemSchema, DatosExtraidosCvSchema, ActualizarDatosCvManualSchema };
