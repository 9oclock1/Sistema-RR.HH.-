import { useEffect, useState } from "react";
import { CalendarClock, MapPin, Video } from "lucide-react";
import { Alerta, Boton, CampoAreaTexto, CampoTexto, Modal, Selector } from "../../../components/ui";
import { agendarEntrevista, obtenerAgendaEntrevistas, reprogramarEntrevista } from "../../../api/entrevistas";
import {
  DURACIONES,
  DURACION_PREDETERMINADA,
  HORAS,
  MAX_LUGAR,
  MAX_MOTIVO,
  MODALIDAD,
  citasQueSeCruzan,
  esUrlValida,
  estaActiva,
  hoyLocal,
  nombreCandidato,
  partesLocales,
  sumarDias,
} from "./reglasEntrevista";

const errorDeCampo = (error, campo) => error?.errores?.find((e) => e.campo === campo)?.mensaje;

function valoresIniciales(entrevista) {
  if (!entrevista) {
    return { fecha: "", hora: "", duracion: DURACION_PREDETERMINADA, modalidad: "", lugar: "", idEvaluador: "" };
  }
  const { fecha, hora } = partesLocales(entrevista.fecha_hora_programada);
  return {
    fecha,
    hora,
    duracion: String(entrevista.duracion_minutos),
    modalidad: entrevista.modalidad,
    lugar: entrevista.lugar_enlace,
    idEvaluador: entrevista.id_entrevistador_empleado,
  };
}

// Validación previa al envío; el backend repite todas las reglas.
function validar(valores) {
  const errores = [];
  const agregar = (campo, mensaje) => errores.push({ campo, mensaje });
  if (!valores.fecha) agregar("fecha", "Elija la fecha de la entrevista.");
  if (!valores.hora) agregar("hora", "Elija la hora de inicio.");
  if (valores.fecha && valores.hora) {
    const ahora = partesLocales(Date.now());
    if (`${valores.fecha}T${valores.hora}` <= `${ahora.fecha}T${ahora.hora}`) {
      agregar("hora", "La entrevista debe programarse para un momento posterior al actual.");
    }
  }
  if (!valores.modalidad) agregar("modalidad", "Indique si la entrevista es presencial o virtual.");
  if (!valores.lugar.trim()) {
    agregar("lugar_enlace", valores.modalidad === MODALIDAD.VIRTUAL ? "Indique el enlace de la reunión." : "Indique la dirección de la entrevista.");
  } else if (valores.modalidad === MODALIDAD.VIRTUAL && !esUrlValida(valores.lugar.trim())) {
    agregar("lugar_enlace", "El enlace debe empezar con http:// o https://.");
  }
  if (!valores.idEvaluador) agregar("id_entrevistador_empleado", "Elija al evaluador.");
  return errores.length ? { errores } : null;
}

// Los errores del backend llegan con los nombres de la API; fecha y hora se muestran en sus propios campos.
const campoVisible = (error, campo) =>
  errorDeCampo(error, campo) ?? (campo === "hora" ? errorDeCampo(error, "fecha_hora_programada") : undefined);

/**
 * RF-15: agenda una entrevista (o la reprograma si recibe `entrevista`). Muestra la agenda del evaluador para el día
 * elegido y, si el backend advierte un solapamiento, permite guardar de todas formas.
 */
