import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, Send, UserRound } from "lucide-react";
import {
  enviarEvaluacion,
  guardarRespuestas,
  guardarRetroalimentacion,
  obtenerEvaluacion,
} from "../../api/evaluaciones";
import {
  Alerta,
  Avatar,
  Boton,
  EncabezadoPagina,
  Esqueleto,
  EstadoVacio,
  Etiqueta,
  ModalConfirmacion,
  Tarjeta,
  useAvisos,
} from "../../components/ui";
import { useUsuario } from "../../context/sesion";
import { formatearFecha } from "../solicitud-vacaciones/formato";
import EstadoGuardado from "./EstadoGuardado";
import ResultadoEvaluacion from "./ResultadoEvaluacion";
import {
  FormularioRetroalimentacion,
  RetroalimentacionBloqueada,
  VistaRetroalimentacion,
} from "./RetroalimentacionEvaluacion";
import { aCuerpo, aEstado, erroresDelServicio, mismoContenido, validarRetroalimentacion } from "./retroalimentacion";
import SeccionEvaluacion from "./SeccionEvaluacion";
import useAutoguardado from "./useAutoguardado";
import { describirPlazo, ESTADOS_EVALUACION, formatearPuntaje, hoyEnBolivia, idCampoPregunta } from "./formato";
import { RUTA_EVALUACIONES } from "./ruta";
import "./evaluaciones.css";

const MIGAS = [
  { etiqueta: "Inicio", href: "/" },
  { etiqueta: "Desempeño" },
  { etiqueta: "Evaluaciones", href: RUTA_EVALUACIONES },
];

const esConflicto = (error) => error.estado === 409;

const respuestasIniciales = (datos) =>
  Object.fromEntries(
    datos.secciones
      .flatMap((seccion) => seccion.criterios.flatMap((criterio) => criterio.preguntas))
      .map((pregunta) => [pregunta.id_pregunta, pregunta.respuesta?.id_nivel ?? null]),
  );

function VolverALaBandeja() {
  return (
    <Boton as={Link} to={RUTA_EVALUACIONES} icono={ArrowLeft}>
      Volver a las evaluaciones
    </Boton>
  );
}

