import { useState } from "react";
import { Link } from "react-router";
import { Briefcase, UserCheck } from "lucide-react";
import { EncabezadoPagina, Tarjeta } from "../../components/ui";
import CvUploadForm from "./components/CvUploadForm";
import "./PostulacionesPage.css";

// Datos de prueba correspondientes al seed_test_data.sql
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
  const [postulacionExitosa, setPostulacionExitosa] = useState(null);

  return (
    <div className="postulaciones-page">
      <EncabezadoPagina
        migas={[{ etiqueta: "Inicio", href: "/" }, { etiqueta: "Reclutamiento" }]}
        enlace={Link}
        titulo="Postulaciones y Selección"
        descripcion="Gestión de convocatorias, recepción y evaluación de hojas de vida."
      />

      <div className="postulaciones-page__contenido">
        <Tarjeta titulo="Información de la Vacante" nivelTitulo={3}>
          <div className="postulaciones-vacante-info">
            <p className="postulaciones-vacante-info__titulo">{VACANTE_DEMO.titulo}</p>
            <p className="postulaciones-vacante-info__desc">{VACANTE_DEMO.descripcion}</p>
            <div className="postulaciones-vacante-info__meta">
              <span><strong>Candidato simulado:</strong> {POSTULANTE_DEMO.nombre}</span>
              <span><strong>Email:</strong> {POSTULANTE_DEMO.correo}</span>
            </div>
          </div>
        </Tarjeta>

        <Tarjeta titulo="Formulario de Postulación Digital" nivelTitulo={3}>
          <CvUploadForm
            idConvocatoria={VACANTE_DEMO.idConvocatoria}
            idPostulante={POSTULANTE_DEMO.idPostulante}
            tituloConvocatoria={VACANTE_DEMO.titulo}
            alCompletar={(resultado) => setPostulacionExitosa(resultado)}
          />

          {postulacionExitosa && (
            <div className="postulaciones-resultado-exito">
              <UserCheck className="ds-icono" aria-hidden="true" />
              <span>
                Postulación registrada con ID: <code>{postulacionExitosa.data?.postulacion?.id_postulacion}</code>
              </span>
            </div>
          )}
        </Tarjeta>
      </div>
    </div>
  );
}