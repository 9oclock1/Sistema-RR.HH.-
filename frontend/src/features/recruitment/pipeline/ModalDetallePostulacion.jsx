import { useEffect, useState } from "react";
import { Alerta, Boton, Esqueleto, Etiqueta, Modal } from "../../../components/ui";
import { obtenerHistorialEtapas, obtenerIntegraciones, reintentarIntegracion } from "../../../api/pipelineSeleccion";
import ListaIntegraciones from "./ListaIntegraciones";
import { formatearFecha, nombreCompleto, tonoEtapa } from "./reglas";

// RF-14: trazabilidad de la postulación (quién cambió cada etapa y cuándo) y estado del alta en el ERP.
export default function ModalDetallePostulacion({ postulacion, sesion, onCerrar, onActualizar }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [recarga, setRecarga] = useState(0);
  const [reintentando, setReintentando] = useState(null);
  const [errorReintento, setErrorReintento] = useState(null);

  useEffect(() => {
    const controlador = new AbortController();
    const opciones = { signal: controlador.signal };
    Promise.all([
      obtenerHistorialEtapas(postulacion.id_postulacion, opciones),
      obtenerIntegraciones(postulacion.id_postulacion, opciones),
    ])
      .then(([historial, integraciones]) => setDatos({ historial, integraciones }))
      .catch((falla) => falla.name !== "AbortError" && setError(falla.message));
    return () => controlador.abort();
  }, [postulacion.id_postulacion, recarga]);

  const reintentar = async (evento) => {
    setReintentando(evento.id_evento);
    setErrorReintento(null);
    try {
      await reintentarIntegracion(evento.id_evento, sesion);
      setRecarga((n) => n + 1);
      onActualizar();
    } catch (falla) {
      setErrorReintento(falla.message);
    } finally {
      setReintentando(null);
    }
  };

  let contenido;
  if (error) {
    contenido = (
      <Alerta tono="peligro" role="alert" titulo="No se pudo cargar el historial">
        {error}
      </Alerta>
    );
  } else if (!datos) {
    contenido = (
      <div className="pl-detalle" role="status" aria-label="Cargando historial">
        {[0, 1, 2].map((n) => (
          <Esqueleto key={n} ancho="100%" />
        ))}
      </div>
    );
  } else {
    contenido = (
      <>
        {datos.integraciones.length > 0 && (
          <section className="pl-seccion" aria-labelledby="pl-titulo-alta">
            <h3 id="pl-titulo-alta" className="pl-seccion__titulo">
              Alta en el ERP
            </h3>
            {errorReintento && (
              <Alerta tono="peligro" role="alert">
                {errorReintento}
              </Alerta>
            )}
            <ListaIntegraciones
              integraciones={datos.integraciones}
              reintentando={reintentando}
              onReintentar={reintentar}
            />
          </section>
        )}

        <section className="pl-seccion" aria-labelledby="pl-titulo-historial">
          <h3 id="pl-titulo-historial" className="pl-seccion__titulo">
            Cambios de etapa
          </h3>
          {datos.historial.length === 0 ? (
            <p className="pl-sutil">Aún no tiene cambios de etapa: sigue en «{postulacion.nombre_etapa}».</p>
          ) : (
            <ol className="pl-lista">
              {datos.historial.map((cambio) => (
                <li key={cambio.id_historial} className="pl-lista__item">
                  <div className="pl-lista__fila">
                    {cambio.nombre_etapa_anterior && (
                      <>
                        <Etiqueta tono={tonoEtapa(cambio.codigo_etapa_anterior)}>{cambio.nombre_etapa_anterior}</Etiqueta>
                        <span aria-label="a">→</span>
                      </>
                    )}
                    <Etiqueta tono={tonoEtapa(cambio.codigo_etapa)}>{cambio.nombre_etapa}</Etiqueta>
                  </div>
                  <p className="pl-sutil">
                    {formatearFecha(cambio.fecha_cambio, { conHora: true })} ·{" "}
                    {cambio.nombre_usuario_evaluador ?? `Usuario ${cambio.id_usuario_evaluador.slice(0, 8)}`}
                  </p>
                  {cambio.motivo && <p className="pl-texto">{cambio.motivo}</p>}
                </li>
              ))}
            </ol>
          )}
        </section>
      </>
    );
  }

  return (
    <Modal
      abierto
      titulo={nombreCompleto(postulacion)}
      onCerrar={onCerrar}
      pie={
        <Boton variante="sutil" onClick={onCerrar}>
          Cerrar
        </Boton>
      }
    >
      <div className="pl-detalle">{contenido}</div>
    </Modal>
  );
}
