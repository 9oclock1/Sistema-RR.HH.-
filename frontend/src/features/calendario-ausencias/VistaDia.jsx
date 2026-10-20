import { CalendarOff } from "lucide-react";
import { Alerta, EstadoVacio } from "../../components/ui";
import { formatearPeriodo } from "../solicitud-vacaciones/formato";
import { BloqueAusencia } from "./Cuadricula";
import { plural, textoDeAlerta } from "./calendario";

// Un solo día: quién falta, por qué y si la cobertura del área queda por debajo del umbral.
export default function VistaDia({ fecha, ausencias, estado, onAbrirAusencia }) {
  return (
    <div className="cal-dia" data-fecha={fecha}>
      {estado?.feriado && (
        <Alerta tono="info" titulo={`Feriado: ${estado.feriado}`}>
          Sin turno publicado, el personal no trabaja este día.
        </Alerta>
      )}
      {estado?.baja_cobertura && (
        <Alerta tono="aviso" role="alert" titulo="Baja cobertura">
          <ul className="cal-dia__alertas">
            {estado.alertas.map((alerta) => (
              <li key={alerta.id_departamento ?? alerta.area}>{textoDeAlerta(alerta)}</li>
            ))}
          </ul>
        </Alerta>
      )}

      {ausencias.length === 0 ? (
        <EstadoVacio icono={CalendarOff} titulo="Nadie está ausente este día" mensaje="No hay vacaciones, permisos ni licencias aprobadas." />
      ) : (
        <>
          <p className="cal-dia__resumen">{plural(ausencias.length, "ausencia aprobada", "ausencias aprobadas")}</p>
          <ul className="cal-dia__lista">
            {ausencias.map((ausencia) => (
              <li key={ausencia.clave} className="cal-dia__fila">
                <BloqueAusencia ausencia={ausencia} onAbrir={onAbrirAusencia} />
                <span className="cal-dia__datos">
                  <span className="cal-dia__cargo">{[ausencia.empleado.cargo, ausencia.empleado.area].filter(Boolean).join(" · ")}</span>
                  <span className="cal-dia__periodo">{formatearPeriodo(ausencia.fecha_inicio, ausencia.fecha_fin)}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
