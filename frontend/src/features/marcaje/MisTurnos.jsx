import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { consultarMisTurnos } from "../../api/marcajes";
import { Alerta, Boton, Esqueleto, EstadoVacio, Etiqueta, Tarjeta } from "../../components/ui";

const fechaLarga = new Intl.DateTimeFormat("es-BO", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });

const formatearDia = (fecha) => fechaLarga.format(new Date(`${fecha}T00:00:00Z`));

function diasEntre(desde, hasta) {
  const dias = [];
  for (let dia = new Date(`${desde}T00:00:00Z`); dia.toISOString().slice(0, 10) <= hasta; dia.setUTCDate(dia.getUTCDate() + 1)) {
    dias.push(dia.toISOString().slice(0, 10));
  }
  return dias;
}

function DescripcionTurno({ asignado }) {
  if (!asignado) return <span className="mis-turnos__sin">Sin turno publicado</span>;
  if (asignado.descanso) return <span>Descanso</span>;
  const { nombre, hora_inicio, hora_fin } = asignado.turno;
  return (
    <span>
      {nombre}{" "}
      <span className="mis-turnos__horario">
        <time>{hora_inicio}</time>–<time>{hora_fin}</time>
      </span>
    </span>
  );
}

// Turnos del rol publicado por el supervisor, para consultar antes de marcar.
export default function MisTurnos({ idEmpleado }) {
  const [resultado, setResultado] = useState(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    consultarMisTurnos(idEmpleado)
      .then((datos) => vigente && setResultado({ datos }))
      .catch((error) => vigente && setResultado({ error: error.message }));
    return () => {
      vigente = false;
    };
  }, [idEmpleado, intento]);

  const reintentar = () => {
    setResultado(null);
    setIntento((n) => n + 1);
  };

  let contenido;
  if (!resultado) {
    contenido = (
      <div aria-busy="true">
        <p className="ds-solo-lector" role="status">
          Cargando sus turnos…
        </p>
        <Esqueleto />
        <Esqueleto />
        <Esqueleto />
      </div>
    );
  } else if (resultado.error) {
    contenido = (
      <Alerta
        tono="peligro"
        role="alert"
        titulo="No se pudieron cargar sus turnos"
        acciones={
          <Boton tamano="sm" onClick={reintentar}>
            Reintentar
          </Boton>
        }
      >
        {resultado.error}
      </Alerta>
    );
  } else if (resultado.datos.turnos.length === 0) {
    contenido = (
      <EstadoVacio
        icono={CalendarDays}
        titulo="Aún no tiene turnos publicados"
        mensaje="Su supervisor todavía no publicó el rol de turnos de estos días."
      />
    );
  } else {
    const { hoy, desde, hasta, turnos } = resultado.datos;
    const porFecha = new Map(turnos.map((t) => [t.fecha, t]));
    contenido = (
      <ol className="mis-turnos">
        {diasEntre(desde, hasta).map((fecha) => (
          <li key={fecha} className={`mis-turnos__dia ${fecha === hoy ? "mis-turnos__dia--hoy" : ""}`}>
            <span className="mis-turnos__fecha">
              <time dateTime={fecha}>{formatearDia(fecha)}</time>
              {fecha === hoy && <Etiqueta tono="info">Hoy</Etiqueta>}
            </span>
            <DescripcionTurno asignado={porFecha.get(fecha)} />
          </li>
        ))}
      </ol>
    );
  }

  return (
    <Tarjeta className="marcaje-tarjeta" titulo="Mis turnos" nivelTitulo={2}>
      {contenido}
    </Tarjeta>
  );
}
