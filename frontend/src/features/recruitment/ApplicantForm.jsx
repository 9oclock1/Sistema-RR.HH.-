import "./ApplicantRegistration.css";

/**
 * ApplicantForm Component
 *
 * Renders the registration form for a new applicant.
 * All field-level errors are displayed inline beneath each input
 * (acceptance criteria #3: indicate which data is missing).
 *
 * Props:
 *  - formData: current form values
 *  - fieldErrors: object of field → error message
 *  - onChange: handler for input changes
 *  - onSubmit: handler for form submission
 *  - submitting: boolean loading state
 */
export default function ApplicantForm({
  formData,
  fieldErrors,
  onChange,
  onSubmit,
  submitting,
}) {
  return (
    <form className="rf09-form" onSubmit={onSubmit} noValidate>
      {/* Información Personal */}
      <fieldset className="rf09-fieldset">
        <legend className="rf09-legend">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="rf09-legend-icon">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          Información Personal
        </legend>

        <div className="rf09-form-row">
          <div className="rf09-form-group">
            <label htmlFor="rf09-doc" className="rf09-label">
              Número de Documento <span className="rf09-required">*</span>
            </label>
            <input
              id="rf09-doc"
              type="text"
              name="numero_documento"
              className={`rf09-input ${
                fieldErrors.numero_documento ? "rf09-input--error" : ""
              }`}
              value={formData.numero_documento}
              onChange={onChange}
              placeholder="Ej: 12345678"
              maxLength={20}
              autoComplete="off"
            />
            {fieldErrors.numero_documento && (
              <span className="rf09-field-error">
                {fieldErrors.numero_documento}
              </span>
            )}
          </div>
        </div>

        <div className="rf09-form-row">
          <div className="rf09-form-group">
            <label htmlFor="rf09-nombres" className="rf09-label">
              Nombres <span className="rf09-required">*</span>
            </label>
            <input
              id="rf09-nombres"
              type="text"
              name="nombres"
              className={`rf09-input ${
                fieldErrors.nombres ? "rf09-input--error" : ""
              }`}
              value={formData.nombres}
              onChange={onChange}
              placeholder="Ej: Juan Carlos"
              maxLength={70}
            />
            {fieldErrors.nombres && (
              <span className="rf09-field-error">{fieldErrors.nombres}</span>
            )}
          </div>

          <div className="rf09-form-group">
            <label htmlFor="rf09-apellidos" className="rf09-label">
              Apellidos <span className="rf09-required">*</span>
            </label>
            <input
              id="rf09-apellidos"
              type="text"
              name="apellidos"
              className={`rf09-input ${
                fieldErrors.apellidos ? "rf09-input--error" : ""
              }`}
              value={formData.apellidos}
              onChange={onChange}
              placeholder="Ej: Pérez García"
              maxLength={100}
            />
            {fieldErrors.apellidos && (
              <span className="rf09-field-error">{fieldErrors.apellidos}</span>
            )}
          </div>
        </div>
      </fieldset>

      {/* Datos de Contacto */}
      <fieldset className="rf09-fieldset">
        <legend className="rf09-legend">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="rf09-legend-icon">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          Datos de Contacto
        </legend>

        <div className="rf09-form-row">
          <div className="rf09-form-group">
            <label htmlFor="rf09-email" className="rf09-label">
              Correo Electrónico <span className="rf09-required">*</span>
            </label>
            <input
              id="rf09-email"
              type="email"
              name="correo_electronico"
              className={`rf09-input ${
                fieldErrors.correo_electronico ? "rf09-input--error" : ""
              }`}
              value={formData.correo_electronico}
              onChange={onChange}
              placeholder="Ej: juan.perez@email.com"
              maxLength={120}
            />
            {fieldErrors.correo_electronico && (
              <span className="rf09-field-error">
                {fieldErrors.correo_electronico}
              </span>
            )}
          </div>

          <div className="rf09-form-group">
            <label htmlFor="rf09-phone" className="rf09-label">
              Teléfono de Contacto <span className="rf09-required">*</span>
            </label>
            <input
              id="rf09-phone"
              type="tel"
              name="telefono_contacto"
              className={`rf09-input ${
                fieldErrors.telefono_contacto ? "rf09-input--error" : ""
              }`}
              value={formData.telefono_contacto}
              onChange={onChange}
              placeholder="Ej: +591 71234567"
              maxLength={20}
            />
            {fieldErrors.telefono_contacto && (
              <span className="rf09-field-error">
                {fieldErrors.telefono_contacto}
              </span>
            )}
          </div>
        </div>
      </fieldset>

      {/* Antecedentes Básicos */}
      <fieldset className="rf09-fieldset">
        <legend className="rf09-legend">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="rf09-legend-icon">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          Antecedentes Básicos
        </legend>

        <div className="rf09-form-row">
          <div className="rf09-form-group">
            <label htmlFor="rf09-address" className="rf09-label">
              Dirección de Residencia
            </label>
            <input
              id="rf09-address"
              type="text"
              name="direccion_residencia"
              className="rf09-input"
              value={formData.direccion_residencia}
              onChange={onChange}
              placeholder="Ej: Av. 6 de Agosto #1234, Zona Sopocachi"
              maxLength={255}
            />
          </div>

          <div className="rf09-form-group rf09-form-group--small">
            <label htmlFor="rf09-city" className="rf09-label">
              Ciudad
            </label>
            <input
              id="rf09-city"
              type="text"
              name="ciudad"
              className="rf09-input"
              value={formData.ciudad}
              onChange={onChange}
              placeholder="Ej: La Paz"
              maxLength={50}
            />
          </div>
        </div>
      </fieldset>

      {/* Submit */}
      <div className="rf09-form-actions">
        <button
          type="submit"
          className="rf09-btn rf09-btn--primary"
          disabled={submitting}
        >
          {submitting ? (
            <>
              <div className="rf09-spinner rf09-spinner--small" />
              Registrando...
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rf09-btn-icon">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="22" y1="11" x2="16" y2="11" />
              </svg>
              Registrar Postulante
            </>
          )}
        </button>
      </div>
    </form>
  );
}
