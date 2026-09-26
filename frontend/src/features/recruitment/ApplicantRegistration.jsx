import { useState, useEffect } from "react";
import {
  fetchActiveJobOpenings,
  registerApplicant,
  fetchApplicantsByJobOpening,
} from "../../api/recruitmentApi";
import { useApplicantForm } from "../../hooks/useApplicantForm";
import ApplicantForm from "./ApplicantForm";
import ApplicantList from "./ApplicantList";
import "./ApplicantRegistration.css";

/**
 * RF-09: Applicant Registration Page
 *
 * Main container component that orchestrates:
 *  - Job opening selection
 *  - Applicant registration form (always visible)
 *  - Applicant list for the selected opening
 */
export default function ApplicantRegistration() {
  // State: job openings
  const [jobOpenings, setJobOpenings] = useState([]);
  const [loadingOpenings, setLoadingOpenings] = useState(true);
  const [selectedOpening, setSelectedOpening] = useState(null);

  // State: applicant list
  const [applicants, setApplicants] = useState([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);

  // State: submission
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

  // State: toggle form visibility
  const [showForm, setShowForm] = useState(false);

  // Form hook
  const {
    formData,
    fieldErrors,
    handleChange,
    validateForm,
    setBackendErrors,
    resetForm,
    setFormData,
  } = useApplicantForm();

  // Load active job openings on mount
  useEffect(() => {
    let cancelled = false;
    async function loadOpenings() {
      try {
        const data = await fetchActiveJobOpenings();
        if (!cancelled) setJobOpenings(data);
      } catch (err) {
        if (!cancelled) {
          setNotification({
            type: "error",
            message: err.message,
          });
        }
      } finally {
        if (!cancelled) setLoadingOpenings(false);
      }
    }
    loadOpenings();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load applicants when a job opening is selected
  useEffect(() => {
    if (!selectedOpening) return;
    let cancelled = false;
    async function loadApplicants() {
      setLoadingApplicants(true);
      try {
        const data = await fetchApplicantsByJobOpening(
          selectedOpening.id_convocatoria
        );
        if (!cancelled) setApplicants(data.postulantes);
      } catch (err) {
        if (!cancelled) {
          setNotification({ type: "error", message: err.message });
        }
      } finally {
        if (!cancelled) setLoadingApplicants(false);
      }
    }
    loadApplicants();
    return () => {
      cancelled = true;
    };
  }, [selectedOpening]);

  // Handle job opening selection change
  function handleOpeningChange(e) {
    const openingId = e.target.value;
    const opening = jobOpenings.find(
      (o) => o.id_convocatoria === openingId
    );
    setSelectedOpening(opening || null);
    if (!opening) setApplicants([]);
    setFormData((prev) => ({ ...prev, id_convocatoria: openingId }));
    setNotification(null);
  }

  // Handle form submission
  async function handleSubmit(e) {
    e.preventDefault();
    setNotification(null);

    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const result = await registerApplicant(formData);
      setNotification({
        type: "success",
        message: result.message,
      });
      resetForm();
      // Keep the convocatoria selected
      setFormData((prev) => ({
        ...prev,
        id_convocatoria: selectedOpening?.id_convocatoria || "",
      }));
      // Refresh the applicant list
      if (selectedOpening) {
        const data = await fetchApplicantsByJobOpening(
          selectedOpening.id_convocatoria
        );
        setApplicants(data.postulantes);
      }
    } catch (err) {
      if (err.status === 409) {
        setNotification({
          type: "warning",
          message: err.message,
        });
      } else if (err.status === 400 && err.errors?.length > 0) {
        setBackendErrors(err.errors);
        setNotification({
          type: "error",
          message: err.message,
        });
      } else {
        setNotification({
          type: "error",
          message: err.message,
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Auto-dismiss success notifications after 5 seconds
  useEffect(() => {
    if (notification?.type === "success") {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Toggle form
  function handleToggleForm() {
    setShowForm((prev) => !prev);
  }

  return (
    <div className="rf09-container">
      {/* Header */}
      <header className="rf09-header">
        <div className="rf09-header-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
        </div>
        <div>
          <h1 className="rf09-title">Registro de Postulantes</h1>
          <p className="rf09-subtitle">
            Ingrese la información personal, datos de contacto y antecedentes
            del postulante.
          </p>
        </div>
        <div className="rf09-header-action">
          <button
            type="button"
            className={`rf09-btn ${showForm ? 'rf09-btn--secondary' : 'rf09-btn--primary'}`}
            onClick={handleToggleForm}
          >
            {showForm ? (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rf09-btn-icon">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Cerrar Formulario
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rf09-btn-icon">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Agregar Postulante
              </>
            )}
          </button>
        </div>
      </header>

      {/* Job Opening Selector — always visible */}
      <section className="rf09-section rf09-selector-section">
        <label htmlFor="rf09-opening-select" className="rf09-label rf09-label--prominent">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="rf09-label-icon">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
          Seleccionar Convocatoria
        </label>
        {loadingOpenings ? (
          <div className="rf09-loading">
            <div className="rf09-spinner" />
            <span>Cargando convocatorias...</span>
          </div>
        ) : (
          <select
            id="rf09-opening-select"
            name="id_convocatoria"
            className={`rf09-select ${
              fieldErrors.id_convocatoria ? "rf09-input--error" : ""
            }`}
            value={formData.id_convocatoria}
            onChange={handleOpeningChange}
          >
            <option value="">— Seleccione una convocatoria —</option>
            {jobOpenings.map((opening) => (
              <option
                key={opening.id_convocatoria}
                value={opening.id_convocatoria}
              >
                {opening.codigo_convocatoria} — {opening.titulo_puesto}
              </option>
            ))}
          </select>
        )}
        {fieldErrors.id_convocatoria && (
          <span className="rf09-field-error">{fieldErrors.id_convocatoria}</span>
        )}
        {jobOpenings.length === 0 && !loadingOpenings && (
          <p className="rf09-empty-state">
            No hay convocatorias activas disponibles en este momento.
          </p>
        )}
      </section>

      {/* Notification */}
      {notification && (
        <div className={`rf09-notification rf09-notification--${notification.type}`}>
          <div className="rf09-notification-icon">
            {notification.type === "success" && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            )}
            {notification.type === "error" && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            )}
            {notification.type === "warning" && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            )}
          </div>
          <p>{notification.message}</p>
          <button
            className="rf09-notification-close"
            onClick={() => setNotification(null)}
            aria-label="Cerrar notificación"
          >
            ×
          </button>
        </div>
      )}

      {/* Two-column layout: Form + List — form shows via toggle button */}
      <div className="rf09-content">
        {showForm && (
          <section className="rf09-section rf09-form-section">
            <h2 className="rf09-section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="rf09-section-icon">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Datos del Postulante
            </h2>
            <ApplicantForm
              formData={formData}
              fieldErrors={fieldErrors}
              onChange={handleChange}
              onSubmit={handleSubmit}
              submitting={submitting}
            />
          </section>
        )}

        {selectedOpening && (
          <section className={`rf09-section rf09-list-section ${!showForm ? 'rf09-list-section--full' : ''}`}>
            <h2 className="rf09-section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="rf09-section-icon">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Postulantes Registrados
              <span className="rf09-badge">{applicants.length}</span>
            </h2>
            <ApplicantList
              applicants={applicants}
              loading={loadingApplicants}
              openingTitle={selectedOpening?.titulo_puesto}
            />
          </section>
        )}
      </div>
    </div>
  );
}
