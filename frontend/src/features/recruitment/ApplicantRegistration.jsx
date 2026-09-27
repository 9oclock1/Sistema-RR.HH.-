import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router";
import { Briefcase, Calendar, Plus, RefreshCw, UserPlus, Users, X } from "lucide-react";
import {
  fetchActiveJobOpenings,
  registerApplicant,
  fetchApplicantsByJobOpening,
} from "../../api/recruitmentApi";
import { useApplicantForm } from "../../hooks/useApplicantForm";
import {
  Alerta,
  Boton,
  Contador,
  EncabezadoPagina,
  Esqueleto,
  Etiqueta,
  Selector,
  Tarjeta,
  useAvisos,
} from "../../components/ui";
import ApplicantForm from "./ApplicantForm";
import ApplicantList from "./ApplicantList";
import "./ApplicantRegistration.css";

/**
 * RF-09: Pantalla de Registro de Postulantes
 * Adaptada a la arquitectura y sistema de diseño Jira / Atlassian (DESIGN.md).
 * Orquesta:
 *  - Selección de convocatoria activa
 *  - Visualización del resumen de la convocatoria
 *  - Formulario accesible de postulación
 *  - Tabla densa de postulantes registrados
 */
export default function ApplicantRegistration() {
  const avisar = useAvisos();

  // Estado: convocatorias
  const [jobOpenings, setJobOpenings] = useState([]);
  const [loadingOpenings, setLoadingOpenings] = useState(true);
  const [selectedOpening, setSelectedOpening] = useState(null);
  const [errorCargaOpenings, setErrorCargaOpenings] = useState(null);

  // Estado: postulantes
  const [applicants, setApplicants] = useState([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  const [errorApplicants, setErrorApplicants] = useState(null);

  // Estado: envío y notificaciones en página
  const [submitting, setSubmitting] = useState(false);
  const [alerta, setAlerta] = useState(null);

  // Estado: alternar visualización del formulario
  const [showForm, setShowForm] = useState(false);

  // Hook del formulario
  const {
    formData,
    fieldErrors,
    handleChange,
    validateForm,
    setBackendErrors,
    resetForm,
    setFormData,
  } = useApplicantForm();

  // Cargar convocatorias activas al montar
  const cargarConvocatorias = useCallback(() => {
    return fetchActiveJobOpenings()
      .then((data) => {
        setJobOpenings(Array.isArray(data) ? data : []);
        setErrorCargaOpenings(null);
      })
      .catch((err) => {
        setErrorCargaOpenings(err.message || "Error al obtener las convocatorias activas.");
      })
      .finally(() => {
        setLoadingOpenings(false);
      });
  }, []);

  useEffect(() => {
    cargarConvocatorias();
  }, [cargarConvocatorias]);

  const reintentarCargarConvocatorias = () => {
    setErrorCargaOpenings(null);
    setLoadingOpenings(true);
    cargarConvocatorias();
  };

  // Cargar postulantes de la convocatoria seleccionada
  const cargarPostulantes = useCallback((idConvocatoria) => {
    if (!idConvocatoria) {
      setApplicants([]);
      return Promise.resolve();
    }
    setErrorApplicants(null);
    return fetchApplicantsByJobOpening(idConvocatoria)
      .then((data) => {
        setApplicants(Array.isArray(data?.postulantes) ? data.postulantes : []);
      })
      .catch((err) => {
        setErrorApplicants(err.message || "Error al obtener los postulantes de la convocatoria.");
      })
      .finally(() => {
        setLoadingApplicants(false);
      });
  }, []);

  // Manejar cambio en el selector de convocatoria
  function handleOpeningChange(e) {
    const openingId = e.target.value;
    const opening = jobOpenings.find((o) => o.id_convocatoria === openingId) || null;
    setSelectedOpening(opening);
    setFormData((prev) => ({ ...prev, id_convocatoria: openingId }));
    setAlerta(null);
    if (opening) {
      setLoadingApplicants(true);
      cargarPostulantes(opening.id_convocatoria);
    } else {
      setApplicants([]);
    }
  }

  // Alternar visualización del formulario
  function handleToggleForm() {
    setShowForm((prev) => !prev);
    setAlerta(null);
  }

  // Envío del formulario
  async function handleSubmit(e) {
    e.preventDefault();
    setAlerta(null);

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      await registerApplicant(formData);
      
      // Notificación flotante del sistema de diseño
      avisar({
        tono: "exito",
        titulo: "Postulante registrado",
        mensaje: `${formData.nombres} ${formData.apellidos} fue registrado correctamente.`,
      });

      // Limpiar formulario preservando la convocatoria activa
      resetForm();
      if (selectedOpening) {
        setFormData((prev) => ({
          ...prev,
          id_convocatoria: selectedOpening.id_convocatoria,
        }));
        await cargarPostulantes(selectedOpening.id_convocatoria);
      }

    } catch (err) {
      const estado = err.status || err.estado;
      if (estado === 409) {
        setAlerta({
          tono: "aviso",
          titulo: "Postulación duplicada",
          mensaje: err.message,
        });
      } else if (estado === 400 && (err.errors?.length > 0 || err.detalles?.length > 0)) {
        const errores = err.errors || err.detalles;
        setBackendErrors(errores);
        setAlerta({
          tono: "peligro",
          titulo: "Datos incompletos o inválidos",
          mensaje: err.message || "Por favor revise los campos señalados en el formulario.",
        });
      } else {
        setAlerta({
          tono: "peligro",
          titulo: "Error al registrar",
          mensaje: err.message || "Ocurrió un error inesperado al registrar el postulante.",
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Opciones para el selector de convocatorias
  const opcionesConvocatorias = jobOpenings.map((opening) => ({
    valor: opening.id_convocatoria,
    etiqueta: `${opening.codigo_convocatoria || "CONV"} — ${opening.titulo_puesto}`,
  }));

  const botonAccionHeader = selectedOpening && (
    <Boton
      variante={showForm ? "predeterminado" : "primario"}
      icono={showForm ? X : Plus}
      onClick={handleToggleForm}
    >
      {showForm ? "Cerrar formulario" : "Agregar postulante"}
    </Boton>
  );

  return (
    <section className="postulantes" aria-labelledby="postulantes-titulo">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Reclutamiento" }]}
        enlace={Link}
        titulo="Registro de postulantes"
        idTitulo="postulantes-titulo"
        descripcion="Gestión de convocatorias activas y recepción de candidaturas para selección de personal."
        acciones={botonAccionHeader}
      />

      {/* Alerta de notificación en página */}
      {alerta && (
        <Alerta
          tono={alerta.tono}
          titulo={alerta.titulo}
          role={alerta.tono === "peligro" ? "alert" : undefined}
          onCerrar={() => setAlerta(null)}
        >
          {alerta.mensaje}
        </Alerta>
      )}

      {/* Error de carga de convocatorias */}
      {errorCargaOpenings && (
        <Alerta
          tono="peligro"
          role="alert"
          titulo="No se pudieron cargar las convocatorias"
          acciones={
            <Boton tamano="sm" onClick={reintentarCargarConvocatorias} icono={RefreshCw}>
              Reintentar
            </Boton>
          }
        >
          {errorCargaOpenings}
        </Alerta>
      )}

      {/* Tarjeta del selector de convocatoria */}
      <Tarjeta className="postulantes-selector-tarjeta">
        <div className="postulantes-selector-fila">
          {loadingOpenings ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", width: "100%" }}>
              <Esqueleto ancho="160px" alto="16px" />
              <Esqueleto ancho="100%" alto="32px" />
            </div>
          ) : (
            <Selector
              id="selector-convocatoria"
              etiqueta="Convocatoria activa"
              textoVacio="— Seleccione una convocatoria activa —"
              opciones={opcionesConvocatorias}
              value={formData.id_convocatoria}
              onChange={handleOpeningChange}
              error={fieldErrors.id_convocatoria}
              ayuda={jobOpenings.length === 0 ? "No hay convocatorias activas disponibles actualmente." : undefined}
            />
          )}

          {selectedOpening && !showForm && (
            <Boton
              variante="primario"
              icono={UserPlus}
              onClick={handleToggleForm}
            >
              Registrar postulante
            </Boton>
          )}
        </div>

        {/* Resumen de la convocatoria seleccionada */}
        {selectedOpening && (
          <div className="postulantes-convocatoria-resumen">
            <div className="postulantes-metrica">
              <span className="postulantes-metrica__etiqueta">Puesto</span>
              <span className="postulantes-metrica__valor">
                <Briefcase className="ds-icono" aria-hidden="true" />
                {selectedOpening.titulo_puesto}
              </span>
            </div>
            <div className="postulantes-metrica">
              <span className="postulantes-metrica__etiqueta">Vacantes</span>
              <span className="postulantes-metrica__valor">
                <Users className="ds-icono" aria-hidden="true" />
                {selectedOpening.cantidad_vacantes ?? 1}
              </span>
            </div>
            <div className="postulantes-metrica">
              <span className="postulantes-metrica__etiqueta">Fecha límite</span>
              <span className="postulantes-metrica__valor">
                <Calendar className="ds-icono" aria-hidden="true" />
                {selectedOpening.fecha_limite_postulacion
                  ? new Date(selectedOpening.fecha_limite_postulacion).toLocaleDateString("es-BO")
                  : "Abierta"}
              </span>
            </div>
            <div className="postulantes-metrica">
              <span className="postulantes-metrica__etiqueta">Estado</span>
              <span className="postulantes-metrica__valor">
                <Etiqueta tono="exito">Convocatoria activa</Etiqueta>
              </span>
            </div>
          </div>
        )}
      </Tarjeta>

      {/* Formulario de registro (colapsable o visible a demanda) */}
      {showForm && selectedOpening && (
        <Tarjeta
          titulo={`Nuevo postulante: ${selectedOpening.titulo_puesto}`}
          acciones={
            <Boton variante="sutil" soloIcono icono={X} aria-label="Cerrar formulario" onClick={handleToggleForm} />
          }
        >
          <ApplicantForm
            formData={formData}
            fieldErrors={fieldErrors}
            onChange={handleChange}
            onSubmit={handleSubmit}
            onCancel={handleToggleForm}
            submitting={submitting}
          />
        </Tarjeta>
      )}

      {/* Error de carga de postulantes */}
      {errorApplicants && (
        <Alerta
          tono="peligro"
          role="alert"
          titulo="Error al consultar los postulantes"
          acciones={
            <Boton
              tamano="sm"
              onClick={() => cargarPostulantes(selectedOpening?.id_convocatoria)}
              icono={RefreshCw}
            >
              Reintentar
            </Boton>
          }
        >
          {errorApplicants}
        </Alerta>
      )}

      {/* Tabla de postulantes registrados */}
      {selectedOpening && (
        <Tarjeta
          titulo="Postulantes registrados"
          acciones={
            <Contador aria-label={`${applicants.length} postulantes registrados`}>
              {applicants.length}
            </Contador>
          }
        >
          <ApplicantList
            applicants={applicants}
            loading={loadingApplicants}
            openingTitle={selectedOpening.titulo_puesto}
            onRegistrarPrimerPostulante={handleToggleForm}
          />
        </Tarjeta>
      )}
    </section>
  );
}