export default function FormularioEntrevista({ postulacion, entrevista, empleados, sesion, onGuardado, onVolver }) {
  const reprogramando = Boolean(entrevista);
  const [valores, setValores] = useState(() => valoresIniciales(entrevista));
  const [motivo, setMotivo] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState(null);
  const [solapadas, setSolapadas] = useState(null);
  const [agenda, setAgenda] = useState({ clave: null, citas: [], error: null });

  const { fecha, hora, duracion, modalidad, lugar, idEvaluador } = valores;
  const claveAgenda = fecha && idEvaluador ? `${idEvaluador}|${fecha}` : null;

  useEffect(() => {
    if (!claveAgenda) return undefined;
    const controlador = new AbortController();
    const [evaluador, dia] = claveAgenda.split("|");
    obtenerAgendaEntrevistas(
      { desde: `${dia}T00:00`, hasta: `${sumarDias(dia, 1)}T00:00`, idEntrevistador: evaluador },
      { signal: controlador.signal },
    )
      .then((datos) => setAgenda({ clave: claveAgenda, citas: datos.entrevistas, error: null }))
      .catch((falla) => falla.name !== "AbortError" && setAgenda({ clave: claveAgenda, citas: [], error: falla.message }));
    return () => controlador.abort();
  }, [claveAgenda]);

  const agendaDelDia = agenda.clave === claveAgenda ? agenda.citas.filter(estaActiva) : [];
  const ocupadas = agendaDelDia.filter((cita) => cita.id_entrevista !== entrevista?.id_entrevista);
  const cruces = citasQueSeCruzan(ocupadas, { fecha, hora, duracion, excluirId: entrevista?.id_entrevista });

  const cambiar = (campo) => (evento) => {
    setValores((actual) => ({ ...actual, [campo]: evento.target.value }));
    setSolapadas(null);
  };

  const evaluadores = empleados
    .filter((e) => e.activo !== false)
    .map((e) => ({ valor: e.id_empleado, etiqueta: e.cargo ? `${e.nombre_completo} · ${e.cargo}` : e.nombre_completo }));
  if (reprogramando && !evaluadores.some((e) => e.valor === entrevista.id_entrevistador_empleado)) {
    evaluadores.unshift({ valor: entrevista.id_entrevistador_empleado, etiqueta: entrevista.nombre_entrevistador });
  }
  const duraciones = DURACIONES.some((d) => d.valor === duracion)
    ? DURACIONES
    : [...DURACIONES, { valor: duracion, etiqueta: `${duracion} minutos` }];

  const guardar = async (confirmarSolapamiento = false) => {
    const errorLocal = validar(valores);
    if (errorLocal) {
      setError(errorLocal);
      return;
    }
    setProcesando(true);
    setError(null);
    const cuerpo = {
      fecha_hora_programada: `${fecha}T${hora}`,
      duracion_minutos: Number(duracion),
      modalidad,
      lugar_enlace: lugar.trim(),
      id_entrevistador_empleado: idEvaluador,
      ...(confirmarSolapamiento && { confirmar_solapamiento: true }),
      ...(reprogramando && motivo.trim() && { motivo: motivo.trim() }),
    };
    try {
      const respuesta = reprogramando
        ? await reprogramarEntrevista(entrevista.id_entrevista, cuerpo, sesion)
        : await agendarEntrevista(postulacion.id_postulacion, cuerpo, sesion);
      onGuardado(respuesta);
    } catch (falla) {
      if (falla.status === 409 && falla.datos?.solapamiento) {
        setSolapadas(falla.datos.entrevistas_solapadas ?? []);
      } else {
        setError(falla);
      }
      setProcesando(false);
    }
  };

  const enviar = (evento) => {
    evento.preventDefault();
    guardar(false);
  };

  const virtual = modalidad === MODALIDAD.VIRTUAL;
  const titulo = reprogramando ? "Reprogramar entrevista" : "Agendar entrevista";

  return (
    <Modal
      abierto
      titulo={titulo}
      onCerrar={onVolver}
      bloqueado={procesando}
      pie={
        <>
          <Boton variante="sutil" onClick={onVolver} disabled={procesando}>
            Volver
          </Boton>
          {solapadas ? (
            <Boton variante="primario" cargando={procesando} onClick={() => guardar(true)}>
              Guardar de todas formas
            </Boton>
          ) : (
            <Boton type="submit" form="en-form-entrevista" variante="primario" cargando={procesando}>
              {reprogramando ? "Reprogramar y avisar" : "Agendar y avisar"}
            </Boton>
          )}
        </>
      }
    >
      <form id="en-form-entrevista" className="pl-formulario" onSubmit={enviar} noValidate>
        <p className="pl-sutil">
          Entrevista de <strong>{nombreCandidato(postulacion)}</strong> ({postulacion.nombre_etapa}). Al guardar se le
          enviará un correo a {postulacion.correo_electronico} con los datos de la cita.
        </p>

        <div className="en-rejilla">
          <CampoTexto
            etiqueta="Fecha"
            type="date"
            requerido
            min={hoyLocal()}
            value={fecha}
            onChange={cambiar("fecha")}
            error={errorDeCampo(error, "fecha")}
            data-autofocus
          />
          <Selector
            etiqueta="Hora de inicio"
            requerido
            value={hora}
            onChange={cambiar("hora")}
            textoVacio="Elija la hora"
            opciones={HORAS.some((h) => h.valor === hora) || !hora ? HORAS : [{ valor: hora, etiqueta: hora }, ...HORAS]}
            ayuda="Hora de La Paz."
            error={campoVisible(error, "hora")}
          />
          <Selector
            etiqueta="Duración"
            requerido
            value={duracion}
            onChange={cambiar("duracion")}
            opciones={duraciones}
            error={errorDeCampo(error, "duracion_minutos")}
          />
          <Selector
            etiqueta="Modalidad"
            requerido
            value={modalidad}
            onChange={cambiar("modalidad")}
            textoVacio="Elija la modalidad"
            opciones={[
              { valor: MODALIDAD.PRESENCIAL, etiqueta: "Presencial" },
              { valor: MODALIDAD.VIRTUAL, etiqueta: "Virtual" },
            ]}
            error={errorDeCampo(error, "modalidad")}
          />
        </div>

        <CampoTexto
          etiqueta={virtual ? "Enlace de la reunión" : "Dirección"}
          requerido
          type={virtual ? "url" : "text"}
          inputMode={virtual ? "url" : undefined}
          placeholder={virtual ? "https://meet.google.com/…" : "Oficina central, Av. Arce 2631, piso 3"}
          maxLength={MAX_LUGAR}
          value={lugar}
          onChange={cambiar("lugar")}
          ayuda={virtual ? "El candidato recibirá este enlace por correo." : "El candidato recibirá esta dirección por correo."}
          error={errorDeCampo(error, "lugar_enlace")}
        />

        <Selector
          etiqueta="Evaluador"
          requerido
          value={idEvaluador}
          onChange={cambiar("idEvaluador")}
          textoVacio={evaluadores.length ? "Elija al evaluador" : "No hay empleados registrados"}
          opciones={evaluadores}
          error={errorDeCampo(error, "id_entrevistador_empleado")}
        />

        {claveAgenda && (
          <section className="pl-seccion" aria-labelledby="en-titulo-agenda" aria-live="polite">
            <h3 id="en-titulo-agenda" className="pl-seccion__titulo">
              <CalendarClock className="ds-icono" aria-hidden="true" /> Agenda del evaluador ese día
            </h3>
            {agenda.clave !== claveAgenda ? (
              <p className="pl-sutil">Consultando la agenda…</p>
            ) : agenda.error ? (
              <p className="pl-sutil">No se pudo consultar la agenda: {agenda.error}</p>
            ) : ocupadas.length === 0 ? (
              <p className="pl-sutil">No tiene otras entrevistas ese día.</p>
            ) : (
              <ul className="en-agenda">
                {ocupadas.map((cita) => {
                  const choca = cruces.some((c) => c.id_entrevista === cita.id_entrevista);
                  return (
                    <li key={cita.id_entrevista} className={`en-agenda__item${choca ? " en-agenda__item--choque" : ""}`}>
                      <strong>
                        {partesLocales(cita.fecha_hora_programada).hora}–{partesLocales(cita.fecha_hora_fin).hora}
                      </strong>
                      <span>
                        {cita.modalidad === MODALIDAD.VIRTUAL ? (
                          <Video className="ds-icono" aria-label="Virtual" />
                        ) : (
                          <MapPin className="ds-icono" aria-label="Presencial" />
                        )}{" "}
                        {nombreCandidato(cita)}
                      </span>
                      {choca && <span className="en-agenda__choque">Se cruza con el horario elegido</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {reprogramando && (
          <CampoAreaTexto
            etiqueta="Motivo del cambio (opcional)"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={MAX_MOTIVO}
            filas={2}
            ayuda={`${motivo.length}/${MAX_MOTIVO} caracteres. Se incluye en el correo al candidato.`}
            error={errorDeCampo(error, "motivo")}
          />
        )}

        {solapadas ? (
          <Alerta tono="aviso" role="alert" titulo="El evaluador ya tiene entrevistas en ese horario">
            <ul className="pl-pasos">
              {solapadas.map((cita) => (
                <li key={cita.id_entrevista}>
                  {partesLocales(cita.fecha_hora_programada).hora}–{partesLocales(cita.fecha_hora_fin).hora} con{" "}
                  {nombreCandidato(cita)}
                </li>
              ))}
            </ul>
            Cambie la fecha, la hora o el evaluador, o guarde de todas formas si el cruce es intencional.
          </Alerta>
        ) : (
          cruces.length > 0 && (
            <Alerta tono="aviso" titulo="Posible solapamiento">
              El horario elegido se cruza con {cruces.length === 1 ? "otra entrevista" : `${cruces.length} entrevistas`} del
              evaluador.
            </Alerta>
          )
        )}

        {error && !error.errores?.length && (
          <Alerta tono="peligro" role="alert" titulo={`No se pudo ${reprogramando ? "reprogramar" : "agendar"} la entrevista`}>
            {error.message}
          </Alerta>
        )}
      </form>
    </Modal>
  );
}
