import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router";
import {
  Briefcase,
  Calendar,
  Plus,
  RefreshCw,
  Users,
  X,
  Award,
  ListFilter,
} from "lucide-react";
import {
  fetchActiveJobOpenings,
  registerApplicant,
  fetchApplicantsByJobOpening,
} from "../../api/recruitmentApi";
import { useApplicantForm } from "../../hooks/useApplicantForm";
import { useCandidateRanking } from "../../hooks/useCandidateRanking";
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
import CandidateRankingTable from "./CandidateRankingTable";
import RankingFilters from "./RankingFilters";
import "./ApplicantRegistration.css";

function formatearFechaLimite(fecha) {
  if (!fecha) return "Abierta";
  try {
    const partes = String(fecha).split("T")[0].split("-");
    if (partes.length === 3) {
      const [year, month, day] = partes.map(Number);
      return new Intl.DateTimeFormat("es-BO").format(new Date(year, month - 1, day));
    }
    return new Intl.DateTimeFormat("es-BO").format(new Date(fecha));
  } catch {
    return String(fecha);
  }
}

/**
 * RF-09 / RF-13: Pantalla de Registro y Ranking de Postulantes
 */
export default function ApplicantRegistration() {
  const avisar = useAvisos();

  // Estado: convocatorias
  const [jobOpenings, setJobOpenings] = useState([]);
  const [loadingOpenings, setLoadingOpenings] = useState(true);
  const [selectedOpening, setSelectedOpening] = useState(null);
  const [errorCargaOpenings, setErrorCargaOpenings] = useState(null);

  // Estado: postulantes (lista cronológica)
  const [applicants, setApplicants] = useState([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  const [errorApplicants, setErrorApplicants] = useState(null);

  // Estado: alternar vistas (ranking o lista cronológica)
  const [vistaActiva, setVistaActiva] = useState("ranking");

  // Estado: envío y notificaciones en página
  const [submitting, setSubmitting] = useState(false);
  const [alerta, setAlerta] = useState(null);
  const alertaRef = useRef(null);

  useEffect(() => {
    if (alerta && alertaRef.current) {
      alertaRef.current.focus();
    }
  }, [alerta]);

  // Estado: alternar visualización del formulario
  const [showForm, setShowForm] = useState(false);

  // Hook del formulario de registro
  const {
    formData,
    fieldErrors,
    handleChange,
    validateForm,
    setBackendErrors,
    resetForm,
    setFormData,
  } = useApplicantForm();

  // Hook de ranking de candidatos (RF-13)
  const {
    candidatos: rankingCandidatos,
    paginacion: paginacionRanking,
    cargando: cargandoRanking,
    error: errorRanking,
    filtros: filtrosRanking,
    actualizarFiltro: actualizarFiltroRanking,
    cambiarPagina: cambiarPaginaRanking,
    recargar: recargarRanking,
  } = useCandidateRanking(selectedOpening?.id_convocatoria);

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
        await recargarRanking();
      }
    } catch (err) {
      const estado = err.status || err.estado;
      if (estado === 409) {
        setAlerta({
          tono: "aviso",
          titulo: "Postulación duplicada",
          mensaje: err.message,
        });
      } else if (estado === 400 && (err.detalles?.length > 0 || err.errors?.length > 0)) {
        const errores = err.detalles?.length > 0 ? err.detalles : err.errors;
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
          tabIndex={-1}
          ref={alertaRef}
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
                {formatearFechaLimite(selectedOpening.fecha_limite_postulacion)}
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

      {/* Formulario de registro */}
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

      {/* Error de carga de postulantes en lista cronológica */}
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

      {/* Contenedor con pestañas (Ranking / Cronológico) */}
      {selectedOpening && (
        <Tarjeta
          titulo={vistaActiva === "ranking" ? "Ranking de Idoneidad de Candidatos" : "Postulantes Registrados"}
          acciones={
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <Contador
                aria-label={`${
                  vistaActiva === "ranking" ? paginacionRanking.total_registros : applicants.length
                } registros`}
              >
                {vistaActiva === "ranking" ? paginacionRanking.total_registros : applicants.length}
              </Contador>
              <Boton
                tamano="sm"
                variante="sutil"
                icono={RefreshCw}
                onClick={
                  vistaActiva === "ranking"
                    ? recargarRanking
                    : () => cargarPostulantes(selectedOpening.id_convocatoria)
                }
                aria-label="Refrescar lista"
              />
            </div>
          }
        >
          <div className="postulantes-vistas-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={vistaActiva === "ranking"}
              className={`postulantes-tab-btn ${
                vistaActiva === "ranking" ? "postulantes-tab-btn--activo" : ""
              }`}
              onClick={() => setVistaActiva("ranking")}
            >
              <Award className="ds-icono" aria-hidden="true" />
              Ranking de Afinidad (RF-13)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={vistaActiva === "lista"}
              className={`postulantes-tab-btn ${
                vistaActiva === "lista" ? "postulantes-tab-btn--activo" : ""
              }`}
              onClick={() => setVistaActiva("lista")}
            >
              <ListFilter className="ds-icono" aria-hidden="true" />
              Recepción cronológica
            </button>
          </div>

          {errorRanking && vistaActiva === "ranking" && (
            <Alerta tono="peligro" role="alert" titulo="Error al consultar el ranking">
              {errorRanking}
            </Alerta>
          )}

          {vistaActiva === "ranking" ? (
            <>
              <RankingFilters
                filtros={filtrosRanking}
                alCambiarFiltro={actualizarFiltroRanking}
                alLimpiar={() => {
                  actualizarFiltroRanking("desempate", "experiencia");
                  actualizarFiltroRanking("orden_desempate", "desc");
                  actualizarFiltroRanking("experiencia_min", "");
                  actualizarFiltroRanking("pretension_salarial_max", "");
                }}
              />

              <CandidateRankingTable
                candidatos={rankingCandidatos}
                paginacion={paginacionRanking}
                cargando={cargandoRanking}
                tituloConvocatoria={selectedOpening.titulo_puesto}
                alCambiarPagina={cambiarPaginaRanking}
              />
            </>
          ) : (
            <ApplicantList
              applicants={applicants}
              loading={loadingApplicants}
              openingTitle={selectedOpening.titulo_puesto}
              onRegistrarPrimerPostulante={handleToggleForm}
            />
          )}
        </Tarjeta>
      )}
    </section>
  );
}