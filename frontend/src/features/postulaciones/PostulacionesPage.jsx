import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router";
import { FileCheck, FileWarning, Download, ExternalLink, RefreshCw } from "lucide-react";
import { EncabezadoPagina, Tarjeta, Selector, Boton, Alerta, Etiqueta, useAvisos } from "../../components/ui";
import { postulacionApi } from "../../api/postulacion";
import CvUploadForm from "./components/CvUploadForm";
import CvViewer from "./components/CvViewer";
import "./PostulacionesPage.css";

export default function PostulacionesPage() {
  const avisar = useAvisos();
  const [convocatorias, setConvocatorias] = useState([]);
  const [convocatoriaId, setConvocatoriaId] = useState("");
  const [postulantes, setPostulantes] = useState([]);
  const [postulanteId, setPostulanteId] = useState("");
  const [cargando, setCargando] = useState(false);
  const [errorCarga, setErrorCarga] = useState(null);

  // carga de todas las convocatorias
  useEffect(() => {
    async function cargarConvocatorias() {
      try {
        const lista = await postulacionApi.obtenerConvocatorias();
        setConvocatorias(lista);
        if (lista.length > 0) {
          setConvocatoriaId(lista[0].id_convocatoria);
        }
      } catch (err) {
        setErrorCarga("No se pudieron cargar las convocatorias disponibles.");
      }
    }
    cargarConvocatorias();
  }, []);

  // carga de todos los postulantes de la convocatoria seleccionada
  const cargarPostulantes = useCallback(async () => {
    if (!convocatoriaId) return;
    setCargando(true);
    try {
      const lista = await postulacionApi.obtenerPostulantesPorConvocatoria(convocatoriaId);
      setPostulantes(lista);
      if (lista.length > 0) {
        setPostulanteId((actual) =>
          lista.some((p) => p.id_postulante === actual) ? actual : lista[0].id_postulante
        );
      } else {
        setPostulanteId("");
      }
    } catch (err) {
      setErrorCarga("Error al consultar postulantes de la vacante.");
    } finally {
      setCargando(false);
    }
  }, [convocatoriaId]);

  useEffect(() => {
    cargarPostulantes();
  }, [cargarPostulantes]);

  const convocatoriaActual = convocatorias.find((c) => c.id_convocatoria === convocatoriaId);
  const postulanteActual = postulantes.find((p) => p.id_postulante === postulanteId);
  const tieneCvCargado = Boolean(postulanteActual?.cv_archivo_url);
  const esPdf = postulanteActual?.cv_formato_mimetype?.includes("pdf");
  

  const opcionesConvocatoria = convocatorias.map((c) => ({
    valor: c.id_convocatoria,
    etiqueta: `${c.codigo_convocatoria} - ${c.titulo_puesto}`,
  }));

  const opcionesPostulante = postulantes.map((p) => ({
    valor: p.id_postulante,
    etiqueta: `${p.apellidos}, ${p.nombres} ${p.cv_archivo_url ? "(CV Adjuntado)" : "(Pendiente de CV)"}`,  
  }));

  return (
    <div className="postulaciones-page">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Reclutamiento" }]}
        enlace={Link}
        titulo="Postulaciones y Selección"
        descripcion="Gestión de convocatorias, recepción y evaluación de hojas de vida."
        acciones={
          <Boton
            variante="sutil"
            icono={RefreshCw}
            cargando={cargando}
            onClick={cargarPostulantes}
          >
            Actualizar datos
          </Boton>
        }
      />

      {errorCarga && (
        <Alerta tono="peligro" titulo="Error de sincronización" onCerrar={() => setErrorCarga(null)}>
          {errorCarga}
        </Alerta>
      )}

      {/* Selectores de contexto */}
      <div className="postulaciones-page__filtros">
        <Selector
          etiqueta="Convocatoria / Vacante"
          opciones={opcionesConvocatoria}
          value={convocatoriaId}
          onChange={(e) => setConvocatoriaId(e.target.value)}
        />
        <Selector
          etiqueta="Postulante asignado"
          opciones={opcionesPostulante}
          value={postulanteId}
          onChange={(e) => setPostulanteId(e.target.value)}
          disabled={postulantes.length === 0}
          textoVacio={postulantes.length === 0 ? "Sin candidatos registrados" : undefined}
        />
      </div>

      <div className="postulaciones-page__contenido">
        {/* Panel lateral: Resumen del postulante */}
        <div className="postulaciones-page__lateral">
          <Tarjeta titulo="Detalles del Candidato" nivelTitulo={3}>
            {postulanteActual ? (
              <div className="postulaciones-vacante-info">
                <p className="postulaciones-vacante-info__titulo">
                  {postulanteActual.nombres} {postulanteActual.apellidos}
                </p>
                <p className="postulaciones-vacante-info__desc">
                  CI/Doc: {postulanteActual.numero_documento}
                </p>
                <div className="postulaciones-vacante-info__meta">
                  <span><strong>Correo:</strong> {postulanteActual.correo_electronico}</span>
                  <span><strong>Teléfono:</strong> {postulanteActual.telefono_contacto}</span>
                  <div style={{ marginTop: "var(--space-2)" }}>
                    <Etiqueta tono={tieneCvCargado ? "exito" : "aviso"}>
                      {tieneCvCargado ? "Documento recibido" : "Pendiente de CV"}
                    </Etiqueta>
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ color: "var(--color-text-subtle)", fontSize: "var(--font-size-small)" }}>
                Seleccione un postulante para ver los detalles.
              </p>
            )}
          </Tarjeta>
        </div>

        {/* Panel principal dinámico */}
        <div className="postulaciones-page__panel-accion">
          {postulanteActual && (
            <>
              {tieneCvCargado ? (
                <Tarjeta titulo="Currículum Vitae Vinculado" nivelTitulo={3}>
                  <div className="cv-visualizador-caja">
                    <div className="cv-visualizador-caja__cabecera">
                      <div className="cv-visualizador-caja__estado">
                        <FileCheck className="ds-icono" style={{ color: "var(--color-success)" }} />
                        <span>Formato registrado: <strong>{esPdf ? "PDF" : "DOCX"}</strong></span>
                      </div>
                      <CvViewer
                        idPostulacion={postulanteActual.id_postulacion}
                        nombreCandidato={`${postulanteActual.nombres} ${postulanteActual.apellidos}`}
                        mimetype={postulanteActual.cv_formato_mimetype}
                      />
                    </div>

                    {esPdf ? (
                      <div className="cv-visualizador-caja__preview">
                        <iframe
                          src={postulacionApi.obtenerUrlCv(postulanteActual.id_postulacion, false)}
                          title="Previsualización CV"
                          className="cv-visualizador-caja__iframe"
                        />
                      </div>
                    ) : (
                      <div className="cv-visualizador-caja__docx-info">
                        <FileWarning className="ds-icono" style={{ width: 32, height: 32, color: "var(--color-warning)" }} />
                        <p><strong>Documento Microsoft Word (.docx)</strong></p>
                        <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-small)" }}>
                          Este formato no se previsualiza embebido. Use el botón de descarga para revisarlo localmente.
                        </p>
                        <Boton
                          variante="primario"
                          icono={Download}
                          onClick={() =>
                            postulacionApi.descargarCvBlob(
                              postulanteActual.id_postulacion,
                              `CV_${postulanteActual.apellidos}.docx`
                            )
                          }
                        >
                          Descargar archivo original
                        </Boton>
                      </div>
                    )}
                  </div>
                </Tarjeta>
              ) : (
                <Tarjeta titulo="Carga de Hoja de Vida" nivelTitulo={3}>
                  <CvUploadForm
                    idPostulacion={postulanteActual.id_postulacion}
                    tituloConvocatoria={convocatoriaActual?.titulo_puesto}
                    alCompletar={() => {
                      cargarPostulantes();
                    }}
                  />
                </Tarjeta>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}