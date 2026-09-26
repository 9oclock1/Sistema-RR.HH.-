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
 *
 * Validation order per field: type → required → format / length.
 * A field only produces ONE error (first that fails), so the UI never shows
 * a misleading "entre 5 y 20 caracteres" when the real problem is "blank".
 */
function validateApplicantRegistration(req, res, next) {
  const errors = [];

  // ── Helper: ensure value is a string (rejects objects, arrays, numbers) ──
  function assertString(field, label) {
    const value = req.body[field];
    if (value !== undefined && value !== null && typeof value !== "string") {
      errors.push({
        field,
        label,
        message: `${label} debe ser texto.`,
      });
      return false;
    }
    return true;
  }

  // ── Helper: get trimmed string or empty ──
  function trimmed(field) {
    const v = req.body[field];
    return typeof v === "string" ? v.trim() : "";
  }

  // ────────────────────────────────────────────────
  // 1. id_convocatoria
  // ────────────────────────────────────────────────
  if (assertString("id_convocatoria", "Convocatoria")) {
    const val = trimmed("id_convocatoria");
    if (!val) {
      errors.push({
        field: "id_convocatoria",
        label: "Convocatoria",
        message: "Debe seleccionar una convocatoria activa.",
      });
    } else {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(val)) {
        errors.push({
          field: "id_convocatoria",
          label: "Convocatoria",
          message: "El identificador de la convocatoria no es válido.",
        });
      }
    }
  }

  // ────────────────────────────────────────────────
  // 2. numero_documento  — varchar(20), required, 5-20 chars
  // ────────────────────────────────────────────────
  if (assertString("numero_documento", "Número de documento")) {
    const val = trimmed("numero_documento");
    if (!val) {
      errors.push({
        field: "numero_documento",
        label: "Número de documento",
        message: "El número de documento es obligatorio.",
      });
    } else if (val.length < 5 || val.length > 20) {
      errors.push({
        field: "numero_documento",
        label: "Número de documento",
        message:
          "El número de documento debe tener entre 5 y 20 caracteres.",
      });
    }
  }

  // ────────────────────────────────────────────────
  // 3. nombres  — varchar(70), required
  // ────────────────────────────────────────────────
  if (assertString("nombres", "Nombres")) {
    const val = trimmed("nombres");
    if (!val) {
      errors.push({
        field: "nombres",
        label: "Nombres",
        message: "Los nombres del postulante son obligatorios.",
      });
    } else if (val.length > 70) {
      errors.push({
        field: "nombres",
        label: "Nombres",
        message: "Los nombres no deben exceder 70 caracteres.",
      });
    }
  }

  // ────────────────────────────────────────────────
  // 4. apellidos  — varchar(100), required
  // ────────────────────────────────────────────────
  if (assertString("apellidos", "Apellidos")) {
    const val = trimmed("apellidos");
    if (!val) {
      errors.push({
        field: "apellidos",
        label: "Apellidos",
        message: "Los apellidos del postulante son obligatorios.",
      });
    } else if (val.length > 100) {
      errors.push({
        field: "apellidos",
        label: "Apellidos",
        message: "Los apellidos no deben exceder 100 caracteres.",
      });
    }
  }

  // ────────────────────────────────────────────────
  // 5. correo_electronico  — varchar(120), required, email format
  // ────────────────────────────────────────────────
  if (assertString("correo_electronico", "Correo electrónico")) {
    const val = trimmed("correo_electronico");
    if (!val) {
      errors.push({
        field: "correo_electronico",
        label: "Correo electrónico",
        message: "El correo electrónico es obligatorio.",
      });
    } else if (val.length > 120) {
      errors.push({
        field: "correo_electronico",
        label: "Correo electrónico",
        message: "El correo electrónico no debe exceder 120 caracteres.",
      });
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(val)) {
        errors.push({
          field: "correo_electronico",
          label: "Correo electrónico",
          message: "El formato del correo electrónico no es válido.",
        });
      }
    }
  }

  // ────────────────────────────────────────────────
  // 6. telefono_contacto  — varchar(20), required, 7-20 digits only
  // ────────────────────────────────────────────────
  if (assertString("telefono_contacto", "Teléfono de contacto")) {
    const val = trimmed("telefono_contacto");
    if (!val) {
      errors.push({
        field: "telefono_contacto",
        label: "Teléfono de contacto",
        message: "El teléfono de contacto es obligatorio.",
      });
    } else {
      // Strip common formatting (spaces, dashes, plus, parens)
      const digits = val.replace(/[\s\-+()]/g, "");
      if (!/^\d+$/.test(digits)) {
        errors.push({
          field: "telefono_contacto",
          label: "Teléfono de contacto",
          message:
            "El teléfono solo debe contener dígitos (y opcionalmente +, -, paréntesis o espacios).",
        });
      } else if (digits.length < 7 || digits.length > 20) {
        errors.push({
          field: "telefono_contacto",
          label: "Teléfono de contacto",
          message:
            "El teléfono de contacto debe tener entre 7 y 20 dígitos.",
        });
      }
    }
  }

  // ────────────────────────────────────────────────
  // 7. direccion_residencia  — varchar(255), optional
  // ────────────────────────────────────────────────
  if (assertString("direccion_residencia", "Dirección de residencia")) {
    const val = trimmed("direccion_residencia");
    if (val && val.length > 255) {
      errors.push({
        field: "direccion_residencia",
        label: "Dirección de residencia",
        message: "La dirección no debe exceder 255 caracteres.",
      });
    }
  }

  // ────────────────────────────────────────────────
  // 8. ciudad  — varchar(50), optional (defaults to 'La Paz')
  // ────────────────────────────────────────────────
  if (assertString("ciudad", "Ciudad")) {
    const val = trimmed("ciudad");
    if (val && val.length > 50) {
      errors.push({
        field: "ciudad",
        label: "Ciudad",
        message: "La ciudad no debe exceder 50 caracteres.",
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
