/**
 * Validation Middleware for RF-09: Applicant Registration
 *
 * Validates required fields before the controller processes the request.
 * Returns specific field-level error messages so the frontend can highlight
 * exactly which data is missing (acceptance criteria #3).
 */

/**
 * Validates the request body for applicant registration.
 * Required fields per POSTULANTES schema + id_convocatoria for association.
 */
function validateApplicantRegistration(req, res, next) {
  const errors = [];

  const requiredFields = [
    {
      field: "id_convocatoria",
      label: "Convocatoria",
      message: "Debe seleccionar una convocatoria activa.",
    },
    {
      field: "numero_documento",
      label: "Número de documento",
      message: "El número de documento es obligatorio.",
    },
    {
      field: "nombres",
      label: "Nombres",
      message: "Los nombres del postulante son obligatorios.",
    },
    {
      field: "apellidos",
      label: "Apellidos",
      message: "Los apellidos del postulante son obligatorios.",
    },
    {
      field: "correo_electronico",
      label: "Correo electrónico",
      message: "El correo electrónico es obligatorio.",
    },
    {
      field: "telefono_contacto",
      label: "Teléfono de contacto",
      message: "El teléfono de contacto es obligatorio.",
    },
  ];

  for (const { field, label, message } of requiredFields) {
    const value = req.body[field];
    if (!value || (typeof value === "string" && value.trim() === "")) {
      errors.push({ field, label, message });
    }
  }

  // Validate UUID format for id_convocatoria if provided
  if (req.body.id_convocatoria) {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(String(req.body.id_convocatoria).trim())) {
      errors.push({
        field: "id_convocatoria",
        label: "Convocatoria",
        message: "El identificador de la convocatoria no es válido.",
      });
    }
  }

  // Validate email format if provided
  if (req.body.correo_electronico) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(req.body.correo_electronico).trim())) {
      errors.push({
        field: "correo_electronico",
        label: "Correo electrónico",
        message: "El formato del correo electrónico no es válido.",
      });
    }
  }

  // Validate document number length
  if (req.body.numero_documento !== undefined && req.body.numero_documento !== null && req.body.numero_documento !== "") {
    const doc = String(req.body.numero_documento).trim();
    if (doc.length < 5 || doc.length > 20) {
      errors.push({
        field: "numero_documento",
        label: "Número de documento",
        message:
          "El número de documento debe tener entre 5 y 20 caracteres.",
      });
    }
  }

  // Validate phone format (basic — at least 7 digits)
  if (req.body.telefono_contacto !== undefined && req.body.telefono_contacto !== null && req.body.telefono_contacto !== "") {
    const phone = String(req.body.telefono_contacto).trim().replace(/[\s\-\+\(\)]/g, "");
    if (phone.length < 7 || phone.length > 20) {
      errors.push({
        field: "telefono_contacto",
        label: "Teléfono de contacto",
        message:
          "El teléfono de contacto debe tener entre 7 y 20 dígitos.",
      });
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Faltan campos obligatorios o contienen datos inválidos.",
      errors,
    });
  }

  next();
}

module.exports = {
  validateApplicantRegistration,
};
