import { porcentaje } from "./formato";

// Barra horizontal con una marca vertical en la meta, coloreada según el semáforo del valor.
function Barra({ valor, meta, escalaMax, semaforo }) {
  const ancho = valor === null ? 0 : Math.min(100, (valor / escalaMax) * 100);
  const posMeta = Math.min(100, (meta / escalaMax) * 100);
  return (
    <div className="da-barra">
      <div className={`da-barra__relleno da-barra__relleno--${semaforo ?? "sin_datos"}`} style={{ width: `${ancho}%` }} />
      <div className="da-barra__meta" style={{ left: `${posMeta}%` }} />
    </div>
  );
}

// Criterio 3: comparativo de KPI-04 y KPI-05 entre las sucursales del alcance consultado.
export default function ComparativoSucursales({ sucursales }) {
  const maxAusentismo = Math.max(10, ...sucursales.map((s) => s.ausentismo.valor ?? 0)) * 1.1;

  return (
    <table className="da-comparativo">
      <caption className="da-sutil">Comparativo de ausentismo y puntualidad por sucursal</caption>
      <thead>
        <tr>
          <th scope="col">Sucursal</th>
          <th scope="col">Ausentismo (meta ≤ 3 %)</th>
          <th scope="col">Puntualidad (meta ≥ 95 %)</th>
        </tr>
      </thead>
      <tbody>
        {sucursales.map((s) => (
          <tr key={s.id_sucursal ?? s.sucursal}>
            <th scope="row">{s.sucursal}</th>
            <td>
              <div className="da-celda-barra">
                <Barra valor={s.ausentismo.valor} meta={s.ausentismo.meta} escalaMax={maxAusentismo} semaforo={s.ausentismo.semaforo} />
                <span className="da-celda-barra__valor">{porcentaje(s.ausentismo.valor)}</span>
              </div>
            </td>
            <td>
              <div className="da-celda-barra">
                <Barra valor={s.puntualidad.valor} meta={s.puntualidad.meta} escalaMax={100} semaforo={s.puntualidad.semaforo} />
                <span className="da-celda-barra__valor">{porcentaje(s.puntualidad.valor)}</span>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
