import { useEffect, useState } from "react";
import { CalendarX, Pencil } from "lucide-react";
import { Alerta, Boton, Esqueleto, Etiqueta, Modal, useAvisos } from "../../../components/ui";
import { obtenerDetalleEntrevista, reintentarAvisoEntrevista } from "../../../api/entrevistas";
import EstadoAviso from "./EstadoAviso";
import FormularioEntrevista from "./FormularioEntrevista";
import ModalCancelarEntrevista from "./ModalCancelarEntrevista";
import { MODALIDAD, esAgendable, estaActiva, formatearCita, nombreCandidato, partesLocales, formatearDia, tonoEstado } from "./reglasEntrevista";

const formatearCambio = (valor) => `${formatearDia(valor)} ${partesLocales(valor).hora}`;

// RF-15.5: detalle de una cita de la agenda, con su historial de cambios y las acciones de reprogramar o cancelar.
export default function ModalDetalleEntrevista({ entrevista, empleados, sesion, puedeEditar, onCerrar, onActualizar }) {
  const avisar = useAvisos();
  const [detalle, setDetalle] = useState(null);
  const [error, setError] = useState(null);
  const [consulta, setConsulta] = useState(0);
  const [modo, setModo] = useState("detalle");
  const [reintentando, setReintentando] = useState(null);

  useEffect(() => {
    const controlador = new AbortController();
    obtenerDetalleEntrevista(entrevista.id_entrevista, { signal: controlador.signal })
      .then((datos) => {
        setDetalle(datos);
        setError(null);
      })
      .catch((falla) => falla.name !== "AbortError" && setError(falla.message));
    return () => controlador.abort();
  }, [entrevista.id_entrevista, consulta]);

  // Los datos de la agenda sirven mientras llega el detalle completo.
  const cita = detalle ?? entrevista;

  const alGuardar = (titulo) => (respuesta) => {
    setModo("detalle");
    setConsulta((n) => n + 1);
    onActualizar();
    avisar({ tono: "exito", titulo, mensaje: respuesta.message });
  };

  const reintentar = async () => {
    setReintentando(cita.id_ultimo_aviso);
    try {
      await reintentarAvisoEntrevista(cita.id_ultimo_aviso, sesion);
      setConsulta((n) => n + 1);
      onActualizar();
    } catch (falla) {
      avisar({ tono: "peligro", titulo: "No se pudo reintentar el correo", mensaje: falla.message });
    } finally {
      setReintentando(null);
    }
  };

  if (modo === "reprogramar") {
    return (
      <FormularioEntrevista
        postulacion={cita}
        entrevista={cita}
        empleados={empleados}
        sesion={sesion}
        onGuardado={alGuardar("Entrevista reprogramada")}
        onVolver={() => setModo("detalle")}
      />
    );
  }
  if (modo === "cancelar") {
    return (
      <ModalCancelarEntrevista
        entrevista={cita}
        sesion={sesion}
        onCancelada={alGuardar("Entrevista cancelada")}
        onVolver={() => setModo("detalle")}
      />
    );
  }

  const activa = estaActiva(cita);
  const virtual = cita.modalidad === MODALIDAD.VIRTUAL;

  return (
    <Modal
      abierto
      titulo={`Entrevista con ${nombreCandidato(cita)}`}
      onCerrar={onCerrar}
      pie={
        <>
          {activa && puedeEditar && (
            <>
              <Boton variante="sutil" icono={CalendarX} onClick={() => setModo("cancelar")}>
                Cancelar entrevista
              </Boton>
              <Boton icono={Pencil} onClick={() => setModo("reprogramar")} disabled={!esAgendable(cita)}>
                Reprogramar
              </Boton>
            </>
          )}
          <Boton variante="primario" onClick={onCerrar} data-autofocus>
            Cerrar
          </Boton>
        </>
      }
    >
      <div className="pl-detalle">
        <div className="pl-lista__fila">
          <Etiqueta tono={tonoEstado(cita.codigo_estado)}>{cita.nombre_estado}</Etiqueta>
          {activa && (
            <EstadoAviso entrevista={cita} reintentando={reintentando} puedeEditar={puedeEditar} onReintentar={reintentar} />
          )}
        </div>

        <dl className="pl-datos">
          <div>
            <dt>Cuándo</dt>
            <dd>{formatearCita(cita)}</dd>
          </div>
          <div>
            <dt>{virtual ? "Enlace" : "Dirección"}</dt>
            <dd>
              {virtual ? (
                <a href={cita.lugar_enlace} target="_blank" rel="noreferrer">
                  {cita.lugar_enlace}
                </a>
              ) : (
                cita.lugar_enlace
              )}
            </dd>
          </div>
          <div>
            <dt>Evaluador</dt>
            <dd>{cita.nombre_entrevistador}</dd>
          </div>
          <div>
            <dt>Puesto</dt>
            <dd>
              {cita.codigo_convocatoria} · {cita.titulo_puesto}
            </dd>
          </div>
          <div>
            <dt>Candidato</dt>
            <dd>
              {cita.correo_electronico}
              {cita.telefono_contacto && ` · ${cita.telefono_contacto}`} · {cita.nombre_etapa}
            </dd>
          </div>
        </dl>

        {activa && !esAgendable(cita) && (
          <Alerta tono="aviso">
            El postulante ya no está en «Entrevista técnica» ni «Apto»: la cita solo se puede cancelar.
          </Alerta>
        )}

        <section className="pl-seccion" aria-labelledby="en-titulo-historial">
          <h3 id="en-titulo-historial" className="pl-seccion__titulo">
            Historial de la cita
          </h3>
          {error ? (
            <Alerta tono="peligro" role="alert">
              {error}
            </Alerta>
          ) : !detalle ? (
            <Esqueleto ancho="100%" />
          ) : (
            <ol className="pl-lista">
              {detalle.historial.map((cambio) => (
                <li key={cambio.id_historial} className="pl-lista__item">
                  <div className="pl-lista__fila">
                    <Etiqueta tono={tonoEstado(cambio.codigo_estado)}>{cambio.nombre_estado}</Etiqueta>
                    <span className="pl-sutil">
                      {formatearCambio(cambio.fecha_cambio)} · {cambio.nombre_usuario ?? `Usuario ${cambio.id_usuario.slice(0, 8)}`}
                    </span>
                  </div>
                  {cambio.fecha_hora_anterior && cambio.fecha_hora_anterior !== cambio.fecha_hora_nueva && (
                    <p className="pl-sutil">
                      De {formatearCambio(cambio.fecha_hora_anterior)} a {formatearCambio(cambio.fecha_hora_nueva)}
                    </p>
                  )}
                  {cambio.motivo && <p className="pl-texto">{cambio.motivo}</p>}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </Modal>
  );
}
