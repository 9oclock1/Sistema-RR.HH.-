import { useState, useCallback } from "react";

/**
 * Custom hook for managing the applicant registration form state.
 * Encapsulates form data, validation, field errors, and reset logic.
 * Kept separate from the UI component for testability and reuse.
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

    if (!formData.id_convocatoria) {
      errors.id_convocatoria = "Debe seleccionar una convocatoria.";
    }
    if (!formData.numero_documento.trim()) {
      errors.numero_documento = "El número de documento es obligatorio.";
    } else if (
      formData.numero_documento.trim().length < 5 ||
      formData.numero_documento.trim().length > 20
    ) {
      errors.numero_documento =
        "El documento debe tener entre 5 y 20 caracteres.";
    }
    if (!formData.nombres.trim()) {
      errors.nombres = "Los nombres son obligatorios.";
    }
    if (!formData.apellidos.trim()) {
      errors.apellidos = "Los apellidos son obligatorios.";
    }
    if (!formData.correo_electronico.trim()) {
      errors.correo_electronico = "El correo electrónico es obligatorio.";
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.correo_electronico.trim())) {
        errors.correo_electronico =
          "El formato del correo electrónico no es válido.";
      }
    }
    if (!formData.telefono_contacto.trim()) {
      errors.telefono_contacto = "El teléfono de contacto es obligatorio.";
    } else {
      const phone = formData.telefono_contacto
        .trim()
        .replace(/[\s\-+()]/g, "");
      if (phone.length < 7 || phone.length > 20) {
        errors.telefono_contacto =
          "El teléfono debe tener entre 7 y 20 dígitos.";
      }
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
      errors[err.field] = err.message;
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
