import { useEffect, useState } from "react";
import { CalendarPlus, CalendarX, MapPin, Pencil, Video } from "lucide-react";
import { Alerta, Boton, Esqueleto, Etiqueta, Modal, useAvisos } from "../../../components/ui";
import { obtenerEntrevistasPostulacion, reintentarAvisoEntrevista } from "../../../api/entrevistas";
import EstadoAviso from "./EstadoAviso";
import FormularioEntrevista from "./FormularioEntrevista";
import ModalCancelarEntrevista from "./ModalCancelarEntrevista";
import { MODALIDAD, esAgendable, estaActiva, formatearCita, nombreCandidato, tonoEstado } from "./reglasEntrevista";
import "./entrevistas.css";

// Mientras un correo siga en cola se consulta su estado; el despachador envía cada pocos segundos.
const INTERVALO_AVISOS_MS = 3000;

/**
 * RF-15: entrevistas de una postulación. Desde aquí se agenda una nueva (si el postulante está en «Entrevista
 * técnica» o «Apto») y se reprograman o cancelan las vigentes; cada cambio se avisa al candidato por correo.
 */
export default function ModalEntrevistas({ postulacion, empleados, sesion, puedeEditar, onCerrar, onActualizar }) {
  const avisar = useAvisos();
  const [entrevistas, setEntrevistas] = useState(null);
  const [error, setError] = useState(null);
  const [consulta, setConsulta] = useState(0);
  const [vista, setVista] = useState({ modo: "lista" });
  const [reintentando, setReintentando] = useState(null);

  useEffect(() => {
    const controlador = new AbortController();
    obtenerEntrevistasPostulacion(postulacion.id_postulacion, { signal: controlador.signal })
      .then((lista) => {
        setEntrevistas(lista);
        setError(null);
      })
      .catch((falla) => falla.name !== "AbortError" && setError(falla.message));
    return () => controlador.abort();
  }, [postulacion.id_postulacion, consulta]);

  const enCola = entrevistas?.some((e) => e.estado_ultimo_aviso === "PENDIENTE");
  useEffect(() => {
    if (!enCola) return undefined;
    const temporizador = setTimeout(() => setConsulta((n) => n + 1), INTERVALO_AVISOS_MS);
    return () => clearTimeout(temporizador);
  }, [enCola, entrevistas]);

  const alGuardar = (titulo) => (respuesta) => {
    setVista({ modo: "lista" });
    setConsulta((n) => n + 1);
    onActualizar();
    avisar({ tono: "exito", titulo, mensaje: respuesta.message });
  };

  const reintentar = async (entrevista) => {
    setReintentando(entrevista.id_ultimo_aviso);
    try {
      await reintentarAvisoEntrevista(entrevista.id_ultimo_aviso, sesion);
      setConsulta((n) => n + 1);
    } catch (falla) {
      avisar({ tono: "peligro", titulo: "No se pudo reintentar el correo", mensaje: falla.message });
    } finally {
      setReintentando(null);
    }
  };

  if (vista.modo === "formulario") {
    return (
      <FormularioEntrevista
        key={vista.entrevista?.id_entrevista ?? "nueva"}
        postulacion={postulacion}
        entrevista={vista.entrevista}
        empleados={empleados}
        sesion={sesion}
        onGuardado={alGuardar(vista.entrevista ? "Entrevista reprogramada" : "Entrevista agendada")}
        onVolver={() => setVista({ modo: "lista" })}
      />
    );
  }
  if (vista.modo === "cancelar") {
    return (
      <ModalCancelarEntrevista
        entrevista={vista.entrevista}
        sesion={sesion}
        onCancelada={alGuardar("Entrevista cancelada")}
        onVolver={() => setVista({ modo: "lista" })}
      />
    );
  }

  const agendable = puedeEditar && esAgendable(postulacion);
  let contenido;
  if (error) {
    contenido = (
      <Alerta tono="peligro" role="alert" titulo="No se pudieron cargar las entrevistas">
        {error}
      </Alerta>
    );
  } else if (!entrevistas) {
    contenido = (
      <div className="pl-detalle" role="status" aria-label="Cargando entrevistas">
        {[0, 1].map((n) => (
          <Esqueleto key={n} ancho="100%" />
        ))}
      </div>
    );
  } else if (entrevistas.length === 0) {
    contenido = <p className="pl-sutil">Aún no tiene entrevistas agendadas.</p>;
  } else {
    contenido = (
      <ol className="pl-lista" aria-label="Entrevistas">
        {entrevistas.map((entrevista) => {
          const activa = estaActiva(entrevista);
          const virtual = entrevista.modalidad === MODALIDAD.VIRTUAL;
          return (
            <li key={entrevista.id_entrevista} className="pl-lista__item">
              <div className="pl-lista__fila">
                <strong>{formatearCita(entrevista)}</strong>
                <Etiqueta tono={tonoEstado(entrevista.codigo_estado)}>{entrevista.nombre_estado}</Etiqueta>
                {activa && (
                  <EstadoAviso
                    entrevista={entrevista}
                    reintentando={reintentando}
                    puedeEditar={puedeEditar}
                    onReintentar={reintentar}
                  />
                )}
              </div>
              <p className="pl-sutil en-lugar">
                {virtual ? <Video className="ds-icono" aria-hidden="true" /> : <MapPin className="ds-icono" aria-hidden="true" />}
                <span>
                  {virtual ? "Virtual" : "Presencial"} · {entrevista.lugar_enlace}
                </span>
              </p>
              <p className="pl-sutil">Evaluador: {entrevista.nombre_entrevistador}</p>
              {activa && puedeEditar && (
                <div className="pl-tarjeta__acciones">
                  <Boton
                    tamano="sm"
                    variante="sutil"
                    icono={Pencil}
                    onClick={() => setVista({ modo: "formulario", entrevista })}
                    disabled={!esAgendable(postulacion)}
                  >
                    Reprogramar
                  </Boton>
                  <Boton tamano="sm" variante="sutil" icono={CalendarX} onClick={() => setVista({ modo: "cancelar", entrevista })}>
                    Cancelar
                  </Boton>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <Modal
      abierto
      titulo={`Entrevistas de ${nombreCandidato(postulacion)}`}
      onCerrar={onCerrar}
      pie={
        <>
          <Boton variante="sutil" onClick={onCerrar}>
            Cerrar
          </Boton>
          {agendable && (
            <Boton variante="primario" icono={CalendarPlus} onClick={() => setVista({ modo: "formulario" })} data-autofocus>
              Agendar entrevista
            </Boton>
          )}
        </>
      }
    >
      <div className="pl-detalle">
        {!esAgendable(postulacion) && (
          <Alerta tono="info">
            Solo se agendan entrevistas a postulantes en «Entrevista técnica» o «Apto»; este se encuentra en «
            {postulacion.nombre_etapa}».
          </Alerta>
        )}
        {contenido}
      </div>
    </Modal>
  );
}
