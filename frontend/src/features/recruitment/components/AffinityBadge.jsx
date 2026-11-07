import { AlertTriangle, CheckCircle, TrendingUp } from "lucide-react";
import "./AffinityBadge.css";

/**
 * AffinityBadge
 * Badge visual de porcentaje de afinidad (0% a 100%) y condición de aptitud.
 * Sigue rigurosamente DESIGN.md: tokens CSS, tipografía Inter y trazo de iconos Lucide.
 *
 * @param {number|null} porcentaje - Porcentaje numérico (0 - 100)
 * @param {boolean} [esApto=true] - Condición de aptitud según requisitos excluyentes
 * @param {number|null} [ranking=null] - Posición en el ranking de postulantes
 * @param {Function} [onClick] - Si se provee, el badge se comporta como botón interactivo
 */
export default function AffinityBadge({
  porcentaje,
  esApto = true,
  ranking = null,
  onClick,
}) {
  if (porcentaje === null || porcentaje === undefined) {
    return (
      <span className="affinity-badge affinity-badge--pendiente" title="Pendiente de análisis curricular">
        <span className="affinity-badge__valor">—</span>
        <span className="affinity-badge__etiqueta">Pendiente</span>
      </span>
    );
  }

  const score = Math.round(Number(porcentaje));
  let tono = "peligro";
  if (score >= 75) tono = "exito";
  else if (score >= 50) tono = "aviso";

  if (!esApto) {
    tono = "peligro";
  }

  const Contenedor = onClick ? "button" : "span";

  return (
    <Contenedor
      type={onClick ? "button" : undefined}
      className={`affinity-badge affinity-badge--${tono} ${onClick ? "affinity-badge--interactivo" : ""}`}
      onClick={onClick}
      title={
        !esApto
          ? "No cumple con requisitos excluyentes obligatorios. Haga clic para ver detalles."
          : `Afinidad: ${score}%. Haga clic para ver desglose comparativo.`
      }
      aria-label={`Afinidad ${score}%, ${esApto ? "condición apto" : "condición no apto"}`}
    >
      <div className="affinity-badge__contenido">
        {!esApto ? (
          <AlertTriangle className="ds-icono affinity-badge__icono" aria-hidden="true" />
        ) : score >= 75 ? (
          <CheckCircle className="ds-icono affinity-badge__icono" aria-hidden="true" />
        ) : (
          <TrendingUp className="ds-icono affinity-badge__icono" aria-hidden="true" />
        )}
        <span className="affinity-badge__valor">{score}%</span>
      </div>

      <div className="affinity-badge__meta">
        {!esApto ? (
          <span className="affinity-badge__estado affinity-badge__estado--no-apto">No Apto</span>
        ) : ranking ? (
          <span className="affinity-badge__ranking">#{ranking}</span>
        ) : null}
      </div>
    </Contenedor>
  );
}