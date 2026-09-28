import { useState } from "react";
import { Link } from "react-router";
import { UserCheck, FileCheck } from "lucide-react";
import { EncabezadoPagina, Tarjeta } from "../../components/ui";
import CvUploadForm from "./components/CvUploadForm";
import CvViewer from "./components/CvViewer";
import "./PostulacionesPage.css";

const VACANTE_DEMO = {
  idConvocatoria: "11111111-1111-7111-8111-111111111111",
  titulo: "Desarrollador Full Stack Jr.",
  descripcion: "Búsqueda de desarrollador para soporte y desarrollo de módulos ERP.",
  vacantes: 2,
};

const POSTULANTE_DEMO = {
  idPostulante: "22222222-2222-7222-8222-222222222222",
  nombre: "Carlos Andrés Mendoza Salas",
  correo: "carlos.mendoza.test@example.com",
};

export default function PostulacionesPage() {
  const [postulacionRegistrada, setPostulacionRegistrada] = useState(null);

  return (
    <div className="postulaciones-page">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Reclutamiento" }]}
        enlace={Link}
        titulo="Postulaciones y Selección"
        descripcion="Gestión de convocatorias, recepción y evaluación de hojas de vida."
      />

      <div className="postulaciones-page__contenido">
        <div className="postulaciones-page__lateral">
          <Tarjeta titulo="Detalles de la Vacante" nivelTitulo={3}>
            <div className="postulaciones-vacante-info">
              <p className="postulaciones-vacante-info__titulo">{VACANTE_DEMO.titulo}</p>
              <p className="postulaciones-vacante-info__desc">{VACANTE_DEMO.descripcion}</p>
              <div className="postulaciones-vacante-info__meta">
                <span><strong>Postulante actual:</strong> {POSTULANTE_DEMO.nombre}</span>
                <span><strong>Correo:</strong> {POSTULANTE_DEMO.correo}</span>
              </div>
            </div>
          </Tarjeta>

          {postulacionRegistrada && (
            <Tarjeta titulo="Acciones de Reclutador" nivelTitulo={3} className="tarjeta-acciones-cv">
              <div className="postulaciones-acciones-reclutador">
                <div className="postulaciones-acciones-reclutador__info">
                  <FileCheck className="ds-icono" aria-hidden="true" />
                  <span>Documento vinculado disponible</span>
                </div>
                <CvViewer
                  idPostulacion={postulacionRegistrada.id_postulacion}
                  nombreCandidato={POSTULANTE_DEMO.nombre}
                  mimetype={postulacionRegistrada.cv_formato_mimetype}
                />
              </div>
            </Tarjeta>
          )}
        </div>

        <Tarjeta titulo="Carga de Currículum Vitae" nivelTitulo={3}>
          <CvUploadForm
            idConvocatoria={VACANTE_DEMO.idConvocatoria}
            idPostulante={POSTULANTE_DEMO.idPostulante}
            tituloConvocatoria={VACANTE_DEMO.titulo}
            alCompletar={(resultado) => {
              setPostulacionRegistrada(resultado.data?.postulacion);
            }}
          />

          {postulacionRegistrada && (
            <div className="postulaciones-resultado-exito">
              <UserCheck className="ds-icono" aria-hidden="true" />
              <span>
                Postulación confirmada con éxito. ID: <code>{postulacionRegistrada.id_postulacion}</code>
              </span>
            </div>
          )}
        </Tarjeta>
      </div>
    </div>
  );
}