import { CircleCheck, TriangleAlert } from "lucide-react";
import { Etiqueta } from "../../components/ui";
import { formatearPorcentaje } from "./plantilla";

// Muestra en vivo cuánto suman los pesos y cuánto falta o sobra para llegar a 100 %.
export default function BalancePesos({ balance }) {
  const { suma, diferencia, balanceado } = balance;
  const estado = balanceado
    ? { tono: "exito", icono: CircleCheck, texto: "Balanceado" }
    : diferencia > 0
      ? { tono: "aviso", icono: TriangleAlert, texto: `Faltan ${formatearPorcentaje(diferencia)}` }
      : { tono: "peligro", icono: TriangleAlert, texto: `Sobran ${formatearPorcentaje(-diferencia)}` };

  return (
    <div className={`plantilla-balance plantilla-balance--${estado.tono}`} role="status" aria-live="polite">
      <div className="plantilla-balance__texto">
        <span className="plantilla-balance__titulo">Suma de pesos</span>
        <span className="plantilla-balance__valor">
          {formatearPorcentaje(suma)} <span className="plantilla-balance__meta">de 100 %</span>
        </span>
      </div>
      <div className="plantilla-balance__barra" aria-hidden="true">
        <span style={{ width: `${Math.min(suma, 100)}%` }} />
      </div>
      <Etiqueta tono={estado.tono} icono={estado.icono}>
        {estado.texto}
      </Etiqueta>
    </div>
  );
}
