import { CalendarDays } from "lucide-react";
import { Alerta, Boton, Esqueleto, Tarjeta } from "../../components/ui";
import { formatearDias, formatearFecha } from "./formato";
import "./vacaciones.css";

function Cargando() {
  return (
    <div className="vacaciones-saldo" aria-hidden="true">
      <Esqueleto ancho="40%" alto="calc(var(--size-row) * 1.5)" />
      <Esqueleto forma="bloque" alto="var(--space-3)" />
      <Esqueleto forma="bloque" alto="calc(var(--size-row) * 2)" />
    </div>
  );
}

const PARTES = [
  { clave: "gozados", etiqueta: "Gozados", modificador: "gozados" },
  { clave: "en_proceso", etiqueta: "En proceso de aprobación", modificador: "en-proceso" },
];

// Barra apilada: días gozados, en proceso y disponibles sobre el total acumulado.
function Barra({ dias }) {
  const { acumulados, gozados, en_proceso, disponibles } = dias;
  const porcentaje = (valor) => (acumulados > 0 ? Math.min(100, Math.max(0, (valor / acumulados) * 100)) : 0);
  return (
    <div
      className="vacaciones-barra"
      role="img"
      aria-label={`${formatearDias(disponibles)} disponibles, ${formatearDias(en_proceso)} en proceso y ${formatearDias(gozados)} gozados de ${formatearDias(acumulados)} acumulados`}
    >
      <span className="vacaciones-barra__tramo vacaciones-barra__tramo--gozados" style={{ width: `${porcentaje(gozados)}%` }} />
      <span className="vacaciones-barra__tramo vacaciones-barra__tramo--en-proceso" style={{ width: `${porcentaje(en_proceso)}%` }} />
      <span className="vacaciones-barra__tramo vacaciones-barra__tramo--disponibles" style={{ width: `${porcentaje(disponibles)}%` }} />
    </div>
  );
}

// Criterio 1: saldo neto con el desglose de acumulados por antigüedad, gozados y en proceso.
export default function SaldoVacaciones({ saldo, cargando, error, onReintentar, titulo = "Saldo de vacaciones", compacto = false }) {
  let contenido = null;
  if (cargando) {
    contenido = <Cargando />;
  } else if (error) {
    contenido = (
      <Alerta
        tono="peligro"
        role="alert"
        titulo="No se pudo cargar el saldo"
        acciones={
          onReintentar && (
            <Boton tamano="sm" onClick={onReintentar}>
              Reintentar
            </Boton>
          )
        }
      >
        {error.message}
      </Alerta>
    );
  } else if (saldo) {
    const { saldo: dias, dias_anuales, anios_servicio, proximo_periodo } = saldo;
    const proximo = `${proximo_periodo.dias} días el ${formatearFecha(proximo_periodo.fecha_acreditacion)}`;
    contenido = (
      <div className="vacaciones-saldo">
        <p className="vacaciones-saldo__principal">
          <span className="vacaciones-saldo__cifra" aria-live="polite">
            {dias.disponibles}
          </span>
          <span className="vacaciones-saldo__unidad">{dias.disponibles === 1 ? "día disponible" : "días disponibles"}</span>
        </p>

        <Barra dias={dias} />

        <dl className={`vacaciones-desglose${compacto ? " vacaciones-desglose--compacto" : ""}`}>
          <div>
            <dt>Acumulados por antigüedad</dt>
            <dd>{dias.acumulados}</dd>
          </div>
          {PARTES.map(({ clave, etiqueta, modificador }) => (
            <div key={clave}>
              <dt>
                <span className={`vacaciones-leyenda vacaciones-leyenda--${modificador}`} aria-hidden="true" />
                {etiqueta}
              </dt>
              <dd>{dias[clave]}</dd>
            </div>
          ))}
        </dl>

        <p className="vacaciones-nota">
          {anios_servicio === 0
            ? `Aún no cumple el primer año de servicio. Ganará ${proximo}.`
            : `${anios_servicio} ${anios_servicio === 1 ? "año" : "años"} de servicio: ${dias_anuales} días hábiles por año. Próximo período: ${proximo}.`}
        </p>
      </div>
    );
  }

  return (
    <Tarjeta
      titulo={titulo}
      nivelTitulo={2}
      className="vacaciones-tarjeta"
      aria-busy={cargando}
      acciones={<CalendarDays className="ds-icono" aria-hidden="true" />}
    >
      {contenido}
    </Tarjeta>
  );
}
