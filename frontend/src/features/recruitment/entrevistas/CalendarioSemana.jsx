import { MapPin, Video } from "lucide-react";
import {
  HORA_FIN_CALENDARIO,
  HORA_INICIO_CALENDARIO,
  MODALIDAD,
  cabeceraDia,
  diaLargo,
  distribuirPorDia,
  estaActiva,
  nombreCandidato,
  partesLocales,
} from "./reglasEntrevista";

const HORAS = Array.from(
  { length: HORA_FIN_CALENDARIO - HORA_INICIO_CALENDARIO },
  (_, i) => `${String(HORA_INICIO_CALENDARIO + i).padStart(2, "0")}:00`,
);
const MINUTOS_VISIBLES = (HORA_FIN_CALENDARIO - HORA_INICIO_CALENDARIO) * 60;

// Posición vertical (en % del día visible) de una cita; las que salen del horario se recortan al borde.
function posicion({ inicio, fin }) {
  const desde = Math.max(inicio - HORA_INICIO_CALENDARIO * 60, 0);
  const hasta = Math.min(fin - HORA_INICIO_CALENDARIO * 60, MINUTOS_VISIBLES);
  return { top: `${(desde / MINUTOS_VISIBLES) * 100}%`, height: `${(Math.max(hasta - desde, 15) / MINUTOS_VISIBLES) * 100}%` };
}

function Cita({ item, onAbrir }) {
  const { cita, carril, carriles } = item;
  const activa = estaActiva(cita);
  const Icono = cita.modalidad === MODALIDAD.VIRTUAL ? Video : MapPin;
  const desde = partesLocales(cita.fecha_hora_programada).hora;
  const hasta = partesLocales(cita.fecha_hora_fin).hora;
  return (
    <button
      type="button"
      className={`en-cita en-cita--${cita.codigo_estado.toLowerCase()} ds-foco`}
      style={{ ...posicion(item), left: `${(carril / carriles) * 100}%`, width: `${100 / carriles}%` }}
      onClick={() => onAbrir(cita)}
      aria-label={`${desde} a ${hasta}, ${nombreCandidato(cita)}, ${cita.nombre_estado}, evaluador ${cita.nombre_entrevistador}`}
    >
      <span className="en-cita__hora">
        <Icono className="ds-icono" aria-hidden="true" />
        {desde}
      </span>
      <span className={`en-cita__nombre${activa ? "" : " en-cita__nombre--tachado"}`}>{nombreCandidato(cita)}</span>
      <span className="en-cita__evaluador">{cita.nombre_entrevistador}</span>
    </button>
  );
}

// RF-15.5: semana de lunes a domingo con las citas ubicadas por hora; en el teléfono se muestra como lista por día.
export default function CalendarioSemana({ dias, citas, hoy, onAbrir }) {
  const porDia = distribuirPorDia(citas);

  return (
    <>
      <div className="en-semana" role="grid" aria-label="Entrevistas de la semana">
        <div className="en-semana__fila en-semana__cabecera" role="row">
          <span className="en-semana__esquina" aria-hidden="true" />
          {dias.map((dia) => (
            <span
              key={dia}
              role="columnheader"
              className={`en-semana__dia${dia === hoy ? " en-semana__dia--hoy" : ""}`}
              aria-label={diaLargo(dia)}
            >
              {cabeceraDia(dia)}
            </span>
          ))}
        </div>
        <div className="en-semana__fila en-semana__cuerpo" role="row">
          <div className="en-semana__horas" aria-hidden="true">
            {HORAS.map((hora) => (
              <span key={hora} className="en-semana__hora">
                {hora}
              </span>
            ))}
          </div>
          {dias.map((dia) => (
            <div key={dia} role="gridcell" className={`en-semana__columna${dia === hoy ? " en-semana__columna--hoy" : ""}`}>
              {(porDia.get(dia) ?? []).map((item) => (
                <Cita key={item.cita.id_entrevista} item={item} onAbrir={onAbrir} />
              ))}
            </div>
          ))}
        </div>
      </div>

      <ol className="en-lista-semana" aria-label="Entrevistas de la semana por día">
        {dias.map((dia) => {
          const delDia = porDia.get(dia) ?? [];
          return (
            <li key={dia} className="en-lista-semana__dia">
              <h3 className={`en-lista-semana__titulo${dia === hoy ? " en-semana__dia--hoy" : ""}`}>{diaLargo(dia)}</h3>
              {delDia.length === 0 ? (
                <p className="pl-sutil">Sin entrevistas.</p>
              ) : (
                <ul className="en-agenda">
                  {delDia.map(({ cita }) => (
                    <li key={cita.id_entrevista}>
                      <button
                        type="button"
                        className={`en-agenda__item en-agenda__boton en-cita--${cita.codigo_estado.toLowerCase()} ds-foco`}
                        onClick={() => onAbrir(cita)}
                      >
                        <strong>
                          {partesLocales(cita.fecha_hora_programada).hora}–{partesLocales(cita.fecha_hora_fin).hora}
                        </strong>
                        <span>{nombreCandidato(cita)}</span>
                        <span className="pl-sutil">
                          {cita.nombre_entrevistador} · {cita.nombre_estado}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}
