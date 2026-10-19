import { Alerta } from "../../components/ui";
import {
  describirAtraso,
  describirOrigen,
  describirSalidaAnticipada,
  duracionISO,
  formatearDuracion,
  formatearHora,
} from "./formato";

function DatoMarcaje({ titulo, marcaje, nota }) {
  return (
    <div className="resumen-dato">
      <dt>{titulo}</dt>
      {marcaje ? (
        <>
          <dd className="resumen-valor">
            <time dateTime={marcaje.fecha_hora_marcaje}>{formatearHora(marcaje.fecha_hora_marcaje)}</time>
          </dd>
          <dd className="resumen-detalle">{describirOrigen(marcaje)}</dd>
          {nota && <dd className="resumen-detalle resumen-nota">{nota}</dd>}
        </>
      ) : (
        <dd className="resumen-valor resumen-vacio">Sin registro</dd>
      )}
    </div>
  );
}

export default function ResumenJornada({ jornada, ref }) {
  const { entrada, salida, minutos_trabajados: minutos, inconsistencia, atraso, salida_anticipada: anticipada } = jornada;
  const pendiente = Boolean(inconsistencia);
  const observaciones = [atraso && describirAtraso(atraso), anticipada && describirSalidaAnticipada(anticipada)].filter(Boolean);

  let titulo = "Jornada completada";
  if (pendiente) titulo = "Salida pendiente de justificación";
  else if (observaciones.length) titulo = "Jornada completada con observaciones";

  return (
    <div className="jornada-cierre">
      <Alerta ref={ref} tabIndex={-1} tono={pendiente || observaciones.length ? "aviso" : "exito"} titulo={titulo}>
        {pendiente ? (
          inconsistencia
        ) : observaciones.length ? (
          <ul className="resumen-observaciones">
            {observaciones.map((texto) => (
              <li key={texto}>{texto}</li>
            ))}
          </ul>
        ) : (
          "Se registraron su entrada y su salida."
        )}
      </Alerta>

      <dl className="resumen-jornada">
        <DatoMarcaje
          titulo="Entrada"
          marcaje={entrada}
          nota={atraso && `${formatearDuracion(atraso.minutos)} de atraso`}
        />
        <DatoMarcaje
          titulo="Salida"
          marcaje={salida}
          nota={anticipada && `${formatearDuracion(anticipada.minutos)} antes del fin`}
        />
        <div className="resumen-dato">
          <dt>Horas trabajadas</dt>
          {typeof minutos === "number" ? (
            <dd className="resumen-valor">
              <time dateTime={duracionISO(minutos)}>{formatearDuracion(minutos)}</time>
            </dd>
          ) : (
            <>
              <dd className="resumen-valor resumen-vacio">Sin calcular</dd>
              <dd className="resumen-detalle">Falta la entrada</dd>
            </>
          )}
        </div>
      </dl>
    </div>
  );
}
