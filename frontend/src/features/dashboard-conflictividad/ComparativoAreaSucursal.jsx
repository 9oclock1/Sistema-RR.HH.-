import { Etiqueta } from "../../components/ui";
import { estadoSemaforo } from "../dashboard-desempeno/dashboardDesempeno";
import { formatearIndice, formatearMinutos } from "./dashboardConflictividad";

function CeldaKpi({ kpi, formatear }) {
  const estado = estadoSemaforo(kpi.semaforo);
  return (
    <div className="dc-celda-kpi">
      <span className="dd-numero">{formatear(kpi.valor)}</span>
      <Etiqueta tono={estado.tono} icono={estado.icono}>
        {estado.corto}
      </Etiqueta>
    </div>
  );
}

// Criterio 1 (título de la Historia): comparar la conflictividad (KPI-03) y la puntualidad (KPI-06)
// entre áreas y sucursales del alcance consultado.
export default function ComparativoAreaSucursal({ grupos }) {
  return (
    <table className="dc-comparativo">
      <thead>
        <tr>
          <th scope="col">Sucursal</th>
          <th scope="col">Área</th>
          <th scope="col">KPI-03 · Índice de quejas (meta ≤ 2)</th>
          <th scope="col">KPI-06 · Minutos de atraso (meta ≤ 15)</th>
        </tr>
      </thead>
      <tbody>
        {grupos.map((g) => (
          <tr key={`${g.sucursal}|${g.area}`}>
            <th scope="row">{g.sucursal}</th>
            <td>{g.area}</td>
            <td>
              <CeldaKpi kpi={g.kpi_03} formatear={formatearIndice} />
            </td>
            <td>
              <CeldaKpi kpi={g.kpi_06} formatear={formatearMinutos} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
