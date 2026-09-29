import { z } from "zod";

// Esquema ítem educativo
export const EducacionItemSchema = z.object({
  institucion: z.string().min(1, "La institución es requerida"),
  titulo: z.string().min(1, "El título o grado es requerido"),
  anioFin: z.union([z.number().int(), z.string()]).optional().nullable(),
});

// Esquema ítem de experiencia laboral
export const ExperienciaLaboralItemSchema = z.object({
  empresa: z.string().default("No especificada"),
  puesto: z.string().min(1, "El puesto o cargo es requerido"),
  anioInicio: z.union([z.number().int(), z.string()]).optional().nullable(),
  anioFin: z.union([z.number().int(), z.string()]).optional().nullable(),
  esActual: z.boolean().default(false),
});

// Esquema principal columna datos_extraidos_cv
export const DatosExtraidosCvSchema = z.object({
  estadoExtraccion: z.enum(["EXITOSA", "FALLIDA", "PENDIENTE"]),
  educacion: z.array(EducacionItemSchema).default([]),
  experienciaLaboral: z.array(ExperienciaLaboralItemSchema).default([]),
  aniosExperienciaEstimados: z.number().min(0).default(0),
  destrezasTecnicas: z.array(z.string().min(1)).default([]),
  esVerificado: z.boolean().default(false),
  modificadoPor: z.string().uuid().optional().nullable(),
  fechaVerificacion: z.string().datetime().optional().nullable(),
  errorDetalle: z.string().optional().nullable(),
});

// Esquema para el payload de corrección manual desde el frontend
export const ActualizarDatosCvManualSchema = z.object({
  educacion: z.array(EducacionItemSchema).default([]),
  experienciaLaboral: z.array(ExperienciaLaboralItemSchema).default([]),
  aniosExperienciaEstimados: z
    .number()
    .min(0, "Los años de experiencia deben ser >= 0"),
  destrezasTecnicas: z.array(z.string()).default([]),
  modificadoPor: z.string().uuid("ID de usuario inválido"),
});
