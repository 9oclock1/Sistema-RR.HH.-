import { describirAvance, formatearPorcentaje, varianteAvance } from './planesAscenso';

// Criterio 4: porcentaje de avance del candidato, en barra y en texto.
export default function BarraAvance({ avance, nombre }) {
  const texto = formatearPorcentaje(avance.porcentaje);
  return (
    <div className="pa-avance">
      <div className="pa-avance__cabecera">
        <span className="pa-fuerte">{texto}</span>
        <span className="pa-sutil">{describirAvance(avance)}</span>
      </div>
      <div
        className="pa-barra"
        role="progressbar"
        aria-label={nombre ? `Avance del plan de ${nombre}` : 'Avance del plan'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={avance.porcentaje}
        aria-valuetext={`${texto}: ${describirAvance(avance)}`}
      >
        <span
          className={`pa-barra__relleno pa-barra__relleno--${varianteAvance(avance.porcentaje)}`}
          style={{ width: `${Math.min(100, avance.porcentaje)}%` }}
        />
      </div>
    </div>
  );
}
