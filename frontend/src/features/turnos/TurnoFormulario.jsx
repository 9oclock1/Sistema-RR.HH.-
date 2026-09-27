import { useEffect, useRef, useState } from "react";
import { Alerta, Boton, CampoTexto, Casilla, Modal, Selector } from "../../components/ui";
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

const ID_FORMULARIO = "turno-formulario";
const idCampo = (campo) => `turno-${campo}`;
const aNumero = (valor) => (valor === "" ? null : Number(valor));

export default function TurnoFormulario({ tipos, turno, onGuardar, onCancelar }) {
  const [valores, setValores] = useState(() => desdeTurno(turno));
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [enviosFallidos, setEnviosFallidos] = useState(0);
  const refResumen = useRef(null);

  // Solo tras un envío fallido: corregir un campo no debe mover el foco.
  useEffect(() => {
    if (enviosFallidos) refResumen.current?.focus();
  }, [enviosFallidos]);

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
      setEnviosFallidos((total) => total + 1);
      setEnviando(false);
    }
  };

  const propsCampo = (campo) => ({
    id: idCampo(campo),
    name: campo,
    etiqueta: ETIQUETAS[campo],
    value: valores[campo],
    onChange: cambiar,
    error: error?.campos[campo],
  });

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
    <Modal
      abierto
      titulo={turno ? "Editar turno" : "Nuevo turno"}
      onCerrar={onCancelar}
      bloqueado={enviando}
      pie={
        <>
          <Boton variante="sutil" onClick={onCancelar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton variante="primario" type="submit" form={ID_FORMULARIO} cargando={enviando}>
            {enviando ? "Guardando…" : "Guardar"}
          </Boton>
        </>
      }
    >
      <form id={ID_FORMULARIO} className="turno-formulario" onSubmit={enviar} noValidate>
        {mostrarResumen && (
          <Alerta
            ref={refResumen}
            tabIndex={-1}
            tono="peligro"
            role="alert"
            titulo={error.general ?? "Revise los campos marcados."}
          >
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
          </Alerta>
        )}

        <div className="turno-formulario__campos">
          <CampoTexto
            {...propsCampo("nombre")}
            className="turno-formulario__ancho"
            requerido
            maxLength={60}
            autoComplete="off"
            data-autofocus
          />
          <Selector
            {...propsCampo("id_tipo_jornada")}
            className="turno-formulario__ancho"
            requerido
            textoVacio="Seleccione…"
            opciones={tipos.map((tipo) => ({ valor: tipo.id_tipo_jornada, etiqueta: tipo.nombre }))}
          />
          <CampoTexto {...propsCampo("hora_inicio")} type="time" requerido />
          <CampoTexto {...propsCampo("hora_fin")} type="time" requerido />
          <CampoTexto
            {...propsCampo("minutos_refrigerio")}
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            ayuda="Se descuenta de las horas efectivas."
          />
          <CampoTexto
            {...propsCampo("minutos_tolerancia")}
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            ayuda="Minutos después del inicio en que el marcaje sigue siendo puntual."
          />
        </div>

        {turno && (
          <Casilla
            name="esta_activo"
            etiqueta="Activo"
            ayuda="Disponible para asignar a los empleados."
            checked={valores.esta_activo}
            onChange={cambiar}
          />
        )}

        {duracion > 0 && (
          <dl className="turno-resumen">
            <div>
              <dt>Duración</dt>
              <dd>
                {formatearMinutos(duracion)}
                {cruzaMedianoche(hora_inicio, hora_fin) && <span className="turnos-nota">cruza la medianoche</span>}
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
      </form>
    </Modal>
  );
}
