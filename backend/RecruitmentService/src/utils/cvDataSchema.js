import { z } from "zod";

// esquema ítem educativo
const EducacionItemSchema = z.object({
  institucion: z.string().min(1, "La institución es requerida"),
  titulo: z.string().min(1, "El título o grado es requerido"),
  anioFin: z.union([z.number().int(), z.string()]).optional().nullable(),
});

// esquema principal columna datos_extraidos_cv
const DatosExtraidosCvSchema = z.object({
  estadoExtraccion: z.enum(["EXITOSA", "FALLIDA", "PENDIENTE"]),
  educacion: z.array(EducacionItemSchema).default([]),
  aniosExperienciaEstimados: z.number().min(0).default(0),
  destrezasTecnicas: z.array(z.string().min(1)).default([]),
  esVerificado: z.boolean().default(false),
  modificadoPor: z.string().uuid().optional().nullable(),
  fechaVerificacion: z.string().datetime().optional().nullable(),
  errorDetalle: z.string().optional().nullable(),
});

// esquema para el payload corrección manual
const ActualizarDatosCvManualSchema = z.object({
  educacion: z.array(EducacionItemSchema),
  aniosExperienciaEstimados: z
    .number()
    .min(0, "Los años de experiencia deben ser >= 0"),
  destrezasTecnicas: z.array(z.string()),
  modificadoPor: z.string().uuid("ID de usuario inválido"),
});

module.exports = {
  DatosExtraidosCvSchema,
  ActualizarDatosCvManualSchema,
};