function Formulario({ datos, idEvaluador, aviso, onConflicto }) {
  const avisar = useAvisos();
  const [respuestas, setRespuestas] = useState(() => respuestasIniciales(datos));
  const [estado, setEstado] = useState(datos.estado_codigo);
  const [resultado, setResultado] = useState(datos.resultado);
  const [enviadaEn, setEnviadaEn] = useState(datos.enviada_en);
  const [faltantes, setFaltantes] = useState([]);
  const [intentosFallidos, setIntentosFallidos] = useState(0);
  const [errorEnvio, setErrorEnvio] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [recienEnviada, setRecienEnviada] = useState(false);
  // KAN-26: retroalimentación final. «guardada» es lo último confirmado por el servicio.
  const [retro, setRetro] = useState(() => aEstado(datos.retroalimentacion));
  const [retroGuardada, setRetroGuardada] = useState(() => aEstado(datos.retroalimentacion));
  const [erroresRetro, setErroresRetro] = useState({});
  const [guardandoRetro, setGuardandoRetro] = useState(false);
  const refResumen = useRef(null);
  const refResultado = useRef(null);

  const editable = estado === "PENDIENTE" || estado === "BORRADOR";
  const colaborador = datos.colaborador.nombre_completo;

  const preguntas = useMemo(
    () => datos.secciones.flatMap((seccion) => seccion.criterios.flatMap((criterio) => criterio.preguntas)),
    [datos],
  );
  const escalas = useMemo(() => new Map(datos.escalas.map((escala) => [escala.id_escala, escala])), [datos]);

  const obligatorias = preguntas.filter((pregunta) => pregunta.es_obligatoria);
  const obligatoriasRespondidas = obligatorias.filter((pregunta) => respuestas[pregunta.id_pregunta]).length;
  const respondidas = preguntas.filter((pregunta) => respuestas[pregunta.id_pregunta]).length;
  const puntajesCompletos = respondidas > 0 && obligatoriasRespondidas === obligatorias.length;
  const retroSinGuardar = !mismoContenido(retro, retroGuardada);

  const guardar = useCallback(
    (lote) =>
      guardarRespuestas(idEvaluador, datos.id_evaluacion, lote)
        .then((guardada) => {
          setEstado(guardada.estado_codigo);
          return guardada;
        })
        .catch((error) => {
          if (esConflicto(error)) onConflicto(error.message);
          throw error;
        }),
    [idEvaluador, datos.id_evaluacion, onConflicto],
  );
  const autoguardado = useAutoguardado({ guardar, esDefinitivo: esConflicto });

  useEffect(() => {
    if (intentosFallidos > 0) refResumen.current?.focus();
  }, [intentosFallidos]);

  useEffect(() => {
    if (recienEnviada) refResultado.current?.focus();
  }, [recienEnviada]);

  const cambiar = (idPregunta, idNivel) => {
    setRespuestas((actuales) => ({ ...actuales, [idPregunta]: idNivel }));
    if (idNivel) setFaltantes((actuales) => actuales.filter((id) => id !== idPregunta));
    autoguardado.encolar(idPregunta, idNivel);
  };

  const cambiarRetro = (valor) => {
    setRetro(valor);
    setErroresRetro({});
  };

  // Devuelve true si quedó guardada. Valida antes en el navegador con las mismas reglas del servicio.
  const guardarRetro = async () => {
    const errores = validarRetroalimentacion(retro, hoyEnBolivia());
    setErroresRetro(errores);
    if (Object.keys(errores).length > 0) return false;
    setGuardandoRetro(true);
    try {
      const guardada = await guardarRetroalimentacion(idEvaluador, datos.id_evaluacion, aCuerpo(retro));
      const estadoGuardado = aEstado(guardada.retroalimentacion);
      setRetro(estadoGuardado);
      setRetroGuardada(estadoGuardado);
      avisar({ tono: "exito", titulo: "Retroalimentación guardada" });
      return true;
    } catch (error) {
      if (esConflicto(error)) onConflicto(error.message);
      else if (error.estado === 400 && error.detalles?.length) setErroresRetro(erroresDelServicio(error.detalles));
      else avisar({ tono: "peligro", titulo: "No se pudo guardar la retroalimentación", mensaje: error.message });
      return false;
    } finally {
      setGuardandoRetro(false);
    }
  };

  const mostrarFaltantes = (ids) => {
    setFaltantes(ids);
    setIntentosFallidos((n) => n + 1);
  };

  // Primero se guarda lo pendiente; si faltan obligatorias se resaltan y no se envía nada al servidor.
  const pedirEnvio = async () => {
    setErrorEnvio(null);
    try {
      await autoguardado.guardarAhora();
    } catch {
      setErrorEnvio("No se pudieron guardar sus respuestas, por eso la evaluación no se envió. Inténtelo de nuevo.");
      return;
    }
    const sinResponder = obligatorias.filter((pregunta) => !respuestas[pregunta.id_pregunta]);
    if (sinResponder.length > 0) {
      mostrarFaltantes(sinResponder.map((pregunta) => pregunta.id_pregunta));
      return;
    }
    // La retroalimentación escrita y no guardada se guarda antes de enviar, para que no se pierda.
    if (retroSinGuardar && !(await guardarRetro())) {
      setErrorEnvio("Revise la retroalimentación final: no se pudo guardar, por eso la evaluación no se envió.");
      return;
    }
    setConfirmando(true);
  };

  const confirmarEnvio = async () => {
    setEnviando(true);
    try {
      const enviada = await enviarEvaluacion(idEvaluador, datos.id_evaluacion);
      setEstado("ENVIADA");
      setResultado(enviada.resultado);
      setEnviadaEn(enviada.enviada_en);
      setFaltantes([]);
      setRecienEnviada(true);
      avisar({ tono: "exito", titulo: "Evaluación enviada", mensaje: `Puntaje final: ${formatearPuntaje(enviada.puntaje_final)} de 100.` });
    } catch (error) {
      if (error.estado === 422 && error.detalles?.length) {
        mostrarFaltantes(error.detalles.map((detalle) => detalle.id_pregunta).filter(Boolean));
      } else if (esConflicto(error)) {
        onConflicto(error.message);
      } else {
        setErrorEnvio(error.message);
      }
    } finally {
      setConfirmando(false);
      setEnviando(false);
    }
  };

  const enfocarPregunta = (evento, idPregunta) => {
    evento.preventDefault();
    document.querySelector(`#${idCampoPregunta(idPregunta)} input`)?.focus();
  };

  const errores = Object.fromEntries(faltantes.map((id) => [id, "Esta pregunta es obligatoria."]));
  const plazo = editable ? describirPlazo(datos.ciclo.fecha_limite) : null;
  const estadoVisual = ESTADOS_EVALUACION[estado];

  return (
    <div className="ev-formulario">
      <EncabezadoPagina
        migas={MIGAS}
        enlace={Link}
        titulo={`Evaluación de ${colaborador}`}
        idTitulo="ev-formulario-titulo"
        descripcion={datos.plantilla.objetivo}
        acciones={
          editable && (
            <div className="ev-acciones">
              <EstadoGuardado estado={autoguardado.estado} guardadoEn={autoguardado.guardadoEn} onReintentar={autoguardado.reintentar} />
              <Boton variante="primario" icono={Send} onClick={pedirEnvio}>
                Enviar evaluación
              </Boton>
            </div>
          )
        }
      />

      {aviso && (
        <Alerta tono="aviso" titulo="La evaluación ya no se puede modificar">
          {aviso}
        </Alerta>
      )}
      {estado === "VENCIDA" && !aviso && (
        <Alerta tono="aviso" titulo="Esta evaluación venció">
          Ya no se puede responder. Se muestran las respuestas que se alcanzaron a guardar.
        </Alerta>
      )}
      {errorEnvio && (
        <Alerta tono="peligro" role="alert" titulo="No se pudo enviar la evaluación" onCerrar={() => setErrorEnvio(null)}>
          {errorEnvio}
        </Alerta>
      )}
      {faltantes.length > 0 && (
        <Alerta
          ref={refResumen}
          tabIndex={-1}
          tono="peligro"
          role="alert"
          titulo={`Faltan ${faltantes.length} ${faltantes.length === 1 ? "pregunta obligatoria" : "preguntas obligatorias"} por responder`}
        >
          <ul className="ev-lista-errores">
            {faltantes.map((idPregunta) => (
              <li key={idPregunta}>
                <a href={`#${idCampoPregunta(idPregunta)}`} onClick={(evento) => enfocarPregunta(evento, idPregunta)}>
                  {preguntas.find((pregunta) => pregunta.id_pregunta === idPregunta)?.texto}
                </a>
              </li>
            ))}
          </ul>
        </Alerta>
      )}
      {estado === "ENVIADA" && resultado && (
        <ResultadoEvaluacion ref={refResultado} resultado={resultado} enviadaEn={enviadaEn} />
      )}

      <Tarjeta className="ev-resumen">
        <div className="ev-resumen__persona">
          <Avatar nombre={colaborador} tamano="lg" decorativo />
          <div>
            <p className="ev-sutil">Colaborador evaluado</p>
            <h2 className="ev-resumen__nombre">{colaborador}</h2>
            <p className="ev-sutil">
              {[datos.colaborador.sucursal, datos.colaborador.departamento].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <dl className="ev-datos">
          <div>
            <dt>Ciclo</dt>
            <dd>{datos.ciclo.nombre}</dd>
          </div>
          <div>
            <dt>Fecha límite</dt>
            <dd>
              {formatearFecha(datos.ciclo.fecha_limite)}
              {plazo && <span className={`ev-plazo ev-plazo--${plazo.tono}`}>{plazo.texto}</span>}
            </dd>
          </div>
          <div>
            <dt>Estado</dt>
            <dd>
              <Etiqueta tono={estadoVisual.tono} icono={estadoVisual.icono}>
                {estadoVisual.texto}
              </Etiqueta>
            </dd>
          </div>
          <div>
            <dt>Avance</dt>
            <dd>
              <progress
                className="ev-progreso"
                value={obligatoriasRespondidas}
                max={Math.max(obligatorias.length, 1)}
                aria-label="Preguntas obligatorias respondidas"
              />
              <span className="ev-sutil">
                {obligatoriasRespondidas} de {obligatorias.length} obligatorias · {respondidas} de {preguntas.length} en total
              </span>
            </dd>
          </div>
        </dl>
      </Tarjeta>

      {editable && (
        <p className="ev-sutil">
          Las preguntas con <span className="ev-requerido">*</span> son obligatorias. Sus respuestas se guardan solas
          mientras trabaja.
        </p>
      )}

      {datos.secciones.length === 0 ? (
        <EstadoVacio titulo="La plantilla no tiene preguntas" mensaje="Avise a RR.HH.: este ciclo no tiene un formulario por responder." />
      ) : (
        datos.secciones.map((seccion) => (
          <SeccionEvaluacion
            key={seccion.id_seccion}
            seccion={seccion}
            escalas={escalas}
            respuestas={respuestas}
            errores={errores}
            editable={editable}
            resultado={resultado?.secciones.find((s) => s.id_seccion === seccion.id_seccion)}
            onCambiar={cambiar}
          />
        ))
      )}

      {estado === "ENVIADA" ? (
        <VistaRetroalimentacion retroalimentacion={aCuerpo(retroGuardada)} />
      ) : editable && datos.secciones.length > 0 ? (
        puntajesCompletos ? (
          <FormularioRetroalimentacion
            valor={retro}
            errores={erroresRetro}
            hoy={hoyEnBolivia()}
            sinGuardar={retroSinGuardar}
            guardando={guardandoRetro}
            onCambiar={cambiarRetro}
            onGuardar={guardarRetro}
          />
        ) : (
          <RetroalimentacionBloqueada faltantes={obligatorias.length - obligatoriasRespondidas} />
        )
      ) : null}

      <div className="ev-pie">
        <VolverALaBandeja />
        {editable && (
          <Boton variante="primario" icono={Send} onClick={pedirEnvio}>
            Enviar evaluación
          </Boton>
        )}
      </div>

      <ModalConfirmacion
        abierto={confirmando}
        titulo="¿Enviar la evaluación?"
        textoConfirmar="Enviar evaluación"
        variante="primario"
        procesando={enviando}
        onConfirmar={confirmarEnvio}
        onCancelar={() => setConfirmando(false)}
      >
        <p>
          Se calculará el puntaje final de {colaborador} y la evaluación quedará bloqueada: después de enviarla no podrá
          modificar sus respuestas ni la retroalimentación final.
        </p>
      </ModalConfirmacion>
    </div>
  );
}

export default function FormularioEvaluacionPage({ idEvaluacion }) {
  const idEvaluador = useUsuario();
  const [intento, setIntento] = useState(0);
  const [aviso, setAviso] = useState(null);
  const [resultado, setResultado] = useState({ clave: null });
  const clave = `${idEvaluador}|${idEvaluacion}|${intento}`;

  useEffect(() => {
    if (!idEvaluador) return undefined;
    let vigente = true;
    obtenerEvaluacion(idEvaluador, idEvaluacion)
      .then((datos) => vigente && setResultado({ clave, datos }))
      .catch((error) => vigente && setResultado({ clave, error }));
    return () => {
      vigente = false;
    };
  }, [clave, idEvaluador, idEvaluacion]);

  const alConflicto = useCallback((mensaje) => {
    setAviso(mensaje);
    setIntento((n) => n + 1);
  }, []);

  const vista = resultado.clave === clave ? resultado : {};

  if (vista.datos) {
    return <Formulario key={clave} datos={vista.datos} idEvaluador={idEvaluador} aviso={aviso} onConflicto={alConflicto} />;
  }

  return (
    <div className="ev-formulario">
      <EncabezadoPagina migas={MIGAS} enlace={Link} titulo="Evaluación" idTitulo="ev-formulario-titulo" />
      {!idEvaluador ? (
        <EstadoVacio
          icono={UserRound}
          titulo="Elija su usuario de prueba"
          mensaje="Seleccione quién es en «Usuario de prueba», al pie de la barra lateral, para abrir la evaluación."
          accion={<VolverALaBandeja />}
        />
      ) : vista.error ? (
        <Alerta
          tono="peligro"
          role="alert"
          titulo={vista.error.estado === 404 ? "No se encontró la evaluación" : "No se pudo abrir la evaluación"}
          acciones={
            <>
              {vista.error.estado !== 404 && vista.error.estado !== 403 && (
                <Boton tamano="sm" onClick={() => setIntento((n) => n + 1)}>
                  Reintentar
                </Boton>
              )}
              <VolverALaBandeja />
            </>
          }
        >
          {vista.error.message}
        </Alerta>
      ) : (
        <div className="ev-carga" aria-busy="true">
          <p className="ds-solo-lector" role="status">
            Cargando la evaluación…
          </p>
          <Esqueleto forma="bloque" alto="6rem" />
          <Esqueleto forma="bloque" alto="12rem" />
        </div>
      )}
    </div>
  );
}
