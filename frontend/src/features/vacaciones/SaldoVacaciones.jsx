import { Tarjeta } from "../../components/ui";
import { formatearFecha, plural } from "./formato";

export default function SaldoVacaciones({ saldo }) {
  return (
    <Tarjeta titulo="Saldo de vacaciones" nivelTitulo={2} className="vacaciones-tarjeta">
      <dl className="vacaciones-saldo">
        <div className="vacaciones-saldo__principal">
          <dt>Días hábiles disponibles</dt>
          <dd>{saldo.dias_disponibles}</dd>
        </div>
        <div>
          <dt>Días ganados</dt>
          <dd>{saldo.dias_ganados}</dd>
        </div>
        <div>
          <dt>Pendientes y aprobados</dt>
          <dd>{saldo.dias_comprometidos}</dd>
        </div>
        <div>
          <dt>Antigüedad</dt>
          <dd>
            {plural(saldo.anios_servicio, "año", "años")}
            <span className="vacaciones-nota">desde el {formatearFecha(saldo.fecha_ingreso)}</span>
          </dd>
        </div>
      </dl>
    </Tarjeta>
  );
}
