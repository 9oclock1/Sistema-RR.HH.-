import { useEffect, useRef, useState } from "react";
import { cruzaMedianoche, formatearMinutos, horaCorta, minutosDuracion, sumarMinutos } from "./jornada";

const ETIQUETAS = {
  nombre: "Nombre",
  id_tipo_jornada: "Tipo de jornada",
  hora_inicio: "Hora de inicio",
  hora_fin: "Hora de fin",
  minutos_refrigerio: "Refrigerio (minutos)",
  minutos_tolerancia: "Tolerancia de atraso (minutos)",
  esta_activo: "Activo",
};

const VACIO = {
  nombre: "",
  id_tipo_jornada: "",
  hora_inicio: "",
  hora_fin: "",
  minutos_refrigerio: 0,
  minutos_tolerancia: 0,
  esta_activo: true,
};

const desdeTurno = (turno) =>
  turno
    ? {
        nombre: turno.nombre,
        id_tipo_jornada: String(turno.id_tipo_jornada),
        hora_inicio: horaCorta(turno.hora_inicio),
        hora_fin: horaCorta(turno.hora_fin),
        minutos_refrigerio: turno.minutos_refrigerio,
        minutos_tolerancia: turno.minutos_tolerancia,
        esta_activo: turno.esta_activo,
      }
    : VACIO;

const AYUDA_REFRIGERIO = "Se descuenta de las horas efectivas.";
const AYUDA_TOLERANCIA = "Minutos después del inicio en que el marcaje sigue siendo puntual.";

const idCampo = (campo) => `turno-${campo}`;
const aNumero = (valor) => (valor === "" ? null : Number(valor));

function Campo({ campo, ayuda, error, children }) {
  const id = idCampo(campo);
  return (
    <div className="campo">
      <label htmlFor={id}>{ETIQUETAS[campo]}</label>
      {children}
      {ayuda && (
        <p id={`${id}-ayuda`} className="campo-ayuda">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="campo-error">
          {error}
        </p>
      )}
    </div>
  );
}

export default function TurnoFormulario({ tipos, turno, onGuardar, onCancelar }) {
  const [valores, setValores] = useState(() => desdeTurno(turno));
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const refResumen = useRef(null);

  useEffect(() => {
    if (error) refResumen.current?.focus();
  }, [error]);

  const cambiar = (evento) => {
    const { name, type, value, checked } = evento.target;
    setValores((actuales) => ({ ...actuales, [name]: type === "checkbox" ? checked : value }));
    setError((actual) => {
      if (!actual?.campos[name]) return actual;
      const campos = { ...actual.campos };
      delete campos[name];
      return { ...actual, campos };
    });
  };

  const enviar = async (evento) => {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await onGuardar({
        ...valores,
        id_tipo_jornada: aNumero(valores.id_tipo_jornada),
        minutos_refrigerio: aNumero(valores.minutos_refrigerio),
        minutos_tolerancia: aNumero(valores.minutos_tolerancia),
      });
    } catch (errorGuardado) {
      const campos = Object.fromEntries((errorGuardado.detalles ?? []).map((d) => [d.campo, d.mensaje]));
      setError({ general: Object.keys(campos).length ? null : errorGuardado.message, campos });
      setEnviando(false);
    }
  };

  const propsCampo = (campo, ayuda) => {
    const descripciones = [ayuda && `${idCampo(campo)}-ayuda`, error?.campos[campo] && `${idCampo(campo)}-error`];
    return {
      id: idCampo(campo),
      name: campo,
      value: valores[campo],
      onChange: cambiar,
      "aria-invalid": error?.campos[campo] ? true : undefined,
      "aria-describedby": descripciones.filter(Boolean).join(" ") || undefined,
    };
  };

  const enfocar = (evento, campo) => {
    evento.preventDefault();
    document.getElementById(idCampo(campo))?.focus();
  };

  const erroresCampos = Object.entries(error?.campos ?? {});
  const mostrarResumen = Boolean(error?.general) || erroresCampos.length > 0;
  const { hora_inicio, hora_fin } = valores;
  const duracion = hora_inicio && hora_fin ? minutosDuracion(hora_inicio, hora_fin) : 0;
  const efectivos = duracion - (Number(valores.minutos_refrigerio) || 0);

  return (
    <form className="tarjeta formulario" onSubmit={enviar} noValidate>
      <h2>{turno ? "Editar turno" : "Nuevo turno"}</h2>

      {mostrarResumen && (
        <div ref={refResumen} className="alerta alerta-error" role="alert" tabIndex={-1}>
          <div>
            <p className="alerta-titulo">{error.general ?? "Revise los campos marcados."}</p>
            {erroresCampos.length > 0 && (
              <ul>
                {erroresCampos.map(([campo, mensaje]) => (
                  <li key={campo}>
                    <a href={`#${idCampo(campo)}`} onClick={(evento) => enfocar(evento, campo)}>
                      {ETIQUETAS[campo]}: {mensaje}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="campos">
        <Campo campo="nombre" error={error?.campos.nombre}>
          <input {...propsCampo("nombre")} maxLength={60} autoComplete="off" autoFocus />
        </Campo>
        <Campo campo="id_tipo_jornada" error={error?.campos.id_tipo_jornada}>
          <select {...propsCampo("id_tipo_jornada")}>
            <option value="">Seleccione…</option>
            {tipos.map((tipo) => (
              <option key={tipo.id_tipo_jornada} value={tipo.id_tipo_jornada}>
                {tipo.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo campo="hora_inicio" error={error?.campos.hora_inicio}>
          <input type="time" {...propsCampo("hora_inicio")} />
        </Campo>
        <Campo campo="hora_fin" error={error?.campos.hora_fin}>
          <input type="time" {...propsCampo("hora_fin")} />
        </Campo>
        <Campo campo="minutos_refrigerio" ayuda={AYUDA_REFRIGERIO} error={error?.campos.minutos_refrigerio}>
          <input type="number" inputMode="numeric" min="0" step="1" {...propsCampo("minutos_refrigerio", AYUDA_REFRIGERIO)} />
        </Campo>
        <Campo campo="minutos_tolerancia" ayuda={AYUDA_TOLERANCIA} error={error?.campos.minutos_tolerancia}>
          <input type="number" inputMode="numeric" min="0" step="1" {...propsCampo("minutos_tolerancia", AYUDA_TOLERANCIA)} />
        </Campo>
      </div>

      {turno && (
        <label className="campo-check">
          <input type="checkbox" name="esta_activo" checked={valores.esta_activo} onChange={cambiar} />
          <span>Activo (disponible para asignación)</span>
        </label>
      )}

      {duracion > 0 && (
        <dl className="resumen">
          <div>
            <dt>Duración</dt>
            <dd>
              {formatearMinutos(duracion)}
              {cruzaMedianoche(hora_inicio, hora_fin) && " · cruza la medianoche"}
            </dd>
          </div>
          <div>
            <dt>Horas efectivas</dt>
            <dd>{efectivos > 0 ? formatearMinutos(efectivos) : "—"}</dd>
          </div>
          <div>
            <dt>Puntual hasta</dt>
            <dd>{sumarMinutos(hora_inicio, Number(valores.minutos_tolerancia) || 0)}</dd>
          </div>
        </dl>
      )}

      <div className="formulario-acciones">
        <button type="button" className="boton" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </button>
        <button type="submit" className="boton boton-primario" disabled={enviando}>
          {enviando ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}
