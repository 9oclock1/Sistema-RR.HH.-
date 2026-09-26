import { useState, useCallback } from "react";

/**
 * Custom hook for managing the applicant registration form state.
 * Encapsulates form data, validation, field errors, and reset logic.
 * Kept separate from the UI component for testability and reuse.
 *
 * Validation mirrors the backend middleware (validationMiddleware.js).
 * Each field produces at most ONE error (first that fails):
 *   type → required → format / length
 */

const INITIAL_FORM_STATE = {
  id_convocatoria: "",
  numero_documento: "",
  nombres: "",
  apellidos: "",
  correo_electronico: "",
  telefono_contacto: "",
  direccion_residencia: "",
  ciudad: "La Paz",
};

export function useApplicantForm() {
  const [formData, setFormData] = useState({ ...INITIAL_FORM_STATE });
  const [fieldErrors, setFieldErrors] = useState({});

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear the field error when the user starts typing
    setFieldErrors((prev) => {
      if (prev[name]) {
        const updated = { ...prev };
        delete updated[name];
        return updated;
      }
      return prev;
    });
  }, []);

  /**
   * Client-side validation (mirrors the backend middleware).
   * Returns true if the form is valid, false otherwise.
   */
  const validateForm = useCallback(() => {
    const errors = {};

    // ── id_convocatoria ──
    if (!formData.id_convocatoria) {
      errors.id_convocatoria = "Debe seleccionar una convocatoria.";
    }

    // ── numero_documento — required, 5-20 chars ──
    if (!formData.numero_documento.trim()) {
      errors.numero_documento = "El número de documento es obligatorio.";
    } else if (
      formData.numero_documento.trim().length < 5 ||
      formData.numero_documento.trim().length > 20
    ) {
      errors.numero_documento =
        "El documento debe tener entre 5 y 20 caracteres.";
    }

    // ── nombres — required, max 70 chars ──
    if (!formData.nombres.trim()) {
      errors.nombres = "Los nombres son obligatorios.";
    } else if (formData.nombres.trim().length > 70) {
      errors.nombres = "Los nombres no deben exceder 70 caracteres.";
    }

    // ── apellidos — required, max 100 chars ──
    if (!formData.apellidos.trim()) {
      errors.apellidos = "Los apellidos son obligatorios.";
    } else if (formData.apellidos.trim().length > 100) {
      errors.apellidos = "Los apellidos no deben exceder 100 caracteres.";
    }

    // ── correo_electronico — required, max 120, email format ──
    if (!formData.correo_electronico.trim()) {
      errors.correo_electronico = "El correo electrónico es obligatorio.";
    } else if (formData.correo_electronico.trim().length > 120) {
      errors.correo_electronico =
        "El correo electrónico no debe exceder 120 caracteres.";
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.correo_electronico.trim())) {
        errors.correo_electronico =
          "El formato del correo electrónico no es válido.";
      }
    }

    // ── telefono_contacto — required, digits only, 7-20 digits ──
    if (!formData.telefono_contacto.trim()) {
      errors.telefono_contacto = "El teléfono de contacto es obligatorio.";
    } else {
      const digits = formData.telefono_contacto
        .trim()
        .replace(/[\s\-+()]/g, "");
      if (!/^\d+$/.test(digits)) {
        errors.telefono_contacto =
          "El teléfono solo debe contener dígitos (y opcionalmente +, -, paréntesis o espacios).";
      } else if (digits.length < 7 || digits.length > 20) {
        errors.telefono_contacto =
          "El teléfono debe tener entre 7 y 20 dígitos.";
      }
    }

    // ── direccion_residencia — optional, max 255 ──
    if (formData.direccion_residencia.trim().length > 255) {
      errors.direccion_residencia =
        "La dirección no debe exceder 255 caracteres.";
    }

    // ── ciudad — optional, max 50 ──
    if (formData.ciudad.trim().length > 50) {
      errors.ciudad = "La ciudad no debe exceder 50 caracteres.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  /**
   * Sets field-level errors from the backend response.
   * @param {Array} backendErrors - Array of { field, message }
   */
  const setBackendErrors = useCallback((backendErrors) => {
    if (!Array.isArray(backendErrors)) return;
    const errors = {};
    for (const err of backendErrors) {
      // Only keep the FIRST error per field (backend sends at most one,
      // but guard against future changes)
      if (!errors[err.field]) {
        errors[err.field] = err.message;
      }
    }
    setFieldErrors(errors);
  }, []);

  const resetForm = useCallback(() => {
    setFormData({ ...INITIAL_FORM_STATE });
    setFieldErrors({});
  }, []);

  return {
    formData,
    fieldErrors,
    handleChange,
    validateForm,
    setBackendErrors,
    resetForm,
    setFormData,
  };
}
