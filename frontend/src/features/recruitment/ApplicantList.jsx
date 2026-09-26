import "./ApplicantRegistration.css";

/**
 * ApplicantList Component
 *
 * Displays all registered applicants for a selected job opening,
 * including their application dates (acceptance criteria #4).
 *
 * Props:
 *  - applicants: array of applicant records
 *  - loading: boolean loading state
 *  - openingTitle: string title of the selected job opening
 */
export default function ApplicantList({ applicants, loading, openingTitle }) {
  /**
   * Formats an ISO date string to a localized Spanish date.
   */
  function formatDate(isoString) {
    if (!isoString) return "—";
    const date = new Date(isoString);
    return date.toLocaleDateString("es-BO", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <div className="rf09-loading">
        <div className="rf09-spinner" />
        <span>Cargando postulantes...</span>
      </div>
    );
  }

  if (applicants.length === 0) {
    return (
      <div className="rf09-empty-list">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="rf09-empty-icon">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <p>No hay postulantes registrados para esta convocatoria.</p>
        <span className="rf09-empty-hint">
          Use el formulario de la izquierda para registrar el primer postulante.
        </span>
      </div>
    );
  }

  return (
    <div className="rf09-list-container">
      <div className="rf09-list-header">
        <span className="rf09-list-info">
          {applicants.length} postulante{applicants.length !== 1 ? "s" : ""}{" "}
          para <strong>{openingTitle}</strong>
        </span>
      </div>

      <div className="rf09-table-wrapper">
        <table className="rf09-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Documento</th>
              <th>Nombre Completo</th>
              <th>Correo Electrónico</th>
              <th>Teléfono</th>
              <th>Ciudad</th>
              <th>Etapa</th>
              <th>Fecha de Postulación</th>
            </tr>
          </thead>
          <tbody>
            {applicants.map((applicant, index) => (
              <tr key={applicant.id_postulacion} className="rf09-table-row">
                <td className="rf09-td-number">{index + 1}</td>
                <td>
                  <code className="rf09-doc-code">
                    {applicant.numero_documento}
                  </code>
                </td>
                <td className="rf09-td-name">
                  <div className="rf09-avatar">
                    {applicant.nombres?.[0]?.toUpperCase()}
                    {applicant.apellidos?.[0]?.toUpperCase()}
                  </div>
                  <span>
                    {applicant.nombres} {applicant.apellidos}
                  </span>
                </td>
                <td>{applicant.correo_electronico}</td>
                <td>{applicant.telefono_contacto}</td>
                <td>{applicant.ciudad || "—"}</td>
                <td>
                  <span className="rf09-stage-badge">
                    {applicant.nombre_etapa || "Recepción"}
                  </span>
                </td>
                <td className="rf09-td-date">
                  {formatDate(applicant.fecha_postulacion)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
