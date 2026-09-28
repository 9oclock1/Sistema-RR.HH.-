import { Alerta } from "../../components/ui";
import { describirOrigen, duracionISO, formatearDuracion, formatearHora } from "./formato";

function DatoMarcaje({ titulo, marcaje }) {
  return (
    <div className="resumen-dato">
      <dt>{titulo}</dt>
      {marcaje ? (
        <>
          <dd className="resumen-valor">
            <time dateTime={marcaje.fecha_hora_marcaje}>{formatearHora(marcaje.fecha_hora_marcaje)}</time>
          </dd>
          <dd className="resumen-detalle">{describirOrigen(marcaje)}</dd>
        </>
      ) : (
        <dd className="resumen-valor resumen-vacio">Sin registro</dd>
      )}
    </div>
  );
}

export default function ResumenJornada({ jornada, ref }) {
  const { entrada, salida, minutos_trabajados: minutos, inconsistencia } = jornada;
  const pendiente = Boolean(inconsistencia);

  return (
    <div className="jornada-cierre">
      <Alerta
        ref={ref}
        tabIndex={-1}
        tono={pendiente ? "aviso" : "exito"}
        titulo={pendiente ? "Salida pendiente de justificación" : "Jornada completada"}
      >
        {inconsistencia ?? "Se registraron su entrada y su salida."}
      </Alerta>

      <dl className="resumen-jornada">
        <DatoMarcaje titulo="Entrada" marcaje={entrada} />
        <DatoMarcaje titulo="Salida" marcaje={salida} />
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
