import { Clock3 } from "lucide-react";
import { Etiqueta } from "../../components/ui";
import { cierraPronto, describirPlazo, estadoConvocatoria, formatearAntiguedad, formatearFecha, formatearNota } from "./convocatorias";

export default function TarjetaConvocatoria({ convocatoria }) {
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
    </li>
  );
}
