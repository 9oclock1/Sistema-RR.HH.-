import { Clock3, Send } from "lucide-react";
import { Boton, Etiqueta } from "../../components/ui";
import {
  cierraPronto,
  describirPermanencia,
  describirPlazo,
  estadoConvocatoria,
  estadoPostulacion,
  formatearAntiguedad,
  formatearFecha,
  formatearNota,
  formatearPuntaje,
} from "./convocatorias";

// KAN-81: resultado de la validación de méritos de la postulación del empleado.
function MiPostulacion({ postulacion }) {
  const estado = estadoPostulacion(postulacion.estado_postulacion);
  return (
    <div className="cv-postulacion" role="status" aria-label="Mi postulación">
      <div className="cv-postulacion__encabezado">
        <span className="cv-postulacion__titulo">Mi postulación</span>
        <Etiqueta tono={estado.tono} icono={estado.icono}>
          {estado.texto}
        </Etiqueta>
      </div>
      {postulacion.estado_postulacion === "PENDIENTE_VALIDACION" ? (
        <p className="cv-sutil">
          Quedó registrada. Recursos Humanos completará la validación de méritos en cuanto se pueda consultar su evaluación de desempeño.
        </p>
      ) : (
        <p className="cv-sutil">
          Permanencia: {describirPermanencia(postulacion.meses_permanencia)} · Última evaluación:{" "}
          {postulacion.nota_ultima_evaluacion === null ? "sin evaluaciones cerradas" : formatearNota(postulacion.nota_ultima_evaluacion)}
          {postulacion.estado_postulacion === "APTO" && ` · Puntaje de méritos: ${formatearPuntaje(postulacion.puntaje_meritos)}`}
        </p>
      )}
      {postulacion.motivos_no_apto?.length > 0 && (
        <ul className="cv-motivos" aria-label="Motivos por los que no es apto">
          {postulacion.motivos_no_apto.map((motivo) => (
            <li key={motivo}>{motivo}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function TarjetaConvocatoria({ convocatoria, onPostular, postulando = false }) {
  const estado = estadoConvocatoria(convocatoria.estado);
  const urgente = cierraPronto(convocatoria);

  return (
    <li className={`cv-tarjeta cv-tarjeta--${convocatoria.estado.toLowerCase()}`}>
      <div className="cv-tarjeta__encabezado">
        <h3 className="cv-tarjeta__titulo">{convocatoria.titulo}</h3>
        <Etiqueta tono={estado.tono} icono={estado.icono}>
          {estado.texto}
        </Etiqueta>
      </div>
      <p className="cv-sutil">
        {convocatoria.cargo} · {convocatoria.departamento} · {convocatoria.sucursal}
      </p>
      <p className="cv-tarjeta__requisitos">{convocatoria.descripcion_requisitos}</p>
      <dl className="cv-datos">
        <div className="cv-datos__dato">
          <dt>Antigüedad mínima</dt>
          <dd>{formatearAntiguedad(convocatoria.meses_antiguedad_minima)}</dd>
        </div>
        <div className="cv-datos__dato">
          <dt>Nota mínima de desempeño</dt>
          <dd>{formatearNota(convocatoria.nota_minima_desempeno)}</dd>
        </div>
        <div className="cv-datos__dato">
          <dt>Postulaciones</dt>
          <dd>
            Del {formatearFecha(convocatoria.fecha_inicio_postulacion)} al {formatearFecha(convocatoria.fecha_cierre_postulacion)}
          </dd>
        </div>
      </dl>
      <p className={`cv-plazo${urgente ? " cv-plazo--urgente" : ""}`}>
        <Clock3 className="ds-icono" aria-hidden="true" />
        {describirPlazo(convocatoria)}
      </p>
      {convocatoria.mi_postulacion ? (
        <MiPostulacion postulacion={convocatoria.mi_postulacion} />
      ) : (
        onPostular &&
        convocatoria.estado === "ABIERTA" && (
          <div>
            <Boton
              variante="primario"
              icono={Send}
              cargando={postulando}
              onClick={() => onPostular(convocatoria)}
              aria-label={`Postularme a ${convocatoria.titulo}`}
            >
              Postularme
            </Boton>
          </div>
        )
      )}
    </li>
  );
}
