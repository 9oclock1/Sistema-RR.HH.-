import { Award, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { Avatar, Boton, EstadoVacio, Etiqueta, Tabla, TextoTruncado } from "../../components/ui";
import RankingBadge from "./RankingBadge";
import "./CandidateRankingTable.css";

function mapearTonoScore(score = 0) {
  if (score >= 80) return "alto";
  if (score >= 50) return "medio";
  return "bajo";
}

function formatearFecha(fechaIso) {
  if (!fechaIso) return "—";
  try {
    return new Intl.DateTimeFormat("es-BO", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(fechaIso));
  } catch {
    return String(fechaIso);
  }
}

export default function CandidateRankingTable({
  candidatos = [],
  paginacion = {},
  cargando = false,
  tituloConvocatoria = "",
  alCambiarPagina,
}) {
  const columnas = [
    {
      clave: "posicion_ranking",
      titulo: "Puesto",
      ancho: "75px",
      celda: (fila) => <RankingBadge posicion={fila.posicion_ranking} />,
    },
    {
      clave: "score_afinidad",
      titulo: "Afinidad",
      ancho: "130px",
      celda: (fila) => {
        const score = fila.score_afinidad || 0;
        const tono = mapearTonoScore(score);
        return (
          <div className="ranking-score-celda">
            <span className="ranking-score-valor">{score}%</span>
            <div className="ranking-score-barra">
              <div
                className={`ranking-score-progreso ranking-score-progreso--${tono}`}
                style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      clave: "postulante",
      titulo: "Postulante",
      ancho: "200px",
      celda: (fila) => {
        const nombreCompleto = `${fila.nombres ?? ""} ${fila.apellidos ?? ""}`.trim();
        return (
          <div className="postulante-fila-nombre">
            <Avatar nombre={nombreCompleto} tamano="md" decorativo />
            <div>
              <TextoTruncado>{nombreCompleto}</TextoTruncado>
              <div style={{ fontSize: "11px", color: "var(--color-text-subtle)" }}>
                {fila.correo_electronico}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      clave: "anios_experiencia",
      titulo: "Experiencia",
      ancho: "110px",
      celda: (fila) => (
        <span>{fila.anios_experiencia ? `${fila.anios_experiencia} años` : "Sin reg."}</span>
      ),
    },
    {
      clave: "etapa",
      titulo: "Etapa actual",
      ancho: "130px",
      celda: (fila) => <Etiqueta tono="info">{fila.nombre_etapa || "Postulado"}</Etiqueta>,
    },
    {
      clave: "fecha_postulacion",
      titulo: "Fecha postulación",
      ancho: "130px",
      celda: (fila) => (
        <span className="postulante-fecha">{formatearFecha(fila.fecha_postulacion)}</span>
      ),
    },
    {
      clave: "cv",
      titulo: "CV",
      ancho: "80px",
      celda: (fila) =>
        fila.cv_archivo_url ? (
          <Boton
            as="a"
            href={fila.cv_archivo_url}
            target="_blank"
            rel="noopener noreferrer"
            variante="sutil"
            tamano="sm"
            soloIcono
            icono={FileText}
            aria-label={`Ver CV de ${fila.nombres}`}
          />
        ) : (
          <span style={{ color: "var(--color-text-subtle)", fontSize: "12px" }}>—</span>
        ),
    },
  ];

  return (
    <div className="ranking-contenedor">
      <Tabla
        className="postulantes-tabla"
        descripcion={`Ranking de postulantes para ${tituloConvocatoria || "convocatoria"}`}
        columnas={columnas}
        filas={candidatos}
        claveFila="id_postulacion"
        cargando={cargando}
        filasCargando={5}
        vacio={
          <EstadoVacio
            icono={Award}
            titulo="Sin ranking disponible"
            mensaje={
              tituloConvocatoria
                ? `Aún no hay postulantes evaluados con score para la convocatoria «${tituloConvocatoria}».`
                : "Seleccione una convocatoria para ver el ranking de candidatos."
            }
          />
        }
      />

      {/* Controles de paginación */}
      {paginacion?.total_paginas > 1 && (
        <footer className="ranking-paginacion">
          <span style={{ fontSize: "var(--font-size-small)", color: "var(--color-text-subtle)" }}>
            Página {paginacion.pagina_actual} de {paginacion.total_paginas} ({paginacion.total_registros} candidatos)
          </span>
          <div style={{ display: "flex", gap: "var(--space-1)" }}>
            <Boton
              tamano="sm"
              variante="predeterminado"
              icono={ChevronLeft}
              disabled={!paginacion.tiene_anterior || cargando}
              onClick={() => alCambiarPagina && alCambiarPagina(paginacion.pagina_actual - 1)}
            >
              Anterior
            </Boton>
            <Boton
              tamano="sm"
              variante="predeterminado"
              icono={ChevronRight}
              disabled={!paginacion.tiene_siguiente || cargando}
              onClick={() => alCambiarPagina && alCambiarPagina(paginacion.pagina_actual + 1)}
            >
              Siguiente
            </Boton>
          </div>
        </footer>
      )}
    </div>
  );
}